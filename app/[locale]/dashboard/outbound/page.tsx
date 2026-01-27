'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface Outbound {
  id: number
  deliveryNoteNo: string
  shippedAt: string | null
  status: string
  poNo: string | null
  approvedAt: string | null
  rejectReason: string | null
  createdAt: string
  warehouse: { id: number; name: string }
  shippingMethod: { id: number; nameTh: string }
  clinic: { id: number; name: string; province: string }
  createdBy: { id: number; displayName: string }
  approvedBy: { id: number; displayName: string } | null
  _count: { lines: number }
}

interface ApiResponse {
  success: boolean
  data: {
    items: Outbound[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
}

export default function OutboundListPage() {
  const params = useParams()
  const locale = params.locale as string

  const [outbounds, setOutbounds] = useState<Outbound[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    fetchOutbounds()
  }, [page, search, statusFilter])

  const fetchOutbounds = async () => {
    setLoading(true)
    try {
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : ''
      const statusParam = statusFilter ? `&status=${statusFilter}` : ''
      const res = await fetch(`/api/warehouse/outbound?page=${page}&limit=20${searchParam}${statusParam}`)
      const data: ApiResponse = await res.json()
      if (data.success) {
        setOutbounds(data.data.items)
        setTotalPages(data.data.pagination.totalPages)
      }
    } catch (error) {
      console.error('Failed to fetch Outbounds:', error)
    } finally {
      setLoading(false)
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

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-display text-xl sm:text-2xl font-bold text-[var(--color-charcoal)]">
            {locale === 'th' ? 'รายการส่งออก' : 'Outbound Deliveries'}
          </h1>
          <p className="text-sm text-[var(--color-foreground-muted)] mt-1">
            {locale === 'th' ? 'จัดการใบส่งสินค้าออกจากคลัง' : 'Manage outbound deliveries'}
          </p>
        </div>
        <Link
          href={`/${locale}/dashboard/outbound/new`}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--color-mint)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(115,207,199,0.3)] hover:bg-[var(--color-mint-dark)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(115,207,199,0.4)] transition-all duration-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
          {locale === 'th' ? 'สร้างใบส่งสินค้า' : 'Create Outbound'}
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="relative flex-1">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-foreground-muted)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder={locale === 'th' ? 'ค้นหา Delivery No., Clinic...' : 'Search...'}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full pl-12 pr-4 py-3 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
            />
          </div>
          <div className="relative sm:w-40">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="w-full appearance-none pl-4 pr-10 py-3 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
            >
              <option value="">{locale === 'th' ? 'ทุกสถานะ' : 'All Status'}</option>
              <option value="DRAFT">{locale === 'th' ? 'ฉบับร่าง' : 'Draft'}</option>
              <option value="PENDING">{locale === 'th' ? 'รออนุมัติ' : 'Pending'}</option>
              <option value="APPROVED">{locale === 'th' ? 'อนุมัติแล้ว' : 'Approved'}</option>
              <option value="REJECTED">{locale === 'th' ? 'ปฏิเสธ' : 'Rejected'}</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-foreground-muted)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
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
              {locale === 'th' ? 'ไม่พบรายการ' : 'No records found'}
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
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-medium text-[var(--color-gold)]">
                          {ob.deliveryNoteNo}
                        </span>
                        {getStatusBadge(ob.status, 'sm')}
                      </div>
                      <p className="text-sm font-medium text-[var(--color-charcoal)] truncate">
                        {ob.clinic.name}
                      </p>
                      <p className="text-xs text-[var(--color-foreground-muted)]">
                        {ob.clinic.province}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-[var(--color-foreground-muted)]">
                        <span>{formatDate(ob.createdAt)}</span>
                        <span>{ob.shippingMethod.nameTh}</span>
                        <span>{ob._count.lines} {locale === 'th' ? 'รายการ' : 'items'}</span>
                      </div>
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
                      {locale === 'th' ? 'คลินิก' : 'Clinic'}
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
                    <tr key={ob.id} className="hover:bg-[var(--color-off-white)]/50 transition-colors">
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
                        <div className="text-sm font-medium text-[var(--color-charcoal)]">{ob.clinic.name}</div>
                        <div className="text-xs text-[var(--color-foreground-muted)]">{ob.clinic.province}</div>
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">
                        {ob.shippingMethod.nameTh}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-beige)]/50 font-medium text-sm">
                          {ob._count.lines}
                        </span>
                      </td>
                      <td className="px-5 py-4">{getStatusBadge(ob.status)}</td>
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
        {totalPages > 1 && (
          <div className="px-4 sm:px-5 py-4 border-t border-[var(--color-beige)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--color-off-white)]">
            <span className="text-sm text-[var(--color-foreground-muted)] order-2 sm:order-1">
              {locale === 'th' ? `หน้า ${page} จาก ${totalPages}` : `Page ${page} of ${totalPages}`}
            </span>
            <div className="flex items-center gap-2 order-1 sm:order-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 sm:px-4 py-2 text-sm font-medium text-[var(--color-charcoal)] border border-[var(--color-beige)] rounded-lg hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-50 disabled:hover:border-[var(--color-beige)] disabled:hover:text-[var(--color-charcoal)] transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">{locale === 'th' ? 'ก่อนหน้า' : 'Previous'}</span>
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
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
