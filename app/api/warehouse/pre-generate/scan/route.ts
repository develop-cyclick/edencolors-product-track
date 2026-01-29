import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse, errorResponse } from '@/lib/api-response'
import { decryptQRToken } from '@/lib/qr-token'
import type { JWTPayload } from '@/lib/auth'

type HandlerContext = { user: JWTPayload }

interface ScanInput {
  qrContent: string  // Full URL or token from scanner
}

// POST /api/warehouse/pre-generate/scan - Decode QR and return serial info
async function handlePOST(request: NextRequest, _context: HandlerContext) {
  const body: ScanInput = await request.json()

  if (!body.qrContent) {
    return errorResponse('QR content is required')
  }

  try {
    // Extract token from QR content
    // QR content could be:
    // 1. Full URL: https://example.com/th/verify?token=xxx
    // 2. Just the token: eyJhbGci...
    let token = body.qrContent.trim()

    // Try to parse as URL and extract token parameter
    try {
      const url = new URL(token)
      const tokenParam = url.searchParams.get('token')
      if (tokenParam) {
        token = tokenParam
      }
    } catch {
      // Not a URL, assume it's the raw token
    }

    // Decode the token
    const payload = await decryptQRToken(token)

    if (!payload) {
      return errorResponse('Invalid QR code - cannot decode token')
    }

    const { serialNumber, productItemId } = payload

    // Find the product item and validate it's pre-generated
    const productItem = await prisma.productItem.findUnique({
      where: { id: productItemId },
      include: {
        preGeneratedBatch: {
          select: { id: true, batchNo: true },
        },
      },
    })

    if (!productItem) {
      return errorResponse('Product item not found')
    }

    // Validate serial matches
    if (productItem.serial12 !== serialNumber) {
      return errorResponse('Invalid QR code - serial mismatch')
    }

    // Check if it's a pre-generated item
    if (!productItem.preGeneratedBatchId) {
      return errorResponse('This QR is not a pre-generated item')
    }

    // Check status
    if (productItem.status !== 'PENDING_LINK') {
      return errorResponse(
        productItem.status === 'IN_STOCK'
          ? 'This QR has already been linked to a product'
          : `This QR cannot be used (status: ${productItem.status})`
      )
    }

    return successResponse({
      productItemId: productItem.id,
      serial12: productItem.serial12,
      batchNo: productItem.preGeneratedBatch?.batchNo || null,
      batchId: productItem.preGeneratedBatchId,
      status: productItem.status,
    })
  } catch (error) {
    console.error('Scan decode error:', error)
    return errorResponse('Failed to decode QR code')
  }
}

export const POST = withRoles(['ADMIN', 'WAREHOUSE'], handlePOST)
