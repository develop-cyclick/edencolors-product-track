import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { decryptQRToken, hashToken } from '@/lib/qr-token'
import { checkRateLimit, rateLimitPresets } from '@/lib/rate-limit'
import { isValidSerialNumber } from '@/lib/serial-generator'

const CURRENT_POLICY_VERSION = '1.0'

interface ActivationRequest {
  token?: string
  serial?: string
  consent: boolean
  quantity?: number  // Number of activations to perform at once (default 1)
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
    const { token, serial, customerName, age, gender, province, phone, consent, quantity: rawQty } = body
    const quantity = Math.max(1, Math.floor(rawQty || 1))

    // Either token or serial must be provided
    if (!token && !serial) {
      return NextResponse.json(
        { success: false, error: 'Token or serial is required' },
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

    let serialNumber: string
    let productItemId: number | undefined
    let tokenVersion: number = 1

    // Method 1: Short URL with serial (NEW)
    if (serial) {
      // Validate serial format
      if (!isValidSerialNumber(serial)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid serial number format',
          code: 'INVALID_TOKEN',
        })
      }
      serialNumber = serial
    }
    // Method 2: Legacy token-based activation
    else if (token) {
      // Decrypt the token
      const payload = await decryptQRToken(token)

      if (!payload) {
        return NextResponse.json({
          success: false,
          error: 'Invalid QR code',
          code: 'INVALID_TOKEN',
        })
      }

      serialNumber = payload.serialNumber
      productItemId = payload.productItemId
      tokenVersion = payload.tokenVersion
    } else {
      return NextResponse.json(
        { success: false, error: 'Token or serial is required' },
        { status: 400 }
      )
    }

    // Find the product with active token (by ID if we have it, otherwise by serial)
    const productItem = await prisma.productItem.findUnique({
      where: productItemId ? { id: productItemId } : { serial12: serialNumber },
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

    // Check if serial matches (only needed for token-based activation)
    if (token && productItem.serial12 !== serialNumber) {
      return NextResponse.json({
        success: false,
        error: 'Invalid QR code',
        code: 'INVALID_TOKEN',
      })
    }

    // For serial-based activation, update productItemId
    if (serial) {
      productItemId = productItem.id
    }

    // Check if token version is current (only for token-based activation)
    if (token) {
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

    // Validate quantity doesn't exceed remaining
    const remaining = maxActivations - currentActivationCount
    if (quantity > remaining) {
      return NextResponse.json({
        success: false,
        error: `Cannot activate ${quantity} times. Only ${remaining} activations remaining.`,
        code: 'EXCEEDS_REMAINING',
      }, { status: 400 })
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

    // Create activation records and update product status in a transaction
    const now = new Date()
    const newActivationNumber = currentActivationCount + quantity
    const isLastActivation = newActivationNumber >= maxActivations

    // Build activation records for each unit
    const activationRecords = Array.from({ length: quantity }, (_, i) => ({
      productItemId: productItem.id,
      activationNumber: currentActivationCount + i + 1,
      customerName: customerName?.trim() || null,
      age: age || null,
      gender: gender || null,
      province: province?.trim() || null,
      phone: phone?.trim() || null,
      consentAt: now,
      policyVersion: CURRENT_POLICY_VERSION,
    }))

    await prisma.$transaction([
      // Create activation record(s)
      prisma.activation.createMany({ data: activationRecords }),
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
            quantity,
            activationNumberFrom: currentActivationCount + 1,
            activationNumberTo: newActivationNumber,
            maxActivations,
            activationType,
          },
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: activationType === 'PACK'
        ? (quantity > 1
          ? `Activated ${quantity} times successfully (${newActivationNumber}/${maxActivations})`
          : `Product activated successfully (${newActivationNumber}/${maxActivations})`)
        : 'Product activated successfully',
      data: {
        serialNumber: productItem.serial12,
        productName: productItem.name,
        category: productItem.category.nameTh,
        activatedAt: now,
        activationNumber: newActivationNumber,
        quantity,
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
