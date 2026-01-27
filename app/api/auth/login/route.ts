import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { comparePassword } from '@/lib/auth'
import { setAuthCookie } from '@/lib/session'
import { successResponse, errorResponse, errors } from '@/lib/api-response'

interface LoginRequest {
  username: string
  password: string
}

// POST /api/auth/login
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginRequest

    // Validate input
    if (!body.username || !body.password) {
      return errorResponse('Username and password are required', 400)
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { username: body.username },
    })

    if (!user) {
      return errorResponse('Invalid username or password', 401)
    }

    // Check if user is active
    if (!user.isActive) {
      return errorResponse('Account is disabled', 401)
    }

    // Verify password
    const isValidPassword = await comparePassword(body.password, user.passwordHash)
    if (!isValidPassword) {
      return errorResponse('Invalid username or password', 401)
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
