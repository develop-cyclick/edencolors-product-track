import Link from 'next/link'
import { getDictionary } from '@/i18n/get-dictionary'
import type { Locale } from '@/i18n/config'
import PublicNavbar from '@/components/public-navbar'
import Image from 'next/image'

interface PageProps {
  params: Promise<{ locale: Locale }>
}

export default async function LandingPage({ params }: PageProps) {
  const { locale } = await params
  const dict = await getDictionary(locale)

  return (
    <div className="min-h-screen bg-[var(--color-white)] flex flex-col">
      {/* Navigation */}
      <PublicNavbar locale={locale} />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden flex-1">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[var(--color-off-white)]">
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, var(--color-beige) 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }} />
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-20 right-10 w-72 h-72 bg-[var(--color-mint)] rounded-full opacity-10 blur-3xl" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-[var(--color-gold)] rounded-full opacity-10 blur-3xl" />

        <div className="container mx-auto px-6 relative">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[var(--color-beige)] shadow-sm mb-8 animate-slideDown">
              <span className="w-2 h-2 rounded-full bg-[var(--color-mint)] animate-pulse" />
              <span className="text-sm font-medium text-[var(--color-charcoal)]">
                {locale === 'th' ? 'ระบบยืนยันความแท้ของสินค้า' : 'Product Authenticity System'}
              </span>
            </div>

            {/* Heading */}
            <h1 className="text-display text-5xl md:text-6xl lg:text-7xl font-bold text-[var(--color-charcoal)] leading-tight mb-6 animate-slideUp">
              {locale === 'th' ? (
                <>
                  ปกป้องแบรนด์ของคุณ
                  <br />
                  <span className="text-[var(--color-gold)]">ด้วย QR Code</span>
                </>
              ) : (
                <>
                  Protect Your Brand
                  <br />
                  <span className="text-[var(--color-gold)]">With QR Code</span>
                </>
              )}
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-[var(--color-foreground-muted)] max-w-2xl mx-auto mb-10 animate-slideUp" style={{ animationDelay: '100ms' }}>
              {locale === 'th'
                ? 'ระบบตรวจสอบความแท้ของสินค้าแบบครบวงจร ตั้งแต่รับเข้าคลัง ส่งออก จนถึงมือลูกค้า พร้อมการลงทะเบียนสินค้าที่ปลอดภัย'
                : 'Complete product authenticity verification system from warehouse intake to customer hands with secure product registration'}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slideUp" style={{ animationDelay: '200ms' }}>
              <Link
                href={`/${locale}/verify`}
                className="btn btn-primary btn-lg group"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                {locale === 'th' ? 'สแกน QR ตรวจสอบสินค้า' : 'Scan QR to Verify'}
              </Link>
              <Link
                href={`/${locale}/login`}
                className="btn btn-ghost btn-lg"
              >
                {locale === 'th' ? 'เข้าสู่ระบบพนักงาน' : 'Staff Login'}
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Hero Image / Mockup */}
          {/* <div className="mt-16 max-w-5xl mx-auto">
            <div className="relative bg-white rounded-2xl shadow-[var(--shadow-xl)] border border-[var(--color-beige)] p-8 animate-scaleIn" style={{ animationDelay: '300ms' }}>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <div className="flex-1 mx-4 h-8 bg-[var(--color-off-white)] rounded-lg" />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="bg-[var(--color-charcoal)] rounded-xl p-4 h-64">
                  <div className="w-8 h-8 bg-[var(--color-gold)] rounded-lg mb-6" />
                  <div className="space-y-3">
                    <div className="h-3 bg-white/20 rounded w-full" />
                    <div className="h-3 bg-[var(--color-gold)]/50 rounded w-3/4" />
                    <div className="h-3 bg-white/20 rounded w-5/6" />
                    <div className="h-3 bg-white/20 rounded w-2/3" />
                  </div>
                </div>

                <div className="col-span-3 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-[var(--color-off-white)] rounded-xl p-4">
                      <div className="w-10 h-10 bg-[var(--color-mint)]/20 rounded-lg mb-2" />
                      <div className="h-6 bg-[var(--color-charcoal)]/10 rounded w-16 mb-1" />
                      <div className="h-3 bg-[var(--color-beige)] rounded w-20" />
                    </div>
                    <div className="bg-[var(--color-off-white)] rounded-xl p-4">
                      <div className="w-10 h-10 bg-[var(--color-gold)]/20 rounded-lg mb-2" />
                      <div className="h-6 bg-[var(--color-charcoal)]/10 rounded w-12 mb-1" />
                      <div className="h-3 bg-[var(--color-beige)] rounded w-24" />
                    </div>
                    <div className="bg-[var(--color-off-white)] rounded-xl p-4">
                      <div className="w-10 h-10 bg-[var(--color-mint)]/20 rounded-lg mb-2" />
                      <div className="h-6 bg-[var(--color-charcoal)]/10 rounded w-14 mb-1" />
                      <div className="h-3 bg-[var(--color-beige)] rounded w-16" />
                    </div>
                  </div>

                  <div className="bg-[var(--color-off-white)] rounded-xl p-4 h-32">
                    <div className="h-4 bg-[var(--color-beige)] rounded w-full mb-3" />
                    <div className="space-y-2">
                      <div className="h-3 bg-white rounded w-full" />
                      <div className="h-3 bg-white rounded w-full" />
                      <div className="h-3 bg-white rounded w-3/4" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div> */}
        </div>
      </section>

      {/* Features Section */}
      {/* <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-display text-3xl md:text-4xl font-bold text-[var(--color-charcoal)] mb-4">
              {locale === 'th' ? 'ครบวงจรในระบบเดียว' : 'Complete Solution'}
            </h2>
            <p className="text-[var(--color-foreground-muted)] max-w-2xl mx-auto">
              {locale === 'th'
                ? 'ระบบติดตามสินค้าตั้งแต่ต้นน้ำถึงปลายน้ำ พร้อมการยืนยันตัวตนที่ปลอดภัย'
                : 'End-to-end product tracking with secure authentication'}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="group p-8 bg-[var(--color-off-white)] rounded-2xl border border-[var(--color-beige)] hover:border-[var(--color-gold)] transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 bg-[var(--color-gold)]/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[var(--color-gold)]/20 transition-colors">
                <svg className="w-7 h-7 text-[var(--color-gold)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-[var(--color-charcoal)] mb-3">
                {locale === 'th' ? 'จัดการคลังสินค้า' : 'Warehouse Management'}
              </h3>
              <p className="text-[var(--color-foreground-muted)]">
                {locale === 'th'
                  ? 'รับเข้า-ส่งออกสินค้า พร้อมสร้าง QR Code อัตโนมัติ ติดตามสถานะได้ตลอด'
                  : 'Inbound/Outbound with automatic QR generation and real-time tracking'}
              </p>
            </div>

            <div className="group p-8 bg-[var(--color-off-white)] rounded-2xl border border-[var(--color-beige)] hover:border-[var(--color-mint)] transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 bg-[var(--color-mint)]/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[var(--color-mint)]/20 transition-colors">
                <svg className="w-7 h-7 text-[var(--color-mint)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-[var(--color-charcoal)] mb-3">
                {locale === 'th' ? 'ตรวจสอบของแท้' : 'Authenticity Verification'}
              </h3>
              <p className="text-[var(--color-foreground-muted)]">
                {locale === 'th'
                  ? 'สแกน QR เพื่อตรวจสอบความแท้ ด้วยระบบเข้ารหัสที่ปลอดภัย ป้องกันการปลอมแปลง'
                  : 'Scan QR to verify authenticity with secure encryption and anti-counterfeit protection'}
              </p>
            </div>

            <div className="group p-8 bg-[var(--color-off-white)] rounded-2xl border border-[var(--color-beige)] hover:border-[var(--color-gold)] transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 bg-[var(--color-gold)]/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[var(--color-gold)]/20 transition-colors">
                <svg className="w-7 h-7 text-[var(--color-gold)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-[var(--color-charcoal)] mb-3">
                {locale === 'th' ? 'ลงทะเบียนสินค้า' : 'Product Registration'}
              </h3>
              <p className="text-[var(--color-foreground-muted)]">
                {locale === 'th'
                  ? 'ลูกค้าลงทะเบียนสินค้าได้ครั้งเดียว ป้องกันการใช้ซ้ำ พร้อมเก็บข้อมูลตาม PDPA'
                  : 'One-time customer registration with anti-reuse protection and PDPA compliant data storage'}
              </p>
            </div>
          </div>
        </div>
      </section> */}

      {/* How it Works */}
      {/* <section className="py-20 bg-[var(--color-off-white)]">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-display text-3xl md:text-4xl font-bold text-[var(--color-charcoal)] mb-4">
              {locale === 'th' ? 'ขั้นตอนการใช้งาน' : 'How It Works'}
            </h2>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8">
              {[
                {
                  step: '01',
                  title: locale === 'th' ? 'รับเข้าคลัง' : 'Receive',
                  desc: locale === 'th' ? 'สร้าง GRN และ QR Code' : 'Create GRN & QR Code',
                },
                {
                  step: '02',
                  title: locale === 'th' ? 'ส่งออก' : 'Ship',
                  desc: locale === 'th' ? 'อนุมัติและส่งสินค้า' : 'Approve & Ship products',
                },
                {
                  step: '03',
                  title: locale === 'th' ? 'ตรวจสอบ' : 'Verify',
                  desc: locale === 'th' ? 'สแกน QR ยืนยันของแท้' : 'Scan QR to verify',
                },
                {
                  step: '04',
                  title: locale === 'th' ? 'ลงทะเบียน' : 'Register',
                  desc: locale === 'th' ? 'ลูกค้า Activate สินค้า' : 'Customer activation',
                },
              ].map((item, i) => (
                <div key={i} className="relative text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white border-2 border-[var(--color-gold)] flex items-center justify-center">
                    <span className="text-[var(--color-gold)] font-bold text-lg">{item.step}</span>
                  </div>
                  {i < 3 && (
                    <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-[var(--color-beige)]" />
                  )}
                  <h4 className="font-semibold text-[var(--color-charcoal)] mb-1">{item.title}</h4>
                  <p className="text-sm text-[var(--color-foreground-muted)]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section> */}

      {/* CTA Section */}
      {/* <section className="py-20 bg-[var(--color-charcoal)]">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-display text-3xl md:text-4xl font-bold text-white mb-6">
            {locale === 'th' ? 'พร้อมปกป้องแบรนด์ของคุณ?' : 'Ready to Protect Your Brand?'}
          </h2>
          <p className="text-white/70 max-w-xl mx-auto mb-8">
            {locale === 'th'
              ? 'เริ่มต้นใช้งานระบบตรวจสอบความแท้วันนี้'
              : 'Start using the authenticity verification system today'}
          </p>
          <Link
            href={`/${locale}/login`}
            className="btn btn-primary btn-lg"
          >
            {locale === 'th' ? 'เริ่มต้นใช้งาน' : 'Get Started'}
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section> */}

      {/* Footer */}
      <footer className="py-8 bg-[var(--color-charcoal)] border-t border-white/10">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
             
              <span className="text-white/70 text-sm">
                © 2026 Eden Colors. All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-6">
              <Link href={`/${locale === 'th' ? 'en' : 'th'}`} className="text-white/50 hover:text-white text-sm transition-colors">
                {locale === 'th' ? 'English' : 'ภาษาไทย'}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
