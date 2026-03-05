import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withWarehouse } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import { createQRToken, hashToken, generateQRCodeURL } from '@/lib/qr-token'
import type { JWTPayload } from '@/lib/auth'

type HandlerContext = { user: JWTPayload }

// POST /api/warehouse/reprint
// Reprint QR label for product(s) - supports single or batch
// Body: { productItemId: number } OR { productItemIds: number[], reason?: string }
async function handlePOST(request: NextRequest, context: HandlerContext) {
  const body = await request.json()
  const user = context.user
  const reason = body.reason as string | undefined

  // Support both single and batch
  const ids: number[] = body.productItemIds
    ? (body.productItemIds as number[])
    : body.productItemId
      ? [body.productItemId as number]
      : []

  if (ids.length === 0) {
    return errorResponse('Product item ID(s) required')
  }

  if (ids.length > 50) {
    return errorResponse('Maximum 50 items per batch')
  }

  try {
    const results = await prisma.$transaction(async (tx) => {
      const reprinted = []

      for (const itemId of ids) {
        const productItem = await tx.productItem.findUnique({
          where: { id: itemId },
          include: {
            qrTokens: {
              where: { status: 'ACTIVE' },
              orderBy: { tokenVersion: 'desc' },
              take: 1,
            },
            category: true,
          },
        })

        if (!productItem) continue
        if (['ACTIVATED', 'RETURNED', 'SCRAPPED', 'DAMAGED'].includes(productItem.status)) continue

        const activeToken = productItem.qrTokens[0]
        if (!activeToken) continue

        const newTokenVersion = activeToken.tokenVersion + 1
        const now = new Date()

        // Revoke old token
        await tx.qRToken.update({
          where: { id: activeToken.id },
          data: {
            status: 'REVOKED',
            revokedAt: now,
            revokeReason: reason || 'Reprinted',
          },
        })

        // Create new QR token
        const qrTokenString = await createQRToken({
          serialNumber: productItem.serial12,
          productItemId: productItem.id,
          tokenVersion: newTokenVersion,
          issuedAt: Math.floor(now.getTime() / 1000),
        })

        await tx.qRToken.create({
          data: {
            productItemId: productItem.id,
            tokenVersion: newTokenVersion,
            tokenHash: hashToken(qrTokenString),
            status: 'ACTIVE',
          },
        })

        // Log event
        await tx.eventLog.create({
          data: {
            eventType: 'REPRINT',
            productItemId: productItem.id,
            userId: user.userId,
            details: {
              previousVersion: activeToken.tokenVersion,
              newVersion: newTokenVersion,
              reason: reason || 'Reprinted',
              reprintedAt: now.toISOString(),
            },
          },
        })

        reprinted.push({
          productItemId: productItem.id,
          serial12: productItem.serial12,
          productName: productItem.name,
          category: productItem.category.nameTh,
          previousVersion: activeToken.tokenVersion,
          newVersion: newTokenVersion,
          qrUrl: generateQRCodeURL(productItem.serial12),
        })
      }

      return reprinted
    })

    // Backward compatible: single item returns flat object, batch returns array
    if (!body.productItemIds && results.length === 1) {
      return successResponse({
        ...results[0],
        message: 'QR label reprinted successfully',
      })
    }

    return successResponse({
      items: results,
      count: results.length,
      message: `${results.length} QR label(s) reprinted successfully`,
    })
  } catch (error) {
    console.error('Reprint error:', error)
    return errors.internalError()
  }
}

// GET /api/warehouse/reprint
// Get products that can be reprinted (with their token history)
async function handleGET(request: NextRequest, _context: HandlerContext) {
  const { searchParams } = new URL(request.url)
  const serial = searchParams.get('serial')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {
    // Only products that can be reprinted (not activated, not returned)
    status: { in: ['IN_STOCK', 'PENDING_OUT', 'SHIPPED'] },
  }

  if (serial) {
    where.serial12 = { contains: serial }
  }

  const [products, total] = await Promise.all([
    prisma.productItem.findMany({
      where,
      include: {
        category: { select: { id: true, nameTh: true } },
        qrTokens: {
          orderBy: { tokenVersion: 'desc' },
          take: 5, // Last 5 versions
        },
        assignedClinic: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.productItem.count({ where }),
  ])

  return successResponse({
    items: products.map((p) => ({
      id: p.id,
      serial12: p.serial12,
      name: p.name,
      category: p.category.nameTh,
      status: p.status,
      currentTokenVersion: p.qrTokens[0]?.tokenVersion || 0,
      tokenHistory: p.qrTokens.map((t) => ({
        version: t.tokenVersion,
        status: t.status,
        issuedAt: t.issuedAt,
        revokedAt: t.revokedAt,
        revokeReason: t.revokeReason,
      })),
      assignedClinic: p.assignedClinic,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}

export const POST = withWarehouse(handlePOST)
export const GET = withWarehouse(handleGET)
