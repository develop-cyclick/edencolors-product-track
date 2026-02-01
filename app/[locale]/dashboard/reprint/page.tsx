'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface TokenHistory {
  version: number
  status: string
  issuedAt: string
  revokedAt: string | null
  revokeReason: string | null
}

interface ProductItem {
  id: number
  serial12: string
  name: string
  category: string
  status: string
  currentTokenVersion: number
  tokenHistory: TokenHistory[]
  assignedClinic: { id: number; name: string } | null
}

interface ReprintResult {
  productItemId: number
  serial12: string
  productName: string
  category: string
  previousVersion: number
  newVersion: number
  qrUrl: string
  message: string
}

export default function ReprintPage() {
  const params = useParams()
  const locale = params.locale as string

  const [products, setProducts] = useState<ProductItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchSerial, setSearchSerial] = useState('')
  const [reprinting, setReprinting] = useState<number | null>(null)
  const [reprintResult, setReprintResult] = useState<ReprintResult | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null)
  const [reprintReason, setReprintReason] = useState('')

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async (serial?: string) => {
    setLoading(true)
    try {
      const url = serial
        ? `/api/warehouse/reprint?serial=${encodeURIComponent(serial)}`
        : '/api/warehouse/reprint'
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setProducts(data.data.items)
      }
    } catch (error) {
      console.error('Failed to fetch products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchProducts(searchSerial)
  }

  const openReprintModal = (product: ProductItem) => {
    setSelectedProduct(product)
    setReprintReason('')
    setShowModal(true)
  }

  const handleReprint = async () => {
    if (!selectedProduct) return

    setReprinting(selectedProduct.id)
    try {
      const res = await fetch('/api/warehouse/reprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productItemId: selectedProduct.id,
          reason: reprintReason || 'Manual reprint',
        }),
      })

      const data = await res.json()
      if (data.success) {
        setReprintResult(data.data)
        fetchProducts(searchSerial)
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch {
      alert('Failed to reprint')
    } finally {
      setReprinting(null)
      setShowModal(false)
    }
  }

  const downloadLabel = async () => {
    if (!reprintResult) return

    try {
      const res = await fetch('/api/warehouse/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productItemIds: [reprintResult.productItemId], layout: 'grid' }),
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `label-${reprintResult.serial12}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        alert('Failed to generate label')
      }
    } catch {
      alert('Failed to download label')
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; dot: string; label: string; labelEn: string }> = {
      IN_STOCK: { bg: 'bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]', dot: 'bg-[var(--color-mint)]', label: 'ในคลัง', labelEn: 'In Stock' },
      PENDING_OUT: { bg: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: 'รอส่งออก', labelEn: 'Pending' },
      SHIPPED: { bg: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', label: 'ส่งออกแล้ว', labelEn: 'Shipped' },
      ACTIVATED: { bg: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500', label: 'เปิดใช้แล้ว', labelEn: 'Activated' },
      RETURNED: { bg: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', label: 'คืนสินค้า', labelEn: 'Returned' },
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-display text-2xl font-bold text-[var(--color-charcoal)]">
          {locale === 'th' ? 'พิมพ์ QR Label ใหม่' : 'Reprint QR Label'}
        </h1>
        <p className="text-[var(--color-foreground-muted)] mt-1">
          {locale === 'th' ? 'พิมพ์ QR Code ใหม่สำหรับสินค้าที่ต้องการ' : 'Print new QR codes for products'}
        </p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-5">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="relative flex-1">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-foreground-muted)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchSerial}
              onChange={(e) => setSearchSerial(e.target.value)}
              placeholder={locale === 'th' ? 'ค้นหาด้วย Serial Number...' : 'Search by Serial Number...'}
              className="w-full pl-12 pr-4 py-3 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-[var(--color-gold)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] transition-all"
          >
            {locale === 'th' ? 'ค้นหา' : 'Search'}
          </button>
        </form>
      </div>

      {/* Products List */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
        <div className="px-6 py-4 bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
          <h2 className="text-display font-semibold text-[var(--color-charcoal)]">
            {locale === 'th' ? 'สินค้าที่สามารถพิมพ์ใหม่ได้' : 'Products Available for Reprint'}
          </h2>
          <p className="text-sm text-[var(--color-foreground-muted)] mt-1">
            {locale === 'th'
              ? 'สินค้าที่ถูก Activate หรือ Return ไม่สามารถพิมพ์ใหม่ได้'
              : 'Activated or Returned products cannot be reprinted'}
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 relative">
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin" />
            </div>
            <p className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'กำลังโหลด...' : 'Loading...'}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-beige)]/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </div>
            <p className="text-[var(--color-foreground-muted)]">
              {locale === 'th' ? 'ไม่พบสินค้า' : 'No products found'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-[var(--color-beige)]">
              {products.map((product) => (
                <div key={product.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="font-mono text-sm font-medium text-[var(--color-gold)]">
                      {product.serial12}
                    </span>
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-[var(--color-charcoal)]/10 text-xs font-medium text-[var(--color-charcoal)]">
                      v{product.currentTokenVersion}
                    </span>
                  </div>

                  <div className="text-sm font-medium text-[var(--color-charcoal)] mb-1">{product.name}</div>
                  <div className="text-xs text-[var(--color-foreground-muted)] mb-3">{product.category}</div>

                  <div className="flex items-center justify-between gap-3 mb-3">
                    {getStatusBadge(product.status)}
                    <span className="text-xs text-[var(--color-foreground-muted)]">
                      {product.assignedClinic?.name || '-'}
                    </span>
                  </div>

                  <button
                    onClick={() => openReprintModal(product)}
                    disabled={reprinting === product.id}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-500 text-white text-sm font-medium rounded-xl hover:bg-purple-600 disabled:opacity-50 transition-all"
                  >
                    {reprinting === product.id ? (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        {locale === 'th' ? 'พิมพ์ใหม่' : 'Reprint'}
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">Serial</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'ชื่อสินค้า' : 'Product Name'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'หมวดหมู่' : 'Category'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'สถานะ' : 'Status'}
                    </th>
                    <th className="px-5 py-4 text-center text-sm font-semibold text-[var(--color-charcoal)]">Version</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'คลินิก' : 'Clinic'}
                    </th>
                    <th className="px-5 py-4 text-right text-sm font-semibold text-[var(--color-charcoal)]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-beige)]">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-[var(--color-off-white)]/50 transition-colors">
                      <td className="px-5 py-4 font-mono text-[var(--color-gold)]">{product.serial12}</td>
                      <td className="px-5 py-4 text-sm font-medium text-[var(--color-charcoal)]">{product.name}</td>
                      <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">{product.category}</td>
                      <td className="px-5 py-4">{getStatusBadge(product.status)}</td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-charcoal)]/10 text-xs font-medium text-[var(--color-charcoal)]">
                          v{product.currentTokenVersion}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">
                        {product.assignedClinic?.name || '-'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => openReprintModal(product)}
                          disabled={reprinting === product.id}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-gold)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-gold)]/90 disabled:opacity-50 transition-all"
                        >
                          {reprinting === product.id ? (
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                              </svg>
                              {locale === 'th' ? 'พิมพ์ใหม่' : 'Reprint'}
                            </>
                          )}
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

      {/* Reprint Confirmation Modal */}
      {showModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-[var(--shadow-lg)] max-w-md w-full animate-scaleIn">
            <div className="p-6">
              <h3 className="text-display text-lg font-semibold text-[var(--color-charcoal)] mb-4">
                {locale === 'th' ? 'ยืนยันพิมพ์ QR ใหม่' : 'Confirm Reprint'}
              </h3>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">
                      {locale === 'th' ? 'QR เดิมจะถูกยกเลิก' : 'Old QR will be revoked'}
                    </p>
                    <p className="mt-1">
                      {locale === 'th'
                        ? 'การสแกน QR เดิมจะแสดงข้อความว่า "ถูกเปลี่ยนใหม่แล้ว"'
                        : 'Scanning old QR will show "Replaced" message'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--color-off-white)] rounded-xl p-4 mb-4">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-foreground-muted)]">Serial:</span>
                    <span className="font-mono text-[var(--color-gold)]">{selectedProduct.serial12}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'สินค้า' : 'Product'}:</span>
                    <span className="font-medium text-[var(--color-charcoal)]">{selectedProduct.name}</span>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-2">
                  {locale === 'th' ? 'เหตุผล' : 'Reason'}
                  <span className="text-[var(--color-foreground-muted)] text-xs ml-2">
                    ({locale === 'th' ? 'ไม่บังคับ' : 'optional'})
                  </span>
                </label>
                <input
                  type="text"
                  value={reprintReason}
                  onChange={(e) => setReprintReason(e.target.value)}
                  placeholder={locale === 'th' ? 'เช่น QR เสียหาย, หาย' : 'e.g., Damaged, Lost'}
                  className="w-full px-4 py-3 text-[0.9375rem] border border-[var(--color-beige)] rounded-xl focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 text-[var(--color-charcoal)] border border-[var(--color-beige)] rounded-xl hover:bg-[var(--color-off-white)] transition-colors"
                >
                  {locale === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button
                  onClick={handleReprint}
                  disabled={reprinting !== null}
                  className="flex-1 px-4 py-3 bg-purple-500 text-white font-medium rounded-xl hover:bg-purple-600 disabled:opacity-50 transition-colors"
                >
                  {locale === 'th' ? 'ยืนยันพิมพ์ใหม่' : 'Confirm Reprint'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reprint Success Modal */}
      {reprintResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-[var(--shadow-lg)] max-w-md w-full animate-scaleIn">
            <div className="p-6">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-[var(--color-mint)]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-[var(--color-mint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-display text-lg font-semibold text-[var(--color-charcoal)]">
                  {locale === 'th' ? 'พิมพ์ใหม่สำเร็จ!' : 'Reprint Successful!'}
                </h3>
              </div>

              <div className="bg-[var(--color-off-white)] rounded-xl p-4 mb-6">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-foreground-muted)]">Serial:</span>
                    <span className="font-mono font-medium text-[var(--color-gold)]">{reprintResult.serial12}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-foreground-muted)]">
                      {locale === 'th' ? 'Version เดิม' : 'Old Version'}:
                    </span>
                    <span className="text-[var(--color-charcoal)]">v{reprintResult.previousVersion}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-foreground-muted)]">
                      {locale === 'th' ? 'Version ใหม่' : 'New Version'}:
                    </span>
                    <span className="font-medium text-[var(--color-mint-dark)]">v{reprintResult.newVersion}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setReprintResult(null)}
                  className="flex-1 px-4 py-3 text-[var(--color-charcoal)] border border-[var(--color-beige)] rounded-xl hover:bg-[var(--color-off-white)] transition-colors"
                >
                  {locale === 'th' ? 'ปิด' : 'Close'}
                </button>
                <button
                  onClick={downloadLabel}
                  className="flex-1 px-4 py-3 bg-[var(--color-gold)] text-white font-medium rounded-xl hover:bg-[var(--color-gold-dark)] transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {locale === 'th' ? 'ดาวน์โหลด Label' : 'Download Label'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
