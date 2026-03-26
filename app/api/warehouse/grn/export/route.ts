import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { generateExcelBuffer } from '@/lib/excel-export'
import type { JWTPayload } from '@/lib/auth'

type HandlerContext = { user: JWTPayload }

// POST /api/warehouse/grn/export - Export GRN list to Excel
async function handlePOST(request: NextRequest, _context: HandlerContext) {
  try {
    const body = await request.json().catch(() => ({}))
    const locale = body.locale || 'th'
    const th = locale === 'th'
    const statusFilter = body.status || undefined // 'pending' | 'approved' | 'rejected'
    const search = body.search || undefined

    // Build where clause
    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { grnNo: { contains: search, mode: 'insensitive' } },
        { supplierName: { contains: search, mode: 'insensitive' } },
        { poNo: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (statusFilter === 'approved') {
      where.approvedAt = { not: null }
    } else if (statusFilter === 'rejected') {
      where.rejectedAt = { not: null }
    } else if (statusFilter === 'pending') {
      where.approvedAt = null
      where.rejectedAt = null
    }

    const grns = await prisma.gRNHeader.findMany({
      where,
      include: {
        warehouse: { select: { name: true } },
        receivedBy: { select: { displayName: true } },
        approvedBy: { select: { displayName: true } },
        planLines: {
          include: {
            productMaster: { select: { sku: true, nameTh: true, nameEn: true } },
          },
        },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Helper to get status label
    const getStatus = (grn: typeof grns[0]) => {
      if (grn.approvedAt) return th ? 'อนุมัติแล้ว' : 'Approved'
      if (grn.rejectedAt) return th ? 'ถูกปฏิเสธ' : 'Rejected'
      return th ? 'รออนุมัติ' : 'Pending'
    }

    const getReceivingStatus = (grn: typeof grns[0]) => {
      if (grn.receivingStatus === 'PARTIAL') return th ? 'รับบางส่วน' : 'Partial'
      return th ? 'ครบแล้ว' : 'Complete'
    }

    const formatDate = (date: Date | null) => {
      if (!date) return '-'
      return new Date(date).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    }

    // Sheet 1: GRN Summary
    const summaryHeaders = [
      th ? 'ลำดับ' : 'No.',
      'GRN No.',
      th ? 'วันที่รับ' : 'Received Date',
      'Supplier',
      'PO No.',
      th ? 'คลัง' : 'Warehouse',
      th ? 'ผู้ตรวจรับ' : 'Received By',
      th ? 'สถานะ' : 'Status',
      th ? 'สถานะการรับ' : 'Receiving Status',
      th ? 'ต้องรับทั้งหมด' : 'Total Planned',
      th ? 'รับแล้ว' : 'Received',
      th ? 'คงเหลือ' : 'Remaining',
      th ? 'จำนวน Serial' : 'Serial Count',
      th ? 'ผู้อนุมัติ' : 'Approved By',
      th ? 'วันที่อนุมัติ' : 'Approved Date',
      th ? 'หมายเหตุ' : 'Remarks',
    ]

    const summaryRows = grns.map((grn, i) => {
      const totalPlanned = grn.planLines.reduce((s, pl) => s + pl.totalQty, 0)
      const totalReceived = grn.planLines.reduce((s, pl) => s + pl.receivedQty, 0)
      const remaining = totalPlanned - totalReceived

      return [
        i + 1,
        grn.grnNo,
        formatDate(grn.receivedAt),
        grn.supplierName,
        grn.poNo || '-',
        grn.warehouse.name,
        grn.receivedBy.displayName,
        getStatus(grn),
        grn.planLines.length > 0 ? getReceivingStatus(grn) : '-',
        grn.planLines.length > 0 ? totalPlanned : grn._count.lines,
        grn.planLines.length > 0 ? totalReceived : grn._count.lines,
        grn.planLines.length > 0 ? remaining : 0,
        grn._count.lines,
        grn.approvedBy?.displayName || '-',
        formatDate(grn.approvedAt),
        grn.remarks || '-',
      ]
    })

    // Grand total row
    const totals = grns.reduce(
      (acc, grn) => {
        const planned = grn.planLines.reduce((s, pl) => s + pl.totalQty, 0)
        const received = grn.planLines.reduce((s, pl) => s + pl.receivedQty, 0)
        return {
          planned: acc.planned + (grn.planLines.length > 0 ? planned : grn._count.lines),
          received: acc.received + (grn.planLines.length > 0 ? received : grn._count.lines),
          remaining: acc.remaining + (grn.planLines.length > 0 ? planned - received : 0),
          serials: acc.serials + grn._count.lines,
        }
      },
      { planned: 0, received: 0, remaining: 0, serials: 0 }
    )

    summaryRows.push([
      '', '', '', '', '', '', '',
      th ? 'รวมทั้งหมด' : 'Grand Total',
      '',
      totals.planned,
      totals.received,
      totals.remaining,
      totals.serials,
      '', '', '',
    ])

    // Sheet 2: GRN Detail Lines (per product per GRN)
    const detailHeaders = [
      'GRN No.',
      th ? 'วันที่รับ' : 'Received Date',
      'Supplier',
      'SKU',
      th ? 'สินค้า' : 'Product',
      th ? 'ต้องรับ' : 'Planned',
      th ? 'รับแล้ว' : 'Received',
      th ? 'คงเหลือ' : 'Remaining',
      th ? 'สถานะ' : 'Status',
      th ? 'สถานะการรับ' : 'Receiving',
    ]

    const detailRows: (string | number)[][] = []
    for (const grn of grns) {
      if (grn.planLines.length > 0) {
        for (const pl of grn.planLines) {
          detailRows.push([
            grn.grnNo,
            formatDate(grn.receivedAt),
            grn.supplierName,
            pl.productMaster.sku,
            th ? pl.productMaster.nameTh : (pl.productMaster.nameEn || pl.productMaster.nameTh),
            pl.totalQty,
            pl.receivedQty,
            pl.totalQty - pl.receivedQty,
            getStatus(grn),
            getReceivingStatus(grn),
          ])
        }
      } else {
        detailRows.push([
          grn.grnNo,
          formatDate(grn.receivedAt),
          grn.supplierName,
          '-',
          '-',
          grn._count.lines,
          grn._count.lines,
          0,
          getStatus(grn),
          '-',
        ])
      }
    }

    const sheets = [
      { name: th ? 'สรุป GRN' : 'GRN Summary', headers: summaryHeaders, rows: summaryRows },
      { name: th ? 'รายละเอียด' : 'Details', headers: detailHeaders, rows: detailRows },
    ]

    const buffer = generateExcelBuffer(sheets)
    const filename = `grn-report-${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('GRN export error:', error)
    return NextResponse.json({ success: false, error: 'Failed to export' }, { status: 500 })
  }
}

export const POST = withRoles(['ADMIN', 'MANAGER', 'WAREHOUSE'], handlePOST)
