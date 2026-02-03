'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

interface NavItem {
  label: string
  labelEn: string
  href: string
  icon: React.ReactNode
  roles: string[]
}

interface SidebarProps {
  locale: string
  userRole: string
  userName: string
  isMobileOpen?: boolean
  onMobileClose?: () => void
}

export default function Sidebar({ locale, userRole, userName, isMobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Close mobile menu on route change
  useEffect(() => {
    if (onMobileClose) {
      onMobileClose()
    }
  }, [pathname])

  const switchLanguage = () => {
    const newLocale = locale === 'th' ? 'en' : 'th'
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`)
    router.push(newPath)
  }

  const navItems: NavItem[] = [
    {
      label: 'แดชบอร์ด',
      labelEn: 'Dashboard',
      href: `/${locale}/dashboard`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      roles: ['ADMIN', 'MANAGER', 'WAREHOUSE'],
    },
    {
      label: 'สร้าง QR ล่วงหน้า',
      labelEn: 'Pre-Generate QR',
      href: `/${locale}/dashboard/pre-generate`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
      ),
      roles: ['ADMIN', 'WAREHOUSE'],
    },
    {
      label: 'รับเข้าคลัง',
      labelEn: 'GRN',
      href: `/${locale}/dashboard/grn`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      ),
      roles: ['ADMIN', 'WAREHOUSE'],
    },
    {
      label: 'ใบสั่งซื้อ',
      labelEn: 'Purchase Orders',
      href: `/${locale}/dashboard/purchase-orders`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      roles: ['ADMIN', 'WAREHOUSE'],
    },
    {
      label: 'ส่งออก',
      labelEn: 'Outbound',
      href: `/${locale}/dashboard/outbound`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      ),
      roles: ['ADMIN', 'WAREHOUSE'],
    },
    
    {
      label: 'รออนุมัติ',
      labelEn: 'Approval',
      href: `/${locale}/dashboard/approval`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      roles: ['ADMIN', 'MANAGER'],
    },
    
    {
      label: 'สินค้าในคลัง',
      labelEn: 'Products',
      href: `/${locale}/dashboard/products`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      roles: ['ADMIN', 'MANAGER', 'WAREHOUSE'],
    },
    {
      label: 'คลินิก',
      labelEn: 'Clinics',
      href: `/${locale}/dashboard/clinics`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      roles: ['ADMIN'],
    },
    {
      label: 'พิมพ์ QR ใหม่',
      labelEn: 'Reprint',
      href: `/${locale}/dashboard/reprint`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
      ),
      roles: ['ADMIN', 'WAREHOUSE'],
    },
    
    {
      label: 'เสียหาย/คืนสินค้า',
      labelEn: 'Damaged/Return',
      href: `/${locale}/dashboard/damaged-products`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      roles: ['ADMIN', 'WAREHOUSE'],
    },
    
    {
      label: 'ผู้ใช้งาน',
      labelEn: 'Users',
      href: `/${locale}/dashboard/users`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      roles: ['ADMIN'],
    },
    {
      label: 'Event Logs',
      labelEn: 'Logs',
      href: `/${locale}/dashboard/logs`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      roles: ['ADMIN', 'MANAGER'],
    },
    {
      label: 'ตั้งค่าระบบ',
      labelEn: 'Settings',
      href: `/${locale}/dashboard/settings`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      roles: ['ADMIN'],
    },
  ]

  const filteredItems = navItems.filter((item) => item.roles.includes(userRole))

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = `/${locale}/login`
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-[var(--color-gold)]/20 text-[var(--color-gold)]'
      case 'MANAGER':
        return 'bg-[var(--color-mint)]/20 text-[var(--color-mint)]'
      case 'WAREHOUSE':
        return 'bg-blue-500/20 text-blue-400'
      default:
        return 'bg-gray-500/20 text-gray-400'
    }
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      {!isCollapsed && (
          <Link href={`/${locale}`} className="flex items-center mt-2 p-3 gap-2 sm:gap-3 flex-shrink-0">
            <Image src="/Logo.webp" alt="Eden Colors Logo" width={120} height={34} className="h-8 sm:h-10 w-auto" />
          </Link>
        )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => {
          const isDashboardRoot = item.href === `/${locale}/dashboard`
          // Dashboard: exact match only, Others: exact or startsWith
          const isActive = isDashboardRoot
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? (locale === 'th' ? item.label : item.labelEn) : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-[var(--color-gold)] text-white shadow-[0_4px_14px_rgba(201,163,90,0.3)]'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className={`flex-shrink-0 ${isActive ? '' : 'group-hover:text-[var(--color-gold)]'}`}>
                {item.icon}
              </div>
              {!isCollapsed && (
                <span className="truncate">{locale === 'th' ? item.label : item.labelEn}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User info */}
      <div className="p-4 border-t border-white/10">
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-gold)] to-[var(--color-gold-dark)] flex items-center justify-center flex-shrink-0 shadow-lg">
            <span className="text-white font-semibold">{userName.charAt(0).toUpperCase()}</span>
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-white">{userName}</p>
              <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${getRoleBadgeColor(userRole)}`}>
                {userRole}
              </span>
            </div>
          )}
        </div>

        {/* Language Switch */}
        {!isCollapsed ? (
          <button
            onClick={switchLanguage}
            className="w-full mt-3 flex items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            {locale === 'th' ? 'English' : 'ภาษาไทย'}
          </button>
        ) : (
          <button
            onClick={switchLanguage}
            title={locale === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
            className="w-full mt-3 flex items-center justify-center p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
          >
            <span className="text-xs font-bold">{locale === 'th' ? 'EN' : 'TH'}</span>
          </button>
        )}

        {/* Logout */}
        {!isCollapsed ? (
          <button
            onClick={handleLogout}
            className="w-full mt-1 flex items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {locale === 'th' ? 'ออกจากระบบ' : 'Logout'}
          </button>
        ) : (
          <button
            onClick={handleLogout}
            title={locale === 'th' ? 'ออกจากระบบ' : 'Logout'}
            className="w-full mt-1 flex items-center justify-center p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        )}
      </div>
    </>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex ${isCollapsed ? 'w-20' : 'w-64'} bg-[var(--color-charcoal)] text-white flex-col transition-all duration-300 relative`}>
        {/* Collapse Button - Desktop only */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-[var(--color-charcoal)] border border-white/20 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors z-10"
        >
          <svg
            className={`w-4 h-4 text-white/70 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`lg:hidden fixed top-0 left-0 h-full w-72 bg-[var(--color-charcoal)] text-white flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Close button for mobile */}
        <button
          onClick={onMobileClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
        >
          <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {sidebarContent}
      </aside>
    </>
  )
}
