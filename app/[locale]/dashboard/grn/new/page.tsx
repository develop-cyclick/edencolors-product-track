'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface ProductMaster {
  id: number
  sku: string
  nameTh: string
  nameEn: string | null
  modelSize: string | null
  categoryId: number
  category: { id: number; nameTh: string; nameEn: string | null }
  defaultUnitId: number | null
  defaultUnit: { id: number; nameTh: string; nameEn: string | null } | null
}

interface Unit {
  id: number
  nameTh: string
  nameEn: string | null
}

interface Warehouse {
  id: number
  name: string
}

interface LineItem {
  id: string
  productMasterId: number
  productMaster: ProductMaster | null  // Store selected product info
  quantity: number
  unitId: number
  lot: string
  mfgDate: string
  expDate: string
  inspectionStatus: string
  remarks: string
}

export default function NewGRNPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string

  const [loading, setLoading] = useState(false)
  const [productMasters, setProductMasters] = useState<ProductMaster[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])

  // Form state
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().split('T')[0])
  const [warehouseId, setWarehouseId] = useState<number>(0)
  const [poNo, setPoNo] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [deliveryNoteNo, setDeliveryNoteNo] = useState('')
  const [supplierAddress, setSupplierAddress] = useState('')
  const [supplierPhone, setSupplierPhone] = useState('')
  const [supplierContact, setSupplierContact] = useState('')
  const [deliveryDocDate, setDeliveryDocDate] = useState('')
  const [remarks, setRemarks] = useState('')

  const [lines, setLines] = useState<LineItem[]>([
    {
      id: crypto.randomUUID(),
      productMasterId: 0,
      productMaster: null,
      quantity: 1,
      unitId: 0,
      lot: '',
      mfgDate: '',
      expDate: '',
      inspectionStatus: 'OK',
      remarks: '',
    },
  ])

  useEffect(() => {
    // Fetch master data
    Promise.all([
      fetch('/api/admin/masters/products').then((r) => r.json()),
      fetch('/api/admin/masters/units').then((r) => r.json()),
      fetch('/api/admin/masters/warehouses').then((r) => r.json()),
    ]).then(([pmRes, unitRes, whRes]) => {
      if (pmRes.success && pmRes.data?.productMasters) setProductMasters(pmRes.data.productMasters)
      if (unitRes.success && unitRes.data?.units) setUnits(unitRes.data.units)
      if (whRes.success && whRes.data?.warehouses) {
        setWarehouses(whRes.data.warehouses)
        if (whRes.data.warehouses.length > 0) setWarehouseId(whRes.data.warehouses[0].id)
      }
    })
  }, [])

  const addLine = () => {
    setLines([
      ...lines,
      {
        id: crypto.randomUUID(),
        productMasterId: 0,
        productMaster: null,
        quantity: 1,
        unitId: 0,
        lot: '',
        mfgDate: '',
        expDate: '',
        inspectionStatus: 'OK',
        remarks: '',
      },
    ])
  }

  const removeLine = (id: string) => {
    if (lines.length > 1) {
      setLines(lines.filter((l) => l.id !== id))
    }
  }

  const updateLine = (id: string, field: string, value: any) => {
    setLines(lines.map((l) => (l.id === id ? { ...l, [field]: value } : l)))
  }

  // Handle ProductMaster selection - auto-fill unit
  const handleProductMasterChange = (lineId: string, productMasterId: number) => {
    const pm = productMasters.find((p) => p.id === productMasterId) || null
    setLines(lines.map((l) => {
      if (l.id === lineId) {
        return {
          ...l,
          productMasterId,
          productMaster: pm,
          unitId: pm?.defaultUnitId || l.unitId || units[0]?.id || 0,
        }
      }
      return l
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate all lines have ProductMaster selected
    const invalidLines = lines.filter((l) => !l.productMasterId)
    if (invalidLines.length > 0) {
      alert(locale === 'th' ? 'กรุณาเลือกสินค้าให้ครบทุกรายการ' : 'Please select product for all lines')
      return
    }

    // Validate all selected ProductMasters have unit defined
    const noUnitLines = lines.filter((l) => !l.productMaster?.defaultUnitId)
    if (noUnitLines.length > 0) {
      alert(locale === 'th' ? 'สินค้าบางรายการยังไม่มีการกำหนดหน่วย กรุณาไปกำหนดที่หน้าจัดการสินค้าก่อน' : 'Some products have no unit defined. Please set unit in product management first.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/warehouse/grn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivedAt,
          warehouseId,
          poNo: poNo || null,
          supplierName,
          deliveryNoteNo: deliveryNoteNo || null,
          supplierAddress: supplierAddress || null,
          supplierPhone: supplierPhone || null,
          supplierContact: supplierContact || null,
          deliveryDocDate: deliveryDocDate || null,
          remarks: remarks || null,
          lines: lines.map((l) => ({
            productMasterId: l.productMasterId,
            quantity: l.quantity,
            unitId: l.unitId,
            lot: l.lot || null,
            mfgDate: l.mfgDate || null,
            expDate: l.expDate || null,
            inspectionStatus: l.inspectionStatus,
            remarks: l.remarks || null,
          })),
        }),
      })

      const data = await res.json()
      if (data.success) {
        alert(
          locale === 'th'
            ? `สร้างใบรับสินค้าสำเร็จ!\nGRN No: ${data.data.grnNo}\nจำนวน: ${data.data.linesCreated} รายการ`
            : `GRN created!\nGRN No: ${data.data.grnNo}\nItems: ${data.data.linesCreated}`
        )
        router.push(`/${locale}/dashboard/grn/${data.data.id}`)
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      alert('Failed to create GRN')
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
          href={`/${locale}/dashboard/grn`}
          className="inline-flex items-center gap-1 text-sm text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] font-medium transition-colors mb-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {locale === 'th' ? 'กลับหน้ารายการ' : 'Back to list'}
        </Link>
        <h1 className="text-display text-2xl font-bold text-[var(--color-charcoal)]">
          {locale === 'th' ? 'สร้างใบรับสินค้าใหม่' : 'Create New GRN'}
        </h1>
        <p className="text-[var(--color-foreground-muted)] mt-1">
          {locale === 'th' ? 'กรอกข้อมูลการรับสินค้าเข้าคลัง' : 'Fill in goods receipt information'}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-6 mb-6">
          <h2 className="text-lg font-semibold text-[var(--color-charcoal)] mb-5">
            {locale === 'th' ? 'ข้อมูลทั่วไป' : 'General Information'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className={labelClass}>
                {locale === 'th' ? 'วันที่รับสินค้า' : 'Received Date'} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                {locale === 'th' ? 'คลังสินค้า' : 'Warehouse'} <span className="text-red-500">*</span>
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
              <label className={labelClass}>PO No.</label>
              <input
                type="text"
                value={poNo}
                onChange={(e) => setPoNo(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                {locale === 'th' ? 'ชื่อผู้ขาย/บริษัท' : 'Supplier Name'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Delivery Note No.</label>
              <input
                type="text"
                value={deliveryNoteNo}
                onChange={(e) => setDeliveryNoteNo(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                {locale === 'th' ? 'วันที่เอกสารส่งสินค้า' : 'Delivery Doc Date'}
              </label>
              <input
                type="date"
                value={deliveryDocDate}
                onChange={(e) => setDeliveryDocDate(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                {locale === 'th' ? 'ที่อยู่ผู้จัดส่ง' : 'Supplier Address'}
              </label>
              <input
                type="text"
                value={supplierAddress}
                onChange={(e) => setSupplierAddress(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                {locale === 'th' ? 'เบอร์โทรผู้จัดส่ง' : 'Supplier Phone'}
              </label>
              <input
                type="text"
                value={supplierPhone}
                onChange={(e) => setSupplierPhone(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                {locale === 'th' ? 'ชื่อผู้ติดต่อ' : 'Contact Person'}
              </label>
              <input
                type="text"
                value={supplierContact}
                onChange={(e) => setSupplierContact(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
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

        {/* Lines Section */}
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Product Master Dropdown - spans 2 columns */}
                  <div className="lg:col-span-2">
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
                        {productMasters.map((pm) => (
                          <option key={pm.id} value={pm.id} disabled={!pm.defaultUnitId}>
                            {pm.sku} - {locale === 'th' ? pm.nameTh : (pm.nameEn || pm.nameTh)} {pm.modelSize ? `(${pm.modelSize})` : ''} {!pm.defaultUnitId ? (locale === 'th' ? '[ไม่มีหน่วย]' : '[No unit]') : ''}
                          </option>
                        ))}
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
                        {line.productMaster.modelSize && ` | ${locale === 'th' ? 'ขนาด' : 'Size'}: ${line.productMaster.modelSize}`}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--color-charcoal)] mb-1">
                      {locale === 'th' ? 'จำนวน' : 'Quantity'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, 'quantity', parseInt(e.target.value) || 1)}
                      required
                      className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--color-charcoal)] mb-1">
                      {locale === 'th' ? 'หน่วย' : 'Unit'}
                    </label>
                    <div className="w-full px-3 py-2 text-sm bg-gray-50 border border-[var(--color-beige)] rounded-lg text-[var(--color-charcoal)]">
                      {line.productMaster?.defaultUnit
                        ? (locale === 'th' ? line.productMaster.defaultUnit.nameTh : line.productMaster.defaultUnit.nameEn)
                        : <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'เลือกสินค้าก่อน' : 'Select product first'}</span>
                      }
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--color-charcoal)] mb-1">Lot/Batch</label>
                    <input
                      type="text"
                      value={line.lot}
                      onChange={(e) => updateLine(line.id, 'lot', e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--color-charcoal)] mb-1">MFG Date</label>
                    <input
                      type="date"
                      value={line.mfgDate}
                      onChange={(e) => updateLine(line.id, 'mfgDate', e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--color-charcoal)] mb-1">EXP Date</label>
                    <input
                      type="date"
                      value={line.expDate}
                      onChange={(e) => updateLine(line.id, 'expDate', e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--color-charcoal)] mb-1">
                      {locale === 'th' ? 'สถานะตรวจ' : 'Inspection'}
                    </label>
                    <div className="relative">
                      <select
                        value={line.inspectionStatus}
                        onChange={(e) => updateLine(line.id, 'inspectionStatus', e.target.value)}
                        className="appearance-none w-full px-3 py-2 text-sm bg-white border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all pr-8"
                      >
                        <option value="OK">OK - {locale === 'th' ? 'ถูกต้องครบถ้วน' : 'Complete'}</option>
                        <option value="DAMAGED">{locale === 'th' ? 'เสียหาย' : 'Damaged'}</option>
                        <option value="CLAIM">{locale === 'th' ? 'เคลม' : 'Claim'}</option>
                        <option value="BROKEN">{locale === 'th' ? 'แตก' : 'Broken'}</option>
                        <option value="INCOMPLETE">{locale === 'th' ? 'ไม่ครบ' : 'Incomplete'}</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-foreground-muted)]">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block text-xs font-medium text-[var(--color-charcoal)] mb-1">
                      {locale === 'th' ? 'หมายเหตุ' : 'Remarks'}
                    </label>
                    <input
                      type="text"
                      value={line.remarks}
                      onChange={(e) => updateLine(line.id, 'remarks', e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 bg-[var(--color-mint)]/10 border border-[var(--color-mint)]/30 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-mint)]/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--color-mint-dark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-[var(--color-mint-dark)]">
                {locale === 'th'
                  ? `จะสร้าง ${lines.reduce((sum, l) => sum + l.quantity, 0)} Serial Numbers (1 Serial ต่อ 1 หน่วยสินค้า)`
                  : `Will create ${lines.reduce((sum, l) => sum + l.quantity, 0)} Serial Numbers (1 Serial per unit)`}
              </p>
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
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 text-sm font-medium bg-[var(--color-gold)] text-white rounded-xl shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(201,163,90,0.35)] disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-200"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {locale === 'th' ? 'กำลังบันทึก...' : 'Saving...'}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {locale === 'th' ? 'บันทึกและสร้าง Serial' : 'Save & Generate Serials'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
