'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAlert } from '@/components/ui/confirm-modal'

interface Clinic {
  id: number
  name: string
  province: string
  branchName: string | null
}

interface ShippingMethod {
  id: number
  nameTh: string
}

interface Warehouse {
  id: number
  name: string
}

interface ProductMaster {
  id: number
  sku: string
  nameTh: string
  nameEn: string | null
  modelSize: string | null
  category: { nameTh: string; nameEn: string | null }
  defaultUnit: { id: number; nameTh: string; nameEn: string | null } | null
  stats: {
    inStock: number
  }
}

interface PurchaseOrderLine {
  productMasterId: number
  quantity: number
  shippedQuantity: number
  productMaster: ProductMaster
}

interface PurchaseOrder {
  id: number
  poNo: string
  clinicId: number
  status: string
  // Delivery info from PO
  deliveryNoteNo: string | null
  contractNo: string | null
  salesPersonName: string | null
  companyContact: string | null
  clinicAddress: string | null
  clinicPhone: string | null
  clinicEmail: string | null
  clinicContactName: string | null
  lines: PurchaseOrderLine[]
  summary: {
    totalOrdered: number
    totalShipped: number
    totalRemaining: number
  }
}

interface LineItem {
  id: string
  productMasterId: number
  productMaster: ProductMaster | null
  quantity: number
}

