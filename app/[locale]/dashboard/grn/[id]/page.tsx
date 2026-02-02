'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface GRNDetail {
  id: number
  grnNo: string
  receivedAt: string
  poNo: string | null
  supplierName: string
  deliveryNoteNo: string | null
  supplierAddress: string | null
  supplierPhone: string | null
  supplierContact: string | null
  deliveryDocDate: string | null
  approvedAt: string | null
  remarks: string | null
  warehouse: { id: number; name: string }
  receivedBy: { id: number; displayName: string; username: string }
  approvedBy: { id: number; displayName: string; username: string } | null
  lines: Array<{
    id: number
    sku: string
    itemName: string
    modelSize: string | null
    quantity: number
    lot: string | null
    mfgDate: string | null
    expDate: string | null
    inspectionStatus: string
    remarks: string | null
    unit: { id: number; nameTh: string }
    productItem: {
      id: number
      serial12: string
      status: string
      category: { id: number; nameTh: string }
      qrTokens: Array<{ id: number; tokenVersion: number }>
    }
  }>
}

export default function GRNDetailPage() {
  const params = useParams()
  const locale = params.locale as string
  const id = params.id as string

  const [grn, setGrn] = useState<GRNDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [printingGrid, setPrintingGrid] = useState(false)
  const [printingItemId, setPrintingItemId] = useState<number | null>(null)
  const [showPrintGuide, setShowPrintGuide] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  // Check if user can approve (ADMIN or MANAGER only)
  const canApprove = userRole === 'ADMIN' || userRole === 'MANAGER'

  useEffect(() => {
    fetchGRN()
    fetchUserRole()
  }, [id])

  const fetchUserRole = async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      if (data.success && data.data?.user) {
        setUserRole(data.data.user.role)
      }
    } catch (error) {
      console.error('Failed to fetch user role:', error)
    }
  }

  const fetchGRN = async () => {
    try {
      const res = await fetch(`/api/warehouse/grn/${id}`)
      const data = await res.json()
      if (data.success && data.data?.grn) {
        setGrn(data.data.grn)
      }
    } catch (error) {
      console.error('Failed to fetch GRN:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!confirm(locale === 'th' ? 'ยืนยันอนุมัติใบรับสินค้านี้?' : 'Confirm approve this GRN?')) return

    try {
      const res = await fetch(`/api/warehouse/grn/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      const data = await res.json()
      if (data.success) {
        alert(locale === 'th' ? 'อนุมัติสำเร็จ' : 'Approved successfully')
        fetchGRN()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch {
      alert('Failed to approve')
    }
  }

  const handlePrintLabels = async () => {
    setPrinting(true)
    try {
      const res = await fetch('/api/warehouse/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grnId: parseInt(id) }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(`Error: ${data.error || 'Failed to generate labels'}`)
        return
      }

      // Download the PDF
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `labels-${grn?.grnNo || id}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      // Show print guidance
      setShowPrintGuide(true)
    } catch {
      alert(locale === 'th' ? 'เกิดข้อผิดพลาดในการสร้าง PDF' : 'Failed to generate PDF')
    } finally {
      setPrinting(false)
    }
  }

  const handlePrintGridLabels = async () => {
    setPrintingGrid(true)
    try {
      const res = await fetch('/api/warehouse/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grnId: parseInt(id), layout: 'grid' }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(`Error: ${data.error || 'Failed to generate labels'}`)
        return
      }

      // Download the PDF
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `labels-grid-${grn?.grnNo || id}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch {
      alert(locale === 'th' ? 'เกิดข้อผิดพลาดในการสร้าง PDF' : 'Failed to generate PDF')
    } finally {
      setPrintingGrid(false)
    }
  }

  const handlePrintSingleLabel = async (productItemId: number, serial: string) => {
    setPrintingItemId(productItemId)
    try {
      const res = await fetch('/api/warehouse/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productItemIds: [productItemId], layout: 'grid' }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(`Error: ${data.error || 'Failed to generate label'}`)
        return
      }

      // Download the PDF
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `label-${serial}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch {
      alert(locale === 'th' ? 'เกิดข้อผิดพลาดในการสร้าง PDF' : 'Failed to generate PDF')
    } finally {
      setPrintingItemId(null)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; dot: string; label: string; labelEn: string }> = {
      IN_STOCK: { bg: 'bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]', dot: 'bg-[var(--color-mint)]', label: 'ในคลัง', labelEn: 'In Stock' },
      PENDING_OUT: { bg: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: 'รอส่งออก', labelEn: 'Pending Out' },
      SHIPPED: { bg: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', label: 'ส่งออกแล้ว', labelEn: 'Shipped' },
      ACTIVATED: { bg: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500', label: 'เปิดใช้งานแล้ว', labelEn: 'Activated' },
      RETURNED: { bg: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', label: 'คืนสินค้า', labelEn: 'Returned' },
      DAMAGED: { bg: 'bg-red-100 text-red-700', dot: 'bg-red-500', label: 'เสียหาย', labelEn: 'Damaged' },
    }
    const badge = badges[status] || { bg: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400', label: status, labelEn: status }
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${badge.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
        {locale === 'th' ? badge.label : badge.labelEn}
      </span>
    )
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

  if (!grn) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-beige)]/50 flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-[var(--color-foreground-muted)] mb-4">{locale === 'th' ? 'ไม่พบข้อมูล' : 'Not found'}</p>
        <Link
          href={`/${locale}/dashboard/grn`}
          className="inline-flex items-center gap-1 text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {locale === 'th' ? 'กลับหน้ารายการ' : 'Back to list'}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <Link
            href={`/${locale}/dashboard/grn`}
            className="inline-flex items-center gap-1 text-sm text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] font-medium transition-colors mb-3"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {locale === 'th' ? 'กลับหน้ารายการ' : 'Back to list'}
          </Link>
          <h1 className="text-display text-2xl font-bold text-[var(--color-charcoal)]">{grn.grnNo}</h1>
          <div className="flex items-center gap-3 mt-2">
            {grn.approvedAt ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-mint)]" />
                {locale === 'th' ? 'อนุมัติแล้ว' : 'Approved'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {locale === 'th' ? 'รออนุมัติ' : 'Pending'}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {/* Edit Button - Only show when pending approval */}
          {!grn.approvedAt && (
            <Link
              href={`/${locale}/dashboard/grn/new?editId=${id}`}
              className="flex items-center gap-2 px-4 py-2.5 border-2 border-[var(--color-gold)] text-[var(--color-gold)] rounded-xl font-medium hover:bg-[var(--color-gold)]/10 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {locale === 'th' ? 'แก้ไข' : 'Edit'}
            </Link>
          )}
          {/* View Document Button */}
          {/* <Link
            href={`/${locale}/dashboard/grn/${id}/document`}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-[var(--color-charcoal)]/30 text-[var(--color-charcoal)] rounded-xl font-medium hover:bg-[var(--color-charcoal)]/5 transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {locale === 'th' ? 'ดูเอกสาร/พิมพ์' : 'View/Print Document'}
          </Link> */}
          {/* Export Excel Button */}
          {/* <a
            href={`/api/warehouse/grn/${id}/export`}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-[var(--color-gold)] text-[var(--color-gold)] rounded-xl font-medium hover:bg-[var(--color-gold)]/10 transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {locale === 'th' ? 'ส่งออก Excel' : 'Export Excel'}
          </a> */}
          {/* Grid Print Button (A4 with 8 columns) */}
          <button
            onClick={handlePrintGridLabels}
            disabled={printingGrid}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-gold)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(201,163,90,0.35)] disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-200"
          >
            {printingGrid ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {locale === 'th' ? 'กำลังสร้าง...' : 'Generating...'}
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                {locale === 'th' ? 'พิมพ์ QR แบบรวม' : 'Print All QR '}
              </>
            )}
          </button>
          {/* Individual Print Button (4x6 inch) */}
          {/* <button
            onClick={handlePrintLabels}
            disabled={printing}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-charcoal)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(30,30,30,0.2)] hover:bg-[var(--color-charcoal)]/90 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(30,30,30,0.3)] disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-200"
          >
            {printing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {locale === 'th' ? 'กำลังสร้าง...' : 'Generating...'}
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                {locale === 'th' ? 'พิมพ์ QR 4x6"' : 'Print QR 4x6"'}
              </>
            )}
          </button> */}
          {/* {!grn.approvedAt && canApprove && (
            <button
              onClick={handleApprove}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-mint)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(115,207,199,0.3)] hover:bg-[var(--color-mint-dark)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(115,207,199,0.4)] transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {locale === 'th' ? 'อนุมัติ' : 'Approve'}
            </button>
          )} */}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Info */}
        <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-6">
          <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-5">
            {locale === 'th' ? 'ข้อมูลทั่วไป' : 'General Information'}
          </h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-[var(--color-foreground-muted)]">GRN No.</dt>
              <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{grn.grnNo}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'วันที่รับ' : 'Received Date'}</dt>
              <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{formatDate(grn.receivedAt)}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'คลังสินค้า' : 'Warehouse'}</dt>
              <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{grn.warehouse.name}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-foreground-muted)]">PO No.</dt>
              <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{grn.poNo || '-'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ผู้ตรวจรับ' : 'Received By'}</dt>
              <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{grn.receivedBy.displayName}</dd>
            </div>
            {grn.approvedAt && (
              <>
                <div>
                  <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ผู้อนุมัติ' : 'Approved By'}</dt>
                  <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{grn.approvedBy?.displayName || '-'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'วันที่อนุมัติ' : 'Approved Date'}</dt>
                  <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{formatDate(grn.approvedAt)}</dd>
                </div>
              </>
            )}
          </dl>
        </div>

        {/* Supplier Info */}
        <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-6">
          <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-5">
            {locale === 'th' ? 'ข้อมูลผู้จัดส่ง' : 'Supplier Information'}
          </h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div className="col-span-2">
              <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ชื่อผู้ขาย' : 'Supplier Name'}</dt>
              <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{grn.supplierName}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-foreground-muted)]">Delivery Note No.</dt>
              <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{grn.deliveryNoteNo || '-'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'วันที่เอกสาร' : 'Doc Date'}</dt>
              <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{formatDate(grn.deliveryDocDate)}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'เบอร์โทร' : 'Phone'}</dt>
              <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{grn.supplierPhone || '-'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ผู้ติดต่อ' : 'Contact'}</dt>
              <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{grn.supplierContact || '-'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ที่อยู่' : 'Address'}</dt>
              <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{grn.supplierAddress || '-'}</dd>
            </div>
            {grn.remarks && (
              <div className="col-span-2">
                <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'หมายเหตุ' : 'Remarks'}</dt>
                <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{grn.remarks}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Lines Table */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
        <div className="p-5 border-b border-[var(--color-beige)] bg-[var(--color-off-white)]">
          <h2 className="text-lg font-semibold text-[var(--color-charcoal)]">
            {locale === 'th' ? 'รายการสินค้า' : 'Line Items'} ({grn.lines.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">#</th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">Serial</th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">SKU</th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                  {locale === 'th' ? 'ชื่อสินค้า' : 'Item Name'}
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                  {locale === 'th' ? 'หมวดหมู่' : 'Category'}
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">Lot</th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">EXP</th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                  {locale === 'th' ? 'สถานะ' : 'Status'}
                </th>
                <th className="px-5 py-4 text-center text-sm font-semibold text-[var(--color-charcoal)]">
                  {locale === 'th' ? 'พิมพ์ QR' : 'Print QR'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-beige)]">
              {grn.lines.map((line, index) => (
                <tr key={line.id} className="hover:bg-[var(--color-off-white)]/50 transition-colors">
                  <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">{index + 1}</td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/${locale}/dashboard/products/${line.productItem.id}`}
                      className="font-mono text-sm font-medium text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] transition-colors"
                    >
                      {line.productItem.serial12}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--color-charcoal)]">{line.sku}</td>
                  <td className="px-5 py-4 text-sm text-[var(--color-charcoal)]">{line.itemName}</td>
                  <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">{line.productItem.category.nameTh}</td>
                  <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">{line.lot || '-'}</td>
                  <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">{formatDate(line.expDate)}</td>
                  <td className="px-5 py-4">{getStatusBadge(line.productItem.status)}</td>
                  <td className="px-5 py-4 text-center">
                    <button
                      onClick={() => handlePrintSingleLabel(line.productItem.id, line.productItem.serial12)}
                      disabled={printingItemId === line.productItem.id}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--color-off-white)] text-[var(--color-charcoal)] hover:bg-[var(--color-gold)] hover:text-white disabled:opacity-50 transition-all duration-200"
                      title={locale === 'th' ? 'พิมพ์ QR Label' : 'Print QR Label'}
                    >
                      {printingItemId === line.productItem.id ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print Guidance Modal */}
      {showPrintGuide && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-[var(--shadow-lg)] max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-gold)]/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-[var(--color-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'คำแนะนำการพิมพ์' : 'Print Guidance'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowPrintGuide(false)}
                  className="w-8 h-8 rounded-full bg-[var(--color-off-white)] flex items-center justify-center text-[var(--color-foreground-muted)] hover:text-[var(--color-charcoal)] hover:bg-[var(--color-beige)] transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-5">
                {/* Label Size Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-blue-900">
                        {locale === 'th' ? 'ขนาด Label: 4 x 6 นิ้ว' : 'Label Size: 4 x 6 inches'}
                      </p>
                      <p className="text-sm text-blue-700">101.6 x 152.4 mm</p>
                    </div>
                  </div>
                </div>

                {/* Print Steps */}
                <div>
                  <h4 className="font-medium text-[var(--color-charcoal)] mb-3">
                    {locale === 'th' ? 'ขั้นตอนการพิมพ์' : 'Printing Steps'}
                  </h4>
                  <ol className="space-y-3 text-sm">
                    {[
                      locale === 'th' ? 'เปิดไฟล์ PDF ที่ดาวน์โหลดมา' : 'Open the downloaded PDF file',
                      locale === 'th' ? 'เลือก Print (Ctrl+P หรือ Cmd+P)' : 'Select Print (Ctrl+P or Cmd+P)',
                      locale === 'th' ? 'ตั้งค่า Scale เป็น "Actual Size" หรือ "100%"' : 'Set Scale to "Actual Size" or "100%"',
                      locale === 'th' ? 'เลือกขนาดกระดาษ 4x6 นิ้ว (หรือ Custom Size)' : 'Select paper size 4x6 inches (or Custom Size)',
                      locale === 'th' ? 'กด Print' : 'Click Print',
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-[var(--color-gold)]/10 rounded-full flex items-center justify-center text-[var(--color-gold)] font-medium text-xs">
                          {i + 1}
                        </span>
                        <span className={`text-[var(--color-charcoal)] ${i === 2 ? 'font-medium' : ''}`}>
                          {i === 2 && <span className="text-red-600">{locale === 'th' ? 'สำคัญ: ' : 'Important: '}</span>}
                          {step}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Warning */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center mt-0.5">
                      <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-amber-800">
                        {locale === 'th' ? 'ห้ามใช้ "Fit to Page"' : 'Do NOT use "Fit to Page"'}
                      </p>
                      <p className="text-sm text-amber-700 mt-1">
                        {locale === 'th' ? 'การย่อ/ขยายภาพจะทำให้ QR Code อ่านไม่ได้' : 'Scaling will make QR codes unreadable'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tips */}
                <div className="bg-[var(--color-off-white)] rounded-xl p-4">
                  <h5 className="font-medium text-[var(--color-charcoal)] mb-2">
                    {locale === 'th' ? 'เคล็ดลับ' : 'Tips'}
                  </h5>
                  <ul className="text-sm text-[var(--color-foreground-muted)] space-y-1">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-mint)]" />
                      {locale === 'th' ? 'ใช้กระดาษสติกเกอร์ขนาด 4x6 นิ้ว' : 'Use 4x6 inch sticker paper'}
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-mint)]" />
                      {locale === 'th' ? 'ทดสอบสแกน QR ก่อนติดลงบนสินค้า' : 'Test scan QR before applying to products'}
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-mint)]" />
                      {locale === 'th' ? 'ติด Label ในที่ที่สแกนได้ง่าย' : 'Apply labels in easily scannable locations'}
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => setShowPrintGuide(false)}
                  className="w-full px-4 py-3 bg-[var(--color-gold)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(201,163,90,0.35)] transition-all duration-200"
                >
                  {locale === 'th' ? 'เข้าใจแล้ว' : 'Got it'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
