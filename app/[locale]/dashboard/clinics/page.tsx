'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Clinic {
  id: number
  name: string
  province: string
  branchName: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function ClinicsPage() {
  const params = useParams()
  const locale = params.locale as string

  const [clinics, setClinics] = useState<Clinic[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    province: '',
    branchName: '',
    isActive: true,
  })

  useEffect(() => {
    fetchClinics()
  }, [])

  const fetchClinics = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/clinics')
      const data = await res.json()
      if (data.success && data.data?.clinics) {
        setClinics(data.data.clinics)
      }
    } catch (error) {
      console.error('Failed to fetch clinics:', error)
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditingClinic(null)
    setFormData({
      name: '',
      province: '',
      branchName: '',
      isActive: true,
    })
    setShowModal(true)
  }

  const openEditModal = (clinic: Clinic) => {
    setEditingClinic(clinic)
    setFormData({
      name: clinic.name,
      province: clinic.province,
      branchName: clinic.branchName || '',
      isActive: clinic.isActive,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingClinic(null)
    setFormData({
      name: '',
      province: '',
      branchName: '',
      isActive: true,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading(true)

    try {
      if (editingClinic) {
        // Update clinic
        const updateData: Record<string, unknown> = {
          name: formData.name,
          province: formData.province,
          branchName: formData.branchName || null,
          isActive: formData.isActive,
        }

        const res = await fetch(`/api/admin/clinics/${editingClinic.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        })
        const data = await res.json()
        if (data.success) {
          alert(locale === 'th' ? 'อัปเดตคลินิกสำเร็จ' : 'Clinic updated successfully')
          closeModal()
          fetchClinics()
        } else {
          alert(`Error: ${data.error}`)
        }
      } else {
        // Create clinic
        if (!formData.name || !formData.province) {
          alert(locale === 'th' ? 'กรุณากรอกชื่อและจังหวัด' : 'Please enter name and province')
          setActionLoading(false)
          return
        }

        const res = await fetch('/api/admin/clinics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            province: formData.province,
            branchName: formData.branchName || null,
            isActive: formData.isActive,
          }),
        })
        const data = await res.json()
        if (data.success) {
          alert(locale === 'th' ? 'สร้างคลินิกสำเร็จ' : 'Clinic created successfully')
          closeModal()
          fetchClinics()
        } else {
          alert(`Error: ${data.error}`)
        }
      }
    } catch (error) {
      alert('Failed to save clinic')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeactivate = async (clinic: Clinic) => {
    if (!confirm(locale === 'th'
      ? `ยืนยันการปิดใช้งานคลินิก "${clinic.name}"?`
      : `Confirm deactivate clinic "${clinic.name}"?`
    )) return

    try {
      const res = await fetch(`/api/admin/clinics/${clinic.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        alert(locale === 'th' ? 'ปิดใช้งานคลินิกสำเร็จ' : 'Clinic deactivated successfully')
        fetchClinics()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      alert('Failed to deactivate clinic')
    }
  }

  const handleActivate = async (clinic: Clinic) => {
    try {
      const res = await fetch(`/api/admin/clinics/${clinic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      })
      const data = await res.json()
      if (data.success) {
        alert(locale === 'th' ? 'เปิดใช้งานคลินิกสำเร็จ' : 'Clinic activated successfully')
        fetchClinics()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      alert('Failed to activate clinic')
    }
  }

  const handleDelete = async (clinic: Clinic) => {
    if (!confirm(locale === 'th'
      ? `ยืนยันการลบคลินิก "${clinic.name}" ถาวร?\n\nการลบจะไม่สามารถกู้คืนได้!`
      : `Confirm permanently delete clinic "${clinic.name}"?\n\nThis action cannot be undone!`
    )) return

    try {
      const res = await fetch(`/api/admin/clinics/${clinic.id}?hard=true`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        alert(locale === 'th' ? 'ลบคลินิกสำเร็จ' : 'Clinic deleted successfully')
        fetchClinics()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      alert('Failed to delete clinic')
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const inputClass = "w-full px-4 py-2.5 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
  const labelClass = "block text-sm font-medium text-[var(--color-charcoal)] mb-1.5"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-display text-2xl font-bold text-[var(--color-charcoal)]">
            {locale === 'th' ? 'จัดการคลินิก' : 'Clinic Management'}
          </h1>
          <p className="text-[var(--color-foreground-muted)] mt-1">
            {locale === 'th' ? 'จัดการรายชื่อคลินิกในระบบ' : 'Manage clinics in the system'}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-gold)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(201,163,90,0.35)] transition-all duration-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {locale === 'th' ? 'เพิ่มคลินิก' : 'Add Clinic'}
        </button>
      </div>

      {/* Clinics Table */}
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
        ) : clinics.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-beige)]/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-[var(--color-foreground-muted)]">
              {locale === 'th' ? 'ยังไม่มีคลินิก' : 'No clinics found'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-[var(--color-beige)]">
              {clinics.map((clinic) => (
                <div key={clinic.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="font-medium text-[var(--color-charcoal)]">{clinic.name}</div>
                      <div className="text-xs text-[var(--color-foreground-muted)]">
                        {clinic.province} {clinic.branchName && `• ${clinic.branchName}`}
                      </div>
                    </div>
                    {clinic.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-mint)]" />
                        {locale === 'th' ? 'ใช้งาน' : 'Active'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                        {locale === 'th' ? 'ปิด' : 'Inactive'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-beige)]">
                    <span className="text-xs text-[var(--color-foreground-muted)]">
                      {formatDate(clinic.createdAt)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(clinic)}
                        className="p-2 text-[var(--color-gold)] hover:bg-[var(--color-gold)]/10 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {clinic.isActive ? (
                        <button
                          onClick={() => handleDeactivate(clinic)}
                          className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(clinic)}
                          className="p-2 text-[var(--color-mint)] hover:bg-[var(--color-mint)]/10 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(clinic)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'ชื่อคลินิก' : 'Clinic Name'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'จังหวัด' : 'Province'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'สาขา' : 'Branch'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'สถานะ' : 'Status'}
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                      {locale === 'th' ? 'สร้างเมื่อ' : 'Created'}
                    </th>
                    <th className="px-5 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-beige)]">
                  {clinics.map((clinic) => (
                    <tr key={clinic.id} className="hover:bg-[var(--color-off-white)]/50 transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-medium text-[var(--color-charcoal)]">{clinic.name}</span>
                      </td>
                      <td className="px-5 py-4 text-[var(--color-charcoal)]">{clinic.province}</td>
                      <td className="px-5 py-4 text-[var(--color-charcoal)]">
                        {clinic.branchName || (
                          <span className="text-[var(--color-foreground-muted)]">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {clinic.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-mint)]" />
                            {locale === 'th' ? 'ใช้งาน' : 'Active'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            {locale === 'th' ? 'ปิดใช้งาน' : 'Inactive'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--color-foreground-muted)]">
                        {formatDate(clinic.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openEditModal(clinic)}
                            className="p-2 text-[var(--color-gold)] hover:bg-[var(--color-gold)]/10 rounded-lg transition-colors"
                            title={locale === 'th' ? 'แก้ไข' : 'Edit'}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {clinic.isActive ? (
                            <button
                              onClick={() => handleDeactivate(clinic)}
                              className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                              title={locale === 'th' ? 'ปิดใช้งาน' : 'Deactivate'}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleActivate(clinic)}
                              className="p-2 text-[var(--color-mint)] hover:bg-[var(--color-mint)]/10 rounded-lg transition-colors"
                              title={locale === 'th' ? 'เปิดใช้งาน' : 'Activate'}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(clinic)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title={locale === 'th' ? 'ลบถาวร' : 'Delete'}
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
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
              {editingClinic
                ? (locale === 'th' ? 'แก้ไขคลินิก' : 'Edit Clinic')
                : (locale === 'th' ? 'เพิ่มคลินิกใหม่' : 'Add New Clinic')
              }
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>
                  {locale === 'th' ? 'ชื่อคลินิก' : 'Clinic Name'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={inputClass}
                  placeholder={locale === 'th' ? 'ชื่อคลินิก' : 'Clinic name'}
                />
              </div>

              <div>
                <label className={labelClass}>
                  {locale === 'th' ? 'จังหวัด' : 'Province'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.province}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                  className={inputClass}
                  placeholder={locale === 'th' ? 'จังหวัด' : 'Province'}
                />
              </div>

              <div>
                <label className={labelClass}>
                  {locale === 'th' ? 'สาขา' : 'Branch'}
                  <span className="text-[var(--color-foreground-muted)] font-normal ml-1">
                    ({locale === 'th' ? 'ไม่จำเป็น' : 'Optional'})
                  </span>
                </label>
                <input
                  type="text"
                  value={formData.branchName}
                  onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                  className={inputClass}
                  placeholder={locale === 'th' ? 'ชื่อสาขา (ถ้ามี)' : 'Branch name (if any)'}
                />
              </div>

              {editingClinic && (
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
