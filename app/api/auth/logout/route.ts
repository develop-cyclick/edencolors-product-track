import { removeAuthCookie } from '@/lib/session'
import { messageResponse, errors } from '@/lib/api-response'

// POST /api/auth/logout
export async function POST() {
  try {
    await removeAuthCookie()
    return messageResponse('Logged out successfully')
  } catch (error) {
    console.error('Logout error:', error)
    return errors.internalError()
  }
}
