"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface BorrowLine {
  id: number;
  sku: string;
  itemName: string;
  modelSize: string | null;
  quantity: number;
  lot: string | null;
  expDate: string | null;
  remarks: string | null;
  productItem: {
    id: number;
    serial12: string;
    status: string;
  };
  unit: { id: number; nameTh: string; nameEn: string } | null;
}

interface BorrowTransaction {
  id: number;
  transactionNo: string;
  type: "BORROW" | "RETURN";
  status: "PENDING" | "APPROVED" | "REJECTED" | "RETURNED";
  borrowerName: string;
  clinicName: string | null;
  clinicAddress: string | null;
  contactName: string | null;
  contactPhone: string | null;
  taxInvoiceRef: string | null;
  reason: string | null;
  remarks: string | null;
  createdAt: string;
  approvedAt: string | null;
  createdBy: { id: number; displayName: string; username: string };
  approvedBy: { id: number; displayName: string; username: string } | null;
  lines: BorrowLine[];
}

function formatSerialRanges(serials: string[]): string {
  if (serials.length === 0) return "";
  if (serials.length === 1) return serials[0];
  const sorted = [...serials].sort();
  const findNumericSuffix = (s: string) => {
    let i = s.length - 1;
    while (i >= 0 && /\d/.test(s[i])) i--;
    return { prefix: s.slice(0, i + 1), num: s.slice(i + 1) };
  };
  const ranges: string[] = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const prev = findNumericSuffix(rangeEnd);
    const curr = findNumericSuffix(sorted[i]);
    if (prev.prefix === curr.prefix && curr.num.length === prev.num.length && parseInt(curr.num) === parseInt(prev.num) + 1) {
      rangeEnd = sorted[i];
    } else {
      if (rangeStart === rangeEnd) {
        ranges.push(rangeStart);
      } else {
        const endSuffix = findNumericSuffix(rangeEnd);
        ranges.push(`${rangeStart}-${endSuffix.num}`);
      }
      rangeStart = sorted[i];
      rangeEnd = sorted[i];
    }
  }
  if (rangeStart === rangeEnd) {
    ranges.push(rangeStart);
  } else {
    const endSuffix = findNumericSuffix(rangeEnd);
    ranges.push(`${rangeStart}-${endSuffix.num}`);
  }
  return ranges.join(", ");
}

