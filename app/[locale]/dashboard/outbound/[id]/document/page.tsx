"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface OutboundLine {
  id: number;
  sku: string;
  itemName: string;
  modelSize: string | null;
  quantity: number;
  lot: string | null;
  expDate: string | null;
  itemStatus: string | null;
  productItem: {
    id: number;
    serial12: string;
    status: string;
    category: { id: number; nameTh: string; nameEn: string };
  };
  unit: { id: number; nameTh: string; nameEn: string };
}

interface OutboundHeader {
  id: number;
  deliveryNoteNo: string;
  contractNo: string | null;
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  shippedAt: string | null;
  approvedAt: string | null;
  rejectReason: string | null;
  salesPersonName: string | null;
  companyContact: string | null;
  clinicAddress: string | null;
  clinicPhone: string | null;
  clinicEmail: string | null;
  clinicContactName: string | null;
  remarks: string | null;
  purchaseOrder: { id: number; poNo: string; billingName: string | null } | null;
  warehouse: { id: number; name: string };
  shippingMethod: { id: number; nameTh: string; nameEn: string } | null;
  clinic: {
    id: number;
    name: string;
    address: string;
    branchName: string | null;
  } | null;
  createdBy: { id: number; displayName: string; username: string };
  approvedBy: { id: number; displayName: string; username: string } | null;
  lines: OutboundLine[];
}

/**
 * Format serial numbers as ranges where consecutive
 * e.g. ["FA2401000001", "FA2401000002", "FA2401000003", "FA2401000005"]
 *   → "FA2401000001-003, FA2401000005"
 */
function formatSerialRanges(serials: string[]): string {
  if (serials.length === 0) return "";
  if (serials.length === 1) return serials[0];

  // Sort serials
  const sorted = [...serials].sort();

  // Find the common prefix length (where digits start differing)
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

    // Check if same prefix and consecutive number
    if (
      prev.prefix === curr.prefix &&
      prev.num.length === curr.num.length &&
      parseInt(curr.num) === parseInt(prev.num) + 1
    ) {
      rangeEnd = sorted[i];
    } else {
      // Push previous range
      if (rangeStart === rangeEnd) {
        ranges.push(rangeStart);
      } else {
        const endSuffix = findNumericSuffix(rangeEnd).num;
        ranges.push(`${rangeStart}-${endSuffix}`);
      }
      rangeStart = sorted[i];
      rangeEnd = sorted[i];
    }
  }

  // Push last range
  if (rangeStart === rangeEnd) {
    ranges.push(rangeStart);
  } else {
    const endSuffix = findNumericSuffix(rangeEnd).num;
    ranges.push(`${rangeStart}-${endSuffix}`);
  }

  return ranges.join(", ");
}

