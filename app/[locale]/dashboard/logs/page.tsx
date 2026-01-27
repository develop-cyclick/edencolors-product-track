'use client'

import { useState, useEffect, Fragment } from 'react'
import { useParams } from 'next/navigation'

interface EventLog {
  id: number
  eventType: string
  productItem: {
    id: number
    serial12: string
    name: string
  } | null
  user: {
    id: number
    displayName: string
    role: string
  } | null
  details: Record<string, unknown> | null
  createdAt: string
}

const EVENT_TYPES = [
  { value: '', labelTh: 'ทุกประเภท', labelEn: 'All Types' },
  { value: 'INBOUND', labelTh: 'รับเข้าคลัง', labelEn: 'Inbound' },
  { value: 'OUTBOUND', labelTh: 'ส่งออก', labelEn: 'Outbound' },
  { value: 'APPROVE', labelTh: 'อนุมัติ', labelEn: 'Approve' },
  { value: 'REJECT', labelTh: 'ปฏิเสธ', labelEn: 'Reject' },
  { value: 'REPRINT', labelTh: 'พิมพ์ใหม่', labelEn: 'Reprint' },
  { value: 'RETURN', labelTh: 'รับคืน', labelEn: 'Return' },
  { value: 'ACTIVATE', labelTh: 'ลงทะเบียน', labelEn: 'Activate' },
  { value: 'SCAN', labelTh: 'สแกน', labelEn: 'Scan' },
]

