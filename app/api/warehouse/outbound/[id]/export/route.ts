import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { generateDeliveryNotePDF } from '@/lib/pdf-delivery'
import type { JWTPayload } from '@/lib/auth'

type RouteParams = Promise<{ id: string }>
type HandlerContext = { user: JWTPayload; params?: RouteParams }

// GET /api/warehouse/outbound/[id]/export - Export Outbound to PDF
async function handleGET(_request: NextRequest, context: HandlerContext) {
  if (!context.params) {
    return NextResponse.json({ success: false, error: 'Missing params' }, { status: 400 })
  }

  const { id } = await context.params
  const outboundId = parseInt(id)

  if (isNaN(outboundId)) {
    return NextResponse.json({ success: false, error: 'Invalid Outbound ID' }, { status: 400 })
  }

  try {
    const outbound = await prisma.outboundHeader.findUnique({
      where: { id: outboundId },
      include: {
        warehouse: { select: { id: true, name: true } },
        shippingMethod: { select: { id: true, nameTh: true, nameEn: true } },
        clinic: { select: { id: true, name: true, province: true, branchName: true } },
        createdBy: { select: { id: true, displayName: true, username: true } },
        approvedBy: { select: { id: true, displayName: true, username: true } },
        purchaseOrder: { select: { id: true, poNo: true } },
        lines: {
          include: {
            productItem: {
              include: {
                category: { select: { id: true, nameTh: true, nameEn: true } },
              },
            },
            unit: { select: { id: true, nameTh: true, nameEn: true } },
          },
        },
      },
    })

    if (!outbound) {
      return NextResponse.json({ success: false, error: 'Outbound not found' }, { status: 404 })
    }

    // Prepare data for PDF
    const pdfData = {
      deliveryNoteNo: outbound.deliveryNoteNo,
      customerName: outbound.clinic?.name || '',
      customerAddress: outbound.clinicAddress || `${outbound.clinic?.province || ''}${outbound.clinic?.branchName ? ` (${outbound.clinic.branchName})` : ''}`,
      customerPhone: outbound.clinicPhone || '',
      customerContact: outbound.clinicContactName || '',
      shippedDate: (outbound.shippedAt || outbound.createdAt).toISOString(),
      contractNo: outbound.contractNo || null,
      poNo: outbound.purchaseOrder?.poNo || null,
      shippingMethod: outbound.shippingMethod?.nameTh || null,
      deliveryBy: outbound.salesPersonName || null,
      stockPreparedBy: outbound.createdBy.displayName,
      lines: outbound.lines.map((line) => ({
        id: line.id,
        sku: line.sku,
        itemName: line.itemName,
        modelSize: line.modelSize,
        quantity: line.quantity,
        lot: line.lot,
        expDate: line.expDate ? line.expDate.toISOString() : null,
        serial12: line.productItem?.serial12 || '',
        unit: line.unit?.nameTh || null,
      })),
      remarks: outbound.remarks,
    }

    // Generate PDF
    const pdfBuffer = await generateDeliveryNotePDF(pdfData)

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(pdfBuffer)

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="DeliveryNote_${outbound.deliveryNoteNo}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Export Outbound error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json({
      success: false,
      error: 'Failed to export',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 })
  }
}

export const GET = withRoles<RouteParams>(['ADMIN', 'MANAGER', 'WAREHOUSE'], handleGET)
