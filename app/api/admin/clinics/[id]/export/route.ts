import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withWarehouse } from '@/lib/api-middleware'
import { generateExcelBuffer } from '@/lib/excel-export'

type Params = { id: string }

// GET /api/admin/clinics/[id]/export - Export clinic detail to Excel
export const GET = withWarehouse<Promise<Params>>(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!
    const clinicId = parseInt(id)

    if (isNaN(clinicId)) {
      return NextResponse.json({ success: false, error: 'Invalid clinic ID' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const locale = searchParams.get('locale') || 'th'
    const th = locale === 'th'

    // Fetch clinic
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
    })

    if (!clinic) {
      return NextResponse.json({ success: false, error: 'Clinic not found' }, { status: 404 })
    }

    // Fetch stats + outbounds in parallel
    const [
      totalOutbounds,
      approvedOutbounds,
      pendingOutbounds,
      rejectedOutbounds,
      totalItems,
      shippedItems,
      poLineAggregates,
      outbounds,
    ] = await Promise.all([
      prisma.outboundHeader.count({ where: { clinicId } }),
      prisma.outboundHeader.count({ where: { clinicId, status: 'APPROVED' } }),
      prisma.outboundHeader.count({ where: { clinicId, status: { in: ['DRAFT', 'PENDING'] } } }),
      prisma.outboundHeader.count({ where: { clinicId, status: 'REJECTED' } }),
      prisma.outboundLine.count({ where: { outbound: { clinicId } } }),
      prisma.outboundLine.count({ where: { outbound: { clinicId, status: 'APPROVED' } } }),
      prisma.purchaseOrderLine.aggregate({
        where: {
          purchaseOrder: { clinicId, status: { notIn: ['CANCELLED'] } },
        },
        _sum: { quantity: true, shippedQuantity: true },
      }),
      prisma.outboundHeader.findMany({
        where: { clinicId },
        include: {
          warehouse: { select: { name: true } },
          shippingMethod: { select: { nameTh: true } },
          createdBy: { select: { displayName: true } },
          approvedBy: { select: { displayName: true } },
          purchaseOrder: {
            select: {
              poNo: true,
              lines: { select: { quantity: true, shippedQuantity: true } },
            },
          },
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const poTotalOrdered = poLineAggregates._sum.quantity || 0
    const poTotalShipped = poLineAggregates._sum.shippedQuantity || 0
    const poRemaining = poTotalOrdered - poTotalShipped

    const statusLabel = (s: string) => {
      const map: Record<string, { th: string; en: string }> = {
        DRAFT: { th: 'ฉบับร่าง', en: 'Draft' },
        PENDING: { th: 'รออนุมัติ', en: 'Pending' },
        APPROVED: { th: 'อนุมัติแล้ว', en: 'Approved' },
        REJECTED: { th: 'ปฏิเสธ', en: 'Rejected' },
      }
      return th ? (map[s]?.th || s) : (map[s]?.en || s)
    }

    const formatDate = (d: Date | string | null) => {
      if (!d) return '-'
      return new Date(d).toLocaleDateString(th ? 'th-TH' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    }

    // Sheet 1: Clinic Info + Stats
    const infoSheet = {
      name: th ? 'ข้อมูลคลินิก' : 'Clinic Info',
      headers: [th ? 'รายการ' : 'Item', th ? 'รายละเอียด' : 'Detail'],
      rows: [
        [th ? 'ชื่อคลินิก' : 'Clinic Name', clinic.name],
        [th ? 'ชื่อบริษัท' : 'Company', clinic.companyName || '-'],
        [th ? 'ที่อยู่' : 'Address', clinic.address],
        [th ? 'สาขา' : 'Branch', clinic.branchName || '-'],
        [th ? 'ชื่อออกบิล' : 'Invoice Name', clinic.invoiceName || '-'],
        [th ? 'ผู้ติดต่อ' : 'Contact', clinic.contactName || '-'],
        [th ? 'เบอร์โทร' : 'Phone', clinic.contactPhone || '-'],
        [th ? 'สถานะ' : 'Status', clinic.isActive ? (th ? 'ใช้งาน' : 'Active') : (th ? 'ปิดใช้งาน' : 'Inactive')],
        [],
        [th ? '--- จำนวนใบรายการส่งออก ---' : '--- Summary Delivery Order---', ''],
        [th ? 'ส่งออกทั้งหมด' : 'Total Outbounds', `${totalOutbounds} ${th ? 'รายการ' : 'entries'}`],
        [th ? 'อนุมัติแล้ว' : 'Approved', `${approvedOutbounds} ${th ? 'รายการ' : 'entries'}`],
        [th ? 'รอดำเนินการ' : 'Pending', `${pendingOutbounds} ${th ? 'รายการ' : 'entries'}`],
        [th ? 'ถูกปฏิเสธ' : 'Rejected', `${rejectedOutbounds} ${th ? 'รายการ' : 'entries'}`],
        [th ? 'สินค้าในรายการส่งออก' : 'Outbound Items', `${totalItems} ${th ? 'ชิ้น' : 'pcs'}`],
        [th ? 'สินค้าส่งสำเร็จ' : 'Shipped Items', `${shippedItems} ${th ? 'ชิ้น' : 'pcs'}`],
        [],
        [th ? '--- ใบสั่งซื้อ (PO) ---' : '--- Purchase Orders ---', ''],
        [th ? 'สั่งทั้งหมด (PO)' : 'Total Ordered (PO)', `${poTotalOrdered} ${th ? 'ชิ้น' : 'pcs'}`],
        [th ? 'ส่งแล้ว (PO)' : 'Shipped (PO)', `${poTotalShipped} ${th ? 'ชิ้น' : 'pcs'}`],
        [th ? 'คงเหลือค้างส่ง' : 'Remaining', `${poRemaining} ${th ? 'ชิ้น' : 'pcs'}`],
      ] as (string | number)[][],
    }

    // Sheet 2: Outbound list
    const outboundHeaders = th
      ? ['ลำดับ', 'เลขที่ใบส่ง', 'วันที่สร้าง', 'PO No.', 'วิธีจัดส่ง', 'จำนวนรายการ', 'สถานะ', 'สั่ง (PO)', 'ส่งแล้ว (PO)', 'ค้างส่ง', 'ผู้สร้าง', 'ผู้อนุมัติ', 'เหตุผลปฏิเสธ']
      : ['No.', 'Delivery No.', 'Created', 'PO No.', 'Shipping', 'Items', 'Status', 'Ordered (PO)', 'Shipped (PO)', 'Remaining', 'Created By', 'Approved By', 'Reject Reason']

    const outboundRows = outbounds.map((ob, i) => {
      const po = ob.purchaseOrder
      let poOrdered = '-'
      let poShipped = '-'
      let poRem = '-'
      if (po) {
        const ordered = po.lines.reduce((s, l) => s + l.quantity, 0)
        const shipped = po.lines.reduce((s, l) => s + l.shippedQuantity, 0)
        poOrdered = ordered.toString()
        poShipped = shipped.toString()
        poRem = (ordered - shipped).toString()
      }
      return [
        i + 1,
        ob.deliveryNoteNo,
        formatDate(ob.createdAt),
        po?.poNo || '-',
        ob.shippingMethod.nameTh,
        ob._count.lines,
        statusLabel(ob.status),
        poOrdered,
        poShipped,
        poRem,
        ob.createdBy.displayName,
        ob.approvedBy?.displayName || '-',
        ob.rejectReason || '',
      ]
    })

    const outboundSheet = {
      name: th ? 'รายการส่งออก' : 'Outbound Deliveries',
      headers: outboundHeaders,
      rows: outboundRows,
    }

    const buffer = generateExcelBuffer([infoSheet, outboundSheet])
    const safeName = clinic.name.replace(/[/\\?*[\]]/g, '_')
    const date = new Date().toISOString().split('T')[0]

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="clinic-${safeName}-${date}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Export clinic detail error:', error)
    return NextResponse.json({ success: false, error: 'Failed to export' }, { status: 500 })
  }
})
