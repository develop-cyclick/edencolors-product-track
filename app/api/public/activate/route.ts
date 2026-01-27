import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { decryptQRToken, hashToken } from '@/lib/qr-token'
import { checkRateLimit, rateLimitPresets } from '@/lib/rate-limit'

const CURRENT_POLICY_VERSION = '1.0'

interface ActivationRequest {
  token: string
  customerName: string
  age: number
  gender: 'M' | 'F' | 'Other'
  province: string
  phone?: string
  consent: boolean
}

// POST /api/public/activate
// Public endpoint - no login required
// One-time activation only
export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') ||
             request.headers.get('x-real-ip') ||
             'unknown'
  const rateLimit = checkRateLimit(`activate:${ip}`, rateLimitPresets.public)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
        },
      }
    )
  }

  try {
    const body: ActivationRequest = await request.json()

    // Validate required fields
    const { token, customerName, age, gender, province, phone, consent } = body

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      )
    }

    if (!customerName || customerName.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Name is required (minimum 2 characters)' },
        { status: 400 }
      )
    }

    if (!age || age < 1 || age > 150) {
      return NextResponse.json(
        { success: false, error: 'Valid age is required' },
        { status: 400 }
      )
    }

    if (!gender || !['M', 'F', 'Other'].includes(gender)) {
      return NextResponse.json(
        { success: false, error: 'Gender is required' },
        { status: 400 }
      )
    }

    if (!province || province.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Province is required' },
        { status: 400 }
      )
    }

    if (!consent) {
      return NextResponse.json(
        { success: false, error: 'Consent is required' },
        { status: 400 }
      )
    }

    // Decrypt the token
    const payload = await decryptQRToken(token)

    if (!payload) {
      return NextResponse.json({
        success: false,
        error: 'Invalid QR code',
        code: 'INVALID_TOKEN',
      })
    }

    const { serialNumber, productItemId, tokenVersion } = payload

    // Find the product with active token
    const productItem = await prisma.productItem.findUnique({
      where: { id: productItemId },
      include: {
        qrTokens: {
          where: { status: 'ACTIVE' },
          orderBy: { tokenVersion: 'desc' },
          take: 1,
        },
        activation: true,
        category: true,
      },
    })

    if (!productItem) {
      return NextResponse.json({
        success: false,
        error: 'Product not found',
        code: 'NOT_FOUND',
      })
    }

    // Check if serial matches
    if (productItem.serial12 !== serialNumber) {
      return NextResponse.json({
        success: false,
        error: 'Invalid QR code',
        code: 'INVALID_TOKEN',
      })
    }

    // Check if token version is current
    const activeToken = productItem.qrTokens[0]
    if (!activeToken || activeToken.tokenVersion !== tokenVersion) {
      return NextResponse.json({
        success: false,
        error: 'This QR code has been replaced',
        code: 'REPRINTED',
      })
    }

    // Verify token hash
    const tokenHash = hashToken(token)
    if (activeToken.tokenHash !== tokenHash) {
      return NextResponse.json({
        success: false,
        error: 'Invalid QR code',
        code: 'INVALID_TOKEN',
      })
    }

    // Check if already activated (one-time lock)
    if (productItem.activation) {
      return NextResponse.json({
        success: false,
        error: 'This product has already been activated',
        code: 'ALREADY_ACTIVATED',
        data: {
          activatedAt: productItem.activation.createdAt,
        },
      })
    }

    // Check product status - must be SHIPPED to activate
    if (productItem.status !== 'SHIPPED') {
      let errorMessage = 'This product cannot be activated'

      switch (productItem.status) {
        case 'IN_STOCK':
        case 'PENDING_OUT':
          errorMessage = 'This product has not been shipped yet'
          break
        case 'RETURNED':
          errorMessage = 'This product has been returned'
          break
      }

      return NextResponse.json({
        success: false,
        error: errorMessage,
        code: 'INVALID_STATUS',
        data: { currentStatus: productItem.status },
      })
    }

    // Create activation record and update product status in a transaction
    const now = new Date()

    const [activation] = await prisma.$transaction([
      // Create activation
      prisma.activation.create({
        data: {
          productItemId: productItem.id,
          customerName: customerName.trim(),
          age,
          gender,
          province: province.trim(),
          phone: phone?.trim() || null,
          consentAt: now,
          policyVersion: CURRENT_POLICY_VERSION,
        },
      }),
      // Update product status
      prisma.productItem.update({
        where: { id: productItem.id },
        data: { status: 'ACTIVATED' },
      }),
      // Log event
      prisma.eventLog.create({
        data: {
          eventType: 'ACTIVATE',
          productItemId: productItem.id,
          details: {
            customerName: customerName.trim(),
            age,
            gender,
            province: province.trim(),
            activatedAt: now.toISOString(),
          },
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: 'Product activated successfully',
      data: {
        serialNumber: productItem.serial12,
        productName: productItem.name,
        category: productItem.category.nameTh,
        activatedAt: activation.createdAt,
      },
    })
  } catch (error) {
    console.error('Activation error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
