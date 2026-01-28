'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

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

interface Reservation {
  productMasterId: number
  quantity: number
  productMaster?: ProductMaster | null
}

interface LineItem {
  id: string
  productMasterId: number
  productMaster: ProductMaster | null
  quantity: number
}

interface SelectedProduct {
  productItemId: number
  serial12: string
  sku: string
  name: string
  modelSize: string | null
  lot: string | null
  expDate: string | null
  unitId: number
}

export default function NewOutboundPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string

  const [loading, setLoading] = useState(false)
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [productMasters, setProductMasters] = useState<ProductMaster[]>([])
  const [clinicReservations, setClinicReservations] = useState<Reservation[]>([])

  // Clinic search dropdown state
  const [clinicSearch, setClinicSearch] = useState('')
  const [clinicDropdownOpen, setClinicDropdownOpen] = useState(false)
  const clinicDropdownRef = useRef<HTMLDivElement>(null)

  // Form state
  const [warehouseId, setWarehouseId] = useState<number>(0)
  const [shippingMethodId, setShippingMethodId] = useState<number>(0)
  const [clinicId, setClinicId] = useState<number>(0)
  const [salesPersonName, setSalesPersonName] = useState('')
  const [companyContact, setCompanyContact] = useState('')
  const [clinicAddress, setClinicAddress] = useState('')
  const [clinicPhone, setClinicPhone] = useState('')
  const [clinicEmail, setClinicEmail] = useState('')
  const [clinicContactName, setClinicContactName] = useState('')
  const [poNo, setPoNo] = useState('')
  const [remarks, setRemarks] = useState('')

  // Line items - select by SKU + quantity
  const [lines, setLines] = useState<LineItem[]>([
    { id: crypto.randomUUID(), productMasterId: 0, productMaster: null, quantity: 1 }
  ])

  // Selected products (FIFO result from API)
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])

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
    })
  }, [])

  useEffect(() => {
    // Update address when clinic changes
    const clinic = clinics.find((c) => c.id === clinicId)
    if (clinic) {
      setClinicAddress(`${clinic.name}, ${clinic.province}${clinic.branchName ? ` (${clinic.branchName})` : ''}`)
    }
  }, [clinicId, clinics])

  // Fetch reservations when clinic changes
  useEffect(() => {
    if (clinicId) {
      fetch(`/api/admin/clinics/${clinicId}/reservations`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data?.reservations) {
            setClinicReservations(res.data.reservations)
          } else {
            setClinicReservations([])
          }
        })
        .catch(() => setClinicReservations([]))
    } else {
      setClinicReservations([])
    }
  }, [clinicId])

  // Helper to get reservation quantity for a ProductMaster
  const getReservationQty = (productMasterId: number) => {
    const reservation = clinicReservations.find((r) => r.productMasterId === productMasterId)
    return reservation?.quantity || 0
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
      alert(locale === 'th' ? 'กรุณาเลือกสินค้าและระบุจำนวนให้ครบทุกรายการ' : 'Please select product and quantity for all lines')
      return
    }

    // Check stock availability
    for (const line of lines) {
      if (line.productMaster && line.quantity > line.productMaster.stats.inStock) {
        alert(locale === 'th'
          ? `สินค้า ${line.productMaster.sku} มีในคลังไม่เพียงพอ (ต้องการ ${line.quantity}, มี ${line.productMaster.stats.inStock})`
          : `Insufficient stock for ${line.productMaster.sku} (need ${line.quantity}, have ${line.productMaster.stats.inStock})`)
        return
      }
    }

    if (!clinicId) {
      alert(locale === 'th' ? 'กรุณาเลือกคลินิก' : 'Please select a clinic')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/warehouse/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId,
          shippingMethodId,
          clinicId,
          salesPersonName: salesPersonName || null,
          companyContact: companyContact || null,
          clinicAddress: clinicAddress || null,
          clinicPhone: clinicPhone || null,
          clinicEmail: clinicEmail || null,
          clinicContactName: clinicContactName || null,
          poNo: poNo || null,
          remarks: remarks || null,
          // Send productMasterId + quantity, API will do FIFO selection
          linesByProductMaster: lines.map((l) => ({
            productMasterId: l.productMasterId,
            quantity: l.quantity,
          })),
        }),
      })

      const data = await res.json()
      if (data.success) {
        alert(
          locale === 'th'
            ? `สร้างใบส่งสินค้าสำเร็จ!\nDelivery No: ${data.data.deliveryNoteNo}\nจำนวน: ${data.data.linesCreated} รายการ`
            : `Outbound created!\nDelivery No: ${data.data.deliveryNoteNo}\nItems: ${data.data.linesCreated}`
        )
        router.push(`/${locale}/dashboard/outbound/${data.data.id}`)
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      alert('Failed to create outbound')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full px-4 py-2.5 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
  const labelClass = "block text-sm font-medium text-[var(--color-charcoal)] mb-1.5"
  const selectClass = "appearance-none w-full px-4 py-2.5 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] pr-10"

  // Calculate total items
  const totalItems = lines.reduce((sum, l) => sum + (l.productMasterId ? l.quantity : 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/${locale}/dashboard/outbound`}
          className="inline-flex items-center gap-1 text-sm text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] font-medium transition-colors mb-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {locale === 'th' ? 'กลับหน้ารายการ' : 'Back to list'}
        </Link>
        <h1 className="text-display text-2xl font-bold text-[var(--color-charcoal)]">
          {locale === 'th' ? 'สร้างใบส่งสินค้าใหม่' : 'Create New Outbound'}
        </h1>
        <p className="text-[var(--color-foreground-muted)] mt-1">
          {locale === 'th' ? 'เลือกสินค้าตาม SKU และจำนวน ระบบจะเลือก Serial ตามหลัก FIFO อัตโนมัติ' : 'Select products by SKU and quantity. System will auto-select serials using FIFO.'}
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

            <div>
              <label className={labelClass}>PO No.</label>
              <input
                type="text"
                value={poNo}
                onChange={(e) => setPoNo(e.target.value)}
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

          {/* Clinic Reservations Summary */}
          {clinicId > 0 && clinicReservations.length > 0 && (
            <div className="mt-5 p-4 bg-[var(--color-gold)]/10 border border-[var(--color-gold)]/30 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-gold)]/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[var(--color-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-gold-dark)]">
                  {locale === 'th' ? 'สินค้าฝากของคลินิกนี้' : 'Reserved Products for this Clinic'}
                </h3>
              </div>
              <div className="space-y-2">
                {clinicReservations.map((res) => {
                  const pm = productMasters.find((p) => p.id === res.productMasterId) || res.productMaster
                  if (!pm) return null
                  return (
                    <div key={res.productMasterId} className="flex justify-between items-center text-sm py-1.5 px-3 bg-white/50 rounded-lg">
                      <span className="text-[var(--color-charcoal)]">
                        {pm.sku} - {locale === 'th' ? pm.nameTh : ((pm as any).nameEn || pm.nameTh)}
                        {pm.modelSize && ` (${pm.modelSize})`}
                      </span>
                      <span className="font-semibold text-[var(--color-gold-dark)]">
                        {res.quantity} {locale === 'th' ? 'ชิ้น' : 'pcs'}
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-[var(--color-gold-dark)] mt-3">
                {locale === 'th'
                  ? 'สินค้าฝาก: คือสินค้าที่คลินิกจองไว้ล่วงหน้าแต่ยังไม่ได้ส่ง'
                  : 'Reserved: Products pre-ordered by the clinic but not yet shipped'}
              </p>
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
                          const reservedQty = getReservationQty(pm.id)
                          return (
                            <option
                              key={pm.id}
                              value={pm.id}
                              disabled={pm.stats.inStock === 0}
                            >
                              {pm.sku} - {locale === 'th' ? pm.nameTh : (pm.nameEn || pm.nameTh)} {pm.modelSize ? `(${pm.modelSize})` : ''} [{locale === 'th' ? 'คงเหลือ' : 'Stock'}: {pm.stats.inStock}]{reservedQty > 0 ? ` [${locale === 'th' ? 'ฝาก' : 'Reserved'}: ${reservedQty}]` : ''}
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
                        {getReservationQty(line.productMaster.id) > 0 && (
                          <span className="ml-2 text-[var(--color-gold)]">
                            | {locale === 'th' ? 'สินค้าฝาก' : 'Reserved'}: {getReservationQty(line.productMaster.id)}
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
                {locale === 'th' ? 'กำลังส่ง...' : 'Submitting...'}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                {locale === 'th' ? 'ส่งเพื่อขออนุมัติ' : 'Submit for Approval'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
