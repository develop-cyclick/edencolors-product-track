'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAlert } from '@/components/ui/confirm-modal'

interface ReturnedProduct {
  id: number
  serial12: string
  name: string
  category: string
  clinic: {
    id: number
    name: string
    province: string
  } | null
  wasActivated: boolean
  activatedBy?: string
  activatedAt?: string
  returnedBy?: string
  returnedAt?: string
  returnReason?: string
  returnNotes?: string
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

type ReturnMode = 'individual' | 'lot'

export default function ReturnPage() {
  const params = useParams()
  const locale = params.locale as string
  const alert = useAlert()

  // Return mode state
  const [returnMode, setReturnMode] = useState<ReturnMode>('individual')

  // Individual return states
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

  const [returnedProducts, setReturnedProducts] = useState<ReturnedProduct[]>([])
  const [isLoadingReturned, setIsLoadingReturned] = useState(false)
  const [returnedPagination, setReturnedPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  })

  const [showReturnModal, setShowReturnModal] = useState(false)
  const [showLotReturnModal, setShowLotReturnModal] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Search for a product by serial
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
        const errorText = await res.text()
        console.error('Lot search API error:', res.status, errorText)
        setLotError(locale === 'th' ? `เกิดข้อผิดพลาด: ${res.status}` : `Error: ${res.status}`)
        return
      }

      const text = await res.text()
      if (!text) {
        setLotError(locale === 'th' ? 'ไม่พบสินค้าในล็อตที่ค้นหา' : 'No products found in this lot')
        return
      }

      const data = JSON.parse(text)

      if (!data.success || !data.data?.items?.length) {
        setLotError(locale === 'th' ? 'ไม่พบสินค้าในล็อตที่ค้นหา หรือไม่มีสินค้าที่สามารถรับคืนได้' : 'No products found in this lot or no returnable products')
        return
      }

      // Filter only returnable products
      const returnableProducts = data.data.items.filter((p: LotProduct) =>
        ['SHIPPED', 'ACTIVATED'].includes(p.status)
      )

      if (returnableProducts.length === 0) {
        setLotError(locale === 'th' ? 'ไม่มีสินค้าในล็อตนี้ที่สามารถรับคืนได้' : 'No returnable products in this lot')
        return
      }

      setLotProducts(returnableProducts)
      // Select all by default
      setSelectedLotProducts(returnableProducts.map((p: LotProduct) => p.id))
    } catch (error) {
      console.error('Lot search error:', error)
      setLotError(locale === 'th' ? `เกิดข้อผิดพลาดในการค้นหา: ${error instanceof Error ? error.message : 'Unknown error'}` : `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSearchingLot(false)
    }
  }

  // Toggle product selection in lot return
  const toggleLotProductSelection = (productId: number) => {
    setSelectedLotProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  // Select/deselect all lot products
  const toggleAllLotProducts = () => {
    if (selectedLotProducts.length === lotProducts.length) {
      setSelectedLotProducts([])
    } else {
      setSelectedLotProducts(lotProducts.map(p => p.id))
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
          ? `รับคืนสินค้าสำเร็จ ${data.data.returnedCount} รายการ${data.data.skippedCount > 0 ? ` (ข้าม ${data.data.skippedCount} รายการ)` : ''}`
          : `${data.data.returnedCount} products returned successfully${data.data.skippedCount > 0 ? ` (${data.data.skippedCount} skipped)` : ''}`
        await alert({ title: locale === 'th' ? 'สำเร็จ' : 'Success', message, variant: 'success', icon: 'success' })
        setShowLotReturnModal(false)
        setLotProducts([])
        setSelectedLotProducts([])
        setSearchLot('')
        setReturnReason('')
        setReturnNotes('')
        loadReturnedProducts()
      } else {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: data.error || (locale === 'th' ? 'เกิดข้อผิดพลาด' : 'An error occurred'), variant: 'error', icon: 'error' })
      }
    } catch (error) {
      console.error('Lot return error:', error)
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'เกิดข้อผิดพลาดในการรับคืนสินค้า' : 'Failed to return products', variant: 'error', icon: 'error' })
    } finally {
      setIsProcessing(false)
    }
  }

  // Load returned products list
  const loadReturnedProducts = async (page = 1) => {
    setIsLoadingReturned(true)
    try {
      const res = await fetch(`/api/warehouse/return?page=${page}&limit=10`)
      const data = await res.json()

      if (data.success) {
        setReturnedProducts(data.data.items)
        setReturnedPagination({
          page: data.data.pagination.page,
          totalPages: data.data.pagination.totalPages,
          total: data.data.pagination.total,
        })
      }
    } catch (error) {
      console.error('Load returned products error:', error)
    } finally {
      setIsLoadingReturned(false)
    }
  }

  // Load returned products on mount
  useEffect(() => {
    loadReturnedProducts()
  }, [])

  // Process return
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
        await alert({ title: locale === 'th' ? 'สำเร็จ' : 'Success', message: locale === 'th' ? 'รับคืนสินค้าสำเร็จ' : 'Product returned successfully', variant: 'success', icon: 'success' })
        setShowReturnModal(false)
        setSearchResult(null)
        setSearchSerial('')
        setReturnReason('')
        setReturnNotes('')
        loadReturnedProducts()
      } else {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: data.error || (locale === 'th' ? 'เกิดข้อผิดพลาด' : 'An error occurred'), variant: 'error', icon: 'error' })
      }
    } catch (error) {
      console.error('Return error:', error)
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'เกิดข้อผิดพลาดในการรับคืนสินค้า' : 'Failed to return product', variant: 'error', icon: 'error' })
    } finally {
      setIsProcessing(false)
    }
  }

  // Format date
  const formatDate = (dateStr: string | undefined) => {
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
      ACTIVATED: { bg: 'bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]', dot: 'bg-[var(--color-mint)]', label: 'เปิดใช้งานแล้ว', labelEn: 'Activated' },
      SHIPPED: { bg: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', label: 'ส่งออกแล้ว', labelEn: 'Shipped' },
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-display text-2xl font-bold text-[var(--color-charcoal)]">
            {locale === 'th' ? 'รับคืนสินค้า' : 'Product Returns'}
          </h1>
          <p className="text-[var(--color-foreground-muted)] mt-1">
            {locale === 'th' ? 'บันทึกการรับคืนสินค้าจากคลินิก' : 'Record product returns from clinics'}
          </p>
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-[var(--color-beige)]">
          <button
            onClick={() => {
              setReturnMode('individual')
              setLotProducts([])
              setSelectedLotProducts([])
              setSearchLot('')
              setLotError('')
            }}
            className={`flex-1 px-4 py-4 text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
              returnMode === 'individual'
                ? 'text-[var(--color-gold)] border-b-2 border-[var(--color-gold)] bg-[var(--color-gold)]/5'
                : 'text-[var(--color-foreground-muted)] hover:text-[var(--color-charcoal)] hover:bg-[var(--color-off-white)]'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {locale === 'th' ? 'รับคืนรายชิ้น' : 'Individual Return'}
          </button>
          <button
            onClick={() => {
              setReturnMode('lot')
              setSearchResult(null)
              setSearchSerial('')
              setSearchError('')
            }}
            className={`flex-1 px-4 py-4 text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
              returnMode === 'lot'
                ? 'text-[var(--color-gold)] border-b-2 border-[var(--color-gold)] bg-[var(--color-gold)]/5'
                : 'text-[var(--color-foreground-muted)] hover:text-[var(--color-charcoal)] hover:bg-[var(--color-off-white)]'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            {locale === 'th' ? 'รับคืนทั้ง Lot' : 'Lot Return'}
          </button>
        </div>

        <div className="p-4 md:p-6">
          {/* Individual Return Mode */}
          {returnMode === 'individual' && (
            <>
              <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
                {locale === 'th' ? 'ค้นหาสินค้าที่ต้องการรับคืน' : 'Search Product to Return'}
              </h2>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
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
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder={locale === 'th' ? 'กรอก Serial 12 หลัก' : 'Enter 12-digit Serial'}
                    className="w-full pl-12 pr-4 py-3 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-gold)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(201,163,90,0.35)] disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-200"
                >
                  {isSearching ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="hidden sm:inline">{locale === 'th' ? 'กำลังค้นหา...' : 'Searching...'}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {locale === 'th' ? 'ค้นหา' : 'Search'}
                    </>
                  )}
                </button>
              </div>

              {searchError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-sm text-red-700">{searchError}</p>
                </div>
              )}

              {/* Search Result */}
              {searchResult && (
                <div className="mt-6 p-5 border border-[var(--color-beige)] rounded-xl bg-[var(--color-off-white)]">
                  <h3 className="font-semibold text-lg text-[var(--color-charcoal)] mb-4">
                    {locale === 'th' ? 'ข้อมูลสินค้า' : 'Product Information'}
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-[var(--color-foreground-muted)]">Serial:</span>
                      <span className="ml-2 font-mono font-medium text-[var(--color-charcoal)]">{searchResult.serial12}</span>
                    </div>
                    <div>
                      <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ชื่อ:' : 'Name:'}</span>
                      <span className="ml-2 text-[var(--color-charcoal)]">{searchResult.name}</span>
                    </div>
                    <div>
                      <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'หมวดหมู่:' : 'Category:'}</span>
                      <span className="ml-2 text-[var(--color-charcoal)]">{locale === 'th' ? searchResult.category.nameTh : searchResult.category.nameEn}</span>
                    </div>
                    <div>
                      <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'สถานะ:' : 'Status:'}</span>
                      <span className="ml-2">{getStatusBadge(searchResult.status)}</span>
                    </div>
                    {searchResult.assignedClinic && (
                      <div className="col-span-2">
                        <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'คลินิก:' : 'Clinic:'}</span>
                        <span className="ml-2 text-[var(--color-charcoal)]">{searchResult.assignedClinic.name}</span>
                      </div>
                    )}
                    {searchResult.activation && (
                      <>
                        <div>
                          <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ลงทะเบียนโดย:' : 'Registered by:'}</span>
                          <span className="ml-2 text-[var(--color-charcoal)]">{searchResult.activation.customerName}</span>
                        </div>
                        <div>
                          <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'วันที่ลงทะเบียน:' : 'Registration date:'}</span>
                          <span className="ml-2 text-[var(--color-charcoal)]">{formatDate(searchResult.activation.createdAt)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => setShowReturnModal(true)}
                    className="mt-5 flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(249,115,22,0.25)] hover:bg-orange-600 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(249,115,22,0.35)] transition-all duration-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    {locale === 'th' ? 'รับคืนสินค้านี้' : 'Return this Product'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Lot Return Mode */}
          {returnMode === 'lot' && (
            <>
              <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
                {locale === 'th' ? 'ค้นหาสินค้าตาม Lot' : 'Search Products by Lot'}
              </h2>
              <p className="text-sm text-[var(--color-foreground-muted)] mb-4">
                {locale === 'th'
                  ? 'ค้นหาและรับคืนสินค้าทั้งหมดใน Lot เดียวกัน (เฉพาะสินค้าที่มีสถานะ SHIPPED หรือ ACTIVATED)'
                  : 'Search and return all products in the same lot (only SHIPPED or ACTIVATED products)'}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="relative flex-1">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-foreground-muted)]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={searchLot}
                    onChange={(e) => setSearchLot(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLotSearch()}
                    placeholder={locale === 'th' ? 'กรอกหมายเลข Lot' : 'Enter Lot number'}
                    className="w-full pl-12 pr-4 py-3 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
                  />
                </div>
                <button
                  onClick={handleLotSearch}
                  disabled={isSearchingLot}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-gold)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(201,163,90,0.35)] disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-200"
                >
                  {isSearchingLot ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="hidden sm:inline">{locale === 'th' ? 'กำลังค้นหา...' : 'Searching...'}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {locale === 'th' ? 'ค้นหา' : 'Search'}
                    </>
                  )}
                </button>
              </div>

              {lotError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-sm text-red-700">{lotError}</p>
                </div>
              )}

              {/* Lot Products List */}
              {lotProducts.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg text-[var(--color-charcoal)]">
                      {locale === 'th' ? `สินค้าใน Lot: ${searchLot}` : `Products in Lot: ${searchLot}`}
                    </h3>
                    <span className="text-sm text-[var(--color-foreground-muted)]">
                      {locale === 'th'
                        ? `เลือก ${selectedLotProducts.length} จาก ${lotProducts.length} รายการ`
                        : `Selected ${selectedLotProducts.length} of ${lotProducts.length} items`}
                    </span>
                  </div>

                  {/* Select All */}
                  <div className="mb-3 p-3 bg-[var(--color-off-white)] rounded-xl flex items-center justify-between">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedLotProducts.length === lotProducts.length}
                        onChange={toggleAllLotProducts}
                        className="w-5 h-5 rounded border-[var(--color-beige)] text-[var(--color-gold)] focus:ring-[var(--color-gold)] cursor-pointer"
                      />
                      <span className="text-sm font-medium text-[var(--color-charcoal)]">
                        {locale === 'th' ? 'เลือกทั้งหมด' : 'Select All'}
                      </span>
                    </label>
                  </div>

                  {/* Products List */}
                  <div className="max-h-80 overflow-y-auto border border-[var(--color-beige)] rounded-xl divide-y divide-[var(--color-beige)]">
                    {lotProducts.map((product) => (
                      <label
                        key={product.id}
                        className={`flex items-start gap-3 p-4 cursor-pointer hover:bg-[var(--color-off-white)] transition-colors ${
                          selectedLotProducts.includes(product.id) ? 'bg-[var(--color-gold)]/5' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedLotProducts.includes(product.id)}
                          onChange={() => toggleLotProductSelection(product.id)}
                          className="w-5 h-5 mt-0.5 rounded border-[var(--color-beige)] text-[var(--color-gold)] focus:ring-[var(--color-gold)] cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-medium text-[var(--color-gold)]">
                              {product.serial12}
                            </span>
                            {getStatusBadge(product.status)}
                          </div>
                          <p className="text-sm text-[var(--color-charcoal)] mt-1">{product.name}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-[var(--color-foreground-muted)]">
                            <span>{locale === 'th' ? product.category.nameTh : product.category.nameEn}</span>
                            {product.assignedClinic && (
                              <span>• {product.assignedClinic.name}</span>
                            )}
                            {product.activation && (
                              <span className="text-[var(--color-mint-dark)]">
                                • {locale === 'th' ? 'Activated โดย' : 'Activated by'} {product.activation.customerName}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  {/* Lot Return Button */}
                  <button
                    onClick={() => setShowLotReturnModal(true)}
                    disabled={selectedLotProducts.length === 0}
                    className="mt-5 w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(249,115,22,0.25)] hover:bg-orange-600 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(249,115,22,0.35)] disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    {locale === 'th'
                      ? `รับคืนสินค้าที่เลือก (${selectedLotProducts.length} รายการ)`
                      : `Return Selected Products (${selectedLotProducts.length} items)`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Returned Products List */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
        <div className="p-5 border-b border-[var(--color-beige)] flex justify-between items-center bg-[var(--color-off-white)]">
          <h2 className="text-lg font-semibold text-[var(--color-charcoal)]">
            {locale === 'th' ? 'รายการสินค้าที่รับคืนแล้ว' : 'Returned Products'}
          </h2>
          <button
            onClick={() => loadReturnedProducts()}
            disabled={isLoadingReturned}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] transition-colors"
          >
            {isLoadingReturned ? (
              <>
                <div className="w-4 h-4 border-2 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin" />
                {locale === 'th' ? 'กำลังโหลด...' : 'Loading...'}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {locale === 'th' ? 'โหลดรายการ' : 'Load List'}
              </>
            )}
          </button>
        </div>

        {isLoadingReturned ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 relative">
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin" />
            </div>
            <p className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'กำลังโหลด...' : 'Loading...'}</p>
          </div>
        ) : returnedProducts.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-beige)]/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </div>
            <p className="text-[var(--color-foreground-muted)]">
              {locale === 'th' ? 'คลิก "โหลดรายการ" เพื่อดูรายการสินค้าที่รับคืนแล้ว' : 'Click "Load List" to view returned products'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-[var(--color-beige)]">
              {returnedProducts.map((product) => (
                <div key={product.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="font-mono text-sm font-medium text-[var(--color-gold)]">
                      {product.serial12}
                    </span>
                    {product.wasActivated ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-mint)]" />
                        {locale === 'th' ? 'Activated' : 'Activated'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-beige)]/50 text-[var(--color-foreground-muted)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-foreground-muted)]" />
                        {locale === 'th' ? 'ไม่' : 'No'}
                      </span>
                    )}
                  </div>

                  <div className="text-sm font-medium text-[var(--color-charcoal)] mb-1">{product.name}</div>
                  <div className="text-xs text-[var(--color-foreground-muted)] mb-3">{product.category}</div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'คลินิก:' : 'Clinic:'}</span>
                      <p className="text-[var(--color-charcoal)]">{product.clinic?.name || '-'}</p>
                    </div>
                    <div>
                      <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'เหตุผล:' : 'Reason:'}</span>
                      <p className="text-[var(--color-charcoal)]">{product.returnReason || '-'}</p>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-[var(--color-beige)] flex justify-between text-xs text-[var(--color-foreground-muted)]">
                    <span>{formatDate(product.returnedAt)}</span>
                    <span>{locale === 'th' ? 'โดย' : 'by'} {product.returnedBy}</span>
                  </div>
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
                      {locale === 'th' ? 'สินค้า' : 'Product'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'คลินิก' : 'Clinic'}
                    </th>
                    <th className="px-5 py-4 text-center text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'เคย Activate' : 'Was Activated'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'เหตุผลรับคืน' : 'Return Reason'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'วันที่รับคืน' : 'Returned Date'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-beige)]">
                  {returnedProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-[var(--color-off-white)]/50 transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-mono text-sm font-medium text-[var(--color-gold)]">
                          {product.serial12}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-[var(--color-charcoal)]">{product.name}</div>
                        <div className="text-xs text-[var(--color-foreground-muted)]">{product.category}</div>
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">
                        {product.clinic?.name || '-'}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {product.wasActivated ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-mint)]" />
                            {locale === 'th' ? 'ใช่' : 'Yes'} - {product.activatedBy}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-beige)]/50 text-[var(--color-foreground-muted)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-foreground-muted)]" />
                            {locale === 'th' ? 'ไม่' : 'No'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm text-[var(--color-charcoal)]">{product.returnReason || '-'}</div>
                        {product.returnNotes && (
                          <div className="text-xs text-[var(--color-foreground-muted)]">{product.returnNotes}</div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm text-[var(--color-charcoal)]">{formatDate(product.returnedAt)}</div>
                        <div className="text-xs text-[var(--color-foreground-muted)]">
                          {locale === 'th' ? 'โดย' : 'by'} {product.returnedBy}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {returnedPagination.totalPages > 1 && (
              <div className="px-5 py-4 border-t border-[var(--color-beige)] flex items-center justify-between bg-[var(--color-off-white)]">
                <div className="text-sm text-[var(--color-foreground-muted)]">
                  {locale === 'th' ? `ทั้งหมด ${returnedPagination.total} รายการ` : `Total ${returnedPagination.total} items`}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadReturnedProducts(returnedPagination.page - 1)}
                    disabled={returnedPagination.page <= 1}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--color-charcoal)] border border-[var(--color-beige)] rounded-lg hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-50 disabled:hover:border-[var(--color-beige)] disabled:hover:text-[var(--color-charcoal)] transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {locale === 'th' ? 'ก่อนหน้า' : 'Previous'}
                  </button>
                  <span className="text-sm text-[var(--color-foreground-muted)]">
                    {returnedPagination.page} / {returnedPagination.totalPages}
                  </span>
                  <button
                    onClick={() => loadReturnedProducts(returnedPagination.page + 1)}
                    disabled={returnedPagination.page >= returnedPagination.totalPages}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--color-charcoal)] border border-[var(--color-beige)] rounded-lg hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-50 disabled:hover:border-[var(--color-beige)] disabled:hover:text-[var(--color-charcoal)] transition-all"
                  >
                    {locale === 'th' ? 'ถัดไป' : 'Next'}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Return Modal */}
      {showReturnModal && searchResult && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-[var(--shadow-lg)] max-w-md w-full overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-[var(--color-beige)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[var(--color-charcoal)]">
                  {locale === 'th' ? 'ยืนยันการรับคืนสินค้า' : 'Confirm Product Return'}
                </h3>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Product Info */}
              <div className="p-4 bg-[var(--color-off-white)] rounded-xl">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-foreground-muted)]">Serial:</span>
                    <span className="font-mono font-medium text-[var(--color-charcoal)]">{searchResult.serial12}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'สินค้า:' : 'Product:'}</span>
                    <span className="text-[var(--color-charcoal)]">{searchResult.name}</span>
                  </div>
                </div>
              </div>

              {/* Return Reason */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-2">
                  {locale === 'th' ? 'เหตุผลการรับคืน' : 'Return Reason'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="appearance-none w-full px-4 py-3 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
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
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-foreground-muted)]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-2">
                  {locale === 'th' ? 'หมายเหตุเพิ่มเติม' : 'Additional Notes'}
                </label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  rows={3}
                  placeholder={locale === 'th' ? 'รายละเอียดเพิ่มเติม (ถ้ามี)' : 'Additional details (optional)'}
                  className="w-full px-4 py-3 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-[var(--color-beige)] flex gap-3">
              <button
                onClick={() => {
                  setShowReturnModal(false)
                  setReturnReason('')
                  setReturnNotes('')
                }}
                className="flex-1 px-4 py-3 text-sm font-medium text-[var(--color-charcoal)] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] transition-all duration-200"
              >
                {locale === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                onClick={handleReturn}
                disabled={!returnReason || isProcessing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-orange-500 text-white rounded-xl shadow-[0_4px_14px_rgba(249,115,22,0.25)] hover:bg-orange-600 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(249,115,22,0.35)] disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-200"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {locale === 'th' ? 'กำลังดำเนินการ...' : 'Processing...'}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {locale === 'th' ? 'ยืนยันรับคืน' : 'Confirm Return'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lot Return Modal */}
      {showLotReturnModal && selectedLotProducts.length > 0 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-[var(--shadow-lg)] max-w-lg w-full overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-[var(--color-beige)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'ยืนยันการรับคืนสินค้าทั้ง Lot' : 'Confirm Lot Return'}
                  </h3>
                  <p className="text-sm text-[var(--color-foreground-muted)]">
                    Lot: {searchLot}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Products Summary */}
              <div className="p-4 bg-[var(--color-off-white)] rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'สินค้าที่เลือก' : 'Selected Products'}
                  </span>
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                    {selectedLotProducts.length} {locale === 'th' ? 'รายการ' : 'items'}
                  </span>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-2">
                  {lotProducts
                    .filter((p) => selectedLotProducts.includes(p.id))
                    .map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-sm">
                        <span className="font-mono text-[var(--color-gold)]">{p.serial12}</span>
                        <span className="text-[var(--color-foreground-muted)] truncate ml-2">{p.name}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Return Reason */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-2">
                  {locale === 'th' ? 'เหตุผลการรับคืน' : 'Return Reason'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="appearance-none w-full px-4 py-3 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
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
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-foreground-muted)]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-2">
                  {locale === 'th' ? 'หมายเหตุเพิ่มเติม' : 'Additional Notes'}
                </label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  rows={3}
                  placeholder={locale === 'th' ? 'รายละเอียดเพิ่มเติม (ถ้ามี)' : 'Additional details (optional)'}
                  className="w-full px-4 py-3 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-[var(--color-beige)] flex gap-3">
              <button
                onClick={() => {
                  setShowLotReturnModal(false)
                  setReturnReason('')
                  setReturnNotes('')
                }}
                className="flex-1 px-4 py-3 text-sm font-medium text-[var(--color-charcoal)] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] transition-all duration-200"
              >
                {locale === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                onClick={handleLotReturn}
                disabled={!returnReason || isProcessing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-orange-500 text-white rounded-xl shadow-[0_4px_14px_rgba(249,115,22,0.25)] hover:bg-orange-600 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(249,115,22,0.35)] disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-200"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {locale === 'th' ? 'กำลังดำเนินการ...' : 'Processing...'}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {locale === 'th' ? `ยืนยันรับคืน ${selectedLotProducts.length} รายการ` : `Confirm Return ${selectedLotProducts.length} items`}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
