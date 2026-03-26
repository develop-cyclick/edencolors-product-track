'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useConfirm, useAlert } from '@/components/ui/confirm-modal'

interface ProductMaster {
  id: number
  sku: string
  serialCode: string
  nameTh: string
  nameEn: string | null
  imageUrl: string | null
  modelSize: string | null
  description: string | null
  activationType: 'SINGLE' | 'PACK'
  maxActivations: number
  isActive: boolean
  category: { id: number; nameTh: string; nameEn: string; serialCode: string }
  defaultUnit: { id: number; nameTh: string; nameEn: string } | null
  stats: {
    total: number
    inStock: number
    pendingOut: number
    shipped: number
    activated: number
    returned: number
  }
}

interface Category {
  id: number
  nameTh: string
  nameEn: string
  serialCode: string
}

export default function ProductMasterPage() {
  const params = useParams()
  const locale = params.locale as string
  const confirm = useConfirm()
  const alert = useAlert()

  const [productMasters, setProductMasters] = useState<ProductMaster[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ProductMaster | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [userRole, setUserRole] = useState<string>('')

  const [formData, setFormData] = useState({
    sku: '',
    serialCode: '',
    nameTh: '',
    nameEn: '',
    imageUrl: '',
    categoryId: '',
    modelSize: '',
    description: '',
    defaultUnitId: '',
    activationType: 'SINGLE' as 'SINGLE' | 'PACK',
    maxActivations: 1,
  })
  const [uploadingImage, setUploadingImage] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [units, setUnits] = useState<{ id: number; nameTh: string; nameEn: string }[]>([])

  const fetchProductMasters = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        ...(search && { search }),
        ...(categoryFilter && { categoryId: categoryFilter }),
      })
      const res = await fetch(`/api/admin/masters/products?${params}`)
      const data = await res.json()
      if (data.success && data.data) {
        setProductMasters(data.data.productMasters || [])
      }
    } catch (error) {
      console.error('Failed to fetch product masters:', error)
    } finally {
      setLoading(false)
    }
  }, [search, categoryFilter])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/masters/categories')
      const data = await res.json()
      if (data.success && data.data) {
        setCategories(data.data.categories || [])
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }, [])

  const fetchUnits = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/masters/units')
      const data = await res.json()
      if (data.success && data.data) {
        setUnits(data.data.units || [])
      }
    } catch (error) {
      console.error('Failed to fetch units:', error)
    }
  }, [])

  const fetchUserRole = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      if (data.success && data.data?.user) {
        setUserRole(data.data.user.role)
      }
    } catch (error) {
      console.error('Failed to fetch user role:', error)
    }
  }, [])

  useEffect(() => {
    fetchProductMasters()
    fetchCategories()
    fetchUnits()
    fetchUserRole()
  }, [fetchProductMasters, fetchCategories, fetchUnits, fetchUserRole])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchProductMasters()
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formDataUpload,
      })

      const data = await res.json()
      if (data.success && data.data?.url) {
        setFormData({ ...formData, imageUrl: data.data.url })
      } else {
        await alert({ title: locale === 'th' ? 'อัพโหลดล้มเหลว' : 'Upload Failed', message: data.error || 'Upload failed', variant: 'error', icon: 'error' })
      }
    } catch (error) {
      console.error('Upload error:', error)
      await alert({ title: locale === 'th' ? 'อัพโหลดล้มเหลว' : 'Upload Failed', message: locale === 'th' ? 'ไม่สามารถอัพโหลดได้' : 'Upload failed', variant: 'error', icon: 'error' })
    } finally {
      setUploadingImage(false)
    }
  }

  const openCreateModal = () => {
    setEditingItem(null)
    setFormData({
      sku: '',
      serialCode: '',
      nameTh: '',
      nameEn: '',
      imageUrl: '',
      categoryId: '',
      modelSize: '',
      description: '',
      defaultUnitId: '',
      activationType: 'SINGLE',
      maxActivations: 1,
    })
    setShowModal(true)
  }

  const openEditModal = (pm: ProductMaster) => {
    setEditingItem(pm)
    setFormData({
      sku: pm.sku,
      serialCode: pm.serialCode || '',
      nameTh: pm.nameTh,
      nameEn: pm.nameEn || '',
      imageUrl: pm.imageUrl || '',
      categoryId: pm.category.id.toString(),
      modelSize: pm.modelSize || '',
      description: pm.description || '',
      defaultUnitId: pm.defaultUnit?.id.toString() || '',
      activationType: pm.activationType || 'SINGLE',
      maxActivations: pm.maxActivations || 1,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading(true)

    try {
      const method = editingItem ? 'PATCH' : 'POST'
      const body = editingItem
        ? {
            id: editingItem.id,
            ...formData,
            imageUrl: formData.imageUrl || null,
            categoryId: parseInt(formData.categoryId),
            defaultUnitId: formData.defaultUnitId ? parseInt(formData.defaultUnitId) : null,
            maxActivations: formData.activationType === 'PACK' ? formData.maxActivations : 1,
          }
        : {
            ...formData,
            imageUrl: formData.imageUrl || null,
            categoryId: parseInt(formData.categoryId),
            defaultUnitId: formData.defaultUnitId ? parseInt(formData.defaultUnitId) : null,
            maxActivations: formData.activationType === 'PACK' ? formData.maxActivations : 1,
          }

      const res = await fetch('/api/admin/masters/products', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (data.success) {
        setShowModal(false)
        fetchProductMasters()
      } else {
        await alert({ title: locale === 'th' ? 'บันทึกล้มเหลว' : 'Save Failed', message: data.error || 'Failed to save', variant: 'error', icon: 'error' })
      }
    } catch (error) {
      console.error('Submit error:', error)
      await alert({ title: locale === 'th' ? 'บันทึกล้มเหลว' : 'Save Failed', message: locale === 'th' ? 'ไม่สามารถบันทึกได้' : 'Failed to save', variant: 'error', icon: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async (pm: ProductMaster) => {
    const confirmed = await confirm({
      title: locale === 'th' ? 'ลบสินค้า' : 'Delete Product',
      message: locale === 'th'
        ? `ต้องการลบ "${pm.nameTh}" หรือไม่?`
        : `Delete "${pm.nameTh}"?`,
      confirmText: locale === 'th' ? 'ลบ' : 'Delete',
      cancelText: locale === 'th' ? 'ยกเลิก' : 'Cancel',
      variant: 'danger',
      icon: 'delete',
    })
    if (!confirmed) return

    try {
      const res = await fetch('/api/admin/masters/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pm.id }),
      })

      const data = await res.json()
      if (data.success) {
        fetchProductMasters()
      } else {
        await alert({ title: locale === 'th' ? 'ลบล้มเหลว' : 'Delete Failed', message: data.error || 'Failed to delete', variant: 'error', icon: 'error' })
      }
    } catch (error) {
      console.error('Delete error:', error)
      await alert({ title: locale === 'th' ? 'ลบล้มเหลว' : 'Delete Failed', message: locale === 'th' ? 'ไม่สามารถลบได้' : 'Failed to delete', variant: 'error', icon: 'error' })
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch(`/api/admin/masters/products/export?locale=${locale}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `products-overview-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      await alert({ title: locale === 'th' ? 'ส่งออกล้มเหลว' : 'Export Failed', message: locale === 'th' ? 'ไม่สามารถส่งออก Excel ได้' : 'Failed to export Excel', variant: 'error', icon: 'error' })
    } finally {
      setExporting(false)
    }
  }

  const isAdmin = userRole === 'ADMIN'

  const overallStats = useMemo(() => {
    return productMasters.reduce(
      (acc, pm) => ({
        total: acc.total + pm.stats.total,
        inStock: acc.inStock + pm.stats.inStock,
        pendingOut: acc.pendingOut + pm.stats.pendingOut,
        shipped: acc.shipped + pm.stats.shipped,
        activated: acc.activated + pm.stats.activated,
        returned: acc.returned + pm.stats.returned,
      }),
      { total: 0, inStock: 0, pendingOut: 0, shipped: 0, activated: 0, returned: 0 }
    )
  }, [productMasters])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-display text-2xl font-bold text-[var(--color-charcoal)]">
            {locale === 'th' ? 'รายการสินค้า' : 'Product Catalog'}
          </h1>
          <p className="text-[var(--color-foreground-muted)] mt-1">
            {locale === 'th' ? 'จัดการข้อมูลหลักสินค้าในระบบ' : 'Manage product master data'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-[var(--color-charcoal)] border border-[var(--color-beige)] rounded-xl font-medium hover:bg-[var(--color-off-white)] hover:-translate-y-0.5 hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)] disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-200"
          >
            {exporting ? (
              <div className="w-5 h-5 border-2 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            {exporting
              ? (locale === 'th' ? 'กำลังส่งออก...' : 'Exporting...')
              : (locale === 'th' ? 'ส่งออก Excel' : 'Export Excel')}
          </button>
          {isAdmin && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-gold)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(201,163,90,0.35)] transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {locale === 'th' ? 'เพิ่มสินค้าใหม่' : 'Add Product'}
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats Cards */}
      {!loading && productMasters.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          <div className="bg-[var(--color-off-white)] rounded-xl p-4 border border-[var(--color-beige)]">
            <p className="text-sm text-[var(--color-charcoal)]">{locale === 'th' ? 'ทั้งหมด' : 'Total'}</p>
            <p className="text-2xl font-bold text-[var(--color-charcoal)] mt-1">{overallStats.total.toLocaleString()}</p>
          </div>
          <div className="bg-[var(--color-mint)]/10 rounded-xl p-4 border border-[var(--color-mint)]/20">
            <p className="text-sm text-[var(--color-mint-dark)]">{locale === 'th' ? 'ในคลัง' : 'In Stock'}</p>
            <p className="text-2xl font-bold text-[var(--color-mint-dark)] mt-1">{overallStats.inStock.toLocaleString()}</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <p className="text-sm text-amber-600">{locale === 'th' ? 'รอส่งออก' : 'Pending Out'}</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{overallStats.pendingOut.toLocaleString()}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <p className="text-sm text-blue-600">{locale === 'th' ? 'ส่งออกแล้ว' : 'Shipped'}</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{overallStats.shipped.toLocaleString()}</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
            <p className="text-sm text-purple-600">{locale === 'th' ? 'เปิดใช้แล้ว' : 'Activated'}</p>
            <p className="text-2xl font-bold text-purple-700 mt-1">{overallStats.activated.toLocaleString()}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4 border border-red-200">
            <p className="text-sm text-red-600">{locale === 'th' ? 'รับคืน' : 'Returned'}</p>
            <p className="text-2xl font-bold text-red-700 mt-1">{overallStats.returned.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-5">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={locale === 'th' ? 'ค้นหา SKU, ชื่อสินค้า...' : 'Search SKU, Name...'}
                className="w-full pl-10 pr-4 py-2.5 border border-[var(--color-beige)] rounded-xl focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)] transition-all bg-[var(--color-off-white)]"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-[var(--color-beige)] rounded-xl focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)] transition-all bg-[var(--color-off-white)]"
            >
              <option value="">{locale === 'th' ? 'ทุกหมวดหมู่' : 'All Categories'}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {locale === 'th' ? cat.nameTh : cat.nameEn}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 bg-[var(--color-gold)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(201,163,90,0.35)] transition-all duration-200"
          >
            {locale === 'th' ? 'ค้นหา' : 'Search'}
          </button>
        </form>
      </div>

      {/* Product Masters Grid */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 relative">
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-beige)]" />
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-gold)] border-t-transparent animate-spin" />
            </div>
          </div>
        ) : productMasters.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-beige)]/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-[var(--color-foreground-muted)]">
              {locale === 'th' ? 'ไม่พบสินค้า' : 'No products found'}
            </p>
            {isAdmin && (
              <button
                onClick={openCreateModal}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-[var(--color-gold)] hover:bg-[var(--color-gold)]/10 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {locale === 'th' ? 'เพิ่มสินค้าใหม่' : 'Add first product'}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                  <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)] w-16">
                    {locale === 'th' ? 'รูป' : 'Image'}
                  </th>
                  <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">SKU</th>
                  <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">Serial Prefix</th>
                  <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'ชื่อสินค้า' : 'Product Name'}
                  </th>
                  <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'หมวดหมู่' : 'Category'}
                  </th>
                  <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'รุ่น/ขนาด' : 'Model/Size'}
                  </th>
                  <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'หน่วย' : 'Unit'}
                  </th>
                  <th className="px-5 py-4 text-center text-sm font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'ประเภท Activate' : 'Activation'}
                  </th>
                  <th className="px-5 py-4 text-center text-sm font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'ในคลัง' : 'In Stock'}
                  </th>
                  <th className="px-5 py-4 text-center text-sm font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'ทั้งหมด' : 'Total'}
                  </th>
                  <th className="px-5 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-beige)]">
                {productMasters.map((pm) => (
                  <tr key={pm.id} className="hover:bg-[var(--color-off-white)]/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="w-12 h-12 rounded-lg bg-[var(--color-off-white)] border border-[var(--color-beige)] overflow-hidden flex items-center justify-center">
                        {pm.imageUrl ? (
                          <img
                            src={pm.imageUrl}
                            alt={pm.nameTh}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <svg className="w-6 h-6 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-sm font-medium text-[var(--color-charcoal)]">{pm.sku}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-sm text-[var(--color-gold)]">
                        <span className="text-[var(--color-foreground-muted)]">{pm.category.serialCode}</span>{pm.serialCode}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-[var(--color-charcoal)]">
                        {locale === 'th' ? pm.nameTh : (pm.nameEn || pm.nameTh)}
                      </div>
                      {!pm.isActive && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 mt-1">
                          {locale === 'th' ? 'ไม่ใช้งาน' : 'Inactive'}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">
                      {locale === 'th' ? pm.category.nameTh : pm.category.nameEn}
                    </td>
                    <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">
                      {pm.modelSize || '-'}
                    </td>
                    <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">
                      {pm.defaultUnit ? (locale === 'th' ? pm.defaultUnit.nameTh : pm.defaultUnit.nameEn) : <span className="text-red-500">-</span>}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {pm.activationType === 'PACK' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          Pack ({pm.maxActivations})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Single
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-full text-sm font-medium ${
                        pm.stats.inStock > 0
                          ? 'bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {pm.stats.inStock}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-sm text-[var(--color-foreground-muted)]">{pm.stats.total}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/${locale}/dashboard/products/${pm.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-center text-[var(--color-gold)] hover:bg-[var(--color-gold)]/10 rounded-lg font-medium transition-colors"
                        >
                          {locale === 'th' ? 'รายละเอียด' : 'View Items'}
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => openEditModal(pm)}
                              className="p-2 text-[var(--color-foreground-muted)] hover:text-[var(--color-charcoal)] hover:bg-[var(--color-off-white)] rounded-lg transition-colors"
                              title={locale === 'th' ? 'แก้ไข' : 'Edit'}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(pm)}
                              className="p-2 text-[var(--color-foreground-muted)] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title={locale === 'th' ? 'ลบ' : 'Delete'}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={() => setShowModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
              <h3 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
                {editingItem
                  ? (locale === 'th' ? 'แก้ไขสินค้า' : 'Edit Product')
                  : (locale === 'th' ? 'เพิ่มสินค้าใหม่' : 'Add New Product')}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-2">
                    {locale === 'th' ? 'รูปสินค้า' : 'Product Image'}
                  </label>
                  <div className="flex items-start gap-4">
                    {/* Preview */}
                    <div className="w-24 h-24 rounded-xl border-2 border-dashed border-[var(--color-beige)] bg-[var(--color-off-white)] flex items-center justify-center overflow-hidden">
                      {formData.imageUrl ? (
                        <img
                          src={formData.imageUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <svg className="w-8 h-8 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                    {/* Upload Button */}
                    <div className="flex-1">
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-lg hover:bg-[var(--color-beige)] transition-colors">
                        {uploadingImage ? (
                          <>
                            <div className="w-4 h-4 border-2 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm">{locale === 'th' ? 'กำลังอัพโหลด...' : 'Uploading...'}</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            <span className="text-sm">{locale === 'th' ? 'เลือกรูป' : 'Choose Image'}</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                          className="hidden"
                        />
                      </label>
                      {formData.imageUrl && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, imageUrl: '' })}
                          className="ml-2 text-sm text-red-500 hover:text-red-700"
                        >
                          {locale === 'th' ? 'ลบรูป' : 'Remove'}
                        </button>
                      )}
                      <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
                        JPG, PNG, WebP {locale === 'th' ? 'ไม่เกิน' : 'max'} 5MB
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1">
                      SKU <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-[var(--color-beige)] rounded-lg focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]"
                      required
                      placeholder="e.g., FIL-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1">
                      Serial Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.serialCode}
                      onChange={(e) => setFormData({ ...formData, serialCode: e.target.value.toUpperCase().slice(0, 5) })}
                      className="w-full px-3 py-2 border border-[var(--color-beige)] rounded-lg focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)] font-mono"
                      required
                      maxLength={5}
                      pattern="[A-Z0-9]{5}"
                      placeholder="e.g., BBN01"
                    />
                    <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
                      {locale === 'th' ? '5 ตัวอักษร (A-Z, 0-9)' : '5 chars (A-Z, 0-9)'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1">
                      {locale === 'th' ? 'หมวดหมู่' : 'Category'} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      className="w-full px-3 py-2 border border-[var(--color-beige)] rounded-lg focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]"
                      required
                    >
                      <option value="">{locale === 'th' ? 'เลือกหมวดหมู่' : 'Select category'}</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          [{cat.serialCode}] {locale === 'th' ? cat.nameTh : cat.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Serial Preview */}
                  {formData.serialCode && formData.categoryId && (
                    <div className="col-span-full">
                      <div className="px-4 py-3 bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-lg">
                        <p className="text-xs text-[var(--color-foreground-muted)] mb-1">
                          {locale === 'th' ? 'ตัวอย่าง Serial' : 'Serial Preview'}
                        </p>
                        <p className="font-mono text-sm font-medium text-[var(--color-charcoal)]">
                          <span className="text-blue-600">{formData.activationType === 'SINGLE' ? 'S' : 'P'}</span>
                          <span className="text-purple-600">{categories.find(c => c.id.toString() === formData.categoryId)?.serialCode || '?'}</span>
                          <span className="text-[var(--color-gold)]">{formData.serialCode.padEnd(5, '_')}</span>
                          <span className="text-[var(--color-foreground-muted)]">{'0'.repeat(12)}</span>
                        </p>
                        <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
                          <span className="text-blue-600">{locale === 'th' ? 'ประเภท' : 'Type'}</span>
                          {' + '}
                          <span className="text-purple-600">{locale === 'th' ? 'หมวดหมู่' : 'Category'}</span>
                          {' + '}
                          <span className="text-[var(--color-gold)]">Serial Code</span>
                          {' + '}
                          <span className="text-[var(--color-foreground-muted)]">{locale === 'th' ? 'ลำดับ' : 'Sequence'}</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1">
                    {locale === 'th' ? 'ชื่อสินค้า (ไทย)' : 'Product Name (Thai)'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nameTh}
                    onChange={(e) => setFormData({ ...formData, nameTh: e.target.value })}
                    className="w-full px-3 py-2 border border-[var(--color-beige)] rounded-lg focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1">
                    {locale === 'th' ? 'ชื่อสินค้า (อังกฤษ)' : 'Product Name (English)'}
                  </label>
                  <input
                    type="text"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    className="w-full px-3 py-2 border border-[var(--color-beige)] rounded-lg focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1">
                      {locale === 'th' ? 'รุ่น/ขนาด' : 'Model/Size'}
                    </label>
                    <input
                      type="text"
                      value={formData.modelSize}
                      onChange={(e) => setFormData({ ...formData, modelSize: e.target.value })}
                      className="w-full px-3 py-2 border border-[var(--color-beige)] rounded-lg focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]"
                      placeholder="e.g., 1ml, 50g"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1">
                      {locale === 'th' ? 'หน่วย' : 'Unit'} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.defaultUnitId}
                      onChange={(e) => setFormData({ ...formData, defaultUnitId: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-[var(--color-beige)] rounded-lg focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]"
                    >
                      <option value="" disabled>{locale === 'th' ? '-- เลือกหน่วย --' : '-- Select unit --'}</option>
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {locale === 'th' ? unit.nameTh : unit.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1">
                    {locale === 'th' ? 'รายละเอียด' : 'Description'}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-[var(--color-beige)] rounded-lg focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]"
                    rows={3}
                  />
                </div>
                {/* Activation Type */}
                <div className="bg-[var(--color-off-white)] rounded-xl p-4 space-y-3">
                  <label className="block text-sm font-medium text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'ประเภทการ Activate' : 'Activation Type'}
                  </label>
                  <div className="flex gap-4">
                    <label className={`flex-1 cursor-pointer rounded-lg border-2 p-3 transition-all ${
                      formData.activationType === 'SINGLE'
                        ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/5'
                        : 'border-[var(--color-beige)] hover:border-[var(--color-gold)]/50'
                    }`}>
                      <input
                        type="radio"
                        name="activationType"
                        value="SINGLE"
                        checked={formData.activationType === 'SINGLE'}
                        onChange={(e) => setFormData({ ...formData, activationType: e.target.value as 'SINGLE' | 'PACK', maxActivations: 1 })}
                        className="sr-only"
                      />
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          formData.activationType === 'SINGLE'
                            ? 'border-[var(--color-gold)]'
                            : 'border-[var(--color-beige)]'
                        }`}>
                          {formData.activationType === 'SINGLE' && (
                            <div className="w-2 h-2 rounded-full bg-[var(--color-gold)]" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-sm text-[var(--color-charcoal)]">Single</div>
                          <div className="text-xs text-[var(--color-foreground-muted)]">
                            {locale === 'th' ? 'Activate ได้ 1 ครั้ง' : 'One-time activation'}
                          </div>
                        </div>
                      </div>
                    </label>
                    <label className={`flex-1 cursor-pointer rounded-lg border-2 p-3 transition-all ${
                      formData.activationType === 'PACK'
                        ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/5'
                        : 'border-[var(--color-beige)] hover:border-[var(--color-gold)]/50'
                    }`}>
                      <input
                        type="radio"
                        name="activationType"
                        value="PACK"
                        checked={formData.activationType === 'PACK'}
                        onChange={(e) => setFormData({ ...formData, activationType: e.target.value as 'SINGLE' | 'PACK', maxActivations: 5 })}
                        className="sr-only"
                      />
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          formData.activationType === 'PACK'
                            ? 'border-[var(--color-gold)]'
                            : 'border-[var(--color-beige)]'
                        }`}>
                          {formData.activationType === 'PACK' && (
                            <div className="w-2 h-2 rounded-full bg-[var(--color-gold)]" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-sm text-[var(--color-charcoal)]">Pack</div>
                          <div className="text-xs text-[var(--color-foreground-muted)]">
                            {locale === 'th' ? 'Activate ได้หลายครั้ง' : 'Multiple activations'}
                          </div>
                        </div>
                      </div>
                    </label>
                  </div>
                  {formData.activationType === 'PACK' && (
                    <div className="pt-2">
                      <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-1">
                        {locale === 'th' ? 'จำนวนครั้งที่ Activate ได้' : 'Max Activations'}
                      </label>
                      <input
                        type="number"
                        min="2"
                        max="100"
                        value={formData.maxActivations}
                        onChange={(e) => setFormData({ ...formData, maxActivations: parseInt(e.target.value) || 2 })}
                        className="w-32 px-3 py-2 border border-[var(--color-beige)] rounded-lg focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]"
                      />
                      <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
                        {locale === 'th'
                          ? `ลูกค้าสามารถ Activate สินค้านี้ได้ ${formData.maxActivations} ครั้ง`
                          : `Customers can activate this product ${formData.maxActivations} times`}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-[var(--color-charcoal)] bg-[var(--color-off-white)] hover:bg-[var(--color-beige)] rounded-lg transition-colors"
                  >
                    {locale === 'th' ? 'ยกเลิก' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-[var(--color-gold)] text-white rounded-lg hover:bg-[var(--color-gold-dark)] disabled:opacity-50 transition-colors"
                  >
                    {actionLoading
                      ? (locale === 'th' ? 'กำลังบันทึก...' : 'Saving...')
                      : (locale === 'th' ? 'บันทึก' : 'Save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
