import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { generateExcelBuffer } from '@/lib/excel-export'
import type { OutboundStatus } from '@prisma/client'
import type { JWTPayload } from '@/lib/auth'

type HandlerContext = { user: JWTPayload }

// POST /api/warehouse/outbound/export - Export outbound list to Excel
async function handlePOST(request: NextRequest, _context: HandlerContext) {
  try {
    const body = await request.json().catch(() => ({}))
    const locale = body.locale || 'th'
    const th = locale === 'th'
    const status = body.status as OutboundStatus | undefined
    const search = body.search || undefined

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { deliveryNoteNo: { contains: search, mode: 'insensitive' } },
        { purchaseOrder: { poNo: { contains: search, mode: 'insensitive' } } },
        { clinic: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    if (status) {
      where.status = status
    }

    const outbounds = await prisma.outboundHeader.findMany({
      where,
      include: {
        warehouse: { select: { name: true } },
        shippingMethod: { select: { nameTh: true, nameEn: true } },
        clinic: { select: { name: true, address: true } },
        createdBy: { select: { displayName: true } },
        approvedBy: { select: { displayName: true } },
        purchaseOrder: {
          select: {
            poNo: true,
            lines: { select: { quantity: true, shippedQuantity: true } },
          },
        },
        lines: {
          include: {
            productItem: {
              select: { serial12: true, sku: true, name: true, lot: true },
            },
            unit: { select: { nameTh: true, nameEn: true } },
          },
        },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const statusLabel = (s: string) => {
      const map: Record<string, [string, string]> = {
        DRAFT: ['ฉบับร่าง', 'Draft'],
        PENDING: ['รออนุมัติ', 'Pending'],
        APPROVED: ['อนุมัติแล้ว', 'Approved'],
        REJECTED: ['ปฏิเสธ', 'Rejected'],
      }
      const v = map[s] || [s, s]
      return th ? v[0] : v[1]
    }

    const formatDate = (date: Date | null) => {
      if (!date) return '-'
      return new Date(date).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    }

    // Sheet 1: Outbound Summary
    const summaryHeaders = [
      th ? 'ลำดับ' : 'No.',
      'Delivery No.',
      th ? 'วันที่สร้าง' : 'Created',
      th ? 'วันที่ส่ง' : 'Shipped Date',
      th ? 'คลินิก' : 'Clinic',
      th ? 'ที่อยู่คลินิก' : 'Clinic Address',
      'PO No.',
      th ? 'คลัง' : 'Warehouse',
      th ? 'วิธีส่ง' : 'Shipping Method',
      th ? 'จำนวนสินค้า' : 'Items',
      th ? 'สถานะ' : 'Status',
      th ? 'สั่งซื้อทั้งหมด (PO)' : 'Total Ordered (PO)',
      th ? 'ส่งแล้ว (PO)' : 'Shipped (PO)',
      th ? 'คงเหลือ (PO)' : 'Remaining (PO)',
      th ? 'ผู้สร้าง' : 'Created By',
      th ? 'ผู้อนุมัติ' : 'Approved By',
      th ? 'วันที่อนุมัติ' : 'Approved Date',
      th ? 'หมายเหตุ' : 'Remarks',
    ]

    const summaryRows = outbounds.map((ob, i) => {
      const po = ob.purchaseOrder
      const totalOrdered = po ? po.lines.reduce((s, l) => s + l.quantity, 0) : 0
      const totalShipped = po ? po.lines.reduce((s, l) => s + l.shippedQuantity, 0) : 0

      return [
        i + 1,
        ob.deliveryNoteNo,
        formatDate(ob.createdAt),
        formatDate(ob.shippedAt),
        ob.clinic.name,
        ob.clinic.address,
        po?.poNo || '-',
        ob.warehouse.name,
        th ? ob.shippingMethod.nameTh : (ob.shippingMethod.nameEn || ob.shippingMethod.nameTh),
        ob._count.lines,
        statusLabel(ob.status),
        po ? totalOrdered : '-',
        po ? totalShipped : '-',
        po ? totalOrdered - totalShipped : '-',
        ob.createdBy.displayName,
        ob.approvedBy?.displayName || '-',
        formatDate(ob.approvedAt),
        ob.remarks || '-',
      ]
    })

    // Grand totals
    const totals = outbounds.reduce(
      (acc, ob) => {
        const po = ob.purchaseOrder
        return {
          items: acc.items + ob._count.lines,
          ordered: acc.ordered + (po ? po.lines.reduce((s, l) => s + l.quantity, 0) : 0),
          shipped: acc.shipped + (po ? po.lines.reduce((s, l) => s + l.shippedQuantity, 0) : 0),
        }
      },
      { items: 0, ordered: 0, shipped: 0 }
    )

    summaryRows.push([
      '', '', '', '', '', '', '', '',
      th ? 'รวมทั้งหมด' : 'Grand Total',
      totals.items,
      '',
      totals.ordered || '-',
      totals.shipped || '-',
      totals.ordered ? totals.ordered - totals.shipped : '-',
      '', '', '', '',
    ])

    // Sheet 2: Line Details
    const detailHeaders = [
      'Delivery No.',
      th ? 'วันที่ส่ง' : 'Shipped Date',
      th ? 'คลินิก' : 'Clinic',
      'Serial',
      'SKU',
      th ? 'สินค้า' : 'Product',
      'Lot',
      th ? 'หน่วย' : 'Unit',
      th ? 'สถานะ' : 'Status',
    ]

    const detailRows: (string | number)[][] = []
    for (const ob of outbounds) {
      for (const line of ob.lines) {
        detailRows.push([
          ob.deliveryNoteNo,
          formatDate(ob.shippedAt),
          ob.clinic.name,
          line.productItem?.serial12 || '-',
          line.productItem?.sku || line.sku || '-',
          line.productItem?.name || line.itemName || '-',
          line.productItem?.lot || '-',
          th ? (line.unit?.nameTh || '-') : (line.unit?.nameEn || line.unit?.nameTh || '-'),
          statusLabel(ob.status),
        ])
      }
    }

    const sheets = [
      { name: th ? 'สรุปส่งออก' : 'Outbound Summary', headers: summaryHeaders, rows: summaryRows },
      { name: th ? 'รายละเอียด' : 'Line Details', headers: detailHeaders, rows: detailRows },
    ]

    const buffer = generateExcelBuffer(sheets)
    const filename = `outbound-report-${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Outbound export error:', error)
    return NextResponse.json({ success: false, error: 'Failed to export' }, { status: 500 })
  }
}

export const POST = withRoles(['ADMIN', 'MANAGER', 'WAREHOUSE'], handlePOST)
