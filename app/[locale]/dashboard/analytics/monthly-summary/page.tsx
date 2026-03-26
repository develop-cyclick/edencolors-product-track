'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAlert } from '@/components/ui/confirm-modal';

interface MonthlySummary {
  month: string;
  grnCount: number;
  itemsReceived: number;
  poCount: number;
  poConfirmed: number;
  deliveriesCount: number;
  itemsShipped: number;
  activationsCount: number;
  damagedCount: number;
  returnedCount: number;
}

interface MonthlySummaryData {
  summaries: MonthlySummary[];
  totals: {
    totalGRN: number;
    totalReceived: number;
    totalPO: number;
    totalShipped: number;
    totalActivated: number;
    totalDamaged: number;
    totalReturned: number;
  };
}

interface Transaction {
  id: number;
  type: 'GRN' | 'OUTBOUND';
  documentNo: string;
  date: string;
  detail: string;
  warehouse: string;
  products: { name: string; qty: number }[];
  itemCount: number;
  stockBalance: number;
  status: string;
  performedBy: string;
}

interface TransactionData {
  items: Transaction[];
  openingBalance: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type ViewMode = 'overview' | 'detail';

export default function MonthlySummaryPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'th';
  const alert = useAlert();
  const th = locale === 'th';

  // State - overview
  const [data, setData] = useState<MonthlySummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');

  // State - view mode
  const [viewMode, setViewMode] = useState<ViewMode>('overview');

  // State - transactions (detail view)
  const [transactions, setTransactions] = useState<TransactionData | null>(null);
  const [txPage, setTxPage] = useState(1);
  const [txLoading, setTxLoading] = useState(false);

