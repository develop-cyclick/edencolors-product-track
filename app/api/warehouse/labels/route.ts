import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withWarehouse } from '@/lib/api-middleware'
import { generateLabelPDF, generateGridLabelPDF } from '@/lib/pdf-label'
import { generateQRCodeURL } from '@/lib/qr-token'

// POST /api/warehouse/labels
// Generate PDF labels for specified product items
// layout: 'individual' (4x6 inch per label) or 'grid' (A4 with 8 columns)
// When `batchId` is provided, this is treated as a Print action: print count is incremented
// and a print log entry is created. If the batch already has printCount > 0, a `reason` is required.
export const POST = withWarehouse(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json()
    const { productItemIds, grnId, layout = 'individual', batchId, reason } = body as {
      productItemIds?: number[]
      grnId?: number
      layout?: 'individual' | 'grid'
      batchId?: number
      reason?: string
    }

    // Either productItemIds or grnId must be provided
    if (!productItemIds?.length && !grnId) {
      return NextResponse.json(
        { success: false, error: 'Either productItemIds or grnId is required' },
        { status: 400 }
      )
    }

    // Validate reprint reason when batchId is provided and the batch has been printed before
    let isReprint = false
    if (batchId) {
      const batch = await prisma.preGeneratedBatch.findUnique({
        where: { id: batchId },
        select: { id: true, printCount: true },
      })
      if (!batch) {
        return NextResponse.json(
          { success: false, error: 'Pre-generated batch not found' },
          { status: 404 }
        )
      }
      isReprint = batch.printCount > 0
      if (isReprint && (!reason || !reason.trim())) {
        return NextResponse.json(
          { success: false, error: 'Reprint reason is required' },
          { status: 400 }
        )
      }
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
    if (itemIds.length > 2000) {
      return NextResponse.json(
        { success: false, error: 'Maximum 2,000 labels per request' },
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

        // Use short URL with serial for easier QR code scanning
        const qrCodeUrl = generateQRCodeURL(item.serial12)

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
    let pdfBuffer: Buffer
    if (layout === 'grid') {
      const { widthMm, heightMm } = await getLabelDimensions()
      pdfBuffer = await generateGridLabelPDF(labels, { widthMm, heightMm })
    } else {
      pdfBuffer = await generateLabelPDF(labels)
    }

    const filename = layout === 'grid'
      ? `labels-grid-${Date.now()}.pdf`
      : `labels-${Date.now()}.pdf`

    // Track the print: increment count + write print log
    if (batchId) {
      await prisma.$transaction([
        prisma.preGeneratedBatch.update({
          where: { id: batchId },
          data: {
            printCount: { increment: 1 },
            lastPrintedAt: new Date(),
          },
        }),
        prisma.preGeneratedBatchPrintLog.create({
          data: {
            batchId,
            userId: user.userId,
            layout,
            isReprint,
            reason: reason || null,
          },
        }),
      ])
    }

    // Return PDF as response (convert Buffer to Uint8Array for NextResponse)
    // The client decides whether to print or download from the resulting blob.
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

// Read grid label (sticker) dimensions (mm) from system_settings, each clamped
// to its valid range. Width default 20 (10–100), height default 34 (10–140).
async function getLabelDimensions(): Promise<{ widthMm: number; heightMm: number }> {
  const readClamped = async (
    key: string,
    def: number,
    min: number,
    max: number,
  ): Promise<number> => {
    try {
      const row = await prisma.systemSetting.findUnique({
        where: { key },
        select: { value: true },
      })
      if (!row) return def
      const parsed = Number(JSON.parse(row.value))
      if (!Number.isFinite(parsed)) return def
      return Math.max(min, Math.min(max, parsed))
    } catch {
      return def
    }
  }
  const [widthMm, heightMm] = await Promise.all([
    readClamped('label.widthMm', 20, 10, 100),
    readClamped('label.heightMm', 34, 10, 140),
  ])
  return { widthMm, heightMm }
}
