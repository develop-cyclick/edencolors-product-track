'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface DamagedProduct {
  id: number
  serial12: string
  sku: string
  name: string
  lot: string | null
  expDate: string | null
  status: string
  productMaster: {
    id: number
    sku: string
    nameTh: string
    nameEn: string | null
    modelSize: string | null
    category: { nameTh: string; nameEn: string | null }
  } | null
  warehouse: { id: number; name: string } | null
  assignedClinic: { id: number; name: string } | null
  damageNote: { reason?: string; note?: string } | null
  damagedAt: string | null
  damagedBy: string | null
}

interface SearchResult {
  id: number
  serial12: string
  name: string
  lot?: string
  category: {
    id: number
    nameTh: string
    nameEn: string
  }
  status: string
  assignedClinic?: {
    id: number
    name: string
    province: string
  } | null
  activation?: {
    customerName: string
    createdAt: string
  } | null
}

interface LotProduct {
  id: number
  serial12: string
  name: string
  status: string
  category: {
    nameTh: string
    nameEn: string
  }
  assignedClinic?: {
    name: string
  } | null
  activation?: {
    customerName: string
  } | null
}

type MainTab = 'list' | 'return'
type ReturnMode = 'individual' | 'lot'
type StatusFilter = 'all' | 'DAMAGED' | 'RETURNED'

