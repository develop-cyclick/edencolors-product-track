import { NextRequest, NextResponse } from 'next/server';
import { withManager } from '@/lib/api-middleware';
import { errors } from '@/lib/api-response';
import { getMonthlySummary } from '@/lib/analytics-queries';
import { generateMonthlySummaryPDF } from '@/lib/pdf-monthly-summary';

async function handlePOST(request: NextRequest, context: any) {
  try {
    const body = await request.json();
    const { startMonth, endMonth, locale = 'th' } = body;

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

    // Generate PDF
    const pdfBuffer = await generateMonthlySummaryPDF(summaries, {
      startMonth,
      endMonth,
      locale,
    });

    // Set response headers for PDF download
    const filename = `monthly-summary-${startMonth}-to-${endMonth}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('PDF export error:', error);
    return errors.internalError();
  }
}

export const POST = withManager(handlePOST);
