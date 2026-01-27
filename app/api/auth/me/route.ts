import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { successResponse, errors } from '@/lib/api-response'

// GET /api/auth/me
export async function GET() {
  try {
    const session = await getCurrentUser()

    if (!session) {
      return errors.unauthorized()
    }

    // Get fresh user data from database
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
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

    if (!user || !user.isActive) {
      return errors.unauthorized()
    }

    return successResponse({ user })
  } catch (error) {
    console.error('Get user error:', error)
    return errors.internalError()
  }
}
