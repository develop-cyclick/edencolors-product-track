import React from 'react'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { verifyToken } from '@/lib/auth'
import prisma from '@/lib/prisma'

interface DashboardPageProps {
  params: Promise<{ locale: string }>
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  const payload = token ? await verifyToken(token) : null

  // Get stats and recent activities
  const [
    totalProducts,
    inStockProducts,
    shippedProducts,
    activatedProducts,
    pendingOutbounds,
    todayScans,
    recentActivities,
  ] = await Promise.all([
    prisma.productItem.count(),
    prisma.productItem.count({ where: { status: 'IN_STOCK' } }),
    prisma.productItem.count({ where: { status: 'SHIPPED' } }),
    prisma.productItem.count({ where: { status: 'ACTIVATED' } }),
    prisma.outboundHeader.count({ where: { status: 'PENDING' } }),
    prisma.scanLog.count({
      where: {
        scannedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    prisma.eventLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        productItem: {
          select: { serial12: true, name: true },
        },
        user: {
          select: { displayName: true },
        },
      },
    }),
  ])

  const stats = [
    {
      label: locale === 'th' ? 'สินค้าทั้งหมด' : 'Total Products',
      value: totalProducts,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      color: 'bg-[#C9A35A]',
      textColor: 'text-white',
    },
    {
      label: locale === 'th' ? 'อยู่ในคลัง' : 'In Stock',
      value: inStockProducts,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
      color: 'bg-[#C9A35A]',
      textColor: 'text-white',
    },
    {
      label: locale === 'th' ? 'ส่งออกแล้ว' : 'Shipped',
      value: shippedProducts,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      ),
      color: 'bg-[#C9A35A]',
      textColor: 'text-white',
    },
    {
      label: locale === 'th' ? 'เปิดใช้งานแล้ว' : 'Activated',
      value: activatedProducts,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'bg-[#C9A35A]',
      textColor: 'text-white',
    },
    {
      label: locale === 'th' ? 'รออนุมัติ' : 'Pending',
      value: pendingOutbounds,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'bg-[#C9A35A]',
      textColor: 'text-white',
    },
    {
      label: locale === 'th' ? 'สแกนวันนี้' : 'Scans Today',
      value: todayScans,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
      ),
      color: 'bg-[#C9A35A]',
      textColor: 'text-white',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display text-2xl font-bold text-[var(--color-charcoal)]">
            {locale === 'th' ? 'แดชบอร์ด' : 'Dashboard'}
          </h1>
          <p className="text-[var(--color-foreground-muted)] mt-1">
            {locale === 'th' ? 'ภาพรวมระบบจัดการสินค้า' : 'Product management overview'}
          </p>
        </div>
        <div className="text-sm text-[var(--color-foreground-muted)]">
          {new Date().toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-6 transition-all duration-200 hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5 animate-scaleIn"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl ${stat.color} flex items-center justify-center shadow-lg`}>
                <span className={stat.textColor}>{stat.icon}</span>
              </div>
              <div>
                <p className="text-sm text-[var(--color-foreground-muted)]">{stat.label}</p>
                <p className="text-3xl font-bold text-[var(--color-charcoal)]">
                  {stat.value.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
        <div className="px-6 py-4 bg-[var(--color-off-white)] border-b border-[var(--color-beige)]">
          <h2 className="text-display text-lg font-semibold text-[var(--color-charcoal)]">
            {locale === 'th' ? 'ทางลัด' : 'Quick Actions'}
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {payload?.role !== 'MANAGER' && (
              <>
                <Link
                  href={`/${locale}/dashboard/grn/new`}
                  className="group flex items-center gap-4 p-5 rounded-xl border-2 border-[var(--color-gray-200)] hover:border-[var(--color-gold)] hover:bg-[var(--color-gold)]/5 transition-all duration-200"
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-gold)]/10 flex items-center justify-center group-hover:bg-[var(--color-gold)] group-hover:text-white transition-all duration-200">
                    <svg className="w-6 h-6 text-[var(--color-gold)] group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--color-charcoal)] group-hover:text-[var(--color-gold)] transition-colors">
                      {locale === 'th' ? 'รับเข้าคลัง' : 'Receive Stock'}
                    </p>
                    <p className="text-sm text-[var(--color-foreground-muted)]">
                      {locale === 'th' ? 'สร้างใบรับสินค้าใหม่' : 'Create new GRN'}
                    </p>
                  </div>
                </Link>
                <Link
                  href={`/${locale}/dashboard/outbound/new`}
                  className="group flex items-center gap-4 p-5 rounded-xl border-2 border-[var(--color-gray-200)] hover:border-[var(--color-gold)] hover:bg-[var(--color-gold)]/5 transition-all duration-200"
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-gold)]/10 flex items-center justify-center group-hover:bg-[var(--color-gold)] group-hover:text-white transition-all duration-200">
                    <svg className="w-6 h-6 text-[var(--color-gold)] group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--color-charcoal)] group-hover:text-[var(--color-gold)] transition-colors">
                      {locale === 'th' ? 'ส่งออกสินค้า' : 'Ship Products'}
                    </p>
                    <p className="text-sm text-[var(--color-foreground-muted)]">
                      {locale === 'th' ? 'สร้างใบส่งสินค้าใหม่' : 'Create new outbound'}
                    </p>
                  </div>
                </Link>
              </>
            )}
            {(payload?.role === 'ADMIN' || payload?.role === 'MANAGER') && (
              <Link
                href={`/${locale}/dashboard/approval`}
                className="group flex items-center gap-4 p-5 rounded-xl border-2 border-[var(--color-gray-200)] hover:border-[var(--color-gold)] hover:bg-[var(--color-gold)]/5 transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--color-gold)]/10 flex items-center justify-center group-hover:bg-[var(--color-gold)] group-hover:text-white transition-all duration-200 relative">
                  <svg className="w-6 h-6 text-[var(--color-gold)] group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {pendingOutbounds > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {pendingOutbounds}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-[var(--color-charcoal)] group-hover:text-[var(--color-gold)] transition-colors">
                    {locale === 'th' ? 'อนุมัติส่งออก' : 'Approve Outbound'}
                  </p>
                  <p className="text-sm text-[var(--color-foreground-muted)]">
                    {pendingOutbounds} {locale === 'th' ? 'รายการรออนุมัติ' : 'pending approval'}
                  </p>
                </div>
              </Link>
            )}
            <Link
              href={`/${locale}/dashboard/products`}
              className="group flex items-center gap-4 p-5 rounded-xl border-2 border-[var(--color-gray-200)] hover:border-[var(--color-gold)] hover:bg-[var(--color-gold)]/5 transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--color-gold)]/10 flex items-center justify-center group-hover:bg-[var(--color-gold)] group-hover:text-white transition-all duration-200">
                <svg className="w-6 h-6 text-[var(--color-gold)] group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-[var(--color-charcoal)] group-hover:text-[var(--color-gold)] transition-colors">
                  {locale === 'th' ? 'ดูสินค้าทั้งหมด' : 'View All Products'}
                </p>
                <p className="text-sm text-[var(--color-foreground-muted)]">
                  {totalProducts.toLocaleString()} {locale === 'th' ? 'รายการ' : 'items'}
                </p>
              </div>
            </Link>
            {payload?.role !== 'MANAGER' && (
              <Link
                href={`/${locale}/dashboard/reprint`}
                className="group flex items-center gap-4 p-5 rounded-xl border-2 border-[var(--color-gray-200)] hover:border-[var(--color-gold)] hover:bg-[var(--color-gold)]/5 transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--color-gold)]/10 flex items-center justify-center group-hover:bg-[var(--color-gold)] group-hover:text-white transition-all duration-200">
                  <svg className="w-6 h-6 text-[var(--color-gold)] group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-[var(--color-charcoal)] group-hover:text-[var(--color-gold)] transition-colors">
                    {locale === 'th' ? 'พิมพ์ QR ใหม่' : 'Reprint QR'}
                  </p>
                  <p className="text-sm text-[var(--color-foreground-muted)]">
                    {locale === 'th' ? 'พิมพ์ QR ทดแทน' : 'Print replacement QR'}
                  </p>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
        <div className="px-6 py-4 bg-[var(--color-off-white)] border-b border-[var(--color-beige)] flex items-center justify-between">
          <h2 className="text-display text-lg font-semibold text-[var(--color-charcoal)]">
            {locale === 'th' ? 'กิจกรรมล่าสุด' : 'Recent Activity'}
          </h2>
          <Link
            href={`/${locale}/dashboard/logs`}
            className="text-sm text-[var(--color-gold)] hover:text-[var(--color-gold-dark)] transition-colors"
          >
            {locale === 'th' ? 'ดูทั้งหมด' : 'View All'}
          </Link>
        </div>
        <div className="p-6">
          {recentActivities.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-foreground-muted)]">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p>{locale === 'th' ? 'ยังไม่มีกิจกรรม' : 'No activity yet'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivities.map((activity) => {
                const eventLabels: Record<string, { th: string; en: string; color: string; icon: React.ReactNode }> = {
                  ITEM_CREATED: {
                    th: 'สร้างสินค้า',
                    en: 'Item Created',
                    color: 'bg-blue-100 text-blue-700',
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    ),
                  },
                  ITEM_RECEIVED: {
                    th: 'รับเข้าคลัง',
                    en: 'Item Received',
                    color: 'bg-green-100 text-green-700',
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                    ),
                  },
                  ITEM_SHIPPED: {
                    th: 'ส่งออก',
                    en: 'Item Shipped',
                    color: 'bg-amber-100 text-amber-700',
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    ),
                  },
                  ITEM_ACTIVATED: {
                    th: 'เปิดใช้งาน',
                    en: 'Item Activated',
                    color: 'bg-purple-100 text-purple-700',
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ),
                  },
                  ITEM_RETURNED: {
                    th: 'คืนสินค้า',
                    en: 'Item Returned',
                    color: 'bg-red-100 text-red-700',
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    ),
                  },
                  QR_REPRINTED: {
                    th: 'พิมพ์ QR ใหม่',
                    en: 'QR Reprinted',
                    color: 'bg-cyan-100 text-cyan-700',
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z" />
                      </svg>
                    ),
                  },
                  DAMAGE: {
                    th: 'แจ้งเสียหาย',
                    en: 'Damaged',
                    color: 'bg-red-100 text-red-700',
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    ),
                  },
                  REPAIR: {
                    th: 'ซ่อมแซมแล้ว',
                    en: 'Repaired',
                    color: 'bg-teal-100 text-teal-700',
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    ),
                  },
                  SCRAP: {
                    th: 'ทิ้งแล้ว',
                    en: 'Scrapped',
                    color: 'bg-gray-100 text-gray-700',
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    ),
                  },
                }
                const eventInfo = eventLabels[activity.eventType] || {
                  th: activity.eventType,
                  en: activity.eventType,
                  color: 'bg-gray-100 text-gray-700',
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                }

                // Parse details JSON
                const details = activity.details as { clinicName?: string; grnNumber?: string; outboundNumber?: string; reason?: string } | null

                return (
                  <div key={activity.id} className="flex items-start gap-4 p-4 rounded-xl hover:bg-[var(--color-off-white)] transition-colors border border-transparent hover:border-[var(--color-beige)]">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${eventInfo.color}`}>
                      {eventInfo.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${eventInfo.color}`}>
                          {locale === 'th' ? eventInfo.th : eventInfo.en}
                        </span>
                        <span className="text-xs text-[var(--color-foreground-muted)]">
                          {new Date(activity.createdAt).toLocaleString(locale === 'th' ? 'th-TH' : 'en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {activity.productItem && (
                        <p className="text-sm font-medium text-[var(--color-charcoal)] mt-1">
                          {activity.productItem.name || activity.productItem.serial12}
                          {activity.productItem.name && (
                            <span className="text-[var(--color-foreground-muted)] font-normal ml-2">
                              ({activity.productItem.serial12})
                            </span>
                          )}
                        </p>
                      )}
                      {details && (
                        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">
                          {details.clinicName && (
                            <span>{locale === 'th' ? 'คลินิก: ' : 'Clinic: '}{details.clinicName}</span>
                          )}
                          {details.grnNumber && (
                            <span>{locale === 'th' ? 'เลขที่ GRN: ' : 'GRN No: '}{details.grnNumber}</span>
                          )}
                          {details.outboundNumber && (
                            <span>{locale === 'th' ? 'เลขที่ส่งออก: ' : 'Outbound No: '}{details.outboundNumber}</span>
                          )}
                          {details.reason && (
                            <span>{locale === 'th' ? 'เหตุผล: ' : 'Reason: '}{details.reason}</span>
                          )}
                        </p>
                      )}
                      {activity.user && (
                        <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
                          {locale === 'th' ? 'โดย ' : 'by '}{activity.user.displayName}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
