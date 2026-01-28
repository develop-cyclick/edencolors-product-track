'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface OutboundLine {
  id: number
  quantity: number
  productItem: {
    id: number
    serial12: string
    sku: string
    name: string
    modelSize: string | null
    lot: string | null
    expDate: string | null
    status: string
    category: { id: number; nameTh: string; nameEn: string }
    qrTokens: { id: number; tokenVersion: number }[]
  }
  unit: { id: number; nameTh: string; nameEn: string }
}

interface OutboundHeader {
  id: number
  outboundNo: string
  deliveryNoteNo: string | null
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

export default function OutboundDetailPage() {
  const params = useParams()
  const router = useRouter()
  const locale = params.locale as string
  const id = params.id as string

  const [outbound, setOutbound] = useState<OutboundHeader | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [userRole, setUserRole] = useState<string | null>(null)
  const [printingItemId, setPrintingItemId] = useState<number | null>(null)

  const fetchOutbound = useCallback(async () => {
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
  }, [id])

  const fetchUserRole = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      if (data.success && data.data?.user) {
        setUserRole(data.data.user.role)
      }
    } catch (error) {
      console.error('Failed to fetch user role:', error)
    }
  }, [])

  useEffect(() => {
    fetchOutbound()
    fetchUserRole()
  }, [fetchOutbound, fetchUserRole])

  // Check if user can approve/reject (ADMIN or MANAGER only)
  const canApprove = userRole === 'ADMIN' || userRole === 'MANAGER'

  const handleApprove = async () => {
    if (!confirm(locale === 'th' ? 'ยืนยันการอนุมัติ?' : 'Confirm approval?')) return

    setActionLoading(true)
    try {
      const res = await fetch(`/api/warehouse/outbound/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      const data = await res.json()
      if (data.success) {
        fetchOutbound()
      } else {
        alert(data.error || 'Failed to approve')
      }
    } catch (error) {
      console.error('Failed to approve:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert(locale === 'th' ? 'กรุณาระบุเหตุผล' : 'Please provide a reason')
      return
    }

    setActionLoading(true)
    try {
      const res = await fetch(`/api/warehouse/outbound/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejectReason }),
      })
      const data = await res.json()
      if (data.success) {
        setShowRejectModal(false)
        setRejectReason('')
        fetchOutbound()
      } else {
        alert(data.error || 'Failed to reject')
      }
    } catch (error) {
      console.error('Failed to reject:', error)
    } finally {
      setActionLoading(false)
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
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; dot: string; label: string; labelEn: string }> = {
      DRAFT: { bg: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400', label: 'แบบร่าง', labelEn: 'Draft' },
      PENDING: { bg: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: 'รออนุมัติ', labelEn: 'Pending' },
      APPROVED: { bg: 'bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]', dot: 'bg-[var(--color-mint)]', label: 'อนุมัติแล้ว', labelEn: 'Approved' },
      REJECTED: { bg: 'bg-red-100 text-red-700', dot: 'bg-red-500', label: 'ปฏิเสธ', labelEn: 'Rejected' },
    }
    const badge = badges[status] || { bg: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400', label: status, labelEn: status }
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${badge.bg}`}>
        <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
        {locale === 'th' ? badge.label : badge.labelEn}
      </span>
    )
  }

  const getItemStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; dot: string; label: string; labelEn: string }> = {
      IN_STOCK: { bg: 'bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]', dot: 'bg-[var(--color-mint)]', label: 'ในคลัง', labelEn: 'In Stock' },
      PENDING_OUT: { bg: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: 'รอส่งออก', labelEn: 'Pending Out' },
      SHIPPED: { bg: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', label: 'ส่งออกแล้ว', labelEn: 'Shipped' },
      ACTIVATED: { bg: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500', label: 'เปิดใช้งานแล้ว', labelEn: 'Activated' },
      RETURNED: { bg: 'bg-red-100 text-red-700', dot: 'bg-red-500', label: 'คืนสินค้า', labelEn: 'Returned' },
    }
    const badge = badges[status] || { bg: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400', label: status, labelEn: status }
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg}`}>
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

  if (!outbound) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[var(--color-charcoal)]">
          {locale === 'th' ? 'ไม่พบข้อมูลการส่งออก' : 'Outbound not found'}
        </h2>
        <p className="text-[var(--color-foreground-muted)] mt-2">
          {locale === 'th' ? 'ไม่พบข้อมูลการส่งออกที่ต้องการ' : 'The requested outbound could not be found'}
        </p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] font-medium"
        >
          {locale === 'th' ? 'ย้อนกลับ' : 'Go Back'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-[var(--color-beige)]/50 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-display text-2xl font-bold text-[var(--color-charcoal)]">
                {outbound.outboundNo}
              </h1>
              {getStatusBadge(outbound.status)}
            </div>
            <p className="text-[var(--color-foreground-muted)] mt-1">
              {locale === 'th' ? 'รายละเอียดการส่งออกสินค้า' : 'Outbound Details'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {/* View Document Button */}
          <Link
            href={`/${locale}/dashboard/outbound/${id}/document`}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-[var(--color-charcoal)]/30 text-[var(--color-charcoal)] rounded-xl font-medium hover:bg-[var(--color-charcoal)]/5 transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {locale === 'th' ? 'ดูเอกสาร/พิมพ์' : 'View/Print Document'}
          </Link>
          {/* Export Excel Button */}
          <a
            href={`/api/warehouse/outbound/${id}/export`}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-[var(--color-gold)] text-[var(--color-gold)] rounded-xl font-medium hover:bg-[var(--color-gold)]/10 transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {locale === 'th' ? 'ส่งออก Excel' : 'Export Excel'}
          </a>
          {/* Approve/Reject - Only for ADMIN or MANAGER */}
          {outbound.status === 'PENDING' && canApprove && (
            <>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={actionLoading}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-xl font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {locale === 'th' ? 'ปฏิเสธ' : 'Reject'}
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-6 py-2 bg-[var(--color-mint)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(123,190,169,0.25)] hover:bg-[var(--color-mint-dark)] disabled:opacity-50 transition-all"
              >
                {actionLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {locale === 'th' ? 'กำลังดำเนินการ...' : 'Processing...'}
                  </span>
                ) : (
                  locale === 'th' ? 'อนุมัติ' : 'Approve'
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Reject Reason Alert */}
      {outbound.status === 'REJECTED' && outbound.rejectReason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-semibold text-red-700">
                {locale === 'th' ? 'เหตุผลที่ปฏิเสธ' : 'Rejection Reason'}
              </h3>
              <p className="text-red-600 mt-1">{outbound.rejectReason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outbound Info */}
        <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-6">
          <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-gold)]/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-[var(--color-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            {locale === 'th' ? 'ข้อมูลการส่งออก' : 'Outbound Info'}
          </h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'เลขที่ส่งออก' : 'Outbound No'}</dt>
              <dd className="font-medium text-[var(--color-charcoal)]">{outbound.outboundNo}</dd>
            </div>
            {outbound.deliveryNoteNo && (
              <div className="flex justify-between">
                <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'เลขที่ใบส่งสินค้า' : 'Delivery Note'}</dt>
                <dd className="font-medium text-[var(--color-charcoal)]">{outbound.deliveryNoteNo}</dd>
              </div>
            )}
            {outbound.poNo && (
              <div className="flex justify-between">
                <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'เลขที่ PO' : 'PO No'}</dt>
                <dd className="font-medium text-[var(--color-charcoal)]">{outbound.poNo}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'คลังสินค้า' : 'Warehouse'}</dt>
              <dd className="font-medium text-[var(--color-charcoal)]">{outbound.warehouse.name}</dd>
            </div>
            {outbound.shippingMethod && (
              <div className="flex justify-between">
                <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'วิธีการจัดส่ง' : 'Shipping Method'}</dt>
                <dd className="font-medium text-[var(--color-charcoal)]">
                  {locale === 'th' ? outbound.shippingMethod.nameTh : outbound.shippingMethod.nameEn}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'จำนวนรายการ' : 'Items'}</dt>
              <dd className="font-medium text-[var(--color-charcoal)]">{outbound.lines.length} {locale === 'th' ? 'รายการ' : 'items'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'วันที่สร้าง' : 'Created'}</dt>
              <dd className="font-medium text-[var(--color-charcoal)]">{formatDate(outbound.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'สร้างโดย' : 'Created By'}</dt>
              <dd className="font-medium text-[var(--color-charcoal)]">{outbound.createdBy.displayName}</dd>
            </div>
            {outbound.approvedBy && (
              <>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'อนุมัติโดย' : 'Approved By'}</dt>
                  <dd className="font-medium text-[var(--color-charcoal)]">{outbound.approvedBy.displayName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'วันที่อนุมัติ' : 'Approved At'}</dt>
                  <dd className="font-medium text-[var(--color-charcoal)]">{formatDate(outbound.approvedAt)}</dd>
                </div>
              </>
            )}
            {outbound.shippedAt && (
              <div className="flex justify-between">
                <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'วันที่ส่งออก' : 'Shipped At'}</dt>
                <dd className="font-medium text-[var(--color-charcoal)]">{formatDate(outbound.shippedAt)}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Clinic Info */}
        <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-6">
          <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-mint)]/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-[var(--color-mint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            {locale === 'th' ? 'ข้อมูลคลินิก' : 'Clinic Info'}
          </h2>
          {outbound.clinic ? (
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ชื่อคลินิก' : 'Clinic Name'}</dt>
                <dd className="font-medium text-[var(--color-charcoal)]">{outbound.clinic.name}</dd>
              </div>
              {outbound.clinic.branchName && (
                <div className="flex justify-between">
                  <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'สาขา' : 'Branch'}</dt>
                  <dd className="font-medium text-[var(--color-charcoal)]">{outbound.clinic.branchName}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'จังหวัด' : 'Province'}</dt>
                <dd className="font-medium text-[var(--color-charcoal)]">{outbound.clinic.province}</dd>
              </div>
              {outbound.clinicContactName && (
                <div className="flex justify-between">
                  <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ผู้ติดต่อ' : 'Contact'}</dt>
                  <dd className="font-medium text-[var(--color-charcoal)]">{outbound.clinicContactName}</dd>
                </div>
              )}
              {outbound.clinicPhone && (
                <div className="flex justify-between">
                  <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'เบอร์โทร' : 'Phone'}</dt>
                  <dd className="font-medium text-[var(--color-charcoal)]">{outbound.clinicPhone}</dd>
                </div>
              )}
              {outbound.clinicEmail && (
                <div className="flex justify-between">
                  <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'อีเมล' : 'Email'}</dt>
                  <dd className="font-medium text-[var(--color-charcoal)]">{outbound.clinicEmail}</dd>
                </div>
              )}
              {outbound.clinicAddress && (
                <div>
                  <dt className="text-[var(--color-foreground-muted)] mb-1">{locale === 'th' ? 'ที่อยู่' : 'Address'}</dt>
                  <dd className="font-medium text-[var(--color-charcoal)]">{outbound.clinicAddress}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-[var(--color-foreground-muted)]">
              {locale === 'th' ? 'ไม่มีข้อมูลคลินิก' : 'No clinic information'}
            </p>
          )}

          {/* Sales Info */}
          {(outbound.salesPersonName || outbound.companyContact) && (
            <div className="mt-6 pt-6 border-t border-[var(--color-beige)]">
              <h3 className="font-semibold text-[var(--color-charcoal)] mb-3">
                {locale === 'th' ? 'ข้อมูลฝ่ายขาย' : 'Sales Info'}
              </h3>
              <dl className="space-y-3">
                {outbound.salesPersonName && (
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'พนักงานขาย' : 'Sales Person'}</dt>
                    <dd className="font-medium text-[var(--color-charcoal)]">{outbound.salesPersonName}</dd>
                  </div>
                )}
                {outbound.companyContact && (
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ผู้ติดต่อบริษัท' : 'Company Contact'}</dt>
                    <dd className="font-medium text-[var(--color-charcoal)]">{outbound.companyContact}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Remarks */}
          {outbound.remarks && (
            <div className="mt-6 pt-6 border-t border-[var(--color-beige)]">
              <h3 className="font-semibold text-[var(--color-charcoal)] mb-2">
                {locale === 'th' ? 'หมายเหตุ' : 'Remarks'}
              </h3>
              <p className="text-[var(--color-foreground-muted)]">{outbound.remarks}</p>
            </div>
          )}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--color-beige)]">
          <h2 className="text-lg font-semibold text-[var(--color-charcoal)] flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-gold)]/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-[var(--color-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            {locale === 'th' ? 'รายการสินค้า' : 'Product Items'} ({outbound.lines.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">#</th>
                <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">Serial</th>
                <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">SKU</th>
                <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                  {locale === 'th' ? 'ชื่อสินค้า' : 'Name'}
                </th>
                <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                  {locale === 'th' ? 'รุ่น/ขนาด' : 'Model/Size'}
                </th>
                <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">Lot</th>
                <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">EXP</th>
                <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                  {locale === 'th' ? 'สถานะ' : 'Status'}
                </th>
                <th className="px-5 py-3 text-center text-sm font-semibold text-[var(--color-charcoal)]">
                  {locale === 'th' ? 'พิมพ์ QR' : 'Print QR'}
                </th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-beige)]">
              {outbound.lines.map((line, index) => (
                <tr key={line.id} className="hover:bg-[var(--color-off-white)]/50 transition-colors">
                  <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">{index + 1}</td>
                  <td className="px-5 py-4">
                    <span className="font-mono text-sm font-medium text-[var(--color-charcoal)]">
                      {line.productItem.serial12}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--color-charcoal)]">{line.productItem.sku}</td>
                  <td className="px-5 py-4 text-sm text-[var(--color-charcoal)]">{line.productItem.name}</td>
                  <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">
                    {line.productItem.modelSize || '-'}
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">
                    {line.productItem.lot || '-'}
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">
                    {line.productItem.expDate ? formatDate(line.productItem.expDate) : '-'}
                  </td>
                  <td className="px-5 py-4">
                    {getItemStatusBadge(line.productItem.status)}
                  </td>
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
                  <td className="px-5 py-4">
                    <Link
                      href={`/${locale}/dashboard/products/${line.productItem.id}`}
                      className="inline-flex items-center gap-1 text-sm text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] font-medium transition-colors"
                    >
                      {locale === 'th' ? 'ดู' : 'View'}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
              {locale === 'th' ? 'ปฏิเสธการส่งออก' : 'Reject Outbound'}
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-2">
                {locale === 'th' ? 'เหตุผลที่ปฏิเสธ' : 'Rejection Reason'}
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-[var(--color-beige)] rounded-xl focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)] transition-all bg-[var(--color-off-white)]"
                placeholder={locale === 'th' ? 'ระบุเหตุผล...' : 'Enter reason...'}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectReason('')
                }}
                disabled={actionLoading}
                className="px-4 py-2 text-[var(--color-foreground-muted)] hover:text-[var(--color-charcoal)] font-medium transition-colors"
              >
                {locale === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectReason.trim()}
                className="px-6 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {locale === 'th' ? 'กำลังดำเนินการ...' : 'Processing...'}
                  </span>
                ) : (
                  locale === 'th' ? 'ยืนยันปฏิเสธ' : 'Confirm Reject'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
