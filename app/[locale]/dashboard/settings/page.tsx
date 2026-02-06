'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useConfirm, useAlert } from '@/components/ui/confirm-modal'

type TabType = 'categories' | 'units' | 'shipping' | 'warehouses' | 'display'

interface MasterItem {
  id: number
  nameTh?: string
  nameEn?: string | null
  name?: string
  isActive: boolean
}

interface SystemSettings {
  'verify.showClinicInfo': boolean
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
    'verify.showClinicInfo': true,
  })
  const [settingsLoading, setSettingsLoading] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    nameTh: '',
    nameEn: '',
    name: '',
    isActive: true,
  })

  const tabs: { key: TabType; labelTh: string; labelEn: string; endpoint: string }[] = [
    { key: 'categories', labelTh: 'หมวดหมู่สินค้า', labelEn: 'Categories', endpoint: '/api/admin/masters/categories' },
    { key: 'units', labelTh: 'หน่วยนับ', labelEn: 'Units', endpoint: '/api/admin/masters/units' },
    { key: 'shipping', labelTh: 'วิธีการจัดส่ง', labelEn: 'Shipping Methods', endpoint: '/api/admin/masters/shipping-methods' },
    { key: 'warehouses', labelTh: 'คลังสินค้า', labelEn: 'Warehouses', endpoint: '/api/admin/masters/warehouses' },
    { key: 'display', labelTh: 'การแสดงผล', labelEn: 'Display', endpoint: '' },
  ]

  const currentTab = tabs.find((t) => t.key === activeTab)!

  useEffect(() => {
    if (activeTab === 'display') {
      fetchSystemSettings()
    } else {
      fetchItems()
    }
  }, [activeTab])

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
          {/* Display Settings Tab */}
          {activeTab === 'display' ? (
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
                    {/* Show Clinic Info Toggle */}
                    <div className="flex items-center justify-between py-3 border-b border-[var(--color-beige)]">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-charcoal)]">
                          {locale === 'th' ? 'แสดงข้อมูลคลินิก/สาขา' : 'Show Clinic/Branch Info'}
                        </p>
                        <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">
                          {locale === 'th'
                            ? 'แสดงชื่อคลินิกและจังหวัดบนหน้าตรวจสอบสินค้าสาธารณะ'
                            : 'Display clinic name and province on public verification page'}
                        </p>
                      </div>
                      <button
                        onClick={() => updateSystemSetting('verify.showClinicInfo', !systemSettings['verify.showClinicInfo'])}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                          systemSettings['verify.showClinicInfo']
                            ? 'bg-[var(--color-gold)]'
                            : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                            systemSettings['verify.showClinicInfo'] ? 'translate-x-6' : ''
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
