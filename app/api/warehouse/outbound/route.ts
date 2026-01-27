import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import { generateOutboundNumber } from '@/lib/serial-generator'
import type { OutboundStatus } from '@prisma/client'
import type { JWTPayload } from '@/lib/auth'

type HandlerContext = { user: JWTPayload }

interface OutboundLineInput {
  productItemId: number
  sku: string
  itemName: string
  modelSize?: string
  unitId: number
  lot?: string
  expDate?: string
  itemStatus?: string
}

interface CreateOutboundInput {
  warehouseId: number
  shippingMethodId: number
  clinicId: number
  salesPersonName?: string
  companyContact?: string
  clinicAddress?: string
  clinicPhone?: string
  clinicEmail?: string
  clinicContactName?: string
  poNo?: string
  remarks?: string
  lines: OutboundLineInput[]
}

// GET /api/warehouse/outbound - List Outbounds
async function handleGET(request: NextRequest, _context: HandlerContext) {
  const { searchParams } = request.nextUrl
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') as OutboundStatus | null
  const clinicId = searchParams.get('clinicId')
  const warehouseId = searchParams.get('warehouseId')

  const skip = (page - 1) * limit

  const where = {
    ...(search && {
      OR: [
        { deliveryNoteNo: { contains: search, mode: 'insensitive' as const } },
        { poNo: { contains: search, mode: 'insensitive' as const } },
        { clinic: { name: { contains: search, mode: 'insensitive' as const } } },
      ],
    }),
    ...(status && { status }),
    ...(clinicId && { clinicId: parseInt(clinicId) }),
    ...(warehouseId && { warehouseId: parseInt(warehouseId) }),
  }

  const [outbounds, total] = await Promise.all([
    prisma.outboundHeader.findMany({
      where,
      include: {
        warehouse: { select: { id: true, name: true } },
        shippingMethod: { select: { id: true, nameTh: true } },
        clinic: { select: { id: true, name: true, province: true } },
        createdBy: { select: { id: true, displayName: true } },
        approvedBy: { select: { id: true, displayName: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.outboundHeader.count({ where }),
  ])

  return successResponse({
    items: outbounds,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}

// POST /api/warehouse/outbound - Create Outbound request
async function handlePOST(request: NextRequest, context: HandlerContext) {
  const body: CreateOutboundInput = await request.json()
  const user = context.user

  // Validate required fields
  if (!body.warehouseId || !body.shippingMethodId || !body.clinicId || !body.lines?.length) {
    return errorResponse('Missing required fields: warehouseId, shippingMethodId, clinicId, lines')
  }

  // Validate clinic exists
  const clinic = await prisma.clinic.findUnique({
    where: { id: body.clinicId },
  })

  if (!clinic || !clinic.isActive) {
    return errorResponse('Invalid clinic')
  }

  // Validate all product items exist and are IN_STOCK
  const productItemIds = body.lines.map((l) => l.productItemId)
  const productItems = await prisma.productItem.findMany({
    where: { id: { in: productItemIds } },
  })

  if (productItems.length !== productItemIds.length) {
    return errorResponse('Some product items not found')
  }

  const notInStock = productItems.filter((p) => p.status !== 'IN_STOCK')
  if (notInStock.length > 0) {
    return errorResponse(
      `Products not in stock: ${notInStock.map((p) => p.serial12).join(', ')}`
    )
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Generate outbound number
      const deliveryNoteNo = await generateOutboundNumber()

      // Create outbound header
      const outbound = await tx.outboundHeader.create({
        data: {
          deliveryNoteNo,
          createdById: user.userId,
          warehouseId: body.warehouseId,
          shippingMethodId: body.shippingMethodId,
          clinicId: body.clinicId,
          salesPersonName: body.salesPersonName,
          companyContact: body.companyContact,
          clinicAddress: body.clinicAddress || `${clinic.name}, ${clinic.province}`,
          clinicPhone: body.clinicPhone,
          clinicEmail: body.clinicEmail,
          clinicContactName: body.clinicContactName,
          poNo: body.poNo,
          status: 'PENDING', // Auto submit for approval
          remarks: body.remarks,
        },
      })

      // Create outbound lines and update product status
      const createdLines = []

      for (const line of body.lines) {
        // Create outbound line
        const outboundLine = await tx.outboundLine.create({
          data: {
            outboundId: outbound.id,
            productItemId: line.productItemId,
            sku: line.sku,
            itemName: line.itemName,
            modelSize: line.modelSize,
            quantity: 1, // Always 1 per line
            unitId: line.unitId,
            lot: line.lot,
            expDate: line.expDate ? new Date(line.expDate) : null,
            itemStatus: line.itemStatus || 'ปกติ',
          },
        })

        // Update product status to PENDING_OUT and assign clinic
        await tx.productItem.update({
          where: { id: line.productItemId },
          data: {
            status: 'PENDING_OUT',
            assignedClinicId: body.clinicId,
          },
        })

        createdLines.push(outboundLine)

        // Log event
        await tx.eventLog.create({
          data: {
            eventType: 'OUTBOUND',
            productItemId: line.productItemId,
            userId: user.userId,
            details: {
              deliveryNoteNo: outbound.deliveryNoteNo,
              clinicId: body.clinicId,
              clinicName: clinic.name,
            },
          },
        })
      }

      return {
        outbound,
        lines: createdLines,
      }
    })

    return successResponse({
      id: result.outbound.id,
      deliveryNoteNo: result.outbound.deliveryNoteNo,
      status: result.outbound.status,
      linesCreated: result.lines.length,
    }, 201)
  } catch (error) {
    console.error('Create Outbound error:', error)
    return errors.internalError()
  }
}

export const GET = withRoles(['ADMIN', 'MANAGER', 'WAREHOUSE'], handleGET)
export const POST = withRoles(['ADMIN', 'WAREHOUSE'], handlePOST)
