import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse } from '@/lib/api-response'
import { createQRToken, hashToken } from '@/lib/qr-token'
import type { ProductStatus } from '@prisma/client'

// GET /api/warehouse/products - Get products for warehouse operations
async function handleGET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const search = searchParams.get('search') || ''
  const statusParam = searchParams.get('status') // Can be single or comma-separated
  const lot = searchParams.get('lot') // Exact lot match
  const categoryId = searchParams.get('categoryId')
  const available = searchParams.get('available') // 'true' to get only IN_STOCK

  const skip = (page - 1) * limit

  // Parse status - can be single value or comma-separated
  let statusFilter: ProductStatus | ProductStatus[] | null = null
  if (statusParam) {
    const statuses = statusParam.split(',').map(s => s.trim()) as ProductStatus[]
    statusFilter = statuses.length === 1 ? statuses[0] : statuses
  }

  const where = {
    ...(search && {
      OR: [
        { serial12: { contains: search } },
        { sku: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
        { lot: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(lot && { lot }), // Exact lot match
    ...(statusFilter && (
      Array.isArray(statusFilter)
        ? { status: { in: statusFilter } }
        : { status: statusFilter }
    )),
    ...(available === 'true' && { status: 'IN_STOCK' as ProductStatus }),
    ...(categoryId && { categoryId: parseInt(categoryId) }),
  }

  const [products, total] = await Promise.all([
    prisma.productItem.findMany({
      where,
      include: {
        category: { select: { id: true, nameTh: true, nameEn: true } },
        assignedClinic: { select: { id: true, name: true, province: true } },
        qrTokens: {
          where: { status: 'ACTIVE' },
          select: { id: true, tokenVersion: true, issuedAt: true, token: true },
          take: 1,
        },
        grnLine: {
          select: {
            id: true,
            unitId: true,
            unit: { select: { id: true, nameTh: true } },
            grnHeader: {
              select: { grnNo: true, receivedAt: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.productItem.count({ where }),
  ])

  // Use stored token, or regenerate if missing (migration case)
  const productsWithTokens = await Promise.all(
    products.map(async (product) => {
      const activeQrToken = product.qrTokens[0]
      if (activeQrToken) {
        // If token is already stored, use it directly
        if (activeQrToken.token) {
          return product
        }

        // Token not stored yet (old data), regenerate and save it
        const token = await createQRToken({
          serialNumber: product.serial12,
          productItemId: product.id,
          tokenVersion: activeQrToken.tokenVersion,
          issuedAt: Math.floor(activeQrToken.issuedAt.getTime() / 1000),
        })

        // Update token and hash in database
        await prisma.qRToken.update({
          where: { id: activeQrToken.id },
          data: {
            token, // Store the actual token for future use
            tokenHash: hashToken(token),
          },
        })

        return {
          ...product,
          qrTokens: [{ ...activeQrToken, token }],
        }
      }
      return product
    })
  )

  return successResponse({
    items: productsWithTokens,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}

export const GET = withRoles(['ADMIN', 'MANAGER', 'WAREHOUSE'], handleGET)
