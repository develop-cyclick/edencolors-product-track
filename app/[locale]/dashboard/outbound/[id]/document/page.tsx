'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface OutboundLine {
  id: number
  sku: string
  itemName: string
  modelSize: string | null
  quantity: number
  lot: string | null
  expDate: string | null
  itemStatus: string | null
  productItem: {
    id: number
    serial12: string
    status: string
    category: { id: number; nameTh: string; nameEn: string }
  }
  unit: { id: number; nameTh: string; nameEn: string }
}

interface OutboundHeader {
  id: number
  deliveryNoteNo: string
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  shippedAt: string | null
  approvedAt: string | null
  rejectReason: string | null
  salesPersonName: string | null
  companyContact: string | null
  clinicAddress: string | null
  clinicPhone: string | null
  clinicEmail: string | null
  clinicContactName: string | null
  poNo: string | null
  remarks: string | null
  warehouse: { id: number; name: string }
  shippingMethod: { id: number; nameTh: string; nameEn: string } | null
  clinic: { id: number; name: string; province: string; branchName: string | null } | null
  createdBy: { id: number; displayName: string; username: string }
  approvedBy: { id: number; displayName: string; username: string } | null
  lines: OutboundLine[]
}

export default function OutboundDocumentPage() {
  const params = useParams()
  const locale = params.locale as string
  const id = params.id as string

  const [outbound, setOutbound] = useState<OutboundHeader | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOutbound()
  }, [id])

  const fetchOutbound = async () => {
    try {
      const res = await fetch(`/api/warehouse/outbound/${id}`)
      const data = await res.json()
      if (data.success && data.data?.outbound) {
        setOutbound(data.data.outbound)
      }
    } catch (error) {
      console.error('Failed to fetch outbound:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatDateShort = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      DRAFT: 'แบบร่าง',
      PENDING: 'รออนุมัติ',
      APPROVED: 'อนุมัติแล้ว',
      REJECTED: 'ปฏิเสธ',
    }
    return statusMap[status] || status
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 relative">
          <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
          <div className="absolute inset-0 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  if (!outbound) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-foreground-muted)]">ไม่พบข้อมูล</p>
        <Link href={`/${locale}/dashboard/outbound`} className="text-[var(--color-gold)] mt-4 inline-block">
          กลับหน้ารายการ
        </Link>
      </div>
    )
  }

  return (
    <>
      {/* Action Bar - Hidden on print */}
      <div className="no-print mb-6 flex items-center justify-between">
        <Link
          href={`/${locale}/dashboard/outbound/${id}`}
          className="inline-flex items-center gap-2 text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          กลับหน้ารายละเอียด
        </Link>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-6 py-2.5 bg-[var(--color-gold)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          พิมพ์เอกสาร
        </button>
      </div>

      {/* Document */}
      <div className="document-container bg-white max-w-4xl mx-auto shadow-lg print:shadow-none print:max-w-none">
        <div className="p-8 print:p-6">
          {/* Header */}
          <div className="border-b-2 border-gray-800 pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">EDEN COLORS</h1>
                <p className="text-sm text-gray-600 mt-1">Medical Aesthetic Products</p>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-bold text-gray-800">ใบส่งสินค้า</h2>
                <p className="text-sm text-gray-600">Delivery Note</p>
                <div className="mt-2">
                  <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                    outbound.status === 'APPROVED'
                      ? 'bg-green-100 text-green-700'
                      : outbound.status === 'REJECTED'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {getStatusText(outbound.status)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Document Info */}
          <div className="grid grid-cols-2 gap-8 mb-6">
            <div>
              <table className="text-sm w-full">
                <tbody>
                  <tr>
                    <td className="py-1 text-gray-600 w-32">เลขที่เอกสาร:</td>
                    <td className="py-1 font-semibold text-gray-800">{outbound.deliveryNoteNo}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-gray-600">วันที่:</td>
                    <td className="py-1 font-semibold text-gray-800">{formatDate(outbound.createdAt)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-gray-600">คลังสินค้า:</td>
                    <td className="py-1 text-gray-800">{outbound.warehouse.name}</td>
                  </tr>
                  {outbound.poNo && (
                    <tr>
                      <td className="py-1 text-gray-600">เลขที่ PO:</td>
                      <td className="py-1 text-gray-800">{outbound.poNo}</td>
                    </tr>
                  )}
                  {outbound.shippingMethod && (
                    <tr>
                      <td className="py-1 text-gray-600">การจัดส่ง:</td>
                      <td className="py-1 text-gray-800">{outbound.shippingMethod.nameTh}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div>
              <div className="bg-gray-50 p-4 rounded border">
                <h3 className="font-semibold text-gray-800 mb-2 text-sm">ข้อมูลผู้รับ / Recipient</h3>
                {outbound.clinic ? (
                  <>
                    <p className="font-medium text-gray-800">{outbound.clinic.name}</p>
                    {outbound.clinic.branchName && (
                      <p className="text-sm text-gray-600">สาขา: {outbound.clinic.branchName}</p>
                    )}
                    <p className="text-sm text-gray-600">{outbound.clinic.province}</p>
                  </>
                ) : (
                  <p className="text-gray-500">-</p>
                )}
                {outbound.clinicAddress && (
                  <p className="text-sm text-gray-600 mt-1">{outbound.clinicAddress}</p>
                )}
                {outbound.clinicPhone && (
                  <p className="text-sm text-gray-600">โทร: {outbound.clinicPhone}</p>
                )}
                {outbound.clinicContactName && (
                  <p className="text-sm text-gray-600">ผู้ติดต่อ: {outbound.clinicContactName}</p>
                )}
                {outbound.clinicEmail && (
                  <p className="text-sm text-gray-600">อีเมล: {outbound.clinicEmail}</p>
                )}
              </div>
            </div>
          </div>

          {/* Sales Info */}
          {(outbound.salesPersonName || outbound.companyContact) && (
            <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="text-sm flex gap-6">
                {outbound.salesPersonName && (
                  <div>
                    <span className="text-gray-600">พนักงานขาย:</span>{' '}
                    <span className="font-medium text-gray-800">{outbound.salesPersonName}</span>
                  </div>
                )}
                {outbound.companyContact && (
                  <div>
                    <span className="text-gray-600">ผู้ติดต่อบริษัท:</span>{' '}
                    <span className="font-medium text-gray-800">{outbound.companyContact}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">รายการสินค้า</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-center w-12">ลำดับ</th>
                  <th className="border border-gray-300 px-3 py-2 text-left">Serial No.</th>
                  <th className="border border-gray-300 px-3 py-2 text-left">SKU</th>
                  <th className="border border-gray-300 px-3 py-2 text-left">รายการสินค้า</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">Lot</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">EXP</th>
                  <th className="border border-gray-300 px-3 py-2 text-center w-16">จำนวน</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">หน่วย</th>
                </tr>
              </thead>
              <tbody>
                {outbound.lines.map((line, index) => (
                  <tr key={line.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-300 px-3 py-2 text-center">{index + 1}</td>
                    <td className="border border-gray-300 px-3 py-2 font-mono text-xs">{line.productItem.serial12}</td>
                    <td className="border border-gray-300 px-3 py-2">{line.sku}</td>
                    <td className="border border-gray-300 px-3 py-2">
                      {line.itemName}
                      {line.modelSize && <span className="text-gray-500 text-xs ml-1">({line.modelSize})</span>}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center">{line.lot || '-'}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center text-xs">{formatDateShort(line.expDate)}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center">{line.quantity}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center">{line.unit?.nameTh || '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-semibold">
                  <td colSpan={6} className="border border-gray-300 px-3 py-2 text-right">รวมทั้งสิ้น:</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">{outbound.lines.length}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">รายการ</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Remarks */}
          {outbound.remarks && (
            <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm">
                <span className="font-semibold text-gray-700">หมายเหตุ:</span>{' '}
                <span className="text-gray-600">{outbound.remarks}</span>
              </p>
            </div>
          )}

          {/* Reject Reason */}
          {outbound.status === 'REJECTED' && outbound.rejectReason && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm">
                <span className="font-semibold text-red-700">เหตุผลที่ปฏิเสธ:</span>{' '}
                <span className="text-red-600">{outbound.rejectReason}</span>
              </p>
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-8 mt-10 pt-6 border-t">
            <div className="text-center">
              <div className="h-16 border-b border-gray-400 mb-2 flex items-end justify-center pb-1">
                <span className="text-sm text-gray-800">{outbound.createdBy.displayName}</span>
              </div>
              <p className="text-sm text-gray-600">ผู้จัดทำ</p>
              <p className="text-xs text-gray-400 mt-1">Prepared by</p>
              <p className="text-xs text-gray-500 mt-1">{formatDateShort(outbound.createdAt)}</p>
            </div>
            <div className="text-center">
              <div className="h-16 border-b border-gray-400 mb-2 flex items-end justify-center pb-1">
                {outbound.approvedBy && (
                  <span className="text-sm text-gray-800">{outbound.approvedBy.displayName}</span>
                )}
              </div>
              <p className="text-sm text-gray-600">ผู้อนุมัติ</p>
              <p className="text-xs text-gray-400 mt-1">Approved by</p>
              {outbound.approvedAt && (
                <p className="text-xs text-gray-500 mt-1">{formatDateShort(outbound.approvedAt)}</p>
              )}
            </div>
            <div className="text-center">
              <div className="h-16 border-b border-gray-400 mb-2"></div>
              <p className="text-sm text-gray-600">ผู้รับสินค้า</p>
              <p className="text-xs text-gray-400 mt-1">Received by</p>
              <p className="text-xs text-gray-500 mt-1">วันที่ ____/____/____</p>
            </div>
          </div>

          {/* Terms */}
          <div className="mt-6 p-3 bg-gray-50 rounded text-xs text-gray-500">
            <p className="font-medium text-gray-600 mb-1">เงื่อนไข / Terms:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>กรุณาตรวจสอบสินค้าก่อนลงนามรับ</li>
              <li>สินค้าที่ส่งมอบแล้วไม่สามารถเปลี่ยนหรือคืนได้ หากไม่มีความเสียหาย</li>
              <li>หากพบปัญหากรุณาแจ้งภายใน 7 วัน</li>
            </ul>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t text-center text-xs text-gray-400">
            <p>เอกสารนี้ออกโดยระบบ Eden Colors Inventory Management System</p>
            <p>พิมพ์เมื่อ: {new Date().toLocaleString('th-TH')}</p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .document-container {
            box-shadow: none !important;
            max-width: none !important;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>
    </>
  )
}
