import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { decryptQRToken } from '@/lib/qr-token'
import { checkRateLimit, rateLimitPresets } from '@/lib/rate-limit'
import { isValidSerialNumber } from '@/lib/serial-generator'

interface UpdateCustomerInfoRequest {
  token?: string
  serial?: string
  customerName?: string
  age?: number
  gender?: 'M' | 'F' | 'Other'
}

// POST /api/public/update-customer-info
// Update customer info on the latest activation record
export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') ||
             request.headers.get('x-real-ip') ||
             'unknown'
  const rateLimit = checkRateLimit(`update-customer:${ip}`, rateLimitPresets.public)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const body: UpdateCustomerInfoRequest = await request.json()
    const { token, serial, customerName, age, gender } = body

    // Either token or serial must be provided
    if (!token && !serial) {
      return NextResponse.json(
        { success: false, error: 'Token or serial is required' },
        { status: 400 }
      )
    }

    // At least one field to update must be provided
    if (!customerName && !age && !gender) {
      return NextResponse.json(
        { success: false, error: 'At least one field to update is required' },
        { status: 400 }
      )
    }

    // Validate customer info
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

    // Method 1: Short URL with serial
    if (serial) {
      if (!isValidSerialNumber(serial)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid serial number format',
        })
      }
      serialNumber = serial
    }
    // Method 2: Legacy token-based
    else if (token) {
      const payload = await decryptQRToken(token)
      if (!payload) {
        return NextResponse.json({
          success: false,
          error: 'Invalid QR code',
        })
      }
      serialNumber = payload.serialNumber
    } else {
      return NextResponse.json(
        { success: false, error: 'Token or serial is required' },
        { status: 400 }
      )
    }

    // Find the product and its latest activation
    const productItem = await prisma.productItem.findUnique({
      where: { serial12: serialNumber },
      include: {
        activations: {
          orderBy: { activationNumber: 'desc' },
          take: 1,
        },
      },
    })

    if (!productItem) {
      return NextResponse.json({
        success: false,
        error: 'Product not found',
      })
    }

    // Check if there's an activation to update
    const latestActivation = productItem.activations[0]
    if (!latestActivation) {
      return NextResponse.json({
        success: false,
        error: 'No activation found for this product',
      })
    }

    // Only allow updating within 24 hours of activation
    const activationTime = new Date(latestActivation.createdAt).getTime()
    const now = Date.now()
    const hoursSinceActivation = (now - activationTime) / (1000 * 60 * 60)

    if (hoursSinceActivation > 24) {
      return NextResponse.json({
        success: false,
        error: 'Customer info can only be updated within 24 hours of activation',
      })
    }

    // Update the activation record
    const updateData: Record<string, unknown> = {}
    if (customerName) updateData.customerName = customerName.trim()
    if (age) updateData.age = age
    if (gender) updateData.gender = gender

    await prisma.activation.update({
      where: { id: latestActivation.id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      message: 'Customer information updated successfully',
    })
  } catch (error) {
    console.error('Update customer info error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
