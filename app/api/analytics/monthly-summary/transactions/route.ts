import { NextRequest } from 'next/server';
import { withAnalytics } from '@/lib/api-middleware';
import { successResponse, errors } from '@/lib/api-response';
import prisma from '@/lib/prisma';

interface ProductSummary {
  name: string;
  qty: number;
}

interface Transaction {
  id: number;
  type: 'GRN' | 'OUTBOUND';
  documentNo: string;
  date: string;
  detail: string;
  warehouse: string;
  products: ProductSummary[];
  itemCount: number;
  stockBalance: number;
  status: string;
  performedBy: string;
}

function groupProducts(lines: { itemName: string; quantity: number }[]): ProductSummary[] {
  const map = new Map<string, number>();
  for (const line of lines) {
    map.set(line.itemName, (map.get(line.itemName) || 0) + line.quantity);
  }
  return Array.from(map.entries()).map(([name, qty]) => ({ name, qty }));
}

async function handleGET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const now = new Date();
    const defaultEndMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const defaultStartMonth = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}`;

    const startMonth = searchParams.get('startMonth') || defaultStartMonth;
    const endMonth = searchParams.get('endMonth') || defaultEndMonth;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    if (!/^\d{4}-\d{2}$/.test(startMonth) || !/^\d{4}-\d{2}$/.test(endMonth)) {
      return errors.badRequest('Invalid month format. Use YYYY-MM');
    }

    if (startMonth > endMonth) {
      return errors.badRequest('Start month must be before or equal to end month');
    }

    // Convert months to date range
    const [startYear, startMo] = startMonth.split('-').map(Number);
    const [endYear, endMo] = endMonth.split('-').map(Number);
    const startDate = new Date(startYear, startMo - 1, 1);
    const endDate = new Date(endYear, endMo, 0, 23, 59, 59, 999);

    // Query GRN, Outbound, and opening balance in parallel
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
      // Items received before this period
      prisma.gRNLine.count({
        where: { grnHeader: { receivedAt: { lt: startDate } } },
      }),
      // Items shipped (approved) before this period
      prisma.outboundLine.count({
        where: {
          outbound: {
            createdAt: { lt: startDate },
            status: 'APPROVED',
          },
        },
      }),
    ]);

    const openingBalance = priorReceived - priorShipped;

    // Map to unified format (without balance first)
    type RawTx = Omit<Transaction, 'stockBalance'> & { dateMs: number };

    const grnTx: RawTx[] = grnHeaders.map((grn) => ({
      id: grn.id,
      type: 'GRN' as const,
      documentNo: grn.grnNo,
      date: grn.receivedAt.toISOString(),
      dateMs: grn.receivedAt.getTime(),
      detail: grn.supplierName,
      warehouse: grn.warehouse.name,
      products: groupProducts(grn.lines),
      itemCount: grn.lines.reduce((sum, l) => sum + l.quantity, 0),
      status: grn.receivingStatus,
      performedBy: grn.receivedBy.displayName,
    }));

    const outTx: RawTx[] = outboundHeaders.map((ob) => ({
      id: ob.id,
      type: 'OUTBOUND' as const,
      documentNo: ob.deliveryNoteNo,
      date: ob.createdAt.toISOString(),
      dateMs: ob.createdAt.getTime(),
      detail: ob.clinic.name,
      warehouse: ob.warehouse.name,
      products: groupProducts(ob.lines),
      itemCount: ob.lines.reduce((sum, l) => sum + l.quantity, 0),
      status: ob.status,
      performedBy: ob.createdBy.displayName,
    }));

    // Merge and sort ASC (oldest first)
    const sorted = [...grnTx, ...outTx].sort((a, b) => a.dateMs - b.dateMs);

    // Calculate running balance
    let balance = openingBalance;
    const allTransactions: Transaction[] = sorted.map((tx) => {
      if (tx.type === 'GRN') {
        balance += tx.itemCount;
      } else {
        balance -= tx.itemCount;
      }
      const { dateMs, ...rest } = tx;
      return { ...rest, stockBalance: balance };
    });

    const total = allTransactions.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const items = allTransactions.slice(offset, offset + limit);

    return successResponse({
      items,
      openingBalance,
      pagination: { page, limit, total, totalPages },
    });
  } catch (error) {
    console.error('Transactions API error:', error);
    return errors.internalError();
  }
}

export const GET = withAnalytics(handleGET);
