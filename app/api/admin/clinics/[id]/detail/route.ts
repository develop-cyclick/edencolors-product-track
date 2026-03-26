import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withWarehouse } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'

type Params = { id: string }

// GET /api/admin/clinics/[id]/detail - Get clinic detail with stats and outbounds
export const GET = withWarehouse<Promise<Params>>(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!
    const clinicId = parseInt(id)

    if (isNaN(clinicId)) {
      return errorResponse('Invalid clinic ID', 400)
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const poRemainingFilter = searchParams.get('poRemaining') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Fetch clinic
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
    })

    if (!clinic) {
      return errors.notFound('Clinic')
    }

    // Build outbound where clause
    const outboundWhere: Record<string, unknown> = { clinicId }
    if (status && status !== 'all') {
      outboundWhere.status = status
    }
    // For poRemaining filter, we need to post-filter after enrichment
    // So fetch more and paginate manually when this filter is active
    const usePOFilter = poRemainingFilter

    // Fetch stats and outbounds in parallel
    const [
      totalOutbounds,
      approvedOutbounds,
      pendingOutbounds,
      rejectedOutbounds,
      totalItems,
      shippedItems,
      poLineAggregates,
      rawOutbounds,
      outboundCount,
    ] = await Promise.all([
      prisma.outboundHeader.count({ where: { clinicId } }),
      prisma.outboundHeader.count({ where: { clinicId, status: 'APPROVED' } }),
      prisma.outboundHeader.count({ where: { clinicId, status: { in: ['DRAFT', 'PENDING'] } } }),
      prisma.outboundHeader.count({ where: { clinicId, status: 'REJECTED' } }),
      prisma.outboundLine.count({
        where: { outbound: { clinicId } },
      }),
      prisma.outboundLine.count({
        where: { outbound: { clinicId, status: 'APPROVED' } },
      }),
      prisma.purchaseOrderLine.aggregate({
        where: {
          purchaseOrder: {
            clinicId,
            status: { notIn: ['CANCELLED'] },
          },
        },
        _sum: {
          quantity: true,
          shippedQuantity: true,
        },
      }),
      // When filtering by poRemaining, fetch all matching outbounds (post-filter)
      usePOFilter
        ? prisma.outboundHeader.findMany({
            where: outboundWhere,
            include: {
              warehouse: { select: { id: true, name: true } },
              shippingMethod: { select: { id: true, nameTh: true } },
              createdBy: { select: { id: true, displayName: true } },
              approvedBy: { select: { id: true, displayName: true } },
              purchaseOrder: {
                select: {
                  id: true,
                  poNo: true,
                  status: true,
                  lines: { select: { quantity: true, shippedQuantity: true } },
                },
              },
              _count: { select: { lines: true } },
            },
            orderBy: { createdAt: 'desc' },
          })
        : prisma.outboundHeader.findMany({
            where: outboundWhere,
            include: {
              warehouse: { select: { id: true, name: true } },
              shippingMethod: { select: { id: true, nameTh: true } },
              createdBy: { select: { id: true, displayName: true } },
              approvedBy: { select: { id: true, displayName: true } },
              purchaseOrder: {
                select: {
                  id: true,
                  poNo: true,
                  status: true,
                  lines: { select: { quantity: true, shippedQuantity: true } },
                },
              },
              _count: { select: { lines: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          }),
      usePOFilter
        ? Promise.resolve(0) // Will compute after filtering
        : prisma.outboundHeader.count({ where: outboundWhere }),
    ])

    // Enrich with PO shipping summary (same pattern as outbound API)
    const enriched = rawOutbounds.map((ob) => {
      const po = ob.purchaseOrder
      let poSummary = null
      if (po) {
        const totalOrdered = po.lines.reduce((s, l) => s + l.quantity, 0)
        const totalShipped = po.lines.reduce((s, l) => s + l.shippedQuantity, 0)
        poSummary = {
          id: po.id,
          poNo: po.poNo,
          status: po.status,
          totalOrdered,
          totalShipped,
          totalRemaining: totalOrdered - totalShipped,
          isPartial: totalShipped > 0 && totalShipped < totalOrdered,
          isComplete: totalShipped >= totalOrdered,
        }
      }
      const { purchaseOrder: _po, ...rest } = ob
      return { ...rest, purchaseOrder: poSummary }
    })

    // Apply poRemaining filter (keep only outbounds linked to PO with remaining > 0)
    let finalOutbounds = enriched
    let finalTotal = outboundCount as number

    if (usePOFilter) {
      const filtered = enriched.filter(
        (ob) => ob.purchaseOrder && ob.purchaseOrder.totalRemaining > 0
      )
      finalTotal = filtered.length
      finalOutbounds = filtered.slice(skip, skip + limit)
    }

    const poTotalOrdered = poLineAggregates._sum.quantity || 0
    const poTotalShipped = poLineAggregates._sum.shippedQuantity || 0
    const poRemaining = poTotalOrdered - poTotalShipped

    return successResponse({
      clinic,
      stats: {
        totalOutbounds,
        approvedOutbounds,
        pendingOutbounds,
        rejectedOutbounds,
        totalItems,
        shippedItems,
        poTotalOrdered,
        poTotalShipped,
        poRemaining,
      },
      outbounds: finalOutbounds,
      pagination: {
        page,
        limit,
        total: finalTotal,
        totalPages: Math.ceil(finalTotal / limit),
      },
    })
  } catch (error) {
    console.error('Get clinic detail error:', error)
    return errors.internalError()
  }
})
