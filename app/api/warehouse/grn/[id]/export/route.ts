import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import * as XLSX from 'xlsx'
import type { JWTPayload } from '@/lib/auth'

type RouteParams = Promise<{ id: string }>
type HandlerContext = { user: JWTPayload; params?: RouteParams }

// GET /api/warehouse/grn/[id]/export - Export GRN to Excel
async function handleGET(_request: NextRequest, context: HandlerContext) {
  if (!context.params) {
    return NextResponse.json({ success: false, error: 'Missing params' }, { status: 400 })
  }

  const { id } = await context.params
  const grnId = parseInt(id)

  if (isNaN(grnId)) {
    return NextResponse.json({ success: false, error: 'Invalid GRN ID' }, { status: 400 })
  }

  try {
    const grn = await prisma.gRNHeader.findUnique({
      where: { id: grnId },
      include: {
        warehouse: { select: { id: true, name: true } },
        receivedBy: { select: { id: true, displayName: true, username: true } },
        approvedBy: { select: { id: true, displayName: true, username: true } },
        lines: {
          include: {
            productItem: {
              include: {
                category: { select: { id: true, nameTh: true } },
              },
            },
            unit: { select: { id: true, nameTh: true } },
          },
        },
      },
    })

    if (!grn) {
      return NextResponse.json({ success: false, error: 'GRN not found' }, { status: 404 })
    }

    // Create workbook
    const workbook = XLSX.utils.book_new()

    // Header info sheet
    const headerData = [
      ['ใบรับสินค้า (GRN)'],
      [],
      ['เลขที่ GRN', grn.grnNo],
      ['วันที่รับ', grn.receivedAt ? new Date(grn.receivedAt).toLocaleDateString('th-TH') : '-'],
      ['คลังสินค้า', grn.warehouse.name],
      ['เลขที่ PO', grn.poNo || '-'],
      [],
      ['ข้อมูลผู้จัดส่ง'],
      ['ชื่อผู้ขาย', grn.supplierName],
      ['Delivery Note No.', grn.deliveryNoteNo || '-'],
      ['วันที่เอกสาร', grn.deliveryDocDate ? new Date(grn.deliveryDocDate).toLocaleDateString('th-TH') : '-'],
      ['เบอร์โทร', grn.supplierPhone || '-'],
      ['ผู้ติดต่อ', grn.supplierContact || '-'],
      ['ที่อยู่', grn.supplierAddress || '-'],
      [],
      ['ผู้ตรวจรับ', grn.receivedBy.displayName],
      ['ผู้อนุมัติ', grn.approvedBy?.displayName || '-'],
      ['วันที่อนุมัติ', grn.approvedAt ? new Date(grn.approvedAt).toLocaleDateString('th-TH') : '-'],
      ['หมายเหตุ', grn.remarks || '-'],
    ]
    const headerSheet = XLSX.utils.aoa_to_sheet(headerData)
    headerSheet['!cols'] = [{ wch: 20 }, { wch: 40 }]
    XLSX.utils.book_append_sheet(workbook, headerSheet, 'ข้อมูลทั่วไป')

    // Lines sheet
    const linesData = grn.lines.map((line, index) => ({
      'ลำดับ': index + 1,
      'Serial': line.productItem?.serial12 || '-',
      'SKU': line.sku,
      'ชื่อสินค้า': line.itemName,
      'หมวดหมู่': line.productItem?.category?.nameTh || '-',
      'รุ่น/ขนาด': line.modelSize || '-',
      'Lot': line.lot || '-',
      'วันผลิต': line.mfgDate ? new Date(line.mfgDate).toLocaleDateString('th-TH') : '-',
      'วันหมดอายุ': line.expDate ? new Date(line.expDate).toLocaleDateString('th-TH') : '-',
      'หน่วย': line.unit?.nameTh || '-',
      'หมายเหตุ': line.remarks || '-',
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
      { wch: 12 }, // วันผลิต
      { wch: 12 }, // วันหมดอายุ
      { wch: 10 }, // หน่วย
      { wch: 20 }, // หมายเหตุ
    ]
    XLSX.utils.book_append_sheet(workbook, linesSheet, 'รายการสินค้า')

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="GRN_${grn.grnNo}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Export GRN error:', error)
    return NextResponse.json({ success: false, error: 'Failed to export' }, { status: 500 })
  }
}

export const GET = withRoles<RouteParams>(['ADMIN', 'MANAGER', 'WAREHOUSE'], handleGET)
