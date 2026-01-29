import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { decryptQRToken, hashToken } from '@/lib/qr-token'
import { checkRateLimit, rateLimitPresets } from '@/lib/rate-limit'

const CURRENT_POLICY_VERSION = '1.0'

interface ActivationRequest {
  token: string
  consent: boolean
  // Optional customer info
  customerName?: string
  age?: number
  gender?: 'M' | 'F' | 'Other'
  province?: string
  phone?: string
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

    if (!consent) {
      return NextResponse.json(
        { success: false, error: 'Consent is required' },
        { status: 400 }
      )
    }

    // Validate optional customer info (if provided)
    if (customerName && customerName.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Name must be at least 2 characters' },
        { status: 400 }
      )
    }

    if (age !== undefined && (age < 1 || age > 150)) {
      return NextResponse.json(
        { success: false, error: 'Age must be between 1 and 150' },
        { status: 400 }
      )
    }

    if (gender && !['M', 'F', 'Other'].includes(gender)) {
      return NextResponse.json(
        { success: false, error: 'Invalid gender value' },
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
        activations: {
          orderBy: { activationNumber: 'desc' },
        },
        productMaster: {
          select: {
            activationType: true,
            maxActivations: true,
          },
        },
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

    // Get activation settings from ProductMaster (default to SINGLE/1 if not found)
    const activationType = productItem.productMaster?.activationType || 'SINGLE'
    const maxActivations = productItem.productMaster?.maxActivations || 1
    const currentActivationCount = productItem.activationCount || 0

    // Check if already fully activated
    if (currentActivationCount >= maxActivations) {
      const latestActivation = productItem.activations?.[0]
      return NextResponse.json({
        success: false,
        error: activationType === 'PACK'
          ? `This product has reached maximum activations (${maxActivations})`
          : 'This product has already been activated',
        code: 'ALREADY_ACTIVATED',
        data: {
          activatedAt: latestActivation?.createdAt,
          activationCount: currentActivationCount,
          maxActivations,
        },
      })
    }

    // Check product status - must be SHIPPED or ACTIVATED (for PACK) to activate
    const allowedStatuses = activationType === 'PACK' ? ['SHIPPED', 'ACTIVATED'] : ['SHIPPED']
    if (!allowedStatuses.includes(productItem.status)) {
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
    const newActivationNumber = currentActivationCount + 1
    const isLastActivation = newActivationNumber >= maxActivations

    const [activation] = await prisma.$transaction([
      // Create activation
      prisma.activation.create({
        data: {
          productItem: { connect: { id: productItem.id } },
          activationNumber: newActivationNumber,
          customerName: customerName?.trim() || null,
          age: age || null,
          gender: gender || null,
          province: province?.trim() || null,
          phone: phone?.trim() || null,
          consentAt: now,
          policyVersion: CURRENT_POLICY_VERSION,
        },
      }),
      // Update product: increment activationCount, set status to ACTIVATED if last activation
      prisma.productItem.update({
        where: { id: productItem.id },
        data: {
          activationCount: newActivationNumber,
          status: isLastActivation ? 'ACTIVATED' : productItem.status,
        },
      }),
      // Log event
      prisma.eventLog.create({
        data: {
          eventType: 'ACTIVATE',
          productItemId: productItem.id,
          details: {
            customerName: customerName?.trim() || null,
            age: age || null,
            gender: gender || null,
            province: province?.trim() || null,
            activatedAt: now.toISOString(),
            activationNumber: newActivationNumber,
            maxActivations,
            activationType,
          },
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: activationType === 'PACK'
        ? `Product activated successfully (${newActivationNumber}/${maxActivations})`
        : 'Product activated successfully',
      data: {
        serialNumber: productItem.serial12,
        productName: productItem.name,
        category: productItem.category.nameTh,
        activatedAt: activation.createdAt,
        activationNumber: newActivationNumber,
        maxActivations,
        remainingActivations: maxActivations - newActivationNumber,
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
