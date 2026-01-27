import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import DashboardClientLayout from '@/components/dashboard/dashboard-client-layout'

interface DashboardLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function DashboardLayout({
  children,
  params,
}: DashboardLayoutProps) {
  const { locale } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value

  if (!token) {
    redirect(`/${locale}/login`)
  }

  const payload = await verifyToken(token)
  if (!payload) {
    redirect(`/${locale}/login`)
  }

  return (
    <DashboardClientLayout
      locale={locale}
      userRole={payload.role as string}
      userName={payload.displayName as string}
    >
      {children}
    </DashboardClientLayout>
  )
}
