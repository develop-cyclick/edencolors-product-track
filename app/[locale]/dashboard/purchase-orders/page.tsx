'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useConfirm, useAlert } from '@/components/ui/confirm-modal'

interface Clinic {
  id: number
  name: string
  province: string
  branchName: string | null
}

interface ProductMaster {
  id: number
  sku: string
  nameTh: string
  nameEn: string | null
  modelSize: string | null
}

interface PurchaseOrderLine {
  id: number
  productMasterId: number
  quantity: number
  shippedQuantity: number
  productMaster: ProductMaster
}

interface Outbound {
  id: number
  deliveryNoteNo: string
  status: string
  createdAt: string
}

interface PurchaseOrder {
  id: number
  poNo: string
  clinicId: number
  status: string
  remarks: string | null
  createdAt: string
  updatedAt: string
  clinic: Clinic
  createdBy: { id: number; displayName: string }
  lines: PurchaseOrderLine[]
  outbounds: Outbound[]
  summary: {
    totalOrdered: number
    totalShipped: number
    totalRemaining: number
    lineCount: number
  }
}

interface POLine {
  productMasterId: number
  quantity: number
}

export default function PurchaseOrdersPage() {
  const params = useParams()
  const locale = params.locale as string
  const confirm = useConfirm()
  const alert = useAlert()

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [productMasters, setProductMasters] = useState<ProductMaster[]>([])

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingPOId, setEditingPOId] = useState<number | null>(null)

  // Filter state
  const [filterClinicId, setFilterClinicId] = useState<number>(0)
  const [filterStatus, setFilterStatus] = useState<string>('')

  // Form state
  const [formClinicId, setFormClinicId] = useState<number>(0)
  const [formRemarks, setFormRemarks] = useState('')
  const [formLines, setFormLines] = useState<POLine[]>([{ productMasterId: 0, quantity: 1 }])
  // Delivery info form state
  const [formDeliveryNoteNo, setFormDeliveryNoteNo] = useState('')
  const [formContractNo, setFormContractNo] = useState('')
  const [formSalesPersonName, setFormSalesPersonName] = useState('')
  const [formCompanyContact, setFormCompanyContact] = useState('')
  const [formClinicAddress, setFormClinicAddress] = useState('')
  const [formClinicPhone, setFormClinicPhone] = useState('')
  const [formClinicEmail, setFormClinicEmail] = useState('')
  const [formClinicContactName, setFormClinicContactName] = useState('')

  // Clinic search dropdown
  const [clinicSearch, setClinicSearch] = useState('')
  const [clinicDropdownOpen, setClinicDropdownOpen] = useState(false)
  const clinicDropdownRef = useRef<HTMLDivElement>(null)

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)

  useEffect(() => {
    fetchData()
  }, [filterClinicId, filterStatus])

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (clinicDropdownRef.current && !clinicDropdownRef.current.contains(event.target as Node)) {
        setClinicDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterClinicId) params.set('clinicId', filterClinicId.toString())
      if (filterStatus) params.set('status', filterStatus)

      const [poRes, clinicRes, pmRes] = await Promise.all([
        fetch(`/api/admin/purchase-orders?${params.toString()}`).then((r) => r.json()),
        fetch('/api/admin/clinics').then((r) => r.json()),
        fetch('/api/admin/masters/products?activeOnly=true').then((r) => r.json()),
      ])

      if (poRes.success && poRes.data?.purchaseOrders) {
        setPurchaseOrders(poRes.data.purchaseOrders)
      }
      if (clinicRes.success && clinicRes.data?.clinics) {
        setClinics(clinicRes.data.clinics)
      }
      if (pmRes.success && pmRes.data?.productMasters) {
        setProductMasters(pmRes.data.productMasters)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setIsEditMode(false)
    setEditingPOId(null)
    setFormClinicId(0)
    setFormRemarks('')
    setFormLines([{ productMasterId: 0, quantity: 1 }])
    setClinicSearch('')
    setFormDeliveryNoteNo('')
    setFormContractNo('')
    setFormSalesPersonName('')
    setFormCompanyContact('')
    setFormClinicAddress('')
    setFormClinicPhone('')
    setFormClinicEmail('')
    setFormClinicContactName('')
    setShowModal(true)
  }

  const openEditModal = (po: PurchaseOrder) => {
    setIsEditMode(true)
    setEditingPOId(po.id)
    setFormClinicId(po.clinicId)
    setFormRemarks(po.remarks || '')
    // Pre-fill lines from existing PO
    setFormLines(po.lines.map((l) => ({
      productMasterId: l.productMasterId,
      quantity: l.quantity,
    })))
    setClinicSearch('')
    // Pre-fill delivery info - need to fetch from API since it's not in the list response
    fetch(`/api/admin/purchase-orders/${po.id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data?.purchaseOrder) {
          const poData = res.data.purchaseOrder
          setFormDeliveryNoteNo(poData.deliveryNoteNo || '')
          setFormContractNo(poData.contractNo || '')
          setFormSalesPersonName(poData.salesPersonName || '')
          setFormCompanyContact(poData.companyContact || '')
          setFormClinicAddress(poData.clinicAddress || '')
          setFormClinicPhone(poData.clinicPhone || '')
          setFormClinicEmail(poData.clinicEmail || '')
          setFormClinicContactName(poData.clinicContactName || '')
        }
      })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setIsEditMode(false)
    setEditingPOId(null)
    setFormClinicId(0)
    setFormRemarks('')
    setFormLines([{ productMasterId: 0, quantity: 1 }])
    setClinicSearch('')
    setFormDeliveryNoteNo('')
    setFormContractNo('')
    setFormSalesPersonName('')
    setFormCompanyContact('')
    setFormClinicAddress('')
    setFormClinicPhone('')
    setFormClinicEmail('')
    setFormClinicContactName('')
  }

  const addLine = () => {
    setFormLines([...formLines, { productMasterId: 0, quantity: 1 }])
  }

  const removeLine = (index: number) => {
    if (formLines.length > 1) {
      setFormLines(formLines.filter((_, i) => i !== index))
    }
  }

  const updateLine = (index: number, field: keyof POLine, value: number) => {
    setFormLines(formLines.map((line, i) => (i === index ? { ...line, [field]: value } : line)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formClinicId) {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'กรุณาเลือกคลินิก' : 'Please select a clinic', variant: 'warning', icon: 'warning' })
      return
    }

    const validLines = formLines.filter((l) => l.productMasterId > 0 && l.quantity > 0)
    if (validLines.length === 0) {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ' : 'Please add at least one product line', variant: 'warning', icon: 'warning' })
      return
    }

    setActionLoading(true)

    try {
      const payload = {
        clinicId: formClinicId,
        remarks: formRemarks || null,
        lines: validLines,
        // Delivery info
        deliveryNoteNo: formDeliveryNoteNo || null,
        contractNo: formContractNo || null,
        salesPersonName: formSalesPersonName || null,
        companyContact: formCompanyContact || null,
        clinicAddress: formClinicAddress || null,
        clinicPhone: formClinicPhone || null,
        clinicEmail: formClinicEmail || null,
        clinicContactName: formClinicContactName || null,
      }

      let res
      if (isEditMode && editingPOId) {
        res = await fetch(`/api/admin/purchase-orders/${editingPOId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/admin/purchase-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const data = await res.json()
      if (data.success) {
        await alert({
          title: locale === 'th' ? 'สำเร็จ' : 'Success',
          message: isEditMode
            ? (locale === 'th' ? 'บันทึกการแก้ไขสำเร็จ!' : 'Changes saved successfully!')
            : (locale === 'th' ? `สร้าง PO สำเร็จ: ${data.data.purchaseOrder.poNo}` : `PO created: ${data.data.purchaseOrder.poNo}`),
          variant: 'success',
          icon: 'success'
        })
        closeModal()
        fetchData()
        // Close detail modal if open
        if (showDetailModal) {
          closeDetailModal()
        }
      } else {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: `Error: ${data.error}`, variant: 'error', icon: 'error' })
      }
    } catch (error) {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: isEditMode ? 'Failed to update purchase order' : 'Failed to create purchase order', variant: 'error', icon: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async (po: PurchaseOrder) => {
    const confirmed = await confirm({
      title: locale === 'th' ? 'ยกเลิกใบสั่งซื้อ' : 'Cancel Purchase Order',
      message: locale === 'th'
        ? `ยืนยันการยกเลิก PO "${po.poNo}"?`
        : `Confirm cancel PO "${po.poNo}"?`,
      confirmText: locale === 'th' ? 'ยกเลิก PO' : 'Cancel PO',
      cancelText: locale === 'th' ? 'ไม่ใช่' : 'No',
      variant: 'warning',
      icon: 'warning',
    })
    if (!confirmed) return

    try {
      const res = await fetch(`/api/admin/purchase-orders/${po.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        await alert({ title: locale === 'th' ? 'สำเร็จ' : 'Success', message: locale === 'th' ? 'ยกเลิก PO สำเร็จ' : 'PO cancelled successfully', variant: 'success', icon: 'success' })
        fetchData()
      } else {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: `Error: ${data.error}`, variant: 'error', icon: 'error' })
      }
    } catch (error) {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: 'Failed to cancel purchase order', variant: 'error', icon: 'error' })
    }
  }

  const openDetailModal = (po: PurchaseOrder) => {
    setSelectedPO(po)
    setShowDetailModal(true)
  }

  const closeDetailModal = () => {
    setShowDetailModal(false)
    setSelectedPO(null)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-600',
      CONFIRMED: 'bg-blue-50 text-blue-600',
      PARTIAL: 'bg-amber-50 text-amber-600',
      COMPLETED: 'bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]',
      CANCELLED: 'bg-red-50 text-red-600',
    }
    const labels: Record<string, { th: string; en: string }> = {
      DRAFT: { th: 'ร่าง', en: 'Draft' },
      CONFIRMED: { th: 'ยืนยันแล้ว', en: 'Confirmed' },
      PARTIAL: { th: 'ส่งบางส่วน', en: 'Partial' },
      COMPLETED: { th: 'ส่งครบแล้ว', en: 'Completed' },
      CANCELLED: { th: 'ยกเลิก', en: 'Cancelled' },
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
        {labels[status]?.[locale === 'th' ? 'th' : 'en'] || status}
      </span>
    )
  }

  const filteredClinics = clinics.filter((c) => {
    const search = clinicSearch.toLowerCase()
    return c.name.toLowerCase().includes(search) || c.province.toLowerCase().includes(search) || (c.branchName && c.branchName.toLowerCase().includes(search))
  })

  const selectedClinic = clinics.find((c) => c.id === formClinicId)

  const inputClass = "w-full px-4 py-2.5 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
  const selectClass = "appearance-none w-full px-4 py-2.5 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] pr-10"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-display text-2xl font-bold text-[var(--color-charcoal)]">
            {locale === 'th' ? 'ใบสั่งซื้อ (Purchase Orders)' : 'Purchase Orders'}
          </h1>
          <p className="text-[var(--color-foreground-muted)] mt-1">
            {locale === 'th' ? 'จัดการใบสั่งซื้อและสินค้าฝากของแต่ละคลินิก' : 'Manage purchase orders and reserved products for each clinic'}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-gold)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(201,163,90,0.35)] transition-all duration-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {locale === 'th' ? 'สร้าง PO ใหม่' : 'Create New PO'}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1.5">
              {locale === 'th' ? 'คลินิก' : 'Clinic'}
            </label>
            <div className="relative">
              <select
                value={filterClinicId}
                onChange={(e) => setFilterClinicId(parseInt(e.target.value))}
                className={selectClass}
              >
                <option value={0}>{locale === 'th' ? '-- ทั้งหมด --' : '-- All --'}</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.province})
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-foreground-muted)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1.5">
              {locale === 'th' ? 'สถานะ' : 'Status'}
            </label>
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={selectClass}
              >
                <option value="">{locale === 'th' ? '-- ทั้งหมด --' : '-- All --'}</option>
                <option value="DRAFT">{locale === 'th' ? 'ร่าง' : 'Draft'}</option>
                <option value="CONFIRMED">{locale === 'th' ? 'ยืนยันแล้ว' : 'Confirmed'}</option>
                <option value="PARTIAL">{locale === 'th' ? 'ส่งบางส่วน' : 'Partial'}</option>
                <option value="COMPLETED">{locale === 'th' ? 'ส่งครบแล้ว' : 'Completed'}</option>
                <option value="CANCELLED">{locale === 'th' ? 'ยกเลิก' : 'Cancelled'}</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-foreground-muted)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PO List */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 relative">
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin" />
            </div>
            <p className="text-[var(--color-foreground-muted)]">
              {locale === 'th' ? 'กำลังโหลด...' : 'Loading...'}
            </p>
          </div>
        ) : purchaseOrders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-beige)]/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-[var(--color-foreground-muted)]">
              {locale === 'th' ? 'ยังไม่มีใบสั่งซื้อ' : 'No purchase orders found'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                  <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'เลข PO' : 'PO No.'}
                  </th>
                  <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'คลินิก' : 'Clinic'}
                  </th>
                  <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'จำนวนสินค้า' : 'Number of items'}
                  </th>
                  <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'ส่งแล้ว' : 'Shipped'}
                  </th>
                  <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'สินค้าฝาก' : 'Souvenirs'}
                  </th>
                  <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'สถานะ' : 'Status'}
                  </th>
                  <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'วันที่สร้าง' : 'Created'}
                  </th>
                  <th className="px-5 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-beige)]">
                {purchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-[var(--color-off-white)]/50 transition-colors">
                    <td className="px-5 py-4">
                      <button
                        onClick={() => openDetailModal(po)}
                        className="font-medium text-amber-600 hover:text-[var(--color-gold-dark)] hover:underline"
                      >
                        {po.poNo}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-[var(--color-charcoal)]">{po.clinic.name}</div>
                      <div className="text-xs text-[var(--color-foreground-muted)]">
                        {po.clinic.province} {po.clinic.branchName && `• ${po.clinic.branchName}`}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        {po.summary.totalOrdered} {locale === 'th' ? 'ชิ้น' : 'pcs'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {po.summary.totalShipped} {locale === 'th' ? 'ชิ้น' : 'pcs'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {po.summary.totalRemaining > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600">
                          {po.summary.totalRemaining} {locale === 'th' ? 'ชิ้น' : 'pcs'}
                        </span>
                      ) : (
                        <span className="text-[var(--color-foreground-muted)]">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4">{getStatusBadge(po.status)}</td>
                    <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">
                      {formatDate(po.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openDetailModal(po)}
                          className="p-2 text-[var(--color-gold)] hover:bg-[var(--color-gold)]/10 rounded-lg transition-colors"
                          title={locale === 'th' ? 'ดูรายละเอียด' : 'View Details'}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        {po.status === 'CONFIRMED' && (
                          <button
                            onClick={() => openEditModal(po)}
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title={locale === 'th' ? 'แก้ไข' : 'Edit'}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {po.status !== 'CANCELLED' && po.status !== 'COMPLETED' && (
                          <button
                            onClick={() => handleCancel(po)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title={locale === 'th' ? 'ยกเลิก' : 'Cancel'}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--color-charcoal)]">
                {isEditMode
                  ? (locale === 'th' ? 'แก้ไขใบสั่งซื้อ' : 'Edit Purchase Order')
                  : (locale === 'th' ? 'สร้างใบสั่งซื้อใหม่' : 'Create New Purchase Order')
                }
              </h3>
              <button onClick={closeModal} className="p-2 text-[var(--color-foreground-muted)] hover:text-[var(--color-charcoal)] rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Clinic Selection */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1.5">
                  {locale === 'th' ? 'คลินิก' : 'Clinic'} <span className="text-red-500">*</span>
                </label>
                <div className="relative" ref={clinicDropdownRef}>
                  <div
                    className={`${selectClass} cursor-pointer flex items-center`}
                    onClick={() => setClinicDropdownOpen(!clinicDropdownOpen)}
                  >
                    {clinicDropdownOpen ? (
                      <input
                        type="text"
                        value={clinicSearch}
                        onChange={(e) => setClinicSearch(e.target.value)}
                        placeholder={locale === 'th' ? 'พิมพ์ชื่อคลินิก...' : 'Type clinic name...'}
                        className="w-full bg-transparent outline-none"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className={formClinicId ? 'text-[var(--color-charcoal)]' : 'text-[var(--color-foreground-muted)]'}>
                        {selectedClinic ? `${selectedClinic.name} (${selectedClinic.province})` : locale === 'th' ? '-- เลือกคลินิก --' : '-- Select Clinic --'}
                      </span>
                    )}
                  </div>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-foreground-muted)]">
                    <svg className={`w-5 h-5 transition-transform ${clinicDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {clinicDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-[var(--color-beige)] rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {filteredClinics.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-[var(--color-foreground-muted)]">
                          {locale === 'th' ? 'ไม่พบคลินิก' : 'No clinics found'}
                        </div>
                      ) : (
                        filteredClinics.map((c) => (
                          <div
                            key={c.id}
                            className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-[var(--color-off-white)] transition-colors ${c.id === formClinicId ? 'bg-[var(--color-gold)]/10 text-[var(--color-gold-dark)]' : 'text-[var(--color-charcoal)]'}`}
                            onClick={() => {
                              setFormClinicId(c.id)
                              setClinicSearch('')
                              setClinicDropdownOpen(false)
                            }}
                          >
                            <div className="font-medium">{c.name}</div>
                            <div className="text-xs text-[var(--color-foreground-muted)]">
                              {c.province} {c.branchName && `• ${c.branchName}`}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Product Lines */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-2">
                  {locale === 'th' ? 'รายการสินค้าฝาก' : 'Reserved Products'} <span className="text-red-500">*</span>
                </label>
                <div className="space-y-3">
                  {formLines.map((line, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-[var(--color-off-white)] rounded-xl">
                      <div className="flex-1">
                        <select
                          value={line.productMasterId}
                          onChange={(e) => updateLine(index, 'productMasterId', parseInt(e.target.value))}
                          className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-[var(--color-gold)]"
                        >
                          <option value={0}>{locale === 'th' ? '-- เลือกสินค้า --' : '-- Select Product --'}</option>
                          {productMasters.map((pm) => (
                            <option key={pm.id} value={pm.id}>
                              {pm.sku} - {locale === 'th' ? pm.nameTh : pm.nameEn || pm.nameTh} {pm.modelSize && `(${pm.modelSize})`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) => updateLine(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-[var(--color-gold)] text-center"
                          placeholder={locale === 'th' ? 'จำนวน' : 'Qty'}
                        />
                      </div>
                      {formLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addLine}
                  className="w-full mt-3 py-2.5 border-2 border-dashed border-[var(--color-beige)] text-[var(--color-foreground-muted)] rounded-xl hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] transition-colors text-sm font-medium"
                >
                  + {locale === 'th' ? 'เพิ่มรายการ' : 'Add Item'}
                </button>
              </div>

              {/* Delivery Info Section */}
              <div className="border-t border-[var(--color-beige)] pt-5 mt-2">
                <h4 className="text-sm font-semibold text-[var(--color-charcoal)] mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[var(--color-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                  {locale === 'th' ? 'ข้อมูลการจัดส่ง' : 'Delivery Information'}
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1.5">
                      IV No.
                    </label>
                    <input
                      type="text"
                      value={formDeliveryNoteNo}
                      onChange={(e) => setFormDeliveryNoteNo(e.target.value)}
                      className={inputClass}
                      placeholder="OUT-2026-XXXX"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1.5">
                      {locale === 'th' ? 'เลข Contract' : 'Contract No.'}
                    </label>
                    <input
                      type="text"
                      value={formContractNo}
                      onChange={(e) => setFormContractNo(e.target.value)}
                      className={inputClass}
                      placeholder="CNT-2026-XXXX"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1.5">
                      {locale === 'th' ? 'ชื่อพนักงานขาย' : 'Sales Person'}
                    </label>
                    <input
                      type="text"
                      value={formSalesPersonName}
                      onChange={(e) => setFormSalesPersonName(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1.5">
                      {locale === 'th' ? 'ช่องทางติดต่อบริษัท' : 'Company Contact'}
                    </label>
                    <input
                      type="text"
                      value={formCompanyContact}
                      onChange={(e) => setFormCompanyContact(e.target.value)}
                      className={inputClass}
                      placeholder={locale === 'th' ? 'Line ID / เบอร์โทร / อีเมล' : 'Line ID / Phone / Email'}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1.5">
                      {locale === 'th' ? 'ที่อยู่จัดส่ง' : 'Delivery Address'}
                    </label>
                    <textarea
                      value={formClinicAddress}
                      onChange={(e) => setFormClinicAddress(e.target.value)}
                      rows={2}
                      className={`${inputClass} resize-none`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1.5">
                      {locale === 'th' ? 'เบอร์โทรคลินิก' : 'Clinic Phone'}
                    </label>
                    <input
                      type="text"
                      value={formClinicPhone}
                      onChange={(e) => setFormClinicPhone(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1.5">
                      {locale === 'th' ? 'อีเมลคลินิก' : 'Clinic Email'}
                    </label>
                    <input
                      type="email"
                      value={formClinicEmail}
                      onChange={(e) => setFormClinicEmail(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1.5">
                      {locale === 'th' ? 'ชื่อผู้รับสินค้า' : 'Contact Person'}
                    </label>
                    <input
                      type="text"
                      value={formClinicContactName}
                      onChange={(e) => setFormClinicContactName(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1.5">
                  {locale === 'th' ? 'หมายเหตุ' : 'Remarks'}
                </label>
                <textarea
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-[var(--color-beige)]">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={actionLoading}
                  className="px-4 py-2 text-[var(--color-foreground-muted)] hover:text-[var(--color-charcoal)] font-medium transition-colors"
                >
                  {locale === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2 bg-[var(--color-gold)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] disabled:opacity-50 transition-all"
                >
                  {actionLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {isEditMode
                        ? (locale === 'th' ? 'กำลังบันทึก...' : 'Saving...')
                        : (locale === 'th' ? 'กำลังสร้าง...' : 'Creating...')
                      }
                    </span>
                  ) : isEditMode ? (
                    locale === 'th' ? 'บันทึก' : 'Save'
                  ) : (
                    locale === 'th' ? 'สร้าง PO' : 'Create PO'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedPO && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-charcoal)]">{selectedPO.poNo}</h3>
                <p className="text-sm text-[var(--color-foreground-muted)]">
                  {selectedPO.clinic.name} ({selectedPO.clinic.province})
                </p>
              </div>
              <button onClick={closeDetailModal} className="p-2 text-[var(--color-foreground-muted)] hover:text-[var(--color-charcoal)] rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-blue-50 rounded-xl text-center">
                <div className="text-2xl font-bold text-blue-600">{selectedPO.summary.totalOrdered}</div>
                <div className="text-sm text-blue-600">{locale === 'th' ? 'จำนวนสินค้า' : 'Number of items'}</div>
              </div>
              <div className="p-4 bg-[var(--color-mint)]/10 rounded-xl text-center">
                <div className="text-2xl font-bold text-[var(--color-mint-dark)]">{selectedPO.summary.totalShipped}</div>
                <div className="text-sm text-[var(--color-mint-dark)]">{locale === 'th' ? 'ส่งแล้ว' : 'Shipped'}</div>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl text-center">
                <div className="text-2xl font-bold text-amber-600">{selectedPO.summary.totalRemaining}</div>
                <div className="text-sm text-amber-600">{locale === 'th' ? 'สินค้าฝาก' : 'Souvenirs'}</div>
              </div>
            </div>

            {/* Lines Table */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-[var(--color-charcoal)] mb-3">
                {locale === 'th' ? 'รายการสินค้าฝาก' : 'Reserved Products'}
              </h4>
              <div className="border border-[var(--color-beige)] rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[var(--color-off-white)]">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-charcoal)]">SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'สินค้า' : 'Product'}</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'สั่ง' : 'Ordered'}</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'ส่งแล้ว' : 'Shipped'}</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--color-charcoal)]">{locale === 'th' ? 'คงเหลือ' : 'Remaining'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-beige)]">
                    {selectedPO.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-4 py-3 text-sm font-mono text-[var(--color-charcoal)]">{line.productMaster.sku}</td>
                        <td className="px-4 py-3 text-sm text-[var(--color-charcoal)]">
                          {locale === 'th' ? line.productMaster.nameTh : line.productMaster.nameEn || line.productMaster.nameTh}
                          {line.productMaster.modelSize && <span className="text-[var(--color-foreground-muted)]"> ({line.productMaster.modelSize})</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-[var(--color-charcoal)]">{line.quantity}</td>
                        <td className="px-4 py-3 text-sm text-center text-[var(--color-mint-dark)]">{line.shippedQuantity}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          {line.quantity - line.shippedQuantity > 0 ? (
                            <span className="text-amber-600">{line.quantity - line.shippedQuantity}</span>
                          ) : (
                            <span className="text-[var(--color-foreground-muted)]">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Outbounds */}
            {selectedPO.outbounds.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-[var(--color-charcoal)] mb-3">
                  {locale === 'th' ? 'รายการส่งสินค้า' : 'Outbound Deliveries'}
                </h4>
                <div className="space-y-2">
                  {selectedPO.outbounds.map((outbound) => (
                    <Link
                      key={outbound.id}
                      href={`/${locale}/dashboard/outbound/${outbound.id}`}
                      className="flex items-center justify-between p-3 bg-[var(--color-off-white)] rounded-xl hover:bg-[var(--color-gold)]/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--color-mint)]/10 flex items-center justify-center">
                          <svg className="w-4 h-4 text-[var(--color-mint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-[var(--color-charcoal)]">{outbound.deliveryNoteNo}</div>
                          <div className="text-xs text-[var(--color-foreground-muted)]">{formatDate(outbound.createdAt)}</div>
                        </div>
                      </div>
                      {getStatusBadge(outbound.status)}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-4 border-t border-[var(--color-beige)]">
              <button
                onClick={closeDetailModal}
                className="px-4 py-2 text-[var(--color-foreground-muted)] hover:text-[var(--color-charcoal)] font-medium transition-colors"
              >
                {locale === 'th' ? 'ปิด' : 'Close'}
              </button>
              {selectedPO.status === 'CONFIRMED' && (
                <button
                  onClick={() => {
                    closeDetailModal()
                    openEditModal(selectedPO)
                  }}
                  className="px-6 py-2 border border-blue-500 text-blue-500 rounded-xl font-medium hover:bg-blue-50 transition-all"
                >
                  {locale === 'th' ? 'แก้ไข' : 'Edit'}
                </button>
              )}
              {selectedPO.summary.totalRemaining > 0 && selectedPO.status !== 'CANCELLED' && (
                <Link
                  href={`/${locale}/dashboard/outbound/new?clinicId=${selectedPO.clinicId}&poId=${selectedPO.id}`}
                  className="px-6 py-2 bg-[var(--color-mint)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(115,207,199,0.3)] hover:bg-[var(--color-mint-dark)] transition-all"
                >
                  {locale === 'th' ? 'สร้างใบส่งสินค้า' : 'Create Outbound'}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
