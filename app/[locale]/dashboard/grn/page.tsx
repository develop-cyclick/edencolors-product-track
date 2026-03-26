'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const handleExportGRN = async (
  locale: string,
  statusFilter: StatusFilter,
  search: string,
  setExporting: (v: boolean) => void,
) => {
  setExporting(true)
  try {
    const res = await fetch('/api/warehouse/grn/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locale,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: search || undefined,
      }),
    })
    if (!res.ok) throw new Error('Export failed')
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `grn-report-${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch {
    console.error('Export failed')
  } finally {
    setExporting(false)
  }
}

interface GRN {
  id: number
  grnNo: string
  receivedAt: string
  supplierName: string
  poNo: string | null
  remarks: string | null
  approvedAt: string | null
  rejectedAt: string | null
  rejectReason: string | null
  receivingStatus?: 'PARTIAL' | 'COMPLETE'
  warehouse: { id: number; name: string }
  receivedBy: { id: number; displayName: string }
  approvedBy: { id: number; displayName: string } | null
  rejectedBy: { id: number; displayName: string } | null
  _count: { lines: number }
  planLines?: Array<{ totalQty: number; receivedQty: number }>
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

interface ApiResponse {
  success: boolean
  data: {
    items: GRN[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
}

export default function GRNListPage() {
  const params = useParams()
  const locale = params.locale as string

  const [grns, setGrns] = useState<GRN[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetchGRNs()
  }, [page, search, statusFilter])

  // Helper to get GRN status
  const getGRNStatus = (grn: GRN): 'approved' | 'rejected' | 'pending' => {
    if (grn.approvedAt) return 'approved'
    if (grn.rejectedAt) return 'rejected'
    return 'pending'
  }

  // Filter GRNs by status (client-side filter since API may not support it yet)
  const filteredGrns = statusFilter === 'all'
    ? grns
    : grns.filter(grn => getGRNStatus(grn) === statusFilter)

  const fetchGRNs = async () => {
    setLoading(true)
    try {
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : ''
      const res = await fetch(`/api/warehouse/grn?page=${page}&limit=20${searchParam}`)
      const data: ApiResponse = await res.json()
      if (data.success) {
        setGrns(data.data.items)
        setTotalPages(data.data.pagination.totalPages)
      }
    } catch (error) {
      console.error('Failed to fetch GRNs:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-display text-xl sm:text-2xl font-bold text-[var(--color-charcoal)]">
            {locale === 'th' ? 'รายการรับเข้าคลัง' : 'Goods Received Notes'}
          </h1>
          <p className="text-sm text-[var(--color-foreground-muted)] mt-1">
            {locale === 'th' ? 'จัดการใบรับสินค้าเข้าคลัง (GRN)' : 'Manage goods received notes'}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => handleExportGRN(locale, statusFilter, search, setExporting)}
            disabled={exporting}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-charcoal)] text-white rounded-xl font-medium hover:bg-[var(--color-charcoal)]/90 disabled:opacity-50 transition-all duration-200"
          >
            {exporting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            {exporting
              ? (locale === 'th' ? 'กำลังส่งออก...' : 'Exporting...')
              : (locale === 'th' ? 'ส่งออก Excel' : 'Export Excel')
            }
          </button>
          <Link
            href={`/${locale}/dashboard/grn/new`}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--color-gold)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(201,163,90,0.35)] transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {locale === 'th' ? 'สร้างใบรับสินค้า' : 'Create GRN'}
          </Link>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-4 sm:p-5 space-y-4">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-foreground-muted)]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder={locale === 'th' ? 'ค้นหา GRN No., Supplier, PO...' : 'Search GRN No., Supplier, PO...'}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full pl-12 pr-4 py-3 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {([
            { value: 'all', label: locale === 'th' ? 'ทั้งหมด' : 'All' },
            { value: 'pending', label: locale === 'th' ? 'รออนุมัติ' : 'Pending' },
            { value: 'approved', label: locale === 'th' ? 'อนุมัติแล้ว' : 'Approved' },
            { value: 'rejected', label: locale === 'th' ? 'ถูกปฏิเสธ' : 'Rejected' },
          ] as const).map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatusFilter(tab.value)
                setPage(1)
              }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                statusFilter === tab.value
                  ? tab.value === 'rejected'
                    ? 'bg-red-500 text-white shadow-sm'
                    : tab.value === 'approved'
                    ? 'bg-[var(--color-mint)] text-white shadow-sm'
                    : tab.value === 'pending'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-[var(--color-gold)] text-white shadow-sm'
                  : 'bg-[var(--color-off-white)] text-[var(--color-foreground-muted)] hover:bg-[var(--color-beige)] hover:text-[var(--color-charcoal)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 relative">
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin" />
            </div>
            <p className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'กำลังโหลด...' : 'Loading...'}</p>
          </div>
        ) : grns.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-beige)]/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
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
              {filteredGrns.map((grn) => {
                const status = getGRNStatus(grn)
                return (
                  <Link
                    key={grn.id}
                    href={`/${locale}/dashboard/grn/${grn.id}`}
                    className="block p-4 hover:bg-[var(--color-off-white)]/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-mono font-medium text-[var(--color-gold)]">
                            {grn.grnNo}
                          </span>
                          {status === 'approved' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]">
                              <span className="w-1 h-1 rounded-full bg-[var(--color-mint)]" />
                              {locale === 'th' ? 'อนุมัติ' : 'Approved'}
                            </span>
                          ) : status === 'rejected' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                              <span className="w-1 h-1 rounded-full bg-red-500" />
                              {locale === 'th' ? 'ถูกปฏิเสธ' : 'Rejected'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                              <span className="w-1 h-1 rounded-full bg-amber-500" />
                              {locale === 'th' ? 'รอ' : 'Pending'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-[var(--color-charcoal)] truncate">
                          {grn.supplierName}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-[var(--color-foreground-muted)]">
                          <span>{formatDate(grn.receivedAt)}</span>
                          <span>{grn.warehouse.name}</span>
                          <span>
                            {grn.planLines && grn.planLines.length > 0
                              ? `${grn.planLines.reduce((s, pl) => s + pl.receivedQty, 0)}/${grn.planLines.reduce((s, pl) => s + pl.totalQty, 0)} ${locale === 'th' ? 'รายการ' : 'items'}`
                              : `${grn._count.lines} ${locale === 'th' ? 'รายการ' : 'items'}`
                            }
                          </span>
                          {grn.receivingStatus === 'PARTIAL' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700">
                              <span className="w-1 h-1 rounded-full bg-orange-500" />
                              {locale === 'th' ? 'รับบางส่วน' : 'Partial'}
                            </span>
                          )}
                        </div>
                        {/* Rejection Reason for Mobile */}
                        {status === 'rejected' && grn.rejectReason && (
                          <div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-100">
                            <p className="text-xs font-medium text-red-700 mb-0.5">
                              {locale === 'th' ? 'เหตุผลที่ปฏิเสธ:' : 'Rejection reason:'}
                            </p>
                            <p className="text-xs text-red-600">{grn.rejectReason}</p>
                          </div>
                        )}
                      </div>
                      <svg className="w-5 h-5 text-[var(--color-foreground-muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">GRN No.</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'วันที่รับ' : 'Received Date'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">Supplier</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'คลัง' : 'Warehouse'}
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
                  {filteredGrns.map((grn) => {
                    const status = getGRNStatus(grn)
                    return (
                      <tr key={grn.id} className={`hover:bg-[var(--color-off-white)]/50 transition-colors ${status === 'rejected' ? 'bg-red-50/30' : ''}`}>
                        <td className="px-5 py-4">
                          <Link
                            href={`/${locale}/dashboard/grn/${grn.id}`}
                            className="font-mono font-medium text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] transition-colors"
                          >
                            {grn.grnNo}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">
                          {formatDate(grn.receivedAt)}
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-[var(--color-charcoal)]">
                          {grn.supplierName}
                        </td>
                        <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">
                          {grn.warehouse.name}
                        </td>
                        <td className="px-5 py-4 text-sm text-[var(--color-charcoal)] text-center">
                          {grn.planLines && grn.planLines.length > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-[3rem] px-2 h-8 rounded-lg bg-[var(--color-beige)]/50 font-medium text-xs">
                              {grn.planLines.reduce((s, pl) => s + pl.receivedQty, 0)}/{grn.planLines.reduce((s, pl) => s + pl.totalQty, 0)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-beige)]/50 font-medium">
                              {grn._count.lines}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            {status === 'approved' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-mint)]" />
                                {locale === 'th' ? 'อนุมัติแล้ว' : 'Approved'}
                              </span>
                            ) : status === 'rejected' ? (
                              <div className="space-y-1.5">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                  {locale === 'th' ? 'ถูกปฏิเสธ' : 'Rejected'}
                                </span>
                                {grn.rejectReason && (
                                  <div className="group relative">
                                    <p className="text-xs text-red-600 truncate max-w-[200px] cursor-help" title={grn.rejectReason}>
                                      {grn.rejectReason}
                                    </p>
                                    {/* Tooltip for full reason */}
                                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10">
                                      <div className="bg-red-800 text-white text-xs rounded-lg px-3 py-2 max-w-xs shadow-lg">
                                        <p className="font-medium mb-1">{locale === 'th' ? 'เหตุผลที่ปฏิเสธ:' : 'Rejection reason:'}</p>
                                        <p>{grn.rejectReason}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                {locale === 'th' ? 'รออนุมัติ' : 'Pending'}
                              </span>
                            )}
                            {grn.receivingStatus === 'PARTIAL' && grn.planLines && grn.planLines.length > 0 && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                {locale === 'th'
                                  ? `รับบางส่วน ${grn.planLines.reduce((s, pl) => s + pl.receivedQty, 0)}/${grn.planLines.reduce((s, pl) => s + pl.totalQty, 0)}`
                                  : `Partial ${grn.planLines.reduce((s, pl) => s + pl.receivedQty, 0)}/${grn.planLines.reduce((s, pl) => s + pl.totalQty, 0)}`
                                }
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
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
                    )
                  })}
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
