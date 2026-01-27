'use client'

import { useEffect, useState } from 'react'
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

interface Product {
  id: number
  serial12: string
  sku: string
  name: string
  modelSize: string | null
  lot: string | null
  expDate: string | null
  status: string
  category: { nameTh: string }
  grnLine: {
    unitId: number
    unit: { id: number; nameTh: string }
  } | null
}

export default function NewOutboundPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string

  const [loading, setLoading] = useState(false)
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(false)

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

  const [selectedProducts, setSelectedProducts] = useState<Product[]>([])

  useEffect(() => {
    // Fetch master data
    Promise.all([
      fetch('/api/admin/clinics').then((r) => r.json()),
      fetch('/api/admin/masters/shipping-methods').then((r) => r.json()),
      fetch('/api/admin/masters/warehouses').then((r) => r.json()),
    ]).then(([clinicRes, shippingRes, whRes]) => {
      if (clinicRes.success && clinicRes.data?.clinics) setClinics(clinicRes.data.clinics)
      if (shippingRes.success && shippingRes.data?.shippingMethods) {
        setShippingMethods(shippingRes.data.shippingMethods)
        if (shippingRes.data.shippingMethods.length > 0) setShippingMethodId(shippingRes.data.shippingMethods[0].id)
      }
      if (whRes.success && whRes.data?.warehouses) {
        setWarehouses(whRes.data.warehouses)
        if (whRes.data.warehouses.length > 0) setWarehouseId(whRes.data.warehouses[0].id)
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

  // Load available products initially
  useEffect(() => {
    const loadInitialProducts = async () => {
      setLoadingProducts(true)
      try {
        const res = await fetch('/api/warehouse/products?available=true&limit=50')
        const data = await res.json()
        if (data.success && data.data?.items) {
          setAvailableProducts(data.data.items)
        }
      } catch (error) {
        console.error('Failed to load products:', error)
      } finally {
        setLoadingProducts(false)
      }
    }
    loadInitialProducts()
  }, [])

  const searchProducts = async () => {
    setLoadingProducts(true)
    try {
      const params = new URLSearchParams({
        available: 'true',
        limit: '50',
        ...(productSearch.trim() && { search: productSearch.trim() }),
      })
      const res = await fetch(`/api/warehouse/products?${params}`)
      const data = await res.json()
      if (data.success && data.data?.items) {
        // Filter out already selected products
        const selectedIds = new Set(selectedProducts.map((p) => p.id))
        setAvailableProducts(data.data.items.filter((p: Product) => !selectedIds.has(p.id)))
      }
    } catch (error) {
      console.error('Failed to search products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const addProduct = (product: Product) => {
    setSelectedProducts([...selectedProducts, product])
    setAvailableProducts(availableProducts.filter((p) => p.id !== product.id))
  }

  const removeProduct = (productId: number) => {
    setSelectedProducts(selectedProducts.filter((p) => p.id !== productId))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedProducts.length === 0) {
      alert(locale === 'th' ? 'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ' : 'Please select at least 1 product')
      return
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
          lines: selectedProducts.map((p) => ({
            productItemId: p.id,
            sku: p.sku,
            itemName: p.name,
            modelSize: p.modelSize,
            unitId: p.grnLine?.unitId || 1,
            lot: p.lot,
            expDate: p.expDate,
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
          {locale === 'th' ? 'กรอกข้อมูลการส่งสินค้าออกจากคลัง' : 'Fill in outbound delivery information'}
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
              <div className="relative">
                <select
                  value={clinicId}
                  onChange={(e) => setClinicId(parseInt(e.target.value))}
                  required
                  className={selectClass}
                >
                  <option value={0} disabled>{locale === 'th' ? '-- เลือกคลินิก --' : '-- Select --'}</option>
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
        </div>

        {/* Product Selection */}
        <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-6 mb-6">
          <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-5">
            {locale === 'th' ? 'เลือกสินค้า' : 'Select Products'}
          </h2>

          {/* Search */}
          <div className="flex gap-3 mb-5">
            <div className="relative flex-1">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-foreground-muted)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchProducts())}
                placeholder={locale === 'th' ? 'ค้นหา Serial, SKU, ชื่อสินค้า...' : 'Search Serial, SKU, Name...'}
                className="w-full pl-12 pr-4 py-3 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
              />
            </div>
            <button
              type="button"
              onClick={searchProducts}
              disabled={loadingProducts}
              className="flex items-center gap-2 px-6 py-3 bg-[var(--color-gold)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(201,163,90,0.35)] disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-200"
            >
              {loadingProducts ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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

          {/* Available Products */}
          <div className="border border-[var(--color-beige)] rounded-xl overflow-hidden mb-5">
            <div className="bg-[var(--color-off-white)] px-5 py-3 text-sm font-medium text-[var(--color-charcoal)] border-b border-[var(--color-beige)] flex items-center justify-between">
              <span>{locale === 'th' ? 'สินค้าที่พร้อมส่ง' : 'Available Products'} ({availableProducts.length})</span>
              {loadingProducts && (
                <div className="w-4 h-4 border-2 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            {loadingProducts && availableProducts.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-10 h-10 mx-auto mb-3 relative">
                  <div className="absolute inset-0 rounded-full border-3 border-[var(--color-beige)]" />
                  <div className="absolute inset-0 rounded-full border-3 border-[var(--color-gold)] border-t-transparent animate-spin" />
                </div>
                <p className="text-[var(--color-foreground-muted)] text-sm">
                  {locale === 'th' ? 'กำลังโหลดสินค้า...' : 'Loading products...'}
                </p>
              </div>
            ) : availableProducts.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-[var(--color-foreground-muted)]">
                  {locale === 'th' ? 'ไม่พบสินค้าที่พร้อมส่ง (สถานะ IN_STOCK)' : 'No available products (IN_STOCK status)'}
                </p>
                <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
                  {locale === 'th' ? 'ตรวจสอบว่ามีสินค้าในคลังหรือไม่' : 'Please check if there are products in stock'}
                </p>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto">
                {availableProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-beige)] last:border-b-0 hover:bg-[var(--color-off-white)]/50 transition-colors"
                  >
                    <div className="flex-1">
                      <span className="font-mono text-sm text-[var(--color-gold)] font-medium">{p.serial12}</span>
                      <span className="mx-2 text-[var(--color-beige)]">|</span>
                      <span className="text-sm text-[var(--color-charcoal)]">{p.sku} - {p.name}</span>
                      {p.lot && <span className="text-xs text-[var(--color-foreground-muted)] ml-2">Lot: {p.lot}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => addProduct(p)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[var(--color-mint-dark)] hover:text-white hover:bg-[var(--color-mint)] rounded-lg transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {locale === 'th' ? 'เพิ่ม' : 'Add'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Products */}
          <div className="border border-[var(--color-mint)]/30 rounded-xl overflow-hidden">
            <div className="bg-[var(--color-mint)]/10 px-5 py-3 text-sm font-medium text-[var(--color-mint-dark)] border-b border-[var(--color-mint)]/20">
              {locale === 'th' ? `สินค้าที่เลือก (${selectedProducts.length})` : `Selected Products (${selectedProducts.length})`}
            </div>
            {selectedProducts.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-beige)]/50 flex items-center justify-center">
                  <svg className="w-8 h-8 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <p className="text-[var(--color-foreground-muted)]">
                  {locale === 'th' ? 'ยังไม่ได้เลือกสินค้า' : 'No products selected'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                      <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">Serial</th>
                      <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">SKU</th>
                      <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                        {locale === 'th' ? 'ชื่อสินค้า' : 'Name'}
                      </th>
                      <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">Lot</th>
                      <th className="px-5 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">EXP</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-beige)]">
                    {selectedProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-[var(--color-off-white)]/50 transition-colors">
                        <td className="px-5 py-3">
                          <span className="font-mono text-sm font-medium text-[var(--color-gold)]">{p.serial12}</span>
                        </td>
                        <td className="px-5 py-3 text-sm text-[var(--color-charcoal)]">{p.sku}</td>
                        <td className="px-5 py-3 text-sm text-[var(--color-charcoal)]">{p.name}</td>
                        <td className="px-5 py-3 text-sm text-[var(--color-foreground-muted)]">{p.lot || '-'}</td>
                        <td className="px-5 py-3 text-sm text-[var(--color-foreground-muted)]">
                          {p.expDate ? new Date(p.expDate).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US') : '-'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeProduct(p.id)}
                            className="flex items-center gap-1 text-sm font-medium text-red-500 hover:text-red-700 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            {locale === 'th' ? 'ลบ' : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
            disabled={loading || selectedProducts.length === 0}
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
