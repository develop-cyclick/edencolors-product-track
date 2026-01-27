'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface GRN {
  id: number
  grnNo: string
  receivedAt: string
  poNo: string | null
  supplierName: string
  approvedAt: string | null
  createdAt: string
  warehouse: { id: number; name: string }
  receivedBy: { id: number; displayName: string }
  approvedBy: { id: number; displayName: string } | null
  lines: Array<{
    id: number
    sku: string
    itemName: string
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
    productItem: {
      id: number
      serial12: string
      sku: string
      name: string
      lot: string | null
      expDate: string | null
      status: string
    }
    unit: { nameTh: string }
  }>
  _count: { lines: number }
}

interface Stats {
  grn: { pending: number; approved: number }
  outbound: { DRAFT: number; PENDING: number; APPROVED: number; REJECTED: number }
  totalPending: number
}

export default function ApprovalBoardPage() {
  const params = useParams()
  const locale = params.locale as string

  const [grnItems, setGrnItems] = useState<GRN[]>([])
  const [outboundItems, setOutboundItems] = useState<Outbound[]>([])
  const [stats, setStats] = useState<Stats>({
    grn: { pending: 0, approved: 0 },
    outbound: { DRAFT: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 },
    totalPending: 0,
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'grn' | 'outbound' | 'approved'>('all')
  const [processingId, setProcessingId] = useState<string | null>(null)

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
        setStats(data.data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproveGRN = async (id: number) => {
    if (!confirm(locale === 'th' ? 'ยืนยันอนุมัติใบรับสินค้านี้?' : 'Confirm approve this GRN?')) return

    setProcessingId(`grn-${id}`)
    try {
      const res = await fetch(`/api/warehouse/grn/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      const data = await res.json()
      if (data.success) {
        alert(locale === 'th' ? 'อนุมัติสำเร็จ' : 'Approved successfully')
        fetchData()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch {
      alert('Failed to approve')
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
        alert(locale === 'th' ? 'ปฏิเสธสำเร็จ' : 'Rejected successfully')
        fetchData()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch {
      alert('Failed to reject')
    } finally {
      setProcessingId(null)
    }
  }

  const handleApproveOutbound = async (id: number) => {
    if (!confirm(locale === 'th' ? 'ยืนยันอนุมัติใบส่งสินค้านี้?' : 'Confirm approve this outbound?')) return

    setProcessingId(`out-${id}`)
    try {
      const res = await fetch(`/api/warehouse/outbound/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      const data = await res.json()
      if (data.success) {
        alert(locale === 'th' ? 'อนุมัติสำเร็จ' : 'Approved successfully')
        fetchData()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch {
      alert('Failed to approve')
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
        alert(locale === 'th' ? 'ปฏิเสธสำเร็จ' : 'Rejected successfully')
        fetchData()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch {
      alert('Failed to reject')
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            {locale === 'th' ? 'GRN รออนุมัติ' : 'GRN Pending'}
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
      ) : grnItems.length === 0 && outboundItems.length === 0 ? (
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
                    <div className="p-5 border-b border-[var(--color-beige)] bg-blue-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <Link
                          href={`/${locale}/dashboard/grn/${grn.id}`}
                          className="text-lg font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          {grn.grnNo}
                        </Link>
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
                    <div className="p-5">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                      </div>
                      {grn.lines.length > 0 && (
                        <div className="border border-[var(--color-beige)] rounded-xl overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-[var(--color-off-white)]">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">Serial</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">SKU</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'ชื่อสินค้า' : 'Item'}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-beige)]">
                              {grn.lines.slice(0, 3).map((line) => (
                                <tr key={line.id}>
                                  <td className="px-4 py-2 font-mono text-xs text-blue-600">{line.productItem.serial12}</td>
                                  <td className="px-4 py-2 text-[var(--color-charcoal)]">{line.sku}</td>
                                  <td className="px-4 py-2 text-[var(--color-charcoal)]">{line.itemName}</td>
                                </tr>
                              ))}
                              {grn.lines.length > 3 && (
                                <tr>
                                  <td colSpan={3} className="px-4 py-2 text-center text-[var(--color-foreground-muted)] text-xs">
                                    ... {locale === 'th' ? `และอีก ${grn.lines.length - 3} รายการ` : `and ${grn.lines.length - 3} more`}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
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
                    <div className="p-5 border-b border-[var(--color-beige)] bg-purple-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <Link
                          href={`/${locale}/dashboard/outbound/${ob.id}`}
                          className="text-lg font-semibold text-purple-600 hover:text-purple-700 transition-colors"
                        >
                          {ob.deliveryNoteNo}
                        </Link>
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
                    <div className="p-5">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="p-3 bg-[var(--color-off-white)] rounded-xl">
                          <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{locale === 'th' ? 'คลินิก' : 'Clinic'}</p>
                          <p className="font-medium text-[var(--color-charcoal)]">{ob.clinic.name}</p>
                          <p className="text-sm text-[var(--color-foreground-muted)]">{ob.clinic.province}</p>
                        </div>
                        <div className="p-3 bg-[var(--color-off-white)] rounded-xl">
                          <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{locale === 'th' ? 'คลังต้นทาง' : 'Warehouse'}</p>
                          <p className="font-medium text-[var(--color-charcoal)]">{ob.warehouse.name}</p>
                        </div>
                        <div className="p-3 bg-[var(--color-off-white)] rounded-xl">
                          <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{locale === 'th' ? 'วิธีส่ง' : 'Shipping'}</p>
                          <p className="font-medium text-[var(--color-charcoal)]">{ob.shippingMethod.nameTh}</p>
                        </div>
                      </div>
                      {ob.lines.length > 0 && (
                        <div className="border border-[var(--color-beige)] rounded-xl overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-[var(--color-off-white)]">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">Serial</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">SKU</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'ชื่อสินค้า' : 'Item'}</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-charcoal)]">Lot</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-beige)]">
                              {ob.lines.slice(0, 3).map((line) => (
                                <tr key={line.id}>
                                  <td className="px-4 py-2 font-mono text-xs text-purple-600">{line.productItem.serial12}</td>
                                  <td className="px-4 py-2 text-[var(--color-charcoal)]">{line.sku}</td>
                                  <td className="px-4 py-2 text-[var(--color-charcoal)]">{line.itemName}</td>
                                  <td className="px-4 py-2 text-[var(--color-foreground-muted)]">{line.productItem.lot || '-'}</td>
                                </tr>
                              ))}
                              {ob.lines.length > 3 && (
                                <tr>
                                  <td colSpan={4} className="px-4 py-2 text-center text-[var(--color-foreground-muted)] text-xs">
                                    ... {locale === 'th' ? `และอีก ${ob.lines.length - 3} รายการ` : `and ${ob.lines.length - 3} more`}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
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
