import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withWarehouse } from '@/lib/api-middleware'
import { generateLabelPDF, generateGridLabelPDF } from '@/lib/pdf-label'
import { generateQRCodeURL } from '@/lib/qr-token'

// POST /api/warehouse/labels
// Generate PDF labels for specified product items
// layout: 'individual' (4x6 inch per label) or 'grid' (A4 with 8 columns)
export const POST = withWarehouse(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { productItemIds, grnId, layout = 'individual' } = body as {
      productItemIds?: number[]
      grnId?: number
      layout?: 'individual' | 'grid'
    }

    // Either productItemIds or grnId must be provided
    if (!productItemIds?.length && !grnId) {
      return NextResponse.json(
        { success: false, error: 'Either productItemIds or grnId is required' },
        { status: 400 }
      )
    }

    // If grnId is provided, get all product items from that GRN
    let itemIds = productItemIds || []

    if (grnId) {
      const grnLines = await prisma.gRNLine.findMany({
        where: { grnHeaderId: grnId },
        select: { productItemId: true },
      })
      itemIds = grnLines.map((line) => line.productItemId)
    }

    if (itemIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No product items found' },
        { status: 404 }
      )
    }

    // Limit to prevent memory issues
    if (itemIds.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Maximum 100 labels per request' },
        { status: 400 }
      )
    }

    // Fetch product items with their active QR tokens (including stored token)
    const productItems = await prisma.productItem.findMany({
      where: { id: { in: itemIds } },
      include: {
        qrTokens: {
          where: { status: 'ACTIVE' },
          orderBy: { tokenVersion: 'desc' },
          take: 1,
          select: { id: true, tokenVersion: true, issuedAt: true, token: true },
        },
        category: true,
      },
    })

    if (productItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No product items found' },
        { status: 404 }
      )
    }

    // Check for missing tokens
    const itemsWithoutTokens = productItems.filter(
      (item) => item.qrTokens.length === 0
    )
    if (itemsWithoutTokens.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `${itemsWithoutTokens.length} items have no active QR token`,
          data: { serials: itemsWithoutTokens.map((i) => i.serial12) },
        },
        { status: 400 }
      )
    }

    const { createQRToken, hashToken } = await import('@/lib/qr-token')

    // Prepare label data - use stored token or regenerate if missing
    const labels = await Promise.all(
      productItems.map(async (item) => {
        const activeToken = item.qrTokens[0]
        let token = activeToken.token

        // If token not stored (old data), regenerate and save it
        if (!token) {
          token = await createQRToken({
            serialNumber: item.serial12,
            productItemId: item.id,
            tokenVersion: activeToken.tokenVersion,
            issuedAt: Math.floor(activeToken.issuedAt.getTime() / 1000),
          })

          // Store token and update hash in database
          await prisma.qRToken.update({
            where: { id: activeToken.id },
            data: {
              token, // Store for future use
              tokenHash: hashToken(token),
            },
          })
        }

        const qrCodeUrl = generateQRCodeURL(token, 'th')

        return {
          serialNumber: item.serial12,
          qrCodeUrl,
          productName: item.name,
          sku: item.sku,
          lot: item.lot || undefined,
          mfgDate: item.mfgDate
            ? formatDate(item.mfgDate)
            : undefined,
          expDate: item.expDate
            ? formatDate(item.expDate)
            : undefined,
        }
      })
    )

    // Generate PDF based on layout
    const pdfBuffer = layout === 'grid'
      ? await generateGridLabelPDF(labels)
      : await generateLabelPDF(labels)

    const filename = layout === 'grid'
      ? `labels-grid-${Date.now()}.pdf`
      : `labels-${Date.now()}.pdf`

    // Return PDF as response (convert Buffer to Uint8Array for NextResponse)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Label generation error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate labels' },
      { status: 500 }
    )
  }
})

function formatDate(date: Date): string {
  const d = new Date(date)
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear().toString().slice(-2)
  return `${day}/${month}/${year}`
}
