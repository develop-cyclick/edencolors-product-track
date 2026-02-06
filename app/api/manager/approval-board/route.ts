import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'

type HandlerContext = { user: JWTPayload }

// GET /api/manager/approval-board - Get pending GRN and outbounds for approval
async function handleGET(request: NextRequest, _context: HandlerContext) {
  const { searchParams } = request.nextUrl
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const type = searchParams.get('type') || 'all' // 'grn', 'outbound', 'all'
  const status = searchParams.get('status') || 'PENDING'

  const skip = (page - 1) * limit

  // Get GRN stats using raw SQL (pending = no approvedAt AND no rejectedAt)
  const grnStats = await prisma.$queryRaw<Array<{
    pending: bigint
    approved: bigint
    rejected: bigint
  }>>`
    SELECT
      COUNT(*) FILTER (WHERE approved_at IS NULL AND rejected_at IS NULL) as pending,
      COUNT(*) FILTER (WHERE approved_at IS NOT NULL) as approved,
      COUNT(*) FILTER (WHERE rejected_at IS NOT NULL) as rejected
    FROM grn_headers
  `
  const grnPending = Number(grnStats[0]?.pending || 0)
  const grnApproved = Number(grnStats[0]?.approved || 0)

  // Get Outbound stats
  const outboundStats = await prisma.outboundHeader.groupBy({
    by: ['status'],
    _count: { status: true },
  })

  const outboundStatusCounts = {
    DRAFT: 0,
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
  }
  for (const stat of outboundStats) {
    outboundStatusCounts[stat.status] = stat._count.status
  }

  // Combined stats
  const stats = {
    grn: {
      pending: grnPending,
      approved: grnApproved,
    },
    outbound: outboundStatusCounts,
    totalPending: grnPending + outboundStatusCounts.PENDING,
  }

  // Fetch data based on type
  let grnItems: unknown[] = []
  let outboundItems: unknown[] = []

  if (type === 'grn' || type === 'all') {
    // Get GRN IDs using raw SQL to filter by rejected_at
    const grnSkip = type === 'grn' ? skip : 0
    const grnTake = type === 'grn' ? limit : 10

    let grnIds: number[] = []
    if (status === 'PENDING') {
      // Pending = not approved AND not rejected
      const pendingGrns = await prisma.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM grn_headers
        WHERE approved_at IS NULL AND rejected_at IS NULL
        ORDER BY created_at DESC
        OFFSET ${grnSkip} LIMIT ${grnTake}
      `
      grnIds = pendingGrns.map(g => g.id)
    } else {
      // Approved
      const approvedGrns = await prisma.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM grn_headers
        WHERE approved_at IS NOT NULL
        ORDER BY created_at DESC
        OFFSET ${grnSkip} LIMIT ${grnTake}
      `
      grnIds = approvedGrns.map(g => g.id)
    }

    if (grnIds.length > 0) {
      grnItems = await prisma.gRNHeader.findMany({
        where: { id: { in: grnIds } },
        include: {
          warehouse: { select: { id: true, name: true } },
          receivedBy: { select: { id: true, displayName: true, username: true } },
          approvedBy: { select: { id: true, displayName: true, username: true } },
          lines: {
            select: {
              id: true,
              sku: true,
              itemName: true,
              modelSize: true,
              lot: true,
              mfgDate: true,
              expDate: true,
              inspectionStatus: true,
              remarks: true,
              productItem: {
                select: {
                  id: true,
                  serial12: true,
                  sku: true,
                  name: true,
                },
              },
              unit: { select: { id: true, nameTh: true } },
            },
            orderBy: { id: 'asc' },
          },
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    }
  }

  if (type === 'outbound' || type === 'all') {
    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'DRAFT']
    const filterStatus = validStatuses.includes(status) ? status : 'PENDING'

    outboundItems = await prisma.outboundHeader.findMany({
      where: { status: filterStatus as 'PENDING' | 'APPROVED' | 'REJECTED' | 'DRAFT' },
      include: {
        warehouse: { select: { id: true, name: true } },
        shippingMethod: { select: { id: true, nameTh: true } },
        clinic: { select: { id: true, name: true, province: true, branchName: true } },
        createdBy: { select: { id: true, displayName: true } },
        approvedBy: { select: { id: true, displayName: true } },
        lines: {
          select: {
            id: true,
            sku: true,
            itemName: true,
            modelSize: true,
            lot: true,
            expDate: true,
            productItem: {
              select: {
                id: true,
                serial12: true,
                sku: true,
                name: true,
                modelSize: true,
                lot: true,
                mfgDate: true,
                expDate: true,
                status: true,
              },
            },
            unit: { select: { nameTh: true } },
          },
          orderBy: { id: 'asc' },
        },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: type === 'outbound' ? skip : 0,
      take: type === 'outbound' ? limit : 10,
    })
  }

  // Calculate total based on type
  let total = 0
  if (type === 'grn') {
    total = status === 'PENDING' ? grnPending : grnApproved
  } else if (type === 'outbound') {
    total = outboundStatusCounts[status as keyof typeof outboundStatusCounts] || 0
  } else {
    total = stats.totalPending
  }

  return successResponse({
    grn: grnItems,
    outbound: outboundItems,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    stats,
  })
}

export const GET = withRoles(['ADMIN', 'MANAGER'], handleGET)
