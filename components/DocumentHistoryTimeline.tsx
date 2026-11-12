'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatDateTime as gDateTime } from '@/lib/format-date'

interface HistoryEvent {
  id: number
  eventType: string
  user: { displayName: string; username: string } | null
  details: Record<string, unknown> | null
  createdAt: string
}

interface Props {
  documentType: 'OUTBOUND' | 'GRN' | 'BORROW' | 'DAMAGED_CLAIM' | 'DAMAGED_ACTION'
  documentId: number | string
  locale: string
  /** bump this to force a refetch after an action (reopen/approve) */
  refreshKey?: number
}

const LABELS: Record<string, { th: string; en: string; dot: string }> = {
  APPROVE: { th: 'อนุมัติ', en: 'Approved', dot: 'bg-green-500' },
  BORROW: { th: 'อนุมัติ (ยืม)', en: 'Approved (borrow)', dot: 'bg-green-500' },
  BORROW_RETURN: { th: 'อนุมัติ (คืน)', en: 'Approved (return)', dot: 'bg-green-500' },
  REQUISITION_OUT: { th: 'อนุมัติ (เบิกใช้)', en: 'Approved (requisition)', dot: 'bg-green-500' },
  RETURN: { th: 'อนุมัติ (รับคืน)', en: 'Approved (return)', dot: 'bg-green-500' },
  REPAIR: { th: 'อนุมัติ (คืนเข้าคลัง)', en: 'Approved (restore)', dot: 'bg-green-500' },
  SCRAP: { th: 'อนุมัติ (ทิ้ง)', en: 'Approved (scrap)', dot: 'bg-green-500' },
  REJECT: { th: 'ปฏิเสธ', en: 'Rejected', dot: 'bg-red-500' },
  REJECT_DAMAGED_ACTION: { th: 'ปฏิเสธ', en: 'Rejected', dot: 'bg-red-500' },
  REOPEN: { th: 'ดึงกลับมาแก้ไข', en: 'Reopened for editing', dot: 'bg-amber-500' },
  OUTBOUND_EDIT: { th: 'แก้ข้อมูลเอกสาร', en: 'Document edited', dot: 'bg-blue-500' },
  DOCUMENT_EDIT: { th: 'แก้ข้อมูลเอกสาร', en: 'Document edited', dot: 'bg-blue-500' },
}

function fmt(dateStr: string) {
  return gDateTime(dateStr)
}

export default function DocumentHistoryTimeline({ documentType, documentId, locale, refreshKey }: Props) {
  const [events, setEvents] = useState<HistoryEvent[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/warehouse/document-history?type=${documentType}&id=${documentId}`)
      const data = await res.json()
      if (data.success) setEvents(data.data.history || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [documentType, documentId])

  useEffect(() => { load() }, [load, refreshKey])

  if (loading) {
    return <p className="text-sm text-[var(--color-foreground-muted)]">{locale === 'th' ? 'กำลังโหลดประวัติ...' : 'Loading history...'}</p>
  }
  if (events.length === 0) {
    return <p className="text-sm text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ยังไม่มีประวัติ' : 'No history yet'}</p>
  }

  return (
    <div className="space-y-0">
      {events.map((e, i) => {
        const label = LABELS[e.eventType] || { th: e.eventType, en: e.eventType, dot: 'bg-[var(--color-beige)]' }
        const d = (e.details || {}) as Record<string, unknown>
        const reason = (d.reason as string) || (d.rejectReason as string) || (d.rejectedReason as string) || ''
        const changes = d.changes as Record<string, { from: unknown; to: unknown }> | undefined
        return (
          <div key={e.id} className="flex gap-3">
            {/* dot + connecting line */}
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full ${label.dot} mt-1.5 shrink-0`} />
              {i < events.length - 1 && <div className="w-0.5 flex-1 bg-[var(--color-beige)] my-1" />}
            </div>
            <div className="pb-4 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-[var(--color-charcoal)]">{locale === 'th' ? label.th : label.en}</span>
                <span className="text-xs text-[var(--color-foreground-muted)]">{fmt(e.createdAt)}</span>
              </div>
              {e.user && (
                <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">
                  {locale === 'th' ? 'โดย' : 'by'} {e.user.displayName}
                </p>
              )}
              {reason && (
                <p className="text-xs text-[var(--color-charcoal)] mt-1">
                  {locale === 'th' ? 'เหตุผล: ' : 'Reason: '}{reason}
                </p>
              )}
              {changes && Object.keys(changes).length > 0 && (
                <ul className="text-xs text-[var(--color-foreground-muted)] mt-1 list-disc ml-4">
                  {Object.entries(changes).map(([field, c]) => (
                    <li key={field}>
                      <span className="font-mono">{field}</span>: {String(c.from ?? '—')} → {String(c.to ?? '—')}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
