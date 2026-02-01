import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import { generateOutboundNumber } from '@/lib/serial-generator'
import type { OutboundStatus, ProductItem } from '@prisma/client'
import type { JWTPayload } from '@/lib/auth'

type HandlerContext = { user: JWTPayload }

// Legacy format - individual product items
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

// New format - ProductMaster with quantity (FIFO selection)
interface ProductMasterLineInput {
  productMasterId: number
  quantity: number
}

interface CreateOutboundInput {
  warehouseId: number
  shippingMethodId: number
  clinicId: number
  deliveryNoteNo?: string  // Optional - if not provided, auto-generate
  contractNo?: string
  salesPersonName?: string
  companyContact?: string
  clinicAddress?: string
  clinicPhone?: string
  clinicEmail?: string
  clinicContactName?: string
  purchaseOrderId?: number | null
  remarks?: string
  lines?: OutboundLineInput[]  // Legacy format
  linesByProductMaster?: ProductMasterLineInput[]  // New FIFO format
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
        { purchaseOrder: { poNo: { contains: search, mode: 'insensitive' as const } } },
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
        purchaseOrder: { select: { id: true, poNo: true } },
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

  // Validate required fields - support both legacy and new format
  const hasLegacyLines = body.lines && body.lines.length > 0
  const hasFifoLines = body.linesByProductMaster && body.linesByProductMaster.length > 0

  if (!body.warehouseId || !body.shippingMethodId || !body.clinicId) {
    return errorResponse('Missing required fields: warehouseId, shippingMethodId, clinicId')
  }

  if (!hasLegacyLines && !hasFifoLines) {
    return errorResponse('Either lines or linesByProductMaster must be provided')
  }

  // Validate clinic exists
  const clinic = await prisma.clinic.findUnique({
    where: { id: body.clinicId },
  })

  if (!clinic || !clinic.isActive) {
    return errorResponse('Invalid clinic')
  }

  try {
    // If using new FIFO format, select ProductItems automatically
    const selectedItems: Array<{
      productItem: ProductItem
      productMaster: {
        id: number
        sku: string
        nameTh: string
        modelSize: string | null
        defaultUnitId: number | null
      }
    }> = []

    if (hasFifoLines) {
      // FIFO selection for each ProductMaster
      for (const pmLine of body.linesByProductMaster!) {
        // Get ProductMaster info
        const productMaster = await prisma.productMaster.findUnique({
          where: { id: pmLine.productMasterId },
          select: { id: true, sku: true, nameTh: true, modelSize: true, defaultUnitId: true },
        })

        if (!productMaster) {
          return errorResponse(`ProductMaster not found: ${pmLine.productMasterId}`)
        }

        if (!productMaster.defaultUnitId) {
          return errorResponse(`ProductMaster ${productMaster.sku} has no unit defined`)
        }

        // Get IN_STOCK items for this ProductMaster, ordered by serial12 (FIFO - oldest first)
        const availableItems = await prisma.productItem.findMany({
          where: {
            productMasterId: pmLine.productMasterId,
            status: 'IN_STOCK',
          },
          orderBy: { serial12: 'asc' }, // FIFO: lowest serial number = oldest
          take: pmLine.quantity,
        })

        if (availableItems.length < pmLine.quantity) {
          return errorResponse(
            `Not enough stock for ${productMaster.sku}. Requested: ${pmLine.quantity}, Available: ${availableItems.length}`
          )
        }

        // Add selected items with their ProductMaster info
        for (const item of availableItems) {
          selectedItems.push({
            productItem: item,
            productMaster,
          })
        }
      }
    } else if (hasLegacyLines) {
      // Legacy format - validate individual product items
      const productItemIds = body.lines!.map((l) => l.productItemId)
      const productItems = await prisma.productItem.findMany({
        where: { id: { in: productItemIds } },
        include: { productMaster: true },
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

      // Map to selectedItems format
      for (const item of productItems) {
        const lineData = body.lines!.find((l) => l.productItemId === item.id)!
        selectedItems.push({
          productItem: item,
          productMaster: item.productMaster ? {
            id: item.productMaster.id,
            sku: item.productMaster.sku,
            nameTh: item.productMaster.nameTh,
            modelSize: item.productMaster.modelSize,
            defaultUnitId: item.productMaster.defaultUnitId,
          } : {
            id: 0,
            sku: lineData.sku,
            nameTh: lineData.itemName,
            modelSize: lineData.modelSize || null,
            defaultUnitId: lineData.unitId,
          },
        })
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Use provided IV No. or generate one
      const deliveryNoteNo = body.deliveryNoteNo?.trim() || await generateOutboundNumber()

      // Create outbound header
      const outbound = await tx.outboundHeader.create({
        data: {
          deliveryNoteNo,
          contractNo: body.contractNo || null,
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
          purchaseOrderId: body.purchaseOrderId || null,
          status: 'PENDING', // Auto submit for approval
          remarks: body.remarks,
        },
      })

      // Create outbound lines and update product status
      const createdLines = []

      for (const selected of selectedItems) {
        const { productItem, productMaster } = selected

        // Get unit ID - from ProductMaster or legacy line data
        let unitId: number
        if (hasFifoLines) {
          unitId = productMaster.defaultUnitId!
        } else {
          const legacyLine = body.lines!.find((l) => l.productItemId === productItem.id)
          unitId = legacyLine?.unitId || productMaster.defaultUnitId || 1
        }

        // Create outbound line
        const outboundLine = await tx.outboundLine.create({
          data: {
            outboundId: outbound.id,
            productItemId: productItem.id,
            sku: productMaster.sku,
            itemName: productMaster.nameTh,
            modelSize: productMaster.modelSize,
            quantity: 1, // Always 1 per line
            unitId,
            lot: productItem.lot,
            expDate: productItem.expDate,
            itemStatus: 'ปกติ',
          },
        })

        // Update product status to PENDING_OUT and assign clinic
        await tx.productItem.update({
          where: { id: productItem.id },
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
            productItemId: productItem.id,
            userId: user.userId,
            details: {
              deliveryNoteNo: outbound.deliveryNoteNo,
              clinicId: body.clinicId,
              clinicName: clinic.name,
              serial12: productItem.serial12,
              sku: productMaster.sku,
            },
          },
        })
      }

      return {
        outbound,
        lines: createdLines,
        selectedSerials: selectedItems.map((s) => s.productItem.serial12),
      }
    })

    return successResponse({
      id: result.outbound.id,
      deliveryNoteNo: result.outbound.deliveryNoteNo,
      status: result.outbound.status,
      linesCreated: result.lines.length,
      selectedSerials: result.selectedSerials, // Return which serials were selected (for FIFO)
    }, 201)
  } catch (error) {
    console.error('Create Outbound error:', error)
    return errors.internalError()
  }
}

export const GET = withRoles(['ADMIN', 'MANAGER', 'WAREHOUSE'], handleGET)
export const POST = withRoles(['ADMIN', 'WAREHOUSE'], handlePOST)
