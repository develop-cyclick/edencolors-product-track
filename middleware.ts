import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from './lib/auth'

// Routes that require authentication
const protectedRoutes = ['/dashboard', '/admin', '/warehouse', '/manager']

// Routes that are public (no auth required)
const publicRoutes = ['/login', '/verify', '/activate', '/api/public']

// Auth API routes (allow without token for login)
const authRoutes = ['/api/auth/login']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Expose the current path to server components. The dashboard layout reads
  // `x-pathname` to enforce the admin-configured role → page access matrix
  // (Next.js does not otherwise pass the pathname to a layout).
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  const nextWithPath = () => NextResponse.next({ request: { headers: requestHeaders } })

  // Allow auth routes
  if (authRoutes.some((route) => pathname.startsWith(route))) {
    return nextWithPath()
  }

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return nextWithPath()
  }

  // Allow static files and API health
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/health') ||
    pathname.includes('.')
  ) {
    return nextWithPath()
  }

  // Check authentication for protected routes
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      // Redirect to login
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Verify token
    const payload = await verifyToken(token)
    if (!payload) {
      // Invalid token, redirect to login
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Check role-based access
    if (pathname.startsWith('/admin') && payload.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    if (pathname.startsWith('/manager') && !['ADMIN', 'MANAGER'].includes(payload.role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return nextWithPath()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
