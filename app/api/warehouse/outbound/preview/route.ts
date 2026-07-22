import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse, errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'
import type { Prisma } from '@prisma/client'

type HandlerContext = { user: JWTPayload }

interface PreviewLineInput {
  productMasterId: number
  quantity: number
}

// POST /api/warehouse/outbound/preview
// Preview which ProductItems the FIFO selection WILL pull for each line, without
// mutating anything. Uses the EXACT same ordering as the create/edit paths
// (`[expDate, createdAt, serial12]`) so the preview matches what save will pick.
async function handlePOST(request: NextRequest, _context: HandlerContext) {
  try {
    const body = await request.json()
    const linesByProductMaster: PreviewLineInput[] = body.linesByProductMaster || []
    // In edit mode the outbound's current items are PENDING_OUT; the PATCH edit
    // reverts them to IN_STOCK before re-selecting, so they must be part of the
    // candidate pool for the preview to match reality.
    const outboundId: number | undefined =
      body.outboundId != null ? parseInt(String(body.outboundId)) : undefined
    // Items the user chose to skip — excluded from the candidate pool so the
    // preview shows exactly what create/edit will pull with the same excludes.
    const excludeItemIds: number[] = Array.isArray(body.excludeItemIds)
      ? body.excludeItemIds.map(Number).filter((n: number) => Number.isInteger(n) && n > 0)
      : []

    if (!Array.isArray(linesByProductMaster) || linesByProductMaster.length === 0) {
      return errors.badRequest('linesByProductMaster is required')
    }

    const lines = []
    for (const line of linesByProductMaster) {
      if (!line.productMasterId || !line.quantity || line.quantity < 1) {
        continue
      }

      const productMaster = await prisma.productMaster.findUnique({
        where: { id: line.productMasterId },
        select: {
          id: true,
          sku: true,
          nameTh: true,
          nameEn: true,
          modelSize: true,
          defaultUnit: { select: { nameTh: true, nameEn: true } },
        },
      })
      if (!productMaster) continue

      const statusFilter: Prisma.ProductItemWhereInput =
        outboundId != null && !Number.isNaN(outboundId)
          ? {
              OR: [
                { status: 'IN_STOCK' },
                { status: 'PENDING_OUT', outboundLines: { some: { outboundId } } },
              ],
            }
          : { status: 'IN_STOCK' }

      const where: Prisma.ProductItemWhereInput = {
        productMasterId: line.productMasterId,
        ...statusFilter,
        ...(excludeItemIds.length > 0 ? { id: { notIn: excludeItemIds } } : {}),
      }

      const [available, items] = await Promise.all([
        prisma.productItem.count({ where }),
        prisma.productItem.findMany({
          where,
          orderBy: [{ expDate: 'asc' }, { createdAt: 'asc' }, { serial12: 'asc' }],
          take: line.quantity,
          select: { id: true, serial12: true, lot: true, expDate: true },
        }),
      ])

      lines.push({
        productMasterId: productMaster.id,
        sku: productMaster.sku,
        nameTh: productMaster.nameTh,
        nameEn: productMaster.nameEn,
        modelSize: productMaster.modelSize,
        unit: productMaster.defaultUnit,
        requested: line.quantity,
        available,
        enough: available >= line.quantity,
        items,
      })
    }

    return successResponse({ lines })
  } catch (error) {
    console.error('Outbound preview error:', error instanceof Error ? error.message : error)
    return errors.internalError()
  }
}

export const POST = withRoles(['ADMIN', 'WAREHOUSE'], handlePOST)
