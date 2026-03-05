import webPush from 'web-push'
import prisma from './prisma'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

/**
 * Send push notification to a specific user (all their subscriptions)
 */
export async function sendPushToUser(userId: number, payload: PushPayload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  })

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        )
      } catch (error: unknown) {
        // Remove invalid/expired subscriptions (410 Gone or 404)
        const statusCode = (error as { statusCode?: number })?.statusCode
        if (statusCode === 410 || statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        }
        throw error
      }
    })
  )

  return results
}

/**
 * Send push notification to all users with a specific role
 */
export async function sendPushToRole(role: string, payload: PushPayload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return

  const users = await prisma.user.findMany({
    where: { role: role as never, isActive: true },
    select: { id: true },
  })

  await Promise.allSettled(users.map((u) => sendPushToUser(u.id, payload)))
}

/**
 * Send push notification to all ADMIN and MANAGER users
 */
export async function notifyManagers(payload: PushPayload) {
  await Promise.allSettled([sendPushToRole('ADMIN', payload), sendPushToRole('MANAGER', payload)])
}

/**
 * Send push notification to all WAREHOUSE users
 */
export async function notifyWarehouse(payload: PushPayload) {
  await sendPushToRole('WAREHOUSE', payload)
}
