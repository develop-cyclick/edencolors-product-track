import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'
import { successResponse, errorResponse } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'

type HandlerContext = { user: JWTPayload }

// POST /api/notifications/subscribe - Save push subscription
async function handlePOST(request: NextRequest, context: HandlerContext) {
  try {
    const body = await request.json()
    const { endpoint, keys } = body

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return errorResponse('Missing subscription data')
    }

    await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId: context.user.userId,
          endpoint,
        },
      },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      create: {
        userId: context.user.userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    })

    return successResponse({ subscribed: true })
  } catch (error) {
    console.error('Push subscribe error:', error)
    return errorResponse('Failed to subscribe')
  }
}

// DELETE /api/notifications/subscribe - Remove push subscription
async function handleDELETE(request: NextRequest, context: HandlerContext) {
  try {
    const body = await request.json()
    const { endpoint } = body

    if (!endpoint) {
      return errorResponse('Missing endpoint')
    }

    await prisma.pushSubscription.deleteMany({
      where: {
        userId: context.user.userId,
        endpoint,
      },
    })

    return successResponse({ subscribed: false })
  } catch (error) {
    console.error('Push unsubscribe error:', error)
    return errorResponse('Failed to unsubscribe')
  }
}

// GET /api/notifications/subscribe - Check if current user has active subscription
async function handleGET(_request: NextRequest, context: HandlerContext) {
  const count = await prisma.pushSubscription.count({
    where: { userId: context.user.userId },
  })

  return successResponse({ subscribed: count > 0 })
}

export const POST = withAuth(handlePOST)
export const DELETE = withAuth(handleDELETE)
export const GET = withAuth(handleGET)
