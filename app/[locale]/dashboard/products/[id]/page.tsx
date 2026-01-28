'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface ProductMaster {
  id: number
  sku: string
  nameTh: string
  nameEn: string | null
  modelSize: string | null
  description: string | null
  isActive: boolean
  category: { id: number; nameTh: string; nameEn: string | null }
  defaultUnit: { id: number; nameTh: string; nameEn: string | null } | null
  stats: {
    total: number
    inStock: number
    pendingOut: number
    shipped: number
    activated: number
    returned: number
  }
}

interface ProductItem {
  id: number
  serial12: string
  lot: string | null
  mfgDate: string | null
  expDate: string | null
  status: 'IN_STOCK' | 'PENDING_OUT' | 'SHIPPED' | 'ACTIVATED' | 'RETURNED'
  assignedClinic: { id: number; name: string } | null
  grnLine: {
    unit: { nameTh: string; nameEn: string | null }
    grnHeader: { grnNo: string; receivedAt: string }
  } | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const statusLabels: Record<string, { th: string; en: string; color: string }> = {
  IN_STOCK: { th: 'ในคลัง', en: 'In Stock', color: 'bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]' },
  PENDING_OUT: { th: 'รอส่งออก', en: 'Pending Out', color: 'bg-amber-100 text-amber-700' },
  SHIPPED: { th: 'ส่งออกแล้ว', en: 'Shipped', color: 'bg-blue-100 text-blue-700' },
  ACTIVATED: { th: 'เปิดใช้แล้ว', en: 'Activated', color: 'bg-purple-100 text-purple-700' },
  RETURNED: { th: 'คืนสินค้า', en: 'Returned', color: 'bg-red-100 text-red-700' },
}

export default function ProductMasterDetailPage() {
  const params = useParams()
  const locale = params.locale as string
  const id = params.id as string

  const [productMaster, setProductMaster] = useState<ProductMaster | null>(null)
  const [items, setItems] = useState<ProductItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const searchParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
      })
      if (statusFilter) {
        searchParams.set('status', statusFilter)
      }

      const res = await fetch(`/api/admin/masters/products/${id}?${searchParams}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch product')
      }

      setProductMaster(data.data.productMaster)
      setItems(data.data.items)
      setPagination(data.data.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [id, currentPage, statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 relative">
          <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
          <div className="absolute inset-0 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !productMaster) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          {error || (locale === 'th' ? 'ไม่พบข้อมูลสินค้า' : 'Product not found')}
        </div>
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
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-[var(--color-foreground-muted)]">
        <Link href={`/${locale}/dashboard`} className="hover:text-[var(--color-gold)] transition-colors">
          {locale === 'th' ? 'แดชบอร์ด' : 'Dashboard'}
        </Link>
        <span>/</span>
        <Link href={`/${locale}/dashboard/products`} className="hover:text-[var(--color-gold)] transition-colors">
          {locale === 'th' ? 'สินค้า' : 'Products'}
        </Link>
        <span>/</span>
        <span className="text-[var(--color-charcoal)]">{productMaster.sku}</span>
      </nav>

      {/* Product Master Info */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-charcoal)]">
              {locale === 'th' ? productMaster.nameTh : (productMaster.nameEn || productMaster.nameTh)}
            </h1>
            <p className="text-lg text-[var(--color-foreground-muted)] mt-1 font-mono">{productMaster.sku}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${productMaster.isActive ? 'bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]' : 'bg-gray-100 text-gray-600'}`}>
            {productMaster.isActive ? (locale === 'th' ? 'ใช้งาน' : 'Active') : (locale === 'th' ? 'ไม่ใช้งาน' : 'Inactive')}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div>
            <p className="text-sm text-[var(--color-foreground-muted)]">{locale === 'th' ? 'หมวดหมู่' : 'Category'}</p>
            <p className="font-medium text-[var(--color-charcoal)] mt-0.5">
              {locale === 'th' ? productMaster.category.nameTh : (productMaster.category.nameEn || productMaster.category.nameTh)}
            </p>
          </div>
          <div>
            <p className="text-sm text-[var(--color-foreground-muted)]">{locale === 'th' ? 'รุ่น/ขนาด' : 'Model/Size'}</p>
            <p className="font-medium text-[var(--color-charcoal)] mt-0.5">{productMaster.modelSize || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--color-foreground-muted)]">{locale === 'th' ? 'หน่วยนับ' : 'Default Unit'}</p>
            <p className="font-medium text-[var(--color-charcoal)] mt-0.5">
              {productMaster.defaultUnit
                ? (locale === 'th' ? productMaster.defaultUnit.nameTh : (productMaster.defaultUnit.nameEn || productMaster.defaultUnit.nameTh))
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-[var(--color-foreground-muted)]">{locale === 'th' ? 'จำนวนทั้งหมด' : 'Total Items'}</p>
            <p className="font-medium text-[var(--color-charcoal)] mt-0.5">{productMaster.stats.total} {locale === 'th' ? 'ชิ้น' : 'items'}</p>
          </div>
        </div>

        {productMaster.description && (
          <div className="mt-4 pt-4 border-t border-[var(--color-beige)]">
            <p className="text-sm text-[var(--color-foreground-muted)]">{locale === 'th' ? 'รายละเอียด' : 'Description'}</p>
            <p className="text-[var(--color-charcoal)] mt-0.5">{productMaster.description}</p>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-[var(--color-mint)]/10 rounded-xl p-4 border border-[var(--color-mint)]/20">
          <p className="text-sm text-[var(--color-mint-dark)]">{locale === 'th' ? 'ในคลัง' : 'In Stock'}</p>
          <p className="text-2xl font-bold text-[var(--color-mint-dark)] mt-1">{productMaster.stats.inStock}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <p className="text-sm text-amber-600">{locale === 'th' ? 'รอส่งออก' : 'Pending Out'}</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{productMaster.stats.pendingOut}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-600">{locale === 'th' ? 'ส่งออกแล้ว' : 'Shipped'}</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{productMaster.stats.shipped}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
          <p className="text-sm text-purple-600">{locale === 'th' ? 'เปิดใช้แล้ว' : 'Activated'}</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{productMaster.stats.activated}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <p className="text-sm text-red-600">{locale === 'th' ? 'คืนสินค้า' : 'Returned'}</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{productMaster.stats.returned}</p>
        </div>
      </div>

      {/* Filter and Items Table */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
        <div className="p-4 border-b border-[var(--color-beige)] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-charcoal)]">
            {locale === 'th' ? 'รายการสินค้าแต่ละชิ้น' : 'Product Items'}
          </h2>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="border border-[var(--color-beige)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] focus:border-transparent"
          >
            <option value="">{locale === 'th' ? 'ทุกสถานะ' : 'All Status'}</option>
            <option value="IN_STOCK">{locale === 'th' ? 'ในคลัง' : 'In Stock'}</option>
            <option value="PENDING_OUT">{locale === 'th' ? 'รอส่งออก' : 'Pending Out'}</option>
            <option value="SHIPPED">{locale === 'th' ? 'ส่งออกแล้ว' : 'Shipped'}</option>
            <option value="ACTIVATED">{locale === 'th' ? 'เปิดใช้แล้ว' : 'Activated'}</option>
            <option value="RETURNED">{locale === 'th' ? 'คืนสินค้า' : 'Returned'}</option>
          </select>
        </div>

        {items.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-beige)]/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-[var(--color-foreground-muted)]">
              {locale === 'th' ? 'ยังไม่มีสินค้าในระบบ' : 'No items found'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--color-off-white)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-foreground-muted)]">
                      {locale === 'th' ? 'Serial' : 'Serial'}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-foreground-muted)]">
                      {locale === 'th' ? 'Lot' : 'Lot'}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-foreground-muted)]">
                      {locale === 'th' ? 'วันหมดอายุ' : 'Exp. Date'}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-foreground-muted)]">
                      {locale === 'th' ? 'สถานะ' : 'Status'}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-foreground-muted)]">
                      {locale === 'th' ? 'คลินิก' : 'Clinic'}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-foreground-muted)]">
                      {locale === 'th' ? 'เลขที่ GRN' : 'GRN No.'}
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-[var(--color-foreground-muted)]">
                      {locale === 'th' ? 'จัดการ' : 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-beige)]">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-[var(--color-off-white)]/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-sm text-[var(--color-charcoal)]">{item.serial12}</td>
                      <td className="px-4 py-3 text-sm text-[var(--color-charcoal)]">{item.lot || '-'}</td>
                      <td className="px-4 py-3 text-sm text-[var(--color-charcoal)]">{formatDate(item.expDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusLabels[item.status]?.color || 'bg-gray-100 text-gray-700'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            item.status === 'IN_STOCK' ? 'bg-[var(--color-mint)]' :
                            item.status === 'PENDING_OUT' ? 'bg-amber-500' :
                            item.status === 'SHIPPED' ? 'bg-blue-500' :
                            item.status === 'ACTIVATED' ? 'bg-purple-500' :
                            'bg-red-500'
                          }`} />
                          {locale === 'th' ? statusLabels[item.status]?.th : statusLabels[item.status]?.en}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--color-charcoal)]">{item.assignedClinic?.name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-[var(--color-charcoal)]">{item.grnLine?.grnHeader.grnNo || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/${locale}/dashboard/products/item/${item.id}`}
                          className="inline-flex items-center gap-1 text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] text-sm font-medium transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {locale === 'th' ? 'ดู' : 'View'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="p-4 border-t border-[var(--color-beige)] flex items-center justify-between">
                <p className="text-sm text-[var(--color-foreground-muted)]">
                  {locale === 'th' ? 'แสดง' : 'Showing'} {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} {locale === 'th' ? 'จาก' : 'of'} {pagination.total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={pagination.page === 1}
                    className="px-3 py-1.5 border border-[var(--color-beige)] rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-off-white)] transition-colors"
                  >
                    {locale === 'th' ? 'ก่อนหน้า' : 'Previous'}
                  </button>
                  <span className="px-3 py-1.5 text-sm text-[var(--color-foreground-muted)]">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-3 py-1.5 border border-[var(--color-beige)] rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-off-white)] transition-colors"
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
