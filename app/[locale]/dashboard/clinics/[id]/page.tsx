'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface ClinicDetail {
  id: number
  name: string
  companyName: string | null
  address: string
  branchName: string | null
  invoiceName: string | null
  contactName: string | null
  contactPhone: string | null
  isActive: boolean
  createdAt: string
}

interface Stats {
  totalOutbounds: number
  approvedOutbounds: number
  pendingOutbounds: number
  rejectedOutbounds: number
  totalItems: number
  shippedItems: number
  poTotalOrdered: number
  poTotalShipped: number
  poRemaining: number
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
}

interface Outbound {
  id: number
  deliveryNoteNo: string
  status: string
  createdAt: string
  shippedAt: string | null
  rejectReason: string | null
  warehouse: { id: number; name: string }
  shippingMethod: { id: number; nameTh: string }
  createdBy: { id: number; displayName: string }
  approvedBy: { id: number; displayName: string } | null
  purchaseOrder: POSummary | null
  _count: { lines: number }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

type StatusFilter = 'all' | 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'

export default function ClinicDetailPage() {
  const params = useParams()
  const locale = params.locale as string
  const id = params.id as string

  const [clinic, setClinic] = useState<ClinicDetail | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [outbounds, setOutbounds] = useState<Outbound[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [poRemainingFilter, setPORemainingFilter] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const searchParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
      })
      if (statusFilter !== 'all') {
        searchParams.set('status', statusFilter)
      }
      if (poRemainingFilter) {
        searchParams.set('poRemaining', 'true')
      }

