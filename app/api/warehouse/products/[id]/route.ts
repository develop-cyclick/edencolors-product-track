import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse, errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'

type RouteParams = Promise<{ id: string }>
type HandlerContext = { user: JWTPayload; params?: RouteParams }

// GET /api/warehouse/products/[id] - Get product detail
async function handleGET(_request: NextRequest, context: HandlerContext) {
  if (!context.params) {
    return errors.badRequest('Missing params')
  }

  const { id } = await context.params
  const productId = parseInt(id)

  if (isNaN(productId)) {
    return errors.badRequest('Invalid product ID')
  }

  const product = await prisma.productItem.findUnique({
    where: { id: productId },
    include: {
      category: { select: { id: true, nameTh: true, nameEn: true } },
      assignedClinic: { select: { id: true, name: true, address: true, branchName: true } },
      qrTokens: {
        orderBy: { tokenVersion: 'desc' },
        select: {
          id: true,
          tokenVersion: true,
          tokenHash: true,
          issuedAt: true,
          status: true,
        },
      },
      grnLine: {
        select: {
          id: true,
          sku: true,
          itemName: true,
          modelSize: true,
          quantity: true,
          lot: true,
          mfgDate: true,
          expDate: true,
          inspectionStatus: true,
          remarks: true,
          unit: { select: { id: true, nameTh: true, nameEn: true } },
          grnHeader: {
            select: {
              id: true,
              grnNo: true,
              receivedAt: true,
              supplierName: true,
              warehouse: { select: { id: true, name: true } },
              receivedBy: { select: { id: true, displayName: true } },
            },
          },
        },
      },
      outboundLines: {
        select: {
          id: true,
          quantity: true,
          outbound: {
            select: {
              id: true,
              deliveryNoteNo: true,
              shippedAt: true,
              status: true,
              clinic: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { id: 'desc' },
      },
      eventLogs: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          eventType: true,
          details: true,
          createdAt: true,
        },
      },
      scanLogs: {
        orderBy: { scannedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          scannedAt: true,
          result: true,
          ipHash: true,
          userAgent: true,
        },
      },
    },
  })

  if (!product) {
    return errors.notFound('Product')
  }

  return successResponse({ product })
}

export const GET = withRoles<RouteParams>(['ADMIN', 'MANAGER', 'WAREHOUSE'], handleGET)
