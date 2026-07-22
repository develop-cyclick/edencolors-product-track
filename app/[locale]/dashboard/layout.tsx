import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import {
  canAccessPageKey,
  allowedPageKeysForRole,
  pageKeyFromPath,
} from '@/lib/permissions'
import { loadPermissionMatrix } from '@/lib/permissions-server'
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

  const role = payload.role as string

  // Load the effective role → page access matrix (admin-configurable, stored in
  // SystemSetting; defaults reproduce the previous hardcoded behavior).
  const matrix = await loadPermissionMatrix()

  // Route guard: if this role may not access the requested page, bounce to the
  // dashboard root (always allowed to every role → no redirect loop).
  const pathname = (await headers()).get('x-pathname') || ''
  const pageKey = pageKeyFromPath(pathname)
  if (!canAccessPageKey(role, pageKey, matrix)) {
    redirect(`/${locale}/dashboard`)
  }

  const allowedPages = allowedPageKeysForRole(role, matrix)

  return (
    <DashboardClientLayout
      locale={locale}
      userRole={role}
      userName={payload.displayName as string}
      allowedPages={allowedPages}
    >
      {children}
    </DashboardClientLayout>
  )
}
