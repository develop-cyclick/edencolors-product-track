import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'

type HandlerContext = { user: JWTPayload }

// GET /api/warehouse/pre-generate/available - Get all available (unlinked) pre-generated items
async function handleGET(request: NextRequest, _context: HandlerContext) {
  const { searchParams } = request.nextUrl
  const limit = parseInt(searchParams.get('limit') || '1000')
  const batchId = searchParams.get('batchId')
  const productMasterId = searchParams.get('productMasterId')

  const where = {
    status: 'PENDING_LINK' as const,
    ...(batchId && { preGeneratedBatchId: parseInt(batchId) }),
    ...(productMasterId && { productMasterId: parseInt(productMasterId) }),
  }

  const items = await prisma.productItem.findMany({
    where,
    include: {
      preGeneratedBatch: {
        select: { id: true, batchNo: true },
      },
      qrTokens: {
        where: { status: 'ACTIVE' },
        orderBy: { tokenVersion: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  const total = await prisma.productItem.count({ where })

  return successResponse({
    items: items.map((item) => ({
      id: item.id,
      serial12: item.serial12,
      productMasterId: item.productMasterId,
      batchNo: item.preGeneratedBatch?.batchNo || null,
      batchId: item.preGeneratedBatchId,
      qrToken: item.qrTokens[0]?.token || null,
      createdAt: item.createdAt,
    })),
    total,
  })
}

export const GET = withRoles(['ADMIN', 'WAREHOUSE'], handleGET)
