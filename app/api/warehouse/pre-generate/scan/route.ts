import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse, errorResponse } from '@/lib/api-response'
import { decryptQRToken } from '@/lib/qr-token'
import { isValidSerialNumber } from '@/lib/serial-generator'
import type { JWTPayload } from '@/lib/auth'

type HandlerContext = { user: JWTPayload }

interface ScanInput {
  qrContent: string  // Full URL, serial number, or token from scanner
}

/**
 * POST /api/warehouse/pre-generate/scan
 * Decode QR code and return serial info for pre-generated items
 *
 * Supports multiple QR formats:
 * - New short URL: https://domain.com/v/123456789012
 * - Legacy token URL: https://domain.com/th/verify?token=xxx
 * - Raw serial: 123456789012
 * - Raw token: eyJhbGci...
 */
async function handlePOST(request: NextRequest, _context: HandlerContext) {
  const body: ScanInput = await request.json()

  if (!body.qrContent) {
    return errorResponse('QR content is required')
  }

  try {
    let serialNumber: string
    let productItemId: number | null = null

    // QR content could be:
    // 1. New format: https://example.com/v/123456789012 (short URL with serial)
    // 2. Legacy format: https://example.com/th/verify?token=xxx (token-based)
    // 3. Just the token: eyJhbGci...
    // 4. Just the serial: 123456789012
    const qrContent = body.qrContent.trim()

    // Try to parse as URL first
    try {
      const url = new URL(qrContent)

      // NEW: Check if it's a short URL format: /v/{serial}
      const pathMatch = url.pathname.match(/\/v\/([A-Z0-9]+)$/)
      if (pathMatch && isValidSerialNumber(pathMatch[1])) {
        serialNumber = pathMatch[1]
        console.log('Detected new short URL format, serial:', serialNumber)
      }
      // LEGACY: Check for token parameter
      else {
        const tokenParam = url.searchParams.get('token')
        if (tokenParam) {
          // Decrypt the token
          const payload = await decryptQRToken(tokenParam)
          if (!payload) {
            return errorResponse('Invalid QR code - cannot decode token')
          }
          serialNumber = payload.serialNumber
          productItemId = payload.productItemId
          console.log('Detected legacy token format, serial:', serialNumber)
        } else {
          return errorResponse('Invalid QR code - no token or serial found in URL')
        }
      }
    } catch {
      // Not a URL, check if it's a raw serial number (new 19-char format)
      if (isValidSerialNumber(qrContent)) {
        serialNumber = qrContent
        console.log('Detected raw serial format:', serialNumber)
      }
      // Or a raw token
      else {
        // Try to decrypt as token
        const payload = await decryptQRToken(qrContent)
        if (!payload) {
          return errorResponse('Invalid QR code - cannot decode')
        }
        serialNumber = payload.serialNumber
        productItemId = payload.productItemId
        console.log('Detected raw token format, serial:', serialNumber)
      }
    }

    // Find the product item and validate it's pre-generated
    // Use ID if we have it (from token), otherwise search by serial
    const productItem = await prisma.productItem.findUnique({
      where: productItemId ? { id: productItemId } : { serial12: serialNumber },
      include: {
        preGeneratedBatch: {
          select: { id: true, batchNo: true },
        },
      },
    })

    if (!productItem) {
      return errorResponse('Product item not found')
    }

    // Validate serial matches (only needed for token-based)
    if (productItemId && productItem.serial12 !== serialNumber) {
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
