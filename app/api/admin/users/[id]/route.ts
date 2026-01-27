import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { withAdmin } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import { UserRole } from '@prisma/client'

type Params = { id: string }

// GET /api/admin/users/[id] - Get user by ID
export const GET = withAdmin<Promise<Params>>(async (_request, { params }) => {
  try {
    const { id } = await params!
    const userId = parseInt(id)

    if (isNaN(userId)) {
      return errorResponse('Invalid user ID', 400)
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
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
    })

    if (!user) {
      return errors.notFound('User')
    }

    return successResponse({ user })
  } catch (error) {
    console.error('Get user error:', error)
    return errors.internalError()
  }
})

// PATCH /api/admin/users/[id] - Update user
export const PATCH = withAdmin<Promise<Params>>(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!
    const userId = parseInt(id)

    if (isNaN(userId)) {
      return errorResponse('Invalid user ID', 400)
    }

    const body = await request.json()

    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!existing) {
      return errors.notFound('User')
    }

    // Validate role if provided
    if (body.role && !Object.values(UserRole).includes(body.role)) {
      return errorResponse('Invalid role', 400)
    }

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (body.displayName) updateData.displayName = body.displayName
    if (body.role) updateData.role = body.role
    if (body.isActive !== undefined) updateData.isActive = body.isActive
    if (body.forcePwChange !== undefined) updateData.forcePwChange = body.forcePwChange

    // Handle password reset
    if (body.password) {
      updateData.passwordHash = await hashPassword(body.password)
      updateData.forcePwChange = true // Force password change after reset
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        forcePwChange: true,
        updatedAt: true,
      },
    })

    return successResponse({ user })
  } catch (error) {
    console.error('Update user error:', error)
    return errors.internalError()
  }
})

// DELETE /api/admin/users/[id] - Deactivate or permanently delete user
// Use ?hard=true for permanent deletion
export const DELETE = withAdmin<Promise<Params>>(async (request: NextRequest, { params, user: currentUser }) => {
  try {
    const { id } = await params!
    const userId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const hardDelete = searchParams.get('hard') === 'true'

    if (isNaN(userId)) {
      return errorResponse('Invalid user ID', 400)
    }

    // Prevent self-deletion
    if (userId === currentUser.userId) {
      return errorResponse('Cannot delete your own account', 400)
    }

    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!existing) {
      return errors.notFound('User')
    }

    if (hardDelete) {
      // Permanent delete
      await prisma.user.delete({
        where: { id: userId },
      })
      return successResponse({ message: 'User deleted permanently' })
    } else {
      // Soft delete (deactivate)
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      })
      return successResponse({ message: 'User deactivated successfully' })
    }
  } catch (error) {
    console.error('Delete user error:', error)
    return errors.internalError()
  }
})
