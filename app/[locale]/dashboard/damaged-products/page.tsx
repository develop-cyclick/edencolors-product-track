'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAlert } from '@/components/ui/confirm-modal'

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
  pendingRequest: { actionType: string; createdAt: string } | null
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
    address: string
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

type ActiveTab = 'damaged' | 'return' | 'borrow' | 'return_borrowed' | 'history' | 'claim'
type ReturnMode = 'individual' | 'lot'
type StatusFilter = 'all' | 'DAMAGED' | 'RETURNED'
type BorrowHistoryFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED'

interface BorrowTransaction {
  id: number
  transactionNo: string
  type: string
  status: string
  borrowerName: string
  clinicName: string | null
  reason: string | null
  createdAt: string
  approvedAt: string | null
  createdBy: { displayName: string }
  approvedBy: { displayName: string } | null
  lines: BorrowTransactionLine[]
}

interface BorrowTransactionLine {
  id: number
  sku: string
  itemName: string
  productItem: { serial12: string; status: string }
}

interface BorrowSearchResult {
  id: number
  serial12: string
  name: string
  sku: string
  lot?: string
  modelSize?: string
  expDate?: string
  status: string
  productMasterId?: number
  productMaster?: {
    id: number
    nameTh: string
    nameEn: string | null
    modelSize: string | null
    defaultUnitId: number | null
  }
}

