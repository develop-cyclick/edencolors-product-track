import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withWarehouse } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'
import { generateClaimNumber } from '@/lib/serial-generator'
import { notifyManagers } from '@/lib/push-notification'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

type HandlerContext = { user: JWTPayload }

// GET /api/warehouse/damaged-claim - List damaged claims
async function handleGET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const [claims, total] = await Promise.all([
      prisma.damagedClaim.findMany({
        where,
        include: {
          clinic: { select: { id: true, name: true, province: true } },
          productMaster: { select: { id: true, sku: true, nameTh: true, nameEn: true, modelSize: true } },
          createdBy: { select: { id: true, displayName: true } },
          approvedBy: { select: { id: true, displayName: true } },
          attachments: { select: { id: true, fileUrl: true, fileName: true, fileType: true, fileSize: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.damagedClaim.count({ where }),
    ])

    return successResponse({
      claims,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('List damaged claims error:', error)
    return errors.internalError()
  }
}

// POST /api/warehouse/damaged-claim - Create damaged claim with file uploads
async function handlePOST(request: NextRequest, context: HandlerContext) {
  try {
    const formData = await request.formData()
    const clinicId = parseInt(formData.get('clinicId') as string)
    const productMasterId = parseInt(formData.get('productMasterId') as string)
    const quantity = parseInt(formData.get('quantity') as string)
    const reason = formData.get('reason') as string
    const note = (formData.get('note') as string) || null

    if (!clinicId || !productMasterId || !quantity || !reason) {
      return errorResponse('Missing required fields: clinicId, productMasterId, quantity, reason')
    }

    if (quantity < 1) {
      return errorResponse('Quantity must be at least 1')
    }

    // Validate clinic exists
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } })
    if (!clinic) return errors.notFound('Clinic')

    // Validate product master exists
    const pm = await prisma.productMaster.findUnique({ where: { id: productMasterId } })
    if (!pm) return errors.notFound('Product Master')

    // Generate claim number
    const claimNumber = await generateClaimNumber()

    // Handle file uploads
    const files = formData.getAll('files') as File[]
    const attachments: Array<{ fileUrl: string; fileName: string; fileType: string; fileSize: number }> = []

    if (files.length > 0) {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'claims')
      await mkdir(uploadDir, { recursive: true })

      for (const file of files) {
        if (!(file instanceof File) || file.size === 0) continue
        if (file.size > 10 * 1024 * 1024) {
          return errorResponse('File size exceeds 10MB limit')
        }

        const ext = file.name.split('.').pop()?.toLowerCase()
        const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt']
        if (!allowedExts.includes(ext || '')) {
          return errorResponse('Allowed file types: jpg, png, webp, pdf, doc, docx, xls, xlsx, csv, txt')
        }

        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const filepath = path.join(uploadDir, filename)
        const buffer = Buffer.from(await file.arrayBuffer())
        await writeFile(filepath, buffer)

        attachments.push({
          fileUrl: `/uploads/claims/${filename}`,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        })
      }
    }

    // Create claim with attachments
    const claim = await prisma.damagedClaim.create({
      data: {
        claimNumber,
        clinicId,
        productMasterId,
        quantity,
        reason,
        note,
        createdById: context.user.userId,
        attachments: {
          create: attachments,
        },
      },
      include: {
        clinic: { select: { id: true, name: true } },
        productMaster: { select: { id: true, sku: true, nameTh: true } },
        attachments: true,
      },
    })

    // Notify managers about new claim
    notifyManagers({
      title: 'คำร้องเคลมใหม่',
      body: `คำร้อง ${claimNumber} - ${claim.productMaster?.nameTh} จำนวน ${quantity}`,
      url: '/th/dashboard/approval',
      tag: `claim-new-${claim.id}`,
    }).catch(() => {})

    return successResponse({ claim })
  } catch (error) {
    console.error('Create damaged claim error:', error)
    return errors.internalError()
  }
}

export const GET = withWarehouse(handleGET)
export const POST = withWarehouse(handlePOST)