  // Initialize default months (last 6 months)
  useEffect(() => {
    const now = new Date();
    const defaultEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const defaultStart = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}`;
    setStartMonth(defaultStart);
    setEndMonth(defaultEnd);
  }, []);

  // Fetch overview data
  useEffect(() => {
    if (startMonth && endMonth) {
      fetchData();
    }
  }, [startMonth, endMonth]);

  // Fetch transactions when switching to detail or changing page/months
  const fetchTransactions = useCallback(async (page: number) => {
    if (!startMonth || !endMonth) return;
    try {
      setTxLoading(true);
      const res = await fetch(
        `/api/analytics/monthly-summary/transactions?startMonth=${startMonth}&endMonth=${endMonth}&page=${page}&limit=50`
      );
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const result = await res.json();
      setTransactions(result.data);
    } catch (error) {
      console.error(error);
      await alert({
        title: th ? 'เกิดข้อผิดพลาด' : 'Error',
        message: th ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'Failed to load data',
        variant: 'error',
        icon: 'error',
      });
    } finally {
      setTxLoading(false);
    }
  }, [startMonth, endMonth, th, alert]);

  useEffect(() => {
    if (viewMode === 'detail') {
      fetchTransactions(txPage);
    }
  }, [viewMode, txPage, startMonth, endMonth, fetchTransactions]);

  // Reset page when switching to detail or changing months
  useEffect(() => {
    setTxPage(1);
  }, [startMonth, endMonth]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/analytics/monthly-summary?startMonth=${startMonth}&endMonth=${endMonth}`
      );
      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();
      setData(result.data);
    } catch (error) {
      console.error(error);
      await alert({
        title: th ? 'เกิดข้อผิดพลาด' : 'Error',
        message: th ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'Failed to load data',
        variant: 'error',
        icon: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/analytics/monthly-summary/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startMonth,
          endMonth,
          locale,
          format: 'excel',
          viewMode,
          ...(viewMode === 'detail' && transactions ? { transactions: transactions.items } : {}),
        }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const prefix = viewMode === 'detail' ? 'transactions' : 'monthly-summary';
      a.download = `${prefix}-${startMonth}-to-${endMonth}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      console.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const formatMonth = (month: string) => {
    const date = new Date(`${month}-01`);
    return date.toLocaleDateString(th ? 'th-TH' : 'en-US', {
      year: 'numeric',
      month: 'long',
    });
  };

  const formatDate = () => {
    return new Date().toLocaleDateString(th ? 'th-TH' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(th ? 'th-TH' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (type: string, status: string) => {
    if (type === 'GRN') {
      return status === 'COMPLETE'
        ? th ? 'รับครบ' : 'Complete'
        : th ? 'รับบางส่วน' : 'Partial';
    }
    const statusMap: Record<string, string> = th
      ? { DRAFT: 'ร่าง', PENDING: 'รออนุมัติ', APPROVED: 'อนุมัติ', REJECTED: 'ปฏิเสธ' }
      : { DRAFT: 'Draft', PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected' };
    return statusMap[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 relative">
          <div className="absolute inset-0 rounded-full border-4 border-[#F5F1E8]" />
          <div className="absolute inset-0 rounded-full border-4 border-[#C9A35A] border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-[#999999]">{th ? 'ไม่พบข้อมูล' : 'No data found'}</p>
        <Link
          href={`/${locale}/dashboard/analytics`}
          className="text-[#C9A35A] mt-4 inline-block"
        >
          {th ? 'กลับหน้า Analytics' : 'Back to Analytics'}
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Action Bar - Hidden on print */}
      <div className="no-print mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/${locale}/dashboard/analytics`}
            className="inline-flex items-center gap-2 text-[#C9A35A] hover:text-[#B8924A] font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {th ? 'กลับ' : 'Back to Analytics'}
          </Link>

          {/* View Mode Dropdown */}
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as ViewMode)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#C9A35A] font-medium"
          >
            <option value="overview">{th ? 'ภาพรวม' : 'Overview'}</option>
            <option value="detail">{th ? 'รายละเอียด (Transaction)' : 'Detail (Transaction)'}</option>
          </select>
        </div>

        <div className="flex gap-4 items-center">
          {/* Month Range Filter */}
          <div className="flex gap-3 items-center bg-white rounded-lg shadow px-4 py-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-[#666666]">
                {th ? 'ตั้งแต่' : 'From'}
              </label>
              <input
                type="month"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A35A]"
              />
            </div>
            <span className="text-[#666666]">-</span>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-[#666666]">
                {th ? 'ถึง' : 'To'}
              </label>
              <input
                type="month"
                value={endMonth}
                onChange={(e) => setEndMonth(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A35A]"
              />
            </div>
          </div>

          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-charcoal)] text-white rounded-xl font-medium hover:bg-[var(--color-charcoal)]/90 disabled:opacity-50 transition-all"
          >
            {exporting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            Excel
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#C9A35A] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[#B8924A] transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            {th ? 'พิมพ์รายงาน' : 'Print Report'}
          </button>
        </div>
      </div>

      {/* Document */}
      <div className="document-container bg-white max-w-[297mm] mx-auto shadow-lg print:shadow-none min-h-[210mm]">
        <div className="p-6 print:p-[12mm]">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-[16px] font-bold text-gray-800 mb-2">
              {viewMode === 'overview'
                ? th ? 'รายงานสรุปยอดประจำเดือน' : 'Monthly Summary Report'
                : th ? 'รายงานรายละเอียดการเคลื่อนไหวคลังสินค้า' : 'Warehouse Transaction Report'}
            </h1>
            <p className="text-[12px] text-gray-600">
              {th ? 'ช่วงเวลา' : 'Period'}: {formatMonth(startMonth)} - {formatMonth(endMonth)}
            </p>
            <p className="text-[10px] text-gray-500 mt-1">
              {th ? 'สร้างเมื่อ' : 'Generated'}: {formatDate()}
            </p>
          </div>

          {/* Conditional: Overview or Detail */}
          {viewMode === 'overview' ? (
            <OverviewTable
              data={data}
              locale={locale}
              th={th}
              formatMonth={formatMonth}
            />
          ) : (
            <TransactionTable
              transactions={transactions}
              txLoading={txLoading}
              txPage={txPage}
              setTxPage={setTxPage}
              th={th}
              formatDateTime={formatDateTime}
              getStatusLabel={getStatusLabel}
            />
          )}

          {/* Footer Note */}
          <div className="text-center text-[10px] text-gray-600 mt-8 border-t border-gray-300 pt-4">
            <p className="font-bold mb-1">บริษัท อีเดนคัลเลอร์ (ประเทศไทย) จำกัด</p>
            <p>Edencolors (Thailand) Co., Ltd.</p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          header,
          nav,
          aside,
          .no-print,
          [class*="sidebar"],
          [class*="Sidebar"] {
            display: none !important;
          }

          .min-h-screen {
            display: block !important;
            min-height: auto !important;
          }

          main {
            padding: 0 !important;
            margin: 0 !important;
          }

          main > div {
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .document-container {
            box-shadow: none !important;
            width: 297mm !important;
            max-width: 297mm !important;
            min-height: 210mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }

          .document-container > div {
            padding: 10mm !important;
          }

          @page {
            size: A4 landscape;
            margin: 0;
          }

          .document-container * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .document-container .font-bold,
          .document-container b,
          .document-container strong,
          .document-container th {
            font-weight: 600 !important;
          }

          .document-container table td,
          .document-container table th {
            text-align: inherit !important;
          }

          .document-container table td.text-center,
          .document-container table th.text-center {
            text-align: center !important;
          }

          .document-container thead tr {
            background-color: #C9A35A !important;
            color: #111827 !important;
          }

          .document-container tfoot tr {
            background-color: #f3f4f6 !important;
          }
        }
      `}</style>
    </>
  );
}

/* ========== Overview Table Component ========== */
function OverviewTable({
  data,
  locale,
  th,
  formatMonth,
}: {
  data: MonthlySummaryData;
  locale: string;
  th: boolean;
  formatMonth: (m: string) => string;
}) {
  return (
    <>
      <div className="mb-6">
        <table className="w-full border-collapse border border-gray-800 text-[10px]">
          <thead>
            <tr className="bg-[#C9A35A] text-gray-900">
              <th className="border border-gray-800 px-2 py-2 text-left font-bold">
                {th ? 'เดือน' : 'Month'}
              </th>
              <th className="border border-gray-800 px-2 py-2 text-center font-bold">GRN</th>
              <th className="border border-gray-800 px-2 py-2 text-center font-bold">
                {th ? 'รับเข้า' : 'Received'}
              </th>
              <th className="border border-gray-800 px-2 py-2 text-center font-bold">PO</th>
              <th className="border border-gray-800 px-2 py-2 text-center font-bold">
                {th ? 'ส่งออก' : 'Shipped'}
              </th>
              <th className="border border-gray-800 px-2 py-2 text-center font-bold">
                {th ? 'เปิดใช้งาน' : 'Activated'}
              </th>
              <th className="border border-gray-800 px-2 py-2 text-center font-bold">
                {th ? 'เสียหาย' : 'Damaged'}
              </th>
              <th className="border border-gray-800 px-2 py-2 text-center font-bold">
                {th ? 'คืน' : 'Returned'}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.summaries.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="border border-gray-800 px-2 py-2 font-medium">
                  {formatMonth(row.month)}
                </td>
                <td className="border border-gray-800 px-2 py-2 text-center">{row.grnCount}</td>
                <td className="border border-gray-800 px-2 py-2 text-center">{row.itemsReceived}</td>
                <td className="border border-gray-800 px-2 py-2 text-center">{row.poCount}</td>
                <td className="border border-gray-800 px-2 py-2 text-center">{row.itemsShipped}</td>
                <td className="border border-gray-800 px-2 py-2 text-center">{row.activationsCount}</td>
                <td className="border border-gray-800 px-2 py-2 text-center">{row.damagedCount}</td>
                <td className="border border-gray-800 px-2 py-2 text-center">{row.returnedCount}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold">
              <td className="border border-gray-800 px-2 py-2">
                {th ? 'รวมทั้งหมด' : 'Total'}
              </td>
              <td className="border border-gray-800 px-2 py-2 text-center">{data.totals.totalGRN}</td>
              <td className="border border-gray-800 px-2 py-2 text-center">{data.totals.totalReceived}</td>
              <td className="border border-gray-800 px-2 py-2 text-center">{data.totals.totalPO}</td>
              <td className="border border-gray-800 px-2 py-2 text-center">{data.totals.totalShipped}</td>
              <td className="border border-gray-800 px-2 py-2 text-center">{data.totals.totalActivated}</td>
              <td className="border border-gray-800 px-2 py-2 text-center">{data.totals.totalDamaged}</td>
              <td className="border border-gray-800 px-2 py-2 text-center">{data.totals.totalReturned}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6 no-print">
        <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
          <p className="text-[10px] text-gray-600 mb-1">
            {th ? 'สินค้ารับเข้า' : 'Products Received'}
          </p>
          <p className="text-[16px] font-bold text-[#2D2D2D]">
            {data.totals.totalReceived.toLocaleString()}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
          <p className="text-[10px] text-gray-600 mb-1">
            {th ? 'สินค้าส่งออก' : 'Products Shipped'}
          </p>
          <p className="text-[16px] font-bold text-[#2D2D2D]">
            {data.totals.totalShipped.toLocaleString()}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
          <p className="text-[10px] text-gray-600 mb-1">
            {th ? 'เปิดใช้งาน' : 'Activated'}
          </p>
          <p className="text-[16px] font-bold text-[#2D2D2D]">
            {data.totals.totalActivated.toLocaleString()}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
          <p className="text-[10px] text-gray-600 mb-1">
            {th ? 'เสียหาย/คืน' : 'Damaged/Returned'}
          </p>
          <p className="text-[16px] font-bold text-[#2D2D2D]">
            {(data.totals.totalDamaged + data.totals.totalReturned).toLocaleString()}
          </p>
        </div>
      </div>
    </>
  );
}

/* ========== Transaction Table Component ========== */
function TransactionTable({
  transactions,
  txLoading,
  txPage,
  setTxPage,
  th,
  formatDateTime,
  getStatusLabel,
}: {
  transactions: TransactionData | null;
  txLoading: boolean;
  txPage: number;
  setTxPage: (p: number) => void;
  th: boolean;
  formatDateTime: (d: string) => string;
  getStatusLabel: (type: string, status: string) => string;
}) {
  if (txLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-8 h-8 relative">
          <div className="absolute inset-0 rounded-full border-4 border-[#F5F1E8]" />
          <div className="absolute inset-0 rounded-full border-4 border-[#C9A35A] border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!transactions || transactions.items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[#999999] text-sm">
          {th ? 'ไม่พบรายการในช่วงเวลาที่เลือก' : 'No transactions found for selected period'}
        </p>
      </div>
    );
  }

  const { items, pagination, openingBalance } = transactions;

  return (
    <div className="mb-6">
      {/* Opening Balance */}
      <div className="mb-2 text-[10px] text-gray-600">
        {th ? 'ยอดยกมาต้นงวด' : 'Opening Balance'}: <span className="font-bold text-gray-800">{openingBalance.toLocaleString()}</span> {th ? 'ชิ้น' : 'items'}
      </div>

      <table className="w-full border-collapse border border-gray-800 text-[9px]">
        <thead>
          <tr className="bg-[#C9A35A] text-gray-900">
            <th className="border border-gray-800 px-1.5 py-1.5 text-left font-bold">
              {th ? 'วันที่/เวลา' : 'Date/Time'}
            </th>
            <th className="border border-gray-800 px-1.5 py-1.5 text-center font-bold">
              {th ? 'ประเภท' : 'Type'}
            </th>
            <th className="border border-gray-800 px-1.5 py-1.5 text-left font-bold">
              {th ? 'เลขที่เอกสาร' : 'Doc No.'}
            </th>
            <th className="border border-gray-800 px-1.5 py-1.5 text-left font-bold">
              {th ? 'รายละเอียด' : 'Detail'}
            </th>
            <th className="border border-gray-800 px-1.5 py-1.5 text-left font-bold">
              {th ? 'สินค้า' : 'Products'}
            </th>
            <th className="border border-gray-800 px-1.5 py-1.5 text-left font-bold">
              {th ? 'คลัง' : 'WH'}
            </th>
            <th className="border border-gray-800 px-1.5 py-1.5 text-center font-bold">
              {th ? 'จำนวน' : 'Qty'}
            </th>
            <th className="border border-gray-800 px-1.5 py-1.5 text-center font-bold">
              {th ? 'คงเหลือ' : 'Balance'}
            </th>
            <th className="border border-gray-800 px-1.5 py-1.5 text-center font-bold">
              {th ? 'สถานะ' : 'Status'}
            </th>
            <th className="border border-gray-800 px-1.5 py-1.5 text-left font-bold">
              {th ? 'ผู้ดำเนินการ' : 'By'}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((tx) => (
            <tr key={`${tx.type}-${tx.id}`} className="hover:bg-gray-50">
              <td className="border border-gray-800 px-1.5 py-1.5 whitespace-nowrap">
                {formatDateTime(tx.date)}
              </td>
              <td className="border border-gray-800 px-1.5 py-1.5 text-center">
                <span
                  className={`inline-block px-1.5 py-0.5 rounded-full text-[8px] font-semibold ${
                    tx.type === 'GRN'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {tx.type === 'GRN'
                    ? th ? 'รับเข้า' : 'In'
                    : th ? 'ส่งออก' : 'Out'}
                </span>
              </td>
              <td className="border border-gray-800 px-1.5 py-1.5 font-mono whitespace-nowrap">
                {tx.documentNo}
              </td>
              <td className="border border-gray-800 px-1.5 py-1.5">
                {tx.detail}
              </td>
              <td className="border border-gray-800 px-1.5 py-1.5">
                {tx.products.map((p, i) => (
                  <div key={i} className="whitespace-nowrap">
                    {p.name} <span className="text-gray-500">x{p.qty}</span>
                  </div>
                ))}
              </td>
              <td className="border border-gray-800 px-1.5 py-1.5">
                {tx.warehouse}
              </td>
              <td className="border border-gray-800 px-1.5 py-1.5 text-center font-medium">
                <span className={tx.type === 'GRN' ? 'text-green-700' : 'text-blue-700'}>
                  {tx.type === 'GRN' ? '+' : '-'}{tx.itemCount}
                </span>
              </td>
              <td className="border border-gray-800 px-1.5 py-1.5 text-center font-bold">
                {tx.stockBalance.toLocaleString()}
              </td>
              <td className="border border-gray-800 px-1.5 py-1.5 text-center">
                {getStatusLabel(tx.type, tx.status)}
              </td>
              <td className="border border-gray-800 px-1.5 py-1.5">
                {tx.performedBy}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 no-print">
          <p className="text-xs text-gray-500">
            {th
              ? `แสดง ${(pagination.page - 1) * pagination.limit + 1}-${Math.min(pagination.page * pagination.limit, pagination.total)} จาก ${pagination.total} รายการ`
              : `Showing ${(pagination.page - 1) * pagination.limit + 1}-${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total}`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setTxPage(txPage - 1)}
              disabled={txPage <= 1}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {th ? 'ก่อนหน้า' : 'Prev'}
            </button>
            <span className="px-3 py-1.5 text-xs text-gray-600">
              {txPage} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setTxPage(txPage + 1)}
              disabled={txPage >= pagination.totalPages}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {th ? 'ถัดไป' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {/* Total count for print */}
      <div className="mt-3 text-right text-[10px] text-gray-600">
        {th ? `รวมทั้งหมด ${pagination.total} รายการ` : `Total: ${pagination.total} transactions`}
      </div>
    </div>
  );
}
