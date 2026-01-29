'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { QRScanner } from '@/components/ui/qr-scanner'

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

interface PreGenItem {
  id: number
  serial12: string
  batchNo: string | null
  batchId: number | null
  createdAt: string
}

interface ScannedItem {
  productItemId: number
  serial12: string
  batchNo: string | null
  scannedAt: Date
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
  usePreGen: boolean  // Toggle for using pre-generated QR
  preGeneratedItemIds: number[]  // Selected pre-gen item IDs
  scannedItems: ScannedItem[]  // Scanned items with serial info
}

export default function NewGRNPage() {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string

  const [loading, setLoading] = useState(false)
  const [productMasters, setProductMasters] = useState<ProductMaster[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [availablePreGenItems, setAvailablePreGenItems] = useState<PreGenItem[]>([])

  // Scanner modal state
  const [scannerModal, setScannerModal] = useState<{ lineId: string; targetQty: number } | null>(null)
  const [scannerInput, setScannerInput] = useState('')
  const [scannerError, setScannerError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera')
  const scannerInputRef = useRef<HTMLInputElement>(null)

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
      usePreGen: false,
      preGeneratedItemIds: [],
      scannedItems: [],
    },
  ])

  useEffect(() => {
    // Fetch master data
    Promise.all([
      fetch('/api/admin/masters/products').then((r) => r.json()),
      fetch('/api/admin/masters/units').then((r) => r.json()),
      fetch('/api/admin/masters/warehouses').then((r) => r.json()),
      fetch('/api/warehouse/pre-generate/available').then((r) => r.json()),
    ]).then(([pmRes, unitRes, whRes, preGenRes]) => {
      if (pmRes.success && pmRes.data?.productMasters) setProductMasters(pmRes.data.productMasters)
      if (unitRes.success && unitRes.data?.units) setUnits(unitRes.data.units)
      if (whRes.success && whRes.data?.warehouses) {
        setWarehouses(whRes.data.warehouses)
        if (whRes.data.warehouses.length > 0) setWarehouseId(whRes.data.warehouses[0].id)
      }
      if (preGenRes.success && preGenRes.data?.items) setAvailablePreGenItems(preGenRes.data.items)
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
        usePreGen: false,
        preGeneratedItemIds: [],
        scannedItems: [],
      },
    ])
  }

  const removeLine = (id: string) => {
    if (lines.length > 1) {
      setLines(lines.filter((l) => l.id !== id))
    }
  }

  const updateLine = (id: string, field: string, value: string | number | null) => {
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

  // Toggle pre-gen mode for a line
  const togglePreGenMode = (lineId: string) => {
    setLines(lines.map((l) => {
      if (l.id === lineId) {
        return {
          ...l,
          usePreGen: !l.usePreGen,
          preGeneratedItemIds: [],
          scannedItems: [],
          quantity: !l.usePreGen ? 0 : 1, // Reset quantity when toggling
        }
      }
      return l
    }))
  }

  // Open scanner modal for a line
  const openScannerModal = (lineId: string, targetQty: number) => {
    setScannerModal({ lineId, targetQty })
    setScannerInput('')
    setScannerError(null)
    // Focus input after modal opens
    setTimeout(() => scannerInputRef.current?.focus(), 100)
  }

  // Close scanner modal
  const closeScannerModal = () => {
    setScannerModal(null)
    setScannerInput('')
    setScannerError(null)
  }

  // Handle scanner input
  const handleScannerInput = useCallback(async (qrContent: string) => {
    console.log('handleScannerInput called with:', qrContent)

    if (!scannerModal || isScanning) {
      console.log('Skipping - modal:', !!scannerModal, 'isScanning:', isScanning)
      return
    }

    setIsScanning(true)
    setScannerError(null)

    try {
      const res = await fetch('/api/warehouse/pre-generate/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrContent }),
      })

      const data = await res.json()

      if (!data.success) {
        setScannerError(data.error || 'Invalid QR code')
        // Play error sound or vibrate
        return
      }

      const { productItemId, serial12, batchNo } = data.data

      // Check if already scanned in this line
      const currentLine = lines.find(l => l.id === scannerModal.lineId)
      if (currentLine?.scannedItems.some(item => item.productItemId === productItemId)) {
        setScannerError(locale === 'th' ? 'QR นี้ถูกสแกนไปแล้ว' : 'This QR was already scanned')
        return
      }

      // Check if scanned in other lines
      const isInOtherLines = lines.some(l =>
        l.id !== scannerModal.lineId &&
        l.scannedItems.some(item => item.productItemId === productItemId)
      )
      if (isInOtherLines) {
        setScannerError(locale === 'th' ? 'QR นี้ถูกใช้ในรายการอื่นแล้ว' : 'This QR is used in another line')
        return
      }

      // Add scanned item to the line
      setLines(lines.map((l) => {
        if (l.id === scannerModal.lineId) {
          const newScannedItems = [...l.scannedItems, {
            productItemId,
            serial12,
            batchNo,
            scannedAt: new Date(),
          }]
          return {
            ...l,
            scannedItems: newScannedItems,
            preGeneratedItemIds: newScannedItems.map(item => item.productItemId),
            quantity: newScannedItems.length,
          }
        }
        return l
      }))

      // Check if we've reached target quantity
      const updatedLine = lines.find(l => l.id === scannerModal.lineId)
      if (updatedLine && updatedLine.scannedItems.length + 1 >= scannerModal.targetQty) {
        // Play success sound
        setTimeout(() => closeScannerModal(), 500)
      }
    } catch (error) {
      console.error('Scan error:', error)
      setScannerError(locale === 'th' ? 'เกิดข้อผิดพลาดในการสแกน' : 'Scan error occurred')
    } finally {
      setIsScanning(false)
      setScannerInput('')
      // Refocus input for next scan
      setTimeout(() => scannerInputRef.current?.focus(), 50)
    }
  }, [scannerModal, lines, isScanning, locale])

  // Handle scanner input change (for handheld scanners that input text)
  const handleScannerInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setScannerInput(value)

    // Handheld scanners usually end with Enter or have a pattern
    // Check if it looks like a complete QR (URL or token)
    if (value.includes('verify?token=') || value.length > 50) {
      handleScannerInput(value)
    }
  }

  // Handle Enter key for manual input
  const handleScannerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && scannerInput.trim()) {
      e.preventDefault()
      handleScannerInput(scannerInput.trim())
    }
  }

  // Remove scanned item from line
  const removeScannedItem = (lineId: string, productItemId: number) => {
    setLines(lines.map((l) => {
      if (l.id === lineId) {
        const newScannedItems = l.scannedItems.filter(item => item.productItemId !== productItemId)
        return {
          ...l,
          scannedItems: newScannedItems,
          preGeneratedItemIds: newScannedItems.map(item => item.productItemId),
          quantity: newScannedItems.length,
        }
      }
      return l
    }))
  }

  // Get available pre-gen items (excluding already selected in other lines)
  const getAvailablePreGenItemsForLine = (lineId: string) => {
    const selectedInOtherLines = lines
      .filter(l => l.id !== lineId)
      .flatMap(l => l.preGeneratedItemIds)
    return availablePreGenItems.filter(item => !selectedInOtherLines.includes(item.id))
  }

  // Get current line's scanned items
  const getCurrentLineScannedItems = () => {
    if (!scannerModal) return []
    const line = lines.find(l => l.id === scannerModal.lineId)
    return line?.scannedItems || []
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

    // Validate pre-gen lines have items selected
    const emptyPreGenLines = lines.filter((l) => l.usePreGen && l.preGeneratedItemIds.length === 0)
    if (emptyPreGenLines.length > 0) {
      alert(locale === 'th' ? 'กรุณาเลือก QR ล่วงหน้าอย่างน้อย 1 รายการ' : 'Please select at least 1 pre-generated QR')
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
            quantity: l.usePreGen ? l.preGeneratedItemIds.length : l.quantity,
            unitId: l.unitId,
            lot: l.lot || null,
            mfgDate: l.mfgDate || null,
            expDate: l.expDate || null,
            inspectionStatus: l.inspectionStatus,
            remarks: l.remarks || null,
            preGeneratedItemIds: l.usePreGen ? l.preGeneratedItemIds : undefined,
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

                  {/* Pre-Gen Toggle & Quantity Section */}
                  <div className="lg:col-span-2">
                    {/* Pre-Gen Toggle */}
                    {availablePreGenItems.length > 0 && (
                      <div className="mb-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={line.usePreGen}
                            onChange={() => togglePreGenMode(line.id)}
                            className="w-4 h-4 rounded border-[var(--color-beige)] text-[var(--color-gold)] focus:ring-[var(--color-gold)] focus:ring-offset-0"
                          />
                          <span className="text-xs font-medium text-[var(--color-charcoal)]">
                            {locale === 'th' ? 'ใช้ QR ที่สร้างล่วงหน้า' : 'Use Pre-Generated QR'}
                          </span>
                          <span className="text-xs text-[var(--color-gold)]">
                            ({getAvailablePreGenItemsForLine(line.id).length} {locale === 'th' ? 'รายการพร้อมใช้' : 'available'})
                          </span>
                        </label>
                      </div>
                    )}

                    {/* Pre-Gen Scanner Mode */}
                    {line.usePreGen ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-medium text-[var(--color-charcoal)]">
                            {locale === 'th' ? 'สแกน QR' : 'Scan QR'} <span className="text-red-500">*</span>
                          </label>
                          <span className="text-xs text-[var(--color-gold)] font-medium">
                            {line.scannedItems.length} {locale === 'th' ? 'รายการ' : 'items'}
                          </span>
                        </div>

                        {/* Scan Button */}
                        <button
                          type="button"
                          onClick={() => openScannerModal(line.id, 0)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-gold)]/10 border-2 border-dashed border-[var(--color-gold)] rounded-lg text-[var(--color-gold)] hover:bg-[var(--color-gold)]/20 transition-all"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                          </svg>
                          {locale === 'th' ? 'คลิกเพื่อสแกน QR' : 'Click to Scan QR'}
                        </button>

                        {/* Scanned Items List */}
                        {line.scannedItems.length > 0 && (
                          <div className="mt-3 max-h-32 overflow-y-auto border border-[var(--color-beige)] rounded-lg bg-white divide-y divide-[var(--color-beige)]">
                            {line.scannedItems.map((item) => (
                              <div key={item.productItemId} className="flex items-center justify-between px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span className="font-mono text-xs text-[var(--color-charcoal)]">{item.serial12}</span>
                                  {item.batchNo && (
                                    <span className="text-[10px] text-[var(--color-foreground-muted)]">({item.batchNo})</span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeScannedItem(line.id, item.productItemId)}
                                  className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
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
                      </div>
                    )}
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

      {/* Scanner Modal */}
      {scannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeScannerModal}
          />

          {/* Modal Content */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="bg-[var(--color-gold)] px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {locale === 'th' ? 'สแกน QR Code' : 'Scan QR Code'}
                    </h3>
                    <p className="text-sm text-white/80">
                      {locale === 'th' ? 'สแกน QR ที่สร้างล่วงหน้า' : 'Scan pre-generated QR'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeScannerModal}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scanner Content */}
            <div className="p-6">
              {/* Mode Tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setScanMode('camera')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    scanMode === 'camera'
                      ? 'bg-[var(--color-gold)] text-white shadow-md'
                      : 'bg-[var(--color-off-white)] text-[var(--color-charcoal)] hover:bg-[var(--color-beige)]'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {locale === 'th' ? 'กล้อง' : 'Camera'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScanMode('manual')
                    setTimeout(() => scannerInputRef.current?.focus(), 100)
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    scanMode === 'manual'
                      ? 'bg-[var(--color-gold)] text-white shadow-md'
                      : 'bg-[var(--color-off-white)] text-[var(--color-charcoal)] hover:bg-[var(--color-beige)]'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  {locale === 'th' ? 'เครื่องสแกน' : 'Scanner'}
                </button>
              </div>

              {/* Camera Mode */}
              {scanMode === 'camera' && (
                <div className="mb-4">
                  <QRScanner
                    isActive={scanMode === 'camera' && !!scannerModal}
                    onScan={handleScannerInput}
                    onError={(err) => setScannerError(err)}
                  />
                  <p className="text-xs text-[var(--color-foreground-muted)] mt-2 text-center">
                    {locale === 'th' ? 'ส่อง QR Code ให้อยู่ในกรอบ' : 'Point the QR Code within the frame'}
                  </p>
                </div>
              )}

              {/* Manual Mode */}
              {scanMode === 'manual' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-2">
                    {locale === 'th' ? 'รอรับข้อมูลจากเครื่องสแกน...' : 'Waiting for scanner input...'}
                  </label>
                  <input
                    ref={scannerInputRef}
                    type="text"
                    value={scannerInput}
                    onChange={handleScannerInputChange}
                    onKeyDown={handleScannerKeyDown}
                    placeholder={locale === 'th' ? 'สแกน QR หรือวาง URL ที่นี่' : 'Scan QR or paste URL here'}
                    className="w-full px-4 py-3 text-center font-mono text-lg border-2 border-[var(--color-gold)] rounded-xl focus:outline-none focus:ring-4 focus:ring-[var(--color-gold)]/20 transition-all"
                    autoFocus
                  />
                  <p className="text-xs text-[var(--color-foreground-muted)] mt-2 text-center">
                    {locale === 'th' ? 'เครื่องสแกนจะส่งข้อมูลอัตโนมัติ หรือกด Enter หลังวาง' : 'Scanner sends data automatically, or press Enter after paste'}
                  </p>
                </div>
              )}

              {/* Error Message */}
              {scannerError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-red-600">{scannerError}</span>
                </div>
              )}

              {/* Scanning Indicator */}
              {isScanning && (
                <div className="mb-4 p-3 bg-[var(--color-gold)]/10 border border-[var(--color-gold)]/30 rounded-lg flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-[var(--color-gold)]">
                    {locale === 'th' ? 'กำลังตรวจสอบ...' : 'Verifying...'}
                  </span>
                </div>
              )}

              {/* Scanned Items in Modal */}
              <div className="border-t border-[var(--color-beige)] pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'รายการที่สแกนแล้ว' : 'Scanned Items'}
                  </span>
                  <span className="text-sm font-bold text-[var(--color-gold)]">
                    {getCurrentLineScannedItems().length} {locale === 'th' ? 'รายการ' : 'items'}
                  </span>
                </div>

                {getCurrentLineScannedItems().length === 0 ? (
                  <div className="text-center py-8 text-[var(--color-foreground-muted)]">
                    <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    <p className="text-sm">
                      {locale === 'th' ? 'ยังไม่มีรายการที่สแกน' : 'No items scanned yet'}
                    </p>
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {getCurrentLineScannedItems().map((item, idx) => (
                      <div
                        key={item.productItemId}
                        className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="font-mono text-sm text-[var(--color-charcoal)]">{item.serial12}</span>
                            {item.batchNo && (
                              <span className="text-xs text-[var(--color-foreground-muted)] ml-2">({item.batchNo})</span>
                            )}
                          </div>
                        </div>
                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[var(--color-off-white)] border-t border-[var(--color-beige)] flex justify-end gap-3">
              <button
                type="button"
                onClick={closeScannerModal}
                className="px-5 py-2.5 text-sm font-medium text-[var(--color-charcoal)] bg-white border border-[var(--color-beige)] rounded-xl hover:border-[var(--color-gold)] transition-colors"
              >
                {locale === 'th' ? 'เสร็จสิ้น' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
