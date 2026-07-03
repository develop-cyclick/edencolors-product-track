'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useConfirm, useAlert } from '@/components/ui/confirm-modal'
import { GRID, computeGridGeometry } from '@/lib/pdf-label-core'

type TabType = 'categories' | 'units' | 'shipping' | 'warehouses' | 'display' | 'label' | 'permissions'

interface MasterItem {
  id: number
  nameTh?: string
  nameEn?: string | null
  name?: string
  serialCode?: string
  isActive: boolean
}

interface SystemSettings {
  'verify.showClinicName': boolean
  'verify.showBranchInfo': boolean
  'verify.showClinicAddress': boolean
  'label.widthMm': number
  'label.heightMm': number
}

// Label sticker size bounds + grid preview helpers. Sourced from
// lib/pdf-label-core.ts so the preview never drifts from the actual PDF output.
const LABEL_WIDTH_MIN_MM = GRID.W_MIN
const LABEL_WIDTH_MAX_MM = GRID.W_MAX
const LABEL_HEIGHT_MIN_MM = GRID.H_MIN
const LABEL_HEIGHT_MAX_MM = GRID.H_MAX

function calcLabelColumns(widthMm: number): number {
  return computeGridGeometry(widthMm, GRID.H_DEF).gridColumns
}

function calcLabelRows(heightMm: number): number {
  return computeGridGeometry(GRID.W_DEF, heightMm).rowsPerPage
}

// QR square (mm) that auto-fits a width×height box (banner on top + serial strip
// at bottom). Delegates to the shared core so it matches the generated PDF.
function calcFitQrMm(widthMm: number, heightMm: number): number {
  return computeGridGeometry(widthMm, heightMm).qrSize
}