const EVENT_TYPE_STYLES: Record<string, { bg: string; dot: string }> = {
  INBOUND: { bg: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  OUTBOUND: { bg: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  APPROVE: { bg: 'bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]', dot: 'bg-[var(--color-mint)]' },
  REJECT: { bg: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  REPRINT: { bg: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  RETURN: { bg: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  ACTIVATE: { bg: 'bg-teal-100 text-teal-700', dot: 'bg-teal-500' },
  SCAN: { bg: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' },
}

export default function EventLogsPage() {
  const params = useParams()
  const locale = params.locale as string

  const [logs, setLogs] = useState<EventLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  })

  // Filters
  const [eventType, setEventType] = useState('')
  const [serial, setSerial] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Expanded log details
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null)

  const inputClass = "w-full px-4 py-2.5 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
  const labelClass = "block text-sm font-medium text-[var(--color-charcoal)] mb-1.5"
  const selectClass = "appearance-none w-full px-4 py-2.5 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] pr-10"

  const loadLogs = async (page = 1) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '30',
      })

      if (eventType) params.append('eventType', eventType)
      if (serial) params.append('serial', serial)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const res = await fetch(`/api/admin/event-logs?${params}`)
      const data = await res.json()

      if (data.success) {
        setLogs(data.data.items)
        setPagination({
          page: data.data.pagination.page,
          totalPages: data.data.pagination.totalPages,
          total: data.data.pagination.total,
        })
      }
    } catch (error) {
      console.error('Load logs error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [])

  const handleFilter = () => {
    loadLogs(1)
  }

  const handleClearFilters = () => {
    setEventType('')
    setSerial('')
    setStartDate('')
    setEndDate('')
    loadLogs(1)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const formatDetails = (details: Record<string, unknown> | null) => {
    if (!details) return null
    return Object.entries(details).map(([key, value]) => (
      <div key={key} className="flex gap-4 py-1">
        <span className="text-[var(--color-foreground-muted)] min-w-[140px] text-sm">{key}:</span>
        <span className="text-[var(--color-charcoal)] text-sm">
          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
        </span>
      </div>
    ))
  }

  const getEventBadge = (type: string) => {
    const style = EVENT_TYPE_STYLES[type] || { bg: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' }
    const label = EVENT_TYPES.find((t) => t.value === type)
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${style.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
        {locale === 'th' ? label?.labelTh || type : label?.labelEn || type}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-display text-2xl font-bold text-[var(--color-charcoal)]">
          {locale === 'th' ? 'Event Logs' : 'Event Logs'}
        </h1>
        <p className="text-[var(--color-foreground-muted)] mt-1">
          {locale === 'th' ? 'ประวัติการดำเนินการทั้งหมดในระบบ' : 'All system activity history'}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-4 md:p-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          <div className="relative col-span-2 md:col-span-1">
            <label className={labelClass}>
              {locale === 'th' ? 'ประเภท Event' : 'Event Type'}
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className={selectClass}
            >
              {EVENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {locale === 'th' ? type.labelTh : type.labelEn}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-[38px] pointer-events-none text-[var(--color-foreground-muted)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="col-span-2 md:col-span-1">
            <label className={labelClass}>Serial</label>
            <input
              type="text"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder={locale === 'th' ? 'ค้นหา Serial' : 'Search Serial'}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              {locale === 'th' ? 'ตั้งแต่' : 'From'}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              {locale === 'th' ? 'ถึง' : 'To'}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="col-span-2 md:col-span-1 flex items-end gap-2">
            <button
              onClick={handleFilter}
              className="flex-1 px-4 py-2.5 bg-[var(--color-gold)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(201,163,90,0.35)] transition-all duration-200"
            >
              {locale === 'th' ? 'ค้นหา' : 'Search'}
            </button>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2.5 border border-[var(--color-beige)] text-[var(--color-charcoal)] rounded-xl font-medium hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] transition-all duration-200"
            >
              {locale === 'th' ? 'ล้าง' : 'Clear'}
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 relative">
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin" />
            </div>
            <p className="text-[var(--color-foreground-muted)]">
              {locale === 'th' ? 'กำลังโหลด...' : 'Loading...'}
            </p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-beige)]/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
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
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 hover:bg-[var(--color-off-white)]/50 cursor-pointer transition-colors"
                  onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    {getEventBadge(log.eventType)}
                    <span className="text-xs text-[var(--color-foreground-muted)]">
                      {formatDate(log.createdAt)}
                    </span>
                  </div>

                  {log.productItem && (
                    <div className="mb-2">
                      <span className="font-mono text-sm text-[var(--color-gold)]">
                        {log.productItem.serial12}
                      </span>
                      <p className="text-xs text-[var(--color-foreground-muted)]">
                        {log.productItem.name}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-charcoal)]">
                      {log.user?.displayName || (locale === 'th' ? 'ระบบ' : 'System')}
                    </span>
                    {log.details && (
                      <svg
                        className={`w-4 h-4 text-[var(--color-foreground-muted)] transition-transform duration-200 ${
                          expandedLogId === log.id ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </div>

                  {expandedLogId === log.id && log.details && (
                    <div className="mt-3 pt-3 border-t border-[var(--color-beige)] border-l-4 border-l-[var(--color-gold)] pl-3">
                      {formatDetails(log.details)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'เวลา' : 'Time'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'ประเภท' : 'Type'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'สินค้า' : 'Product'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'ผู้ดำเนินการ' : 'User'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'รายละเอียด' : 'Details'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-beige)]">
                  {logs.map((log) => (
                    <Fragment key={log.id}>
                      <tr
                        className="hover:bg-[var(--color-off-white)]/50 cursor-pointer transition-colors"
                        onClick={() =>
                          setExpandedLogId(expandedLogId === log.id ? null : log.id)
                        }
                      >
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-[var(--color-foreground-muted)]">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {getEventBadge(log.eventType)}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {log.productItem ? (
                            <div>
                              <div className="font-mono text-sm text-[var(--color-gold)]">
                                {log.productItem.serial12}
                              </div>
                              <div className="text-xs text-[var(--color-foreground-muted)]">
                                {log.productItem.name}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[var(--color-foreground-muted)]">-</span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {log.user ? (
                            <div>
                              <div className="text-sm text-[var(--color-charcoal)]">{log.user.displayName}</div>
                              <div className="text-xs text-[var(--color-foreground-muted)]">{log.user.role}</div>
                            </div>
                          ) : (
                            <span className="text-[var(--color-foreground-muted)]">
                              {locale === 'th' ? 'ระบบ' : 'System'}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">
                          <div className="flex items-center gap-2">
                            {log.details ? (
                              <>
                                <span className="truncate max-w-[200px]">
                                  {Object.keys(log.details).slice(0, 2).join(', ')}...
                                </span>
                                <svg
                                  className={`w-4 h-4 transition-transform duration-200 ${
                                    expandedLogId === log.id ? 'rotate-180' : ''
                                  }`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                  />
                                </svg>
                              </>
                            ) : (
                              <span className="text-[var(--color-foreground-muted)]">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedLogId === log.id && log.details && (
                        <tr>
                          <td colSpan={5} className="px-5 py-4 bg-[var(--color-off-white)]">
                            <div className="border-l-4 border-[var(--color-gold)] pl-4">
                              {formatDetails(log.details)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 md:px-5 py-4 border-t border-[var(--color-beige)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--color-off-white)]">
              <div className="text-sm text-[var(--color-foreground-muted)]">
                {locale === 'th'
                  ? `${pagination.page} / ${pagination.totalPages} (${pagination.total} รายการ)`
                  : `${pagination.page} / ${pagination.totalPages} (${pagination.total} records)`
                }
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadLogs(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[var(--color-charcoal)] border border-[var(--color-beige)] rounded-lg hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-50 disabled:hover:border-[var(--color-beige)] disabled:hover:text-[var(--color-charcoal)] transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="hidden sm:inline">{locale === 'th' ? 'ก่อนหน้า' : 'Previous'}</span>
                </button>
                <button
                  onClick={() => loadLogs(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[var(--color-charcoal)] border border-[var(--color-beige)] rounded-lg hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-50 disabled:hover:border-[var(--color-beige)] disabled:hover:text-[var(--color-charcoal)] transition-all"
                >
                  <span className="hidden sm:inline">{locale === 'th' ? 'ถัดไป' : 'Next'}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
