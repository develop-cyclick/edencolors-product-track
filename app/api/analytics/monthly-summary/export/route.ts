import { NextRequest, NextResponse } from 'next/server';
import { withAnalytics } from '@/lib/api-middleware';
import { errors } from '@/lib/api-response';
import { getMonthlySummary } from '@/lib/analytics-queries';
import { generateMonthlySummaryPDF } from '@/lib/pdf-monthly-summary';
import { generateExcelBuffer } from '@/lib/excel-export';
import prisma from '@/lib/prisma';

interface TransactionItem {
  type: string;
  documentNo: string;
  date: string;
  detail: string;
  products: string;
  warehouse: string;
  itemCount: number;
  stockBalance: number;
  status: string;
  performedBy: string;
}

function groupProducts(lines: { itemName: string; quantity: number }[]): string {
  const map = new Map<string, number>();
  for (const line of lines) {
    map.set(line.itemName, (map.get(line.itemName) || 0) + line.quantity);
  }
  return Array.from(map.entries()).map(([name, qty]) => `${name} x${qty}`).join(', ');
}

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startMonth, endMonth, locale = 'th', format = 'pdf', viewMode = 'overview' } = body;
    const th = locale === 'th';

    // Validate required fields
    if (!startMonth || !endMonth) {
      return errors.badRequest('startMonth and endMonth are required');
    }

    // Validate format
    if (!/^\d{4}-\d{2}$/.test(startMonth) || !/^\d{4}-\d{2}$/.test(endMonth)) {
      return errors.badRequest('Invalid month format. Use YYYY-MM');
    }

    // Validate date range
    if (startMonth > endMonth) {
      return errors.badRequest('Start month must be before or equal to end month');
    }

    // Handle transaction detail export
    if (viewMode === 'detail' && format === 'excel') {
      const [startYear, startMo] = startMonth.split('-').map(Number);
      const [endYear, endMo] = endMonth.split('-').map(Number);
      const startDate = new Date(startYear, startMo - 1, 1);
      const endDate = new Date(endYear, endMo, 0, 23, 59, 59, 999);

      const [grnHeaders, outboundHeaders, priorReceived, priorShipped] = await Promise.all([
        prisma.gRNHeader.findMany({
          where: { receivedAt: { gte: startDate, lte: endDate } },
          include: {
            warehouse: { select: { name: true } },
            receivedBy: { select: { displayName: true } },
            lines: { select: { itemName: true, quantity: true } },
          },
          orderBy: { receivedAt: 'asc' },
        }),
        prisma.outboundHeader.findMany({
          where: { createdAt: { gte: startDate, lte: endDate } },
          include: {
            warehouse: { select: { name: true } },
            clinic: { select: { name: true } },
            createdBy: { select: { displayName: true } },
            lines: { select: { itemName: true, quantity: true } },
          },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.gRNLine.count({
          where: { grnHeader: { receivedAt: { lt: startDate } } },
        }),
        prisma.outboundLine.count({
          where: { outbound: { createdAt: { lt: startDate }, status: 'APPROVED' } },
        }),
      ]);

      let balance = priorReceived - priorShipped;

      const rawTx = [
        ...grnHeaders.map((g) => ({
          type: th ? 'รับเข้า' : 'GRN',
          documentNo: g.grnNo,
          date: g.receivedAt.toISOString(),
          dateMs: g.receivedAt.getTime(),
          detail: g.supplierName,
          products: groupProducts(g.lines),
          warehouse: g.warehouse.name,
          itemCount: g.lines.reduce((s, l) => s + l.quantity, 0),
          isGrn: true,
          status: g.receivingStatus === 'COMPLETE' ? (th ? 'รับครบ' : 'Complete') : (th ? 'รับบางส่วน' : 'Partial'),
          performedBy: g.receivedBy.displayName,
        })),
        ...outboundHeaders.map((o) => ({
          type: th ? 'ส่งออก' : 'Outbound',
          documentNo: o.deliveryNoteNo,
          date: o.createdAt.toISOString(),
          dateMs: o.createdAt.getTime(),
          detail: o.clinic.name,
          products: groupProducts(o.lines),
          warehouse: o.warehouse.name,
          itemCount: o.lines.reduce((s, l) => s + l.quantity, 0),
          isGrn: false,
          status: { DRAFT: th ? 'ร่าง' : 'Draft', PENDING: th ? 'รออนุมัติ' : 'Pending', APPROVED: th ? 'อนุมัติ' : 'Approved', REJECTED: th ? 'ปฏิเสธ' : 'Rejected' }[o.status] || o.status,
          performedBy: o.createdBy.displayName,
        })),
      ].sort((a, b) => a.dateMs - b.dateMs);

      const allTx: TransactionItem[] = rawTx.map((t) => {
        balance += t.isGrn ? t.itemCount : -t.itemCount;
        return {
          type: t.type,
          documentNo: t.documentNo,
          date: t.date,
          detail: t.detail,
          products: t.products,
          warehouse: t.warehouse,
          itemCount: t.itemCount,
          stockBalance: balance,
          status: t.status,
          performedBy: t.performedBy,
        };
      });

      const formatDT = (d: string) =>
        new Date(d).toLocaleDateString(th ? 'th-TH' : 'en-US', {
          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });

      const sheets = [
        {
          name: th ? 'รายละเอียด' : 'Transactions',
          headers: [
            th ? 'วันที่/เวลา' : 'Date/Time',
            th ? 'ประเภท' : 'Type',
            th ? 'เลขที่เอกสาร' : 'Document No.',
            th ? 'รายละเอียด' : 'Detail',
            th ? 'สินค้า' : 'Products',
            th ? 'คลังสินค้า' : 'Warehouse',
            th ? 'จำนวน' : 'Qty',
            th ? 'คงเหลือ' : 'Balance',
            th ? 'สถานะ' : 'Status',
            th ? 'ผู้ดำเนินการ' : 'Performed By',
          ],
          rows: allTx.map((t) => [
            formatDT(t.date),
            t.type,
            t.documentNo,
            t.detail,
            t.products,
            t.warehouse,
            t.itemCount,
            t.stockBalance,
            t.status,
            t.performedBy,
          ]),
        },
      ];

      const buffer = generateExcelBuffer(sheets);
      const filename = `transactions-${startMonth}-to-${endMonth}.xlsx`;

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Fetch overview data
    const summaries = await getMonthlySummary(startMonth, endMonth);

    if (summaries.length === 0) {
      return errors.badRequest('No data found for the selected period');
    }

    if (format === 'excel') {
      const monthName = (m: string) => {
        const [y, mo] = m.split('-');
        const date = new Date(parseInt(y), parseInt(mo) - 1);
        return date.toLocaleDateString(th ? 'th-TH' : 'en-US', { year: 'numeric', month: 'short' });
      };

      const sheets = [
        {
          name: th ? 'สรุปรายเดือน' : 'Monthly Summary',
          headers: [
            th ? 'เดือน' : 'Month',
            th ? 'ใบรับสินค้า' : 'GRN Count',
            th ? 'รับเข้า' : 'Items Received',
            th ? 'ใบ PO' : 'PO Count',
            th ? 'PO ยืนยัน' : 'PO Confirmed',
            th ? 'ใบส่งออก' : 'Deliveries',
            th ? 'ส่งออก' : 'Items Shipped',
            th ? 'เปิดใช้งาน' : 'Activations',
            th ? 'เสียหาย' : 'Damaged',
            th ? 'รับคืน' : 'Returned',
          ],
          rows: summaries.map(s => [
            monthName(s.month),
            s.grnCount,
            s.itemsReceived,
            s.poCount,
            s.poConfirmed,
            s.deliveriesCount,
            s.itemsShipped,
            s.activationsCount,
            s.damagedCount,
            s.returnedCount,
          ]),
        },
      ];

      const buffer = generateExcelBuffer(sheets);
      const filename = `monthly-summary-${startMonth}-to-${endMonth}.xlsx`;

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Default: PDF
    const pdfBuffer = await generateMonthlySummaryPDF(summaries, {
      startMonth,
      endMonth,
      locale,
    });

    const filename = `monthly-summary-${startMonth}-to-${endMonth}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return errors.internalError();
  }
}

export const POST = withAnalytics(handlePOST);