export default function SettingsPage() {
  const params = useParams()
  const locale = params.locale as string
  const confirm = useConfirm()
  const alert = useAlert()

  const [activeTab, setActiveTab] = useState<TabType>('categories')
  const [items, setItems] = useState<MasterItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<MasterItem | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // System settings state
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    'verify.showClinicName': true,
    'verify.showBranchInfo': true,
    'verify.showClinicAddress': true,
    'label.widthMm': 20,
    'label.heightMm': 34,
  })
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [widthDraft, setWidthDraft] = useState<string>('20')
  const [heightDraft, setHeightDraft] = useState<string>('34')
  const [sizeSaving, setSizeSaving] = useState(false)

  // Permissions matrix state
  const [permPages, setPermPages] = useState<{ key: string; labelTh: string; labelEn: string; locked?: boolean }[]>([])
  const [permRoles, setPermRoles] = useState<string[]>([])
  const [permMatrix, setPermMatrix] = useState<Record<string, string[]>>({})
  const [permLoading, setPermLoading] = useState(false)
  const [permSaving, setPermSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    nameTh: '',
    nameEn: '',
    name: '',
    serialCode: '',
    isActive: true,
  })

  const tabs: { key: TabType; labelTh: string; labelEn: string; endpoint: string }[] = [
    { key: 'categories', labelTh: 'หมวดหมู่สินค้า', labelEn: 'Categories', endpoint: '/api/admin/masters/categories' },
    { key: 'units', labelTh: 'หน่วยนับ', labelEn: 'Units', endpoint: '/api/admin/masters/units' },
    { key: 'shipping', labelTh: 'วิธีการจัดส่ง', labelEn: 'Shipping Methods', endpoint: '/api/admin/masters/shipping-methods' },
    { key: 'warehouses', labelTh: 'คลังสินค้า', labelEn: 'Warehouses', endpoint: '/api/admin/masters/warehouses' },
    { key: 'display', labelTh: 'การแสดงผล', labelEn: 'Display', endpoint: '' },
    { key: 'label', labelTh: 'ฉลาก QR', labelEn: 'QR Label', endpoint: '' },
    { key: 'permissions', labelTh: 'สิทธิ์การใช้งาน', labelEn: 'Permissions', endpoint: '' },
  ]

  const currentTab = tabs.find((t) => t.key === activeTab)!

  useEffect(() => {
    if (activeTab === 'permissions') {
      fetchPermissions()
    } else if (activeTab === 'display' || activeTab === 'label') {
      fetchSystemSettings()
    } else {
      fetchItems()
    }
  }, [activeTab])

  useEffect(() => {
    setWidthDraft(String(systemSettings['label.widthMm']))
    setHeightDraft(String(systemSettings['label.heightMm']))
  }, [systemSettings])

  const fetchPermissions = async () => {
    setPermLoading(true)
    try {
      const res = await fetch('/api/admin/permissions')
      const data = await res.json()
      if (data.success) {
        setPermPages(data.data.pages)
        setPermRoles(data.data.roles)
        setPermMatrix(data.data.matrix)
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error)
    } finally {
      setPermLoading(false)
    }
  }

  const isPermChecked = (pageKey: string, role: string) => (permMatrix[pageKey] || []).includes(role)

  // ADMIN is always allowed; `locked` pages (dashboard root) are always all-roles.
  const isPermLocked = (pageKey: string, role: string) => {
    if (role === 'ADMIN') return true
    return !!permPages.find((p) => p.key === pageKey)?.locked
  }

  const togglePerm = (pageKey: string, role: string) => {
    if (isPermLocked(pageKey, role)) return
    setPermMatrix((prev) => {
      const current = prev[pageKey] || []
      const next = current.includes(role) ? current.filter((r) => r !== role) : [...current, role]
      return { ...prev, [pageKey]: next }
    })
  }

  const savePermissions = async () => {
    const ok = await confirm({
      title: locale === 'th' ? 'บันทึกสิทธิ์การใช้งาน' : 'Save Permissions',
      message: locale === 'th'
        ? 'ยืนยันบันทึกสิทธิ์การเข้าถึงหน้าของแต่ละ role? มีผลทันทีหลังบันทึก'
        : 'Confirm saving page-access permissions for each role? Takes effect immediately.',
      confirmText: locale === 'th' ? 'บันทึก' : 'Save',
      cancelText: locale === 'th' ? 'ยกเลิก' : 'Cancel',
      variant: 'info', icon: 'question',
    })
    if (!ok) return
    setPermSaving(true)
    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matrix: permMatrix }),
      })
      const data = await res.json()
      if (data.success) {
        setPermMatrix(data.data.matrix)
        await alert({
          title: locale === 'th' ? 'บันทึกสำเร็จ' : 'Saved',
          message: locale === 'th' ? 'บันทึกสิทธิ์เรียบร้อยแล้ว' : 'Permissions saved successfully',
          variant: 'success', icon: 'success',
        })
      } else {
        await alert({
          title: locale === 'th' ? 'บันทึกไม่สำเร็จ' : 'Error',
          message: data.error || 'Error', variant: 'error', icon: 'error',
        })
      }
    } catch {
      await alert({
        title: locale === 'th' ? 'บันทึกไม่สำเร็จ' : 'Error',
        message: locale === 'th' ? 'ไม่สามารถบันทึกได้' : 'Failed to save', variant: 'error', icon: 'error',
      })
    } finally {
      setPermSaving(false)
    }
  }

  const fetchSystemSettings = async () => {
    setSettingsLoading(true)
    try {
      const res = await fetch('/api/admin/system-settings')
      const data = await res.json()
      if (data.success && data.data?.settings) {
        setSystemSettings(data.data.settings)
      }
    } catch (error) {
      console.error('Failed to fetch system settings:', error)
    } finally {
      setSettingsLoading(false)
    }
  }

  const saveLabelSize = async () => {
    const width = Number(widthDraft)
    const height = Number(heightDraft)
    const widthOk = Number.isFinite(width) && width >= LABEL_WIDTH_MIN_MM && width <= LABEL_WIDTH_MAX_MM
    const heightOk = Number.isFinite(height) && height >= LABEL_HEIGHT_MIN_MM && height <= LABEL_HEIGHT_MAX_MM
    if (!widthOk || !heightOk) {
      await alert({
        title: locale === 'th' ? 'ค่าไม่ถูกต้อง' : 'Invalid value',
        message: locale === 'th'
          ? `กว้าง ${LABEL_WIDTH_MIN_MM}–${LABEL_WIDTH_MAX_MM} mm และ ยาว ${LABEL_HEIGHT_MIN_MM}–${LABEL_HEIGHT_MAX_MM} mm`
          : `Width ${LABEL_WIDTH_MIN_MM}–${LABEL_WIDTH_MAX_MM} mm and height ${LABEL_HEIGHT_MIN_MM}–${LABEL_HEIGHT_MAX_MM} mm`,
        variant: 'warning',
        icon: 'warning',
      })
      return
    }
    setSizeSaving(true)
    try {
      const patch = async (key: string, value: number) => {
        const res = await fetch('/api/admin/system-settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error || key)
      }
      await patch('label.widthMm', width)
      await patch('label.heightMm', height)
      setSystemSettings((prev) => ({ ...prev, 'label.widthMm': width, 'label.heightMm': height }))
      await alert({
        title: locale === 'th' ? 'สำเร็จ' : 'Saved',
        message: locale === 'th' ? 'บันทึกขนาดฉลากแล้ว' : 'Label size saved',
        variant: 'success',
        icon: 'success',
      })
    } catch (error) {
      console.error('Failed to save label size:', error)
      await alert({
        title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
        message: error instanceof Error ? `Error: ${error.message}` : 'Failed to save label size',
        variant: 'error',
        icon: 'error',
      })
    } finally {
      setSizeSaving(false)
    }
  }

  const updateSystemSetting = async (key: string, value: unknown) => {
    try {
      const res = await fetch('/api/admin/system-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      const data = await res.json()
      if (data.success) {
        setSystemSettings((prev) => ({ ...prev, [key]: value }))
      } else {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: `Error: ${data.error}`, variant: 'error', icon: 'error' })
      }
    } catch (error) {
      console.error('Failed to update system setting:', error)
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: 'Failed to update setting', variant: 'error', icon: 'error' })
    }
  }

  const fetchItems = async () => {
    setLoading(true)
    try {
      const res = await fetch(currentTab.endpoint)
      const data = await res.json()
      if (data.success && data.data) {
        // Get the array from the response (categories, units, shippingMethods, or warehouses)
        const itemsKey = Object.keys(data.data)[0]
        setItems(data.data[itemsKey] || [])
      }
    } catch (error) {
      console.error('Failed to fetch items:', error)
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditingItem(null)
    setFormData({
      nameTh: '',
      nameEn: '',
      name: '',
      serialCode: '',
      isActive: true,
    })
    setShowModal(true)
  }

  const openEditModal = (item: MasterItem) => {
    setEditingItem(item)
    setFormData({
      nameTh: item.nameTh || '',
      nameEn: item.nameEn || '',
      name: item.name || '',
      serialCode: item.serialCode || '',
      isActive: item.isActive,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingItem(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading(true)

    try {
      const isWarehouse = activeTab === 'warehouses'

      if (editingItem) {
        // Update
        const updateData: Record<string, unknown> = {
          id: editingItem.id,
          isActive: formData.isActive,
        }
        if (isWarehouse) {
          updateData.name = formData.name
        } else {
          updateData.nameTh = formData.nameTh
          updateData.nameEn = formData.nameEn || null
          if (activeTab === 'categories') {
            updateData.serialCode = formData.serialCode.toUpperCase()
          }
        }

        const res = await fetch(currentTab.endpoint, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        })
        const data = await res.json()
        if (data.success) {
          await alert({ title: locale === 'th' ? 'สำเร็จ' : 'Success', message: locale === 'th' ? 'อัปเดตสำเร็จ' : 'Updated successfully', variant: 'success', icon: 'success' })
          closeModal()
          fetchItems()
        } else {
          await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: `Error: ${data.error}`, variant: 'error', icon: 'error' })
        }
      } else {
        // Create
        const createData: Record<string, unknown> = {
          isActive: formData.isActive,
        }
        if (isWarehouse) {
          if (!formData.name) {
            await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'กรุณากรอกชื่อ' : 'Please enter name', variant: 'warning', icon: 'warning' })
            setActionLoading(false)
            return
          }
          createData.name = formData.name
        } else {
          if (!formData.nameTh) {
            await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'กรุณากรอกชื่อภาษาไทย' : 'Please enter Thai name', variant: 'warning', icon: 'warning' })
            setActionLoading(false)
            return
          }
          createData.nameTh = formData.nameTh
          createData.nameEn = formData.nameEn || null
          if (activeTab === 'categories') {
            if (!formData.serialCode || !/^[A-Za-z]$/.test(formData.serialCode)) {
              await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: locale === 'th' ? 'รหัส Serial ต้องเป็นตัวอักษร A-Z 1 ตัว' : 'Serial code must be a single letter A-Z', variant: 'warning', icon: 'warning' })
              setActionLoading(false)
              return
            }
            createData.serialCode = formData.serialCode.toUpperCase()
          }
        }

        const res = await fetch(currentTab.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createData),
        })
        const data = await res.json()
        if (data.success) {
          await alert({ title: locale === 'th' ? 'สำเร็จ' : 'Success', message: locale === 'th' ? 'เพิ่มสำเร็จ' : 'Created successfully', variant: 'success', icon: 'success' })
          closeModal()
          fetchItems()
        } else {
          await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: `Error: ${data.error}`, variant: 'error', icon: 'error' })
        }
      }
    } catch (error) {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: 'Failed to save', variant: 'error', icon: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleActive = async (item: MasterItem) => {
    try {
      const res = await fetch(currentTab.endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          isActive: !item.isActive,
        }),
      })
      const data = await res.json()
      if (data.success) {
        fetchItems()
      } else {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: `Error: ${data.error}`, variant: 'error', icon: 'error' })
      }
    } catch (error) {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: 'Failed to update', variant: 'error', icon: 'error' })
    }
  }

  const handleDelete = async (item: MasterItem) => {
    const itemName = item.name || item.nameTh || ''
    const confirmed = await confirm({
      title: locale === 'th' ? 'ลบข้อมูล' : 'Delete Item',
      message: locale === 'th'
        ? `ยืนยันการลบ "${itemName}"? การลบจะไม่สามารถกู้คืนได้`
        : `Confirm delete "${itemName}"? This action cannot be undone.`,
      confirmText: locale === 'th' ? 'ลบ' : 'Delete',
      cancelText: locale === 'th' ? 'ยกเลิก' : 'Cancel',
      variant: 'danger',
      icon: 'delete',
    })
    if (!confirmed) return

    try {
      const res = await fetch(currentTab.endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      })
      const data = await res.json()
      if (data.success) {
        await alert({ title: locale === 'th' ? 'สำเร็จ' : 'Success', message: locale === 'th' ? 'ลบสำเร็จ' : 'Deleted successfully', variant: 'success', icon: 'success' })
        fetchItems()
      } else {
        await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: `Error: ${data.error}`, variant: 'error', icon: 'error' })
      }
    } catch (error) {
      await alert({ title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error', message: 'Failed to delete', variant: 'error', icon: 'error' })
    }
  }

  const inputClass = "w-full px-4 py-2.5 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
  const labelClass = "block text-sm font-medium text-[var(--color-charcoal)] mb-1.5"

  const isWarehouse = activeTab === 'warehouses'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-display text-2xl font-bold text-[var(--color-charcoal)]">
          {locale === 'th' ? 'ตั้งค่าระบบ' : 'Settings'}
        </h1>
        <p className="text-[var(--color-foreground-muted)] mt-1">
          {locale === 'th' ? 'จัดการข้อมูลหลักของระบบ' : 'Manage system master data'}
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
        <div className="border-b border-[var(--color-beige)]">
          <nav className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors relative ${
                  activeTab === tab.key
                    ? 'text-[var(--color-gold)]'
                    : 'text-[var(--color-foreground-muted)] hover:text-[var(--color-charcoal)]'
                }`}
              >
                {locale === 'th' ? tab.labelTh : tab.labelEn}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-gold)]" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'permissions' ? (
            <div className="space-y-4">
              <div className="bg-[var(--color-off-white)] rounded-xl p-4">
                <h3 className="text-sm font-semibold text-[var(--color-charcoal)] mb-1">
                  {locale === 'th' ? 'สิทธิ์การเข้าถึงหน้าตาม Role' : 'Page Access by Role'}
                </h3>
                <p className="text-xs text-[var(--color-foreground-muted)]">
                  {locale === 'th'
                    ? 'กำหนดว่า role ไหนเข้าถึงหน้าไหนได้ (มีผลทั้งการแสดงเมนูและการกันเข้าหน้าจริง) — ADMIN มีสิทธิ์ทุกหน้าเสมอ'
                    : 'Configure which role can access which page (controls both menu visibility and route access). ADMIN always has access to every page.'}
                </p>
              </div>

              {permLoading ? (
                <div className="py-8 text-center">
                  <div className="w-6 h-6 mx-auto relative">
                    <div className="absolute inset-0 rounded-full border-2 border-[var(--color-beige)]" />
                    <div className="absolute inset-0 rounded-full border-2 border-[var(--color-gold)] border-t-transparent animate-spin" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto border border-[var(--color-beige)] rounded-xl">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                          <th className="px-4 py-3 text-left font-semibold text-[var(--color-charcoal)]">
                            {locale === 'th' ? 'หน้า' : 'Page'}
                          </th>
                          {permRoles.map((role) => (
                            <th key={role} className="px-4 py-3 text-center font-semibold text-[var(--color-charcoal)]">
                              {role}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-beige)]">
                        {permPages.map((page) => (
                          <tr key={page.key} className="hover:bg-[var(--color-off-white)]/50">
                            <td className="px-4 py-3 text-[var(--color-charcoal)]">
                              {locale === 'th' ? page.labelTh : page.labelEn}
                              {page.locked && (
                                <span className="ml-2 text-[10px] text-[var(--color-foreground-muted)]">
                                  ({locale === 'th' ? 'ทุก role' : 'all roles'})
                                </span>
                              )}
                            </td>
                            {permRoles.map((role) => (
                              <td key={role} className="px-4 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isPermChecked(page.key, role)}
                                  disabled={isPermLocked(page.key, role)}
                                  onChange={() => togglePerm(page.key, role)}
                                  className="w-4 h-4 accent-[var(--color-gold)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={savePermissions}
                      disabled={permSaving}
                      className="px-5 py-2.5 bg-[var(--color-gold)] text-white font-medium rounded-xl hover:bg-[var(--color-gold-dark)] disabled:opacity-50 transition-colors"
                    >
                      {permSaving ? (locale === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (locale === 'th' ? 'บันทึก' : 'Save')}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : activeTab === 'label' ? (
            <div className="space-y-6">
              <div className="bg-[var(--color-off-white)] rounded-xl p-4">
                <h3 className="text-sm font-semibold text-[var(--color-charcoal)] mb-1">
                  {locale === 'th' ? 'ขนาดฉลาก QR (กว้าง × ยาว)' : 'QR Label Size (Width × Height)'}
                </h3>
                <p className="text-xs text-[var(--color-foreground-muted)] mb-4">
                  {locale === 'th'
                    ? `กำหนดขนาดของฉลากแต่ละดวง (กรอบเส้นปะ) บนตาราง A4 — กว้าง ${LABEL_WIDTH_MIN_MM}–${LABEL_WIDTH_MAX_MM} mm, ยาว ${LABEL_HEIGHT_MIN_MM}–${LABEL_HEIGHT_MAX_MM} mm · QR จะปรับขนาดให้พอดีกรอบอัตโนมัติ — มีผลกับหน้า pre-generate, reprint, GRN, และ outbound`
                    : `Sets the size of each label (the dashed cut box) on the A4 grid — width ${LABEL_WIDTH_MIN_MM}–${LABEL_WIDTH_MAX_MM} mm, height ${LABEL_HEIGHT_MIN_MM}–${LABEL_HEIGHT_MAX_MM} mm. The QR auto-fits the box. Affects pre-generate, reprint, GRN, and outbound pages.`}
                </p>

                {settingsLoading ? (
                  <div className="py-4 text-center">
                    <div className="w-6 h-6 mx-auto relative">
                      <div className="absolute inset-0 rounded-full border-2 border-[var(--color-beige)]" />
                      <div className="absolute inset-0 rounded-full border-2 border-[var(--color-gold)] border-t-transparent animate-spin" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-end gap-3">
                      <div className="flex-1 max-w-[10rem]">
                        <label className={labelClass}>
                          {locale === 'th' ? 'กว้าง (mm)' : 'Width (mm)'}
                        </label>
                        <input
                          type="number"
                          min={LABEL_WIDTH_MIN_MM}
                          max={LABEL_WIDTH_MAX_MM}
                          step={1}
                          value={widthDraft}
                          onChange={(e) => setWidthDraft(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="flex-1 max-w-[10rem]">
                        <label className={labelClass}>
                          {locale === 'th' ? 'ยาว (mm)' : 'Height (mm)'}
                        </label>
                        <input
                          type="number"
                          min={LABEL_HEIGHT_MIN_MM}
                          max={LABEL_HEIGHT_MAX_MM}
                          step={1}
                          value={heightDraft}
                          onChange={(e) => setHeightDraft(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={saveLabelSize}
                        disabled={
                          sizeSaving ||
                          (widthDraft === String(systemSettings['label.widthMm']) &&
                            heightDraft === String(systemSettings['label.heightMm']))
                        }
                        className="px-6 py-2.5 bg-[var(--color-gold)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {sizeSaving
                          ? (locale === 'th' ? 'กำลังบันทึก...' : 'Saving...')
                          : (locale === 'th' ? 'บันทึก' : 'Save')}
                      </button>
                    </div>

                    {(() => {
                      const w = Number(widthDraft)
                      const h = Number(heightDraft)
                      const widthOk = Number.isFinite(w) && w >= LABEL_WIDTH_MIN_MM && w <= LABEL_WIDTH_MAX_MM
                      const heightOk = Number.isFinite(h) && h >= LABEL_HEIGHT_MIN_MM && h <= LABEL_HEIGHT_MAX_MM
                      const valid = widthOk && heightOk
                      const cols = valid ? calcLabelColumns(w) : 0
                      const rows = valid ? calcLabelRows(h) : 0
                      const qr = valid ? calcFitQrMm(w, h) : 0
                      const qrSmall = valid && qr < 12
                      return (
                        <div className="rounded-lg border border-[var(--color-beige)] bg-white p-3 text-xs">
                          <div className="font-semibold text-[var(--color-charcoal)] mb-1">
                            {locale === 'th' ? 'ตัวอย่าง' : 'Preview'}
                          </div>
                          {valid ? (
                            <div className="text-[var(--color-foreground-muted)]">
                              {locale === 'th'
                                ? `ฉลาก ${w}×${h} mm → ${cols} คอลัมน์ × ${rows} แถว = ${cols * rows} ดวง/แผ่น A4 · QR ~${qr.toFixed(0)} mm`
                                : `Label ${w}×${h} mm → ${cols} cols × ${rows} rows = ${cols * rows} per A4 sheet · QR ~${qr.toFixed(0)} mm`}
                            </div>
                          ) : (
                            <div className="text-red-600">
                              {locale === 'th'
                                ? `กว้างต้อง ${LABEL_WIDTH_MIN_MM}–${LABEL_WIDTH_MAX_MM} mm และ ยาว ${LABEL_HEIGHT_MIN_MM}–${LABEL_HEIGHT_MAX_MM} mm`
                                : `Width must be ${LABEL_WIDTH_MIN_MM}–${LABEL_WIDTH_MAX_MM} mm and height ${LABEL_HEIGHT_MIN_MM}–${LABEL_HEIGHT_MAX_MM} mm`}
                            </div>
                          )}
                          {qrSmall && (
                            <div className="text-amber-600 mt-1">
                              {locale === 'th'
                                ? '⚠️ กรอบเล็ก QR อาจสแกนยาก — แนะนำเพิ่มขนาดให้ QR ≥ 12 mm'
                                : '⚠️ Box is small; the QR may be hard to scan — increase size so QR ≥ 12 mm'}
                            </div>
                          )}
                          <div className="text-[10px] text-[var(--color-foreground-muted)] mt-1">
                            {locale === 'th'
                              ? `ค่าปัจจุบัน: ${systemSettings['label.widthMm']}×${systemSettings['label.heightMm']} mm`
                              : `Current: ${systemSettings['label.widthMm']}×${systemSettings['label.heightMm']} mm`}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'display' ? (
            <div className="space-y-6">
              <div className="bg-[var(--color-off-white)] rounded-xl p-4">
                <h3 className="text-sm font-semibold text-[var(--color-charcoal)] mb-4">
                  {locale === 'th' ? 'หน้าตรวจสอบสินค้า (Verify)' : 'Product Verification Page'}
                </h3>

                {settingsLoading ? (
                  <div className="py-4 text-center">
                    <div className="w-6 h-6 mx-auto relative">
                      <div className="absolute inset-0 rounded-full border-2 border-[var(--color-beige)]" />
                      <div className="absolute inset-0 rounded-full border-2 border-[var(--color-gold)] border-t-transparent animate-spin" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Show Clinic Name Toggle */}
                    <div className="flex items-center justify-between py-3 border-b border-[var(--color-beige)]">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-charcoal)]">
                          {locale === 'th' ? 'แสดงชื่อคลินิก' : 'Show Clinic Name'}
                        </p>
                        <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">
                          {locale === 'th'
                            ? 'แสดงชื่อคลินิกบนหน้าตรวจสอบสินค้า'
                            : 'Display clinic name on product verification page'}
                        </p>
                      </div>
                      <button
                        onClick={() => updateSystemSetting('verify.showClinicName', !systemSettings['verify.showClinicName'])}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                          systemSettings['verify.showClinicName']
                            ? 'bg-[var(--color-gold)]'
                            : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                            systemSettings['verify.showClinicName'] ? 'translate-x-6' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {/* Show Branch Info Toggle */}
                    <div className="flex items-center justify-between py-3 border-b border-[var(--color-beige)]">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-charcoal)]">
                          {locale === 'th' ? 'แสดงข้อมูลสาขา' : 'Show Branch Info'}
                        </p>
                        <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">
                          {locale === 'th'
                            ? 'แสดงชื่อสาขาบนหน้าตรวจสอบสินค้า'
                            : 'Display branch name on product verification page'}
                        </p>
                      </div>
                      <button
                        onClick={() => updateSystemSetting('verify.showBranchInfo', !systemSettings['verify.showBranchInfo'])}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                          systemSettings['verify.showBranchInfo']
                            ? 'bg-[var(--color-gold)]'
                            : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                            systemSettings['verify.showBranchInfo'] ? 'translate-x-6' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {/* Show Clinic Address Toggle */}
                    <div className="flex items-center justify-between py-3 border-b border-[var(--color-beige)]">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-charcoal)]">
                          {locale === 'th' ? 'แสดงที่อยู่คลินิก' : 'Show Clinic Address'}
                        </p>
                        <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">
                          {locale === 'th'
                            ? 'แสดงที่อยู่คลินิกบนหน้าตรวจสอบสินค้า'
                            : 'Display clinic address on product verification page'}
                        </p>
                      </div>
                      <button
                        onClick={() => updateSystemSetting('verify.showClinicAddress', !systemSettings['verify.showClinicAddress'])}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                          systemSettings['verify.showClinicAddress']
                            ? 'bg-[var(--color-gold)]'
                            : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                            systemSettings['verify.showClinicAddress'] ? 'translate-x-6' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Add Button */}
              <div className="flex justify-end mb-4">
                <button
                  onClick={openCreateModal}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--color-gold)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] hover:-translate-y-0.5 transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {locale === 'th' ? 'เพิ่ม' : 'Add'}
                </button>
              </div>

              {/* Table */}
              {loading ? (
            <div className="py-12 text-center">
              <div className="w-10 h-10 mx-auto mb-3 relative">
                <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
                <div className="absolute inset-0 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin" />
              </div>
              <p className="text-[var(--color-foreground-muted)]">
                {locale === 'th' ? 'กำลังโหลด...' : 'Loading...'}
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-beige)]/50 flex items-center justify-center">
                <svg className="w-8 h-8 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-[var(--color-foreground-muted)]">
                {locale === 'th' ? 'ยังไม่มีข้อมูล' : 'No data found'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                    {isWarehouse ? (
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                        {locale === 'th' ? 'ชื่อ' : 'Name'}
                      </th>
                    ) : (
                      <>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                          {locale === 'th' ? 'ชื่อ (ไทย)' : 'Name (Thai)'}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                          {locale === 'th' ? 'ชื่อ (อังกฤษ)' : 'Name (English)'}
                        </th>
                        {activeTab === 'categories' && (
                          <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                            {locale === 'th' ? 'รหัส Serial' : 'Serial Code'}
                          </th>
                        )}
                      </>
                    )}
                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'สถานะ' : 'Status'}
                    </th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-beige)]">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-[var(--color-off-white)]/50 transition-colors">
                      {isWarehouse ? (
                        <td className="px-4 py-3 font-medium text-[var(--color-charcoal)]">
                          {item.name}
                        </td>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-medium text-[var(--color-charcoal)]">
                            {item.nameTh}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-charcoal)]">
                            {item.nameEn || <span className="text-[var(--color-foreground-muted)]">-</span>}
                          </td>
                          {activeTab === 'categories' && (
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-gold)]/10 text-[var(--color-gold)] font-bold font-mono">
                                {item.serialCode || '-'}
                              </span>
                            </td>
                          )}
                        </>
                      )}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleActive(item)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            item.isActive
                              ? 'bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)] hover:bg-[var(--color-mint)]/20'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${item.isActive ? 'bg-[var(--color-mint)]' : 'bg-gray-400'}`} />
                          {item.isActive
                            ? (locale === 'th' ? 'ใช้งาน' : 'Active')
                            : (locale === 'th' ? 'ปิดใช้งาน' : 'Inactive')
                          }
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-2 text-[var(--color-gold)] hover:bg-[var(--color-gold)]/10 rounded-lg transition-colors"
                            title={locale === 'th' ? 'แก้ไข' : 'Edit'}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title={locale === 'th' ? 'ลบ' : 'Delete'}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
              {editingItem
                ? (locale === 'th' ? 'แก้ไข' : 'Edit')
                : (locale === 'th' ? 'เพิ่มใหม่' : 'Add New')
              } {locale === 'th' ? currentTab.labelTh : currentTab.labelEn}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isWarehouse ? (
                <div>
                  <label className={labelClass}>
                    {locale === 'th' ? 'ชื่อ' : 'Name'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={inputClass}
                    placeholder={locale === 'th' ? 'ชื่อคลังสินค้า' : 'Warehouse name'}
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className={labelClass}>
                      {locale === 'th' ? 'ชื่อ (ไทย)' : 'Name (Thai)'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.nameTh}
                      onChange={(e) => setFormData({ ...formData, nameTh: e.target.value })}
                      className={inputClass}
                      placeholder={locale === 'th' ? 'ชื่อภาษาไทย' : 'Thai name'}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      {locale === 'th' ? 'ชื่อ (อังกฤษ)' : 'Name (English)'}
                      <span className="text-[var(--color-foreground-muted)] font-normal ml-1">
                        ({locale === 'th' ? 'ไม่จำเป็น' : 'Optional'})
                      </span>
                    </label>
                    <input
                      type="text"
                      value={formData.nameEn}
                      onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                      className={inputClass}
                      placeholder={locale === 'th' ? 'ชื่อภาษาอังกฤษ' : 'English name'}
                    />
                  </div>
                  {activeTab === 'categories' && (
                    <div>
                      <label className={labelClass}>
                        {locale === 'th' ? 'รหัส Serial' : 'Serial Code'} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.serialCode}
                        onChange={(e) => setFormData({ ...formData, serialCode: e.target.value.toUpperCase().slice(0, 1) })}
                        className={`${inputClass} font-mono text-center tracking-widest uppercase`}
                        placeholder="A-Z"
                        maxLength={1}
                      />
                      <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
                        {locale === 'th' ? 'ตัวอักษร A-Z 1 ตัว ใช้เป็นส่วนหนึ่งของ Serial Number' : 'Single letter A-Z, used as part of Serial Number'}
                      </p>
                    </div>
                  )}
                </>
              )}

              {editingItem && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-[var(--color-beige)] text-[var(--color-gold)] focus:ring-[var(--color-gold)]"
                  />
                  <label htmlFor="isActive" className="text-sm text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'เปิดใช้งาน' : 'Active'}
                  </label>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4">
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
                      {locale === 'th' ? 'กำลังบันทึก...' : 'Saving...'}
                    </span>
                  ) : (
                    locale === 'th' ? 'บันทึก' : 'Save'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
