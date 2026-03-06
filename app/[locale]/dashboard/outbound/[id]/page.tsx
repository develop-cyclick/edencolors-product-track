'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useConfirm, useAlert } from '@/components/ui/confirm-modal'

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

interface POLine {
  id: number
  quantity: number
  shippedQuantity: number
  productMaster: { id: number; sku: string; nameTh: string; nameEn: string | null; modelSize: string | null }
}

interface POOutbound {
  id: number
  deliveryNoteNo: string
  status: string
  createdAt: string
  shippedAt: string | null
  createdBy: { id: number; displayName: string }
  _count: { lines: number }
}

interface POSummary {
  id: number
  poNo: string
  status: string
  totalOrdered: number
  totalShipped: number
  totalRemaining: number
  isPartial: boolean
  isComplete: boolean
  lines: POLine[]
  outbounds: POOutbound[]
}

interface OutboundHeader {
  id: number
  outboundNo: string
  deliveryNoteNo: string | null
  contractNo: string | null
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
  remarks: string | null
  purchaseOrder: POSummary | null
  warehouse: { id: number; name: string }
  shippingMethod: { id: number; nameTh: string; nameEn: string } | null
  clinic: { id: number; name: string; address: string; branchName: string | null } | null
  createdBy: { id: number; displayName: string; username: string }
  approvedBy: { id: number; displayName: string; username: string } | null
  lines: OutboundLine[]
}

