import Link from 'next/link'
import { getDictionary } from '@/i18n/get-dictionary'
import type { Locale } from '@/i18n/config'
import LoginForm from './login-form'
import Image from 'next/image'

interface LoginPageProps {
  params: Promise<{ locale: string }>
}

export default async function LoginPage({ params }: LoginPageProps) {
  const { locale } = await params
  const dict = await getDictionary(locale as Locale)

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[var(--color-charcoal)] relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '48px 48px'
          }} />
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-20 -left-20 w-96 h-96 bg-[var(--color-gold)] rounded-full opacity-10 blur-3xl" />
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-[var(--color-mint)] rounded-full opacity-10 blur-3xl" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 py-12">
         {/* Logo */}
          <Link href={`/${locale}`} className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <Image src="/Logo.webp" alt="Eden Colors Logo" width={120} height={34} className="h-8 sm:h-10 w-auto" />
          </Link>

          {/* Heading */}
          <h1 className="text-display text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
            {locale === 'th' ? (
              <>
                ระบบยืนยัน
                <br />
                <span className="text-[var(--color-gold)]">ความแท้ของสินค้า</span>
              </>
            ) : (
              <>
                Product
                <br />
                <span className="text-[var(--color-gold)]">Authenticity System</span>
              </>
            )}
          </h1>

          <p className="text-white/60 text-lg max-w-md mb-12">
            {locale === 'th'
              ? 'จัดการคลังสินค้า ติดตามสถานะ และยืนยันความแท้ด้วย QR Code ที่ปลอดภัย'
              : 'Manage inventory, track status, and verify authenticity with secure QR codes'}
          </p>

          {/* Features */}
          <div className="space-y-4">
            {[
              { icon: '✓', text: locale === 'th' ? 'จัดการคลังสินค้าครบวงจร' : 'Complete warehouse management' },
              { icon: '✓', text: locale === 'th' ? 'QR Code เข้ารหัสปลอดภัย' : 'Secure encrypted QR codes' },
              { icon: '✓', text: locale === 'th' ? 'ติดตามสถานะ Real-time' : 'Real-time status tracking' },
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[var(--color-mint)]/20 flex items-center justify-center">
                  <span className="text-[var(--color-mint)] text-sm">{feature.icon}</span>
                </div>
                <span className="text-white/80 text-sm">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center bg-[var(--color-off-white)] px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          {/* Logo */}
          <Link href={`/${locale}`} className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <Image src="/logo-black3.png" alt="Eden Colors Logo" width={120} height={80} className="h-[50px] object-contain  w-auto mx-auto mb-10" />
          </Link>

          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-[var(--shadow-lg)] p-8 animate-scaleIn">
            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-display text-2xl font-bold text-[var(--color-charcoal)] mb-2">
                {dict.auth.loginTitle}
              </h2>
              <p className="text-[var(--color-foreground-muted)]">
                {locale === 'th' ? 'เข้าสู่ระบบเพื่อจัดการสินค้า' : 'Sign in to manage products'}
              </p>
            </div>

            {/* Login Form */}
            <LoginForm dict={dict} locale={locale} />

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--color-beige)]" />
              </div>
            </div>

            {/* Back Link */}
            <div className="text-center pt-4">
              <Link
                href={`/${locale}`}
                className="text-sm text-[var(--color-foreground-muted)] hover:text-[var(--color-gold)] transition-colors"
              >
                ← {locale === 'th' ? 'กลับหน้าหลัก' : 'Back to home'}
              </Link>
            </div>
          </div>

          {/* Language Switch */}
          <div className="mt-6 text-center">
            <Link
              href={`/${locale === 'th' ? 'en' : 'th'}/login`}
              className="text-sm text-[var(--color-foreground-muted)] hover:text-[var(--color-gold)] transition-colors"
            >
              {locale === 'th' ? 'English' : 'ภาษาไทย'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
