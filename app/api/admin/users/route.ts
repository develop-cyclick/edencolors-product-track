import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { withAdmin } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import { UserRole } from '@prisma/client'

// GET /api/admin/users - List all users
export const GET = withAdmin(async () => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        forcePwChange: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return successResponse({ users })
  } catch (error) {
    console.error('List users error:', error)
    return errors.internalError()
  }
})

// POST /api/admin/users - Create a new user
export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.username || !body.password || !body.displayName || !body.role) {
      return errorResponse('Username, password, displayName, and role are required', 400)
    }

    // Validate role
    if (!Object.values(UserRole).includes(body.role)) {
      return errorResponse('Invalid role', 400)
    }

    // Check if username already exists
    const existing = await prisma.user.findUnique({
      where: { username: body.username },
    })

    if (existing) {
      return errorResponse('Username already exists', 400)
    }

    // Hash password
    const passwordHash = await hashPassword(body.password)

    const user = await prisma.user.create({
      data: {
        username: body.username,
        passwordHash,
        displayName: body.displayName,
        role: body.role,
        isActive: body.isActive ?? true,
        forcePwChange: body.forcePwChange ?? true, // Force password change on first login
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        forcePwChange: true,
        createdAt: true,
      },
    })

    return successResponse({ user }, 201)
  } catch (error) {
    console.error('Create user error:', error)
    return errors.internalError()
  }
})