export default function OutboundDetailPage() {
  const params = useParams()
  const router = useRouter()
  const locale = params.locale as string
  const id = params.id as string
  const confirm = useConfirm()
  const alert = useAlert()

  const [outbound, setOutbound] = useState<OutboundHeader | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [userRole, setUserRole] = useState<string | null>(null)
  const [printingItemId, setPrintingItemId] = useState<number | null>(null)

  // Damage states
  const [showDamageModal, setShowDamageModal] = useState(false)
  const [selectedLine, setSelectedLine] = useState<OutboundLine | null>(null)
  const [damageReason, setDamageReason] = useState('')
  const [damageNote, setDamageNote] = useState('')
  const [damageLoading, setDamageLoading] = useState(false)

  // Replacement states
  const [wantReplacement, setWantReplacement] = useState(false)
  const [replacementItems, setReplacementItems] = useState<Array<{
    id: number
    serial12: string
    sku: string
    name: string
    modelSize: string | null
    lot: string | null
    expDate: string | null
  }>>([])
  const [selectedReplacement, setSelectedReplacement] = useState<number | null>(null)
  const [loadingReplacements, setLoadingReplacements] = useState(false)

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
    const confirmed = await confirm({
      title: locale === 'th' ? 'อนุมัติการส่งออก' : 'Approve Outbound',
      message: locale === 'th' ? 'ยืนยันการอนุมัติ?' : 'Confirm approval?',
      confirmText: locale === 'th' ? 'อนุมัติ' : 'Approve',
      cancelText: locale === 'th' ? 'ยกเลิก' : 'Cancel',
      variant: 'info',
      icon: 'success',
    })
    if (!confirmed) return

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
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: data.error || 'Failed to approve', variant: 'error', icon: 'error' })
      }
    } catch (error) {
      console.error('Failed to approve:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'กรุณาระบุเหตุผล' : 'Please provide a reason', variant: 'warning', icon: 'warning' })
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
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: data.error || 'Failed to reject', variant: 'error', icon: 'error' })
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
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: `Error: ${data.error || 'Failed to generate label'}`, variant: 'error', icon: 'error' })
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
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'เกิดข้อผิดพลาดในการสร้าง PDF' : 'Failed to generate PDF', variant: 'error', icon: 'error' })
    } finally {
      setPrintingItemId(null)
    }
  }

  const handleMarkDamaged = async () => {
    if (!selectedLine || !damageReason.trim()) {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'กรุณาระบุสาเหตุความเสียหาย' : 'Please provide damage reason', variant: 'warning', icon: 'warning' })
      return
    }

    if (wantReplacement && !selectedReplacement) {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'กรุณาเลือกสินค้าทดแทน' : 'Please select a replacement product', variant: 'warning', icon: 'warning' })
      return
    }

    setDamageLoading(true)
    try {
      const res = await fetch('/api/warehouse/damaged', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productItemIds: [selectedLine.productItem.id],
          reason: damageReason,
          note: damageNote,
          outboundLineId: selectedLine.id,
          replacementItemId: wantReplacement ? selectedReplacement : undefined,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setShowDamageModal(false)
        setSelectedLine(null)
        setDamageReason('')
        setDamageNote('')
        setWantReplacement(false)
        setReplacementItems([])
        setSelectedReplacement(null)
        fetchOutbound()
        window.dispatchEvent(new Event('badges:refresh'))
        const message = wantReplacement
          ? (locale === 'th' ? 'บันทึกสินค้าเสียหายและเปลี่ยนสินค้าทดแทนเรียบร้อย' : 'Product marked as damaged and replaced')
          : (locale === 'th' ? 'บันทึกสินค้าเสียหายเรียบร้อย' : 'Product marked as damaged')
        await alert({ title: locale === 'th' ? 'สำเร็จ' : 'Success', message, variant: 'success', icon: 'success' })
      } else {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: data.message || 'Error marking as damaged', variant: 'error', icon: 'error' })
      }
    } catch (error) {
      console.error('Failed to mark as damaged:', error)
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'An error occurred', variant: 'error', icon: 'error' })
    } finally {
      setDamageLoading(false)
    }
  }

  const openDamageModal = (line: OutboundLine) => {
    setSelectedLine(line)
    setDamageReason('')
    setDamageNote('')
    setWantReplacement(false)
    setReplacementItems([])
    setSelectedReplacement(null)
    setShowDamageModal(true)
  }

  const fetchReplacementItems = async (sku: string, excludeItemId: number) => {
    setLoadingReplacements(true)
    try {
      const res = await fetch(`/api/warehouse/products/available?sku=${encodeURIComponent(sku)}&excludeId=${excludeItemId}`)
      const data = await res.json()
      if (data.success && data.data?.items) {
        setReplacementItems(data.data.items)
      }
    } catch (error) {
      console.error('Failed to fetch replacement items:', error)
    } finally {
      setLoadingReplacements(false)
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
      IN_STOCK: { bg: 'bg-[var(--color-mint)]/10 text-[var(--color-gold)]', dot: 'bg-[var(--color-gold)]', label: 'ในคลัง', labelEn: 'In Stock' },
      PENDING_OUT: { bg: 'bg-[var(--color-mint)]/10 text-[var(--color-gold)]', dot: 'bg-[var(--color-gold)]', label: 'รอส่งออก', labelEn: 'Pending Out' },
      SHIPPED: { bg: 'bg-[var(--color-mint)]/10 text-[var(--color-gold)]', dot: 'bg-[var(--color-gold)]', label: 'ส่งออกแล้ว', labelEn: 'Shipped' },
      ACTIVATED: { bg: 'bg-[var(--color-mint)]/10 text-[var(--color-gold)]', dot: 'bg-[var(--color-gold)]', label: 'เปิดใช้งานแล้ว', labelEn: 'Activated' },
      RETURNED: { bg: 'bg-[var(--color-mint)]/10 text-[var(--color-gold)]', dot: 'bg-[var(--color-gold)]', label: 'รับคืนสินค้า', labelEn: 'Returned' },
      DAMAGED: { bg: 'bg-[var(--color-mint)]/10 text-[var(--color-gold)]', dot: 'bg-[var(--color-gold)]', label: 'เสียหาย', labelEn: 'Damaged' },
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
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-display text-2xl font-bold text-[var(--color-charcoal)]">
                {outbound.outboundNo}
              </h1>
              {getStatusBadge(outbound.status)}
              {outbound.purchaseOrder && (
                outbound.purchaseOrder.isComplete ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    {locale === 'th' ? 'ส่งครบแล้ว' : 'Fully Shipped'}
                  </span>
                ) : outbound.purchaseOrder.isPartial ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    {locale === 'th' ? 'ส่งบางส่วน' : 'Partial'}
                  </span>
                ) : null
              )}
            </div>
            <p className="text-[var(--color-foreground-muted)] mt-1">
              {locale === 'th' ? 'รายละเอียดการส่งออกสินค้า' : 'Outbound Details'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {/* Edit Button - Only show when pending approval */}
          {outbound.status === 'PENDING' && (
            <Link
              href={`/${locale}/dashboard/outbound/new?editId=${id}`}
              className="flex items-center gap-2 px-4 py-2.5 border-2 border-[var(--color-gold)] text-[var(--color-gold)] rounded-xl font-medium hover:bg-[var(--color-gold)]/10 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {locale === 'th' ? 'แก้ไข' : 'Edit'}
            </Link>
          )}
          {/* Ship More Button - Only when approved + PO partial */}
          {outbound.status === 'APPROVED' && outbound.purchaseOrder && !outbound.purchaseOrder.isComplete && outbound.purchaseOrder.totalRemaining > 0 && (
            <Link
              href={`/${locale}/dashboard/outbound/new?clinicId=${outbound.clinic?.id}&poId=${outbound.purchaseOrder.id}`}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(249,115,22,0.25)] hover:bg-orange-600 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(249,115,22,0.35)] transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {locale === 'th' ? 'สร้างใบส่งเพิ่ม' : 'Ship More'}
            </Link>
          )}
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
          {/*<a
            href={`/api/warehouse/outbound/${id}/export`}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-[var(--color-gold)] text-[var(--color-gold)] rounded-xl font-medium hover:bg-[var(--color-gold)]/10 transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {locale === 'th' ? 'ส่งออก Excel' : 'Export Excel'}
          </a>*/}
          {/* Approve/Reject - Only for ADMIN or MANAGER */}
          {/* {outbound.status === 'PENDING' && canApprove && (
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
          )} */}
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
                <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'เลขที่ใบส่งสินค้า (IV No.)' : 'Delivery Note (IV No.)'}</dt>
                <dd className="font-medium text-[var(--color-charcoal)]">{outbound.deliveryNoteNo}</dd>
              </div>
            )}
            {outbound.contractNo && (
              <div className="flex justify-between">
                <dt className="text-[var(--color-foreground-muted)]">Contract No.</dt>
                <dd className="font-medium text-[var(--color-charcoal)]">{outbound.contractNo}</dd>
              </div>
            )}
            {outbound.purchaseOrder && (
              <div className="flex justify-between">
                <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'เลขที่ PO' : 'PO No'}</dt>
                <dd className="font-medium text-[var(--color-charcoal)]">
                  <Link href={`/${locale}/dashboard/orders/${outbound.purchaseOrder.id}`} className="text-[var(--color-gold)] hover:underline">
                    {outbound.purchaseOrder.poNo}
                  </Link>
                </dd>
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
                <dd className="font-medium text-[var(--color-charcoal)]">{outbound.clinic.address}</dd>
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

      {/* PO Shipping Plan Summary */}
      {outbound.purchaseOrder && outbound.purchaseOrder.lines.length > 0 && (
        <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
          <div className="p-5 border-b border-[var(--color-beige)] bg-[var(--color-off-white)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--color-charcoal)]">
                {locale === 'th' ? 'สรุปแผนการจัดส่ง' : 'Shipping Plan Summary'}
              </h2>
              <span className="font-mono text-sm text-[var(--color-gold)]">{outbound.purchaseOrder.poNo}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                  <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'สินค้า (SKU)' : 'Product (SKU)'}
                  </th>
                  <th className="px-5 py-3 text-center text-sm font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'สั่งทั้งหมด' : 'Ordered'}
                  </th>
                  <th className="px-5 py-3 text-center text-sm font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'ส่งแล้ว' : 'Shipped'}
                  </th>
                  <th className="px-5 py-3 text-center text-sm font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'คงเหลือ' : 'Remaining'}
                  </th>
                  <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]" style={{ minWidth: 120 }}>
                    {locale === 'th' ? 'ความคืบหน้า' : 'Progress'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-beige)]">
                {outbound.purchaseOrder.lines.map((pl) => {
                  const pct = pl.quantity > 0 ? Math.round((pl.shippedQuantity / pl.quantity) * 100) : 0
                  const remaining = pl.quantity - pl.shippedQuantity
                  return (
                    <tr key={pl.id} className="hover:bg-[var(--color-off-white)]/50 transition-colors">
                      <td className="px-5 py-3 text-sm">
                        <div className="font-medium text-[var(--color-charcoal)]">{locale === 'th' ? pl.productMaster.nameTh : (pl.productMaster.nameEn || pl.productMaster.nameTh)}</div>
                        <div className="text-xs text-[var(--color-foreground-muted)]">{pl.productMaster.sku}{pl.productMaster.modelSize ? ` (${pl.productMaster.modelSize})` : ''}</div>
                      </td>
                      <td className="px-5 py-3 text-sm text-center font-medium text-[var(--color-charcoal)]">{pl.quantity}</td>
                      <td className="px-5 py-3 text-sm text-center font-medium text-[var(--color-mint-dark)]">{pl.shippedQuantity}</td>
                      <td className="px-5 py-3 text-sm text-center font-medium">
                        <span className={remaining > 0 ? 'text-orange-600' : 'text-[var(--color-mint-dark)]'}>
                          {remaining}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-[var(--color-beige)] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-[var(--color-mint)]' : 'bg-orange-400'}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-[var(--color-foreground-muted)] w-10 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Outbound Timeline from PO */}
      {outbound.purchaseOrder && outbound.purchaseOrder.outbounds.length > 0 && (
        <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-6">
          <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-5">
            {locale === 'th' ? 'ประวัติการจัดส่ง (PO นี้)' : 'Shipping History (this PO)'}
          </h2>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-[var(--color-beige)]" />

            <div className="space-y-6">
              {outbound.purchaseOrder.outbounds.map((ob, idx) => {
                const isCurrent = ob.id === outbound.id
                const statusBadges: Record<string, { bg: string; dot: string; label: string; labelEn: string }> = {
                  DRAFT: { bg: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400', label: 'ฉบับร่าง', labelEn: 'Draft' },
                  PENDING: { bg: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: 'รออนุมัติ', labelEn: 'Pending' },
                  APPROVED: { bg: 'bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]', dot: 'bg-[var(--color-mint)]', label: 'อนุมัติแล้ว', labelEn: 'Approved' },
                  REJECTED: { bg: 'bg-red-100 text-red-700', dot: 'bg-red-500', label: 'ปฏิเสธ', labelEn: 'Rejected' },
                }
                const badge = statusBadges[ob.status] || statusBadges.DRAFT
                return (
                  <div key={ob.id} className="relative pl-12">
                    {/* Dot */}
                    <div className={`absolute left-2.5 top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm ${isCurrent ? 'bg-[var(--color-gold)]' : 'bg-[var(--color-beige)]'}`} />

                    <div className={`${isCurrent ? 'bg-[var(--color-gold)]/5 border border-[var(--color-gold)]/20 rounded-xl p-3 -ml-1' : ''}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[var(--color-charcoal)]">
                          {locale === 'th' ? `ครั้งที่ ${idx + 1}` : `Shipment ${idx + 1}`}
                        </span>
                        {isCurrent ? (
                          <Link
                            href={`/${locale}/dashboard/outbound/${ob.id}`}
                            className="font-mono text-xs text-[var(--color-gold)] font-medium"
                          >
                            {ob.deliveryNoteNo} ({locale === 'th' ? 'ใบนี้' : 'Current'})
                          </Link>
                        ) : (
                          <Link
                            href={`/${locale}/dashboard/outbound/${ob.id}`}
                            className="font-mono text-xs text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] hover:underline transition-colors"
                          >
                            {ob.deliveryNoteNo}
                          </Link>
                        )}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.bg}`}>
                          <span className={`w-1 h-1 rounded-full ${badge.dot}`} />
                          {locale === 'th' ? badge.label : badge.labelEn}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-gold)]/10 text-[var(--color-gold)]">
                          {ob._count.lines} {locale === 'th' ? 'รายการ' : 'items'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-foreground-muted)]">
                        <span>{formatDate(ob.createdAt)}</span>
                        <span>{ob.createdBy.displayName}</span>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Pending indicator for partial */}
              {!outbound.purchaseOrder.isComplete && outbound.purchaseOrder.totalRemaining > 0 && (
                <div className="relative pl-12">
                  <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full border-2 border-orange-400 bg-white" />
                  <div className="text-sm text-orange-600 font-medium">
                    {locale === 'th'
                      ? `รอจัดส่งเพิ่ม — คงเหลือ ${outbound.purchaseOrder.totalRemaining} รายการ`
                      : `Pending — ${outbound.purchaseOrder.totalRemaining} items remaining`
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/${locale}/dashboard/products/item/${line.productItem.id}`}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--color-off-white)] text-[var(--color-gold)] hover:bg-[var(--color-gold)] hover:text-white transition-all duration-200"
                        title={locale === 'th' ? 'ดูรายละเอียด' : 'View Details'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                      {/* Show damage button */}
                      
                        <button
                          onClick={() => openDamageModal(line)}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200"
                          title={locale === 'th' ? 'แจ้งเสียหาย' : 'Mark Damaged'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </button>
                      
                    </div>
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

      {/* Damage Modal */}
      {showDamageModal && selectedLine && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
              {locale === 'th' ? 'แจ้งสินค้าเสียหาย' : 'Report Damaged Product'}
            </h3>

            {/* Product Info */}
            <div className="bg-[var(--color-gray-100)] rounded-lg p-4 mb-4">
              <p className="font-mono text-sm">{selectedLine.productItem.serial12}</p>
              <p className="font-medium">{selectedLine.productItem.sku}</p>
              <p className="text-sm text-[var(--color-gray-500)]">{selectedLine.productItem.name}</p>
            </div>

            {/* Damage Reason */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-2">
                {locale === 'th' ? 'สาเหตุความเสียหาย *' : 'Damage Reason *'}
              </label>
              <select
                value={damageReason}
                onChange={(e) => setDamageReason(e.target.value)}
                className="w-full px-4 py-3 border border-[var(--color-beige)] rounded-xl focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)] transition-all bg-[var(--color-off-white)]"
              >
                <option value="">{locale === 'th' ? '-- เลือกสาเหตุ --' : '-- Select reason --'}</option>
                <option value="ชำรุดจากการขนส่ง">{locale === 'th' ? 'ชำรุดจากการขนส่ง' : 'Shipping damage'}</option>
                <option value="สินค้ามีตำหนิ">{locale === 'th' ? 'สินค้ามีตำหนิ' : 'Product defect'}</option>
                <option value="บรรจุภัณฑ์เสียหาย">{locale === 'th' ? 'บรรจุภัณฑ์เสียหาย' : 'Packaging damage'}</option>
                <option value="QR Code เสียหาย">{locale === 'th' ? 'QR Code เสียหาย' : 'QR Code damaged'}</option>
                <option value="สินค้าหมดอายุ">{locale === 'th' ? 'สินค้าหมดอายุ' : 'Expired'}</option>
                <option value="ลูกค้าแจ้งปัญหา">{locale === 'th' ? 'ลูกค้าแจ้งปัญหา' : 'Customer reported issue'}</option>
                <option value="อื่นๆ">{locale === 'th' ? 'อื่นๆ' : 'Other'}</option>
              </select>
            </div>

            {/* Additional Note */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-2">
                {locale === 'th' ? 'รายละเอียดเพิ่มเติม' : 'Additional Notes'}
              </label>
              <textarea
                value={damageNote}
                onChange={(e) => setDamageNote(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-[var(--color-beige)] rounded-xl focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)] transition-all bg-[var(--color-off-white)]"
                placeholder={locale === 'th' ? 'รายละเอียดเพิ่มเติม...' : 'Additional details...'}
              />
            </div>

            {/* Replacement Option */}
            <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wantReplacement}
                  onChange={(e) => {
                    setWantReplacement(e.target.checked)
                    if (e.target.checked && selectedLine) {
                      fetchReplacementItems(selectedLine.productItem.sku, selectedLine.productItem.id)
                    } else {
                      setSelectedReplacement(null)
                    }
                  }}
                  className="w-5 h-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-blue-800">
                  {locale === 'th' ? 'เลือกสินค้าอื่นมาแทนที่' : 'Select replacement product'}
                </span>
              </label>

              {wantReplacement && (
                <div className="mt-3">
                  {loadingReplacements ? (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                      {locale === 'th' ? 'กำลังโหลดรายการสินค้า...' : 'Loading products...'}
                    </div>
                  ) : replacementItems.length > 0 ? (
                    <select
                      value={selectedReplacement || ''}
                      onChange={(e) => setSelectedReplacement(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all bg-white text-sm"
                    >
                      <option value="">{locale === 'th' ? '-- เลือกสินค้าทดแทน --' : '-- Select replacement --'}</option>
                      {replacementItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.serial12} - {item.name} {item.lot ? `(Lot: ${item.lot})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-amber-600">
                      {locale === 'th' ? 'ไม่พบสินค้า SKU เดียวกันในคลัง' : 'No matching products available in stock'}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDamageModal(false)
                  setSelectedLine(null)
                  setDamageReason('')
                  setDamageNote('')
                  setWantReplacement(false)
                  setReplacementItems([])
                  setSelectedReplacement(null)
                }}
                disabled={damageLoading}
                className="px-4 py-2 text-[var(--color-foreground-muted)] hover:text-[var(--color-charcoal)] font-medium transition-colors"
              >
                {locale === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                onClick={handleMarkDamaged}
                disabled={damageLoading || !damageReason.trim() || (wantReplacement && !selectedReplacement)}
                className="px-6 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {damageLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {locale === 'th' ? 'กำลังดำเนินการ...' : 'Processing...'}
                  </span>
                ) : (
                  locale === 'th' ? 'ยืนยันแจ้งเสียหาย' : 'Confirm Damaged'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