export default function BorrowDocumentPage() {
  const params = useParams();
  const locale = params.locale as string;
  const id = params.id as string;

  const [transaction, setTransaction] = useState<BorrowTransaction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransaction();
  }, [id]);

  const fetchTransaction = async () => {
    try {
      const res = await fetch(`/api/warehouse/borrow/${id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setTransaction(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch borrow transaction:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 relative">
          <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
          <div className="absolute inset-0 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-foreground-muted)]">ไม่พบข้อมูล</p>
        <Link
          href={`/${locale}/dashboard/damaged-products`}
          className="text-[var(--color-gold)] mt-4 inline-block"
        >
          กลับหน้ารายการ
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Action Bar - Hidden on print */}
      <div className="no-print mb-6 flex items-center justify-between">
        <Link
          href={`/${locale}/dashboard/damaged-products`}
          className="inline-flex items-center gap-2 text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] font-medium"
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
          กลับหน้ารายการ
        </Link>
        <div className="flex gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-2.5 bg-[var(--color-gold)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] transition-all"
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
            พิมพ์เอกสาร
          </button>
        </div>
      </div>

      {/* Document */}
      <div className="document-container bg-white max-w-[210mm] mx-auto shadow-lg print:shadow-none print:max-w-none min-h-[297mm]">
        <div className="p-6 print:p-[12mm]">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-[16px] font-bold text-gray-800 mb-4">
              ใบรับคืน / ยืมสินค้า / คืนสินค้า
            </h1>
          </div>

          {/* Type Checkboxes */}
          <div className="flex justify-center gap-8 mb-6 text-[12px]">
            <label className="flex items-center gap-2">
              <div className="w-4 h-4 border border-gray-800 flex items-center justify-center">
                {/* รับคืน - not used for borrow/return */}
              </div>
              <span>รับคืน</span>
            </label>
            <label className="flex items-center gap-2">
              <div className="w-4 h-4 border border-gray-800 flex items-center justify-center">
                {transaction.type === "BORROW" && <span className="font-bold">X</span>}
              </div>
              <span>ยืมสินค้า</span>
            </label>
            <label className="flex items-center gap-2">
              <div className="w-4 h-4 border border-gray-800 flex items-center justify-center">
                {transaction.type === "RETURN" && <span className="font-bold">X</span>}
              </div>
              <span>คืนสินค้า</span>
            </label>
          </div>

          {/* Form Fields */}
          <div className="mb-4 space-y-2 text-[11px]">
            {/* Row 1: Borrower name & Document No */}
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-1">
                  <span className="whitespace-nowrap">ชื่อผู้ยืม/คืน</span>
                  <div className="flex-1 border-b border-gray-800 text-center px-2">
                    <span>{transaction.borrowerName}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="whitespace-nowrap">เลขที่เอกสาร</span>
                <div className="border-b border-gray-800 text-center min-w-[120px] px-2">
                  <span>{transaction.transactionNo}</span>
                </div>
              </div>
            </div>

            {/* Row 2: Clinic name & Date */}
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-1">
                  <span className="whitespace-nowrap">ชื่อคลินิก</span>
                  <div className="flex-1 border-b border-gray-800 text-center px-2">
                    <span>{transaction.clinicName || ""}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="whitespace-nowrap">วันที่</span>
                <div className="border-b border-gray-800 text-center min-w-[120px] px-2">
                  <span>{formatDate(transaction.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Row 3: Address */}
            <div className="flex items-baseline gap-1">
              <span className="whitespace-nowrap">ที่อยู่</span>
              <div className="flex-1 border-b border-gray-800 px-2">
                <span>{transaction.clinicAddress || ""}</span>
              </div>
            </div>

            {/* Row: Contact info */}
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-1">
                  <span className="whitespace-nowrap">ชื่อผู้ติดต่อ</span>
                  <div className="flex-1 border-b border-gray-800 text-center px-2">
                    <span>{transaction.contactName || ""}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="whitespace-nowrap">เบอร์โทร</span>
                <div className="border-b border-gray-800 text-center min-w-[120px] px-2">
                  <span>{transaction.contactPhone || ""}</span>
                </div>
              </div>
            </div>

            {/* Row 4: Tax invoice ref */}
            <div className="flex items-baseline gap-1">
              <span className="whitespace-nowrap">เลขที่ใบกำกับภาษี</span>
              <div className="border-b border-gray-800 min-w-[200px] px-2">
                <span>{transaction.taxInvoiceRef || ""}</span>
              </div>
            </div>

            {/* Row 5: Reason */}
            <div className="flex items-baseline gap-1">
              <span className="whitespace-nowrap">สาเหตุการยืม/คืน</span>
              <div className="min-w-[300px] border-b border-gray-800 px-2">
                <span>{transaction.reason || ""}</span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          {(() => {
            // Group lines by SKU + LOT + EXP
            const groupedLines = (() => {
              const groups = new Map<string, { lines: BorrowLine[]; totalQuantity: number }>();
              transaction.lines.forEach((line) => {
                const key = `${line.sku}|${line.lot || ''}|${line.expDate || ''}`;
                if (!groups.has(key)) {
                  groups.set(key, { lines: [], totalQuantity: 0 });
                }
                const group = groups.get(key)!;
                group.lines.push(line);
                group.totalQuantity += line.quantity;
              });
              return Array.from(groups.values());
            })();

            return (
              <div className="mb-4">
                <table className="w-full border-collapse border border-gray-800 text-[10px]">
                  <thead>
                    <tr className="border border-gray-800">
                      <th className="border border-gray-800 px-1 py-1 text-center font-bold w-[30px]">
                        ลำดับ
                      </th>
                      <th className="border border-gray-800 px-1 py-1 text-center font-bold">
                        รายการ
                      </th>
                      <th className="border border-gray-800 px-1 py-1 text-center font-bold w-[60px]">
                        LOT.
                      </th>
                      <th className="border border-gray-800 px-1 py-1 text-center font-bold w-[70px]">
                        EXP.
                      </th>
                      <th className="border border-gray-800 px-1 py-1 text-center font-bold w-[90px]">
                        Number
                      </th>
                      <th className="border border-gray-800 px-1 py-1 text-center font-bold w-[40px]">
                        จำนวน
                      </th>
                      <th className="border border-gray-800 px-1 py-1 text-center font-bold w-[40px]">
                        หน่วย
                      </th>
                      <th className="border border-gray-800 px-1 py-1 text-center font-bold w-[80px]">
                        หมายเหตุ
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedLines.map((group, index) => {
                      const firstLine = group.lines[0];
                      const serialRanges = formatSerialRanges(group.lines.map(l => l.productItem.serial12));
                      const uniqueRemarks = [...new Set(group.lines.map(l => l.remarks).filter(Boolean))];
                      return (
                        <tr key={`${firstLine.sku}-${firstLine.lot}-${firstLine.expDate}-${index}`} className="border border-gray-800">
                          <td className="border border-gray-800 px-1 py-1 text-center">
                            {index + 1}
                          </td>
                          <td className="border border-gray-800 px-1 py-1">
                            {firstLine.itemName}
                            {firstLine.modelSize && ` (${firstLine.modelSize})`}
                          </td>
                          <td className="border border-gray-800 px-1 py-1 text-center">
                            {firstLine.lot || ""}
                          </td>
                          <td className="border border-gray-800 px-1 py-1 text-center">
                            {formatDate(firstLine.expDate)}
                          </td>
                          <td className="border border-gray-800 px-1 py-1 text-center font-mono text-[9px]">
                            {serialRanges}
                          </td>
                          <td className="border border-gray-800 px-1 py-1 text-center">
                            {group.totalQuantity}
                          </td>
                          <td className="border border-gray-800 px-1 py-1 text-center">
                            {firstLine.unit?.nameTh || ""}
                          </td>
                          <td className="border border-gray-800 px-1 py-1">
                            {uniqueRemarks.join(", ")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Signature Section */}
          <div className="space-y-4 flex gap-4 text-[11px] justify-end mt-20">
            {/* Row 1: ผู้คืน/ยืมสินค้า and ผู้อนุมัติ */}
            <div className="flex gap-4">
              <div className="flex flex-col-reverse items-baseline gap-1">
                <span className="mx-auto">ผู้คืน/ยืมสินค้า</span>
                <div className="border-b border-gray-800 min-w-[100px] px-2"></div>
              </div>
              <div className="flex flex-col-reverse items-baseline gap-1">
                <span className="mx-auto">ผู้อนุมัติ</span>
                <div className="border-b border-gray-800 min-w-[100px] px-2 text-center">
                  {/*<span>{transaction.approvedBy?.displayName || ""}</span>*/}
                </div>
              </div>
            </div>

            {/* Row 2: Date lines */}
            {/*<div className="flex gap-4">
              <div className="flex flex-col-reverse items-baseline gap-1">
                <span className="mx-auto">วันที่</span>
                <div className="border-b border-gray-800 min-w-[150px] px-2 text-center">
                  <span>{formatDate(transaction.createdAt)}</span>
                </div>
              </div>
              <div className="flex flex-col-reverse items-baseline gap-1">
                <span className="mx-auto">วันที่</span>
                <div className="border-b border-gray-800 min-w-[130px] px-2 text-center">
                  <span>{formatDate(transaction.approvedAt)}</span>
                </div>
              </div>
            </div>*/}

            {/* Row 3: ผู้อนุมัติ (2) */}
            <div className="flex gap-4">
              <div className="flex flex-col-reverse items-baseline gap-1">
                <span className="mx-auto">ผู้อนุมัติ</span>
                <div className="border-b border-gray-800 min-w-[100px] px-2"></div>
              </div>
              {/*<div className="flex flex-col-reverse items-baseline gap-1">
                <span className="mx-auto">วันที่</span>
                <div className="border-b border-gray-800 min-w-[130px] px-2"></div>
              </div>*/}
            </div>

            {/* Row 4: ผู้รับสินค้า (ผู้แทน) */}
            <div className="flex gap-4">
              <div className="flex flex-col-reverse items-baseline gap-1">
                <span className="mx-auto">ผู้รับสินค้า (ผู้แทน)</span>
                <div className="border-b border-gray-800 min-w-[100px] px-2"></div>
              </div>
              {/*<div className="flex flex-col-reverse items-baseline gap-1">
                <span className="mx-auto">วันที่</span>
                <div className="border-b border-gray-800 min-w-[130px] px-2"></div>
              </div>*/}
            </div>

            {/* Row 5: ผู้รับสินค้า (ลูกค้า) */}
            <div className="flex gap-4">
              <div className="flex flex-col-reverse items-baseline gap-1">
                <span className="mx-auto">ผู้รับสินค้า (ลูกค้า)</span>
                <div className="border-b border-gray-800 min-w-[120px] px-2"></div>
              </div>
              <div className="flex flex-col-reverse items-baseline gap-1">
                <span className="mx-auto">ผู้รับสินค้า (Stock)</span>
                <div className="border-b border-gray-800 min-w-[100px] px-2"></div>
              </div>
              {/*<div className="flex flex-col-reverse items-baseline gap-1">
                <span className="mx-auto">วันที่</span>
                <div className="border-b border-gray-800 min-w-[130px] px-2"></div>
              </div>*/}
            </div>

            {/* Row 6: ผู้รับสินค้า (Stock) */}
            <div className="flex gap-4">
              {/*<div className="flex flex-col-reverse items-baseline gap-1">
                <span className="whitespace-nowrap">ผู้รับสินค้า (Stock)</span>
                <div className="border-b border-gray-800 min-w-[100px] px-2"></div>
              </div>*/}
              {/*<div className="flex flex-col-reverse items-baseline gap-1">
                <span className="whitespace-nowrap">วันที่</span>
                <div className="border-b border-gray-800 min-w-[130px] px-2"></div>
              </div>*/}
            </div>
          </div>

          {/* Remarks */}
          {transaction.remarks && (
            <div className="mt-6 text-[10px]">
              <span className="font-bold">หมายเหตุ: </span>
              <span>1. การรับคืน สินค้าจะต้องอยู่ในสภาพสมบูรณ์ ไม่มีความเสียหายเท่านั้น</span>
            </div>
          )}
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

          /* Document container - fill A4 page */
          .document-container {
            box-shadow: none !important;
            width: 210mm !important;
            max-width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }

          .document-container > div {
            padding: 10mm !important;
            height: 100% !important;
          }

          @page {
            size: A4;
            margin: 0;
          }

          /* Fix bold text being too heavy in PDF */
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

          /* Fix table text-center in print */
          .document-container table td,
          .document-container table th {
            text-align: inherit !important;
          }

          .document-container table td.text-center,
          .document-container table tfoot td {
            text-align: center !important;
          }
        }
      `}</style>
    </>
  );
}
