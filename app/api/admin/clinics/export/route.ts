import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdmin } from '@/lib/api-middleware'
import * as XLSX from 'xlsx'

// GET /api/admin/clinics/export - Export clinics to Excel
export const GET = withAdmin(async (_request: NextRequest) => {
  try {
    const clinics = await prisma.clinic.findMany({
      orderBy: { name: 'asc' },
    })

    // Prepare data for Excel
    const data = clinics.map((clinic) => ({
      'ชื่อคลินิก': clinic.name,
      'จังหวัด': clinic.province,
      'สาขา': clinic.branchName || '',
      'สถานะ': clinic.isActive ? 'ใช้งาน' : 'ปิดใช้งาน',
    }))

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(data)

    // Set column widths
    worksheet['!cols'] = [
      { wch: 30 }, // ชื่อคลินิก
      { wch: 15 }, // จังหวัด
      { wch: 20 }, // สาขา
      { wch: 12 }, // สถานะ
    ]

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clinics')

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Create response with file download
    const response = new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="clinics_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })

    return response
  } catch (error) {
    console.error('Export clinics error:', error)
    return NextResponse.json({ success: false, error: 'Failed to export clinics' }, { status: 500 })
  }
})