      const res = await fetch(`/api/admin/clinics/${id}/detail?${searchParams}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch clinic detail')
      }

      setClinic(data.data.clinic)
      setStats(data.data.stats)
      setOutbounds(data.data.outbounds)
      setPagination(data.data.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [id, currentPage, statusFilter, poRemainingFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getStatusBadge = (status: string, size: 'sm' | 'md' = 'md') => {
    const badges: Record<string, { bg: string; dot: string; label: string; labelEn: string }> = {
      DRAFT: { bg: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400', label: 'ฉบับร่าง', labelEn: 'Draft' },
      PENDING: { bg: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: 'รออนุมัติ', labelEn: 'Pending' },
      APPROVED: { bg: 'bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]', dot: 'bg-[var(--color-mint)]', label: 'อนุมัติแล้ว', labelEn: 'Approved' },
      REJECTED: { bg: 'bg-red-100 text-red-700', dot: 'bg-red-500', label: 'ปฏิเสธ', labelEn: 'Rejected' },
    }
    const badge = badges[status] || { bg: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400', label: status, labelEn: status }
    const sizeClasses = size === 'sm' ? 'gap-1 px-2 py-0.5 text-[10px]' : 'gap-1.5 px-3 py-1 text-xs'
    const dotSize = size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5'
    return (
      <span className={`inline-flex items-center ${sizeClasses} rounded-full font-medium ${badge.bg}`}>
        <span className={`${dotSize} rounded-full ${badge.dot}`} />
        {locale === 'th' ? badge.label : badge.labelEn}
      </span>
    )
  }

  const getShipmentBadge = (po: POSummary, size: 'sm' | 'md' = 'md') => {
    const sizeClasses = size === 'sm' ? 'gap-1 px-2 py-0.5 text-[10px]' : 'gap-1.5 px-3 py-1 text-xs'
    const dotSize = size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5'
    if (po.isComplete) {
      return (
        <span className={`inline-flex items-center ${sizeClasses} rounded-full font-medium bg-blue-100 text-blue-700`}>
          <span className={`${dotSize} rounded-full bg-blue-500`} />
          {locale === 'th'
            ? `ส่งครบ ${po.totalShipped}/${po.totalOrdered}`
            : `Complete ${po.totalShipped}/${po.totalOrdered}`
          }
        </span>
      )
    }
    if (po.isPartial) {
      return (
        <span className={`inline-flex items-center ${sizeClasses} rounded-full font-medium bg-orange-100 text-orange-700`}>
          <span className={`${dotSize} rounded-full bg-orange-500`} />
          {locale === 'th'
            ? `ส่งบางส่วน ${po.totalShipped}/${po.totalOrdered}`
            : `Partial ${po.totalShipped}/${po.totalOrdered}`
          }
        </span>
      )
    }
    if (po.totalRemaining > 0) {
      return (
        <span className={`inline-flex items-center ${sizeClasses} rounded-full font-medium bg-orange-100 text-orange-700`}>
          <span className={`${dotSize} rounded-full bg-orange-500`} />
          {locale === 'th'
            ? `ค้างส่ง ${po.totalRemaining}/${po.totalOrdered}`
            : `Remaining ${po.totalRemaining}/${po.totalOrdered}`
          }
        </span>
      )
    }
    return null
  }

  if (loading && !clinic) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 relative">
          <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
          <div className="absolute inset-0 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !clinic) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          {error || (locale === 'th' ? 'ไม่พบข้อมูลคลินิก' : 'Clinic not found')}
        </div>
        <Link
          href={`/${locale}/dashboard/clinics`}
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
      {/* Breadcrumb + Export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <nav className="flex items-center space-x-2 text-sm text-[var(--color-foreground-muted)]">
          <Link href={`/${locale}/dashboard`} className="hover:text-[var(--color-gold)] transition-colors">
            {locale === 'th' ? 'แดชบอร์ด' : 'Dashboard'}
          </Link>
          <span>/</span>
          <Link href={`/${locale}/dashboard/clinics`} className="hover:text-[var(--color-gold)] transition-colors">
            {locale === 'th' ? 'คลินิก' : 'Clinics'}
          </Link>
          <span>/</span>
          <span className="text-[var(--color-charcoal)]">{clinic.name}</span>
        </nav>
        <a
          href={`/api/admin/clinics/${id}/export?locale=${locale}`}
          download
          className="inline-flex items-center gap-2 px-4 py-2 border-2 border-[var(--color-charcoal)]/30 text-[var(--color-charcoal)] rounded-xl text-sm font-medium hover:bg-[var(--color-charcoal)]/5 transition-all duration-200 self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {locale === 'th' ? 'ส่งออก Excel' : 'Export Excel'}
        </a>
      </div>

      {/* Clinic Info Card */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-charcoal)]">{clinic.name}</h1>
            {clinic.companyName && (
              <p className="text-lg text-[var(--color-foreground-muted)] mt-1">{clinic.companyName}</p>
            )}
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${clinic.isActive ? 'bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]' : 'bg-gray-100 text-gray-600'}`}>
            {clinic.isActive ? (locale === 'th' ? 'ใช้งาน' : 'Active') : (locale === 'th' ? 'ไม่ใช้งาน' : 'Inactive')}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div>
            <p className="text-sm text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ที่อยู่' : 'Address'}</p>
            <p className="font-medium text-[var(--color-charcoal)] mt-0.5">{clinic.address}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--color-foreground-muted)]">{locale === 'th' ? 'สาขา' : 'Branch'}</p>
            <p className="font-medium text-[var(--color-charcoal)] mt-0.5">{clinic.branchName || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ชื่อออกบิล' : 'Invoice Name'}</p>
            <p className="font-medium text-[var(--color-charcoal)] mt-0.5">{clinic.invoiceName || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ผู้ติดต่อ' : 'Contact'}</p>
            <p className="font-medium text-[var(--color-charcoal)] mt-0.5">
              {clinic.contactName || '-'}
              {clinic.contactPhone && (
                <span className="block text-sm text-[var(--color-foreground-muted)]">{clinic.contactPhone}</span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[var(--color-beige)]">
          <p className="text-sm text-[var(--color-foreground-muted)]">
            {locale === 'th' ? 'สร้างเมื่อ' : 'Created'}: {formatDate(clinic.createdAt)}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="space-y-4">
          <p className="text-lg text-[var(--color-charcoal)] pl-2">{locale === 'th' ? 'จำนวนใบรายการส่งออก' : 'Number Total Delivery'}</p>
          {/* Outbound Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <div className="bg-[var(--color-off-white)] rounded-xl p-4 border border-[var(--color-beige)]">
              <p className="text-sm text-[var(--color-charcoal)]">{locale === 'th' ? 'ส่งออกทั้งหมด' : 'Total Outbounds'}</p>
              <p className="text-2xl font-bold text-[var(--color-charcoal)] mt-1">{stats.totalOutbounds.toLocaleString()} รายการ</p>
            </div>
            <div className="bg-[var(--color-mint)]/10 rounded-xl p-4 border border-[var(--color-mint)]/20">
              <p className="text-sm text-[var(--color-mint-dark)]">{locale === 'th' ? 'อนุมัติแล้ว' : 'Approved'}</p>
              <p className="text-2xl font-bold text-[var(--color-mint-dark)] mt-1">{stats.approvedOutbounds.toLocaleString()} รายการ</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <p className="text-sm text-amber-600">{locale === 'th' ? 'รอดำเนินการ' : 'Pending'}</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{stats.pendingOutbounds} รายการ</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 border border-red-200">
              <p className="text-sm text-red-600">{locale === 'th' ? 'ถูกปฏิเสธ' : 'Rejected'}</p>
              <p className="text-2xl font-bold text-red-700 mt-1">{stats.rejectedOutbounds} รายการ</p>
            </div>
          </div>

          {/* PO / Item Stats */}
          <p className="text-lg text-[var(--color-charcoal)] pl-2">{locale === 'th' ? 'จำนวนสินค้าส่งออก' : 'Number Total Outbounds'}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <p className="text-sm text-blue-600">{locale === 'th' ? 'สั่งทั้งหมด (PO)' : 'Total Ordered (PO)'}</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">{stats.poTotalOrdered.toLocaleString()} ชิ้น</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
              <p className="text-sm text-purple-600">{locale === 'th' ? 'ส่งแล้ว (PO)' : 'Shipped (PO)'}</p>
              <p className="text-2xl font-bold text-purple-700 mt-1">{stats.poTotalShipped.toLocaleString()} ชิ้น</p>
            </div>
            <div className={`rounded-xl p-4 border ${stats.poRemaining > 0 ? 'bg-orange-50 border-orange-300' : 'bg-[var(--color-mint)]/10 border-[var(--color-mint)]/20'}`}>
              <p className={`text-sm ${stats.poRemaining > 0 ? 'text-orange-600' : 'text-[var(--color-mint-dark)]'}`}>
                {locale === 'th' ? 'คงเหลือค้างส่ง' : 'Remaining'}
              </p>
              <p className={`text-2xl font-bold mt-1 ${stats.poRemaining > 0 ? 'text-orange-700' : 'text-[var(--color-mint-dark)]'}`}>
                {stats.poRemaining.toLocaleString()} ชิ้น
              </p>
            </div>
            <div className="bg-[var(--color-off-white)] rounded-xl p-4 border border-[var(--color-beige)]">
              <p className="text-sm text-[var(--color-charcoal)]">{locale === 'th' ? 'สินค้าใน Outbound' : 'Outbound Items'}</p>
              <p className="text-2xl font-bold text-[var(--color-charcoal)] mt-1">{stats.totalItems.toLocaleString()} ชิ้น</p>
            </div>
          </div>
        </div>
      )}

      {/* Outbound Table */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
        {/* Header & Filter */}
        <div className="p-4 sm:p-5 border-b border-[var(--color-beige)] space-y-4">
          <h2 className="text-lg font-semibold text-[var(--color-charcoal)]">
            {locale === 'th' ? 'รายการส่งออก' : 'Outbound Deliveries'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {([
              { value: 'all', label: locale === 'th' ? 'ทั้งหมด' : 'All' },
              { value: 'PENDING', label: locale === 'th' ? 'รออนุมัติ' : 'Pending' },
              { value: 'APPROVED', label: locale === 'th' ? 'อนุมัติแล้ว' : 'Approved' },
              { value: 'REJECTED', label: locale === 'th' ? 'ถูกปฏิเสธ' : 'Rejected' },
            ] as const).map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setStatusFilter(tab.value)
                  setPORemainingFilter(false)
                  setCurrentPage(1)
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  statusFilter === tab.value && !poRemainingFilter
                    ? tab.value === 'REJECTED'
                      ? 'bg-red-500 text-white shadow-sm'
                      : tab.value === 'APPROVED'
                      ? 'bg-[var(--color-mint)] text-white shadow-sm'
                      : tab.value === 'PENDING'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-[var(--color-gold)] text-white shadow-sm'
                    : 'bg-[var(--color-off-white)] text-[var(--color-foreground-muted)] hover:bg-[var(--color-beige)] hover:text-[var(--color-charcoal)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <button
              onClick={() => {
                setPORemainingFilter(true)
                setStatusFilter('all')
                setCurrentPage(1)
              }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                poRemainingFilter
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-[var(--color-off-white)] text-[var(--color-foreground-muted)] hover:bg-[var(--color-beige)] hover:text-[var(--color-charcoal)]'
              }`}
            >
              {locale === 'th' ? 'ค้างส่ง' : 'Remaining'}
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 relative">
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-mint)] border-t-transparent animate-spin" />
            </div>
            <p className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'กำลังโหลด...' : 'Loading...'}</p>
          </div>
        ) : outbounds.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-beige)]/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
            <p className="text-[var(--color-foreground-muted)]">
              {locale === 'th' ? 'ไม่พบรายการส่งออก' : 'No outbound records found'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-[var(--color-beige)]">
              {outbounds.map((ob) => (
                <Link
                  key={ob.id}
                  href={`/${locale}/dashboard/outbound/${ob.id}`}
                  className="block p-4 hover:bg-[var(--color-off-white)]/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono font-medium text-[var(--color-gold)]">
                          {ob.deliveryNoteNo}
                        </span>
                        {getStatusBadge(ob.status, 'sm')}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-[var(--color-foreground-muted)]">
                        <span>{formatDate(ob.createdAt)}</span>
                        <span>{ob.shippingMethod.nameTh}</span>
                        <span>{ob._count.lines} {locale === 'th' ? 'รายการ' : 'items'}</span>
                      </div>
                      {ob.purchaseOrder && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-gold)]/10 text-[var(--color-gold-dark)]">
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {ob.purchaseOrder.poNo}
                          </span>
                          {getShipmentBadge(ob.purchaseOrder, 'sm')}
                        </div>
                      )}
                      {ob.status === 'REJECTED' && ob.rejectReason && (
                        <div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-100">
                          <p className="text-xs font-medium text-red-700 mb-0.5">
                            {locale === 'th' ? 'เหตุผลที่ปฏิเสธ:' : 'Rejection reason:'}
                          </p>
                          <p className="text-xs text-red-600">{ob.rejectReason}</p>
                        </div>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-[var(--color-foreground-muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">Delivery No.</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'วันที่สร้าง' : 'Created'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      PO No.
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'วิธีส่ง' : 'Shipping'}
                    </th>
                    <th className="px-5 py-4 text-center text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'จำนวน' : 'Items'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'สถานะ' : 'Status'}
                    </th>
                    <th className="px-5 py-4 text-right text-sm font-semibold text-[var(--color-charcoal)]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-beige)]">
                  {outbounds.map((ob) => (
                    <tr key={ob.id} className={`hover:bg-[var(--color-off-white)]/50 transition-colors ${ob.status === 'REJECTED' ? 'bg-red-50/30' : ''}`}>
                      <td className="px-5 py-4">
                        <Link
                          href={`/${locale}/dashboard/outbound/${ob.id}`}
                          className="font-mono font-medium text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] transition-colors"
                        >
                          {ob.deliveryNoteNo}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">
                        {formatDate(ob.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        {ob.purchaseOrder ? (
                          <div className="space-y-1">
                            <span className="font-mono text-sm text-[var(--color-charcoal)]">
                              {ob.purchaseOrder.poNo}
                            </span>
                            {getShipmentBadge(ob.purchaseOrder)}
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--color-foreground-muted)]">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">
                        {ob.shippingMethod.nameTh}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2rem] h-8 rounded-lg bg-[var(--color-beige)]/50 font-medium text-sm px-2">
                          {ob._count.lines}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          {getStatusBadge(ob.status)}
                          {ob.status === 'REJECTED' && ob.rejectReason && (
                            <div className="group relative">
                              <p className="text-xs text-red-600 truncate max-w-[200px] cursor-help" title={ob.rejectReason}>
                                {ob.rejectReason}
                              </p>
                              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10">
                                <div className="bg-red-800 text-white text-xs rounded-lg px-3 py-2 max-w-xs shadow-lg">
                                  <p className="font-medium mb-1">{locale === 'th' ? 'เหตุผลที่ปฏิเสธ:' : 'Rejection reason:'}</p>
                                  <p>{ob.rejectReason}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
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
          </>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 sm:px-5 py-4 border-t border-[var(--color-beige)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--color-off-white)]">
            <span className="text-sm text-[var(--color-foreground-muted)] order-2 sm:order-1">
              {locale === 'th' ? `หน้า ${pagination.page} จาก ${pagination.totalPages}` : `Page ${pagination.page} of ${pagination.totalPages}`}
            </span>
            <div className="flex items-center gap-2 order-1 sm:order-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page === 1}
                className="flex items-center gap-1 px-3 sm:px-4 py-2 text-sm font-medium text-[var(--color-charcoal)] border border-[var(--color-beige)] rounded-lg hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-50 disabled:hover:border-[var(--color-beige)] disabled:hover:text-[var(--color-charcoal)] transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">{locale === 'th' ? 'ก่อนหน้า' : 'Previous'}</span>
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page === pagination.totalPages}
                className="flex items-center gap-1 px-3 sm:px-4 py-2 text-sm font-medium text-[var(--color-charcoal)] border border-[var(--color-beige)] rounded-lg hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-50 disabled:hover:border-[var(--color-beige)] disabled:hover:text-[var(--color-charcoal)] transition-all"
              >
                <span className="hidden sm:inline">{locale === 'th' ? 'ถัดไป' : 'Next'}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
