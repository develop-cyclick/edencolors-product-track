import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'
import { successResponse } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'

type HandlerContext = { user: JWTPayload }

// GET /api/notifications/badges - Get badge counts for sidebar menu items
async function handleGET(_request: NextRequest, context: HandlerContext) {
  const { role } = context.user
  const counts: Record<string, number> = {}

  // Approval badge — for ADMIN/MANAGER: total pending items across all types
  if (role === 'ADMIN' || role === 'MANAGER') {
    const [grnPending, outboundPending, damagedPending, borrowPending, claimPending] =
      await Promise.all([
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count FROM grn_headers
          WHERE approved_at IS NULL AND rejected_at IS NULL
        `.then((r) => Number(r[0]?.count || 0)),
        prisma.outboundHeader.count({ where: { status: 'PENDING' } }),
        prisma.damagedActionRequest.count({ where: { status: 'PENDING' } }),
        prisma.borrowTransaction.count({ where: { type: 'BORROW', status: 'PENDING' } }),
        prisma.damagedClaim.count({ where: { status: 'PENDING' } }),
      ])

    counts.approval = grnPending + outboundPending + damagedPending + borrowPending + claimPending
  }

  // Damaged badge — for ADMIN/WAREHOUSE: pending damaged action requests + pending claims
  if (role === 'ADMIN' || role === 'WAREHOUSE') {
    const [damagedPending, claimPending] = await Promise.all([
      prisma.damagedActionRequest.count({ where: { status: 'PENDING' } }),
      prisma.damagedClaim.count({ where: { status: 'PENDING' } }),
    ])
    counts.damaged = damagedPending + claimPending
  }

  return successResponse(counts)
}

export const GET = withAuth(handleGET)
