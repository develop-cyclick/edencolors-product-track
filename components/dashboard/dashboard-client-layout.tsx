'use client'

import { useState } from 'react'
import Sidebar from './sidebar'
import Image from 'next/image'
Image

interface DashboardClientLayoutProps {
  children: React.ReactNode
  locale: string
  userRole: string
  userName: string
}

export default function DashboardClientLayout({
  children,
  locale,
  userRole,
  userName,
}: DashboardClientLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[var(--color-off-white)]">
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[var(--color-charcoal)] text-white shadow-lg">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          {/* Logo */}
            <Image src="/Logo.webp" alt="Eden Colors Logo" width={120} height={34} className="h-8 sm:h-10 w-auto" />
        </div>

        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-gold)] to-[var(--color-gold-dark)] flex items-center justify-center shadow-lg">
          <span className="text-white font-semibold text-sm">{userName.charAt(0).toUpperCase()}</span>
        </div>
      </header>

      <Sidebar
        locale={locale}
        userRole={userRole}
        userName={userName}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />

      <main className="flex-1 p-4 lg:p-6 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
