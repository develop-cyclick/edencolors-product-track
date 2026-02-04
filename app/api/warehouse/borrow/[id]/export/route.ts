import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withWarehouse } from '@/lib/api-middleware'
import { errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'
import { generateBorrowTransactionPDF } from '@/lib/pdf-borrow'

type HandlerContext = { user: JWTPayload; params?: Promise<{ id: string }> }

// GET /api/warehouse/borrow/[id]/export - Generate and download PDF
async function handleGET(_request: NextRequest, context: HandlerContext) {
  try {
    if (!context.params) {
      return NextResponse.json({ success: false, error: 'Missing params' }, { status: 400 })
    }
    const params = await context.params
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid transaction ID' }, { status: 400 })
    }

    const transaction = await prisma.borrowTransaction.findUnique({
      where: { id },
      include: {
        createdBy: { select: { displayName: true } },
        approvedBy: { select: { displayName: true } },
        lines: {
          include: {
            productItem: { select: { serial12: true } },
            unit: { select: { nameTh: true } },
          },
        },
      },
    })

    if (!transaction) {
      return errors.notFound('Borrow transaction')
    }

    // Prepare data for PDF generation
    const pdfData = {
      transactionNo: transaction.transactionNo,
      type: transaction.type as 'BORROW' | 'RETURN',
      borrowerName: transaction.borrowerName,
      clinicName: transaction.clinicName,
      clinicAddress: transaction.clinicAddress,
      taxInvoiceRef: transaction.taxInvoiceRef,
      reason: transaction.reason,
      remarks: transaction.remarks,
      createdAt: transaction.createdAt.toISOString(),
      approvedAt: transaction.approvedAt?.toISOString() || null,
      approvedBy: transaction.approvedBy?.displayName || null,
      lines: transaction.lines.map((line) => ({
        id: line.id,
        sku: line.sku,
        itemName: line.itemName,
        modelSize: line.modelSize,
        quantity: line.quantity,
        lot: line.lot,
        expDate: line.expDate?.toISOString() || null,
        serial12: line.productItem.serial12,
        unit: line.unit?.nameTh || null,
        remarks: line.remarks,
      })),
    }

    // Generate PDF
    const pdfBuffer = await generateBorrowTransactionPDF(pdfData)

    // Return PDF as response (convert Buffer to Uint8Array for NextResponse compatibility)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${transaction.transactionNo}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Export borrow transaction PDF error:', error)
    return errors.internalError()
  }
}

export const GET = withWarehouse(handleGET)
