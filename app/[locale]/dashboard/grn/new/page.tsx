'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { QRScanner } from '@/components/ui/qr-scanner'
import { useConfirm, useAlert } from '@/components/ui/confirm-modal'

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
  productMasterId: number | null
  batchNo: string | null
  batchId: number | null
  createdAt: string
}

interface ScannedItem {
  productItemId: number
  serial12: string
  batchNo: string | null
  scannedAt: Date
  isExisting?: boolean  // true if item was loaded from existing GRN (already linked)
}

interface LineItem {
  id: string
  productMasterId: number
  productMaster: ProductMaster | null  // Store selected product info
  quantity: number
  totalQty: number  // Total planned quantity (for partial receiving)
  unitId: number
  lot: string
  mfgDate: string
  expDate: string
  inspectionStatus: string
  remarks: string
  usePreGen: boolean  // Toggle for using pre-generated QR
  preGeneratedItemIds: number[]  // Selected pre-gen item IDs
  scannedItems: ScannedItem[]  // Scanned items with serial info
  // Receive More mode fields
  planLineId?: number  // Reference to GRNPlanLine
  remaining?: number   // Remaining qty from plan line
}

interface ReceiveMorePlanLine {
  id: number
  totalQty: number
  receivedQty: number
  productMaster: { id: number; sku: string; nameTh: string; nameEn: string | null; modelSize: string | null }
  unit: { id: number; nameTh: string; nameEn: string | null }
  lot: string | null
  mfgDate: string | null
  expDate: string | null
  inspectionStatus: string
  remarks: string | null
}

