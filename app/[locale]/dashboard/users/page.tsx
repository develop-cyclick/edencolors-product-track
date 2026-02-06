'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useConfirm, useAlert } from '@/components/ui/confirm-modal'

interface User {
  id: number
  username: string
  displayName: string
  role: 'ADMIN' | 'MANAGER' | 'WAREHOUSE'
  isActive: boolean
  forcePwChange: boolean
  createdAt: string
  updatedAt: string
}

const ROLES = [
  { value: 'ADMIN', labelTh: 'ผู้ดูแลระบบ', labelEn: 'Admin' },
  { value: 'MANAGER', labelTh: 'ผู้จัดการ', labelEn: 'Manager' },
  { value: 'WAREHOUSE', labelTh: 'พนักงานคลัง', labelEn: 'Warehouse' },
]

export default function UsersPage() {
  const params = useParams()
  const locale = params.locale as string
  const confirm = useConfirm()
  const alert = useAlert()

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    displayName: '',
    role: 'WAREHOUSE' as 'ADMIN' | 'MANAGER' | 'WAREHOUSE',
    isActive: true,
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (data.success && data.data?.users) {
        setUsers(data.data.users)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditingUser(null)
    setFormData({
      username: '',
      password: '',
      displayName: '',
      role: 'WAREHOUSE',
      isActive: true,
    })
    setShowModal(true)
  }

  const openEditModal = (user: User) => {
    setEditingUser(user)
    setFormData({
      username: user.username,
      password: '',
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingUser(null)
    setFormData({
      username: '',
      password: '',
      displayName: '',
      role: 'WAREHOUSE',
      isActive: true,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading(true)

    try {
      if (editingUser) {
        // Update user
        const updateData: Record<string, unknown> = {
          displayName: formData.displayName,
          role: formData.role,
          isActive: formData.isActive,
        }
        if (formData.password) {
          updateData.password = formData.password
        }

        const res = await fetch(`/api/admin/users/${editingUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        })
        const data = await res.json()
        if (data.success) {
          await alert({
            title: locale === 'th' ? 'สำเร็จ' : 'Success',
            message: locale === 'th' ? 'อัปเดตผู้ใช้สำเร็จ' : 'User updated successfully',
            variant: 'success',
            icon: 'success',
          })
          closeModal()
          fetchUsers()
        } else {
          await alert({
            title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
            message: data.error,
            variant: 'error',
            icon: 'error',
          })
        }
      } else {
        // Create user
        if (!formData.username || !formData.password || !formData.displayName) {
          await alert({
            title: locale === 'th' ? 'ข้อมูลไม่ครบ' : 'Missing Information',
            message: locale === 'th' ? 'กรุณากรอกข้อมูลให้ครบ' : 'Please fill in all required fields',
            variant: 'warning',
            icon: 'warning',
          })
          setActionLoading(false)
          return
        }

        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        const data = await res.json()
        if (data.success) {
          await alert({
            title: locale === 'th' ? 'สำเร็จ' : 'Success',
            message: locale === 'th' ? 'สร้างผู้ใช้สำเร็จ' : 'User created successfully',
            variant: 'success',
            icon: 'success',
          })
          closeModal()
          fetchUsers()
        } else {
          await alert({
            title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
            message: data.error,
            variant: 'error',
            icon: 'error',
          })
        }
      }
    } catch (error) {
      await alert({
        title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
        message: locale === 'th' ? 'ไม่สามารถบันทึกผู้ใช้ได้' : 'Failed to save user',
        variant: 'error',
        icon: 'error',
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeactivate = async (user: User) => {
    const confirmed = await confirm({
      title: locale === 'th' ? 'ปิดใช้งานผู้ใช้' : 'Deactivate User',
      message: locale === 'th'
        ? `ยืนยันการปิดใช้งานผู้ใช้ "${user.displayName}"?`
        : `Confirm deactivate user "${user.displayName}"?`,
      confirmText: locale === 'th' ? 'ปิดใช้งาน' : 'Deactivate',
      cancelText: locale === 'th' ? 'ยกเลิก' : 'Cancel',
      variant: 'warning',
      icon: 'warning',
    })
    if (!confirmed) return

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        await alert({
          title: locale === 'th' ? 'สำเร็จ' : 'Success',
          message: locale === 'th' ? 'ปิดใช้งานผู้ใช้สำเร็จ' : 'User deactivated successfully',
          variant: 'success',
          icon: 'success',
        })
        fetchUsers()
      } else {
        await alert({
          title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
          message: data.error,
          variant: 'error',
          icon: 'error',
        })
      }
    } catch (error) {
      await alert({
        title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
        message: locale === 'th' ? 'ไม่สามารถปิดใช้งานผู้ใช้ได้' : 'Failed to deactivate user',
        variant: 'error',
        icon: 'error',
      })
    }
  }

  const handleActivate = async (user: User) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      })
      const data = await res.json()
      if (data.success) {
        await alert({
          title: locale === 'th' ? 'สำเร็จ' : 'Success',
          message: locale === 'th' ? 'เปิดใช้งานผู้ใช้สำเร็จ' : 'User activated successfully',
          variant: 'success',
          icon: 'success',
        })
        fetchUsers()
      } else {
        await alert({
          title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
          message: data.error,
          variant: 'error',
          icon: 'error',
        })
      }
    } catch (error) {
      await alert({
        title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
        message: locale === 'th' ? 'ไม่สามารถเปิดใช้งานผู้ใช้ได้' : 'Failed to activate user',
        variant: 'error',
        icon: 'error',
      })
    }
  }

  const handleDelete = async (user: User) => {
    const confirmed = await confirm({
      title: locale === 'th' ? 'ลบผู้ใช้ถาวร' : 'Delete User Permanently',
      message: locale === 'th'
        ? `ยืนยันการลบผู้ใช้ "${user.displayName}" ถาวร?\n\nการลบจะไม่สามารถกู้คืนได้!`
        : `Confirm permanently delete user "${user.displayName}"?\n\nThis action cannot be undone!`,
      confirmText: locale === 'th' ? 'ลบถาวร' : 'Delete',
      cancelText: locale === 'th' ? 'ยกเลิก' : 'Cancel',
      variant: 'danger',
      icon: 'delete',
    })
    if (!confirmed) return

    try {
      const res = await fetch(`/api/admin/users/${user.id}?hard=true`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        await alert({
          title: locale === 'th' ? 'สำเร็จ' : 'Success',
          message: locale === 'th' ? 'ลบผู้ใช้สำเร็จ' : 'User deleted successfully',
          variant: 'success',
          icon: 'success',
        })
        fetchUsers()
      } else {
        await alert({
          title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
          message: data.error,
          variant: 'error',
          icon: 'error',
        })
      }
    } catch (error) {
      await alert({
        title: locale === 'th' ? 'เกิดข้อผิดพลาด' : 'Error',
        message: locale === 'th' ? 'ไม่สามารถลบผู้ใช้ได้' : 'Failed to delete user',
        variant: 'error',
        icon: 'error',
      })
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getRoleBadge = (role: string) => {
    const styles: Record<string, { bg: string; dot: string }> = {
      ADMIN: { bg: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
      MANAGER: { bg: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
      WAREHOUSE: { bg: 'bg-[var(--color-mint)]/10 text-[var(--color-mint-dark)]', dot: 'bg-[var(--color-mint)]' },
    }
    const style = styles[role] || { bg: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' }
    const label = ROLES.find((r) => r.value === role)
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${style.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
        {locale === 'th' ? label?.labelTh || role : label?.labelEn || role}
      </span>
    )
  }

  const inputClass = "w-full px-4 py-2.5 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 placeholder:text-[var(--color-foreground-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)]"
  const labelClass = "block text-sm font-medium text-[var(--color-charcoal)] mb-1.5"
  const selectClass = "appearance-none w-full px-4 py-2.5 text-[0.9375rem] bg-[var(--color-off-white)] border border-[var(--color-beige)] rounded-xl transition-all duration-200 focus:outline-none focus:border-[var(--color-gold)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,163,90,0.15)] pr-10"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-display text-2xl font-bold text-[var(--color-charcoal)]">
            {locale === 'th' ? 'จัดการผู้ใช้งาน' : 'User Management'}
          </h1>
          <p className="text-[var(--color-foreground-muted)] mt-1">
            {locale === 'th' ? 'จัดการบัญชีผู้ใช้งานในระบบ' : 'Manage user accounts in the system'}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-gold)] text-white rounded-xl font-medium shadow-[0_4px_14px_rgba(201,163,90,0.25)] hover:bg-[var(--color-gold-dark)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(201,163,90,0.35)] transition-all duration-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {locale === 'th' ? 'เพิ่มผู้ใช้' : 'Add User'}
        </button>
      </div>

      {/* Users Table */}
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
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-beige)]/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--color-foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <p className="text-[var(--color-foreground-muted)]">
              {locale === 'th' ? 'ยังไม่มีผู้ใช้งาน' : 'No users found'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
                  <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'ชื่อผู้ใช้' : 'Username'}
                  </th>
                  <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'ชื่อที่แสดง' : 'Display Name'}
                  </th>
                  <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--color-charcoal)]">
                    {locale === 'th' ? 'บทบาท' : 'Role'}
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
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-[var(--color-off-white)]/50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-medium text-[var(--color-charcoal)]">{user.username}</span>
                    </td>
                    <td className="px-5 py-4 text-[var(--color-charcoal)]">{user.displayName}</td>
                    <td className="px-5 py-4">{getRoleBadge(user.role)}</td>
                    <td className="px-5 py-4">
                      {user.isActive ? (
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
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-2 text-[var(--color-gold)] hover:bg-[var(--color-gold)]/10 rounded-lg transition-colors"
                          title={locale === 'th' ? 'แก้ไข' : 'Edit'}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {user.isActive ? (
                          <button
                            onClick={() => handleDeactivate(user)}
                            className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                            title={locale === 'th' ? 'ปิดใช้งาน' : 'Deactivate'}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(user)}
                            className="p-2 text-[var(--color-mint)] hover:bg-[var(--color-mint)]/10 rounded-lg transition-colors"
                            title={locale === 'th' ? 'เปิดใช้งาน' : 'Activate'}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(user)}
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
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-[var(--color-charcoal)] mb-4">
              {editingUser
                ? (locale === 'th' ? 'แก้ไขผู้ใช้' : 'Edit User')
                : (locale === 'th' ? 'เพิ่มผู้ใช้ใหม่' : 'Add New User')
              }
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>
                  {locale === 'th' ? 'ชื่อผู้ใช้' : 'Username'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  disabled={!!editingUser}
                  className={`${inputClass} ${editingUser ? 'opacity-50 cursor-not-allowed' : ''}`}
                  placeholder={locale === 'th' ? 'ชื่อผู้ใช้สำหรับเข้าสู่ระบบ' : 'Username for login'}
                />
              </div>

              <div>
                <label className={labelClass}>
                  {locale === 'th' ? 'รหัสผ่าน' : 'Password'}
                  {!editingUser && <span className="text-red-500"> *</span>}
                  {editingUser && (
                    <span className="text-[var(--color-foreground-muted)] font-normal ml-1">
                      ({locale === 'th' ? 'เว้นว่างถ้าไม่ต้องการเปลี่ยน' : 'Leave empty to keep current'})
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={inputClass}
                  placeholder={editingUser ? '********' : ''}
                />
              </div>

              <div>
                <label className={labelClass}>
                  {locale === 'th' ? 'ชื่อที่แสดง' : 'Display Name'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className={inputClass}
                  placeholder={locale === 'th' ? 'ชื่อ-นามสกุล' : 'Full name'}
                />
              </div>

              <div>
                <label className={labelClass}>
                  {locale === 'th' ? 'บทบาท' : 'Role'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'ADMIN' | 'MANAGER' | 'WAREHOUSE' })}
                    className={selectClass}
                  >
                    {ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {locale === 'th' ? role.labelTh : role.labelEn}
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

              {editingUser && (
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