export default function OutboundDocumentPage() {
  const params = useParams();
  const locale = params.locale as string;
  const id = params.id as string;

  const [outbound, setOutbound] = useState<OutboundHeader | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOutbound();
  }, [id]);

  const fetchOutbound = async () => {
    try {
      const res = await fetch(`/api/warehouse/outbound/${id}`);
      const data = await res.json();
      if (data.success && data.data?.outbound) {
        setOutbound(data.data.outbound);
      }
    } catch (error) {
      console.error("Failed to fetch outbound:", error);
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

  const [showWarning, setShowWarning] = useState(false);

  const handlePrint = () => {
    if (outbound && outbound.status !== "APPROVED") {
      setShowWarning(true);
      return;
    }
    window.print();
  };

  const handleDownloadPDF = () => {
    window.open(`/api/warehouse/outbound/${id}/export`, "_blank");
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

  if (!outbound) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-foreground-muted)]">ไม่พบข้อมูล</p>
        <Link
          href={`/${locale}/dashboard/outbound`}
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
          href={`/${locale}/dashboard/outbound/${id}`}
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
          กลับหน้ารายละเอียด
        </Link>
        <div className="flex gap-3">
          {/*<button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-6 py-2.5 bg-[var(--color-mint)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(115,207,199,0.3)] hover:bg-[var(--color-mint-dark)] transition-all"
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
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            ดาวน์โหลด PDF
          </button>*/}
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
            <h1 className="text-[10px] font-bold text-gray-800 mb-0.5">
              ใบส่งสินค้า
            </h1>
            <p className="text-[14px] text-left font-bold mt-2">
              ผู้ส่งสินค้า : บริษัท อีเด็นคัลเลอร์ (ประเทศไทย) จำกัด
              <p className=" pl-17">106/2 ถนนพุทธมณฑลสาย 1 แขวงบางระมาด เขตตลิ่งชัน กรุงเทพมหานคร 10170</p>
              <p className=" pl-17">เลขประจำตัวเสียภาษี : 0145558004150</p>
            </p>
          </div>

          {/* Customer Info Section */}
          <div className="mb-3 space-y-1.5">
            {/* Row 1 */}
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-[11px]">ลูกค้า</span>
                  <div className="flex-1 border-b border-gray-800 text-center">
                    <span className="text-[11px]">
                      {outbound.purchaseOrder?.billingName ||""} / {outbound.clinic?.name || ""}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-[11px]">ที่อยู่</span>
                  <div className="flex-1 border-b border-gray-800 text-center">
                    <span className="text-[11px]">
                      {outbound.clinicAddress ||
                        `${outbound.clinic?.address || ""}${outbound.clinic?.branchName ? ` (${outbound.clinic.branchName})` : ""}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2 */}
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-[11px] whitespace-nowrap">
                    โทรศัพท์/ชื่อผู้ติดต่อ
                  </span>
                  <div className="flex-1 border-b border-gray-800 text-center">
                    <span className="text-[11px]">
                      {outbound.clinicPhone || ""} /{" "}
                      {outbound.clinicContactName || ""}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-[11px] whitespace-nowrap">IV No.</span>
                  <div className="border-b border-gray-800 min-w-[100px] text-center">
                    <span className="text-[11px]">
                      {outbound.deliveryNoteNo}
                    </span>
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[11px] whitespace-nowrap">
                    ส่งของวันที่
                  </span>
                  <div className="border-b border-gray-800 min-w-[80px] text-center">
                    <span className="text-[11px]">
                      {formatDate(outbound.shippedAt || outbound.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3 */}
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-[11px]">Contract No.</span>
                  <div className=" border-b border-gray-800  text-center min-w-[180px]">
                    <span className="text-[11px]">{outbound.contractNo || ""}</span>
                  </div>
                </div>
              </div>
              {outbound.purchaseOrder?.poNo && (
                <div className="flex-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-[11px]">PO No.</span>
                    <div className="flex-1 border-b border-gray-800 text-center">
                      <span className="text-[11px]">{outbound.purchaseOrder.poNo}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-3">
            <table className="w-full border-collapse border border-gray-800 text-[10px]">
              <thead>
                <tr className="border border-gray-800">
                  <th className="border border-gray-800 px-1 py-1 text-center font-bold">
                    ลำดับ
                  </th>
                  <th className="border border-gray-800 px-1 py-1 text-center font-bold">
                    รายการ
                  </th>
                  <th className="border border-gray-800 px-1 py-1 text-center font-bold">
                    LOT.
                  </th>
                  <th className="border border-gray-800 px-1 py-1 text-center font-bold">
                    EXP.
                  </th>
                  <th className="border border-gray-800 px-1 py-1 text-center font-bold">
                    Number
                  </th>
                  <th className="border border-gray-800 px-1 py-1 text-center font-bold">
                    จำนวน
                  </th>
                  <th className="border border-gray-800 px-1 py-1 text-center font-bold">
                    หน่วย
                  </th>
                  <th className="border border-gray-800 px-1 py-1 text-center font-bold">
                    หมายเหตุ
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Group lines by same product type (sku + lot + expDate)
                  const grouped: Array<{
                    key: string;
                    itemName: string;
                    modelSize: string | null;
                    sku: string;
                    lot: string | null;
                    expDate: string | null;
                    unit: { nameTh: string; nameEn: string } | null;
                    serials: string[];
                    totalQty: number;
                  }> = [];

                  outbound.lines.forEach((line) => {
                    const key = `${line.sku}|${line.lot || ""}|${line.expDate || ""}`;
                    const existing = grouped.find((g) => g.key === key);
                    if (existing) {
                      existing.serials.push(line.productItem.serial12);
                      existing.totalQty += line.quantity;
                    } else {
                      grouped.push({
                        key,
                        itemName: line.itemName,
                        modelSize: line.modelSize,
                        sku: line.sku,
                        lot: line.lot,
                        expDate: line.expDate,
                        unit: line.unit,
                        serials: [line.productItem.serial12],
                        totalQty: line.quantity,
                      });
                    }
                  });

                  return grouped.map((group, index) => (
                    <tr key={group.key} className="border border-gray-800">
                      <td className="border border-gray-800 px-1 py-1 text-center align-top">
                        {index + 1}
                      </td>
                      <td className="border border-gray-800 px-1 py-1 align-top">
                        {group.itemName}
                        {group.modelSize && ` (${group.modelSize})`}
                      </td>
                      <td className="border border-gray-800 px-1 py-1 text-center align-top">
                        {group.lot || ""}
                      </td>
                      <td className="border border-gray-800 px-1 py-1 text-center align-top">
                        {formatDate(group.expDate)}
                      </td>
                      <td className="border border-gray-800 px-1 py-1 text-center align-top font-mono text-[9px]">
                        {formatSerialRanges(group.serials)}
                      </td>
                      <td className="border border-gray-800 px-1 py-1 text-center align-top">
                        {group.totalQty}
                      </td>
                      <td className="border border-gray-800 px-1 py-1 text-center align-top">
                        {group.unit?.nameTh || ""}
                      </td>
                      <td className="border border-gray-800 px-1 py-1 align-top">
                        {outbound.remarks || ""}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
              <tfoot>
                <tr className="border border-gray-800">
                  <td
                    colSpan={8}
                    className="border border-gray-800 px-1 py-1 text-center font-bold "
                  >
                    **ทางบริษัทไม่รับเปลี่ยน/คืน สินค้าทุกกรณี**
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Inspection Instructions */}
          <div className="mb-2 text-[12px] leading-tight space-y-2">
            <p className=" text-center mt-6">***เมื่อได้รับสินค้าแล้ว กรุณาตรวจเช็คสินค้าว่ามีรายละเอียดและจ านวนตรงกับใบส่งสินค้าที่แนบมาด้วยหรือไม่***</p>
            <p className="font-bold underline">การตรวจเช็คสินค้า</p>
            <p>
              - ในกรณีมีแมสฯ ไปส่ง Grab Bike / Lalamove
              ให้ถ่ายรูปสินค้าที่ได้รับทั้งหมด พร้อมกับแมสฯ
              ที่ไปส่งว่าได้สินค้าครบหรือไม่
            </p>
            <p>
              - กรณีได้รับสินค้าเป็นพัสดุ Kerry / EMS จะต้องบันทึก VDO
              ขณะที่ทำการเปิดกล่อง
              และเช็คจำนวนสินค้าว่ามีครบตามที่ใบส่งสินค้าชั่วคราวระบุไว้หรือไม่
            </p>
          </div>

          <div className="mb-2 text-[12px] space-y-2 underline text-center pt-6">
            <p className="font-bold">
              ***หากได้รับสินค้าครบถ้วนสมบูรณ์กรุณาเซ็นรับสินค้าลงในใบส่งสินค้าชั่วคราวฉบับนี้
            </p>
            <p className="font-bold">
              แล้วถ่ายรูป / สแกน ส่งเอกสารกลับมาที่ผู้แทนที่ดูแล หรือส่งที่
              Admin ของบริษัทฯ***
            </p>
          </div>

          <div className="mb-2 text-[10px] text-center space-y-2">
            <p className=" font-bold text-[13px]">Admin E-mail : cs@edencolorsthailand.com / Line ID : araclar_arapeel / TEL. 02-1250142 082-2616624</p>
            <p className="pt-4">
              *** หากลูกค้าได้รับสินค้าแล้ว ไม่มีการแจ้งกลับมาที่บริษัทฯ ภายใน 7
              วัน ทางบริษัทฯ จะถือว่าลูกค้าได้รับสินค้าครบตามจำนวน
              ในใบส่งสินค้าชั่วคราวที่บริษัทฯ ได้แนบไปให้***
            </p>
          </div>

         

          {/* Signatures */}
          <div className="space-y-1.5  text-[10px] mt-14">
            <div className="flex justify-center gap-10 items-end ">
              
            
            <div className="flex gap-4 items-end">
              <div className="flex items-end gap-1">
                <span>ส่งโดย</span>
                <div className="border-b border-gray-800 text-center max-w-[150px]">
                  <span>{outbound.shippingMethod?.nameTh || ""}</span>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span>วันที่</span>
                <div className="border-b border-gray-800 text-center max-w-[100px]">
                  <span>
                    {formatDate(outbound.shippedAt || outbound.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex items-end gap-1">
                <span>ชื่อพนักงานขาย</span>
                <div className="border-b border-gray-800 text-center min-w-[150px]">
                  <span>{outbound.salesPersonName || ""}</span>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span>วันที่</span>
                <div className="border-b border-gray-800 text-center min-w-[100px]">
                  <span>
                    {formatDate(outbound.shippedAt || outbound.createdAt)}
                  </span>
                </div>
              </div>
            </div>
            </div>

            <div className="flex gap-4 items-baseline justify-center mt-12 ">
              <div className="flex items-baseline gap-1 ">
                <span>ได้รับสินค้าครบถ้วน ลงชื่อตัวบรรจง</span>
                <div className="flex-1 border-b border-gray-800 w-[200px]"></div>
              </div>
              <div>
                <span>ผู้รับสินค้า</span>
              </div>
            </div>

            <div className="flex items-baseline gap-1  justify-center pl-20 mt-4">
              <span>วันที่</span>
              <div className="border-b border-gray-800 min-w-[200px]"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Modal */}
      {showWarning && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-[var(--color-charcoal)]">
                  {locale === "th" ? "ไม่สามารถพิมพ์เอกสารได้" : "Cannot print document"}
                </h3>
                <p className="text-sm text-[var(--color-foreground-muted)] mt-1">
                  {locale === "th"
                    ? "ใบส่งสินค้านี้ยังไม่ได้รับการอนุมัติ กรุณารอการอนุมัติก่อนพิมพ์เอกสาร"
                    : "This outbound has not been approved yet. Please wait for approval before printing."}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowWarning(false)}
                className="px-5 py-2 bg-[var(--color-gold)] text-white rounded-xl font-medium hover:bg-[var(--color-gold-dark)] transition-colors"
              >
                {locale === "th" ? "รับทราบ" : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}

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

          /* Fix underline being too thick in PDF */
          .document-container .underline {
            text-decoration-thickness: 0.1px !important;
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
