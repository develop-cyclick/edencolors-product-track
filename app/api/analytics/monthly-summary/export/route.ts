import { NextRequest, NextResponse } from 'next/server';
import { withAnalytics } from '@/lib/api-middleware';
import { errors } from '@/lib/api-response';
import { getMonthlySummary } from '@/lib/analytics-queries';
import { generateMonthlySummaryPDF } from '@/lib/pdf-monthly-summary';
import { generateExcelBuffer } from '@/lib/excel-export';

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startMonth, endMonth, locale = 'th', format = 'pdf' } = body;
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

    // Fetch data
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
            th ? 'สภาพดี' : 'Items OK',
            th ? 'ชำรุด' : 'Defective',
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
            s.itemsOk,
            s.itemsDefective,
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
