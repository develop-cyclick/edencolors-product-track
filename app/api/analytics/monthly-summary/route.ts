import { NextRequest } from 'next/server';
import { withAnalytics } from '@/lib/api-middleware';
import { successResponse, errors } from '@/lib/api-response';
import { getMonthlySummary, MonthlySummaryTotals } from '@/lib/analytics-queries';

async function handleGET(request: NextRequest, context: any) {
  try {
    const { searchParams } = request.nextUrl;

    // Default: last 6 months
    const now = new Date();
    const defaultEndMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const defaultStartMonth = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}`;

    const startMonth = searchParams.get('startMonth') || defaultStartMonth;
    const endMonth = searchParams.get('endMonth') || defaultEndMonth;

    // Validate format
    if (!/^\d{4}-\d{2}$/.test(startMonth) || !/^\d{4}-\d{2}$/.test(endMonth)) {
      return errors.badRequest('Invalid month format. Use YYYY-MM');
    }

    // Validate date range
    if (startMonth > endMonth) {
      return errors.badRequest('Start month must be before or equal to end month');
    }

    const summaries = await getMonthlySummary(startMonth, endMonth);

    // Calculate totals
    const totals: MonthlySummaryTotals = summaries.reduce((acc, curr) => ({
      totalReceived: acc.totalReceived + curr.itemsReceived,
      totalShipped: acc.totalShipped + curr.itemsShipped,
      totalActivated: acc.totalActivated + curr.activationsCount,
      totalDamaged: acc.totalDamaged + curr.damagedCount,
      totalReturned: acc.totalReturned + curr.returnedCount,
      totalGRN: acc.totalGRN + curr.grnCount,
      totalPO: acc.totalPO + curr.poCount,
    }), {
      totalReceived: 0,
      totalShipped: 0,
      totalActivated: 0,
      totalDamaged: 0,
      totalReturned: 0,
      totalGRN: 0,
      totalPO: 0,
    });

    return successResponse({ summaries, totals });
  } catch (error) {
    console.error('Monthly summary error:', error);
    return errors.internalError();
  }
}

export const GET = withAnalytics(handleGET);
