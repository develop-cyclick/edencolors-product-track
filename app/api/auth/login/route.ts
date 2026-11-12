import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { comparePassword } from '@/lib/auth'
import { setAuthCookie } from '@/lib/session'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import { checkRateLimit, rateLimitPresets } from '@/lib/rate-limit'

interface LoginRequest {
  username: string
  password: string
}

// POST /api/auth/login
export async function POST(request: NextRequest) {
  try {
    // Throttle login attempts per client IP to prevent brute-force / credential stuffing.
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const rateLimit = checkRateLimit(`login:${ip}`, rateLimitPresets.auth)
    if (!rateLimit.allowed) {
      return errorResponse('Too many login attempts. Please try again in a few minutes.', 429)
    }

    const body = (await request.json()) as LoginRequest

    // Validate input
    if (!body.username || !body.password) {
      return errorResponse('Username and password are required', 400)
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { username: body.username },
    })

    // Always run a bcrypt comparison (against a throwaway hash when the user doesn't exist) so
    // response time doesn't reveal whether a username exists (timing-based enumeration).
    const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
    const isValidPassword = await comparePassword(body.password, user?.passwordHash || DUMMY_HASH)

    // Generic error for both unknown username and wrong password — don't reveal which failed.
    if (!user || !isValidPassword) {
      return errorResponse('Invalid username or password', 401)
    }

    // Reveal "disabled" only AFTER a correct password, so it can't be used to enumerate accounts.
    if (!user.isActive) {
      return errorResponse('Account is disabled', 401)
    }

    // Create session
    await setAuthCookie({
      userId: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
    })

    // Return user info (without password)
    return successResponse({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        forcePwChange: user.forcePwChange,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return errors.internalError()
  }
}
