'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface ProductDetail {
  id: number
  serial12: string
  sku: string
  name: string
  lot: string | null
  mfgDate: string | null
  expDate: string | null
  status: string
  activatedAt: string | null
  category: { id: number; nameTh: string; nameEn: string }
  assignedClinic: { id: number; name: string; province: string; branchName: string | null } | null
  qrTokens: Array<{
    id: number
    tokenVersion: number
    tokenHash: string
    issuedAt: string
    status: string
  }>
  grnLine: {
    id: number
    sku: string
    itemName: string
    modelSize: string | null
    quantity: number
    lot: string | null
    mfgDate: string | null
    expDate: string | null
    inspectionStatus: string
    remarks: string | null
    unit: { id: number; nameTh: string; nameEn: string }
    grnHeader: {
      id: number
      grnNo: string
      receivedAt: string
      supplierName: string
      warehouse: { id: number; name: string }
      receivedBy: { id: number; displayName: string }
    }
  } | null
  outboundLines: Array<{
    id: number
    quantity: number
    outbound: {
      id: number
      deliveryNoteNo: string
      shippedAt: string | null
      status: string
      clinic: { id: number; name: string }
    }
  }>
  eventLogs: Array<{
    id: number
    eventType: string
    details: unknown
    createdAt: string
  }>
  scanLogs: Array<{
    id: number
    scannedAt: string
    result: string
    ipHash: string | null
    userAgent: string | null
  }>
}

