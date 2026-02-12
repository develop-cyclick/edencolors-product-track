'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useConfirm, useAlert } from '@/components/ui/confirm-modal'

interface GRN {
  id: number
  grnNo: string
  receivedAt: string
  poNo: string | null
  supplierName: string
  supplierAddress: string | null
  supplierPhone: string | null
  supplierContact: string | null
  deliveryNoteNo: string | null
  deliveryDocDate: string | null
  remarks: string | null
  approvedAt: string | null
  createdAt: string
  warehouse: { id: number; name: string }
  receivedBy: { id: number; displayName: string }
  approvedBy: { id: number; displayName: string } | null
  lines: Array<{
    id: number
    sku: string
    itemName: string
    modelSize: string | null
    lot: string | null
    mfgDate: string | null
    expDate: string | null
    inspectionStatus: string
    remarks: string | null
    productItem: { id: number; serial12: string; sku: string; name: string }
    unit: { nameTh: string }
  }>
  _count: { lines: number }
}

interface Outbound {
  id: number
  deliveryNoteNo: string
  status: string
  poNo: string | null
  createdAt: string
  remarks: string | null
  warehouse: { id: number; name: string }
  shippingMethod: { id: number; nameTh: string }
  clinic: { id: number; name: string; province: string; branchName: string | null }
  createdBy: { id: number; displayName: string }
  approvedBy: { id: number; displayName: string } | null
  lines: Array<{
    id: number
    sku: string
    itemName: string
    modelSize: string | null
    lot: string | null
    expDate: string | null
    productItem: {
      id: number
      serial12: string
      sku: string
      name: string
      lot: string | null
      mfgDate: string | null
      expDate: string | null
      status: string
    }
    unit: { nameTh: string }
  }>
  _count: { lines: number }
}

interface DamagedAction {
  id: number
  actionType: 'RESTORE' | 'SCRAP'
  status: string
  repairNote: string | null
  createdAt: string
  approvedAt: string | null
  productItem: {
    id: number
    serial12: string
    sku: string
    name: string
    status: string
    lot: string | null
    expDate: string | null
    productMaster: {
      id: number
      sku: string
      nameTh: string
      nameEn: string | null
      modelSize: string | null
      category: { nameTh: string; nameEn: string | null }
    } | null
  }
  createdBy: { id: number; displayName: string }
  approvedBy: { id: number; displayName: string } | null
}

interface BorrowTransaction {
  id: number
  transactionNo: string
  type: string
  status: string
  borrowerName: string
  clinicName: string | null
  clinicAddress: string | null
  reason: string | null
  remarks: string | null
  createdAt: string
  approvedAt: string | null
  createdBy: { id: number; displayName: string }
  approvedBy: { id: number; displayName: string } | null
  rejectedBy: { id: number; displayName: string } | null
  lines: Array<{
    id: number
    sku: string
    itemName: string
    productItem: {
      id: number
      serial12: string
      sku: string
      name: string
      status: string
    }
    unit: { nameTh: string }
  }>
  _count: { lines: number }
}

interface Stats {
  grn: { pending: number; approved: number }
  outbound: { DRAFT: number; PENDING: number; APPROVED: number; REJECTED: number }
  damaged: { PENDING: number; APPROVED: number; REJECTED: number }
  borrow: { PENDING: number; APPROVED: number; REJECTED: number }
  totalPending: number
}

