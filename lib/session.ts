import { cookies } from 'next/headers'
import { createToken, verifyToken, JWTPayload } from './auth'
import prisma from './prisma'

const COOKIE_NAME = 'auth_token'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
}

/**
 * Set auth cookie with JWT token
 */
export async function setAuthCookie(payload: JWTPayload): Promise<void> {
  const token = await createToken(payload)
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTIONS)
}

/**
 * Get current user from auth cookie
 */
export async function getCurrentUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) {
    return null
  }

  const payload = await verifyToken(token)
  if (!payload) {
    return null
  }

  // Re-validate the token against the DB on every request. The JWT is long-lived (7 days)
  // and has no server-side revocation, so without this a deactivated or demoted user would
  // keep full access until the token expires. Reject if the account is gone/disabled, and
  // always authorize with the CURRENT role from the DB, not the (possibly stale) token role.
  const dbUser = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { isActive: true, role: true, username: true, displayName: true },
  })
  if (!dbUser || !dbUser.isActive) {
    return null
  }

  return {
    ...payload,
    role: dbUser.role,
    username: dbUser.username,
    displayName: dbUser.displayName,
  }
}

/**
 * Remove auth cookie (logout)
 */
export async function removeAuthCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser()
  return user !== null
}
