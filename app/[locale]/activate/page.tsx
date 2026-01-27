import { Suspense } from 'react'
import Link from 'next/link'
import { getDictionary } from '@/i18n/get-dictionary'
import type { Locale } from '@/i18n/config'
import ActivateForm from './activate-form'

interface ActivatePageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ token?: string }>
}

export default async function ActivatePage({ params, searchParams }: ActivatePageProps) {
  const { locale } = await params
  const { token } = await searchParams
  const dict = await getDictionary(locale as Locale)

  return (
    <div className="min-h-screen bg-[var(--color-off-white)]">
      {/* Header */}
      <header className="bg-white border-b border-[var(--color-beige)]">
        <div className="max-w-lg mx-auto px-4 h-16 flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-charcoal)] flex items-center justify-center">
              <span className="text-[var(--color-gold)] font-bold text-sm">E</span>
            </div>
            <span className="text-display text-lg font-semibold text-[var(--color-charcoal)]">
              Eden Colors
            </span>
          </Link>
          <Link
            href={`/${locale === 'th' ? 'en' : 'th'}/activate${token ? `?token=${token}` : ''}`}
            className="text-sm text-[var(--color-foreground-muted)] hover:text-[var(--color-gold)] transition-colors"
          >
            {locale === 'th' ? 'EN' : 'TH'}
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-8">
        {/* Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-[var(--shadow-md)] mb-4">
            <svg className="w-8 h-8 text-[var(--color-gold)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-display text-2xl font-bold text-[var(--color-charcoal)]">
            {dict.activate.title}
          </h1>
          <p className="text-[var(--color-foreground-muted)] mt-2">
            {locale === 'th' ? 'ลงทะเบียนสินค้าของคุณ' : 'Register your product'}
          </p>
        </div>

        {/* Form */}
        <Suspense
          fallback={
            <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-8 text-center animate-pulse">
              <div className="w-16 h-16 rounded-full bg-[var(--color-beige)] mx-auto mb-4" />
              <div className="h-6 bg-[var(--color-beige)] rounded w-32 mx-auto mb-2" />
              <div className="h-4 bg-[var(--color-beige)] rounded w-48 mx-auto" />
            </div>
          }
        >
          <ActivateForm token={token} dict={dict} locale={locale} />
        </Suspense>

        {/* Footer */}
        <div className="mt-8 text-center">
          <Link
            href={`/${locale}/verify${token ? `?token=${token}` : ''}`}
            className="text-sm text-[var(--color-foreground-muted)] hover:text-[var(--color-gold)] transition-colors"
          >
            ← {locale === 'th' ? 'กลับไปหน้าตรวจสอบ' : 'Back to verification'}
          </Link>
        </div>
      </main>
    </div>
  )
}
