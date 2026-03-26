'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface PublicNavbarProps {
  locale: string
}

export default function PublicNavbar({ locale }: PublicNavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Close menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 640) {
        setIsMobileMenuOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#4C4C4C] backdrop-blur-md border-b border-[var(--color-beige)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href={`/${locale}`} className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <Image src="/Logo.webp" alt="Edencolors Logo" width={120} height={34} className="h-8 sm:h-10 w-auto" />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden sm:flex items-center gap-4">
            <Link
              href={`/${locale}/verify`}
              className="text-sm font-medium text-white hover:text-[var(--color-gold)] transition-colors whitespace-nowrap"
            >
              {locale === 'th' ? 'ตรวจสอบสินค้า' : 'Verify Product'}
            </Link>
            <Link
              href={`/${locale}/login`}
              className="btn btn-primary btn-sm whitespace-nowrap"
            >
              {locale === 'th' ? 'เข้าสู่ระบบ' : 'Login'}
            </Link>
            <Link
              href={`/${locale === 'th' ? 'en' : 'th'}`}
              className="text-white hover:text-[var(--color-gold)] text-sm font-medium transition-colors"
            >
              {locale === 'th' ? 'EN' : 'TH'}
            </Link>
          </div>

          {/* Mobile: Icons + Language */}
          <div className="flex sm:hidden items-center gap-1">
            {/* Verify icon */}
            <Link
              href={`/${locale}/verify`}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-white hover:bg-[var(--color-off-white)] transition-colors"
              aria-label={locale === 'th' ? 'ตรวจสอบสินค้า' : 'Verify Product'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </Link>

            {/* Login icon */}
            <Link
              href={`/${locale}/login`}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--color-gold)] text-white hover:bg-[var(--color-gold-dark)] transition-colors"
              aria-label={locale === 'th' ? 'เข้าสู่ระบบ' : 'Login'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>

            {/* Language Switcher */}
            <Link
              href={`/${locale === 'th' ? 'en' : 'th'}`}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-white hover:text-[var(--color-gold)] hover:bg-[var(--color-off-white)] text-sm font-medium transition-colors"
            >
              {locale === 'th' ? 'EN' : 'TH'}
            </Link>
          </div>
        </div>
      </nav>
    </>
  )
}
