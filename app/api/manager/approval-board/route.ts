import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'
import type { DamagedActionStatus, BorrowStatus } from '@prisma/client'

type HandlerContext = { user: JWTPayload }

// GET /api/manager/approval-board - Get pending GRN, outbounds, and damaged actions for approval
async function handleGET(request: NextRequest, _context: HandlerContext) {
  const { searchParams } = request.nextUrl
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const type = searchParams.get('type') || 'all' // 'grn', 'outbound', 'damaged', 'borrow', 'claim', 'all'
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

  // Get Damaged Action Request stats
  const damagedStats = await prisma.damagedActionRequest.groupBy({
    by: ['status'],
    _count: { status: true },
  })

  const damagedStatusCounts = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
  }
  for (const stat of damagedStats) {
    damagedStatusCounts[stat.status] = stat._count.status
  }

  // Get Borrow Transaction stats (only BORROW type needs approval, RETURN is auto-approved)
  const borrowStats = await prisma.borrowTransaction.groupBy({
    by: ['status'],
    where: { type: 'BORROW' },
    _count: { status: true },
  })

  const borrowStatusCounts = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
  }
  for (const stat of borrowStats) {
    if (stat.status in borrowStatusCounts) {
      borrowStatusCounts[stat.status as keyof typeof borrowStatusCounts] = stat._count.status
    }
  }

  // Get Damaged Claim stats
  const claimStats = await prisma.damagedClaim.groupBy({
    by: ['status'],
    _count: { status: true },
  })

  const claimStatusCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0 }
  for (const stat of claimStats) {
    claimStatusCounts[stat.status] = stat._count.status
  }

  // Combined stats
  const stats = {
    grn: {
      pending: grnPending,
      approved: grnApproved,
    },
    outbound: outboundStatusCounts,
    damaged: damagedStatusCounts,
    borrow: borrowStatusCounts,
    claim: claimStatusCounts,
    totalPending: grnPending + outboundStatusCounts.PENDING + damagedStatusCounts.PENDING + borrowStatusCounts.PENDING + claimStatusCounts.PENDING,
  }

  // Fetch data based on type
  let grnItems: unknown[] = []
  let outboundItems: unknown[] = []
  let damagedItems: unknown[] = []
  let borrowItems: unknown[] = []
  let claimItems: unknown[] = []

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

  if (type === 'damaged' || type === 'all') {
    const filterStatus = (['PENDING', 'APPROVED', 'REJECTED'].includes(status) ? status : 'PENDING') as DamagedActionStatus

    damagedItems = await prisma.damagedActionRequest.findMany({
      where: { status: filterStatus },
      include: {
        productItem: {
          include: {
            productMaster: {
              select: {
                id: true,
                sku: true,
                nameTh: true,
                nameEn: true,
                modelSize: true,
                category: { select: { nameTh: true, nameEn: true } },
              },
            },
          },
        },
        replacementItem: {
          select: { id: true, serial12: true },
        },
        createdBy: { select: { id: true, displayName: true } },
        approvedBy: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: type === 'damaged' ? skip : 0,
      take: type === 'damaged' ? limit : 10,
    })
  }

  if (type === 'borrow' || type === 'all') {
    const filterBorrowStatus = (['PENDING', 'APPROVED', 'REJECTED'].includes(status) ? status : 'PENDING') as BorrowStatus

    borrowItems = await prisma.borrowTransaction.findMany({
      where: {
        type: 'BORROW',
        status: filterBorrowStatus,
      },
      include: {
        createdBy: { select: { id: true, displayName: true } },
        approvedBy: { select: { id: true, displayName: true } },
        rejectedBy: { select: { id: true, displayName: true } },
        lines: {
          include: {
            productItem: {
              select: {
                id: true,
                serial12: true,
                sku: true,
                name: true,
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
      skip: type === 'borrow' ? skip : 0,
      take: type === 'borrow' ? limit : 10,
    })
  }

  if (type === 'claim' || type === 'all') {
    const filterClaimStatus = (['PENDING', 'APPROVED', 'REJECTED'].includes(status) ? status : 'PENDING') as DamagedActionStatus

    claimItems = await prisma.damagedClaim.findMany({
      where: { status: filterClaimStatus },
      include: {
        clinic: { select: { id: true, name: true, province: true } },
        productMaster: { select: { id: true, sku: true, nameTh: true, nameEn: true, modelSize: true } },
        createdBy: { select: { id: true, displayName: true } },
        approvedBy: { select: { id: true, displayName: true } },
        attachments: { select: { id: true, fileUrl: true, fileName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: type === 'claim' ? skip : 0,
      take: type === 'claim' ? limit : 10,
    })
  }

  // Calculate total based on type
  let total = 0
  if (type === 'grn') {
    total = status === 'PENDING' ? grnPending : grnApproved
  } else if (type === 'outbound') {
    total = outboundStatusCounts[status as keyof typeof outboundStatusCounts] || 0
  } else if (type === 'damaged') {
    total = damagedStatusCounts[status as keyof typeof damagedStatusCounts] || 0
  } else if (type === 'borrow') {
    total = borrowStatusCounts[status as keyof typeof borrowStatusCounts] || 0
  } else if (type === 'claim') {
    total = claimStatusCounts[status as keyof typeof claimStatusCounts] || 0
  } else {
    total = stats.totalPending
  }

  return successResponse({
    grn: grnItems,
    outbound: outboundItems,
    damaged: damagedItems,
    borrow: borrowItems,
    claim: claimItems,
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
