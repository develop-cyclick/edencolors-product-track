import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import * as XLSX from 'xlsx'
import type { JWTPayload } from '@/lib/auth'

type RouteParams = Promise<{ id: string }>
type HandlerContext = { user: JWTPayload; params?: RouteParams }

// GET /api/warehouse/outbound/[id]/export - Export Outbound to Excel
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

    const statusMap: Record<string, string> = {
      DRAFT: 'แบบร่าง',
      PENDING: 'รออนุมัติ',
      APPROVED: 'อนุมัติแล้ว',
      REJECTED: 'ปฏิเสธ',
    }

    // Create workbook
    const workbook = XLSX.utils.book_new()

    // Header info sheet
    const headerData = [
      ['ใบส่งออกสินค้า (Delivery Note)'],
      [],
      ['เลขที่ใบส่งออก', outbound.deliveryNoteNo],
      ['สถานะ', statusMap[outbound.status] || outbound.status],
      ['คลังสินค้า', outbound.warehouse.name],
      ['วิธีการจัดส่ง', outbound.shippingMethod?.nameTh || '-'],
      ['เลขที่ PO', outbound.poNo || '-'],
      [],
      ['ข้อมูลคลินิก'],
      ['ชื่อคลินิก', outbound.clinic?.name || '-'],
      ['สาขา', outbound.clinic?.branchName || '-'],
      ['จังหวัด', outbound.clinic?.province || '-'],
      ['ผู้ติดต่อ', outbound.clinicContactName || '-'],
      ['เบอร์โทร', outbound.clinicPhone || '-'],
      ['อีเมล', outbound.clinicEmail || '-'],
      ['ที่อยู่', outbound.clinicAddress || '-'],
      [],
      ['ข้อมูลฝ่ายขาย'],
      ['พนักงานขาย', outbound.salesPersonName || '-'],
      ['ผู้ติดต่อบริษัท', outbound.companyContact || '-'],
      [],
      ['วันที่สร้าง', outbound.createdAt ? new Date(outbound.createdAt).toLocaleDateString('th-TH') : '-'],
      ['สร้างโดย', outbound.createdBy.displayName],
      ['วันที่อนุมัติ', outbound.approvedAt ? new Date(outbound.approvedAt).toLocaleDateString('th-TH') : '-'],
      ['อนุมัติโดย', outbound.approvedBy?.displayName || '-'],
      ['วันที่ส่งออก', outbound.shippedAt ? new Date(outbound.shippedAt).toLocaleDateString('th-TH') : '-'],
      ['หมายเหตุ', outbound.remarks || '-'],
      ...(outbound.rejectReason ? [['เหตุผลที่ปฏิเสธ', outbound.rejectReason]] : []),
    ]
    const headerSheet = XLSX.utils.aoa_to_sheet(headerData)
    headerSheet['!cols'] = [{ wch: 20 }, { wch: 40 }]
    XLSX.utils.book_append_sheet(workbook, headerSheet, 'ข้อมูลทั่วไป')

    // Lines sheet
    const linesData = outbound.lines.map((line, index) => ({
      'ลำดับ': index + 1,
      'Serial': line.productItem?.serial12 || '-',
      'SKU': line.sku,
      'ชื่อสินค้า': line.itemName,
      'หมวดหมู่': line.productItem?.category?.nameTh || '-',
      'รุ่น/ขนาด': line.modelSize || '-',
      'Lot': line.lot || '-',
      'วันหมดอายุ': line.expDate ? new Date(line.expDate).toLocaleDateString('th-TH') : '-',
      'หน่วย': line.unit?.nameTh || '-',
      'สถานะสินค้า': line.itemStatus || '-',
    }))
    const linesSheet = XLSX.utils.json_to_sheet(linesData)
    linesSheet['!cols'] = [
      { wch: 6 },  // ลำดับ
      { wch: 14 }, // Serial
      { wch: 12 }, // SKU
      { wch: 25 }, // ชื่อสินค้า
      { wch: 15 }, // หมวดหมู่
      { wch: 12 }, // รุ่น/ขนาด
      { wch: 10 }, // Lot
      { wch: 12 }, // วันหมดอายุ
      { wch: 10 }, // หน่วย
      { wch: 12 }, // สถานะสินค้า
    ]
    XLSX.utils.book_append_sheet(workbook, linesSheet, 'รายการสินค้า')

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Outbound_${outbound.deliveryNoteNo}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Export Outbound error:', error)
    return NextResponse.json({ success: false, error: 'Failed to export' }, { status: 500 })
  }
}

export const GET = withRoles<RouteParams>(['ADMIN', 'MANAGER', 'WAREHOUSE'], handleGET)
