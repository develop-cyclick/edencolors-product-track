import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse, errorResponse } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'

type HandlerContext = { user: JWTPayload }

// GET /api/admin/event-logs
// Get event logs with filtering and pagination
async function handleGET(request: NextRequest, _context: HandlerContext) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const skip = (page - 1) * limit

  // Filters
  const eventType = searchParams.get('eventType')
  const serial = searchParams.get('serial')
  const userId = searchParams.get('userId')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  // Sorting
  const sortBy = searchParams.get('sortBy') || 'createdAt'
  const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

  // Build where clause
  const where: Record<string, unknown> = {}

  if (eventType) {
    where.eventType = eventType
  }

  if (serial) {
    where.productItem = {
      serial12: { contains: serial },
    }
  }

  if (userId) {
    where.userId = parseInt(userId)
  }

  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) {
      (where.createdAt as Record<string, unknown>).gte = new Date(startDate)
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      ;(where.createdAt as Record<string, unknown>).lte = end
    }
  }

  try {
    // Build orderBy based on sortBy parameter
    type OrderByType = Record<string, 'asc' | 'desc' | { serial12?: 'asc' | 'desc' } | { displayName?: 'asc' | 'desc' }>
    let orderBy: OrderByType = { createdAt: sortOrder }

    if (sortBy === 'eventType') {
      orderBy = { eventType: sortOrder }
    } else if (sortBy === 'serial') {
      orderBy = { productItem: { serial12: sortOrder } }
    } else if (sortBy === 'user') {
      orderBy = { user: { displayName: sortOrder } }
    }

    const [logs, total] = await Promise.all([
      prisma.eventLog.findMany({
        where,
        include: {
          productItem: {
            select: {
              id: true,
              serial12: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              displayName: true,
              role: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.eventLog.count({ where }),
    ])

    return successResponse({
      items: logs.map((log) => ({
        id: log.id,
        eventType: log.eventType,
        productItem: log.productItem
          ? {
              id: log.productItem.id,
              serial12: log.productItem.serial12,
              name: log.productItem.name,
            }
          : null,
        user: log.user
          ? {
              id: log.user.id,
              displayName: log.user.displayName,
              role: log.user.role,
            }
          : null,
        details: log.details,
        createdAt: log.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Event logs error:', error)
    return errorResponse('Failed to fetch event logs', 500)
  }
}

// Get summary statistics for event types
async function handleGETStats(_request: NextRequest, _context: HandlerContext) {
  try {
    const stats = await prisma.eventLog.groupBy({
      by: ['eventType'],
      _count: { id: true },
    })

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const todayStats = await prisma.eventLog.groupBy({
      by: ['eventType'],
      where: {
        createdAt: { gte: todayStart },
      },
      _count: { id: true },
    })

    return NextResponse.json(
      successResponse({
        total: stats.map((s) => ({
          eventType: s.eventType,
          count: s._count.id,
        })),
        today: todayStats.map((s) => ({
          eventType: s.eventType,
          count: s._count.id,
        })),
      })
    )
  } catch (error) {
    console.error('Event stats error:', error)
    return NextResponse.json(
      errorResponse('Failed to fetch event statistics'),
      { status: 500 }
    )
  }
}

export const GET = withRoles(['ADMIN', 'MANAGER'], handleGET)