export default function ProductDetailPage() {
  const params = useParams()
  const locale = params.locale as string
  const id = params.id as string

  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'info' | 'events' | 'scans'>('info')

  useEffect(() => {
    fetchProduct()
  }, [id])

  const fetchProduct = async () => {
    try {
      const res = await fetch(`/api/warehouse/products/${id}`)
      const data = await res.json()
      if (data.success && data.data?.product) {
        setProduct(data.data.product)
      }
    } catch (error) {
      console.error('Failed to fetch product:', error)
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

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString(locale === 'th' ? 'th-TH' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; dot: string; label: string; labelEn: string }> = {
      IN_STOCK: { bg: 'bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]', dot: 'bg-[var(--color-mint)]', label: 'ในคลัง', labelEn: 'In Stock' },
      PENDING_OUT: { bg: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: 'รอส่งออก', labelEn: 'Pending Out' },
      SHIPPED: { bg: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', label: 'ส่งออกแล้ว', labelEn: 'Shipped' },
      ACTIVATED: { bg: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500', label: 'เปิดใช้งานแล้ว', labelEn: 'Activated' },
      RETURNED: { bg: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', label: 'รับคืนสินค้า', labelEn: 'Returned' },
      DAMAGED: { bg: 'bg-red-100 text-red-700', dot: 'bg-red-500', label: 'เสียหาย', labelEn: 'Damaged' },
    }
    const badge = badges[status] || { bg: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400', label: status, labelEn: status }
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${badge.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
        {locale === 'th' ? badge.label : badge.labelEn}
      </span>
    )
  }

  const getEventTypeLabel = (eventType: string) => {
    const labels: Record<string, { th: string; en: string }> = {
      RECEIVED: { th: 'รับเข้าคลัง', en: 'Received' },
      QR_GENERATED: { th: 'สร้าง QR', en: 'QR Generated' },
      QR_REPRINTED: { th: 'พิมพ์ QR ใหม่', en: 'QR Reprinted' },
      OUTBOUND: { th: 'ส่งออก', en: 'Outbound' },
      SHIPPED: { th: 'จัดส่งแล้ว', en: 'Shipped' },
      SCANNED: { th: 'สแกน', en: 'Scanned' },
      VERIFIED: { th: 'ตรวจสอบแล้ว', en: 'Verified' },
      ACTIVATED: { th: 'เปิดใช้งาน', en: 'Activated' },
      RETURNED: { th: 'รับคืนสินค้า', en: 'Returned' },
      DAMAGE: { th: 'แจ้งเสียหาย', en: 'Damaged' },
      REPAIR: { th: 'ซ่อมแซม', en: 'Repaired' },
      SCRAP: { th: 'ทิ้ง', en: 'Scrapped' },
    }
    return labels[eventType] ? (locale === 'th' ? labels[eventType].th : labels[eventType].en) : eventType
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

  if (!product) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-beige)]/50 flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-[var(--color-foreground-muted)] mb-4">{locale === 'th' ? 'ไม่พบข้อมูลสินค้า' : 'Product not found'}</p>
        <Link
          href={`/${locale}/dashboard/products`}
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <Link
            href={`/${locale}/dashboard/products`}
            className="inline-flex items-center gap-1 text-sm text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] font-medium transition-colors mb-3"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {locale === 'th' ? 'กลับหน้ารายการ' : 'Back to list'}
          </Link>
          <h1 className="text-display text-2xl font-bold text-[var(--color-charcoal)] font-mono">{product.serial12}</h1>
          <div className="flex items-center gap-3 mt-2">
            {getStatusBadge(product.status)}
            {product.qrTokens.length > 0 && (
              <span className="text-xs text-[var(--color-foreground-muted)]">
                QR v{product.qrTokens[0].tokenVersion}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
        <div className="border-b border-[var(--color-beige)]">
          <nav className="flex -mb-px">
            {[
              { id: 'info' as const, label: locale === 'th' ? 'ข้อมูลสินค้า' : 'Product Info' },
              { id: 'events' as const, label: locale === 'th' ? 'ประวัติ Events' : 'Event History' },
              { id: 'scans' as const, label: locale === 'th' ? 'ประวัติการสแกน' : 'Scan History' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[var(--color-gold)] text-[var(--color-gold)]'
                    : 'border-transparent text-[var(--color-foreground-muted)] hover:text-[var(--color-charcoal)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'info' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Product Info */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
                    {locale === 'th' ? 'ข้อมูลสินค้า' : 'Product Information'}
                  </h3>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-[var(--color-foreground-muted)]">Serial</dt>
                      <dd className="font-mono font-medium text-[var(--color-charcoal)] mt-0.5">{product.serial12}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--color-foreground-muted)]">SKU</dt>
                      <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{product.sku}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ชื่อสินค้า' : 'Name'}</dt>
                      <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{product.name}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'หมวดหมู่' : 'Category'}</dt>
                      <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">
                        {locale === 'th' ? product.category.nameTh : product.category.nameEn}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--color-foreground-muted)]">Lot</dt>
                      <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{product.lot || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--color-foreground-muted)]">MFG Date</dt>
                      <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{formatDate(product.mfgDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--color-foreground-muted)]">EXP Date</dt>
                      <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{formatDate(product.expDate)}</dd>
                    </div>
                    {product.activatedAt && (
                      <div className="col-span-2">
                        <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'เปิดใช้งานเมื่อ' : 'Activated At'}</dt>
                        <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{formatDateTime(product.activatedAt)}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* GRN Info */}
                {product.grnLine && (
                  <div className="pt-6 border-t border-[var(--color-beige)]">
                    <h3 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
                      {locale === 'th' ? 'ข้อมูลการรับสินค้า' : 'Receiving Information'}
                    </h3>
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <dt className="text-[var(--color-foreground-muted)]">GRN No.</dt>
                        <dd className="mt-0.5">
                          <Link
                            href={`/${locale}/dashboard/grn/${product.grnLine.grnHeader.id}`}
                            className="font-medium text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] transition-colors"
                          >
                            {product.grnLine.grnHeader.grnNo}
                          </Link>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'วันที่รับ' : 'Received Date'}</dt>
                        <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{formatDate(product.grnLine.grnHeader.receivedAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'คลังสินค้า' : 'Warehouse'}</dt>
                        <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{product.grnLine.grnHeader.warehouse.name}</dd>
                      </div>
                      <div>
                        <dt className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ผู้จัดส่ง' : 'Supplier'}</dt>
                        <dd className="font-medium text-[var(--color-charcoal)] mt-0.5">{product.grnLine.grnHeader.supplierName}</dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>

              {/* Clinic & Outbound Info */}
              <div className="space-y-6">
                {product.assignedClinic && (
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
                      {locale === 'th' ? 'คลินิกที่ได้รับ' : 'Assigned Clinic'}
                    </h3>
                    <div className="bg-[var(--color-off-white)] rounded-xl p-4">
                      <p className="font-medium text-[var(--color-charcoal)]">{product.assignedClinic.name}</p>
                      <p className="text-sm text-[var(--color-foreground-muted)] mt-1">{product.assignedClinic.province}</p>
                      {product.assignedClinic.branchName && (
                        <p className="text-sm text-[var(--color-foreground-muted)] mt-1">
                          {locale === 'th' ? 'สาขา' : 'Branch'}: {product.assignedClinic.branchName}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {product.outboundLines.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
                      {locale === 'th' ? 'ประวัติการส่งออก' : 'Outbound History'}
                    </h3>
                    <div className="space-y-3">
                      {product.outboundLines.map((line) => (
                        <div key={line.id} className="bg-[var(--color-off-white)] rounded-xl p-4">
                          <div className="flex items-center justify-between">
                            <Link
                              href={`/${locale}/dashboard/outbound/${line.outbound.id}`}
                              className="font-medium text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] transition-colors"
                            >
                              {line.outbound.deliveryNoteNo}
                            </Link>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              line.outbound.status === 'APPROVED'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {line.outbound.status}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--color-foreground-muted)] mt-1">
                            {line.outbound.clinic.name}
                          </p>
                          {line.outbound.shippedAt && (
                            <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
                              {formatDateTime(line.outbound.shippedAt)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* QR Token History */}
                {product.qrTokens.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
                      {locale === 'th' ? 'ประวัติ QR Token' : 'QR Token History'}
                    </h3>
                    <div className="space-y-2">
                      {product.qrTokens.map((token) => (
                        <div key={token.id} className="flex items-center justify-between bg-[var(--color-off-white)] rounded-xl px-4 py-3">
                          <div>
                            <span className="font-medium text-[var(--color-charcoal)]">v{token.tokenVersion}</span>
                            <span className="text-xs text-[var(--color-foreground-muted)] ml-2">
                              {formatDateTime(token.issuedAt)}
                            </span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            token.status === 'ACTIVE'
                              ? 'bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {token.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'events' && (
            <div>
              {product.eventLogs.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[var(--color-foreground-muted)]">
                    {locale === 'th' ? 'ไม่มีประวัติ Events' : 'No event history'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {product.eventLogs.map((event) => (
                    <div key={event.id} className="flex items-start gap-4 bg-[var(--color-off-white)] rounded-xl p-4">
                      <div className="w-10 h-10 rounded-full bg-[var(--color-gold)]/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-[var(--color-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[var(--color-charcoal)]">{getEventTypeLabel(event.eventType)}</p>
                        <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
                          {formatDateTime(event.createdAt)}
                        </p>
                        {event.details !== null && event.details !== undefined && (
                          <p className="text-xs text-[var(--color-foreground-muted)] mt-1 font-mono">
                            {JSON.stringify(event.details)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'scans' && (
            <div>
              {product.scanLogs.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[var(--color-foreground-muted)]">
                    {locale === 'th' ? 'ไม่มีประวัติการสแกน' : 'No scan history'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {product.scanLogs.map((scan) => (
                    <div key={scan.id} className="flex items-start gap-4 bg-[var(--color-off-white)] rounded-xl p-4">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-[var(--color-charcoal)]">{locale === 'th' ? 'สแกน QR Code' : 'QR Code Scanned'}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{scan.result}</span>
                        </div>
                        <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
                          {formatDateTime(scan.scannedAt)}
                        </p>
                        {scan.userAgent && (
                          <p className="text-xs text-[var(--color-foreground-muted)] mt-1 truncate">{scan.userAgent}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
