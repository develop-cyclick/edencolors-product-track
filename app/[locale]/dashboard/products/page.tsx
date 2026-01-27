'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface ProductItem {
  id: number
  serial12: string
  sku: string
  name: string
  lot: string | null
  mfgDate: string | null
  expDate: string | null
  status: string
  category: { id: number; nameTh: string; nameEn: string }
  assignedClinic: { id: number; name: string; province: string } | null
  grnLine: {
    id: number
    unit: { id: number; nameTh: string }
    grnHeader: { grnNo: string; receivedAt: string }
  } | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function ProductsPage() {
  const params = useParams()
  const locale = params.locale as string

  const [products, setProducts] = useState<ProductItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [printingItemId, setPrintingItemId] = useState<number | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      })
      const res = await fetch(`/api/warehouse/products?${params}`)
      const data = await res.json()
      if (data.success && data.data) {
        setProducts(data.data.items || [])
        setPagination(data.data.pagination || null)
      }
    } catch (error) {
      console.error('Failed to fetch products:', error)
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchProducts()
  }

  const handlePrintSingleLabel = async (productItemId: number, serial: string) => {
    setPrintingItemId(productItemId)
    try {
      const res = await fetch('/api/warehouse/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productItemIds: [productItemId], layout: 'grid' }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(`Error: ${data.error || 'Failed to generate label'}`)
        return
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `label-${serial}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch {
      alert(locale === 'th' ? 'เกิดข้อผิดพลาดในการสร้าง PDF' : 'Failed to generate PDF')
    } finally {
      setPrintingItemId(null)
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

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; dot: string; label: string; labelEn: string }> = {
      IN_STOCK: { bg: 'bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]', dot: 'bg-[var(--color-mint)]', label: 'ในคลัง', labelEn: 'In Stock' },
      PENDING_OUT: { bg: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: 'รอส่งออก', labelEn: 'Pending Out' },
      SHIPPED: { bg: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', label: 'ส่งออกแล้ว', labelEn: 'Shipped' },
      ACTIVATED: { bg: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500', label: 'เปิดใช้งานแล้ว', labelEn: 'Activated' },
      RETURNED: { bg: 'bg-red-100 text-red-700', dot: 'bg-red-500', label: 'คืนสินค้า', labelEn: 'Returned' },
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-display text-2xl font-bold text-[var(--color-charcoal)]">
            {locale === 'th' ? 'สินค้าในคลัง' : 'Products in Stock'}
          </h1>
          <p className="text-[var(--color-foreground-muted)] mt-1">
            {locale === 'th' ? 'รายการสินค้าทั้งหมดในระบบ' : 'All products in the system'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-5">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={locale === 'th' ? 'ค้นหา Serial, SKU, ชื่อ, Lot...' : 'Search Serial, SKU, Name, Lot...'}
                className="w-full pl-10 pr-4 py-2.5 border border-[var(--color-beige)] rounded-xl focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)] transition-all bg-[var(--color-off-white)]"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="w-full px-4 py-2.5 border border-[var(--color-beige)] rounded-xl focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)] transition-all bg-[var(--color-off-white)]"
            >
              <option value="">{locale === 'th' ? 'ทุกสถานะ' : 'All Status'}</option>
              <option value="IN_STOCK">{locale === 'th' ? 'ในคลัง' : 'In Stock'}</option>
              <option value="PENDING_OUT">{locale === 'th' ? 'รอส่งออก' : 'Pending Out'}</option>
              <option value="SHIPPED">{locale === 'th' ? 'ส่งออกแล้ว' : 'Shipped'}</option>
              <option value="ACTIVATED">{locale === 'th' ? 'เปิดใช้งานแล้ว' : 'Activated'}</option>
              <option value="RETURNED">{locale === 'th' ? 'คืนสินค้า' : 'Returned'}</option>
            </select>
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 bg-[var(--color-gold)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(201,163,90,0.35)] transition-all duration-200"
          >
            {locale === 'th' ? 'ค้นหา' : 'Search'}
          </button>
        </form>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 relative">
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin" />
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-beige)]/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-[var(--color-foreground-muted)]">
              {locale === 'th' ? 'ไม่พบสินค้า' : 'No products found'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">Serial</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">SKU</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'ชื่อสินค้า' : 'Name'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'หมวดหมู่' : 'Category'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">Lot</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">EXP</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'สถานะ' : 'Status'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'คลินิก' : 'Clinic'}
                    </th>
                    <th className="px-5 py-4 text-center text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'พิมพ์ QR' : 'Print QR'}
                    </th>
                    <th className="px-5 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-beige)]">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-[var(--color-off-white)]/50 transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-mono text-sm font-medium text-[var(--color-charcoal)]">
                          {product.serial12}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--color-charcoal)]">{product.sku}</td>
                      <td className="px-5 py-4 text-sm text-[var(--color-charcoal)]">{product.name}</td>
                      <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">
                        {locale === 'th' ? product.category.nameTh : product.category.nameEn}
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">{product.lot || '-'}</td>
                      <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">{formatDate(product.expDate)}</td>
                      <td className="px-5 py-4">{getStatusBadge(product.status)}</td>
                      <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">
                        {product.assignedClinic ? product.assignedClinic.name : '-'}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => handlePrintSingleLabel(product.id, product.serial12)}
                          disabled={printingItemId === product.id}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--color-off-white)] text-[var(--color-charcoal)] hover:bg-[var(--color-gold)] hover:text-white disabled:opacity-50 transition-all duration-200"
                          title={locale === 'th' ? 'พิมพ์ QR Label' : 'Print QR Label'}
                        >
                          {printingItemId === product.id ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/${locale}/dashboard/products/${product.id}`}
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

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--color-beige)] bg-[var(--color-off-white)]">
                <p className="text-sm text-[var(--color-foreground-muted)]">
                  {locale === 'th'
                    ? `แสดง ${(pagination.page - 1) * pagination.limit + 1} - ${Math.min(pagination.page * pagination.limit, pagination.total)} จาก ${pagination.total} รายการ`
                    : `Showing ${(pagination.page - 1) * pagination.limit + 1} - ${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total} items`}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 text-sm font-medium text-[var(--color-charcoal)] bg-white border border-[var(--color-beige)] rounded-lg hover:bg-[var(--color-off-white)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {locale === 'th' ? 'ก่อนหน้า' : 'Previous'}
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={page === pagination.totalPages}
                    className="px-4 py-2 text-sm font-medium text-[var(--color-charcoal)] bg-white border border-[var(--color-beige)] rounded-lg hover:bg-[var(--color-off-white)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {locale === 'th' ? 'ถัดไป' : 'Next'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
