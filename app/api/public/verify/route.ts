import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { decryptQRToken, hashToken, VerifyResult, type VerifyResultType } from '@/lib/qr-token'
import { checkRateLimit, rateLimitPresets } from '@/lib/rate-limit'
import { isValidSerialNumber } from '@/lib/serial-generator'
import { createHash } from 'crypto'

// GET /api/public/verify?token=...
// Public endpoint - no login required
export async function GET(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') ||
             request.headers.get('x-real-ip') ||
             'unknown'
  const rateLimit = checkRateLimit(`verify:${ip}`, rateLimitPresets.public)

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

  // Support both token-based (legacy) and serial-based (new short URL) verification
  const token = request.nextUrl.searchParams.get('token')
  const serial = request.nextUrl.searchParams.get('serial')

  if (!token && !serial) {
    return NextResponse.json(
      { success: false, error: 'Token or serial is required' },
      { status: 400 }
    )
  }

  try {
    let serialNumber: string
    let productItemId: number | undefined
    let tokenVersion: number = 1

    // Method 1: Short URL with serial (NEW - faster and easier to scan)
    if (serial) {
      // Validate serial format
      if (!isValidSerialNumber(serial)) {
        return NextResponse.json({
          success: false,
          result: VerifyResult.INVALID_TOKEN,
          message: 'Invalid serial number format',
        })
      }
      serialNumber = serial
      // productItemId will be fetched from database
    }
    // Method 2: Legacy token-based verification
    else if (token) {
      // Decrypt the token
      const payload = await decryptQRToken(token)

      if (!payload) {
        // Log invalid scan attempt
        await logScan(null, null, 0, VerifyResult.INVALID_TOKEN, request)

        return NextResponse.json({
          success: false,
          result: VerifyResult.INVALID_TOKEN,
          message: 'Invalid QR code',
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

    // Find the product item (by ID if we have it, otherwise by serial)
    const productItem = await prisma.productItem.findUnique({
      where: productItemId ? { id: productItemId } : { serial12: serialNumber },
      include: {
        category: true,
        assignedClinic: true,
        productMaster: {
          select: {
            activationType: true,
            maxActivations: true,
            imageUrl: true,
          },
        },
        qrTokens: {
          where: { status: 'ACTIVE' },
          orderBy: { tokenVersion: 'desc' },
          take: 1,
        },
        activations: {
          orderBy: { activationNumber: 'desc' },
        },
      },
    })

    if (!productItem) {
      await logScan(null, null, tokenVersion, VerifyResult.NOT_FOUND, request)

      return NextResponse.json({
        success: false,
        result: VerifyResult.NOT_FOUND,
        message: 'Product not found',
      })
    }

    // Check if serial matches (only needed for token-based verification)
    if (token && productItem.serial12 !== serialNumber) {
      await logScan(productItem.id, null, tokenVersion, VerifyResult.INVALID_TOKEN, request)

      return NextResponse.json({
        success: false,
        result: VerifyResult.INVALID_TOKEN,
        message: 'Invalid QR code',
      })
    }

    // For serial-based verification, update productItemId
    if (serial) {
      productItemId = productItem.id
    }

    // Check if product is still pending link (pre-generated but not yet assigned to product)
    if (productItem.status === 'PENDING_LINK') {
      await logScan(productItem.id, null, tokenVersion, VerifyResult.NOT_FOUND, request)

      return NextResponse.json({
        success: false,
        result: VerifyResult.NOT_FOUND,
        message: 'Product not found',
      })
    }

    // Get the active token
    const activeToken = productItem.qrTokens[0]

    // Check if this token version is current (only for token-based verification)
    if (token && (!activeToken || activeToken.tokenVersion !== tokenVersion)) {
      // Token was reprinted - this is an old token
      await logScan(productItem.id, null, tokenVersion, VerifyResult.REPRINTED, request)

      return NextResponse.json({
        success: false,
        result: VerifyResult.REPRINTED,
        message: 'This QR code has been replaced with a new one',
        data: {
          serialNumber: productItem.serial12,
        },
      })
    }

    // Verify token hash matches (only for token-based verification)
    if (token && activeToken) {
      const tokenHash = hashToken(token)
      if (activeToken.tokenHash !== tokenHash) {
        await logScan(productItem.id, activeToken.id, tokenVersion, VerifyResult.INVALID_TOKEN, request)

        return NextResponse.json({
          success: false,
          result: VerifyResult.INVALID_TOKEN,
          message: 'Invalid QR code',
        })
      }
    }

    // Get activation settings from ProductMaster (default to SINGLE/1 if not found)
    const activationType = productItem.productMaster?.activationType || 'SINGLE'
    const maxActivations = productItem.productMaster?.maxActivations || 1
    const activationCount = productItem.activationCount || 0
    const canActivate = activationCount < maxActivations

    // Determine the result based on product status
    let result: VerifyResultType
    let message: string

    switch (productItem.status) {
      case 'IN_STOCK':
        result = VerifyResult.GENUINE_IN_STOCK
        message = 'Genuine product - In stock'
        break
      case 'PENDING_OUT':
        result = VerifyResult.GENUINE_IN_STOCK
        message = 'Genuine product - Pending shipment'
        break
      case 'SHIPPED':
        result = VerifyResult.GENUINE_SHIPPED
        message = 'Genuine product - Shipped'
        break
      case 'ACTIVATED':
        // For PACK products, check if more activations are available
        if (activationType === 'PACK' && canActivate) {
          result = VerifyResult.GENUINE_SHIPPED
          message = `Genuine product - ${activationCount}/${maxActivations} activations used`
        } else {
          result = VerifyResult.ACTIVATED
          message = 'Product has been fully activated'
        }
        break
      case 'RETURNED':
        result = VerifyResult.RETURNED
        message = 'Product was returned'
        break
      case 'SCRAPPED':
        result = VerifyResult.REVOKED
        message = 'Product has been suspended (scrapped)'
        break
      case 'DAMAGED':
        result = VerifyResult.REVOKED
        message = 'Product is marked as damaged'
        break
      default:
        result = VerifyResult.GENUINE_IN_STOCK
        message = 'Genuine product'
    }

    // Log successful scan
    await logScan(productItem.id, activeToken?.id || null, tokenVersion, result, request)

    // Get the latest activation
    const latestActivation = productItem.activations?.[0]

    // Check which clinic fields should be shown
    const showClinicName = await getSettingBool('verify.showClinicName', true)
    const showBranchInfo = await getSettingBool('verify.showBranchInfo', true)
    const showClinicAddress = await getSettingBool('verify.showClinicAddress', true)

    const anyClinicInfoVisible = showClinicName || showBranchInfo || showClinicAddress
    const clinic = productItem.assignedClinic

    // Build response data (only show necessary info to public)
    const responseData = {
      serialNumber: productItem.serial12,
      productName: productItem.name,
      sku: productItem.sku,
      modelSize: productItem.modelSize,
      category: productItem.category.nameTh,
      imageUrl: productItem.productMaster?.imageUrl || null,
      lot: productItem.lot || null,
      expiryDate: productItem.expDate ? formatDate(productItem.expDate) : null,
      status: productItem.status,
      // Activation settings
      activationType,
      maxActivations,
      activationCount,
      canActivate,
      // Show clinic info only for enabled fields and shipped/activated
      ...(anyClinicInfoVisible && clinic && ['SHIPPED', 'ACTIVATED'].includes(productItem.status) && {
        clinic: {
          ...(showClinicName && { name: clinic.name }),
          ...(showBranchInfo && clinic.branchName && { branch: clinic.branchName }),
          ...(showClinicAddress && { address: clinic.address }),
        },
      }),
      // Show activation info if activated
      ...(latestActivation && {
        activatedAt: latestActivation.createdAt,
        activatedBy: latestActivation.customerName,
      }),
    }

    return NextResponse.json({
      success: true,
      result,
      message,
      data: responseData,
    })
  } catch (error) {
    console.error('Verify error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Log scan attempt
 */
async function logScan(
  productItemId: number | null,
  qrTokenId: number | null,
  tokenVersion: number,
  result: VerifyResultType,
  request: NextRequest
) {
  try {
    // Hash IP for privacy
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown'
    const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16)

    await prisma.scanLog.create({
      data: {
        productItemId: productItemId || 0, // Use 0 for invalid scans
        qrTokenId,
        tokenVersion,
        result,
        ipHash,
        userAgent: request.headers.get('user-agent')?.slice(0, 255),
      },
    })
  } catch (error) {
    console.error('Failed to log scan:', error)
    // Don't throw - logging failure shouldn't break the verify flow
  }
}

/**
 * Format date as DD/MM/YY
 */
function formatDate(date: Date): string {
  const d = new Date(date)
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear().toString().slice(-2)
  return `${day}/${month}/${year}`
}

/**
 * Get a boolean system setting by key
 */
async function getSettingBool(key: string, defaultValue: boolean): Promise<boolean> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key },
    })
    if (setting) {
      return JSON.parse(setting.value) === true
    }
    return defaultValue
  } catch {
    return defaultValue
  }
}