export default function DamagedProductsPage() {
  const params = useParams()
  const locale = params.locale as string

  // Main tab state
  const [mainTab, setMainTab] = useState<MainTab>('list')

  // List tab states
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<DamagedProduct[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  // Restore modal state
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<DamagedProduct | null>(null)
  const [repairNote, setRepairNote] = useState('')
  const [restoring, setRestoring] = useState(false)

  // Return tab states
  const [returnMode, setReturnMode] = useState<ReturnMode>('individual')
  const [searchSerial, setSearchSerial] = useState('')
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [searchError, setSearchError] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  // Lot return states
  const [searchLot, setSearchLot] = useState('')
  const [lotProducts, setLotProducts] = useState<LotProduct[]>([])
  const [lotError, setLotError] = useState('')
  const [isSearchingLot, setIsSearchingLot] = useState(false)
  const [selectedLotProducts, setSelectedLotProducts] = useState<number[]>([])

  // Return modal states
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [showLotReturnModal, setShowLotReturnModal] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const fetchItems = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      })

      const res = await fetch(`/api/warehouse/damaged?${params}`)
      const data = await res.json()

      if (data.success && data.data) {
        setItems(data.data.items || [])
        setPagination((prev) => ({
          ...prev,
          ...data.data.pagination,
        }))
      }
    } catch (error) {
      console.error('Failed to fetch damaged products:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [pagination.page, search, statusFilter])

  const handleRestore = async (action: 'restore' | 'scrap') => {
    if (!selectedItem) return

    setRestoring(true)
    try {
      const res = await fetch(`/api/warehouse/damaged/${selectedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, repairNote }),
      })

      const data = await res.json()
      if (data.success) {
        setShowRestoreModal(false)
        setSelectedItem(null)
        setRepairNote('')
        fetchItems()
      } else {
        alert(data.message || 'Error')
      }
    } catch (error) {
      console.error('Failed to restore product:', error)
    } finally {
      setRestoring(false)
    }
  }

  const openRestoreModal = (item: DamagedProduct) => {
    setSelectedItem(item)
    setRepairNote('')
    setShowRestoreModal(true)
  }

  // Search for product by serial
  const handleSearch = async () => {
    if (!searchSerial.trim()) {
      setSearchError(locale === 'th' ? 'กรุณากรอกหมายเลข Serial' : 'Please enter Serial number')
      return
    }

    setIsSearching(true)
    setSearchError('')
    setSearchResult(null)

    try {
      const res = await fetch(`/api/warehouse/products?search=${searchSerial.trim()}`)
      const data = await res.json()

      if (!data.success || !data.data?.items?.length) {
        setSearchError(locale === 'th' ? 'ไม่พบสินค้าที่ค้นหา' : 'Product not found')
        return
      }

      const product = data.data.items[0]

      if (!['SHIPPED', 'ACTIVATED'].includes(product.status)) {
        setSearchError(
          locale === 'th'
            ? `ไม่สามารถรับคืนสินค้าสถานะ ${product.status} ได้ (ต้องเป็น SHIPPED หรือ ACTIVATED เท่านั้น)`
            : `Cannot return product with status ${product.status} (must be SHIPPED or ACTIVATED)`
        )
        return
      }

      setSearchResult(product)
    } catch (error) {
      console.error('Search error:', error)
      setSearchError(locale === 'th' ? 'เกิดข้อผิดพลาดในการค้นหา' : 'Search failed')
    } finally {
      setIsSearching(false)
    }
  }

  // Search for products by lot number
  const handleLotSearch = async () => {
    if (!searchLot.trim()) {
      setLotError(locale === 'th' ? 'กรุณากรอกหมายเลข Lot' : 'Please enter Lot number')
      return
    }

    setIsSearchingLot(true)
    setLotError('')
    setLotProducts([])
    setSelectedLotProducts([])

    try {
      const res = await fetch(`/api/warehouse/products?lot=${encodeURIComponent(searchLot.trim())}&status=SHIPPED,ACTIVATED`)

      if (!res.ok) {
        setLotError(locale === 'th' ? `เกิดข้อผิดพลาด: ${res.status}` : `Error: ${res.status}`)
        return
      }

      const data = await res.json()

      if (!data.success || !data.data?.items?.length) {
        setLotError(locale === 'th' ? 'ไม่พบสินค้าในล็อตที่ค้นหา หรือไม่มีสินค้าที่สามารถรับคืนได้' : 'No products found in this lot or no returnable products')
        return
      }

      const returnableProducts = data.data.items.filter((p: LotProduct) =>
        ['SHIPPED', 'ACTIVATED'].includes(p.status)
      )

      if (returnableProducts.length === 0) {
        setLotError(locale === 'th' ? 'ไม่มีสินค้าในล็อตนี้ที่สามารถรับคืนได้' : 'No returnable products in this lot')
        return
      }

      setLotProducts(returnableProducts)
      setSelectedLotProducts(returnableProducts.map((p: LotProduct) => p.id))
    } catch (error) {
      console.error('Lot search error:', error)
      setLotError(locale === 'th' ? 'เกิดข้อผิดพลาดในการค้นหา' : 'Search failed')
    } finally {
      setIsSearchingLot(false)
    }
  }

  const toggleLotProductSelection = (productId: number) => {
    setSelectedLotProducts(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    )
  }

  const toggleAllLotProducts = () => {
    if (selectedLotProducts.length === lotProducts.length) {
      setSelectedLotProducts([])
    } else {
      setSelectedLotProducts(lotProducts.map(p => p.id))
    }
  }

  // Process individual return
  const handleReturn = async () => {
    if (!searchResult || !returnReason.trim()) return

    setIsProcessing(true)
    try {
      const res = await fetch('/api/warehouse/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productItemId: searchResult.id,
          reason: returnReason,
          notes: returnNotes || undefined,
        }),
      })

      const data = await res.json()

      if (data.success) {
        alert(locale === 'th' ? 'รับคืนสินค้าสำเร็จ' : 'Product returned successfully')
        setShowReturnModal(false)
        setSearchResult(null)
        setSearchSerial('')
        setReturnReason('')
        setReturnNotes('')
        fetchItems()
      } else {
        alert(data.error || (locale === 'th' ? 'เกิดข้อผิดพลาด' : 'An error occurred'))
      }
    } catch (error) {
      console.error('Return error:', error)
      alert(locale === 'th' ? 'เกิดข้อผิดพลาดในการรับคืนสินค้า' : 'Failed to return product')
    } finally {
      setIsProcessing(false)
    }
  }

  // Process lot return
  const handleLotReturn = async () => {
    if (selectedLotProducts.length === 0 || !returnReason.trim()) return

    setIsProcessing(true)
    try {
      const res = await fetch('/api/warehouse/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productItemIds: selectedLotProducts,
          reason: returnReason,
          notes: returnNotes || undefined,
        }),
      })

      const data = await res.json()

      if (data.success) {
        const message = locale === 'th'
          ? `รับคืนสินค้าสำเร็จ ${data.data.returnedCount} รายการ`
          : `${data.data.returnedCount} products returned successfully`
        alert(message)
        setShowLotReturnModal(false)
        setLotProducts([])
        setSelectedLotProducts([])
        setSearchLot('')
        setReturnReason('')
        setReturnNotes('')
        fetchItems()
      } else {
        alert(data.error || (locale === 'th' ? 'เกิดข้อผิดพลาด' : 'An error occurred'))
      }
    } catch (error) {
      console.error('Lot return error:', error)
      alert(locale === 'th' ? 'เกิดข้อผิดพลาดในการรับคืนสินค้า' : 'Failed to return products')
    } finally {
      setIsProcessing(false)
    }
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; dot: string; label: string; labelEn: string }> = {
      IN_STOCK: { bg: 'bg-green-100 text-green-700', dot: 'bg-green-500', label: 'ในคลัง', labelEn: 'In Stock' },
      PENDING_OUT: { bg: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: 'รอส่งออก', labelEn: 'Pending' },
      SHIPPED: { bg: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', label: 'ส่งออกแล้ว', labelEn: 'Shipped' },
      ACTIVATED: { bg: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500', label: 'เปิดใช้แล้ว', labelEn: 'Activated' },
      RETURNED: { bg: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', label: 'คืนสินค้า', labelEn: 'Returned' },
      DAMAGED: { bg: 'bg-red-100 text-red-700', dot: 'bg-red-500', label: 'เสียหาย', labelEn: 'Damaged' },
    }
    const badge = badges[status] || { bg: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400', label: status, labelEn: status }
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
        {locale === 'th' ? badge.label : badge.labelEn}
      </span>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-charcoal)]">
            {locale === 'th' ? 'สินค้าเสียหาย / คืนสินค้า' : 'Damaged / Returned Products'}
          </h1>
          <p className="text-[var(--color-gray-500)] mt-1">
            {locale === 'th'
              ? 'จัดการสินค้าที่เสียหายหรือถูกคืน รอซ่อมแซมหรือตรวจสอบ'
              : 'Manage damaged or returned products awaiting repair or inspection'}
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="bg-white rounded-xl border border-[var(--color-gray-200)] overflow-hidden">
        <div className="flex border-b border-[var(--color-gray-200)]">
          <button
            onClick={() => setMainTab('list')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
              mainTab === 'list'
                ? 'text-[var(--color-gold)] border-b-2 border-[var(--color-gold)] bg-[var(--color-gold)]/5'
                : 'text-[var(--color-gray-500)] hover:text-[var(--color-charcoal)]'
            }`}
          >
            {locale === 'th' ? 'รายการสินค้า' : 'Product List'}
            {pagination.total > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-[var(--color-gray-200)]">
                {pagination.total}
              </span>
            )}
          </button>
          <button
            onClick={() => setMainTab('return')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
              mainTab === 'return'
                ? 'text-[var(--color-gold)] border-b-2 border-[var(--color-gold)] bg-[var(--color-gold)]/5'
                : 'text-[var(--color-gray-500)] hover:text-[var(--color-charcoal)]'
            }`}
          >
            {locale === 'th' ? 'รับคืนสินค้า' : 'Return Product'}
          </button>
        </div>

        {/* List Tab Content */}
        {mainTab === 'list' && (
          <div>
            {/* Search and Filter */}
            <div className="p-4 border-b border-[var(--color-gray-200)]">
              <div className="flex flex-col md:flex-row gap-3">
                {/* Status Filter Buttons */}
                <div className="flex flex-wrap gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      setStatusFilter('all')
                      setPagination((p) => ({ ...p, page: 1 }))
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      statusFilter === 'all'
                        ? 'bg-[var(--color-charcoal)] text-white'
                        : 'bg-[var(--color-gray-100)] text-[var(--color-gray-600)] hover:bg-[var(--color-gray-200)]'
                    }`}
                  >
                    {locale === 'th' ? 'ทั้งหมด' : 'All'}
                  </button>
                  <button
                    onClick={() => {
                      setStatusFilter('DAMAGED')
                      setPagination((p) => ({ ...p, page: 1 }))
                    }}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      statusFilter === 'DAMAGED'
                        ? 'bg-red-500 text-white'
                        : 'bg-red-50 text-red-600 hover:bg-red-100'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${statusFilter === 'DAMAGED' ? 'bg-white' : 'bg-red-500'}`} />
                    {locale === 'th' ? 'เสียหาย' : 'Damaged'}
                  </button>
                  <button
                    onClick={() => {
                      setStatusFilter('RETURNED')
                      setPagination((p) => ({ ...p, page: 1 }))
                    }}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      statusFilter === 'RETURNED'
                        ? 'bg-orange-500 text-white'
                        : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${statusFilter === 'RETURNED' ? 'bg-white' : 'bg-orange-500'}`} />
                    {locale === 'th' ? 'คืนสินค้า' : 'Returned'}
                  </button>
                </div>

                {/* Search Input */}
                <input
                  type="text"
                  placeholder={locale === 'th' ? 'ค้นหา Serial, SKU, ชื่อสินค้า...' : 'Search Serial, SKU, Product name...'}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPagination((p) => ({ ...p, page: 1 }))
                  }}
                  className="flex-1 px-4 py-2 border border-[var(--color-gray-200)] rounded-lg focus:outline-none focus:border-[var(--color-gold)]"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--color-gray-100)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-gray-500)] uppercase">Serial</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-gray-500)] uppercase">{locale === 'th' ? 'สินค้า' : 'Product'}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-gray-500)] uppercase">{locale === 'th' ? 'สถานะ' : 'Status'}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-gray-500)] uppercase">{locale === 'th' ? 'สาเหตุ' : 'Reason'}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-gray-500)] uppercase">{locale === 'th' ? 'วันที่' : 'Date'}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-gray-500)] uppercase">{locale === 'th' ? 'จัดการ' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-gray-200)]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-[var(--color-gray-500)]">
                        {locale === 'th' ? 'กำลังโหลด...' : 'Loading...'}
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-[var(--color-gray-500)]">
                        {locale === 'th' ? 'ไม่พบสินค้า' : 'No products found'}
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="hover:bg-[var(--color-gray-100)]">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm">{item.serial12}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{item.productMaster?.sku || item.sku || '-'}</p>
                            <p className="text-sm text-[var(--color-gray-500)]">
                              {item.productMaster
                                ? (locale === 'th' ? item.productMaster.nameTh : item.productMaster.nameEn || item.productMaster.nameTh)
                                : item.name || '-'}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(item.status)}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-red-600">{item.damageNote?.reason || '-'}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--color-gray-500)]">
                          {formatDate(item.damagedAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openRestoreModal(item)}
                            className="px-3 py-1.5 text-sm bg-[var(--color-mint)] text-white rounded-lg hover:bg-[var(--color-mint-dark)] transition-colors"
                          >
                            {locale === 'th' ? 'จัดการ' : 'Manage'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-[var(--color-gray-200)] flex items-center justify-between">
                <p className="text-sm text-[var(--color-gray-500)]">
                  {locale === 'th'
                    ? `แสดง ${items.length} จาก ${pagination.total} รายการ`
                    : `Showing ${items.length} of ${pagination.total} items`}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="px-3 py-1.5 text-sm border border-[var(--color-gray-200)] rounded-lg disabled:opacity-50"
                  >
                    {locale === 'th' ? 'ก่อนหน้า' : 'Previous'}
                  </button>
                  <button
                    onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1.5 text-sm border border-[var(--color-gray-200)] rounded-lg disabled:opacity-50"
                  >
                    {locale === 'th' ? 'ถัดไป' : 'Next'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Return Tab Content */}
        {mainTab === 'return' && (
          <div className="p-4 md:p-6">
            {/* Return Mode Selection Cards */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {/* Individual Return Card */}
              <button
                onClick={() => {
                  setReturnMode('individual')
                  setLotProducts([])
                  setSelectedLotProducts([])
                  setSearchLot('')
                  setLotError('')
                }}
                className={`p-5 rounded-xl border-2 text-left transition-all ${
                  returnMode === 'individual'
                    ? 'border-orange-500 bg-orange-50 shadow-md'
                    : 'border-[var(--color-gray-200)] bg-white hover:border-orange-300 hover:bg-orange-50/50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    returnMode === 'individual' ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-500'
                  }`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold text-lg ${returnMode === 'individual' ? 'text-orange-700' : 'text-[var(--color-charcoal)]'}`}>
                      {locale === 'th' ? 'รับคืนรายชิ้น' : 'Individual Return'}
                    </h3>
                    <p className="text-sm text-[var(--color-gray-500)] mt-1">
                      {locale === 'th'
                        ? 'ค้นหาและรับคืนสินค้าทีละชิ้นด้วยหมายเลข Serial'
                        : 'Search and return products one by one using Serial number'}
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    returnMode === 'individual' ? 'border-orange-500 bg-orange-500' : 'border-[var(--color-gray-300)]'
                  }`}>
                    {returnMode === 'individual' && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
              </button>

              {/* Lot Return Card */}
              <button
                onClick={() => {
                  setReturnMode('lot')
                  setSearchResult(null)
                  setSearchSerial('')
                  setSearchError('')
                }}
                className={`p-5 rounded-xl border-2 text-left transition-all ${
                  returnMode === 'lot'
                    ? 'border-orange-500 bg-orange-50 shadow-md'
                    : 'border-[var(--color-gray-200)] bg-white hover:border-orange-300 hover:bg-orange-50/50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    returnMode === 'lot' ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-500'
                  }`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold text-lg ${returnMode === 'lot' ? 'text-orange-700' : 'text-[var(--color-charcoal)]'}`}>
                      {locale === 'th' ? 'รับคืนทั้ง Lot' : 'Lot Return'}
                    </h3>
                    <p className="text-sm text-[var(--color-gray-500)] mt-1">
                      {locale === 'th'
                        ? 'ค้นหาและรับคืนสินค้าหลายชิ้นพร้อมกันในล็อตเดียวกัน'
                        : 'Search and return multiple products in the same lot at once'}
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    returnMode === 'lot' ? 'border-orange-500 bg-orange-500' : 'border-[var(--color-gray-300)]'
                  }`}>
                    {returnMode === 'lot' && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
              </button>
            </div>

            {/* Divider */}
            <div className="border-t border-[var(--color-gray-200)] my-6" />

            {/* Individual Return Mode */}
            {returnMode === 'individual' && (
              <div className="bg-[var(--color-gray-100)] rounded-xl p-5">
                <h3 className="font-semibold text-[var(--color-charcoal)] mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {locale === 'th' ? 'ค้นหาสินค้าด้วย Serial' : 'Search Product by Serial'}
                </h3>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={searchSerial}
                      onChange={(e) => setSearchSerial(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder={locale === 'th' ? 'กรอก Serial 12 หลัก' : 'Enter 12-digit Serial'}
                      className="w-full px-4 py-3 bg-white border border-[var(--color-gray-200)] rounded-lg focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {isSearching ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {locale === 'th' ? 'กำลังค้นหา...' : 'Searching...'}
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {locale === 'th' ? 'ค้นหา' : 'Search'}
                      </>
                    )}
                  </button>
                </div>

                {searchError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {searchError}
                  </div>
                )}

                {searchResult && (
                  <div className="mt-5 p-5 bg-white border border-[var(--color-gray-200)] rounded-xl shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h3 className="font-semibold text-green-700">{locale === 'th' ? 'พบสินค้า' : 'Product Found'}</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div className="bg-[var(--color-gray-100)] p-3 rounded-lg">
                        <span className="text-[var(--color-gray-500)] text-xs uppercase tracking-wide">Serial</span>
                        <p className="font-mono font-semibold text-[var(--color-gold)] mt-1">{searchResult.serial12}</p>
                      </div>
                      <div className="bg-[var(--color-gray-100)] p-3 rounded-lg">
                        <span className="text-[var(--color-gray-500)] text-xs uppercase tracking-wide">{locale === 'th' ? 'สถานะ' : 'Status'}</span>
                        <div className="mt-1">{getStatusBadge(searchResult.status)}</div>
                      </div>
                      <div className="col-span-full bg-[var(--color-gray-100)] p-3 rounded-lg">
                        <span className="text-[var(--color-gray-500)] text-xs uppercase tracking-wide">{locale === 'th' ? 'ชื่อสินค้า' : 'Product Name'}</span>
                        <p className="font-medium mt-1">{searchResult.name}</p>
                      </div>
                      {searchResult.assignedClinic && (
                        <div className="col-span-full bg-[var(--color-gray-100)] p-3 rounded-lg">
                          <span className="text-[var(--color-gray-500)] text-xs uppercase tracking-wide">{locale === 'th' ? 'คลินิก' : 'Clinic'}</span>
                          <p className="font-medium mt-1">{searchResult.assignedClinic.name}</p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setShowReturnModal(true)}
                      className="mt-5 w-full sm:w-auto px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      {locale === 'th' ? 'รับคืนสินค้านี้' : 'Return this Product'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Lot Return Mode */}
            {returnMode === 'lot' && (
              <div className="bg-[var(--color-gray-100)] rounded-xl p-5">
                <h3 className="font-semibold text-[var(--color-charcoal)] mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {locale === 'th' ? 'ค้นหาสินค้าด้วยหมายเลข Lot' : 'Search Products by Lot Number'}
                </h3>
                <p className="text-sm text-[var(--color-gray-500)] mb-4">
                  {locale === 'th'
                    ? 'เฉพาะสินค้าที่มีสถานะ SHIPPED หรือ ACTIVATED เท่านั้น'
                    : 'Only products with SHIPPED or ACTIVATED status'}
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={searchLot}
                      onChange={(e) => setSearchLot(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLotSearch()}
                      placeholder={locale === 'th' ? 'กรอกหมายเลข Lot' : 'Enter Lot number'}
                      className="w-full px-4 py-3 bg-white border border-[var(--color-gray-200)] rounded-lg focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                  <button
                    onClick={handleLotSearch}
                    disabled={isSearchingLot}
                    className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {isSearchingLot ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {locale === 'th' ? 'กำลังค้นหา...' : 'Searching...'}
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {locale === 'th' ? 'ค้นหา' : 'Search'}
                      </>
                    )}
                  </button>
                </div>

                {lotError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {lotError}
                  </div>
                )}

                {lotProducts.length > 0 && (
                  <div className="mt-5 bg-white border border-[var(--color-gray-200)] rounded-xl shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-[var(--color-gray-200)] bg-gradient-to-r from-orange-50 to-white">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          <span className="font-semibold text-[var(--color-charcoal)]">Lot: {searchLot}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                            {selectedLotProducts.length}/{lotProducts.length} {locale === 'th' ? 'รายการ' : 'items'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Select All */}
                    <div className="p-3 border-b border-[var(--color-gray-200)] bg-[var(--color-gray-100)]">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedLotProducts.length === lotProducts.length && lotProducts.length > 0}
                          onChange={toggleAllLotProducts}
                          className="w-5 h-5 rounded border-[var(--color-gray-300)] text-orange-500 focus:ring-orange-200"
                        />
                        <span className="text-sm font-medium">{locale === 'th' ? 'เลือกทั้งหมด' : 'Select All'}</span>
                      </label>
                    </div>

                    {/* Product List */}
                    <div className="max-h-72 overflow-y-auto divide-y divide-[var(--color-gray-100)]">
                      {lotProducts.map((product) => (
                        <label
                          key={product.id}
                          className={`flex items-start gap-3 p-4 cursor-pointer transition-colors ${
                            selectedLotProducts.includes(product.id)
                              ? 'bg-orange-50 hover:bg-orange-100'
                              : 'hover:bg-[var(--color-gray-100)]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedLotProducts.includes(product.id)}
                            onChange={() => toggleLotProductSelection(product.id)}
                            className="w-5 h-5 mt-0.5 rounded border-[var(--color-gray-300)] text-orange-500 focus:ring-orange-200"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm font-semibold text-[var(--color-gold)]">{product.serial12}</span>
                              {getStatusBadge(product.status)}
                            </div>
                            <p className="text-sm text-[var(--color-gray-600)] mt-1 truncate">{product.name}</p>
                            {product.assignedClinic && (
                              <p className="text-xs text-[var(--color-gray-400)] mt-0.5">{product.assignedClinic.name}</p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-[var(--color-gray-200)] bg-[var(--color-gray-100)]">
                      <button
                        onClick={() => setShowLotReturnModal(true)}
                        disabled={selectedLotProducts.length === 0}
                        className="w-full px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        {locale === 'th'
                          ? `รับคืนสินค้าที่เลือก (${selectedLotProducts.length} รายการ)`
                          : `Return Selected (${selectedLotProducts.length} items)`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Restore Modal */}
      {showRestoreModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              {locale === 'th' ? 'จัดการสินค้า' : 'Manage Product'}
            </h3>

            <div className="bg-[var(--color-gray-100)] rounded-lg p-4 mb-4">
              <p className="font-mono text-sm">{selectedItem.serial12}</p>
              <p className="font-medium">{selectedItem.productMaster?.sku || selectedItem.sku}</p>
              <p className="text-sm text-[var(--color-gray-500)]">
                {selectedItem.productMaster
                  ? (locale === 'th' ? selectedItem.productMaster.nameTh : selectedItem.productMaster.nameEn || selectedItem.productMaster.nameTh)
                  : selectedItem.name}
              </p>
              <div className="mt-2">{getStatusBadge(selectedItem.status)}</div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                {locale === 'th' ? 'บันทึกการซ่อม/หมายเหตุ' : 'Repair Note/Remarks'}
              </label>
              <textarea
                value={repairNote}
                onChange={(e) => setRepairNote(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-[var(--color-gray-200)] rounded-lg focus:outline-none focus:border-[var(--color-gold)]"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleRestore('restore')}
                disabled={restoring}
                className="flex-1 py-2 bg-[var(--color-mint)] text-white rounded-lg hover:bg-[var(--color-mint-dark)] disabled:opacity-50"
              >
                {restoring ? '...' : (locale === 'th' ? 'คืนเข้าคลัง' : 'Restore')}
              </button>
              <button
                onClick={() => handleRestore('scrap')}
                disabled={restoring}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {locale === 'th' ? 'ทิ้ง' : 'Scrap'}
              </button>
              <button
                onClick={() => {
                  setShowRestoreModal(false)
                  setSelectedItem(null)
                }}
                disabled={restoring}
                className="px-4 py-2 border border-[var(--color-gray-200)] rounded-lg"
              >
                {locale === 'th' ? 'ปิด' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && searchResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              {locale === 'th' ? 'ยืนยันการรับคืนสินค้า' : 'Confirm Product Return'}
            </h3>

            <div className="bg-[var(--color-gray-100)] rounded-lg p-4 mb-4">
              <p className="font-mono text-sm">{searchResult.serial12}</p>
              <p className="text-sm">{searchResult.name}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                {locale === 'th' ? 'เหตุผลการรับคืน' : 'Return Reason'} <span className="text-red-500">*</span>
              </label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--color-gray-200)] rounded-lg focus:outline-none focus:border-[var(--color-gold)]"
              >
                <option value="">{locale === 'th' ? '-- เลือกเหตุผล --' : '-- Select reason --'}</option>
                <option value="สินค้าชำรุด">{locale === 'th' ? 'สินค้าชำรุด' : 'Damaged product'}</option>
                <option value="สินค้าหมดอายุ">{locale === 'th' ? 'สินค้าหมดอายุ' : 'Expired product'}</option>
                <option value="คลินิกปิดกิจการ">{locale === 'th' ? 'คลินิกปิดกิจการ' : 'Clinic closed'}</option>
                <option value="เปลี่ยนสินค้า">{locale === 'th' ? 'เปลี่ยนสินค้า' : 'Product exchange'}</option>
                <option value="ส่งผิด">{locale === 'th' ? 'ส่งผิด' : 'Wrong shipment'}</option>
                <option value="ลูกค้าไม่ต้องการ">{locale === 'th' ? 'ลูกค้าไม่ต้องการ' : 'Customer declined'}</option>
                <option value="อื่นๆ">{locale === 'th' ? 'อื่นๆ' : 'Other'}</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                {locale === 'th' ? 'หมายเหตุ' : 'Notes'}
              </label>
              <textarea
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-[var(--color-gray-200)] rounded-lg focus:outline-none focus:border-[var(--color-gold)]"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReturn}
                disabled={!returnReason || isProcessing}
                className="flex-1 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                {isProcessing ? '...' : (locale === 'th' ? 'ยืนยันรับคืน' : 'Confirm Return')}
              </button>
              <button
                onClick={() => {
                  setShowReturnModal(false)
                  setReturnReason('')
                  setReturnNotes('')
                }}
                className="px-4 py-2 border border-[var(--color-gray-200)] rounded-lg"
              >
                {locale === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lot Return Modal */}
      {showLotReturnModal && selectedLotProducts.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              {locale === 'th' ? 'ยืนยันการรับคืนสินค้าทั้ง Lot' : 'Confirm Lot Return'}
            </h3>

            <div className="bg-[var(--color-gray-100)] rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Lot: {searchLot}</span>
                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-sm">
                  {selectedLotProducts.length} {locale === 'th' ? 'รายการ' : 'items'}
                </span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 text-sm">
                {lotProducts
                  .filter((p) => selectedLotProducts.includes(p.id))
                  .map((p) => (
                    <div key={p.id} className="flex justify-between">
                      <span className="font-mono text-[var(--color-gold)]">{p.serial12}</span>
                      <span className="text-[var(--color-gray-500)] truncate ml-2">{p.name}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                {locale === 'th' ? 'เหตุผลการรับคืน' : 'Return Reason'} <span className="text-red-500">*</span>
              </label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--color-gray-200)] rounded-lg focus:outline-none focus:border-[var(--color-gold)]"
              >
                <option value="">{locale === 'th' ? '-- เลือกเหตุผล --' : '-- Select reason --'}</option>
                <option value="สินค้าชำรุด">{locale === 'th' ? 'สินค้าชำรุด' : 'Damaged product'}</option>
                <option value="สินค้าหมดอายุ">{locale === 'th' ? 'สินค้าหมดอายุ' : 'Expired product'}</option>
                <option value="คลินิกปิดกิจการ">{locale === 'th' ? 'คลินิกปิดกิจการ' : 'Clinic closed'}</option>
                <option value="เปลี่ยนสินค้า">{locale === 'th' ? 'เปลี่ยนสินค้า' : 'Product exchange'}</option>
                <option value="ส่งผิด">{locale === 'th' ? 'ส่งผิด' : 'Wrong shipment'}</option>
                <option value="อื่นๆ">{locale === 'th' ? 'อื่นๆ' : 'Other'}</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                {locale === 'th' ? 'หมายเหตุ' : 'Notes'}
              </label>
              <textarea
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-[var(--color-gray-200)] rounded-lg focus:outline-none focus:border-[var(--color-gold)]"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleLotReturn}
                disabled={!returnReason || isProcessing}
                className="flex-1 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                {isProcessing ? '...' : (locale === 'th' ? `ยืนยันรับคืน ${selectedLotProducts.length} รายการ` : `Confirm Return ${selectedLotProducts.length} items`)}
              </button>
              <button
                onClick={() => {
                  setShowLotReturnModal(false)
                  setReturnReason('')
                  setReturnNotes('')
                }}
                className="px-4 py-2 border border-[var(--color-gray-200)] rounded-lg"
              >
                {locale === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
