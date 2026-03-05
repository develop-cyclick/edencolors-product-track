import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import { generateSerialNumber, generatePreGenBatchNumber } from '@/lib/serial-generator'
import { createQRToken, hashToken } from '@/lib/qr-token'
import type { JWTPayload } from '@/lib/auth'

type HandlerContext = { user: JWTPayload }

interface CreatePreGenInput {
  productMasterId: number
  quantity: number
  remarks?: string
}

// GET /api/warehouse/pre-generate - List pre-generated batches
async function handleGET(request: NextRequest, _context: HandlerContext) {
  const { searchParams } = request.nextUrl
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const search = searchParams.get('search') || ''

  const skip = (page - 1) * limit

  const where = {
    ...(search && {
      batchNo: { contains: search, mode: 'insensitive' as const },
    }),
  }

  const [batches, total] = await Promise.all([
    prisma.preGeneratedBatch.findMany({
      where,
      include: {
        createdBy: { select: { id: true, displayName: true } },
        productMaster: { select: { id: true, sku: true, nameTh: true, serialCode: true } },
        _count: { select: { productItems: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.preGeneratedBatch.count({ where }),
  ])

  // Calculate linked count for each batch
  const batchesWithStats = await Promise.all(
    batches.map(async (batch) => {
      const linkedCount = await prisma.productItem.count({
        where: {
          preGeneratedBatchId: batch.id,
          status: { not: 'PENDING_LINK' },
        },
      })
      return {
        ...batch,
        linkedCount,
        totalItems: batch._count.productItems,
      }
    })
  )

  return successResponse({
    items: batchesWithStats,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}

// POST /api/warehouse/pre-generate - Create new pre-generated batch
async function handlePOST(request: NextRequest, context: HandlerContext) {
  const body: CreatePreGenInput = await request.json()
  const user = context.user

  // Validate quantity
  if (!body.quantity || body.quantity < 1) {
    return errorResponse('Quantity must be greater than 0')
  }
  if (body.quantity > 2000) {
    return errorResponse('Maximum 2,000 items per batch')
  }

  // Validate productMasterId
  if (!body.productMasterId) {
    return errorResponse('Product Master is required')
  }

  // Fetch ProductMaster with category
  const productMaster = await prisma.productMaster.findUnique({
    where: { id: body.productMasterId },
    include: { category: true },
  })

  if (!productMaster) {
    return errorResponse('Product Master not found')
  }

  if (!productMaster.isActive) {
    return errorResponse('Product Master is inactive')
  }

  try {
    // Generate batch number before transaction to avoid nested transactions
    const batchNo = await generatePreGenBatchNumber()

    // Use longer timeout for large batches (30s base + 100ms per item)
    const timeoutMs = Math.min(30000 + body.quantity * 100, 120000)

    const result = await prisma.$transaction(async (tx) => {
      // Create batch with productMasterId
      const batch = await tx.preGeneratedBatch.create({
        data: {
          batchNo,
          quantity: body.quantity,
          linkedCount: 0,
          productMasterId: productMaster.id,
          createdById: user.userId,
          remarks: body.remarks,
        },
      })

      // Pre-generate all serial numbers using the transaction client
      const serialNumbers: string[] = []
      for (let i = 0; i < body.quantity; i++) {
        const serialNumber = await generateSerialNumber({
          activationType: productMaster.activationType,
          categorySerialCode: productMaster.category.serialCode,
          serialCode: productMaster.serialCode,
        }, tx)
        serialNumbers.push(serialNumber)
      }

      // Batch create product items
      await tx.productItem.createMany({
        data: serialNumbers.map((serialNumber) => ({
          serial12: serialNumber,
          sku: productMaster.sku,
          name: productMaster.nameTh,
          categoryId: productMaster.categoryId,
          productMasterId: productMaster.id,
          modelSize: productMaster.modelSize,
          status: 'PENDING_LINK' as const,
          preGeneratedBatchId: batch.id,
        })),
      })

      // Fetch created items to get their IDs
      const productItems = await tx.productItem.findMany({
        where: { preGeneratedBatchId: batch.id },
        select: { id: true, serial12: true },
        orderBy: { id: 'asc' },
      })

      // Generate QR tokens for all items
      const qrTokenData: { productItemId: number; serialNumber: string; qrToken: string }[] = []
      for (const item of productItems) {
        const qrToken = await createQRToken({
          serialNumber: item.serial12,
          productItemId: item.id,
          tokenVersion: 1,
          issuedAt: Math.floor(Date.now() / 1000),
        })
        qrTokenData.push({ productItemId: item.id, serialNumber: item.serial12, qrToken })
      }

      // Batch create QR tokens
      await tx.qRToken.createMany({
        data: qrTokenData.map((d) => ({
          productItemId: d.productItemId,
          tokenVersion: 1,
          token: d.qrToken,
          tokenHash: hashToken(d.qrToken),
          status: 'ACTIVE' as const,
        })),
      })

      // Batch create event logs
      await tx.eventLog.createMany({
        data: qrTokenData.map((d) => ({
          eventType: 'PRE_GENERATE',
          productItemId: d.productItemId,
          userId: user.userId,
          details: {
            batchNo,
            serialNumber: d.serialNumber,
          },
        })),
      })

      return {
        batch,
        items: qrTokenData.map((d) => ({
          productItemId: d.productItemId,
          serialNumber: d.serialNumber,
          qrToken: d.qrToken,
        })),
      }
    }, {
      timeout: timeoutMs,
    })

    return successResponse({
      id: result.batch.id,
      batchNo: result.batch.batchNo,
      quantity: result.batch.quantity,
      items: result.items,
    }, 201)
  } catch (error) {
    console.error('Create pre-gen batch error:', error)
    return errors.internalError()
  }
}

export const GET = withRoles(['ADMIN', 'WAREHOUSE'], handleGET)
export const POST = withRoles(['ADMIN', 'WAREHOUSE'], handlePOST)