export default function NewGRNPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const locale = params.locale as string
  const confirm = useConfirm()
  const alert = useAlert()

  // Edit mode
  const editId = searchParams.get('editId')
  const receiveMoreId = searchParams.get('receiveMoreId')
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingGrnId, setEditingGrnId] = useState<number | null>(null)
  const [isReceiveMoreMode, setIsReceiveMoreMode] = useState(false)
  const [receiveMoreGrnId, setReceiveMoreGrnId] = useState<number | null>(null)
  const [receiveMoreGrnNo, setReceiveMoreGrnNo] = useState<string>('')
  const [initialLoading, setInitialLoading] = useState(!!editId || !!receiveMoreId)

  const [loading, setLoading] = useState(false)
  const [productMasters, setProductMasters] = useState<ProductMaster[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [availablePreGenItems, setAvailablePreGenItems] = useState<PreGenItem[]>([])

  // Scanner modal state
  const [scannerModal, setScannerModal] = useState<{ lineId: string; targetQty: number } | null>(null)
  const [scannerInput, setScannerInput] = useState('')
  const [scannerError, setScannerError] = useState<string | null>(null)
  const [scannerSuccess, setScannerSuccess] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('manual')
  const scannerInputRef = useRef<HTMLInputElement>(null)

  // Batch selection modal state
  const [batchModal, setBatchModal] = useState<{ lineId: string } | null>(null)
  const [batchModalItems, setBatchModalItems] = useState<PreGenItem[]>([])
  const [batchModalLoading, setBatchModalLoading] = useState(false)
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<number>>(new Set())
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set())
  const [batchQuantities, setBatchQuantities] = useState<Record<number, number>>({})

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
      totalQty: 1,
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

  // Fetch existing GRN data when in edit mode
  useEffect(() => {
    if (editId && productMasters.length > 0) {
      setIsEditMode(true)
      setEditingGrnId(parseInt(editId))

      fetch(`/api/warehouse/grn/${editId}`)
        .then((r) => r.json())
        .then(async (res) => {
          if (res.success && res.data?.grn) {
            const grn = res.data.grn

            // Check if still editable (not approved)
            if (grn.approvedAt) {
              await alert({
                title: locale === 'th' ? 'ไม่สามารถแก้ไขได้' : 'Cannot Edit',
                message: locale === 'th' ? 'ใบรับสินค้านี้ถูกอนุมัติแล้ว' : 'This GRN is already approved',
                variant: 'error',
                icon: 'error',
              })
              router.push(`/${locale}/dashboard/grn/${editId}`)
              return
            }

            // Pre-fill header data
            setReceivedAt(grn.receivedAt ? grn.receivedAt.split('T')[0] : '')
            setWarehouseId(grn.warehouse?.id || 0)
            setPoNo(grn.poNo || '')
            setSupplierName(grn.supplierName || '')
            setDeliveryNoteNo(grn.deliveryNoteNo || '')
            setSupplierAddress(grn.supplierAddress || '')
            setSupplierPhone(grn.supplierPhone || '')
            setSupplierContact(grn.supplierContact || '')
            setDeliveryDocDate(grn.deliveryDocDate ? grn.deliveryDocDate.split('T')[0] : '')
            setRemarks(grn.remarks || '')

            // Pre-fill lines from existing GRN - group by productMaster + lot + expDate
            if (grn.lines && grn.lines.length > 0) {
              interface GrnLineItem {
                productItem: {
                  id: number
                  serial12: string
                  sku: string
                  lot: string | null
                  mfgDate: string | null
                  expDate: string | null
                  preGeneratedBatchId: number | null
                }
                unit: { id: number }
              }

              const groupedLines: Record<string, LineItem> = {}

              grn.lines.forEach((line: GrnLineItem) => {
                const pm = productMasters.find((p) => p.sku === line.productItem.sku)
                if (!pm) return

                // Check if this item was pre-generated
                const isPreGenerated = !!line.productItem.preGeneratedBatchId

                // Create unique key based on productMaster + lot + expDate + preGen status
                const preGenKey = isPreGenerated ? 'pregen' : 'normal'
                const key = `${pm.id}-${line.productItem.lot || ''}-${line.productItem.expDate || ''}-${preGenKey}`

                if (groupedLines[key]) {
                  groupedLines[key].quantity += 1
                  // Add to scanned items if pre-generated
                  if (isPreGenerated) {
                    groupedLines[key].preGeneratedItemIds.push(line.productItem.id)
                    groupedLines[key].scannedItems.push({
                      productItemId: line.productItem.id,
                      serial12: line.productItem.serial12,
                      batchNo: null,
                      scannedAt: new Date(),
                      isExisting: true,  // Mark as existing item from GRN
                    })
                  }
                } else {
                  groupedLines[key] = {
                    id: crypto.randomUUID(),
                    productMasterId: pm.id,
                    productMaster: pm,
                    quantity: 1,
                    totalQty: 1,
                    unitId: line.unit?.id || pm.defaultUnitId || 0,
                    lot: line.productItem.lot || '',
                    mfgDate: line.productItem.mfgDate ? line.productItem.mfgDate.split('T')[0] : '',
                    expDate: line.productItem.expDate ? line.productItem.expDate.split('T')[0] : '',
                    inspectionStatus: 'OK',
                    remarks: '',
                    usePreGen: isPreGenerated,
                    preGeneratedItemIds: isPreGenerated ? [line.productItem.id] : [],
                    scannedItems: isPreGenerated ? [{
                      productItemId: line.productItem.id,
                      serial12: line.productItem.serial12,
                      batchNo: null,
                      scannedAt: new Date(),
                      isExisting: true,  // Mark as existing item from GRN
                    }] : [],
                  }
                }
              })

              const editLines = Object.values(groupedLines)
              if (editLines.length > 0) {
                setLines(editLines)
              } else {
                setLines([{
                  id: crypto.randomUUID(),
                  productMasterId: 0,
                  productMaster: null,
                  quantity: 1,
                  totalQty: 1,
                  unitId: 0,
                  lot: '',
                  mfgDate: '',
                  expDate: '',
                  inspectionStatus: 'OK',
                  remarks: '',
                  usePreGen: false,
                  preGeneratedItemIds: [],
                  scannedItems: [],
                }])
              }
            }
          }
        })
        .catch((err) => {
          console.error('Failed to fetch GRN for edit:', err)
        })
        .finally(() => {
          setInitialLoading(false)
        })
    }
  }, [editId, productMasters, locale, router])

  // Receive More mode - fetch GRN and populate from plan lines
  useEffect(() => {
    if (receiveMoreId && productMasters.length > 0) {
      setIsReceiveMoreMode(true)
      setReceiveMoreGrnId(parseInt(receiveMoreId))

      fetch(`/api/warehouse/grn/${receiveMoreId}`)
        .then((r) => r.json())
        .then(async (res) => {
          if (res.success && res.data?.grn) {
            const grn = res.data.grn
            setReceiveMoreGrnNo(grn.grnNo)

            // Check if GRN is approved and partial
            if (!grn.approvedAt) {
              await alert({
                title: locale === 'th' ? 'ไม่สามารถรับเพิ่มได้' : 'Cannot Receive More',
                message: locale === 'th' ? 'ใบรับสินค้านี้ยังไม่ได้รับการอนุมัติ' : 'This GRN is not yet approved',
                variant: 'error',
                icon: 'error',
              })
              router.push(`/${locale}/dashboard/grn/${receiveMoreId}`)
              return
            }

            if (grn.receivingStatus !== 'PARTIAL') {
              await alert({
                title: locale === 'th' ? 'รับครบแล้ว' : 'Fully Received',
                message: locale === 'th' ? 'ใบรับสินค้านี้รับครบจำนวนแล้ว' : 'This GRN is already fully received',
                variant: 'info',
                icon: 'info',
              })
              router.push(`/${locale}/dashboard/grn/${receiveMoreId}`)
              return
            }

            // Pre-fill header as read-only
            setReceivedAt(new Date().toISOString().split('T')[0])
            setWarehouseId(grn.warehouse?.id || 0)
            setPoNo(grn.poNo || '')
            setSupplierName(grn.supplierName || '')
            setDeliveryNoteNo(grn.deliveryNoteNo || '')
            setSupplierAddress(grn.supplierAddress || '')
            setSupplierPhone(grn.supplierPhone || '')
            setSupplierContact(grn.supplierContact || '')
            setDeliveryDocDate(grn.deliveryDocDate ? grn.deliveryDocDate.split('T')[0] : '')
            setRemarks('')

            // Build lines from plan lines with remaining qty
            if (grn.planLines && grn.planLines.length > 0) {
              const receiveMoreLines: LineItem[] = grn.planLines
                .filter((pl: ReceiveMorePlanLine) => pl.receivedQty < pl.totalQty)
                .map((pl: ReceiveMorePlanLine) => {
                  const pm = productMasters.find((p) => p.id === pl.productMaster.id) || null
                  const remaining = pl.totalQty - pl.receivedQty
                  return {
                    id: crypto.randomUUID(),
                    productMasterId: pl.productMaster.id,
                    productMaster: pm,
                    quantity: remaining,
                    totalQty: remaining,
                    unitId: pl.unit.id,
                    lot: pl.lot || '',
                    mfgDate: pl.mfgDate ? pl.mfgDate.split('T')[0] : '',
                    expDate: pl.expDate ? pl.expDate.split('T')[0] : '',
                    inspectionStatus: pl.inspectionStatus || 'OK',
                    remarks: pl.remarks || '',
                    usePreGen: false,
                    preGeneratedItemIds: [],
                    scannedItems: [],
                    planLineId: pl.id,
                    remaining,
                  }
                })

              if (receiveMoreLines.length > 0) {
                setLines(receiveMoreLines)
              }
            }
          }
        })
        .catch((err) => {
          console.error('Failed to fetch GRN for receive more:', err)
        })
        .finally(() => {
          setInitialLoading(false)
        })
    }
  }, [receiveMoreId, productMasters, locale, router])

  const addLine = () => {
    setLines([
      ...lines,
      {
        id: crypto.randomUUID(),
        productMasterId: 0,
        productMaster: null,
        quantity: 1,
        totalQty: 1,
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
          totalQty: l.totalQty || 1,
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
    setScannerSuccess(null)
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
    setScannerSuccess(null)

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

      // Show notification if reached target quantity, but don't auto-close
      // User can continue scanning more items and close manually when done
      const updatedLine = lines.find(l => l.id === scannerModal.lineId)
      const newCount = updatedLine ? updatedLine.scannedItems.length + 1 : 1
      if (newCount >= scannerModal.targetQty) {
        // Show success message when reaching or exceeding target
        const message = locale === 'th'
          ? `✓ สแกนครบจำนวนแล้ว (${newCount}/${scannerModal.targetQty}) - สามารถสแกนเพิ่มหรือกดเสร็จสิ้น`
          : `✓ Target reached (${newCount}/${scannerModal.targetQty}) - Continue scanning or press Done`
        setScannerSuccess(message)
        console.log('Target quantity reached:', newCount)
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

  // Batch modal functions
  const openBatchModal = async (lineId: string) => {
    const line = lines.find(l => l.id === lineId)
    if (!line || !line.productMasterId) return

    setBatchModal({ lineId })
    setBatchModalLoading(true)
    setBatchModalItems([])
    setSelectedBatchIds(new Set())
    setSelectedItemIds(new Set())
    setBatchQuantities({})

    try {
      const res = await fetch(`/api/warehouse/pre-generate/available?productMasterId=${line.productMasterId}&limit=5000`)
      const data = await res.json()
      if (data.success && data.data?.items) {
        setBatchModalItems(data.data.items)
      }
    } catch (error) {
      console.error('Failed to fetch batch items:', error)
    } finally {
      setBatchModalLoading(false)
    }
  }

  const closeBatchModal = () => {
    setBatchModal(null)
    setBatchModalItems([])
    setSelectedBatchIds(new Set())
    setSelectedItemIds(new Set())
    setBatchQuantities({})
  }

  const getGroupedBatches = () => {
    if (!batchModal) return []

    // Get IDs already used in other lines
    const usedInOtherLines = lines
      .filter(l => l.id !== batchModal.lineId)
      .flatMap(l => l.preGeneratedItemIds)

    // Also get IDs already in current line (existing items)
    const currentLine = lines.find(l => l.id === batchModal.lineId)
    const existingInCurrentLine = currentLine?.scannedItems
      .filter(item => item.isExisting)
      .map(item => item.productItemId) || []

    const availableItems = batchModalItems.filter(
      item => !usedInOtherLines.includes(item.id) && !existingInCurrentLine.includes(item.id)
    )

    // Group by batchId
    const grouped: Record<number, { batchId: number; batchNo: string; items: PreGenItem[] }> = {}
    for (const item of availableItems) {
      const bId = item.batchId || 0
      if (!grouped[bId]) {
        grouped[bId] = {
          batchId: bId,
          batchNo: item.batchNo || (locale === 'th' ? 'ไม่ระบุ Batch' : 'No Batch'),
          items: [],
        }
      }
      grouped[bId].items.push(item)
    }

    return Object.values(grouped).sort((a, b) => a.batchId - b.batchId)
  }

  const toggleSelectBatch = (batchId: number) => {
    const batches = getGroupedBatches()
    const batch = batches.find(b => b.batchId === batchId)
    if (!batch) return

    const newSelectedBatchIds = new Set(selectedBatchIds)
    const newSelectedItemIds = new Set(selectedItemIds)
    const newBatchQuantities = { ...batchQuantities }

    if (newSelectedBatchIds.has(batchId)) {
      // Deselect batch and its items
      newSelectedBatchIds.delete(batchId)
      delete newBatchQuantities[batchId]
      for (const item of batch.items) {
        newSelectedItemIds.delete(item.id)
      }
    } else {
      // Select batch and all its items
      newSelectedBatchIds.add(batchId)
      newBatchQuantities[batchId] = batch.items.length
      for (const item of batch.items) {
        newSelectedItemIds.add(item.id)
      }
    }

    setSelectedBatchIds(newSelectedBatchIds)
    setSelectedItemIds(newSelectedItemIds)
    setBatchQuantities(newBatchQuantities)
  }

  // Update batch quantity — selects first N items from the batch
  const updateBatchQuantity = (batchId: number, qty: number) => {
    const batches = getGroupedBatches()
    const batch = batches.find(b => b.batchId === batchId)
    if (!batch) return

    const clamped = Math.max(0, Math.min(qty, batch.items.length))
    const newBatchQuantities = { ...batchQuantities, [batchId]: clamped }
    const newSelectedBatchIds = new Set(selectedBatchIds)
    const newSelectedItemIds = new Set(selectedItemIds)

    // Remove all items from this batch first
    for (const item of batch.items) {
      newSelectedItemIds.delete(item.id)
    }

    if (clamped === 0) {
      // Deselect batch entirely
      newSelectedBatchIds.delete(batchId)
      delete newBatchQuantities[batchId]
    } else {
      // Select first N items
      newSelectedBatchIds.add(batchId)
      for (let i = 0; i < clamped; i++) {
        newSelectedItemIds.add(batch.items[i].id)
      }
    }

    setSelectedBatchIds(newSelectedBatchIds)
    setSelectedItemIds(newSelectedItemIds)
    setBatchQuantities(newBatchQuantities)
  }

  const toggleSelectItem = (itemId: number, batchId: number) => {
    const newSelectedItemIds = new Set(selectedItemIds)
    const newSelectedBatchIds = new Set(selectedBatchIds)

    if (newSelectedItemIds.has(itemId)) {
      newSelectedItemIds.delete(itemId)
      // If batch was fully selected, unmark it
      newSelectedBatchIds.delete(batchId)
    } else {
      newSelectedItemIds.add(itemId)
      // Check if all items in batch are now selected
      const batches = getGroupedBatches()
      const batch = batches.find(b => b.batchId === batchId)
      if (batch && batch.items.every(item => newSelectedItemIds.has(item.id))) {
        newSelectedBatchIds.add(batchId)
      }
    }

    // Update batch quantity to reflect actual selection
    const batches = getGroupedBatches()
    const batch = batches.find(b => b.batchId === batchId)
    if (batch) {
      const count = batch.items.filter(item => newSelectedItemIds.has(item.id)).length
      setBatchQuantities(prev => ({ ...prev, [batchId]: count }))
    }

    setSelectedBatchIds(newSelectedBatchIds)
    setSelectedItemIds(newSelectedItemIds)
  }

  const confirmBatchSelection = () => {
    if (!batchModal || selectedItemIds.size === 0) return

    const selectedItems = batchModalItems.filter(item => selectedItemIds.has(item.id))

    setLines(lines.map((l) => {
      if (l.id === batchModal.lineId) {
        const newScannedItems = [
          ...l.scannedItems,
          ...selectedItems.map(item => ({
            productItemId: item.id,
            serial12: item.serial12,
            batchNo: item.batchNo,
            scannedAt: new Date(),
          })),
        ]
        return {
          ...l,
          scannedItems: newScannedItems,
          preGeneratedItemIds: newScannedItems.map(item => item.productItemId),
          quantity: newScannedItems.length,
        }
      }
      return l
    }))

    closeBatchModal()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Receive More mode - submit to receive-more endpoint
    if (isReceiveMoreMode && receiveMoreGrnId) {
      // Validate lines have quantities
      const emptyLines = lines.filter(l => {
        if (l.usePreGen) return l.preGeneratedItemIds.length === 0
        return l.quantity < 1
      })
      if (emptyLines.length > 0) {
        await alert({
          title: locale === 'th' ? 'ข้อมูลไม่ครบ' : 'Incomplete Data',
          message: locale === 'th' ? 'กรุณาระบุจำนวนที่จะรับอย่างน้อย 1 รายการ' : 'Please specify at least 1 item to receive',
          variant: 'warning',
          icon: 'warning',
        })
        return
      }

      // Validate quantities don't exceed remaining
      for (const l of lines) {
        if (l.remaining) {
          const qty = l.usePreGen ? l.preGeneratedItemIds.length : l.quantity
          if (qty > l.remaining) {
            await alert({
              title: locale === 'th' ? 'จำนวนเกิน' : 'Quantity Exceeded',
              message: locale === 'th'
                ? `จำนวนที่รับเกินจำนวนคงเหลือ (${qty} > ${l.remaining})`
                : `Quantity exceeds remaining (${qty} > ${l.remaining})`,
              variant: 'warning',
              icon: 'warning',
            })
            return
          }
        }
      }

      setLoading(true)
      try {
        const res = await fetch(`/api/warehouse/grn/${receiveMoreGrnId}/receive-more`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            receivedAt: receivedAt,
            remarks: remarks || null,
            lines: lines
              .filter(l => l.planLineId)
              .map(l => ({
                planLineId: l.planLineId,
                quantity: l.usePreGen ? l.preGeneratedItemIds.length : l.quantity,
                preGeneratedItemIds: l.usePreGen ? l.preGeneratedItemIds : undefined,
              })),
          }),
        })

        const data = await res.json()
        if (data.success) {
          await alert({
            title: locale === 'th' ? 'รับสินค้าเพิ่มสำเร็จ!' : 'Items Received!',
            message: locale === 'th'
              ? `รับเพิ่ม: ${data.data.linesCreated} รายการ\nครั้งที่: ${data.data.sessionNo}\nสถานะอนุมัติถูกรีเซ็ตเป็น "รออนุมัติ"`
              : `Received: ${data.data.linesCreated} items\nSession: ${data.data.sessionNo}\nApproval status reset to "Pending"`,
            variant: 'success',
            icon: 'success',
          })
          router.push(`/${locale}/dashboard/grn/${receiveMoreGrnId}`)
        } else {
          await alert({
            title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
            message: data.error || 'Unknown error',
            variant: 'error',
            icon: 'error',
          })
        }
      } catch {
        await alert({
          title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
          message: locale === 'th' ? 'ไม่สามารถรับสินค้าเพิ่มได้' : 'Failed to receive more items',
          variant: 'error',
          icon: 'error',
        })
      } finally {
        setLoading(false)
      }
      return
    }

    // In edit mode, update header and lines (will delete old items and create new)
    if (isEditMode && editingGrnId) {
      // Check if there are lines with existing pre-generated items
      const hasExistingPreGenItems = lines.some(l => l.usePreGen && l.scannedItems.length > 0)

      // Check if there are NEW pre-gen items to add (not existing ones)
      const newPreGenItems = lines.flatMap(l =>
        l.usePreGen ? l.scannedItems.filter(item => !item.isExisting) : []
      )

      // If has existing pre-gen items but NO new items, only update header (use PATCH)
      if (hasExistingPreGenItems && newPreGenItems.length === 0) {
        setLoading(true)
        try {
          const res = await fetch(`/api/warehouse/grn/${editingGrnId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              receivedAt,
              poNo: poNo || null,
              supplierName,
              deliveryNoteNo: deliveryNoteNo || null,
              supplierAddress: supplierAddress || null,
              supplierPhone: supplierPhone || null,
              supplierContact: supplierContact || null,
              deliveryDocDate: deliveryDocDate || null,
              remarks: remarks || null,
            }),
          })

          const data = await res.json()
          if (data.success) {
            const statusWasReset = data.data?.statusReset
            await alert({
              title: locale === 'th' ? 'บันทึกสำเร็จ' : 'Saved Successfully',
              message: locale === 'th'
                ? statusWasReset
                  ? 'บันทึกการแก้ไขข้อมูลสำเร็จ!\nสถานะกลับเป็น "รออนุมัติ"'
                  : 'บันทึกการแก้ไขข้อมูลสำเร็จ!'
                : statusWasReset
                  ? 'Changes saved!\nStatus reset to "Pending Approval"'
                  : 'Changes saved!',
              variant: 'success',
              icon: 'success',
            })
            router.push(`/${locale}/dashboard/grn/${editingGrnId}`)
          } else {
            await alert({
              title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
              message: data.error || 'Unknown error',
              variant: 'error',
              icon: 'error',
            })
          }
        } catch {
          await alert({
            title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
            message: locale === 'th' ? 'ไม่สามารถบันทึกได้' : 'Failed to update GRN',
            variant: 'error',
            icon: 'error',
          })
        } finally {
          setLoading(false)
        }
        return
      }

      // If has existing pre-gen items AND new items, add new items only
      if (hasExistingPreGenItems && newPreGenItems.length > 0) {
        setLoading(true)
        try {
          // First update header
          await fetch(`/api/warehouse/grn/${editingGrnId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              receivedAt,
              poNo: poNo || null,
              supplierName,
              deliveryNoteNo: deliveryNoteNo || null,
              supplierAddress: supplierAddress || null,
              supplierPhone: supplierPhone || null,
              supplierContact: supplierContact || null,
              deliveryDocDate: deliveryDocDate || null,
              remarks: remarks || null,
            }),
          })

          // Then add new pre-gen items using the add-items endpoint
          const res = await fetch(`/api/warehouse/grn/${editingGrnId}/add-items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lines: lines
                .filter(l => l.usePreGen && l.scannedItems.some(item => !item.isExisting))
                .map(l => ({
                  productMasterId: l.productMasterId,
                  unitId: l.unitId,
                  lot: l.lot || null,
                  mfgDate: l.mfgDate || null,
                  expDate: l.expDate || null,
                  inspectionStatus: l.inspectionStatus,
                  remarks: l.remarks || null,
                  preGeneratedItemIds: l.scannedItems
                    .filter(item => !item.isExisting)
                    .map(item => item.productItemId),
                })),
            }),
          })

          const data = await res.json()
          if (data.success) {
            const statusWasReset = data.data?.statusReset
            await alert({
              title: locale === 'th' ? 'บันทึกสำเร็จ' : 'Saved Successfully',
              message: locale === 'th'
                ? statusWasReset
                  ? `เพิ่ม QR ใหม่สำเร็จ!\nจำนวน: ${data.data.linesCreated} รายการ\nสถานะกลับเป็น "รออนุมัติ"`
                  : `เพิ่ม QR ใหม่สำเร็จ!\nจำนวน: ${data.data.linesCreated} รายการ`
                : statusWasReset
                  ? `New QR added!\nItems: ${data.data.linesCreated}\nStatus reset to "Pending Approval"`
                  : `New QR added!\nItems: ${data.data.linesCreated}`,
              variant: 'success',
              icon: 'success',
            })
            router.push(`/${locale}/dashboard/grn/${editingGrnId}`)
          } else {
            await alert({
              title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
              message: data.error || 'Unknown error',
              variant: 'error',
              icon: 'error',
            })
          }
        } catch {
          await alert({
            title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
            message: locale === 'th' ? 'ไม่สามารถบันทึกได้' : 'Failed to add items',
            variant: 'error',
            icon: 'error',
          })
        } finally {
          setLoading(false)
        }
        return
      }

      // Validate lines same as create mode
      const invalidLines = lines.filter((l) => !l.productMasterId)
      if (invalidLines.length > 0) {
        await alert({
          title: locale === 'th' ? 'ข้อมูลไม่ครบ' : 'Incomplete Data',
          message: locale === 'th' ? 'กรุณาเลือกสินค้าให้ครบทุกรายการ' : 'Please select product for all lines',
          variant: 'warning',
          icon: 'warning',
        })
        return
      }

      const noUnitLines = lines.filter((l) => !l.productMaster?.defaultUnitId)
      if (noUnitLines.length > 0) {
        await alert({
          title: locale === 'th' ? 'ไม่มีหน่วยสินค้า' : 'No Unit Defined',
          message: locale === 'th' ? 'สินค้าบางรายการยังไม่มีการกำหนดหน่วย กรุณาไปกำหนดที่หน้าจัดการสินค้าก่อน' : 'Some products have no unit defined. Please set unit in product management first.',
          variant: 'warning',
          icon: 'warning',
        })
        return
      }

      // Confirm before editing (this will regenerate all serials)
      const confirmed = await confirm({
        title: locale === 'th' ? 'ยืนยันการแก้ไข' : 'Confirm Edit',
        message: locale === 'th'
          ? 'การแก้ไขจะลบ Serial Numbers เดิมทั้งหมดและสร้างใหม่ ต้องการดำเนินการต่อหรือไม่?'
          : 'This will delete all existing Serial Numbers and regenerate them. Continue?',
        confirmText: locale === 'th' ? 'ดำเนินการ' : 'Continue',
        cancelText: locale === 'th' ? 'ยกเลิก' : 'Cancel',
        variant: 'warning',
        icon: 'warning',
      })
      if (!confirmed) return

      setLoading(true)
      try {
        const res = await fetch(`/api/warehouse/grn/${editingGrnId}`, {
          method: 'PUT',
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
          const statusWasReset = data.data?.statusReset
          await alert({
            title: locale === 'th' ? 'บันทึกสำเร็จ' : 'Saved Successfully',
            message: locale === 'th'
              ? statusWasReset
                ? `บันทึกการแก้ไขสำเร็จ!\nจำนวน: ${data.data.linesCreated} รายการ\nสถานะกลับเป็น "รออนุมัติ"`
                : `บันทึกการแก้ไขสำเร็จ!\nจำนวน: ${data.data.linesCreated} รายการ`
              : statusWasReset
                ? `Changes saved!\nItems: ${data.data.linesCreated}\nStatus reset to "Pending Approval"`
                : `Changes saved!\nItems: ${data.data.linesCreated}`,
            variant: 'success',
            icon: 'success',
          })
          router.push(`/${locale}/dashboard/grn/${editingGrnId}`)
        } else {
          await alert({
            title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
            message: data.error || 'Unknown error',
            variant: 'error',
            icon: 'error',
          })
        }
      } catch {
        await alert({
          title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
          message: locale === 'th' ? 'ไม่สามารถบันทึกได้' : 'Failed to update GRN',
          variant: 'error',
          icon: 'error',
        })
      } finally {
        setLoading(false)
      }
      return
    }

    // Validate all lines have ProductMaster selected
    const invalidLines = lines.filter((l) => !l.productMasterId)
    if (invalidLines.length > 0) {
      await alert({
        title: locale === 'th' ? 'ข้อมูลไม่ครบ' : 'Incomplete Data',
        message: locale === 'th' ? 'กรุณาเลือกสินค้าให้ครบทุกรายการ' : 'Please select product for all lines',
        variant: 'warning',
        icon: 'warning',
      })
      return
    }

    // Validate all selected ProductMasters have unit defined
    const noUnitLines = lines.filter((l) => !l.productMaster?.defaultUnitId)
    if (noUnitLines.length > 0) {
      await alert({
        title: locale === 'th' ? 'ไม่มีหน่วยสินค้า' : 'No Unit Defined',
        message: locale === 'th' ? 'สินค้าบางรายการยังไม่มีการกำหนดหน่วย กรุณาไปกำหนดที่หน้าจัดการสินค้าก่อน' : 'Some products have no unit defined. Please set unit in product management first.',
        variant: 'warning',
        icon: 'warning',
      })
      return
    }

    // Validate pre-gen lines have items selected
    const emptyPreGenLines = lines.filter((l) => l.usePreGen && l.preGeneratedItemIds.length === 0)
    if (emptyPreGenLines.length > 0) {
      await alert({
        title: locale === 'th' ? 'ข้อมูลไม่ครบ' : 'Incomplete Data',
        message: locale === 'th' ? 'กรุณาเลือก QR ล่วงหน้าอย่างน้อย 1 รายการ' : 'Please select at least 1 pre-generated QR',
        variant: 'warning',
        icon: 'warning',
      })
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
            totalQty: l.usePreGen ? l.totalQty : l.totalQty,
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
        const isPartial = data.data.receivingStatus === 'PARTIAL'
        await alert({
          title: locale === 'th' ? 'สร้างใบรับสินค้าสำเร็จ!' : 'GRN Created!',
          message: locale === 'th'
            ? `GRN No: ${data.data.grnNo}\nจำนวน: ${data.data.linesCreated} รายการ${isPartial ? '\nสถานะ: รับบางส่วน' : ''}`
            : `GRN No: ${data.data.grnNo}\nItems: ${data.data.linesCreated}${isPartial ? '\nStatus: Partial Receive' : ''}`,
          variant: 'success',
          icon: 'success',
        })
        router.push(`/${locale}/dashboard/grn/${data.data.id}`)
      } else {
        await alert({
          title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
          message: data.error || 'Unknown error',
          variant: 'error',
          icon: 'error',
        })
      }
    } catch (error) {
      await alert({
        title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
        message: locale === 'th' ? 'ไม่สามารถสร้างใบรับสินค้าได้' : 'Failed to create GRN',
        variant: 'error',
        icon: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full px-4 py-2.5 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
  const labelClass = "block text-sm font-medium text-[var(--color-charcoal)] mb-1.5"
  const selectClass = "appearance-none w-full px-4 py-2.5 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] pr-10"

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
          href={isReceiveMoreMode ? `/${locale}/dashboard/grn/${receiveMoreGrnId}` : isEditMode ? `/${locale}/dashboard/grn/${editingGrnId}` : `/${locale}/dashboard/grn`}
          className="inline-flex items-center gap-1 text-xs sm:text-sm text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] font-medium transition-colors mb-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {locale === 'th' ? ((isEditMode || isReceiveMoreMode) ? 'กลับหน้ารายละเอียด' : 'กลับหน้ารายการ') : ((isEditMode || isReceiveMoreMode) ? 'Back to detail' : 'Back to list')}
        </Link>
        <h1 className="text-display text-xl sm:text-2xl font-bold text-[var(--color-charcoal)]">
          {isReceiveMoreMode
            ? (locale === 'th' ? `รับสินค้าเพิ่ม — ${receiveMoreGrnNo}` : `Receive More — ${receiveMoreGrnNo}`)
            : (locale === 'th' ? (isEditMode ? 'แก้ไขใบรับสินค้า' : 'สร้างใบรับสินค้าใหม่') : (isEditMode ? 'Edit GRN' : 'Create New GRN'))
          }
        </h1>
        <p className="text-sm sm:text-base text-[var(--color-foreground-muted)] mt-1">
          {isReceiveMoreMode
            ? (locale === 'th' ? 'รับสินค้าเข้าคลังเพิ่มเติม สถานะอนุมัติจะถูกรีเซ็ตเป็นรออนุมัติ' : 'Receive additional items. Approval status will be reset to Pending.')
            : isEditMode
            ? (locale === 'th' ? 'แก้ไขข้อมูลใบรับสินค้า (Serial Numbers เดิมจะถูกลบและสร้างใหม่)' : 'Edit GRN info (existing Serial Numbers will be deleted and regenerated)')
            : (locale === 'th' ? 'กรอกข้อมูลการรับสินค้าเข้าคลัง' : 'Fill in goods receipt information')
          }
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
              {isReceiveMoreMode
                ? (locale === 'th' ? 'รายการที่ต้องรับเพิ่ม' : 'Items to Receive')
                : (locale === 'th' ? 'รายการสินค้า' : 'Line Items')
              }
            </h2>
            {!isReceiveMoreMode && (
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-[var(--color-mint)] text-white rounded-xl font-medium text-xs sm:text-sm shadow-[0_4px_14px_rgba(115,207,199,0.3)] hover:bg-[var(--color-mint-dark)] hover:-translate-y-0.5 transition-all duration-200"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {locale === 'th' ? 'เพิ่มรายการ' : 'Add Item'}
              </button>
            )}
          </div>

          <div className="space-y-4">
            {lines.map((line, index) => (
              <div key={line.id} className="border border-[var(--color-beige)] rounded-xl p-5 bg-[var(--color-off-white)]">
                <div className="flex justify-between items-center mb-4">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-gold)]/10 text-[var(--color-gold)] font-semibold text-sm">
                    #{index + 1}
                  </span>
                  {lines.length > 1 && !isReceiveMoreMode && (
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
                        disabled={isReceiveMoreMode}
                        className={`appearance-none w-full px-3 py-2 text-sm border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all pr-8 ${isReceiveMoreMode ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}`}
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
                    {/* In edit mode with existing pre-gen items, show info but allow adding more */}
                    {isEditMode && line.usePreGen && line.scannedItems.length > 0 ? (
                      <div className="mb-3">
                        <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs text-blue-700">
                            {locale === 'th' ? 'รายการนี้ใช้ QR ล่วงหน้า - สามารถเพิ่ม QR ได้' : 'This line uses Pre-Generated QR - you can add more'}
                          </span>
                        </div>
                      </div>
                    ) : availablePreGenItems.length > 0 && (
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
                    {/* Receive More mode: show plan info */}
                    {isReceiveMoreMode && line.planLineId && (
                      <div className="mb-2">
                        <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                          <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs text-orange-700">
                            {locale === 'th' ? `คงเหลือ: ${line.remaining} รายการ` : `Remaining: ${line.remaining} items`}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Show totalQty input in create/edit mode even when using pre-gen */}
                    {line.usePreGen && !isReceiveMoreMode && (
                      <div className="mb-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-[var(--color-charcoal)] mb-1">
                              {locale === 'th' ? 'จำนวนรวม' : 'Total Qty'} <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={line.totalQty}
                              onChange={(e) => {
                                const newTotal = parseInt(e.target.value) || 1
                                setLines(lines.map(l => l.id === line.id ? {
                                  ...l,
                                  totalQty: newTotal,
                                } : l))
                              }}
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
                        {line.scannedItems.length > 0 && line.scannedItems.length < line.totalQty && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-orange-600">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {locale === 'th' ? `รับบางส่วน (${line.scannedItems.length}/${line.totalQty})` : `Partial Receive (${line.scannedItems.length}/${line.totalQty})`}
                          </div>
                        )}
                      </div>
                    )}

                    {line.usePreGen ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-medium text-[var(--color-charcoal)]">
                            {locale === 'th' ? 'QR ที่สแกนแล้ว' : 'Scanned QR'} <span className="text-red-500">*</span>
                          </label>
                          <span className="text-xs text-[var(--color-gold)] font-medium">
                            {line.scannedItems.length}{isReceiveMoreMode && line.remaining ? `/${line.remaining}` : !isReceiveMoreMode ? `/${line.totalQty}` : ''} {locale === 'th' ? 'รายการ' : 'items'}
                          </span>
                        </div>

                        {/* Action Buttons - Scan QR + Select from Batch */}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openScannerModal(line.id, 0)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-gold)]/10 border-2 border-dashed border-[var(--color-gold)] rounded-lg text-[var(--color-gold)] hover:bg-[var(--color-gold)]/20 transition-all"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                            <span className="text-sm">{locale === 'th' ? (line.scannedItems.length > 0 ? 'สแกนเพิ่ม' : 'สแกน QR') : (line.scannedItems.length > 0 ? 'Scan More' : 'Scan QR')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openBatchModal(line.id)}
                            disabled={!line.productMasterId}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-mint)]/10 border-2 border-dashed border-[var(--color-mint)] rounded-lg text-[var(--color-mint-dark)] hover:bg-[var(--color-mint)]/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <span className="text-sm">{locale === 'th' ? 'เลือกจาก Batch' : 'Select Batch'}</span>
                          </button>
                        </div>

                        {/* Scanned Items List */}
                        {line.scannedItems.length > 0 && (
                          <div className="mt-3 max-h-32 overflow-y-auto border border-[var(--color-beige)] rounded-lg bg-white divide-y divide-[var(--color-beige)]">
                            {line.scannedItems.map((item) => (
                              <div key={item.productItemId} className={`flex items-center justify-between px-3 py-2 ${item.isExisting ? 'bg-gray-50' : ''}`}>
                                <div className="flex items-center gap-2">
                                  <svg className={`w-4 h-4 ${item.isExisting ? 'text-blue-500' : 'text-green-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span className="font-mono text-xs text-[var(--color-charcoal)]">{item.serial12}</span>
                                  {item.isExisting && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">
                                      {locale === 'th' ? 'เดิม' : 'Existing'}
                                    </span>
                                  )}
                                  {!item.isExisting && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-600 rounded">
                                      {locale === 'th' ? 'ใหม่' : 'New'}
                                    </span>
                                  )}
                                  {item.batchNo && (
                                    <span className="text-[10px] text-[var(--color-foreground-muted)]">({item.batchNo})</span>
                                  )}
                                </div>
                                {/* Only allow removing non-existing items */}
                                {!item.isExisting && (
                                  <button
                                    type="button"
                                    onClick={() => removeScannedItem(line.id, item.productItemId)}
                                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        {isReceiveMoreMode ? (
                          /* Receive More mode: single quantity input */
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-[var(--color-charcoal)] mb-1">
                                {locale === 'th' ? 'รับครั้งนี้' : 'Receive This Time'} <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={line.remaining || undefined}
                                value={line.quantity}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 1
                                  const clamped = line.remaining ? Math.min(val, line.remaining) : val
                                  updateLine(line.id, 'quantity', clamped)
                                }}
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
                        ) : (
                          /* Create/Edit mode: totalQty + quantity inputs */
                          <div>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-[var(--color-charcoal)] mb-1">
                                  {locale === 'th' ? 'จำนวนรวม' : 'Total Qty'} <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  value={line.totalQty}
                                  onChange={(e) => {
                                    const newTotal = parseInt(e.target.value) || 1
                                    setLines(lines.map(l => l.id === line.id ? {
                                      ...l,
                                      totalQty: newTotal,
                                      quantity: Math.min(l.quantity, newTotal),
                                    } : l))
                                  }}
                                  required
                                  className="w-full px-3 py-2 text-sm bg-white border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-[var(--color-charcoal)] mb-1">
                                  {locale === 'th' ? 'รับครั้งนี้' : 'This Time'} <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={line.totalQty}
                                  value={line.quantity}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1
                                    const clamped = Math.min(val, line.totalQty)
                                    updateLine(line.id, 'quantity', clamped)
                                  }}
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
                            {line.quantity < line.totalQty && (
                              <div className="mt-2 flex items-center gap-1.5 text-xs text-orange-600">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {locale === 'th' ? `รับบางส่วน (${line.quantity}/${line.totalQty})` : `Partial Receive (${line.quantity}/${line.totalQty})`}
                              </div>
                            )}
                          </div>
                        )}
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
        <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-[var(--color-charcoal)] bg-white border border-[var(--color-beige)] rounded-xl hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] transition-all duration-200"
          >
            {locale === 'th' ? 'ยกเลิก' : 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-medium bg-[var(--color-gold)] text-white rounded-xl shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(201,163,90,0.35)] disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-200"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {locale === 'th' ? 'กำลังบันทึก...' : 'Saving...'}
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {isReceiveMoreMode
                  ? (locale === 'th' ? 'รับสินค้าเพิ่ม' : 'Receive More')
                  : (locale === 'th' ? (isEditMode ? 'บันทึกการแก้ไข' : 'บันทึกและสร้าง Serial') : (isEditMode ? 'Save Changes' : 'Save & Generate Serials'))
                }
              </>
            )}
          </button>
        </div>
      </form>

      {/* Batch Selection Modal */}
      {batchModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeBatchModal}
          />

          {/* Modal Content */}
          <div className="relative bg-white w-full h-[95vh] sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:shadow-2xl sm:max-w-lg sm:mx-4 overflow-hidden flex flex-col rounded-t-3xl sm:rounded-2xl">
            {/* Header */}
            <div className="bg-[var(--color-gold)] px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-white">
                      {locale === 'th' ? 'เลือกจาก Batch' : 'Select from Batch'}
                    </h3>
                    <p className="text-xs sm:text-sm text-white/80 hidden sm:block">
                      {locale === 'th' ? 'เลือก Batch แล้วระบุจำนวนที่ต้องการ' : 'Select a batch and specify the quantity'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeBatchModal}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
              {batchModalLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-10 h-10 relative mb-3">
                    <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
                    <div className="absolute inset-0 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin" />
                  </div>
                  <p className="text-sm text-[var(--color-foreground-muted)]">
                    {locale === 'th' ? 'กำลังโหลด...' : 'Loading...'}
                  </p>
                </div>
              ) : getGroupedBatches().length === 0 ? (
                <div className="text-center py-12 text-[var(--color-foreground-muted)]">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-sm font-medium mb-1">
                    {locale === 'th' ? 'ไม่พบ Batch ที่พร้อมใช้งาน' : 'No available batches found'}
                  </p>
                  <p className="text-xs">
                    {locale === 'th' ? 'สร้าง Batch ใหม่ในหน้า Pre-Generate ก่อน' : 'Create a batch in Pre-Generate page first'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getGroupedBatches().map((batch) => {
                    const isBatchSelected = selectedBatchIds.has(batch.batchId)
                    const selectedCount = batch.items.filter(item => selectedItemIds.has(item.id)).length
                    const batchQty = batchQuantities[batch.batchId] ?? 0

                    return (
                      <div key={batch.batchId} className={`border rounded-xl overflow-hidden transition-colors ${
                        selectedCount > 0 ? 'border-[var(--color-gold)]' : 'border-[var(--color-beige)]'
                      }`}>
                        {/* Batch Header */}
                        <div className={`px-4 py-3 transition-colors ${
                          selectedCount > 0
                            ? 'bg-[var(--color-gold)]/10'
                            : 'bg-[var(--color-off-white)]'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => toggleSelectBatch(batch.batchId)}
                                className="flex items-center gap-3"
                              >
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  isBatchSelected && selectedCount === batch.items.length
                                    ? 'bg-[var(--color-gold)] border-[var(--color-gold)]'
                                    : selectedCount > 0
                                      ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/30'
                                      : 'border-[var(--color-beige)]'
                                }`}>
                                  {(isBatchSelected || selectedCount > 0) && (
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={selectedCount === batch.items.length ? "M5 13l4 4L19 7" : "M20 12H4"} />
                                    </svg>
                                  )}
                                </div>
                                <div className="text-left">
                                  <span className="text-sm font-medium text-[var(--color-charcoal)]">{batch.batchNo}</span>
                                  <span className="text-xs text-[var(--color-foreground-muted)] ml-2">
                                    ({batch.items.length} {locale === 'th' ? 'รายการ' : 'items'})
                                  </span>
                                </div>
                              </button>
                            </div>
                            {selectedCount > 0 && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-gold)]/20 text-[var(--color-gold)]">
                                {selectedCount}/{batch.items.length}
                              </span>
                            )}
                          </div>

                          {/* Quantity input — show when batch is selected */}
                          {selectedCount > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                              <label className="text-xs text-[var(--color-charcoal)] whitespace-nowrap">
                                {locale === 'th' ? 'จำนวนที่ต้องการ:' : 'Quantity:'}
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={batch.items.length}
                                value={batchQty}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0
                                  updateBatchQuantity(batch.batchId, val)
                                }}
                                className="w-20 px-2 py-1 text-sm bg-white border border-[var(--color-beige)] rounded-lg focus:outline-none focus:border-[var(--color-gold)] focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] transition-all text-center"
                              />
                              <span className="text-xs text-[var(--color-foreground-muted)]">
                                / {batch.items.length}
                              </span>
                              {/* Quick select buttons */}
                              {batch.items.length > 10 && (
                                <div className="flex gap-1 ml-auto">
                                  {[10, 25, 50, batch.items.length].filter(n => n <= batch.items.length).map(n => (
                                    <button
                                      key={n}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        updateBatchQuantity(batch.batchId, n)
                                      }}
                                      className={`px-2 py-0.5 text-[10px] rounded-md border transition-colors ${
                                        batchQty === n
                                          ? 'bg-[var(--color-gold)] text-white border-[var(--color-gold)]'
                                          : 'bg-white text-[var(--color-charcoal)] border-[var(--color-beige)] hover:border-[var(--color-gold)]'
                                      }`}
                                    >
                                      {n === batch.items.length ? (locale === 'th' ? 'ทั้งหมด' : 'All') : n}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Batch Items - collapsible list for viewing individual items */}
                        {selectedCount > 0 && (
                          <details className="bg-white">
                            <summary className="px-4 py-1.5 text-[10px] text-[var(--color-foreground-muted)] cursor-pointer hover:bg-[var(--color-off-white)] select-none border-t border-[var(--color-beige)]/50">
                              {locale === 'th' ? `ดูรายการที่เลือก (${selectedCount})` : `View selected items (${selectedCount})`}
                            </summary>
                            <div className="max-h-40 overflow-y-auto divide-y divide-[var(--color-beige)]/50">
                              {batch.items.map((item) => {
                                const isItemSelected = selectedItemIds.has(item.id)
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => toggleSelectItem(item.id, batch.batchId)}
                                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                                      isItemSelected ? 'bg-green-50' : 'hover:bg-[var(--color-off-white)]'
                                    }`}
                                  >
                                    <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                                      isItemSelected
                                        ? 'bg-green-500 border-green-500'
                                        : 'border-[var(--color-beige)]'
                                    }`}>
                                      {isItemSelected && (
                                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                    <span className="font-mono text-xs text-[var(--color-charcoal)]">{item.serial12}</span>
                                  </button>
                                )
                              })}
                            </div>
                          </details>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-4 bg-[var(--color-off-white)] border-t border-[var(--color-beige)] flex-shrink-0 safe-area-bottom">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-charcoal)]">
                  {locale === 'th' ? 'เลือกแล้ว' : 'Selected'}: <span className="font-bold text-[var(--color-gold)]">{selectedItemIds.size}</span> {locale === 'th' ? 'รายการ' : 'items'}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeBatchModal}
                    className="px-4 py-2.5 text-sm font-medium text-[var(--color-charcoal)] bg-white border border-[var(--color-beige)] rounded-xl hover:border-[var(--color-gold)] transition-colors"
                  >
                    {locale === 'th' ? 'ยกเลิก' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={confirmBatchSelection}
                    disabled={selectedItemIds.size === 0}
                    className="px-4 py-2.5 text-sm font-medium text-white bg-[var(--color-gold)] rounded-xl hover:bg-[var(--color-gold-dark)] transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {locale === 'th' ? `ยืนยัน (${selectedItemIds.size})` : `Confirm (${selectedItemIds.size})`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scanner Modal */}
      {scannerModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeScannerModal}
          />

          {/* Modal Content - Full screen on mobile, centered modal on desktop */}
          <div className="relative bg-white w-full h-[95vh] sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:shadow-2xl sm:max-w-md sm:mx-4 overflow-hidden flex flex-col rounded-t-3xl sm:rounded-2xl">
            {/* Header */}
            <div className="bg-[var(--color-gold)] px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-white">
                      {locale === 'th' ? 'สแกน QR Code' : 'Scan QR Code'}
                    </h3>
                    <p className="text-xs sm:text-sm text-white/80 hidden sm:block">
                      {locale === 'th' ? 'สแกน QR ที่สร้างล่วงหน้า' : 'Scan pre-generated QR'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeScannerModal}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scanner Content - Scrollable */}
            <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
              {/* Mode Tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setScanMode('manual')
                    setTimeout(() => scannerInputRef.current?.focus(), 100)
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                    scanMode === 'manual'
                      ? 'bg-[var(--color-gold)] text-white shadow-md'
                      : 'bg-[var(--color-off-white)] text-[var(--color-charcoal)] hover:bg-[var(--color-beige)]'
                  }`}
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  {locale === 'th' ? 'เครื่องสแกน' : 'Scanner'}
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode('camera')}
                  className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                    scanMode === 'camera'
                      ? 'bg-[var(--color-gold)] text-white shadow-md'
                      : 'bg-[var(--color-off-white)] text-[var(--color-charcoal)] hover:bg-[var(--color-beige)]'
                  }`}
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {locale === 'th' ? 'กล้อง' : 'Camera'}
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

              {/* Success Message */}
              {scannerSuccess && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-green-600 font-medium">{scannerSuccess}</span>
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
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          item.isExisting
                            ? 'bg-blue-50 border border-blue-200'
                            : 'bg-green-50 border border-green-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full text-white flex items-center justify-center text-xs font-bold ${
                            item.isExisting ? 'bg-blue-500' : 'bg-green-500'
                          }`}>
                            {idx + 1}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-[var(--color-charcoal)]">{item.serial12}</span>
                            {item.isExisting ? (
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">
                                {locale === 'th' ? 'เดิม' : 'Existing'}
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-600 rounded">
                                {locale === 'th' ? 'ใหม่' : 'New'}
                              </span>
                            )}
                            {item.batchNo && (
                              <span className="text-xs text-[var(--color-foreground-muted)]">({item.batchNo})</span>
                            )}
                          </div>
                        </div>
                        <svg className={`w-5 h-5 ${item.isExisting ? 'text-blue-500' : 'text-green-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-4 bg-[var(--color-off-white)] border-t border-[var(--color-beige)] flex-shrink-0 safe-area-bottom">
              <button
                type="button"
                onClick={closeScannerModal}
                className="w-full sm:w-auto sm:ml-auto flex justify-center px-6 py-3 sm:py-2.5 text-sm font-medium text-white bg-[var(--color-gold)] rounded-xl hover:bg-[var(--color-gold-dark)] transition-colors shadow-md"
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
