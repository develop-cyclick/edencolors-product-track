import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdmin } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import * as XLSX from 'xlsx'

interface ClinicRow {
  name: string
  province: string
  branchName?: string
  isActive?: boolean
}

// POST /api/admin/clinics/import - Import clinics from Excel
export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return errorResponse('No file uploaded', 400)
    }

    // Check file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ]
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      return errorResponse('Invalid file type. Please upload Excel (.xlsx, .xls) or CSV file', 400)
    }

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })

    // Get first sheet
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return errorResponse('No sheets found in the file', 400)
    }

    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

    if (data.length === 0) {
      return errorResponse('No data found in the file', 400)
    }

    // Map column names (support both Thai and English)
    const columnMapping: Record<string, keyof ClinicRow> = {
      // English
      name: 'name',
      province: 'province',
      branch: 'branchName',
      branchname: 'branchName',
      branch_name: 'branchName',
      isactive: 'isActive',
      is_active: 'isActive',
      active: 'isActive',
      // Thai
      'ชื่อ': 'name',
      'ชื่อคลินิก': 'name',
      'จังหวัด': 'province',
      'สาขา': 'branchName',
      'ชื่อสาขา': 'branchName',
      'สถานะ': 'isActive',
    }

    // Parse and validate rows
    const clinicsToCreate: ClinicRow[] = []
    const validationErrors: string[] = []

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNum = i + 2 // Excel rows start at 1, plus header row

      const clinic: Partial<ClinicRow> = {}

      // Map columns
      for (const [key, value] of Object.entries(row)) {
        const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, '')
        const mappedField = columnMapping[normalizedKey]
        if (mappedField) {
          if (mappedField === 'isActive') {
            // Convert various values to boolean
            const strValue = String(value).toLowerCase().trim()
            clinic.isActive = strValue === 'true' || strValue === '1' || strValue === 'yes' || strValue === 'ใช่' || strValue === 'active'
          } else {
            clinic[mappedField] = String(value).trim()
          }
        }
      }

      // Validate required fields
      if (!clinic.name) {
        validationErrors.push(`Row ${rowNum}: Missing name/ชื่อ`)
        continue
      }
      if (!clinic.province) {
        validationErrors.push(`Row ${rowNum}: Missing province/จังหวัด`)
        continue
      }

      clinicsToCreate.push({
        name: clinic.name,
        province: clinic.province,
        branchName: clinic.branchName || undefined,
        isActive: clinic.isActive ?? true,
      })
    }

    if (validationErrors.length > 0 && clinicsToCreate.length === 0) {
      return errorResponse(`Validation errors:\n${validationErrors.join('\n')}`, 400)
    }

    // Create clinics in database
    const result = await prisma.$transaction(async (tx) => {
      const created = []
      const skipped = []

      for (const clinicData of clinicsToCreate) {
        // Check if clinic with same name and province already exists
        const existing = await tx.clinic.findFirst({
          where: {
            name: clinicData.name,
            province: clinicData.province,
            branchName: clinicData.branchName || null,
          },
        })

        if (existing) {
          skipped.push({
            name: clinicData.name,
            province: clinicData.province,
            branchName: clinicData.branchName,
            reason: 'Already exists',
          })
          continue
        }

        const clinic = await tx.clinic.create({
          data: {
            name: clinicData.name,
            province: clinicData.province,
            branchName: clinicData.branchName || null,
            isActive: clinicData.isActive ?? true,
          },
        })
        created.push(clinic)
      }

      return { created, skipped }
    })

    return successResponse({
      message: `Imported ${result.created.length} clinics`,
      created: result.created.length,
      skipped: result.skipped.length,
      skippedItems: result.skipped,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    }, 201)
  } catch (error) {
    console.error('Import clinics error:', error)
    return errors.internalError()
  }
})