export default function ApprovalBoardPage() {
  const params = useParams()
  const locale = params.locale as string
  const confirm = useConfirm()
  const alert = useAlert()

  const [grnItems, setGrnItems] = useState<GRN[]>([])
  const [outboundItems, setOutboundItems] = useState<Outbound[]>([])
  const [damagedItems, setDamagedItems] = useState<DamagedAction[]>([])
  const [borrowItems, setBorrowItems] = useState<BorrowTransaction[]>([])
  const [stats, setStats] = useState<Stats>({
    grn: { pending: 0, approved: 0 },
    outbound: { DRAFT: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 },
    damaged: { PENDING: 0, APPROVED: 0, REJECTED: 0 },
    borrow: { PENDING: 0, APPROVED: 0, REJECTED: 0 },
    totalPending: 0,
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'grn' | 'outbound' | 'damaged' | 'borrow' | 'approved'>('all')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [expandedGrn, setExpandedGrn] = useState<number | null>(null)
  const [expandedOutbound, setExpandedOutbound] = useState<number | null>(null)

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const fetchData = async () => {
    setLoading(true)
    try {
      const type = activeTab === 'approved' ? 'all' : activeTab
      const status = activeTab === 'approved' ? 'APPROVED' : 'PENDING'
      const res = await fetch(`/api/manager/approval-board?type=${type}&status=${status}`)
      const data = await res.json()
      if (data.success && data.data) {
        setGrnItems(data.data.grn || [])
        setOutboundItems(data.data.outbound || [])
        setDamagedItems(data.data.damaged || [])
        setBorrowItems(data.data.borrow || [])
        setStats(data.data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproveGRN = async (id: number) => {
    const confirmed = await confirm({
      title: locale === 'th' ? 'อนุมัติใบรับสินค้า' : 'Approve GRN',
      message: locale === 'th' ? 'ยืนยันอนุมัติใบรับสินค้านี้?' : 'Confirm approve this GRN?',
      confirmText: locale === 'th' ? 'อนุมัติ' : 'Approve',
      cancelText: locale === 'th' ? 'ยกเลิก' : 'Cancel',
      variant: 'info',
      icon: 'success',
    })
    if (!confirmed) return

    setProcessingId(`grn-${id}`)
    try {
      const res = await fetch(`/api/warehouse/grn/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      const data = await res.json()
      if (data.success) {
        await alert({ title: locale === 'th' ? 'สำเร็จ' : 'Success', message: locale === 'th' ? 'อนุมัติสำเร็จ' : 'Approved successfully', variant: 'success', icon: 'success' })
        fetchData()
      } else {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: `Error: ${data.error}`, variant: 'error', icon: 'error' })
      }
    } catch {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: 'Failed to approve', variant: 'error', icon: 'error' })
    } finally {
      setProcessingId(null)
    }
  }

  const handleRejectGRN = async (id: number) => {
    const reason = prompt(locale === 'th' ? 'ระบุเหตุผลที่ปฏิเสธ:' : 'Enter reject reason:')
    if (!reason) return

    setProcessingId(`grn-${id}`)
    try {
      const res = await fetch(`/api/warehouse/grn/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejectReason: reason }),
      })
      const data = await res.json()
      if (data.success) {
        await alert({ title: locale === 'th' ? 'สำเร็จ' : 'Success', message: locale === 'th' ? 'ปฏิเสธสำเร็จ' : 'Rejected successfully', variant: 'success', icon: 'success' })
        fetchData()
      } else {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: `Error: ${data.error}`, variant: 'error', icon: 'error' })
      }
    } catch {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: 'Failed to reject', variant: 'error', icon: 'error' })
    } finally {
      setProcessingId(null)
    }
  }

  const handleApproveOutbound = async (id: number) => {
    const confirmed = await confirm({
      title: locale === 'th' ? 'อนุมัติใบส่งสินค้า' : 'Approve Outbound',
      message: locale === 'th' ? 'ยืนยันอนุมัติใบส่งสินค้านี้?' : 'Confirm approve this outbound?',
      confirmText: locale === 'th' ? 'อนุมัติ' : 'Approve',
      cancelText: locale === 'th' ? 'ยกเลิก' : 'Cancel',
      variant: 'info',
      icon: 'success',
    })
    if (!confirmed) return

    setProcessingId(`out-${id}`)
    try {
      const res = await fetch(`/api/warehouse/outbound/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      const data = await res.json()
      if (data.success) {
        await alert({ title: locale === 'th' ? 'สำเร็จ' : 'Success', message: locale === 'th' ? 'อนุมัติสำเร็จ' : 'Approved successfully', variant: 'success', icon: 'success' })
        fetchData()
      } else {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: `Error: ${data.error}`, variant: 'error', icon: 'error' })
      }
    } catch {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: 'Failed to approve', variant: 'error', icon: 'error' })
    } finally {
      setProcessingId(null)
    }
  }

  const handleRejectOutbound = async (id: number) => {
    const reason = prompt(locale === 'th' ? 'ระบุเหตุผลที่ปฏิเสธ:' : 'Enter reject reason:')
    if (!reason) return

    setProcessingId(`out-${id}`)
    try {
      const res = await fetch(`/api/warehouse/outbound/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejectReason: reason }),
      })
      const data = await res.json()
      if (data.success) {
        await alert({ title: locale === 'th' ? 'สำเร็จ' : 'Success', message: locale === 'th' ? 'ปฏิเสธสำเร็จ' : 'Rejected successfully', variant: 'success', icon: 'success' })
        fetchData()
      } else {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: `Error: ${data.error}`, variant: 'error', icon: 'error' })
      }
    } catch {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: 'Failed to reject', variant: 'error', icon: 'error' })
    } finally {
      setProcessingId(null)
    }
  }

  const handleApproveDamaged = async (id: number) => {
    const confirmed = await confirm({
      title: locale === 'th' ? 'อนุมัติคำขอ' : 'Approve Request',
      message: locale === 'th' ? 'ยืนยันอนุมัติคำขอนี้?' : 'Confirm approve this request?',
      confirmText: locale === 'th' ? 'อนุมัติ' : 'Approve',
      cancelText: locale === 'th' ? 'ยกเลิก' : 'Cancel',
      variant: 'info',
      icon: 'success',
    })
    if (!confirmed) return

    setProcessingId(`dmg-${id}`)
    try {
      const res = await fetch(`/api/manager/damaged-action/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      const data = await res.json()
      if (data.success) {
        await alert({ title: locale === 'th' ? 'สำเร็จ' : 'Success', message: locale === 'th' ? 'อนุมัติสำเร็จ' : 'Approved successfully', variant: 'success', icon: 'success' })
        fetchData()
      } else {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: `Error: ${data.error}`, variant: 'error', icon: 'error' })
      }
    } catch {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: 'Failed to approve', variant: 'error', icon: 'error' })
    } finally {
      setProcessingId(null)
    }
  }

  const handleRejectDamaged = async (id: number) => {
    const reason = prompt(locale === 'th' ? 'ระบุเหตุผลที่ปฏิเสธ:' : 'Enter reject reason:')
    if (!reason) return

    setProcessingId(`dmg-${id}`)
    try {
      const res = await fetch(`/api/manager/damaged-action/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejectReason: reason }),
      })
      const data = await res.json()
      if (data.success) {
        await alert({ title: locale === 'th' ? 'สำเร็จ' : 'Success', message: locale === 'th' ? 'ปฏิเสธสำเร็จ' : 'Rejected successfully', variant: 'success', icon: 'success' })
        fetchData()
      } else {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: `Error: ${data.error}`, variant: 'error', icon: 'error' })
      }
    } catch {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: 'Failed to reject', variant: 'error', icon: 'error' })
    } finally {
      setProcessingId(null)
    }
  }

  const handleApproveBorrow = async (id: number) => {
    const confirmed = await confirm({
      title: locale === 'th' ? 'อนุมัติคำขอยืมสินค้า' : 'Approve Borrow Request',
      message: locale === 'th' ? 'ยืนยันอนุมัติคำขอยืมสินค้านี้?' : 'Confirm approve this borrow request?',
      confirmText: locale === 'th' ? 'อนุมัติ' : 'Approve',
      cancelText: locale === 'th' ? 'ยกเลิก' : 'Cancel',
      variant: 'info',
      icon: 'success',
    })
    if (!confirmed) return

    setProcessingId(`borrow-${id}`)
    try {
      const res = await fetch(`/api/warehouse/borrow/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      const data = await res.json()
      if (data.success) {
        await alert({ title: locale === 'th' ? 'สำเร็จ' : 'Success', message: locale === 'th' ? 'อนุมัติคำขอยืมสำเร็จ' : 'Borrow request approved', variant: 'success', icon: 'success' })
        fetchData()
      } else {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: `Error: ${data.error}`, variant: 'error', icon: 'error' })
      }
    } catch {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: 'Failed to approve', variant: 'error', icon: 'error' })
    } finally {
      setProcessingId(null)
    }
  }

  const handleRejectBorrow = async (id: number) => {
    const reason = prompt(locale === 'th' ? 'ระบุเหตุผลที่ปฏิเสธ:' : 'Enter reject reason:')
    if (!reason) return

    setProcessingId(`borrow-${id}`)
    try {
      const res = await fetch(`/api/warehouse/borrow/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejectedReason: reason }),
      })
      const data = await res.json()
      if (data.success) {
        await alert({ title: locale === 'th' ? 'สำเร็จ' : 'Success', message: locale === 'th' ? 'ปฏิเสธคำขอยืมสำเร็จ' : 'Borrow request rejected', variant: 'success', icon: 'success' })
        fetchData()
      } else {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: `Error: ${data.error}`, variant: 'error', icon: 'error' })
      }
    } catch {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: 'Failed to reject', variant: 'error', icon: 'error' })
    } finally {
      setProcessingId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDateShort = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const toggleGrnExpand = (id: number) => {
    setExpandedGrn(expandedGrn === id ? null : id)
  }

  const toggleOutboundExpand = (id: number) => {
    setExpandedOutbound(expandedOutbound === id ? null : id)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-display text-2xl font-bold text-[var(--color-charcoal)]">
          {locale === 'th' ? 'รายการรออนุมัติ' : 'Approval Board'}
        </h1>
        <p className="text-[var(--color-foreground-muted)] mt-1">
          {locale === 'th' ? 'ตรวจสอบและอนุมัติใบรับสินค้าและใบส่งสินค้า' : 'Review and approve GRN and outbound deliveries'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <button
          onClick={() => setActiveTab('all')}
          className={`p-5 rounded-2xl border-2 transition-all duration-200 text-left ${
            activeTab === 'all'
              ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10 shadow-[0_4px_14px_rgba(201,163,90,0.15)]'
              : 'border-[var(--color-beige)] bg-white hover:border-[var(--color-gold)]/50'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-3xl font-bold text-[var(--color-charcoal)]">{stats.totalPending}</span>
          </div>
          <p className="text-sm text-[var(--color-foreground-muted)]">
            {locale === 'th' ? 'รอทั้งหมด' : 'All Pending'}
          </p>
        </button>

        <button
          onClick={() => setActiveTab('grn')}
          className={`p-5 rounded-2xl border-2 transition-all duration-200 text-left ${
            activeTab === 'grn'
              ? 'border-[var(--color-gold)] bg-blue-50 shadow-[0_4px_14px_rgba(201,163,90,0.15)]'
              : 'border-[var(--color-beige)] bg-white hover:border-[var(--color-gold)]/50'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-3xl font-bold text-[var(--color-charcoal)]">{stats.grn.pending}</span>
          </div>
          <p className="text-sm text-[var(--color-foreground-muted)]">
            {locale === 'th' ? 'รับเข้า รออนุมัติ' : 'GRN Pending'}
          </p>
        </button>

        <button
          onClick={() => setActiveTab('outbound')}
          className={`p-5 rounded-2xl border-2 transition-all duration-200 text-left ${
            activeTab === 'outbound'
              ? 'border-[var(--color-gold)] bg-purple-50 shadow-[0_4px_14px_rgba(201,163,90,0.15)]'
              : 'border-[var(--color-beige)] bg-white hover:border-[var(--color-gold)]/50'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-3xl font-bold text-[var(--color-charcoal)]">{stats.outbound.PENDING}</span>
          </div>
          <p className="text-sm text-[var(--color-foreground-muted)]">
            {locale === 'th' ? 'ส่งออก รออนุมัติ' : 'Outbound Pending'}
          </p>
        </button>

        <button
          onClick={() => setActiveTab('damaged')}
          className={`p-5 rounded-2xl border-2 transition-all duration-200 text-left ${
            activeTab === 'damaged'
              ? 'border-[var(--color-gold)] bg-orange-50 shadow-[0_4px_14px_rgba(201,163,90,0.15)]'
              : 'border-[var(--color-beige)] bg-white hover:border-[var(--color-gold)]/50'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-3xl font-bold text-[var(--color-charcoal)]">{stats.damaged?.PENDING || 0}</span>
          </div>
          <p className="text-sm text-[var(--color-foreground-muted)]">
            {locale === 'th' ? 'เสียหาย/คืน รออนุมัติ' : 'Damaged Pending'}
          </p>
        </button>

        <button
          onClick={() => setActiveTab('borrow')}
          className={`p-5 rounded-2xl border-2 transition-all duration-200 text-left ${
            activeTab === 'borrow'
              ? 'border-[var(--color-gold)] bg-violet-50 shadow-[0_4px_14px_rgba(201,163,90,0.15)]'
              : 'border-[var(--color-beige)] bg-white hover:border-[var(--color-gold)]/50'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="w-3 h-3 rounded-full bg-violet-500" />
            <span className="text-3xl font-bold text-[var(--color-charcoal)]">{stats.borrow?.PENDING || 0}</span>
          </div>
          <p className="text-sm text-[var(--color-foreground-muted)]">
            {locale === 'th' ? 'ยืมสินค้า รออนุมัติ' : 'Borrow Pending'}
          </p>
        </button>

        <button
          onClick={() => setActiveTab('approved')}
          className={`p-5 rounded-2xl border-2 transition-all duration-200 text-left ${
            activeTab === 'approved'
              ? 'border-[var(--color-mint)] bg-[var(--color-mint)]/10 shadow-[0_4px_14px_rgba(115,207,199,0.15)]'
              : 'border-[var(--color-beige)] bg-white hover:border-[var(--color-mint)]/50'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="w-3 h-3 rounded-full bg-[var(--color-mint)]" />
            <span className="text-3xl font-bold text-[var(--color-charcoal)]">
              {stats.grn.approved + stats.outbound.APPROVED}
            </span>
          </div>
          <p className="text-sm text-[var(--color-foreground-muted)]">
            {locale === 'th' ? 'อนุมัติแล้ว' : 'Approved'}
          </p>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-12">
          <div className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 relative mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin" />
            </div>
            <p className="text-[var(--color-foreground-muted)]">
              {locale === 'th' ? 'กำลังโหลด...' : 'Loading...'}
            </p>
          </div>
        </div>
      ) : grnItems.length === 0 && outboundItems.length === 0 && damagedItems.length === 0 && borrowItems.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-mint)]/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--color-mint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-[var(--color-foreground-muted)]">
            {locale === 'th' ? 'ไม่มีรายการรออนุมัติ' : 'No pending items'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* GRN Section */}
          {(activeTab === 'all' || activeTab === 'grn') && grnItems.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                {locale === 'th' ? 'ใบรับสินค้า (GRN) รออนุมัติ' : 'GRN Pending Approval'}
                <span className="text-sm font-normal text-[var(--color-foreground-muted)]">({grnItems.length})</span>
              </h2>
              <div className="space-y-4">
                {grnItems.map((grn) => (
                  <div key={grn.id} className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden hover:shadow-[var(--shadow-lg)] transition-shadow">
                    {/* Header with actions */}
                    <div className="p-5 border-b border-[var(--color-beige)] bg-blue-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/${locale}/dashboard/grn/${grn.id}`}
                            className="text-lg font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            {grn.grnNo}
                          </Link>
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                            {locale === 'th' ? 'รออนุมัติ' : 'Pending'}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--color-foreground-muted)] mt-1">
                          {locale === 'th' ? 'รับเมื่อ' : 'Received'}: {formatDate(grn.receivedAt)} {locale === 'th' ? 'โดย' : 'by'} {grn.receivedBy.displayName}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveGRN(grn.id)}
                          disabled={processingId === `grn-${grn.id}`}
                          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-mint)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(115,207,199,0.3)] hover:bg-[var(--color-mint-dark)] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {locale === 'th' ? 'อนุมัติ' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleRejectGRN(grn.id)}
                          disabled={processingId === `grn-${grn.id}`}
                          className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(239,68,68,0.3)] hover:bg-red-600 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          {locale === 'th' ? 'ปฏิเสธ' : 'Reject'}
                        </button>
                      </div>
                    </div>

                    {/* Summary Info */}
                    <div className="p-5">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="p-3 bg-[var(--color-off-white)] rounded-xl">
                          <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{locale === 'th' ? 'ผู้จัดส่ง' : 'Supplier'}</p>
                          <p className="font-medium text-[var(--color-charcoal)]">{grn.supplierName}</p>
                        </div>
                        <div className="p-3 bg-[var(--color-off-white)] rounded-xl">
                          <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{locale === 'th' ? 'คลังสินค้า' : 'Warehouse'}</p>
                          <p className="font-medium text-[var(--color-charcoal)]">{grn.warehouse.name}</p>
                        </div>
                        <div className="p-3 bg-[var(--color-off-white)] rounded-xl">
                          <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{locale === 'th' ? 'จำนวนสินค้า' : 'Items'}</p>
                          <p className="font-medium text-[var(--color-charcoal)]">{grn._count.lines} {locale === 'th' ? 'รายการ' : 'items'}</p>
                        </div>
                        <div className="p-3 bg-[var(--color-off-white)] rounded-xl">
                          <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{locale === 'th' ? 'เลขที่ PO' : 'PO No'}</p>
                          <p className="font-medium text-[var(--color-charcoal)]">{grn.poNo || '-'}</p>
                        </div>
                      </div>

                      {/* Expand Button */}
                      <button
                        onClick={() => toggleGrnExpand(grn.id)}
                        className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] bg-[var(--color-gold)]/5 hover:bg-[var(--color-gold)]/10 rounded-xl transition-colors"
                      >
                        <svg
                          className={`w-5 h-5 transition-transform duration-200 ${expandedGrn === grn.id ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        {expandedGrn === grn.id
                          ? (locale === 'th' ? 'ซ่อนรายละเอียด' : 'Hide Details')
                          : (locale === 'th' ? 'ดูรายละเอียดทั้งหมด' : 'View All Details')}
                      </button>

                      {/* Expanded Details */}
                      {expandedGrn === grn.id && (
                        <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                          {/* Supplier Details */}
                          <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                            <h4 className="text-sm font-semibold text-[var(--color-charcoal)] mb-3 flex items-center gap-2">
                              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                              {locale === 'th' ? 'ข้อมูลผู้จัดส่ง' : 'Supplier Information'}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ชื่อ:' : 'Name:'}</span>
                                <span className="ml-2 text-[var(--color-charcoal)] font-medium">{grn.supplierName}</span>
                              </div>
                              {grn.supplierContact && (
                                <div>
                                  <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ผู้ติดต่อ:' : 'Contact:'}</span>
                                  <span className="ml-2 text-[var(--color-charcoal)]">{grn.supplierContact}</span>
                                </div>
                              )}
                              {grn.supplierPhone && (
                                <div>
                                  <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'โทร:' : 'Phone:'}</span>
                                  <span className="ml-2 text-[var(--color-charcoal)]">{grn.supplierPhone}</span>
                                </div>
                              )}
                              {grn.supplierAddress && (
                                <div className="md:col-span-2">
                                  <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ที่อยู่:' : 'Address:'}</span>
                                  <span className="ml-2 text-[var(--color-charcoal)]">{grn.supplierAddress}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Document Details */}
                          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <h4 className="text-sm font-semibold text-[var(--color-charcoal)] mb-3 flex items-center gap-2">
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {locale === 'th' ? 'ข้อมูลเอกสาร' : 'Document Information'}
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div>
                                <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'เลขที่ PO:' : 'PO No:'}</span>
                                <span className="ml-2 text-[var(--color-charcoal)]">{grn.poNo || '-'}</span>
                              </div>
                              <div>
                                <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'เลขที่ใบส่ง:' : 'DN No:'}</span>
                                <span className="ml-2 text-[var(--color-charcoal)]">{grn.deliveryNoteNo || '-'}</span>
                              </div>
                              <div>
                                <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'วันที่เอกสาร:' : 'Doc Date:'}</span>
                                <span className="ml-2 text-[var(--color-charcoal)]">{formatDateShort(grn.deliveryDocDate)}</span>
                              </div>
                              <div>
                                <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'วันที่รับ:' : 'Received:'}</span>
                                <span className="ml-2 text-[var(--color-charcoal)]">{formatDateShort(grn.receivedAt)}</span>
                              </div>
                            </div>
                            {grn.remarks && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <span className="text-[var(--color-foreground-muted)] text-sm">{locale === 'th' ? 'หมายเหตุ:' : 'Remarks:'}</span>
                                <p className="mt-1 text-sm text-[var(--color-charcoal)]">{grn.remarks}</p>
                              </div>
                            )}
                          </div>

                          {/* All Items Table */}
                          {grn.lines.length > 0 && (
                            <div className="border border-[var(--color-beige)] rounded-xl overflow-hidden">
                              <div className="bg-[var(--color-off-white)] px-4 py-2 border-b border-[var(--color-beige)]">
                                <h4 className="text-sm font-semibold text-[var(--color-charcoal)]">
                                  {locale === 'th' ? `รายการสินค้าทั้งหมด (${grn.lines.length} รายการ)` : `All Items (${grn.lines.length} items)`}
                                </h4>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-[var(--color-off-white)]">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">#</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">Serial</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">SKU</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'ชื่อสินค้า' : 'Item'}</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'รุ่น/ขนาด' : 'Model'}</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">Lot</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'ผลิต' : 'MFG'}</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'หมดอายุ' : 'EXP'}</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'ตรวจสอบ' : 'QC'}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[var(--color-beige)]">
                                    {grn.lines.map((line, idx) => (
                                      <tr key={line.id} className="hover:bg-[var(--color-off-white)]/50">
                                        <td className="px-4 py-2 text-[var(--color-foreground-muted)]">{idx + 1}</td>
                                        <td className="px-4 py-2 font-mono text-xs text-blue-600">{line.productItem.serial12}</td>
                                        <td className="px-4 py-2 text-[var(--color-charcoal)]">{line.sku}</td>
                                        <td className="px-4 py-2 text-[var(--color-charcoal)]">{line.itemName}</td>
                                        <td className="px-4 py-2 text-[var(--color-foreground-muted)]">{line.modelSize || '-'}</td>
                                        <td className="px-4 py-2 text-[var(--color-foreground-muted)]">{line.lot || '-'}</td>
                                        <td className="px-4 py-2 text-[var(--color-foreground-muted)] text-xs">{formatDateShort(line.mfgDate)}</td>
                                        <td className="px-4 py-2 text-[var(--color-foreground-muted)] text-xs">{formatDateShort(line.expDate)}</td>
                                        <td className="px-4 py-2">
                                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                            line.inspectionStatus === 'OK'
                                              ? 'bg-green-100 text-green-700'
                                              : line.inspectionStatus === 'HOLD'
                                              ? 'bg-yellow-100 text-yellow-700'
                                              : 'bg-red-100 text-red-700'
                                          }`}>
                                            {line.inspectionStatus}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approved Section */}
          {activeTab === 'approved' && (
            <div className="space-y-6">
              {/* Approved GRN */}
              {grnItems.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--color-mint)]" />
                    {locale === 'th' ? 'ใบรับสินค้า (GRN) อนุมัติแล้ว' : 'Approved GRN'}
                    <span className="text-sm font-normal text-[var(--color-foreground-muted)]">({grnItems.length})</span>
                  </h2>
                  <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                        <tr>
                          <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'เลขที่ GRN' : 'GRN No'}</th>
                          <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'ผู้จัดส่ง' : 'Supplier'}</th>
                          <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'คลัง' : 'Warehouse'}</th>
                          <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'จำนวน' : 'Items'}</th>
                          <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'อนุมัติโดย' : 'Approved By'}</th>
                          <th className="px-5 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-beige)]">
                        {grnItems.map((grn) => (
                          <tr key={grn.id} className="hover:bg-[var(--color-off-white)]/50 transition-colors">
                            <td className="px-5 py-4">
                              <span className="font-medium text-[var(--color-charcoal)]">{grn.grnNo}</span>
                            </td>
                            <td className="px-5 py-4 text-[var(--color-charcoal)]">{grn.supplierName}</td>
                            <td className="px-5 py-4 text-[var(--color-charcoal)]">{grn.warehouse.name}</td>
                            <td className="px-5 py-4 text-[var(--color-charcoal)]">{grn._count.lines}</td>
                            <td className="px-5 py-4 text-[var(--color-charcoal)]">{grn.approvedBy?.displayName || '-'}</td>
                            <td className="px-5 py-4">
                              <Link
                                href={`/${locale}/dashboard/grn/${grn.id}`}
                                className="inline-flex items-center gap-1 text-sm text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] font-medium transition-colors"
                              >
                                {locale === 'th' ? 'ดูรายละเอียด' : 'View'}
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
              )}

              {/* Approved Outbound */}
              {outboundItems.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--color-mint)]" />
                    {locale === 'th' ? 'ใบส่งออก อนุมัติแล้ว' : 'Approved Outbound'}
                    <span className="text-sm font-normal text-[var(--color-foreground-muted)]">({outboundItems.length})</span>
                  </h2>
                  <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                        <tr>
                          <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'เลขที่ใบส่ง' : 'Delivery No'}</th>
                          <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'คลินิก' : 'Clinic'}</th>
                          <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'คลัง' : 'Warehouse'}</th>
                          <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'จำนวน' : 'Items'}</th>
                          <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'อนุมัติโดย' : 'Approved By'}</th>
                          <th className="px-5 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-beige)]">
                        {outboundItems.map((ob) => (
                          <tr key={ob.id} className="hover:bg-[var(--color-off-white)]/50 transition-colors">
                            <td className="px-5 py-4">
                              <span className="font-medium text-[var(--color-charcoal)]">{ob.deliveryNoteNo}</span>
                            </td>
                            <td className="px-5 py-4 text-[var(--color-charcoal)]">{ob.clinic.name}</td>
                            <td className="px-5 py-4 text-[var(--color-charcoal)]">{ob.warehouse.name}</td>
                            <td className="px-5 py-4 text-[var(--color-charcoal)]">{ob._count.lines}</td>
                            <td className="px-5 py-4 text-[var(--color-charcoal)]">{ob.approvedBy?.displayName || '-'}</td>
                            <td className="px-5 py-4">
                              <Link
                                href={`/${locale}/dashboard/outbound/${ob.id}`}
                                className="inline-flex items-center gap-1 text-sm text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] font-medium transition-colors"
                              >
                                {locale === 'th' ? 'ดูรายละเอียด' : 'View'}
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
              )}

              {grnItems.length === 0 && outboundItems.length === 0 && (
                <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-beige)]/50 flex items-center justify-center">
                    <svg className="w-8 h-8 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-[var(--color-foreground-muted)]">
                    {locale === 'th' ? 'ยังไม่มีรายการที่อนุมัติแล้ว' : 'No approved items yet'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Outbound Section */}
          {(activeTab === 'all' || activeTab === 'outbound') && outboundItems.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                {locale === 'th' ? 'ใบส่งออก รออนุมัติ' : 'Outbound Pending Approval'}
                <span className="text-sm font-normal text-[var(--color-foreground-muted)]">({outboundItems.length})</span>
              </h2>
              <div className="space-y-4">
                {outboundItems.map((ob) => (
                  <div key={ob.id} className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden hover:shadow-[var(--shadow-lg)] transition-shadow">
                    {/* Header with actions */}
                    <div className="p-5 border-b border-[var(--color-beige)] bg-purple-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/${locale}/dashboard/outbound/${ob.id}`}
                            className="text-lg font-semibold text-purple-600 hover:text-purple-700 transition-colors"
                          >
                            {ob.deliveryNoteNo}
                          </Link>
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                            {locale === 'th' ? 'รออนุมัติ' : 'Pending'}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--color-foreground-muted)] mt-1">
                          {locale === 'th' ? 'สร้างเมื่อ' : 'Created'}: {formatDate(ob.createdAt)} {locale === 'th' ? 'โดย' : 'by'} {ob.createdBy.displayName}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveOutbound(ob.id)}
                          disabled={processingId === `out-${ob.id}`}
                          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-mint)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(115,207,199,0.3)] hover:bg-[var(--color-mint-dark)] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {locale === 'th' ? 'อนุมัติ' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleRejectOutbound(ob.id)}
                          disabled={processingId === `out-${ob.id}`}
                          className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(239,68,68,0.3)] hover:bg-red-600 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          {locale === 'th' ? 'ปฏิเสธ' : 'Reject'}
                        </button>
                      </div>
                    </div>

                    {/* Summary Info */}
                    <div className="p-5">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="p-3 bg-[var(--color-off-white)] rounded-xl">
                          <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{locale === 'th' ? 'คลินิก' : 'Clinic'}</p>
                          <p className="font-medium text-[var(--color-charcoal)]">{ob.clinic.name}</p>
                          {ob.clinic.branchName && (
                            <p className="text-xs text-[var(--color-foreground-muted)]">{ob.clinic.branchName}</p>
                          )}
                        </div>
                        <div className="p-3 bg-[var(--color-off-white)] rounded-xl">
                          <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{locale === 'th' ? 'คลังต้นทาง' : 'Warehouse'}</p>
                          <p className="font-medium text-[var(--color-charcoal)]">{ob.warehouse.name}</p>
                        </div>
                        <div className="p-3 bg-[var(--color-off-white)] rounded-xl">
                          <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{locale === 'th' ? 'วิธีส่ง' : 'Shipping'}</p>
                          <p className="font-medium text-[var(--color-charcoal)]">{ob.shippingMethod.nameTh}</p>
                        </div>
                        <div className="p-3 bg-[var(--color-off-white)] rounded-xl">
                          <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{locale === 'th' ? 'จำนวนสินค้า' : 'Items'}</p>
                          <p className="font-medium text-[var(--color-charcoal)]">{ob._count.lines} {locale === 'th' ? 'รายการ' : 'items'}</p>
                        </div>
                      </div>

                      {/* Expand Button */}
                      <button
                        onClick={() => toggleOutboundExpand(ob.id)}
                        className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] bg-[var(--color-gold)]/5 hover:bg-[var(--color-gold)]/10 rounded-xl transition-colors"
                      >
                        <svg
                          className={`w-5 h-5 transition-transform duration-200 ${expandedOutbound === ob.id ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        {expandedOutbound === ob.id
                          ? (locale === 'th' ? 'ซ่อนรายละเอียด' : 'Hide Details')
                          : (locale === 'th' ? 'ดูรายละเอียดทั้งหมด' : 'View All Details')}
                      </button>

                      {/* Expanded Details */}
                      {expandedOutbound === ob.id && (
                        <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                          {/* Clinic Details */}
                          <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                            <h4 className="text-sm font-semibold text-[var(--color-charcoal)] mb-3 flex items-center gap-2">
                              <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                              {locale === 'th' ? 'ข้อมูลคลินิก' : 'Clinic Information'}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ชื่อ:' : 'Name:'}</span>
                                <span className="ml-2 text-[var(--color-charcoal)] font-medium">{ob.clinic.name}</span>
                              </div>
                              {ob.clinic.branchName && (
                                <div>
                                  <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'สาขา:' : 'Branch:'}</span>
                                  <span className="ml-2 text-[var(--color-charcoal)]">{ob.clinic.branchName}</span>
                                </div>
                              )}
                              <div>
                                <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'จังหวัด:' : 'Province:'}</span>
                                <span className="ml-2 text-[var(--color-charcoal)]">{ob.clinic.province}</span>
                              </div>
                            </div>
                          </div>

                          {/* Document Details */}
                          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <h4 className="text-sm font-semibold text-[var(--color-charcoal)] mb-3 flex items-center gap-2">
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {locale === 'th' ? 'ข้อมูลเอกสาร' : 'Document Information'}
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                              <div>
                                <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'เลขที่ PO:' : 'PO No:'}</span>
                                <span className="ml-2 text-[var(--color-charcoal)]">{ob.poNo || '-'}</span>
                              </div>
                              <div>
                                <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'วิธีส่ง:' : 'Shipping:'}</span>
                                <span className="ml-2 text-[var(--color-charcoal)]">{ob.shippingMethod.nameTh}</span>
                              </div>
                              <div>
                                <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'วันที่สร้าง:' : 'Created:'}</span>
                                <span className="ml-2 text-[var(--color-charcoal)]">{formatDateShort(ob.createdAt)}</span>
                              </div>
                            </div>
                            {ob.remarks && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <span className="text-[var(--color-foreground-muted)] text-sm">{locale === 'th' ? 'หมายเหตุ:' : 'Remarks:'}</span>
                                <p className="mt-1 text-sm text-[var(--color-charcoal)]">{ob.remarks}</p>
                              </div>
                            )}
                          </div>

                          {/* All Items Table */}
                          {ob.lines.length > 0 && (
                            <div className="border border-[var(--color-beige)] rounded-xl overflow-hidden">
                              <div className="bg-[var(--color-off-white)] px-4 py-2 border-b border-[var(--color-beige)]">
                                <h4 className="text-sm font-semibold text-[var(--color-charcoal)]">
                                  {locale === 'th' ? `รายการสินค้าทั้งหมด (${ob.lines.length} รายการ)` : `All Items (${ob.lines.length} items)`}
                                </h4>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-[var(--color-off-white)]">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">#</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">Serial</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">SKU</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'ชื่อสินค้า' : 'Item'}</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'รุ่น/ขนาด' : 'Model'}</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">Lot</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'ผลิต' : 'MFG'}</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'หมดอายุ' : 'EXP'}</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'สถานะ' : 'Status'}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[var(--color-beige)]">
                                    {ob.lines.map((line, idx) => (
                                      <tr key={line.id} className="hover:bg-[var(--color-off-white)]/50">
                                        <td className="px-4 py-2 text-[var(--color-foreground-muted)]">{idx + 1}</td>
                                        <td className="px-4 py-2 font-mono text-xs text-purple-600">{line.productItem.serial12}</td>
                                        <td className="px-4 py-2 text-[var(--color-charcoal)]">{line.sku}</td>
                                        <td className="px-4 py-2 text-[var(--color-charcoal)]">{line.itemName}</td>
                                        <td className="px-4 py-2 text-[var(--color-foreground-muted)]">{line.modelSize || '-'}</td>
                                        <td className="px-4 py-2 text-[var(--color-foreground-muted)]">{line.productItem.lot || '-'}</td>
                                        <td className="px-4 py-2 text-[var(--color-foreground-muted)] text-xs">{formatDateShort(line.productItem.mfgDate)}</td>
                                        <td className="px-4 py-2 text-[var(--color-foreground-muted)] text-xs">{formatDateShort(line.productItem.expDate)}</td>
                                        <td className="px-4 py-2">
                                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                            line.productItem.status === 'IN_STOCK'
                                              ? 'bg-green-100 text-green-700'
                                              : line.productItem.status === 'RESERVED'
                                              ? 'bg-yellow-100 text-yellow-700'
                                              : 'bg-gray-100 text-gray-700'
                                          }`}>
                                            {line.productItem.status}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Borrow Section */}
          {(activeTab === 'all' || activeTab === 'borrow') && borrowItems.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-500" />
                {locale === 'th' ? 'ยืมสินค้า รออนุมัติ' : 'Borrow Pending Approval'}
                <span className="text-sm font-normal text-[var(--color-foreground-muted)]">({borrowItems.length})</span>
              </h2>
              <div className="space-y-4">
                {borrowItems.map((txn) => (
                  <div key={txn.id} className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden hover:shadow-[var(--shadow-lg)] transition-shadow">
                    <div className="p-5 border-b border-[var(--color-beige)] bg-violet-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-semibold text-violet-600 font-mono">
                            {txn.transactionNo}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                            {locale === 'th' ? 'ยืมสินค้า' : 'Borrow'}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                            {locale === 'th' ? 'รออนุมัติ' : 'Pending'}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--color-foreground-muted)] mt-1">
                          {locale === 'th' ? 'สร้างเมื่อ' : 'Created'}: {formatDate(txn.createdAt)} {locale === 'th' ? 'โดย' : 'by'} {txn.createdBy.displayName}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveBorrow(txn.id)}
                          disabled={processingId === `borrow-${txn.id}`}
                          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-mint)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(115,207,199,0.3)] hover:bg-[var(--color-mint-dark)] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {locale === 'th' ? 'อนุมัติ' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleRejectBorrow(txn.id)}
                          disabled={processingId === `borrow-${txn.id}`}
                          className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(239,68,68,0.3)] hover:bg-red-600 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          {locale === 'th' ? 'ปฏิเสธ' : 'Reject'}
                        </button>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 bg-[var(--color-off-white)] rounded-xl">
                          <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{locale === 'th' ? 'ผู้ยืม' : 'Borrower'}</p>
                          <p className="font-medium text-[var(--color-charcoal)]">{txn.borrowerName}</p>
                        </div>
                        <div className="p-3 bg-[var(--color-off-white)] rounded-xl">
                          <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{locale === 'th' ? 'คลินิก' : 'Clinic'}</p>
                          <p className="font-medium text-[var(--color-charcoal)]">{txn.clinicName || '-'}</p>
                        </div>
                        <div className="p-3 bg-[var(--color-off-white)] rounded-xl">
                          <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{locale === 'th' ? 'จำนวนสินค้า' : 'Items'}</p>
                          <p className="font-medium text-[var(--color-charcoal)]">{txn._count.lines} {locale === 'th' ? 'รายการ' : 'items'}</p>
                        </div>
                        <div className="p-3 bg-[var(--color-off-white)] rounded-xl">
                          <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{locale === 'th' ? 'สาเหตุ' : 'Reason'}</p>
                          <p className="font-medium text-[var(--color-charcoal)]">{txn.reason || '-'}</p>
                        </div>
                      </div>

                      {/* Product list */}
                      {txn.lines.length > 0 && (
                        <div className="mt-4 border border-[var(--color-beige)] rounded-xl overflow-hidden">
                          <div className="bg-[var(--color-off-white)] px-4 py-2 border-b border-[var(--color-beige)]">
                            <h4 className="text-sm font-semibold text-[var(--color-charcoal)]">
                              {locale === 'th' ? `รายการสินค้า (${txn.lines.length} รายการ)` : `Products (${txn.lines.length} items)`}
                            </h4>
                          </div>
                          <div className="max-h-40 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-[var(--color-off-white)]">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">#</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">Serial</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">SKU</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'ชื่อสินค้า' : 'Item'}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--color-beige)]">
                                {txn.lines.map((line, idx) => (
                                  <tr key={line.id} className="hover:bg-[var(--color-off-white)]/50">
                                    <td className="px-4 py-2 text-[var(--color-foreground-muted)]">{idx + 1}</td>
                                    <td className="px-4 py-2 font-mono text-xs text-violet-600">{line.productItem.serial12}</td>
                                    <td className="px-4 py-2 text-[var(--color-charcoal)]">{line.sku}</td>
                                    <td className="px-4 py-2 text-[var(--color-charcoal)]">{line.itemName}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {txn.remarks && (
                        <div className="mt-4 p-3 bg-violet-50 rounded-xl border border-violet-100">
                          <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{locale === 'th' ? 'หมายเหตุ' : 'Remarks'}</p>
                          <p className="text-sm text-[var(--color-charcoal)]">{txn.remarks}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Damaged Action Section */}
          {(activeTab === 'all' || activeTab === 'damaged') && damagedItems.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                {locale === 'th' ? 'เสียหาย/คืน รออนุมัติ' : 'Damaged/Return Pending Approval'}
                <span className="text-sm font-normal text-[var(--color-foreground-muted)]">({damagedItems.length})</span>
              </h2>
              <div className="space-y-4">
                {damagedItems.map((item) => (
                  <div key={item.id} className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden hover:shadow-[var(--shadow-lg)] transition-shadow">
                    <div className="p-5 border-b border-[var(--color-beige)] bg-orange-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-semibold text-orange-600">
                            {item.productItem.serial12}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            item.actionType === 'SCRAP'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {item.actionType === 'SCRAP'
                              ? (locale === 'th' ? 'ขอทิ้งสินค้า' : 'Request Scrap')
                              : (locale === 'th' ? 'ขอคืนเข้าคลัง' : 'Request Restore')}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                            {locale === 'th' ? 'รออนุมัติ' : 'Pending'}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--color-foreground-muted)] mt-1">
                          {locale === 'th' ? 'สร้างเมื่อ' : 'Created'}: {formatDate(item.createdAt)} {locale === 'th' ? 'โดย' : 'by'} {item.createdBy.displayName}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveDamaged(item.id)}
                          disabled={processingId === `dmg-${item.id}`}
                          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-mint)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(115,207,199,0.3)] hover:bg-[var(--color-mint-dark)] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {locale === 'th' ? 'อนุมัติ' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleRejectDamaged(item.id)}
                          disabled={processingId === `dmg-${item.id}`}
                          className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(239,68,68,0.3)] hover:bg-red-600 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          {locale === 'th' ? 'ปฏิเสธ' : 'Reject'}
                        </button>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 bg-[var(--color-off-white)] rounded-xl">
                          <p className="text-xs text-[var(--color-foreground-muted)] mb-1">SKU</p>
                          <p className="font-medium text-[var(--color-charcoal)]">{item.productItem.productMaster?.sku || item.productItem.sku}</p>
                        </div>
                        <div className="p-3 bg-[var(--color-off-white)] rounded-xl">
                          <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{locale === 'th' ? 'ชื่อสินค้า' : 'Product'}</p>
                          <p className="font-medium text-[var(--color-charcoal)]">
                            {item.productItem.productMaster
                              ? (locale === 'th' ? item.productItem.productMaster.nameTh : item.productItem.productMaster.nameEn || item.productItem.productMaster.nameTh)
                              : item.productItem.name}
                          </p>
                        </div>
                        <div className="p-3 bg-[var(--color-off-white)] rounded-xl">
                          <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{locale === 'th' ? 'สถานะปัจจุบัน' : 'Current Status'}</p>
                          <p className="font-medium text-[var(--color-charcoal)]">{item.productItem.status}</p>
                        </div>
                        <div className="p-3 bg-[var(--color-off-white)] rounded-xl">
                          <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{locale === 'th' ? 'รุ่น/ขนาด' : 'Model'}</p>
                          <p className="font-medium text-[var(--color-charcoal)]">{item.productItem.productMaster?.modelSize || '-'}</p>
                        </div>
                      </div>
                      {item.repairNote && (
                        <div className="mt-4 p-3 bg-orange-50 rounded-xl border border-orange-100">
                          <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{locale === 'th' ? 'หมายเหตุ' : 'Note'}</p>
                          <p className="text-sm text-[var(--color-charcoal)]">{item.repairNote}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
