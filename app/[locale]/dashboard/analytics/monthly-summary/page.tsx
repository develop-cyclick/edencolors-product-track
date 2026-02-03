'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface MonthlySummary {
  month: string;
  grnCount: number;
  itemsReceived: number;
  itemsOk: number;
  itemsDefective: number;
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

export default function MonthlySummaryPage() {
  const params = useParams();
  const locale = params?.locale as string || 'th';

  // State
  const [data, setData] = useState<MonthlySummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');

  // Initialize default months (last 6 months)
  useEffect(() => {
    const now = new Date();
    const defaultEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const defaultStart = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}`;

    setStartMonth(defaultStart);
    setEndMonth(defaultEnd);
  }, []);

  // Fetch data
  useEffect(() => {
    if (startMonth && endMonth) {
      fetchData();
    }
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
      alert(locale === 'th' ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatMonth = (month: string) => {
    const date = new Date(`${month}-01`);
    return date.toLocaleDateString(
      locale === 'th' ? 'th-TH' : 'en-US',
      { year: 'numeric', month: 'long' }
    );
  };

  const formatDate = () => {
    return new Date().toLocaleDateString(
      locale === 'th' ? 'th-TH' : 'en-US',
      { year: 'numeric', month: 'long', day: 'numeric' }
    );
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
        <p className="text-[#999999]">ไม่พบข้อมูล</p>
        <Link
          href={`/${locale}/dashboard/analytics`}
          className="text-[#C9A35A] mt-4 inline-block"
        >
          กลับหน้า Analytics
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Action Bar - Hidden on print */}
      <div className="no-print mb-6 flex items-center justify-between">
        <Link
          href={`/${locale}/dashboard/analytics`}
          className="inline-flex items-center gap-2 text-[#C9A35A] hover:text-[#B8924A] font-medium"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {locale === 'th' ? 'กลับ' : 'Back to Analytics'}
        </Link>

        <div className="flex gap-4 items-center">
          {/* Month Range Filter */}
          <div className="flex gap-3 items-center bg-white rounded-lg shadow px-4 py-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-[#666666]">
                {locale === 'th' ? 'ตั้งแต่' : 'From'}
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
                {locale === 'th' ? 'ถึง' : 'To'}
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
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#C9A35A] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[#B8924A] transition-all"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            {locale === 'th' ? 'พิมพ์รายงาน' : 'Print Report'}
          </button>
        </div>
      </div>

      {/* Document */}
      <div className="document-container bg-white max-w-[297mm] mx-auto shadow-lg print:shadow-none min-h-[210mm]">
        <div className="p-6 print:p-[12mm]">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-[16px] font-bold text-gray-800 mb-2">
              {locale === 'th' ? 'รายงานสรุปยอดประจำเดือน' : 'Monthly Summary Report'}
            </h1>
            <p className="text-[12px] text-gray-600">
              {locale === 'th' ? 'ช่วงเวลา' : 'Period'}: {formatMonth(startMonth)} - {formatMonth(endMonth)}
            </p>
            <p className="text-[10px] text-gray-500 mt-1">
              {locale === 'th' ? 'สร้างเมื่อ' : 'Generated'}: {formatDate()}
            </p>
          </div>

          {/* Summary Table */}
          <div className="mb-6">
            <table className="w-full border-collapse border border-gray-800 text-[10px]">
              <thead>
                <tr className="bg-[#C9A35A] text-gray-900">
                  <th className="border border-gray-800 px-2 py-2 text-left font-bold">
                    {locale === 'th' ? 'เดือน' : 'Month'}
                  </th>
                  <th className="border border-gray-800 px-2 py-2 text-center font-bold">
                    {locale === 'th' ? 'GRN' : 'GRN'}
                  </th>
                  <th className="border border-gray-800 px-2 py-2 text-center font-bold">
                    {locale === 'th' ? 'รับเข้า' : 'Received'}
                  </th>
                  <th className="border border-gray-800 px-2 py-2 text-center font-bold">
                    {locale === 'th' ? 'PO' : 'PO'}
                  </th>
                  <th className="border border-gray-800 px-2 py-2 text-center font-bold">
                    {locale === 'th' ? 'ส่งออก' : 'Shipped'}
                  </th>
                  <th className="border border-gray-800 px-2 py-2 text-center font-bold">
                    {locale === 'th' ? 'เปิดใช้งาน' : 'Activated'}
                  </th>
                  <th className="border border-gray-800 px-2 py-2 text-center font-bold">
                    {locale === 'th' ? 'เสียหาย' : 'Damaged'}
                  </th>
                  <th className="border border-gray-800 px-2 py-2 text-center font-bold">
                    {locale === 'th' ? 'คืน' : 'Returned'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.summaries.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border border-gray-800 px-2 py-2 font-medium">
                      {formatMonth(row.month)}
                    </td>
                    <td className="border border-gray-800 px-2 py-2 text-center">
                      {row.grnCount}
                    </td>
                    <td className="border border-gray-800 px-2 py-2 text-center">
                      {row.itemsReceived}
                    </td>
                    <td className="border border-gray-800 px-2 py-2 text-center">
                      {row.poCount}
                    </td>
                    <td className="border border-gray-800 px-2 py-2 text-center">
                      {row.itemsShipped}
                    </td>
                    <td className="border border-gray-800 px-2 py-2 text-center">
                      {row.activationsCount}
                    </td>
                    <td className="border border-gray-800 px-2 py-2 text-center">
                      {row.damagedCount}
                    </td>
                    <td className="border border-gray-800 px-2 py-2 text-center">
                      {row.returnedCount}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td className="border border-gray-800 px-2 py-2">
                    {locale === 'th' ? 'รวมทั้งหมด' : 'Total'}
                  </td>
                  <td className="border border-gray-800 px-2 py-2 text-center">
                    {data.totals.totalGRN}
                  </td>
                  <td className="border border-gray-800 px-2 py-2 text-center">
                    {data.totals.totalReceived}
                  </td>
                  <td className="border border-gray-800 px-2 py-2 text-center">
                    {data.totals.totalPO}
                  </td>
                  <td className="border border-gray-800 px-2 py-2 text-center">
                    {data.totals.totalShipped}
                  </td>
                  <td className="border border-gray-800 px-2 py-2 text-center">
                    {data.totals.totalActivated}
                  </td>
                  <td className="border border-gray-800 px-2 py-2 text-center">
                    {data.totals.totalDamaged}
                  </td>
                  <td className="border border-gray-800 px-2 py-2 text-center">
                    {data.totals.totalReturned}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6 no-print">
            <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
              <p className="text-[10px] text-gray-600 mb-1">
                {locale === 'th' ? 'สินค้ารับเข้า' : 'Products Received'}
              </p>
              <p className="text-[16px] font-bold text-[#2D2D2D]">
                {data.totals.totalReceived.toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
              <p className="text-[10px] text-gray-600 mb-1">
                {locale === 'th' ? 'สินค้าส่งออก' : 'Products Shipped'}
              </p>
              <p className="text-[16px] font-bold text-[#2D2D2D]">
                {data.totals.totalShipped.toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
              <p className="text-[10px] text-gray-600 mb-1">
                {locale === 'th' ? 'เปิดใช้งาน' : 'Activated'}
              </p>
              <p className="text-[16px] font-bold text-[#2D2D2D]">
                {data.totals.totalActivated.toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
              <p className="text-[10px] text-gray-600 mb-1">
                {locale === 'th' ? 'เสียหาย/คืน' : 'Damaged/Returned'}
              </p>
              <p className="text-[16px] font-bold text-[#2D2D2D]">
                {(data.totals.totalDamaged + data.totals.totalReturned).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center text-[10px] text-gray-600 mt-8 border-t border-gray-300 pt-4">
            <p className="font-bold mb-1">บริษัท อีเดนคัลเลอร์ (ประเทศไทย) จำกัด</p>
            <p>Eden Colors (Thailand) Co., Ltd.</p>
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

          /* Hide sidebar, header, and navigation */
          header,
          nav,
          aside,
          .no-print,
          [class*="sidebar"],
          [class*="Sidebar"] {
            display: none !important;
          }

          /* Reset layout */
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

          /* Document container - landscape A4 page */
          .document-container {
            box-shadow: none !important;
            width: 297mm !important;
            max-width: 297mm !important;
            height: 210mm !important;
            min-height: 210mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }

          .document-container > div {
            padding: 10mm !important;
            height: 100% !important;
          }

          @page {
            size: A4 landscape;
            margin: 0;
          }

          /* Fix colors in print */
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

          /* Fix table alignment */
          .document-container table td,
          .document-container table th {
            text-align: inherit !important;
          }

          .document-container table td.text-center,
          .document-container table th.text-center {
            text-align: center !important;
          }

          /* Ensure header background prints */
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
