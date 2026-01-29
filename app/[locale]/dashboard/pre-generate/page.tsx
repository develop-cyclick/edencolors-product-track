'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface PreGenItem {
  id: number
  serial12: string
  qrToken: string | null
  createdAt: string
  isLinked?: boolean
  status?: string
}

interface CreateResultItem {
  productItemId: number
  serialNumber: string
  qrToken: string
}

interface PreGenBatch {
  id: number
  batchNo: string
  quantity: number
  linkedCount: number
  totalItems: number
  createdBy: { id: number; displayName: string }
  remarks: string | null
  createdAt: string
}

interface CreateResult {
  id: number
  batchNo: string
  quantity: number
  items: CreateResultItem[]
}

export default function PreGeneratePage() {
  const params = useParams()
  const locale = params.locale as string

  const [batches, setBatches] = useState<PreGenBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [quantity, setQuantity] = useState(10)
  const [remarks, setRemarks] = useState('')
  const [createResult, setCreateResult] = useState<CreateResult | null>(null)
  const [selectedBatch, setSelectedBatch] = useState<{ batch: PreGenBatch; items: PreGenItem[] } | null>(null)
  const [loadingBatch, setLoadingBatch] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    fetchBatches()
  }, [])

  const fetchBatches = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/warehouse/pre-generate')
      const data = await res.json()
      if (data.success) {
        setBatches(data.data.items)
      }
    } catch (error) {
      console.error('Failed to fetch batches:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (quantity < 1 || quantity > 100) {
      alert(locale === 'th' ? 'จำนวนต้องอยู่ระหว่าง 1-100' : 'Quantity must be between 1-100')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/warehouse/pre-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity, remarks: remarks || undefined }),
      })

      const data = await res.json()
      if (data.success) {
        setCreateResult(data.data)
        setQuantity(10)
        setRemarks('')
        fetchBatches()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch {
      alert('Failed to create batch')
    } finally {
      setCreating(false)
    }
  }

  const viewBatchDetail = async (batch: PreGenBatch) => {
    setLoadingBatch(true)
    try {
      const res = await fetch(`/api/warehouse/pre-generate/${batch.id}`)
      const data = await res.json()
      if (data.success) {
        setSelectedBatch({ batch, items: data.data.items })
      }
    } catch (error) {
      console.error('Failed to fetch batch detail:', error)
    } finally {
      setLoadingBatch(false)
    }
  }

  const downloadLabels = async (productItemIds: number[], batchNo: string) => {
    setDownloading(true)
    try {
      const res = await fetch('/api/warehouse/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productItemIds, layout: 'grid' }),
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `labels-${batchNo}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        alert('Failed to generate labels')
      }
    } catch {
      alert('Failed to download labels')
    } finally {
      setDownloading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-display text-2xl font-bold text-[var(--color-charcoal)]">
          {locale === 'th' ? 'สร้าง QR ล่วงหน้า' : 'Pre-Generate QR'}
        </h1>
        <p className="text-[var(--color-foreground-muted)] mt-1">
          {locale === 'th'
            ? 'สร้าง QR Code ล่วงหน้าเพื่อพิมพ์ก่อนรับสินค้าเข้าคลัง'
            : 'Pre-generate QR codes for printing before receiving products'}
        </p>
      </div>

      {/* Create Form */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-6">
        <h2 className="text-display font-semibold text-[var(--color-charcoal)] mb-4">
          {locale === 'th' ? 'สร้าง Batch ใหม่' : 'Create New Batch'}
        </h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-2">
                {locale === 'th' ? 'จำนวน QR' : 'Quantity'} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-3 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
                placeholder="1-100"
              />
              <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
                {locale === 'th' ? 'สูงสุด 100 รายการต่อ batch' : 'Maximum 100 items per batch'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-2">
                {locale === 'th' ? 'หมายเหตุ' : 'Remarks'}
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-4 py-3 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
                placeholder={locale === 'th' ? 'เช่น สำหรับ Filler รุ่นใหม่' : 'e.g., For new Filler batch'}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-3 bg-[var(--color-gold)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {creating ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {locale === 'th' ? 'กำลังสร้าง...' : 'Creating...'}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {locale === 'th' ? 'สร้าง QR Code' : 'Generate QR Codes'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Batch History */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
        <div className="px-6 py-4 bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
          <h2 className="text-display font-semibold text-[var(--color-charcoal)]">
            {locale === 'th' ? 'ประวัติ Batch' : 'Batch History'}
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 relative">
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin" />
            </div>
            <p className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'กำลังโหลด...' : 'Loading...'}</p>
          </div>
        ) : batches.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-beige)]/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="text-[var(--color-foreground-muted)]">
              {locale === 'th' ? 'ยังไม่มี batch ที่สร้าง' : 'No batches created yet'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-[var(--color-beige)]">
              {batches.map((batch) => (
                <div key={batch.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="font-mono text-sm font-medium text-[var(--color-gold)]">
                      {batch.batchNo}
                    </span>
                    <span className="text-xs text-[var(--color-foreground-muted)]">
                      {formatDate(batch.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-[var(--color-charcoal)]">
                      {batch.linkedCount}/{batch.quantity}
                    </span>
                    <span className="text-xs text-[var(--color-foreground-muted)]">
                      {locale === 'th' ? 'ใช้แล้ว' : 'used'}
                    </span>
                  </div>

                  {batch.remarks && (
                    <p className="text-xs text-[var(--color-foreground-muted)] mb-3">{batch.remarks}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => viewBatchDetail(batch)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm border border-[var(--color-beige)] rounded-xl hover:bg-[var(--color-off-white)] transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {locale === 'th' ? 'ดู' : 'View'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      Batch No
                    </th>
                    <th className="px-5 py-4 text-center text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'จำนวน' : 'Quantity'}
                    </th>
                    <th className="px-5 py-4 text-center text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'ใช้แล้ว' : 'Used'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'สร้างโดย' : 'Created By'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'หมายเหตุ' : 'Remarks'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'วันที่' : 'Date'}
                    </th>
                    <th className="px-5 py-4 text-right text-sm font-semibold text-[var(--color-charcoal)]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-beige)]">
                  {batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-[var(--color-off-white)]/50 transition-colors">
                      <td className="px-5 py-4 font-mono text-[var(--color-gold)]">{batch.batchNo}</td>
                      <td className="px-5 py-4 text-center text-sm">{batch.quantity}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`text-sm font-medium ${batch.linkedCount > 0 ? 'text-[var(--color-mint-dark)]' : 'text-[var(--color-foreground-muted)]'}`}>
                          {batch.linkedCount}/{batch.quantity}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--color-charcoal)]">
                        {batch.createdBy.displayName}
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">
                        {batch.remarks || '-'}
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">
                        {formatDate(batch.createdAt)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => viewBatchDetail(batch)}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-[var(--color-beige)] rounded-lg hover:bg-[var(--color-off-white)] transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {locale === 'th' ? 'ดูรายละเอียด' : 'View Detail'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Create Success Modal */}
      {createResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-[var(--shadow-lg)] max-w-2xl w-full max-h-[90vh] overflow-hidden animate-scaleIn">
            <div className="p-6 border-b border-[var(--color-beige)]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[var(--color-mint)]/10 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-[var(--color-mint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-display text-lg font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'สร้าง QR สำเร็จ!' : 'QR Codes Generated!'}
                  </h3>
                  <p className="text-sm text-[var(--color-foreground-muted)]">
                    Batch: <span className="font-mono text-[var(--color-gold)]">{createResult.batchNo}</span>
                    {' - '}{createResult.quantity} {locale === 'th' ? 'รายการ' : 'items'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 max-h-[50vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-off-white)]">
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">Serial Number</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-beige)]">
                  {createResult.items.map((item, index) => (
                    <tr key={item.productItemId}>
                      <td className="px-3 py-2 text-[var(--color-foreground-muted)]">{index + 1}</td>
                      <td className="px-3 py-2 font-mono text-[var(--color-gold)]">{item.serialNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-6 border-t border-[var(--color-beige)] bg-[var(--color-off-white)]">
              <div className="flex gap-3">
                <button
                  onClick={() => setCreateResult(null)}
                  className="flex-1 px-4 py-3 text-[var(--color-charcoal)] border border-[var(--color-beige)] bg-white rounded-xl hover:bg-[var(--color-off-white)] transition-colors"
                >
                  {locale === 'th' ? 'ปิด' : 'Close'}
                </button>
                <button
                  onClick={() => downloadLabels(createResult.items.map(i => i.productItemId), createResult.batchNo)}
                  disabled={downloading}
                  className="flex-1 px-4 py-3 bg-[var(--color-gold)] text-white font-medium rounded-xl hover:bg-[var(--color-gold-dark)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {downloading ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  )}
                  {locale === 'th' ? 'ดาวน์โหลด Labels (PDF)' : 'Download Labels (PDF)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Detail Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-[var(--shadow-lg)] max-w-2xl w-full max-h-[90vh] overflow-hidden animate-scaleIn">
            <div className="p-6 border-b border-[var(--color-beige)]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-display text-lg font-semibold text-[var(--color-charcoal)]">
                    Batch: <span className="font-mono text-[var(--color-gold)]">{selectedBatch.batch.batchNo}</span>
                  </h3>
                  <p className="text-sm text-[var(--color-foreground-muted)]">
                    {selectedBatch.batch.linkedCount}/{selectedBatch.batch.quantity} {locale === 'th' ? 'ใช้แล้ว' : 'used'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedBatch(null)}
                  className="w-8 h-8 rounded-lg hover:bg-[var(--color-off-white)] flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[50vh] overflow-y-auto">
              {loadingBatch ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 mx-auto mb-2 relative">
                    <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
                    <div className="absolute inset-0 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin" />
                  </div>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--color-off-white)]">
                      <th className="px-3 py-2 text-left font-medium">#</th>
                      <th className="px-3 py-2 text-left font-medium">Serial Number</th>
                      <th className="px-3 py-2 text-center font-medium">{locale === 'th' ? 'สถานะ' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-beige)]">
                    {selectedBatch.items.map((item, index) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 text-[var(--color-foreground-muted)]">{index + 1}</td>
                        <td className="px-3 py-2 font-mono text-[var(--color-gold)]">{item.serial12}</td>
                        <td className="px-3 py-2 text-center">
                          {item.isLinked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-mint)]" />
                              {locale === 'th' ? 'ใช้แล้ว' : 'Used'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              {locale === 'th' ? 'พร้อมใช้' : 'Available'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-6 border-t border-[var(--color-beige)] bg-[var(--color-off-white)]">
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedBatch(null)}
                  className="flex-1 px-4 py-3 text-[var(--color-charcoal)] border border-[var(--color-beige)] bg-white rounded-xl hover:bg-[var(--color-off-white)] transition-colors"
                >
                  {locale === 'th' ? 'ปิด' : 'Close'}
                </button>
                <button
                  onClick={() => {
                    const availableItems = selectedBatch.items.filter(i => !i.isLinked)
                    if (availableItems.length > 0) {
                      downloadLabels(availableItems.map(i => i.id), selectedBatch.batch.batchNo)
                    } else {
                      alert(locale === 'th' ? 'ไม่มีรายการที่พร้อมใช้' : 'No available items')
                    }
                  }}
                  disabled={downloading || selectedBatch.items.filter(i => !i.isLinked).length === 0}
                  className="flex-1 px-4 py-3 bg-[var(--color-gold)] text-white font-medium rounded-xl hover:bg-[var(--color-gold-dark)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {downloading ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  )}
                  {locale === 'th' ? 'พิมพ์ที่ยังไม่ใช้' : 'Print Available'}
                  {' '}({selectedBatch.items.filter(i => !i.isLinked).length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