export default function DamagedProductsPage() {
  const params = useParams()
  const locale = params.locale as string
  const alert = useAlert()

  // --- Tab & Navigation ---
  const [activeTab, setActiveTab] = useState<ActiveTab>('damaged')

  // --- Damaged Products List ---
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

  // --- Restore Modal ---
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<DamagedProduct | null>(null)
  const [repairNote, setRepairNote] = useState('')
  const [restoring, setRestoring] = useState(false)

  // --- Return Individual ---
  const [returnMode, setReturnMode] = useState<ReturnMode>('individual')
  const [searchSerial, setSearchSerial] = useState('')
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [searchError, setSearchError] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  // --- Return Lot ---
  const [searchLot, setSearchLot] = useState('')
  const [lotProducts, setLotProducts] = useState<LotProduct[]>([])
  const [lotError, setLotError] = useState('')
  const [isSearchingLot, setIsSearchingLot] = useState(false)
  const [selectedLotProducts, setSelectedLotProducts] = useState<number[]>([])

  // --- Return Modal Shared ---
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [showLotReturnModal, setShowLotReturnModal] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // --- Borrow / Return Borrowed Product Selection ---
  const [borrowProductsList, setBorrowProductsList] = useState<BorrowSearchResult[]>([])
  const [borrowProductsLoading, setBorrowProductsLoading] = useState(false)
  const [borrowProductsFilter, setBorrowProductsFilter] = useState('')
  const [selectedBorrowProducts, setSelectedBorrowProducts] = useState<number[]>([])
  const [borrowProductsPagination, setBorrowProductsPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })

  // --- Borrow Form ---
  const [borrowerName, setBorrowerName] = useState('')
  const [borrowClinicName, setBorrowClinicName] = useState('')
  const [borrowClinicAddress, setBorrowClinicAddress] = useState('')
  const [borrowTaxInvoice, setBorrowTaxInvoice] = useState('')
  const [borrowReason, setBorrowReason] = useState('')
  const [borrowRemarks, setBorrowRemarks] = useState('')
  const [borrowContactName, setBorrowContactName] = useState('')
  const [borrowContactPhone, setBorrowContactPhone] = useState('')
  const [isBorrowSubmitting, setIsBorrowSubmitting] = useState(false)

  // --- History ---
  const [borrowHistory, setBorrowHistory] = useState<BorrowTransaction[]>([])
  const [borrowHistoryFilter, setBorrowHistoryFilter] = useState<BorrowHistoryFilter>('all')
  const [borrowHistoryLoading, setBorrowHistoryLoading] = useState(false)
  const [borrowHistoryPagination, setBorrowHistoryPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  // --- Convert to Outbound Modal ---
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [convertClinics, setConvertClinics] = useState<{id:number,name:string,address:string,branchName:string|null}[]>([])
  const [convertWarehouses, setConvertWarehouses] = useState<{id:number,name:string}[]>([])
  const [convertShippingMethods, setConvertShippingMethods] = useState<{id:number,nameTh:string}[]>([])
  const [convertClinicId, setConvertClinicId] = useState(0)
  const [convertWarehouseId, setConvertWarehouseId] = useState(0)
  const [convertShippingMethodId, setConvertShippingMethodId] = useState(0)
  const [convertContractNo, setConvertContractNo] = useState('')
  const [convertSalesPersonName, setConvertSalesPersonName] = useState('')
  const [convertCompanyContact, setConvertCompanyContact] = useState('')
  const [convertClinicAddress, setConvertClinicAddress] = useState('')
  const [convertClinicPhone, setConvertClinicPhone] = useState('')
  const [convertClinicEmail, setConvertClinicEmail] = useState('')
  const [convertClinicContactName, setConvertClinicContactName] = useState('')
  const [convertRemarks, setConvertRemarks] = useState('')
  const [isConverting, setIsConverting] = useState(false)
  const [convertClinicSearch, setConvertClinicSearch] = useState('')

  // --- Claim Tab ---
  const [claimClinics, setClaimClinics] = useState<{ id: number; name: string; address: string }[]>([])
  const [claimProducts, setClaimProducts] = useState<{ id: number; sku: string; nameTh: string; modelSize: string | null }[]>([])
  const [claimClinicId, setClaimClinicId] = useState(0)
  const [claimProductId, setClaimProductId] = useState(0)
  const [claimQty, setClaimQty] = useState(1)
  const [claimReason, setClaimReason] = useState('')
  const [claimNote, setClaimNote] = useState('')
  const [claimFiles, setClaimFiles] = useState<File[]>([])
  const [claimSubmitting, setClaimSubmitting] = useState(false)
  const [claimList, setClaimList] = useState<Array<{
    id: number; claimNumber: string; quantity: number; reason: string; note: string | null; status: string
    createdAt: string; rejectReason: string | null
    clinic: { name: string; address: string }
    productMaster: { sku: string; nameTh: string; modelSize: string | null }
    createdBy: { displayName: string }
    attachments: Array<{ id: number; fileUrl: string; fileName: string }>
  }>>([])
  const [claimListLoading, setClaimListLoading] = useState(false)

  // Pre-gen replacement states
  const [showPreGenModal, setShowPreGenModal] = useState(false)
  const [preGenItems, setPreGenItems] = useState<{ id: number; serial12: string; batchNo: string | null }[]>([])
  const [selectedPreGenId, setSelectedPreGenId] = useState<number | null>(null)
  const [loadingPreGen, setLoadingPreGen] = useState(false)

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

  const handleRestore = async (action: 'restore' | 'scrap', replacementItemId?: number | null) => {
    if (!selectedItem) return

    setRestoring(true)
    try {
      const res = await fetch(`/api/warehouse/damaged/${selectedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, repairNote, ...(replacementItemId && { replacementItemId }) }),
      })

      const data = await res.json()
      if (data.success) {
        await alert({
          title: locale === 'th' ? 'สำเร็จ' : 'Success',
          message: locale === 'th' ? 'ส่งคำขออนุมัติแล้ว รอผู้จัดการอนุมัติ' : 'Request submitted for approval',
          variant: 'success',
          icon: 'success',
        })
        setShowRestoreModal(false)
        setShowPreGenModal(false)
        setSelectedItem(null)
        setRepairNote('')
        setSelectedPreGenId(null)
        setPreGenItems([])
        fetchItems()
        window.dispatchEvent(new Event('badges:refresh'))
      } else {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: data.message || 'Error', variant: 'error', icon: 'error' })
      }
    } catch (error) {
      console.error('Failed to restore product:', error)
    } finally {
      setRestoring(false)
    }
  }

  const openPreGenModal = async () => {
    if (!selectedItem?.productMaster) return
    setShowPreGenModal(true)
    setLoadingPreGen(true)
    setSelectedPreGenId(null)
    try {
      const res = await fetch(`/api/warehouse/pre-generate/available?productMasterId=${selectedItem.productMaster.id}&limit=100`)
      const data = await res.json()
      if (data.success) {
        setPreGenItems(data.data.items || [])
      }
    } catch (error) {
      console.error('Failed to fetch pre-gen items:', error)
    } finally {
      setLoadingPreGen(false)
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
        await alert({ title: locale === 'th' ? 'สำเร็จ' : 'Success', message: locale === 'th' ? 'รับคืนสินค้าสำเร็จ' : 'Product returned successfully', variant: 'success', icon: 'success' })
        setShowReturnModal(false)
        setSearchResult(null)
        setSearchSerial('')
        setReturnReason('')
        setReturnNotes('')
        fetchItems()
        window.dispatchEvent(new Event('badges:refresh'))
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
        await alert({ title: locale === 'th' ? 'สำเร็จ' : 'Success', message, variant: 'success', icon: 'success' })
        setShowLotReturnModal(false)
        setLotProducts([])
        setSelectedLotProducts([])
        setSearchLot('')
        setReturnReason('')
        setReturnNotes('')
        fetchItems()
        window.dispatchEvent(new Event('badges:refresh'))
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

  // Borrow tab functions
  const fetchBorrowHistory = async () => {
    setBorrowHistoryLoading(true)
    try {
      const params = new URLSearchParams({
        page: borrowHistoryPagination.page.toString(),
        limit: borrowHistoryPagination.limit.toString(),
        ...(borrowHistoryFilter !== 'all' && { status: borrowHistoryFilter }),
      })

      const res = await fetch(`/api/warehouse/borrow?${params}`)
      const data = await res.json()

      if (data.success && data.data) {
        setBorrowHistory(data.data.items || [])
        setBorrowHistoryPagination((prev) => ({
          ...prev,
          ...data.data.pagination,
        }))
      }
    } catch (error) {
      console.error('Failed to fetch borrow history:', error)
    } finally {
      setBorrowHistoryLoading(false)
    }
  }

  // Fetch products for borrow/return selection
  const fetchBorrowProducts = async () => {
    setBorrowProductsLoading(true)
    try {
      const statusParam = activeTab === 'borrow' ? 'IN_STOCK' : 'BORROWED'
      const params = new URLSearchParams({
        page: borrowProductsPagination.page.toString(),
        limit: borrowProductsPagination.limit.toString(),
        status: statusParam,
        ...(borrowProductsFilter && { search: borrowProductsFilter }),
      })

      const res = await fetch(`/api/warehouse/products?${params}`)
      const data = await res.json()

      if (data.success && data.data) {
        setBorrowProductsList(data.data.items || [])
        setBorrowProductsPagination((prev) => ({
          ...prev,
          total: data.data.pagination?.total || 0,
          totalPages: data.data.pagination?.totalPages || 0,
        }))
      }
    } catch (error) {
      console.error('Failed to fetch borrow products:', error)
    } finally {
      setBorrowProductsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'history') {
      fetchBorrowHistory()
    }
  }, [activeTab, borrowHistoryPagination.page, borrowHistoryFilter])

  useEffect(() => {
    if (activeTab === 'borrow' || activeTab === 'return_borrowed') {
      fetchBorrowProducts()
    }
  }, [activeTab, borrowProductsPagination.page, borrowProductsFilter])

  // --- Claim Tab Logic ---
  useEffect(() => {
    if (activeTab === 'claim') {
      fetchClaimData()
      fetchClaimList()
    }
  }, [activeTab])

  const fetchClaimData = async () => {
    try {
      const [clinicsRes, productsRes] = await Promise.all([
        fetch('/api/admin/clinics?limit=999'),
        fetch('/api/admin/masters/products?limit=999'),
      ])
      const clinicsData = await clinicsRes.json()
      const productsData = await productsRes.json()
      if (clinicsData.success) setClaimClinics(clinicsData.data?.clinics || [])
      if (productsData.success) setClaimProducts(productsData.data?.productMasters || [])
    } catch (e) { console.error('Failed to fetch claim data:', e) }
  }

  const fetchClaimList = async () => {
    setClaimListLoading(true)
    try {
      const res = await fetch('/api/warehouse/damaged-claim')
      const data = await res.json()
      if (data.success) setClaimList(data.data?.claims || [])
    } catch (e) { console.error('Failed to fetch claims:', e) }
    finally { setClaimListLoading(false) }
  }

  const handleClaimSubmit = async () => {
    if (!claimClinicId || !claimProductId || !claimReason || claimQty < 1) return
    setClaimSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('clinicId', claimClinicId.toString())
      formData.append('productMasterId', claimProductId.toString())
      formData.append('quantity', claimQty.toString())
      formData.append('reason', claimReason)
      if (claimNote) formData.append('note', claimNote)
      for (const file of claimFiles) formData.append('files', file)

      const res = await fetch('/api/warehouse/damaged-claim', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.success) {
        await alert({ title: locale === 'th' ? 'สำเร็จ' : 'Success', message: locale === 'th' ? 'ยื่นคำร้องเรียบร้อย' : 'Claim submitted', variant: 'success', icon: 'success' })
        setClaimClinicId(0); setClaimProductId(0); setClaimQty(1); setClaimReason(''); setClaimNote(''); setClaimFiles([])
        fetchClaimList()
        window.dispatchEvent(new Event('badges:refresh'))
      } else {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: data.message || 'Error', variant: 'error', icon: 'error' })
      }
    } catch { await alert({ title: 'Error', message: 'An error occurred', variant: 'error', icon: 'error' }) }
    finally { setClaimSubmitting(false) }
  }

  const toggleBorrowProductSelection = (productId: number) => {
    setSelectedBorrowProducts((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    )
  }

  const selectAllBorrowProducts = () => {
    const allIds = borrowProductsList.map((p) => p.id)
    const allSelected = allIds.every((id) => selectedBorrowProducts.includes(id))
    if (allSelected) {
      setSelectedBorrowProducts((prev) => prev.filter((id) => !allIds.includes(id)))
    } else {
      setSelectedBorrowProducts((prev) => [...new Set([...prev, ...allIds])])
    }
  }

  const clearBorrowForm = () => {
    setSelectedBorrowProducts([])
    setBorrowerName('')
    setBorrowClinicName('')
    setBorrowClinicAddress('')
    setBorrowTaxInvoice('')
    setBorrowReason('')
    setBorrowRemarks('')
    setBorrowContactName('')
    setBorrowContactPhone('')
    setBorrowProductsFilter('')
    setBorrowProductsPagination((prev) => ({ ...prev, page: 1 }))
  }

  const handleBorrowSubmit = async () => {
    if (selectedBorrowProducts.length === 0) {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ' : 'Please select at least 1 product', variant: 'warning', icon: 'warning' })
      return
    }

    if (!borrowerName.trim()) {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'กรุณากรอกชื่อผู้ยืม/คืนสินค้า' : 'Please enter borrower name', variant: 'warning', icon: 'warning' })
      return
    }

    setIsBorrowSubmitting(true)
    try {
      const res = await fetch('/api/warehouse/borrow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: activeTab === 'borrow' ? 'BORROW' : 'RETURN',
          borrowerName: borrowerName.trim(),
          clinicName: borrowClinicName.trim() || undefined,
          clinicAddress: borrowClinicAddress.trim() || undefined,
          contactName: borrowContactName.trim() || undefined,
          contactPhone: borrowContactPhone.trim() || undefined,
          taxInvoiceRef: borrowTaxInvoice.trim() || undefined,
          reason: borrowReason.trim() || undefined,
          remarks: borrowRemarks.trim() || undefined,
          productItemIds: selectedBorrowProducts,
        }),
      })

      const data = await res.json()

      if (data.success) {
        const message =
          activeTab === 'borrow'
            ? locale === 'th'
              ? `สร้างคำขอยืมสินค้าสำเร็จ (${data.data.transactionNo}) รออนุมัติ`
              : `Borrow request created (${data.data.transactionNo}) - pending approval`
            : locale === 'th'
              ? `คืนสินค้าเข้าคลังสำเร็จ (${data.data.transactionNo})`
              : `Products returned to stock (${data.data.transactionNo})`
        await alert({ title: locale === 'th' ? 'สำเร็จ' : 'Success', message, variant: 'success', icon: 'success' })
        clearBorrowForm()
        fetchBorrowHistory()
        window.dispatchEvent(new Event('badges:refresh'))
      } else {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: data.error || (locale === 'th' ? 'เกิดข้อผิดพลาด' : 'An error occurred'), variant: 'error', icon: 'error' })
      }
    } catch (error) {
      console.error('Borrow submit error:', error)
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'เกิดข้อผิดพลาดในการดำเนินการ' : 'Operation failed', variant: 'error', icon: 'error' })
    } finally {
      setIsBorrowSubmitting(false)
    }
  }

  const openConvertModal = async () => {
    try {
      const [clinicsRes, warehousesRes, shippingRes] = await Promise.all([
        fetch('/api/admin/clinics'),
        fetch('/api/admin/masters/warehouses'),
        fetch('/api/admin/masters/shipping-methods'),
      ])

      const [clinicsData, warehousesData, shippingData] = await Promise.all([
        clinicsRes.json(),
        warehousesRes.json(),
        shippingRes.json(),
      ])

      const clinics = clinicsData.success ? (clinicsData.data?.clinics || clinicsData.data || []) : []
      const warehouses = warehousesData.success ? (warehousesData.data?.warehouses || warehousesData.data || []) : []
      const shippingMethods = shippingData.success ? (shippingData.data?.shippingMethods || shippingData.data || []) : []

      setConvertClinics(clinics)
      setConvertWarehouses(warehouses)
      setConvertShippingMethods(shippingMethods)
      setConvertClinicId(0)
      setConvertWarehouseId(warehouses.length > 0 ? warehouses[0].id : 0)
      setConvertShippingMethodId(shippingMethods.length > 0 ? shippingMethods[0].id : 0)
      setConvertContractNo('')
      setConvertSalesPersonName('')
      setConvertCompanyContact('')
      setConvertClinicAddress('')
      setConvertClinicPhone('')
      setConvertClinicEmail('')
      setConvertClinicContactName('')
      setConvertRemarks('')
      setConvertClinicSearch('')
      setShowConvertModal(true)
    } catch (error) {
      console.error('Failed to load master data:', error)
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'ไม่สามารถโหลดข้อมูลได้' : 'Failed to load data', variant: 'error', icon: 'error' })
    }
  }

  const handleConvertSubmit = async () => {
    if (selectedBorrowProducts.length === 0) {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ' : 'Please select at least 1 product', variant: 'warning', icon: 'warning' })
      return
    }
    if (!convertClinicSearch.trim()) {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'กรุณากรอกชื่อคลินิก/ชื่อคนซื้อ' : 'Please enter clinic or buyer name', variant: 'warning', icon: 'warning' })
      return
    }
    if (!convertWarehouseId) {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'กรุณาเลือกคลังสินค้า' : 'Please select a warehouse', variant: 'warning', icon: 'warning' })
      return
    }
    if (!convertShippingMethodId) {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'กรุณาเลือกวิธีจัดส่ง' : 'Please select a shipping method', variant: 'warning', icon: 'warning' })
      return
    }

    setIsConverting(true)
    try {
      const res = await fetch('/api/warehouse/borrow/convert-to-outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productItemIds: selectedBorrowProducts,
          clinicId: convertClinicId || undefined,
          clinicName: convertClinicSearch.trim(),
          warehouseId: convertWarehouseId,
          shippingMethodId: convertShippingMethodId,
          contractNo: convertContractNo.trim() || undefined,
          salesPersonName: convertSalesPersonName.trim() || undefined,
          companyContact: convertCompanyContact.trim() || undefined,
          clinicAddress: convertClinicAddress.trim() || undefined,
          clinicPhone: convertClinicPhone.trim() || undefined,
          clinicEmail: convertClinicEmail.trim() || undefined,
          clinicContactName: convertClinicContactName.trim() || convertClinicSearch.trim() || undefined,
          remarks: convertRemarks.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (data.success) {
        const msg = locale === 'th'
          ? `สร้าง PO (${data.data.poNo}) และใบส่งสินค้า (${data.data.outboundNo}) สำเร็จ\nจำนวน ${data.data.itemCount} รายการ`
          : `Created PO (${data.data.poNo}) and Outbound (${data.data.outboundNo})\n${data.data.itemCount} items`
        await alert({ title: locale === 'th' ? 'สำเร็จ' : 'Success', message: msg, variant: 'success', icon: 'success' })
        setShowConvertModal(false)
        clearBorrowForm()
        fetchBorrowProducts()
      } else {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: data.error || (locale === 'th' ? 'เกิดข้อผิดพลาด' : 'An error occurred'), variant: 'error', icon: 'error' })
      }
    } catch (error) {
      console.error('Convert error:', error)
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'เกิดข้อผิดพลาดในการดำเนินการ' : 'Operation failed', variant: 'error', icon: 'error' })
    } finally {
      setIsConverting(false)
    }
  }

  const openBorrowDocument = (transactionId: number) => {
    window.open(`/${locale}/dashboard/borrow/${transactionId}/document`, '_blank')
  }

  const getBorrowStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; dot: string; label: string; labelEn: string }> = {
      PENDING: { bg: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: 'รออนุมัติ', labelEn: 'Pending' },
      APPROVED: { bg: 'bg-green-100 text-green-700', dot: 'bg-green-500', label: 'อนุมัติแล้ว', labelEn: 'Approved' },
      REJECTED: { bg: 'bg-red-100 text-red-700', dot: 'bg-red-500', label: 'ปฏิเสธ', labelEn: 'Rejected' },
      RETURNED: { bg: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', label: 'คืนแล้ว', labelEn: 'Returned' },
    }
    const badge = badges[status] || { bg: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400', label: status, labelEn: status }
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
        {locale === 'th' ? badge.label : badge.labelEn}
      </span>
    )
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; dot: string; label: string; labelEn: string }> = {
      IN_STOCK: { bg: 'bg-green-100 text-green-700', dot: 'bg-green-500', label: 'ในคลัง', labelEn: 'In Stock' },
      PENDING_OUT: { bg: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: 'รอส่งออก', labelEn: 'Pending' },
      SHIPPED: { bg: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', label: 'ส่งออกแล้ว', labelEn: 'Shipped' },
      ACTIVATED: { bg: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500', label: 'เปิดใช้แล้ว', labelEn: 'Activated' },
      RETURNED: { bg: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', label: 'รับคืนสินค้า', labelEn: 'Returned' },
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

  // --- Tab definitions ---
  const tabs: { key: ActiveTab; labelTh: string; labelEn: string }[] = [
    { key: 'damaged', labelTh: 'สินค้าเสียหาย', labelEn: 'Damaged Products' },
    { key: 'return', labelTh: 'รับคืนสินค้าเสียหาย', labelEn: 'Return Products' },
    { key: 'claim', labelTh: 'ยื่นคำร้อง', labelEn: 'Submit Claim' },
    { key: 'borrow', labelTh: 'ยืมสินค้า', labelEn: 'Borrow' },
    { key: 'return_borrowed', labelTh: 'คืนสินค้ายืม', labelEn: 'Return Borrowed' },
    { key: 'history', labelTh: 'ประวัติ', labelEn: 'History' },
  ]

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-charcoal)]">
          {locale === 'th' ? 'สินค้าเสียหาย / รับคืนสินค้า' : 'Damaged / Returned Products'}
        </h1>
        <p className="text-[var(--color-foreground-muted)] mt-1">
          {locale === 'th'
            ? 'จัดการสินค้าที่เสียหายหรือถูกคืน รอซ่อมแซมหรือตรวจสอบ'
            : 'Manage damaged or returned products awaiting repair or inspection'}
        </p>
      </div>

      {/* 5 Top-Level Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === tab.key
                ? 'bg-[var(--color-gold)] text-white shadow-sm'
                : 'bg-[var(--color-off-white)] text-[var(--color-foreground-muted)] hover:bg-[var(--color-beige)] hover:text-[var(--color-charcoal)]'
            }`}
          >
            {locale === 'th' ? tab.labelTh : tab.labelEn}
          </button>
        ))}
      </div>

      {/* ==================== DAMAGED TAB ==================== */}
      {activeTab === 'damaged' && (
        <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
          {/* Search and Filter */}
          <div className="p-4 sm:p-5 border-b border-[var(--color-beige)]">
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
                        : 'bg-[var(--color-off-white)] text-[var(--color-charcoal)] hover:bg-[var(--color-beige)]'
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
                    {locale === 'th' ? 'รับคืนสินค้า' : 'Returned'}
                  </button>
                </div>

                {/* Search Input */}
                <div className="flex-1 relative">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder={locale === 'th' ? 'ค้นหา Serial, SKU, ชื่อสินค้า...' : 'Search Serial, SKU, Product name...'}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPagination((p) => ({ ...p, page: 1 }))
                    }}
                    className="w-full pl-12 pr-4 py-3 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                  <tr>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">Serial</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'สินค้า' : 'Product'}</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'สถานะ' : 'Status'}</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'สาเหตุ' : 'Reason'}</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'หมายเหตุ' : 'Note'}</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'วันที่' : 'Date'}</th>
                    <th className="px-5 py-4 text-right text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'จัดการ' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-beige)]">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center">
                        <div className="relative w-10 h-10 mx-auto mb-3">
                          <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
                          <div className="absolute inset-0 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin" />
                        </div>
                        <p className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'กำลังโหลด...' : 'Loading...'}</p>
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-beige)]/50 flex items-center justify-center">
                          <svg className="w-8 h-8 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                        </div>
                        <p className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ไม่พบสินค้า' : 'No products found'}</p>
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="hover:bg-[var(--color-off-white)]/50 transition-colors">
                        <td className="px-5 py-4">
                          <span className="font-mono text-sm">{item.serial12}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div>
                            <p className="font-medium">{item.productMaster?.sku || item.sku || '-'}</p>
                            <p className="text-sm text-[var(--color-foreground-muted)]">
                              {item.productMaster
                                ? (locale === 'th' ? item.productMaster.nameTh : item.productMaster.nameEn || item.productMaster.nameTh)
                                : item.name || '-'}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-4">{getStatusBadge(item.status)}</td>
                        <td className="px-5 py-4">
                          <p className="text-sm text-red-600">{item.damageNote?.reason || '-'}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm text-[var(--color-foreground-muted)]">{item.damageNote?.note || '-'}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">
                          {formatDate(item.damagedAt)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {item.pendingRequest ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-lg">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              {locale === 'th' ? 'รออนุมัติ' : 'Pending'}
                              ({locale === 'th'
                                ? (item.pendingRequest.actionType === 'RESTORE' ? 'คืนคลัง' : 'ทิ้ง')
                                : item.pendingRequest.actionType.toLowerCase()})
                            </span>
                          ) : (
                            <button
                              onClick={() => openRestoreModal(item)}
                              className="px-3 py-1.5 text-sm bg-[var(--color-mint)] text-white rounded-lg hover:bg-[var(--color-mint-dark)] transition-colors"
                            >
                              {locale === 'th' ? 'จัดการ' : 'Manage'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-4 sm:px-5 py-4 border-t border-[var(--color-beige)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--color-off-white)]">
                <p className="text-sm text-[var(--color-foreground-muted)]">
                  {locale === 'th'
                    ? `แสดง ${items.length} จาก ${pagination.total} รายการ`
                    : `Showing ${items.length} of ${pagination.total} items`}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-[var(--color-charcoal)] border border-[var(--color-beige)] rounded-lg hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-50 disabled:hover:border-[var(--color-beige)] disabled:hover:text-[var(--color-charcoal)] transition-all"
                  >
                    {locale === 'th' ? 'ก่อนหน้า' : 'Previous'}
                  </button>
                  <button
                    onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-[var(--color-charcoal)] border border-[var(--color-beige)] rounded-lg hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-50 disabled:hover:border-[var(--color-beige)] disabled:hover:text-[var(--color-charcoal)] transition-all"
                  >
                    {locale === 'th' ? 'ถัดไป' : 'Next'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      {/* ==================== RETURN TAB ==================== */}
      {activeTab === 'return' && (
        <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-4 sm:p-6">
              <div className="space-y-6">
                {/* Return Mode Selection */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Individual Return Card */}
                  <button
                    onClick={() => {
                      setReturnMode('individual')
                      setLotProducts([])
                      setSelectedLotProducts([])
                      setSearchLot('')
                      setLotError('')
                    }}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      returnMode === 'individual'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-[var(--color-beige)] bg-white hover:border-orange-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        returnMode === 'individual' ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-500'
                      }`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <div>
                        <h4 className={`font-medium ${returnMode === 'individual' ? 'text-orange-700' : 'text-[var(--color-charcoal)]'}`}>
                          {locale === 'th' ? 'รับคืนรายชิ้น' : 'Individual Return'}
                        </h4>
                        <p className="text-xs text-[var(--color-foreground-muted)]">
                          {locale === 'th' ? 'ค้นหาด้วย Serial' : 'Search by Serial'}
                        </p>
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
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      returnMode === 'lot'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-[var(--color-beige)] bg-white hover:border-orange-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        returnMode === 'lot' ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-500'
                      }`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <div>
                        <h4 className={`font-medium ${returnMode === 'lot' ? 'text-orange-700' : 'text-[var(--color-charcoal)]'}`}>
                          {locale === 'th' ? 'รับคืนทั้ง Lot' : 'Lot Return'}
                        </h4>
                        <p className="text-xs text-[var(--color-foreground-muted)]">
                          {locale === 'th' ? 'ค้นหาด้วยหมายเลข Lot' : 'Search by Lot number'}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Individual Return Mode Content */}
                {returnMode === 'individual' && (
                  <div className="bg-[var(--color-off-white)] rounded-2xl p-5">
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
                          className="w-full px-4 py-3 bg-white border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
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
                      <div className="mt-5 p-5 bg-white border border-[var(--color-beige)] rounded-xl shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <h3 className="font-semibold text-green-700">{locale === 'th' ? 'พบสินค้า' : 'Product Found'}</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          <div className="bg-[var(--color-off-white)] p-3 rounded-lg">
                            <span className="text-[var(--color-foreground-muted)] text-xs uppercase tracking-wide">Serial</span>
                            <p className="font-mono font-semibold text-[var(--color-gold)] mt-1">{searchResult.serial12}</p>
                          </div>
                          <div className="bg-[var(--color-off-white)] p-3 rounded-lg">
                            <span className="text-[var(--color-foreground-muted)] text-xs uppercase tracking-wide">{locale === 'th' ? 'สถานะ' : 'Status'}</span>
                            <div className="mt-1">{getStatusBadge(searchResult.status)}</div>
                          </div>
                          <div className="col-span-full bg-[var(--color-off-white)] p-3 rounded-lg">
                            <span className="text-[var(--color-foreground-muted)] text-xs uppercase tracking-wide">{locale === 'th' ? 'ชื่อสินค้า' : 'Product Name'}</span>
                            <p className="font-medium mt-1">{searchResult.name}</p>
                          </div>
                          {searchResult.assignedClinic && (
                            <div className="col-span-full bg-[var(--color-off-white)] p-3 rounded-lg">
                              <span className="text-[var(--color-foreground-muted)] text-xs uppercase tracking-wide">{locale === 'th' ? 'คลินิก' : 'Clinic'}</span>
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

                {/* Lot Return Mode Content */}
                {returnMode === 'lot' && (
                  <div className="bg-[var(--color-off-white)] rounded-2xl p-5">
                    <h3 className="font-semibold text-[var(--color-charcoal)] mb-2 flex items-center gap-2">
                      <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {locale === 'th' ? 'ค้นหาสินค้าด้วยหมายเลข Lot' : 'Search Products by Lot Number'}
                    </h3>
                    <p className="text-sm text-[var(--color-foreground-muted)] mb-4">
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
                          className="w-full px-4 py-3 bg-white border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
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
                      <div className="mt-5 bg-white border border-[var(--color-beige)] rounded-xl shadow-sm overflow-hidden">
                        {/* Header */}
                        <div className="p-4 border-b border-[var(--color-beige)] bg-gradient-to-r from-orange-50 to-white">
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
                        <div className="p-3 border-b border-[var(--color-beige)] bg-[var(--color-off-white)]">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedLotProducts.length === lotProducts.length && lotProducts.length > 0}
                              onChange={toggleAllLotProducts}
                              className="w-5 h-5 rounded border-[var(--color-beige)] text-orange-500 focus:ring-orange-200"
                            />
                            <span className="text-sm font-medium">{locale === 'th' ? 'เลือกทั้งหมด' : 'Select All'}</span>
                          </label>
                        </div>

                        {/* Product List */}
                        <div className="max-h-72 overflow-y-auto divide-y divide-[var(--color-beige)]">
                          {lotProducts.map((product) => (
                            <label
                              key={product.id}
                              className={`flex items-start gap-3 p-4 cursor-pointer transition-colors ${
                                selectedLotProducts.includes(product.id)
                                  ? 'bg-orange-50 hover:bg-orange-100'
                                  : 'hover:bg-[var(--color-off-white)]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedLotProducts.includes(product.id)}
                                onChange={() => toggleLotProductSelection(product.id)}
                                className="w-5 h-5 mt-0.5 rounded border-[var(--color-beige)] text-orange-500 focus:ring-orange-200"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-sm font-semibold text-[var(--color-gold)]">{product.serial12}</span>
                                  {getStatusBadge(product.status)}
                                </div>
                                <p className="text-sm text-[var(--color-charcoal)] mt-1 truncate">{product.name}</p>
                                {product.assignedClinic && (
                                  <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">{product.assignedClinic.name}</p>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-[var(--color-beige)] bg-[var(--color-off-white)]">
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
        </div>
      )}

      {/* ==================== CLAIM TAB ==================== */}
      {activeTab === 'claim' && (
        <div className="space-y-6">
          {/* Claim Form */}
          <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
            <div className="p-4 border-b border-[var(--color-beige)] bg-orange-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'ยื่นคำร้องเคลมสินค้าเสียหาย' : 'Submit Damaged Product Claim'}
                  </h3>
                  <p className="text-sm text-[var(--color-foreground-muted)]">
                    {locale === 'th' ? 'สำหรับกรณีที่ไม่มี Serial Number' : 'For cases without Serial Number'}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Clinic */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1">
                    {locale === 'th' ? 'คลินิก *' : 'Clinic *'}
                  </label>
                  <select
                    value={claimClinicId}
                    onChange={(e) => setClaimClinicId(parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-beige)] bg-white text-sm focus:border-[var(--color-gold)] focus:ring-2 focus:ring-[var(--color-gold)]/20 outline-none"
                  >
                    <option value={0}>{locale === 'th' ? '-- เลือกคลินิก --' : '-- Select clinic --'}</option>
                    {claimClinics.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.address})</option>
                    ))}
                  </select>
                </div>
                {/* Product */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1">
                    {locale === 'th' ? 'สินค้า *' : 'Product *'}
                  </label>
                  <select
                    value={claimProductId}
                    onChange={(e) => setClaimProductId(parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-beige)] bg-white text-sm focus:border-[var(--color-gold)] focus:ring-2 focus:ring-[var(--color-gold)]/20 outline-none"
                  >
                    <option value={0}>{locale === 'th' ? '-- เลือกสินค้า --' : '-- Select product --'}</option>
                    {claimProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.sku} - {p.nameTh}{p.modelSize ? ` (${p.modelSize})` : ''}</option>
                    ))}
                  </select>
                </div>
                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1">
                    {locale === 'th' ? 'จำนวน *' : 'Quantity *'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={claimQty}
                    onChange={(e) => setClaimQty(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-beige)] bg-white text-sm focus:border-[var(--color-gold)] focus:ring-2 focus:ring-[var(--color-gold)]/20 outline-none"
                  />
                </div>
                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1">
                    {locale === 'th' ? 'สาเหตุ *' : 'Reason *'}
                  </label>
                  <select
                    value={claimReason}
                    onChange={(e) => setClaimReason(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-beige)] bg-white text-sm focus:border-[var(--color-gold)] focus:ring-2 focus:ring-[var(--color-gold)]/20 outline-none"
                  >
                    <option value="">{locale === 'th' ? '-- เลือกสาเหตุ --' : '-- Select reason --'}</option>
                    <option value="ชำรุดจากการขนส่ง">{locale === 'th' ? 'ชำรุดจากการขนส่ง' : 'Damaged during shipping'}</option>
                    <option value="สินค้ามีตำหนิ">{locale === 'th' ? 'สินค้ามีตำหนิ' : 'Product defect'}</option>
                    <option value="บรรจุภัณฑ์เสียหาย">{locale === 'th' ? 'บรรจุภัณฑ์เสียหาย' : 'Packaging damaged'}</option>
                    <option value="สินค้าหมดอายุ">{locale === 'th' ? 'สินค้าหมดอายุ' : 'Product expired'}</option>
                    <option value="ลูกค้าแจ้งเคลม">{locale === 'th' ? 'ลูกค้าแจ้งเคลม' : 'Customer claim'}</option>
                    <option value="อื่นๆ">{locale === 'th' ? 'อื่นๆ' : 'Other'}</option>
                  </select>
                </div>
              </div>
              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1">
                  {locale === 'th' ? 'หมายเหตุ' : 'Notes'}
                </label>
                <textarea
                  value={claimNote}
                  onChange={(e) => setClaimNote(e.target.value)}
                  rows={2}
                  placeholder={locale === 'th' ? 'รายละเอียดเพิ่มเติม...' : 'Additional details...'}
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-beige)] bg-white text-sm focus:border-[var(--color-gold)] focus:ring-2 focus:ring-[var(--color-gold)]/20 outline-none resize-none"
                />
              </div>
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1">
                  {locale === 'th' ? 'แนบหลักฐาน (รูปภาพ/เอกสาร)' : 'Attach Evidence (Images/Documents)'}
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  multiple
                  onChange={(e) => setClaimFiles(Array.from(e.target.files || []))}
                  className="w-full text-sm text-[var(--color-foreground-muted)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[var(--color-gold)]/10 file:text-[var(--color-gold)] hover:file:bg-[var(--color-gold)]/20"
                />
                <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
                  {locale === 'th' ? 'รองรับ: JPG, PNG, WEBP, PDF, DOC, DOCX, XLS, XLSX, CSV, TXT (สูงสุด 10MB/ไฟล์)' : 'Supported: JPG, PNG, WEBP, PDF, DOC, DOCX, XLS, XLSX, CSV, TXT (max 10MB/file)'}
                </p>
                {claimFiles.length > 0 && (
                  <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
                    {claimFiles.length} {locale === 'th' ? 'ไฟล์' : 'files'} ({claimFiles.map(f => f.name).join(', ')})
                  </p>
                )}
              </div>
              {/* Submit */}
              <div className="flex justify-end">
                <button
                  onClick={handleClaimSubmit}
                  disabled={!claimClinicId || !claimProductId || !claimReason || claimQty < 1 || claimSubmitting}
                  className="px-6 py-2.5 bg-orange-500 text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(249,115,22,0.25)] hover:bg-orange-600 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-200"
                >
                  {claimSubmitting ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {locale === 'th' ? 'กำลังส่ง...' : 'Submitting...'}
                    </span>
                  ) : (locale === 'th' ? 'ยื่นคำร้อง' : 'Submit Claim')}
                </button>
              </div>
            </div>
          </div>

          {/* Claim List */}
          <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
            <div className="p-4 border-b border-[var(--color-beige)]">
              <h3 className="font-semibold text-[var(--color-charcoal)]">
                {locale === 'th' ? 'รายการคำร้อง' : 'Claim History'} ({claimList.length})
              </h3>
            </div>
            {claimListLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : claimList.length === 0 ? (
              <div className="text-center py-8 text-[var(--color-foreground-muted)]">
                {locale === 'th' ? 'ยังไม่มีคำร้อง' : 'No claims yet'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'เลขที่' : 'Claim No.'}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'คลินิก' : 'Clinic'}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'สินค้า' : 'Product'}</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'จำนวน' : 'Qty'}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'สาเหตุ' : 'Reason'}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'สถานะ' : 'Status'}</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'วันที่' : 'Date'}</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'หลักฐาน' : 'Evidence'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-beige)]">
                    {claimList.map(claim => (
                      <tr key={claim.id} className="hover:bg-[var(--color-off-white)]/50">
                        <td className="px-4 py-3 text-sm font-mono font-medium text-[var(--color-charcoal)]">{claim.claimNumber}</td>
                        <td className="px-4 py-3 text-sm">{claim.clinic.name}</td>
                        <td className="px-4 py-3 text-sm">
                          <div>{claim.productMaster.nameTh}</div>
                          <div className="text-xs text-[var(--color-foreground-muted)]">{claim.productMaster.sku}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-center font-medium">{claim.quantity}</td>
                        <td className="px-4 py-3 text-sm">{claim.reason}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                            claim.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                            claim.status === 'APPROVED' ? 'bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]' :
                            'bg-red-100 text-red-700'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              claim.status === 'PENDING' ? 'bg-amber-500' :
                              claim.status === 'APPROVED' ? 'bg-[var(--color-mint)]' :
                              'bg-red-500'
                            }`} />
                            {claim.status === 'PENDING' ? (locale === 'th' ? 'รออนุมัติ' : 'Pending') :
                             claim.status === 'APPROVED' ? (locale === 'th' ? 'อนุมัติ' : 'Approved') :
                             (locale === 'th' ? 'ปฏิเสธ' : 'Rejected')}
                          </span>
                          {claim.status === 'REJECTED' && claim.rejectReason && (
                            <div className="text-xs text-red-500 mt-1">{claim.rejectReason}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--color-foreground-muted)]">
                          {new Date(claim.createdAt).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {claim.attachments.length > 0 ? (
                            <div className="flex gap-1 justify-center">
                              {claim.attachments.map(att => (
                                <a key={att.id} href={att.fileUrl} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors"
                                  title={att.fileName}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </a>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--color-foreground-muted)]">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== BORROW TAB ==================== */}
      {/* ==================== RETURN BORROWED TAB ==================== */}
      {(activeTab === 'borrow' || activeTab === 'return_borrowed') && (
              <div className="space-y-6">
                {/* Products Selection Section */}
                <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
                  {/* Header with search and selection info */}
                  <div className={`p-4 border-b border-[var(--color-beige)] ${activeTab === 'borrow' ? 'bg-purple-50' : 'bg-green-50'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-[var(--color-charcoal)] flex items-center gap-2">
                          <svg className={`w-5 h-5 ${activeTab === 'borrow' ? 'text-purple-500' : 'text-green-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          {locale === 'th'
                            ? activeTab === 'borrow'
                              ? 'เลือกสินค้าในคลัง (IN_STOCK)'
                              : 'เลือกสินค้าที่ยืม (BORROWED)'
                            : activeTab === 'borrow'
                              ? 'Select products in stock (IN_STOCK)'
                              : 'Select borrowed products (BORROWED)'}
                        </h3>
                        <p className="text-sm text-[var(--color-foreground-muted)] mt-1">
                          {locale === 'th' ? `ทั้งหมด ${borrowProductsPagination.total} รายการ` : `Total ${borrowProductsPagination.total} items`}
                        </p>
                      </div>
                      <div className={`px-4 py-2 rounded-lg font-medium ${
                        activeTab === 'borrow' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {locale === 'th' ? `เลือกแล้ว ${selectedBorrowProducts.length} รายการ` : `${selectedBorrowProducts.length} selected`}
                      </div>
                    </div>

                    {/* Search Filter */}
                    <div className="mt-4 flex gap-2">
                      <div className="flex-1 relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          value={borrowProductsFilter}
                          onChange={(e) => {
                            setBorrowProductsFilter(e.target.value)
                            setBorrowProductsPagination((prev) => ({ ...prev, page: 1 }))
                          }}
                          placeholder={locale === 'th' ? 'ค้นหา Serial, SKU, ชื่อสินค้า...' : 'Search Serial, SKU, Product name...'}
                          className="w-full pl-10 pr-4 py-2 bg-white bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all duration-200"
                        />
                      </div>
                      <button
                        onClick={selectAllBorrowProducts}
                        className="px-4 py-2 border border-[var(--color-beige)] rounded-lg hover:bg-[var(--color-off-white)] transition-colors text-sm whitespace-nowrap"
                      >
                        {borrowProductsList.every((p) => selectedBorrowProducts.includes(p.id))
                          ? locale === 'th' ? 'ยกเลิกทั้งหมด' : 'Deselect All'
                          : locale === 'th' ? 'เลือกทั้งหมด' : 'Select All'}
                      </button>
                    </div>
                  </div>

                  {/* Products List */}
                  <div className="max-h-80 overflow-y-auto">
                    {borrowProductsLoading ? (
                      <div className="p-8 text-center text-[var(--color-foreground-muted)]">
                        <svg className="animate-spin w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {locale === 'th' ? 'กำลังโหลด...' : 'Loading...'}
                      </div>
                    ) : borrowProductsList.length === 0 ? (
                      <div className="p-8 text-center text-[var(--color-foreground-muted)]">
                        <svg className="w-12 h-12 mx-auto mb-2 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        {locale === 'th' ? 'ไม่พบสินค้า' : 'No products found'}
                      </div>
                    ) : (
                      <div className="divide-y divide-[var(--color-beige)]">
                        {borrowProductsList.map((product) => (
                          <label
                            key={product.id}
                            className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-[var(--color-off-white)] transition-colors ${
                              selectedBorrowProducts.includes(product.id)
                                ? activeTab === 'borrow' ? 'bg-purple-50' : 'bg-green-50'
                                : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedBorrowProducts.includes(product.id)}
                              onChange={() => toggleBorrowProductSelection(product.id)}
                              className={`w-5 h-5 rounded ${
                                activeTab === 'borrow' ? 'text-purple-500 focus:ring-purple-200' : 'text-green-500 focus:ring-green-200'
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-sm font-semibold text-[var(--color-gold)]">{product.serial12}</span>
                                <span className="text-xs text-[var(--color-foreground-muted)]">{product.sku}</span>
                              </div>
                              <p className="text-sm text-[var(--color-charcoal)] truncate">{product.name}</p>
                              <div className="flex items-center gap-3 text-xs text-[var(--color-foreground-muted)] mt-1">
                                {product.lot && <span>Lot: {product.lot}</span>}
                                {product.modelSize && <span>Size: {product.modelSize}</span>}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pagination */}
                  {borrowProductsPagination.totalPages > 1 && (
                    <div className="p-3 border-t border-[var(--color-beige)] bg-[var(--color-off-white)] flex items-center justify-between">
                      <p className="text-sm text-[var(--color-foreground-muted)]">
                        {locale === 'th'
                          ? `หน้า ${borrowProductsPagination.page} / ${borrowProductsPagination.totalPages}`
                          : `Page ${borrowProductsPagination.page} / ${borrowProductsPagination.totalPages}`}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setBorrowProductsPagination((p) => ({ ...p, page: p.page - 1 }))}
                          disabled={borrowProductsPagination.page === 1}
                          className="px-3 py-1.5 text-sm border border-[var(--color-beige)] rounded-lg disabled:opacity-50 hover:bg-white"
                        >
                          {locale === 'th' ? 'ก่อนหน้า' : 'Previous'}
                        </button>
                        <button
                          onClick={() => setBorrowProductsPagination((p) => ({ ...p, page: p.page + 1 }))}
                          disabled={borrowProductsPagination.page >= borrowProductsPagination.totalPages}
                          className="px-3 py-1.5 text-sm border border-[var(--color-beige)] rounded-lg disabled:opacity-50 hover:bg-white"
                        >
                          {locale === 'th' ? 'ถัดไป' : 'Next'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Fields */}
                <div className="bg-[var(--color-off-white)] rounded-2xl p-5 space-y-4">
                  <h3 className="font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'ข้อมูลการยืม/คืน' : 'Borrow/Return Information'}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {locale === 'th' ? 'ชื่อผู้ยืม/คืนสินค้า' : 'Borrower Name'} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={borrowerName}
                        onChange={(e) => setBorrowerName(e.target.value)}
                        className="w-full px-4 py-2 bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all duration-200"
                        placeholder={locale === 'th' ? 'กรอกชื่อ' : 'Enter name'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {locale === 'th' ? 'ชื่อคลินิก/ชื่อคนซื้อ' : 'Clinic / Buyer Name'}
                      </label>
                      <input
                        type="text"
                        value={borrowClinicName}
                        onChange={(e) => setBorrowClinicName(e.target.value)}
                        className="w-full px-4 py-2 bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all duration-200"
                        placeholder={locale === 'th' ? 'กรอกชื่อคลินิก/ชื่อคนซื้อ' : 'Enter clinic or buyer name'}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">
                        {locale === 'th' ? 'ที่อยู่' : 'Address'}
                      </label>
                      <input
                        type="text"
                        value={borrowClinicAddress}
                        onChange={(e) => setBorrowClinicAddress(e.target.value)}
                        className="w-full px-4 py-2 bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all duration-200"
                        placeholder={locale === 'th' ? 'กรอกที่อยู่' : 'Enter address'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {locale === 'th' ? 'ชื่อผู้ติดต่อ' : 'Contact Name'}
                      </label>
                      <input
                        type="text"
                        value={borrowContactName}
                        onChange={(e) => setBorrowContactName(e.target.value)}
                        className="w-full px-4 py-2 bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all duration-200"
                        placeholder={locale === 'th' ? 'ชื่อผู้ติดต่อ' : 'Contact name'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {locale === 'th' ? 'เบอร์โทรศัพท์' : 'Phone'}
                      </label>
                      <input
                        type="text"
                        value={borrowContactPhone}
                        onChange={(e) => setBorrowContactPhone(e.target.value)}
                        className="w-full px-4 py-2 bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all duration-200"
                        placeholder={locale === 'th' ? 'เบอร์โทรศัพท์' : 'Phone number'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {locale === 'th' ? 'เลขที่ใบกำกับภาษี' : 'Tax Invoice Ref'}
                      </label>
                      <input
                        type="text"
                        value={borrowTaxInvoice}
                        onChange={(e) => setBorrowTaxInvoice(e.target.value)}
                        className="w-full px-4 py-2 bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all duration-200"
                        placeholder={locale === 'th' ? 'กรอกเลขที่' : 'Enter reference'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {locale === 'th' ? 'สาเหตุการยืม/คืน' : 'Reason'}
                      </label>
                      <input
                        type="text"
                        value={borrowReason}
                        onChange={(e) => setBorrowReason(e.target.value)}
                        className="w-full px-4 py-2 bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all duration-200"
                        placeholder={locale === 'th' ? 'กรอกสาเหตุ' : 'Enter reason'}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">
                        {locale === 'th' ? 'หมายเหตุ' : 'Remarks'}
                      </label>
                      <textarea
                        value={borrowRemarks}
                        onChange={(e) => setBorrowRemarks(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-2 bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all duration-200"
                        placeholder={locale === 'th' ? 'หมายเหตุเพิ่มเติม' : 'Additional remarks'}
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={clearBorrowForm}
                    className="px-6 py-3 border border-[var(--color-beige)] rounded-lg font-medium hover:bg-[var(--color-off-white)] transition-colors"
                  >
                    {locale === 'th' ? 'ล้างข้อมูล' : 'Clear'}
                  </button>
                  {activeTab === 'return_borrowed' && (
                    <button
                      onClick={openConvertModal}
                      disabled={selectedBorrowProducts.length === 0}
                      className="px-6 py-3 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {locale === 'th' ? 'สร้าง PO & ใบส่งสินค้า' : 'Create PO & Outbound'}
                    </button>
                  )}
                  <button
                    onClick={handleBorrowSubmit}
                    disabled={selectedBorrowProducts.length === 0 || !borrowerName.trim() || isBorrowSubmitting}
                    className={`px-6 py-3 text-white rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center gap-2 ${
                      activeTab === 'borrow' ? 'bg-purple-500 hover:bg-purple-600' : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    {isBorrowSubmitting ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {locale === 'th' ? 'กำลังดำเนินการ...' : 'Processing...'}
                      </>
                    ) : (
                      <>
                        {activeTab === 'borrow'
                          ? locale === 'th' ? 'ส่งคำขอยืมสินค้า' : 'Submit Borrow Request'
                          : locale === 'th' ? 'คืนสินค้าเข้าคลัง' : 'Return to Stock'}
                      </>
                    )}
                  </button>
                </div>
              </div>
      )}

      {/* ==================== HISTORY TAB ==================== */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
                  {(['all', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => {
                        setBorrowHistoryFilter(filter)
                        setBorrowHistoryPagination((p) => ({ ...p, page: 1 }))
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        borrowHistoryFilter === filter
                          ? filter === 'all'
                            ? 'bg-[var(--color-charcoal)] text-white'
                            : filter === 'PENDING'
                              ? 'bg-amber-500 text-white'
                              : filter === 'APPROVED'
                                ? 'bg-green-500 text-white'
                                : 'bg-red-500 text-white'
                          : 'bg-[var(--color-off-white)] text-[var(--color-charcoal)] hover:bg-[var(--color-beige)]'
                      }`}
                    >
                      {filter === 'all'
                        ? locale === 'th' ? 'ทั้งหมด' : 'All'
                        : filter === 'PENDING'
                          ? locale === 'th' ? 'รออนุมัติ' : 'Pending'
                          : filter === 'APPROVED'
                            ? locale === 'th' ? 'อนุมัติแล้ว' : 'Approved'
                            : locale === 'th' ? 'ปฏิเสธ' : 'Rejected'}
                    </button>
                  ))}
                </div>

          {/* History Table */}
          <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                  <tr>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'เลขที่' : 'No.'}</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'ประเภท' : 'Type'}</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'ผู้ยืม/คืน' : 'Borrower'}</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'จำนวน' : 'Items'}</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'สถานะ' : 'Status'}</th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'วันที่' : 'Date'}</th>
                    <th className="px-5 py-4 text-right text-sm font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'จัดการ' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-beige)]">
                  {borrowHistoryLoading ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center">
                        <div className="relative w-10 h-10 mx-auto mb-3">
                          <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
                          <div className="absolute inset-0 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin" />
                        </div>
                        <p className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'กำลังโหลด...' : 'Loading...'}</p>
                      </td>
                    </tr>
                  ) : borrowHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-beige)]/50 flex items-center justify-center">
                          <svg className="w-8 h-8 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ไม่พบรายการ' : 'No records found'}</p>
                      </td>
                    </tr>
                  ) : (
                    borrowHistory.map((txn) => (
                      <tr key={txn.id} className="hover:bg-[var(--color-off-white)]/50 transition-colors">
                        <td className="px-5 py-4">
                          <span className="font-mono text-sm font-semibold text-[var(--color-gold)]">{txn.transactionNo}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                txn.type === 'BORROW' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                              }`}>
                                {txn.type === 'BORROW' ? (locale === 'th' ? 'ยืม' : 'Borrow') : (locale === 'th' ? 'คืน' : 'Return')}
                              </span>
                            </td>
                        <td className="px-5 py-4">
                          <p className="font-medium">{txn.borrowerName}</p>
                          {txn.clinicName && <p className="text-xs text-[var(--color-foreground-muted)]">{txn.clinicName}</p>}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex items-center justify-center min-w-[3rem] px-2 h-8 rounded-lg bg-[var(--color-beige)]/50 font-medium text-xs">{txn.lines.length}</span>
                        </td>
                        <td className="px-5 py-4">{getBorrowStatusBadge(txn.status)}</td>
                        <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">{formatDate(txn.createdAt)}</td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openBorrowDocument(txn.id)}
                              className="px-3 py-1.5 text-sm border border-[var(--color-beige)] rounded-lg hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] transition-all"
                                >
                              {locale === 'th' ? 'พิมพ์' : 'Print'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {borrowHistoryPagination.totalPages > 1 && (
              <div className="px-4 sm:px-5 py-4 border-t border-[var(--color-beige)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--color-off-white)]">
                <p className="text-sm text-[var(--color-foreground-muted)]">
                  {locale === 'th'
                    ? `แสดง ${borrowHistory.length} จาก ${borrowHistoryPagination.total} รายการ`
                    : `Showing ${borrowHistory.length} of ${borrowHistoryPagination.total} items`}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBorrowHistoryPagination((p) => ({ ...p, page: p.page - 1 }))}
                    disabled={borrowHistoryPagination.page === 1}
                    className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-[var(--color-charcoal)] border border-[var(--color-beige)] rounded-lg hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-50 disabled:hover:border-[var(--color-beige)] disabled:hover:text-[var(--color-charcoal)] transition-all"
                  >
                    {locale === 'th' ? 'ก่อนหน้า' : 'Previous'}
                  </button>
                  <button
                    onClick={() => setBorrowHistoryPagination((p) => ({ ...p, page: p.page + 1 }))}
                    disabled={borrowHistoryPagination.page >= borrowHistoryPagination.totalPages}
                    className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-[var(--color-charcoal)] border border-[var(--color-beige)] rounded-lg hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-50 disabled:hover:border-[var(--color-beige)] disabled:hover:text-[var(--color-charcoal)] transition-all"
                  >
                    {locale === 'th' ? 'ถัดไป' : 'Next'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Restore Modal */}
      {showRestoreModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              {locale === 'th' ? 'จัดการสินค้า' : 'Manage Product'}
            </h3>

            <div className="bg-[var(--color-off-white)] rounded-lg p-4 mb-4">
              <p className="font-mono text-sm">{selectedItem.serial12}</p>
              <p className="font-medium">{selectedItem.productMaster?.sku || selectedItem.sku}</p>
              <p className="text-sm text-[var(--color-foreground-muted)]">
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
                className="w-full px-3 py-2 bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all duration-200"
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
                onClick={openPreGenModal}
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
                className="px-4 py-2 border border-[var(--color-beige)] rounded-lg"
              >
                {locale === 'th' ? 'ปิด' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Gen Replacement Modal */}
      {showPreGenModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-semibold mb-2">
              {locale === 'th' ? 'เลือก QR ทดแทน (Pre-Gen)' : 'Select Replacement QR (Pre-Gen)'}
            </h3>
            <p className="text-sm text-[var(--color-foreground-muted)] mb-4">
              {locale === 'th'
                ? 'เลือก QR ที่สร้างล่วงหน้าเพื่อใช้แทนสินค้าที่จะทิ้ง หรือข้ามหากไม่ต้องการ'
                : 'Select a pre-generated QR to replace the scrapped item, or skip if not needed'}
            </p>

            <div className="bg-[var(--color-off-white)] rounded-lg p-3 mb-4">
              <p className="text-xs text-[var(--color-foreground-muted)]">
                {locale === 'th' ? 'สินค้าที่จะทิ้ง' : 'Item to scrap'}
              </p>
              <p className="font-mono text-sm font-medium">{selectedItem.serial12}</p>
              <p className="text-sm">{selectedItem.productMaster?.sku} - {selectedItem.productMaster ? (locale === 'th' ? selectedItem.productMaster.nameTh : selectedItem.productMaster.nameEn || selectedItem.productMaster.nameTh) : selectedItem.name}</p>
            </div>

            <div className="flex-1 overflow-y-auto mb-4 min-h-0">
              {loadingPreGen ? (
                <div className="text-center py-8 text-[var(--color-foreground-muted)]">
                  {locale === 'th' ? 'กำลังโหลด...' : 'Loading...'}
                </div>
              ) : preGenItems.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[var(--color-foreground-muted)]">
                    {locale === 'th' ? 'ไม่มี QR Pre-Gen ที่พร้อมใช้สำหรับสินค้านี้' : 'No pre-gen QR available for this product'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {preGenItems.map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedPreGenId === item.id
                          ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/5'
                          : 'border-[var(--color-beige)] hover:border-[var(--color-gold)]/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="preGenItem"
                        checked={selectedPreGenId === item.id}
                        onChange={() => setSelectedPreGenId(item.id)}
                        className="accent-[var(--color-gold)]"
                      />
                      <div>
                        <p className="font-mono text-sm font-medium">{item.serial12}</p>
                        {item.batchNo && (
                          <p className="text-xs text-[var(--color-foreground-muted)]">Batch: {item.batchNo}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleRestore('scrap', selectedPreGenId)}
                disabled={restoring || !selectedPreGenId}
                className="flex-1 py-2 bg-[var(--color-gold)] text-white rounded-lg hover:bg-[var(--color-gold-dark)] disabled:opacity-50 font-medium"
              >
                {restoring ? '...' : (locale === 'th' ? 'ทิ้งและใช้ QR ทดแทน' : 'Scrap & Use Replacement')}
              </button>
              <button
                onClick={() => handleRestore('scrap')}
                disabled={restoring}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {locale === 'th' ? 'ทิ้งอย่างเดียว' : 'Scrap Only'}
              </button>
              <button
                onClick={() => {
                  setShowPreGenModal(false)
                  setSelectedPreGenId(null)
                  setPreGenItems([])
                }}
                disabled={restoring}
                className="px-4 py-2 border border-[var(--color-beige)] rounded-lg hover:bg-[var(--color-off-white)]"
              >
                {locale === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && searchResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              {locale === 'th' ? 'ยืนยันการรับคืนสินค้า' : 'Confirm Product Return'}
            </h3>

            <div className="bg-[var(--color-off-white)] rounded-lg p-4 mb-4">
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
                className="w-full px-3 py-2 bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all duration-200"
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
                className="w-full px-3 py-2 bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all duration-200"
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
                className="px-4 py-2 border border-[var(--color-beige)] rounded-lg"
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              {locale === 'th' ? 'ยืนยันการรับคืนสินค้าทั้ง Lot' : 'Confirm Lot Return'}
            </h3>

            <div className="bg-[var(--color-off-white)] rounded-lg p-4 mb-4">
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
                      <span className="text-[var(--color-foreground-muted)] truncate ml-2">{p.name}</span>
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
                className="w-full px-3 py-2 bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all duration-200"
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
                className="w-full px-3 py-2 bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all duration-200"
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
                className="px-4 py-2 border border-[var(--color-beige)] rounded-lg"
              >
                {locale === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to PO & Outbound Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {locale === 'th' ? 'สร้าง PO & ใบส่งสินค้า' : 'Create PO & Outbound'}
            </h3>

            {/* Product Summary */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-indigo-700 mb-2">
                {locale === 'th' ? 'สรุปสินค้าที่เลือก' : 'Selected Products Summary'}
              </h4>
              <div className="space-y-1 text-sm max-h-32 overflow-y-auto">
                {(() => {
                  const grouped = new Map<string, { name: string; sku: string; count: number }>()
                  borrowProductsList
                    .filter((p) => selectedBorrowProducts.includes(p.id))
                    .forEach((p) => {
                      const key = p.productMaster?.id?.toString() || p.sku
                      const existing = grouped.get(key)
                      if (existing) {
                        existing.count++
                      } else {
                        grouped.set(key, {
                          name: p.productMaster
                            ? (locale === 'th' ? p.productMaster.nameTh : p.productMaster.nameEn || p.productMaster.nameTh)
                            : p.name,
                          sku: p.sku,
                          count: 1,
                        })
                      }
                    })
                  return Array.from(grouped.values()).map((g, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="truncate flex-1">
                        <span className="font-mono text-indigo-600">{g.sku}</span>
                        <span className="text-[var(--color-charcoal)] ml-2">{g.name}</span>
                      </span>
                      <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                        x{g.count}
                      </span>
                    </div>
                  ))
                })()}
              </div>
              <div className="mt-2 pt-2 border-t border-indigo-200 text-sm font-medium text-indigo-700">
                {locale === 'th' ? `รวม ${selectedBorrowProducts.length} รายการ` : `Total: ${selectedBorrowProducts.length} items`}
              </div>
            </div>

            {/* Required Fields */}
            <div className="space-y-4 mb-4">
              <div className="relative">
                <label className="block text-sm font-medium mb-1">
                  {locale === 'th' ? 'ชื่อคลินิก/ชื่อคนซื้อ' : 'Clinic / Buyer Name'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={convertClinicSearch}
                  onChange={(e) => {
                    setConvertClinicSearch(e.target.value)
                    // Clear clinic selection if user edits the text
                    if (convertClinicId) setConvertClinicId(0)
                  }}
                  placeholder={locale === 'th' ? 'กรอกชื่อคลินิก/ชื่อคนซื้อ' : 'Enter clinic or buyer name'}
                  className="w-full px-3 py-2 border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-indigo-400"
                />
                {convertClinicId > 0 && (
                  <span className="absolute right-3 top-[34px] text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">
                    {locale === 'th' ? 'เชื่อมกับคลินิกในระบบ' : 'Linked to clinic'}
                  </span>
                )}
                {/* Autocomplete suggestions */}
                {convertClinicSearch.length >= 2 && convertClinicId === 0 && (
                  (() => {
                    const matches = convertClinics.filter((c) =>
                      c.name.toLowerCase().includes(convertClinicSearch.toLowerCase()) ||
                      c.address?.toLowerCase().includes(convertClinicSearch.toLowerCase()) ||
                      c.branchName?.toLowerCase().includes(convertClinicSearch.toLowerCase())
                    ).slice(0, 5)
                    return matches.length > 0 ? (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-[var(--color-beige)] rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {matches.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setConvertClinicId(c.id)
                              setConvertClinicSearch(c.name)
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors border-b border-[var(--color-beige)] last:border-b-0"
                          >
                            <span className="font-medium">{c.name}</span>
                            {c.branchName && <span className="text-[var(--color-foreground-muted)]"> ({c.branchName})</span>}
                            <span className="text-[var(--color-foreground-muted)]"> - {c.address}</span>
                          </button>
                        ))}
                      </div>
                    ) : null
                  })()
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {locale === 'th' ? 'คลังสินค้า' : 'Warehouse'} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={convertWarehouseId}
                    onChange={(e) => setConvertWarehouseId(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-indigo-400"
                  >
                    <option value={0}>{locale === 'th' ? '-- เลือกคลัง --' : '-- Select warehouse --'}</option>
                    {convertWarehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {locale === 'th' ? 'วิธีจัดส่ง' : 'Shipping Method'} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={convertShippingMethodId}
                    onChange={(e) => setConvertShippingMethodId(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-indigo-400"
                  >
                    <option value={0}>{locale === 'th' ? '-- เลือกวิธีจัดส่ง --' : '-- Select shipping --'}</option>
                    {convertShippingMethods.map((s) => (
                      <option key={s.id} value={s.id}>{s.nameTh}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Optional Delivery Info */}
            <details className="mb-4">
              <summary className="text-sm font-medium text-[var(--color-charcoal)] cursor-pointer hover:text-[var(--color-charcoal)]">
                {locale === 'th' ? 'ข้อมูลเพิ่มเติม (ไม่บังคับ)' : 'Additional Info (Optional)'}
              </summary>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-foreground-muted)] mb-1">
                    {locale === 'th' ? 'เลขที่สัญญา' : 'Contract No.'}
                  </label>
                  <input
                    type="text"
                    value={convertContractNo}
                    onChange={(e) => setConvertContractNo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-foreground-muted)] mb-1">
                    {locale === 'th' ? 'ชื่อพนักงานขาย' : 'Sales Person'}
                  </label>
                  <input
                    type="text"
                    value={convertSalesPersonName}
                    onChange={(e) => setConvertSalesPersonName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-foreground-muted)] mb-1">
                    {locale === 'th' ? 'ผู้ติดต่อบริษัท' : 'Company Contact'}
                  </label>
                  <input
                    type="text"
                    value={convertCompanyContact}
                    onChange={(e) => setConvertCompanyContact(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-foreground-muted)] mb-1">
                    {locale === 'th' ? 'ชื่อผู้ติดต่อคลินิก' : 'Clinic Contact Name'}
                  </label>
                  <input
                    type="text"
                    value={convertClinicContactName}
                    onChange={(e) => setConvertClinicContactName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-[var(--color-foreground-muted)] mb-1">
                    {locale === 'th' ? 'ที่อยู่คลินิก' : 'Clinic Address'}
                  </label>
                  <input
                    type="text"
                    value={convertClinicAddress}
                    onChange={(e) => setConvertClinicAddress(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-foreground-muted)] mb-1">
                    {locale === 'th' ? 'เบอร์โทร' : 'Phone'}
                  </label>
                  <input
                    type="text"
                    value={convertClinicPhone}
                    onChange={(e) => setConvertClinicPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-foreground-muted)] mb-1">
                    {locale === 'th' ? 'อีเมล' : 'Email'}
                  </label>
                  <input
                    type="text"
                    value={convertClinicEmail}
                    onChange={(e) => setConvertClinicEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-[var(--color-foreground-muted)] mb-1">
                    {locale === 'th' ? 'หมายเหตุ' : 'Remarks'}
                  </label>
                  <textarea
                    value={convertRemarks}
                    onChange={(e) => setConvertRemarks(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>
            </details>

            {/* Buttons */}
            <div className="flex gap-3 pt-2 border-t border-[var(--color-beige)]">
              <button
                onClick={handleConvertSubmit}
                disabled={isConverting || !convertClinicSearch.trim() || !convertWarehouseId || !convertShippingMethodId}
                className="flex-1 py-2.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
              >
                {isConverting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {locale === 'th' ? 'กำลังดำเนินการ...' : 'Processing...'}
                  </>
                ) : (
                  locale === 'th' ? 'ยืนยัน' : 'Confirm'
                )}
              </button>
              <button
                onClick={() => setShowConvertModal(false)}
                disabled={isConverting}
                className="px-6 py-2.5 border border-[var(--color-beige)] rounded-lg disabled:opacity-50"
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