export default function NewOutboundPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const locale = params.locale as string
  const alert = useAlert()

  // URL params
  const urlClinicId = searchParams.get('clinicId')
  const urlPoId = searchParams.get('poId')
  const editId = searchParams.get('editId')

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingOutboundId, setEditingOutboundId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(!!editId)
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [productMasters, setProductMasters] = useState<ProductMaster[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)

  // Clinic search dropdown state
  const [clinicSearch, setClinicSearch] = useState('')
  const [clinicDropdownOpen, setClinicDropdownOpen] = useState(false)
  const clinicDropdownRef = useRef<HTMLDivElement>(null)

  // Form state
  const [warehouseId, setWarehouseId] = useState<number>(0)
  const [shippingMethodId, setShippingMethodId] = useState<number>(0)
  const [clinicId, setClinicId] = useState<number>(0)
  const [deliveryNoteNo, setDeliveryNoteNo] = useState('')
  const [contractNo, setContractNo] = useState('')
  const [salesPersonName, setSalesPersonName] = useState('')
  const [companyContact, setCompanyContact] = useState('')
  const [clinicAddress, setClinicAddress] = useState('')
  const [clinicPhone, setClinicPhone] = useState('')
  const [clinicEmail, setClinicEmail] = useState('')
  const [clinicContactName, setClinicContactName] = useState('')
  const [purchaseOrderId, setPurchaseOrderId] = useState<number>(0)
  const [remarks, setRemarks] = useState('')

  // Line items - select by SKU + quantity
  const [lines, setLines] = useState<LineItem[]>([
    { id: crypto.randomUUID(), productMasterId: 0, productMaster: null, quantity: 1 }
  ])

  useEffect(() => {
    // Fetch master data
    Promise.all([
      fetch('/api/admin/clinics').then((r) => r.json()),
      fetch('/api/admin/masters/shipping-methods').then((r) => r.json()),
      fetch('/api/admin/masters/warehouses').then((r) => r.json()),
      fetch('/api/admin/masters/products?activeOnly=true').then((r) => r.json()),
    ]).then(([clinicRes, shippingRes, whRes, pmRes]) => {
      if (clinicRes.success && clinicRes.data?.clinics) setClinics(clinicRes.data.clinics)
      if (shippingRes.success && shippingRes.data?.shippingMethods) {
        setShippingMethods(shippingRes.data.shippingMethods)
        if (shippingRes.data.shippingMethods.length > 0) setShippingMethodId(shippingRes.data.shippingMethods[0].id)
      }
      if (whRes.success && whRes.data?.warehouses) {
        setWarehouses(whRes.data.warehouses)
        if (whRes.data.warehouses.length > 0) setWarehouseId(whRes.data.warehouses[0].id)
      }
      if (pmRes.success && pmRes.data?.productMasters) {
        setProductMasters(pmRes.data.productMasters)
      }

      // Set clinic from URL params
      if (urlClinicId) {
        setClinicId(parseInt(urlClinicId))
      }
    })
  }, [urlClinicId])

  // Fetch existing outbound data when in edit mode
  useEffect(() => {
    if (editId && productMasters.length > 0) {
      setIsEditMode(true)
      setEditingOutboundId(parseInt(editId))

      const fetchOutbound = async () => {
        try {
          const r = await fetch(`/api/warehouse/outbound/${editId}`)
          const res = await r.json()

          if (res.success && res.data?.outbound) {
            const ob = res.data.outbound

            // Check if still editable (PENDING status)
            if (ob.status !== 'PENDING') {
              await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'ไม่สามารถแก้ไขได้ สถานะไม่ใช่รออนุมัติ' : 'Cannot edit, status is not pending', variant: 'error', icon: 'error' })
              router.push(`/${locale}/dashboard/outbound/${editId}`)
              return
            }

            // Pre-fill form data
            setWarehouseId(ob.warehouse?.id || 0)
            setShippingMethodId(ob.shippingMethod?.id || 0)
            setClinicId(ob.clinic?.id || 0)
            setDeliveryNoteNo(ob.deliveryNoteNo || '')
            setContractNo(ob.contractNo || '')
            setSalesPersonName(ob.salesPersonName || '')
            setCompanyContact(ob.companyContact || '')
            setClinicAddress(ob.clinicAddress || '')
            setClinicPhone(ob.clinicPhone || '')
            setClinicEmail(ob.clinicEmail || '')
            setClinicContactName(ob.clinicContactName || '')
            setPurchaseOrderId(ob.purchaseOrder?.id || 0)
            setRemarks(ob.remarks || '')

            // Pre-fill lines from existing outbound
            if (ob.lines && ob.lines.length > 0) {
              const editLines: LineItem[] = ob.lines.map((line: { productItem: { id: number; sku: string; name: string; modelSize: string | null } }) => {
                // Find product master by SKU
                const pm = productMasters.find((p) => p.sku === line.productItem.sku) || null
                return {
                  id: crypto.randomUUID(),
                  productMasterId: pm?.id || 0,
                  productMaster: pm,
                  quantity: 1, // Each line is 1 item
                }
              })

              // Group by productMasterId and sum quantities
              const groupedLines: Record<number, LineItem> = {}
              editLines.forEach((line) => {
                if (line.productMasterId) {
                  if (groupedLines[line.productMasterId]) {
                    groupedLines[line.productMasterId].quantity += 1
                  } else {
                    groupedLines[line.productMasterId] = { ...line }
                  }
                }
              })

              const finalLines = Object.values(groupedLines)
              if (finalLines.length > 0) {
                setLines(finalLines)
              }
            }
          }
        } catch (err) {
          console.error('Failed to fetch outbound for edit:', err)
        } finally {
          setInitialLoading(false)
        }
      }

      fetchOutbound()
    }
  }, [editId, productMasters, locale, router, alert])

  // Fetch POs when clinic changes (exclude CANCELLED)
  useEffect(() => {
    if (clinicId) {
      fetch(`/api/admin/purchase-orders?clinicId=${clinicId}&hasRemaining=true&excludeCancelled=true`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data?.purchaseOrders) {
            setPurchaseOrders(res.data.purchaseOrders)

            // Set PO from URL params
            if (urlPoId) {
              const po = res.data.purchaseOrders.find((p: PurchaseOrder) => p.id === parseInt(urlPoId))
              if (po) {
                setPurchaseOrderId(po.id)
                setSelectedPO(po)

                // Pre-fill delivery info from PO
                if (po.contractNo) setContractNo(po.contractNo)
                if (po.salesPersonName) setSalesPersonName(po.salesPersonName)
                if (po.companyContact) setCompanyContact(po.companyContact)
                if (po.clinicAddress) setClinicAddress(po.clinicAddress)
                if (po.clinicPhone) setClinicPhone(po.clinicPhone)
                if (po.clinicEmail) setClinicEmail(po.clinicEmail)
                if (po.clinicContactName) setClinicContactName(po.clinicContactName)

                // Pre-fill lines from PO
                const newLines: LineItem[] = po.lines
                  .filter((l: PurchaseOrderLine) => l.quantity > l.shippedQuantity)
                  .map((l: PurchaseOrderLine) => {
                    const pm = productMasters.find((p) => p.id === l.productMasterId)
                    return {
                      id: crypto.randomUUID(),
                      productMasterId: l.productMasterId,
                      productMaster: pm || null,
                      quantity: Math.min(l.quantity - l.shippedQuantity, pm?.stats.inStock || 0),
                    }
                  })
                if (newLines.length > 0) setLines(newLines)
              }
            }
          } else {
            setPurchaseOrders([])
          }
        })
        .catch(() => setPurchaseOrders([]))
    } else {
      setPurchaseOrders([])
      setPurchaseOrderId(0)
      setSelectedPO(null)
    }
  }, [clinicId, urlPoId, productMasters])

  useEffect(() => {
    // Update address when clinic changes
    const clinic = clinics.find((c) => c.id === clinicId)
    if (clinic) {
      setClinicAddress(`${clinic.name}, ${clinic.province}${clinic.branchName ? ` (${clinic.branchName})` : ''}`)
    }
  }, [clinicId, clinics])

  // Handle PO selection
  const handlePOChange = (poId: number) => {
    setPurchaseOrderId(poId)
    const po = purchaseOrders.find((p) => p.id === poId)
    setSelectedPO(po || null)

    if (po) {
      // Pre-fill delivery info from PO
      if (po.deliveryNoteNo) setDeliveryNoteNo(po.deliveryNoteNo)
      if (po.contractNo) setContractNo(po.contractNo)
      if (po.salesPersonName) setSalesPersonName(po.salesPersonName)
      if (po.companyContact) setCompanyContact(po.companyContact)
      if (po.clinicAddress) setClinicAddress(po.clinicAddress)
      if (po.clinicPhone) setClinicPhone(po.clinicPhone)
      if (po.clinicEmail) setClinicEmail(po.clinicEmail)
      if (po.clinicContactName) setClinicContactName(po.clinicContactName)

      // Pre-fill lines from PO (remaining items only)
      const newLines: LineItem[] = po.lines
        .filter((l) => l.quantity > l.shippedQuantity)
        .map((l) => {
          const pm = productMasters.find((p) => p.id === l.productMasterId)
          return {
            id: crypto.randomUUID(),
            productMasterId: l.productMasterId,
            productMaster: pm || null,
            quantity: Math.min(l.quantity - l.shippedQuantity, pm?.stats.inStock || 0),
          }
        })
      if (newLines.length > 0) setLines(newLines)
    }
  }

  // Get remaining quantity for a product in selected PO
  const getPORemainingQty = (productMasterId: number) => {
    if (!selectedPO) return 0
    const line = selectedPO.lines.find((l) => l.productMasterId === productMasterId)
    return line ? line.quantity - line.shippedQuantity : 0
  }

  // Close clinic dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clinicDropdownRef.current && !clinicDropdownRef.current.contains(event.target as Node)) {
        setClinicDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter clinics based on search
  const filteredClinics = clinics.filter((c) => {
    const searchLower = clinicSearch.toLowerCase()
    return (
      c.name.toLowerCase().includes(searchLower) ||
      c.province.toLowerCase().includes(searchLower) ||
      (c.branchName && c.branchName.toLowerCase().includes(searchLower))
    )
  })

  // Get selected clinic display text
  const selectedClinic = clinics.find((c) => c.id === clinicId)
  const clinicDisplayText = selectedClinic
    ? `${selectedClinic.name} (${selectedClinic.province})`
    : ''

  const addLine = () => {
    setLines([
      ...lines,
      { id: crypto.randomUUID(), productMasterId: 0, productMaster: null, quantity: 1 }
    ])
  }

  const removeLine = (id: string) => {
    if (lines.length > 1) {
      setLines(lines.filter((l) => l.id !== id))
    }
  }

  const updateLine = (id: string, field: string, value: number | ProductMaster | null) => {
    setLines(lines.map((l) => (l.id === id ? { ...l, [field]: value } : l)))
  }

  const handleProductMasterChange = (lineId: string, productMasterId: number) => {
    const pm = productMasters.find((p) => p.id === productMasterId) || null
    setLines(lines.map((l) => {
      if (l.id === lineId) {
        return {
          ...l,
          productMasterId,
          productMaster: pm,
          // Reset quantity to 1 or max available
          quantity: Math.min(l.quantity, pm?.stats.inStock || 1),
        }
      }
      return l
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate lines
    const invalidLines = lines.filter((l) => !l.productMasterId || l.quantity < 1)
    if (invalidLines.length > 0) {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'กรุณาเลือกสินค้าและระบุจำนวนให้ครบทุกรายการ' : 'Please select product and quantity for all lines', variant: 'warning', icon: 'warning' })
      return
    }

    // Check stock availability
    for (const line of lines) {
      if (line.productMaster && line.quantity > line.productMaster.stats.inStock) {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th'
          ? `สินค้า ${line.productMaster.sku} มีในคลังไม่เพียงพอ (ต้องการ ${line.quantity}, มี ${line.productMaster.stats.inStock})`
          : `Insufficient stock for ${line.productMaster.sku} (need ${line.quantity}, have ${line.productMaster.stats.inStock})`, variant: 'warning', icon: 'warning' })
        return
      }
    }

    if (!clinicId) {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'กรุณาเลือกคลินิก' : 'Please select a clinic', variant: 'warning', icon: 'warning' })
      return
    }

    setLoading(true)

    try {
      const payload = {
        warehouseId,
        shippingMethodId,
        clinicId,
        deliveryNoteNo: deliveryNoteNo || null,
        contractNo: contractNo || null,
        salesPersonName: salesPersonName || null,
        companyContact: companyContact || null,
        clinicAddress: clinicAddress || null,
        clinicPhone: clinicPhone || null,
        clinicEmail: clinicEmail || null,
        clinicContactName: clinicContactName || null,
        purchaseOrderId: purchaseOrderId || null,
        remarks: remarks || null,
        // Send productMasterId + quantity, API will do FIFO selection
        linesByProductMaster: lines.map((l) => ({
          productMasterId: l.productMasterId,
          quantity: l.quantity,
        })),
      }

      let res
      if (isEditMode && editingOutboundId) {
        // Update existing outbound
        res = await fetch(`/api/warehouse/outbound/${editingOutboundId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        // Create new outbound
        res = await fetch('/api/warehouse/outbound', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const data = await res.json()
      if (data.success) {
        const outboundId = isEditMode ? editingOutboundId : data.data.id
        await alert({
          title: locale === 'th' ? 'สำเร็จ' : 'Success',
          message: locale === 'th'
            ? isEditMode
              ? 'บันทึกการแก้ไขสำเร็จ!'
              : `สร้างใบส่งสินค้าสำเร็จ!\nDelivery No: ${data.data.deliveryNoteNo}\nจำนวน: ${data.data.linesCreated} รายการ`
            : isEditMode
              ? 'Changes saved successfully!'
              : `Outbound created!\nDelivery No: ${data.data.deliveryNoteNo}\nItems: ${data.data.linesCreated}`,
          variant: 'success',
          icon: 'success'
        })
        router.push(`/${locale}/dashboard/outbound/${outboundId}`)
      } else {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: data.error || 'Error', variant: 'error', icon: 'error' })
      }
    } catch (error) {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: isEditMode ? (locale === 'th' ? 'ไม่สามารถแก้ไขใบส่งสินค้าได้' : 'Failed to update outbound') : (locale === 'th' ? 'ไม่สามารถสร้างใบส่งสินค้าได้' : 'Failed to create outbound'), variant: 'error', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full px-4 py-2.5 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
  const labelClass = "block text-sm font-medium text-[var(--color-charcoal)] mb-1.5"
  const selectClass = "appearance-none w-full px-4 py-2.5 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] pr-10"

  // Calculate total items
  const totalItems = lines.reduce((sum, l) => sum + (l.productMasterId ? l.quantity : 0), 0)

  // Show loading state for edit mode
  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 relative">
          <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
          <div className="absolute inset-0 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href={isEditMode ? `/${locale}/dashboard/outbound/${editingOutboundId}` : `/${locale}/dashboard/outbound`}
          className="inline-flex items-center gap-1 text-sm text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] font-medium transition-colors mb-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {locale === 'th' ? (isEditMode ? 'กลับหน้ารายละเอียด' : 'กลับหน้ารายการ') : (isEditMode ? 'Back to detail' : 'Back to list')}
        </Link>
        <h1 className="text-display text-2xl font-bold text-[var(--color-charcoal)]">
          {locale === 'th' ? (isEditMode ? 'แก้ไขใบส่งสินค้า' : 'สร้างใบส่งสินค้าใหม่') : (isEditMode ? 'Edit Outbound' : 'Create New Outbound')}
        </h1>
        <p className="text-[var(--color-foreground-muted)] mt-1">
          {isEditMode
            ? (locale === 'th' ? 'แก้ไขข้อมูลใบส่งสินค้า' : 'Edit outbound information')
            : (locale === 'th' ? 'เลือกสินค้าตาม SKU และจำนวน ระบบจะเลือก Serial ตามหลัก FIFO อัตโนมัติ' : 'Select products by SKU and quantity. System will auto-select serials using FIFO.')
          }
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-6 mb-6">
          <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-5">
            {locale === 'th' ? 'ข้อมูลการจัดส่ง' : 'Shipping Information'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className={labelClass}>
                {locale === 'th' ? 'คลังต้นทาง' : 'Warehouse'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(parseInt(e.target.value))}
                  required
                  className={selectClass}
                >
                  <option value={0} disabled>{locale === 'th' ? '-- เลือกคลัง --' : '-- Select --'}</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
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
              <label className={labelClass}>
                {locale === 'th' ? 'วิธีการส่ง' : 'Shipping Method'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={shippingMethodId}
                  onChange={(e) => setShippingMethodId(parseInt(e.target.value))}
                  required
                  className={selectClass}
                >
                  <option value={0} disabled>{locale === 'th' ? '-- เลือกวิธีส่ง --' : '-- Select --'}</option>
                  {shippingMethods.map((s) => (
                    <option key={s.id} value={s.id}>{s.nameTh}</option>
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
              <label className={labelClass}>
                {locale === 'th' ? 'คลินิก/ลูกค้า' : 'Clinic'} <span className="text-red-500">*</span>
              </label>
              <div className="relative" ref={clinicDropdownRef}>
                {/* Selected value / Search input */}
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
                    <span className={clinicId ? 'text-[var(--color-charcoal)]' : 'text-[var(--color-foreground-muted)]'}>
                      {clinicDisplayText || (locale === 'th' ? '-- เลือกคลินิก --' : '-- Select --')}
                    </span>
                  )}
                </div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-foreground-muted)]">
                  <svg className={`w-5 h-5 transition-transform ${clinicDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Dropdown list */}
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
                          className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-[var(--color-off-white)] transition-colors ${
                            c.id === clinicId ? 'bg-[var(--color-gold)]/10 text-[var(--color-gold-dark)]' : 'text-[var(--color-charcoal)]'
                          }`}
                          onClick={() => {
                            setClinicId(c.id)
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

                {/* Hidden input for form validation */}
                <input type="hidden" name="clinicId" value={clinicId} required />
              </div>
            </div>

            {/* PO Dropdown - Show after clinic is selected */}
            <div>
              <label className={labelClass}>
                {locale === 'th' ? 'เลข PO' : 'PO No.'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={purchaseOrderId}
                  onChange={(e) => handlePOChange(parseInt(e.target.value))}
                  className={selectClass}
                  disabled={!clinicId || purchaseOrders.length === 0}
                >
                  <option value={0}>{locale === 'th' ? '-- เลือก PO --' : '-- Select PO --'}</option>
                  {purchaseOrders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.poNo} ({locale === 'th' ? 'คงเหลือ' : 'Remaining'}: {po.summary.totalRemaining})
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-foreground-muted)]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {clinicId > 0 && purchaseOrders.length === 0 && (
                <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
                  {locale === 'th' ? 'ไม่มี PO ที่รอส่งสำหรับคลินิกนี้' : 'No pending POs for this clinic'}
                </p>
              )}
              {!clinicId && (
                <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
                  {locale === 'th' ? 'กรุณาเลือกคลินิกก่อน' : 'Please select a clinic first'}
                </p>
              )}
            </div>
          </div>

          {/* Delivery Info - Show only after PO is selected */}
          {selectedPO && (
            <div className="mt-6 pt-6 border-t border-[var(--color-beige)]">
              <h3 className="text-md font-semibold text-[var(--color-charcoal)] mb-4">
                {locale === 'th' ? 'ข้อมูลการจัดส่ง (จาก PO)' : 'Delivery Info (from PO)'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div>
                  <label className={labelClass}>
                    IV No.
                  </label>
                  <input
                    type="text"
                    value={deliveryNoteNo}
                    onChange={(e) => setDeliveryNoteNo(e.target.value)}
                    placeholder={locale === 'th' ? 'เช่น OUT-2026-000001' : 'e.g. OUT-2026-000001'}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Contract No.
                  </label>
                  <input
                    type="text"
                    value={contractNo}
                    onChange={(e) => setContractNo(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    {locale === 'th' ? 'ชื่อพนักงานขาย' : 'Sales Person'}
                  </label>
                  <input
                    type="text"
                    value={salesPersonName}
                    onChange={(e) => setSalesPersonName(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    {locale === 'th' ? 'ช่องทางติดต่อบริษัท' : 'Company Contact'}
                  </label>
                  <input
                    type="text"
                    value={companyContact}
                    onChange={(e) => setCompanyContact(e.target.value)}
                    placeholder="Line ID / Phone / Email"
                    className={inputClass}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className={labelClass}>
                    {locale === 'th' ? 'ที่อยู่จัดส่ง' : 'Delivery Address'}
                  </label>
                  <input
                    type="text"
                    value={clinicAddress}
                    onChange={(e) => setClinicAddress(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    {locale === 'th' ? 'เบอร์โทรคลินิก' : 'Clinic Phone'}
                  </label>
                  <input
                    type="text"
                    value={clinicPhone}
                    onChange={(e) => setClinicPhone(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    {locale === 'th' ? 'อีเมลคลินิก' : 'Clinic Email'}
                  </label>
                  <input
                    type="email"
                    value={clinicEmail}
                    onChange={(e) => setClinicEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    {locale === 'th' ? 'ชื่อผู้รับสินค้า' : 'Contact Name'}
                  </label>
                  <input
                    type="text"
                    value={clinicContactName}
                    onChange={(e) => setClinicContactName(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="lg:col-span-3">
                  <label className={labelClass}>
                    {locale === 'th' ? 'หมายเหตุ' : 'Remarks'}
                  </label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={2}
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Selected PO Summary */}
          {selectedPO && (
            <div className="mt-5 p-4 bg-[var(--color-gold)]/10 border border-[var(--color-gold)]/30 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-gold)]/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[var(--color-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-gold-dark)]">
                    {locale === 'th' ? 'รายการจาก PO' : 'Items from PO'}: {selectedPO.poNo}
                  </h3>
                  <p className="text-xs text-[var(--color-gold-dark)]">
                    {locale === 'th' ? `คงเหลือ ${selectedPO.summary.totalRemaining} ชิ้น` : `${selectedPO.summary.totalRemaining} items remaining`}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {selectedPO.lines
                  .filter((l) => l.quantity > l.shippedQuantity)
                  .map((line) => (
                    <div key={line.productMasterId} className="flex justify-between items-center text-sm py-1.5 px-3 bg-white/50 rounded-lg">
                      <span className="text-[var(--color-charcoal)]">
                        {line.productMaster?.sku} - {locale === 'th' ? line.productMaster?.nameTh : (line.productMaster?.nameEn || line.productMaster?.nameTh)}
                        {line.productMaster?.modelSize && ` (${line.productMaster.modelSize})`}
                      </span>
                      <span className="font-semibold text-[var(--color-gold-dark)]">
                        {line.quantity - line.shippedQuantity} / {line.quantity} {locale === 'th' ? 'ชิ้น' : 'pcs'}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Product Selection by SKU + Quantity */}
        <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-6 mb-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-semibold text-[var(--color-charcoal)]">
              {locale === 'th' ? 'รายการสินค้า' : 'Line Items'}
            </h2>
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-mint)] text-white rounded-xl font-medium text-sm shadow-[0_4px_14px_rgba(115,207,199,0.3)] hover:bg-[var(--color-mint-dark)] hover:-translate-y-0.5 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {locale === 'th' ? 'เพิ่มรายการ' : 'Add Item'}
            </button>
          </div>

          <div className="space-y-4">
            {lines.map((line, index) => (
              <div key={line.id} className="border border-[var(--color-beige)] rounded-xl p-5 bg-[var(--color-off-white)]">
                <div className="flex justify-between items-center mb-4">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-gold)]/10 text-[var(--color-gold)] font-semibold text-sm">
                    #{index + 1}
                  </span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="flex items-center gap-1 text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {locale === 'th' ? 'ลบ' : 'Remove'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Product Selection */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-[var(--color-charcoal)] mb-1">
                      {locale === 'th' ? 'เลือกสินค้า' : 'Select Product'} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={line.productMasterId}
                        onChange={(e) => handleProductMasterChange(line.id, parseInt(e.target.value))}
                        required
                        className="appearance-none w-full px-3 py-2 text-sm bg-white border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all pr-8"
                      >
                        <option value={0} disabled>{locale === 'th' ? '-- เลือกสินค้า --' : '-- Select Product --'}</option>
                        {productMasters.map((pm) => {
                          const poRemaining = getPORemainingQty(pm.id)
                          return (
                            <option
                              key={pm.id}
                              value={pm.id}
                              disabled={pm.stats.inStock === 0}
                            >
                              {pm.sku} - {locale === 'th' ? pm.nameTh : (pm.nameEn || pm.nameTh)} {pm.modelSize ? `(${pm.modelSize})` : ''} [{locale === 'th' ? 'คงเหลือ' : 'Stock'}: {pm.stats.inStock}]{poRemaining > 0 ? ` [${locale === 'th' ? 'จาก PO' : 'From PO'}: ${poRemaining}]` : ''}
                            </option>
                          )
                        })}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-foreground-muted)]">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {/* Show selected product info */}
                    {line.productMaster && (
                      <div className="mt-1.5 text-xs text-[var(--color-foreground-muted)]">
                        {locale === 'th' ? 'หมวดหมู่' : 'Category'}: {line.productMaster.category?.nameTh || '-'}
                        {line.productMaster.defaultUnit && ` | ${locale === 'th' ? 'หน่วย' : 'Unit'}: ${line.productMaster.defaultUnit.nameTh}`}
                        {getPORemainingQty(line.productMaster.id) > 0 && (
                          <span className="ml-2 text-[var(--color-gold)]">
                            | {locale === 'th' ? 'จาก PO' : 'From PO'}: {getPORemainingQty(line.productMaster.id)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-charcoal)] mb-1">
                      {locale === 'th' ? 'จำนวน' : 'Quantity'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={line.productMaster?.stats.inStock || 999}
                      value={line.quantity}
                      onChange={(e) => {
                        const qty = parseInt(e.target.value) || 1
                        const maxQty = line.productMaster?.stats.inStock || 999
                        updateLine(line.id, 'quantity', Math.min(qty, maxQty))
                      }}
                      required
                      className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all"
                    />
                    {line.productMaster && (
                      <div className="mt-1.5 text-xs text-[var(--color-mint-dark)]">
                        {locale === 'th' ? 'สูงสุด' : 'Max'}: {line.productMaster.stats.inStock} {locale === 'th' ? 'ชิ้น' : 'items'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-4 p-4 bg-[var(--color-mint)]/10 border border-[var(--color-mint)]/30 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-mint)]/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--color-mint-dark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-[var(--color-mint-dark)] font-medium">
                  {locale === 'th'
                    ? `รวม ${totalItems} ชิ้น จาก ${lines.filter(l => l.productMasterId).length} รายการ`
                    : `Total ${totalItems} items from ${lines.filter(l => l.productMasterId).length} line(s)`}
                </p>
                <p className="text-xs text-[var(--color-mint-dark)] mt-0.5">
                  {locale === 'th'
                    ? 'ระบบจะเลือก Serial อัตโนมัติตามหลัก FIFO (เก่าก่อน)'
                    : 'System will auto-select serials using FIFO (oldest first)'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 text-sm font-medium text-[var(--color-charcoal)] bg-white border border-[var(--color-beige)] rounded-xl hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] transition-all duration-200"
          >
            {locale === 'th' ? 'ยกเลิก' : 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={loading || totalItems === 0}
            className="flex items-center gap-2 px-6 py-3 text-sm font-medium bg-[var(--color-mint)] text-white rounded-xl shadow-[0_4px_14px_rgba(115,207,199,0.3)] hover:bg-[var(--color-mint-dark)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(115,207,199,0.4)] disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-200"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {locale === 'th' ? 'กำลังบันทึก...' : 'Saving...'}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isEditMode ? "M5 13l4 4L19 7" : "M17 8l4 4m0 0l-4 4m4-4H3"} />
                </svg>
                {locale === 'th' ? (isEditMode ? 'บันทึกการแก้ไข' : 'ส่งเพื่อขออนุมัติ') : (isEditMode ? 'Save Changes' : 'Submit for Approval')}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
