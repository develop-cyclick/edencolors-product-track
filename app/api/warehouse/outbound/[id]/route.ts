import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'
import { sendPushToUser } from '@/lib/push-notification'
import { logDocumentEvent } from '@/lib/document-history'

type RouteParams = Promise<{ id: string }>
type HandlerContext = { user: JWTPayload; params?: RouteParams }

// GET /api/warehouse/outbound/[id] - Get Outbound detail
async function handleGET(_request: NextRequest, context: HandlerContext) {
  if (!context.params) {
    return errorResponse('Missing params')
  }

  const { id } = await context.params
  const outboundId = parseInt(id)

  if (isNaN(outboundId)) {
    return errorResponse('Invalid Outbound ID')
  }

  const outbound = await prisma.outboundHeader.findUnique({
    where: { id: outboundId },
    include: {
      warehouse: { select: { id: true, name: true } },
      shippingMethod: { select: { id: true, nameTh: true, nameEn: true } },
      clinic: { select: { id: true, name: true, address: true, branchName: true } },
      createdBy: { select: { id: true, displayName: true, username: true } },
      approvedBy: { select: { id: true, displayName: true, username: true } },
      purchaseOrder: {
        select: {
          id: true,
          poNo: true,
          billingName: true,
          status: true,
          lines: {
            select: {
              id: true,
              quantity: true,
              shippedQuantity: true,
              productMaster: {
                select: { id: true, sku: true, nameTh: true, nameEn: true, modelSize: true },
              },
            },
          },
          outbounds: {
            select: {
              id: true,
              deliveryNoteNo: true,
              status: true,
              createdAt: true,
              shippedAt: true,
              createdBy: { select: { id: true, displayName: true } },
              _count: { select: { lines: true } },
            },
            orderBy: { createdAt: 'asc' as const },
          },
        },
      },
      lines: {
        include: {
          productItem: {
            include: {
              category: { select: { id: true, nameTh: true, nameEn: true } },
              productMaster: {
                select: {
                  documentUnit: { select: { nameTh: true, nameEn: true } },
                },
              },
              qrTokens: {
                where: { status: 'ACTIVE' },
                select: { id: true, tokenVersion: true },
              },
            },
          },
          unit: { select: { id: true, nameTh: true, nameEn: true } },
        },
      },
    },
  })

  if (!outbound) {
    return errors.notFound('Outbound')
  }

  // Compute PO summary
  let poSummary = null
  if (outbound.purchaseOrder) {
    const po = outbound.purchaseOrder
    const totalOrdered = po.lines.reduce((s, l) => s + l.quantity, 0)
    const totalShipped = po.lines.reduce((s, l) => s + l.shippedQuantity, 0)
    poSummary = {
      id: po.id,
      poNo: po.poNo,
      billingName: po.billingName,
      status: po.status,
      totalOrdered,
      totalShipped,
      totalRemaining: totalOrdered - totalShipped,
      isPartial: totalShipped > 0 && totalShipped < totalOrdered,
      isComplete: totalShipped >= totalOrdered,
      lines: po.lines,
      outbounds: po.outbounds,
    }
  }

  const { purchaseOrder: _po, ...rest } = outbound
  return successResponse({ outbound: { ...rest, purchaseOrder: poSummary } })
}

// PATCH /api/warehouse/outbound/[id] - Update/Approve/Reject Outbound
async function handlePATCH(request: NextRequest, context: HandlerContext) {
  if (!context.params) {
    return errorResponse('Missing params')
  }

  const { id } = await context.params
  const outboundId = parseInt(id)
  const body = await request.json()
  const user = context.user

  if (isNaN(outboundId)) {
    return errorResponse('Invalid Outbound ID')
  }

  const outbound = await prisma.outboundHeader.findUnique({
    where: { id: outboundId },
    include: {
      lines: {
        include: {
          productItem: true,
        },
      },
    },
  })

  if (!outbound) {
    return errors.notFound('Outbound')
  }

  // Handle approval
  if (body.action === 'approve') {
    // Only manager/admin can approve
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return errors.forbidden()
    }

    if (outbound.status !== 'PENDING') {
      return errorResponse('Can only approve PENDING outbounds')
    }

    const result = await prisma.$transaction(async (tx) => {
      // Atomic PENDING→APPROVED: updateMany flips the row only while it is still PENDING, so a
      // concurrent or double-clicked approval affects 0 rows and bails out here — preventing
      // the PO shippedQuantity increment below from being counted twice.
      const transition = await tx.outboundHeader.updateMany({
        where: { id: outboundId, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          approvedById: user.userId,
          approvedAt: new Date(),
          shippedAt: new Date(),
        },
      })
      if (transition.count === 0) {
        return null
      }
      const updated = await tx.outboundHeader.findUnique({ where: { id: outboundId } })
      // Record the exact PO increments applied, so a later "reopen" can reverse them precisely
      // (the increment is capped, so a naive re-count on reverse could over/under-decrement).
      const poIncApplied: Record<number, number> = {}

      // Update all product items to SHIPPED
      for (const line of outbound.lines) {
        await tx.productItem.update({
          where: { id: line.productItemId },
          data: { status: 'SHIPPED' },
        })

        // Log event
        await tx.eventLog.create({
          data: {
            eventType: 'APPROVE',
            productItemId: line.productItemId,
            userId: user.userId,
            details: {
              deliveryNoteNo: outbound.deliveryNoteNo,
              action: 'approve',
            },
          },
        })
      }

      // Update PurchaseOrder shipped quantities if linked to a PO
      if (outbound.purchaseOrderId) {
        // Count how many of each ProductMaster we're shipping
        const shippedByProductMaster: Record<number, number> = {}
        for (const line of outbound.lines) {
          const pmId = line.productItem?.productMasterId
          if (pmId && pmId > 0) {
            shippedByProductMaster[pmId] = (shippedByProductMaster[pmId] || 0) + 1
          }
        }

        // Get PO lines and update shippedQuantity
        const poLines = await tx.purchaseOrderLine.findMany({
          where: { purchaseOrderId: outbound.purchaseOrderId },
        })

        for (const poLine of poLines) {
          const shipped = shippedByProductMaster[poLine.productMasterId] || 0
          if (shipped > 0) {
            // Cap the increment at the PO line's remaining so shippedQuantity can never exceed
            // the ordered quantity (over-shipping must not inflate the PO totals).
            const remaining = Math.max(0, poLine.quantity - poLine.shippedQuantity)
            const inc = Math.min(shipped, remaining)
            if (inc > 0) {
              await tx.purchaseOrderLine.update({
                where: { id: poLine.id },
                data: {
                  shippedQuantity: { increment: inc },
                },
              })
              poIncApplied[poLine.id] = inc
            }
            // Deduct from what we're tracking so we don't double-count
            shippedByProductMaster[poLine.productMasterId] -= shipped
          }
        }

        // Check if PO is fully shipped and update status
        const updatedPOLines = await tx.purchaseOrderLine.findMany({
          where: { purchaseOrderId: outbound.purchaseOrderId },
        })

        const allShipped = updatedPOLines.every((line) => line.shippedQuantity >= line.quantity)
        const someShipped = updatedPOLines.some((line) => line.shippedQuantity > 0)

        let newStatus: 'CONFIRMED' | 'PARTIAL' | 'COMPLETED' = 'CONFIRMED'
        if (allShipped) {
          newStatus = 'COMPLETED'
        } else if (someShipped) {
          newStatus = 'PARTIAL'
        }

        await tx.purchaseOrder.update({
          where: { id: outbound.purchaseOrderId },
          data: { status: newStatus },
        })
      }

      // Document-level APPROVE event + reversal snapshot (for the history timeline + reopen).
      await logDocumentEvent(tx, {
        documentType: 'OUTBOUND',
        documentId: outboundId,
        eventType: 'APPROVE',
        userId: user.userId,
        details: {
          deliveryNoteNo: outbound.deliveryNoteNo,
          itemIds: outbound.lines.map((l) => l.productItemId),
          poIncrements: poIncApplied,
        },
      })

      return updated
    })

    if (!result) {
      return errorResponse('ใบส่งนี้ถูกอนุมัติหรือดำเนินการไปแล้ว', 409)
    }

    // Notify the warehouse user who created the outbound
    if (outbound.createdById) {
      sendPushToUser(outbound.createdById, {
        title: 'ใบส่งสินค้าได้รับอนุมัติ',
        body: `ใบส่ง ${outbound.deliveryNoteNo} ได้รับอนุมัติแล้ว`,
        url: `/${outbound.id}`,
        tag: `outbound-${outbound.id}`,
      }).catch(() => {})
    }

    return successResponse(result)
  }

  // Handle reopen (un-approve → back to PENDING for full editing, then re-approve)
  if (body.action === 'reopen') {
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER' && user.role !== 'WAREHOUSE') {
      return errors.forbidden()
    }
    if (outbound.status !== 'APPROVED') {
      return errorResponse('ดึงกลับมาแก้ได้เฉพาะใบที่อนุมัติแล้ว', 400)
    }
    // Guard: block if any item moved beyond SHIPPED (e.g. a customer already activated it).
    const moved = outbound.lines.filter((l) => l.productItem && l.productItem.status !== 'SHIPPED')
    if (moved.length > 0) {
      const serials = moved.map((l) => l.productItem?.serial12).filter(Boolean).join(', ')
      return errorResponse(
        `ไม่สามารถดึงกลับมาแก้ได้: มีสินค้า ${moved.length} รายการที่ถูกดำเนินการต่อไปแล้ว (ไม่ใช่สถานะ "ส่งออกแล้ว") — ${serials}`,
        409
      )
    }

    // Read the latest APPROVE snapshot to reverse the PO increments by the exact amounts applied.
    const lastApprove = await prisma.eventLog.findFirst({
      where: { documentType: 'OUTBOUND', documentId: outboundId, eventType: 'APPROVE' },
      orderBy: { createdAt: 'desc' },
    })
    const snap = (lastApprove?.details as { poIncrements?: Record<string, number> } | null) || {}
    const poIncrements = snap.poIncrements || {}

    const result = await prisma.$transaction(async (tx) => {
      const transition = await tx.outboundHeader.updateMany({
        where: { id: outboundId, status: 'APPROVED' },
        data: { status: 'PENDING', approvedById: null, approvedAt: null, shippedAt: null },
      })
      if (transition.count === 0) return null

      // Items SHIPPED → PENDING_OUT (keep assignedClinic; the doc still targets that clinic)
      await tx.productItem.updateMany({
        where: { id: { in: outbound.lines.map((l) => l.productItemId) }, status: 'SHIPPED' },
        data: { status: 'PENDING_OUT' },
      })

      // Reverse PO shippedQuantity by the exact recorded increments, then recompute PO status.
      if (outbound.purchaseOrderId && Object.keys(poIncrements).length > 0) {
        for (const [poLineId, inc] of Object.entries(poIncrements)) {
          await tx.purchaseOrderLine.update({
            where: { id: Number(poLineId) },
            data: { shippedQuantity: { decrement: inc } },
          })
        }
        const poLines = await tx.purchaseOrderLine.findMany({ where: { purchaseOrderId: outbound.purchaseOrderId } })
        const allShipped = poLines.every((l) => l.shippedQuantity >= l.quantity)
        const someShipped = poLines.some((l) => l.shippedQuantity > 0)
        const newStatus: 'CONFIRMED' | 'PARTIAL' | 'COMPLETED' = allShipped ? 'COMPLETED' : someShipped ? 'PARTIAL' : 'CONFIRMED'
        await tx.purchaseOrder.update({ where: { id: outbound.purchaseOrderId }, data: { status: newStatus } })
      }

      await logDocumentEvent(tx, {
        documentType: 'OUTBOUND',
        documentId: outboundId,
        eventType: 'REOPEN',
        userId: user.userId,
        details: {
          deliveryNoteNo: outbound.deliveryNoteNo,
          reason: typeof body.reason === 'string' ? body.reason.trim() : '',
        },
      })

      return await tx.outboundHeader.findUnique({ where: { id: outboundId } })
    })

    if (!result) {
      return errorResponse('ใบส่งนี้ถูกดำเนินการไปแล้ว', 409)
    }
    return successResponse({ id: result.id, status: result.status, message: 'ดึงกลับมาแก้ไขแล้ว (รออนุมัติใหม่)' })
  }

  // Handle rejection
  if (body.action === 'reject') {
    // Only manager/admin can reject
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return errors.forbidden()
    }

    if (outbound.status !== 'PENDING') {
      return errorResponse('Can only reject PENDING outbounds')
    }

    if (!body.rejectReason) {
      return errorResponse('Reject reason is required')
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update outbound status
      const updated = await tx.outboundHeader.update({
        where: { id: outboundId },
        data: {
          status: 'REJECTED',
          approvedById: user.userId,
          approvedAt: new Date(),
          rejectReason: body.rejectReason,
        },
      })

      // Revert all product items to IN_STOCK and remove clinic assignment
      for (const line of outbound.lines) {
        await tx.productItem.update({
          where: { id: line.productItemId },
          data: {
            status: 'IN_STOCK',
            assignedClinicId: null,
          },
        })

        // Log event
        await tx.eventLog.create({
          data: {
            eventType: 'REJECT',
            productItemId: line.productItemId,
            userId: user.userId,
            details: {
              deliveryNoteNo: outbound.deliveryNoteNo,
              action: 'reject',
              reason: body.rejectReason,
            },
          },
        })
      }

      return updated
    })

    // Notify the warehouse user who created the outbound
    if (outbound.createdById) {
      sendPushToUser(outbound.createdById, {
        title: 'ใบส่งสินค้าถูกปฏิเสธ',
        body: `ใบส่ง ${outbound.deliveryNoteNo} ถูกปฏิเสธ: ${body.rejectReason || ''}`,
        url: `/${outbound.id}`,
        tag: `outbound-${outbound.id}`,
      }).catch(() => {})
    }

    return successResponse(result)
  }

  // Handle cancel (by warehouse user, only DRAFT or PENDING)
  if (body.action === 'cancel') {
    if (!['DRAFT', 'PENDING'].includes(outbound.status)) {
      return errorResponse('Can only cancel DRAFT or PENDING outbounds')
    }

    const result = await prisma.$transaction(async (tx) => {
      // Revert all product items to IN_STOCK
      for (const line of outbound.lines) {
        await tx.productItem.update({
          where: { id: line.productItemId },
          data: {
            status: 'IN_STOCK',
            assignedClinicId: null,
          },
        })
      }

      // Delete outbound lines
      await tx.outboundLine.deleteMany({
        where: { outboundId: outboundId },
      })

      // Delete outbound header
      await tx.outboundHeader.delete({
        where: { id: outboundId },
      })

      return { cancelled: true }
    })

    return successResponse(result)
  }

  // Edit document-LABEL fields after creation/approval (e.g. correct the tax-invoice / IV number
  // or the ship-to text). Deliberately does NOT touch line items, stock, the PO linkage, the
  // recipient clinic (clinicId) or the source warehouse — only text printed on the document.
  if (body.action === 'edit-document') {
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER' && user.role !== 'WAREHOUSE') {
      return errors.forbidden()
    }
    if (!['DRAFT', 'PENDING', 'APPROVED'].includes(outbound.status)) {
      return errorResponse('แก้ข้อมูลเอกสารได้เฉพาะใบที่ยังไม่ถูกปฏิเสธหรือยกเลิก')
    }

    const data: Record<string, unknown> = {}
    const setText = (key: string, raw: unknown) => {
      data[key] = typeof raw === 'string' && raw.trim() ? raw.trim() : null
    }

    if (body.deliveryNoteNo !== undefined) {
      const v = String(body.deliveryNoteNo).trim()
      if (!v) {
        return errorResponse('เลขที่ใบกำกับภาษีห้ามว่าง')
      }
      // deliveryNoteNo is @unique — make sure the new value isn't used by another outbound.
      const dup = await prisma.outboundHeader.findFirst({
        where: { deliveryNoteNo: v, NOT: { id: outboundId } },
        select: { id: true },
      })
      if (dup) {
        return errorResponse(`เลขที่ใบกำกับภาษี "${v}" ซ้ำกับใบอื่น`, 409)
      }
      data.deliveryNoteNo = v
    }
    if (body.contractNo !== undefined) setText('contractNo', body.contractNo)
    if (body.salesPersonName !== undefined) setText('salesPersonName', body.salesPersonName)
    if (body.companyContact !== undefined) setText('companyContact', body.companyContact)
    if (body.clinicAddress !== undefined) setText('clinicAddress', body.clinicAddress)
    if (body.clinicPhone !== undefined) setText('clinicPhone', body.clinicPhone)
    if (body.clinicEmail !== undefined) setText('clinicEmail', body.clinicEmail)
    if (body.clinicContactName !== undefined) setText('clinicContactName', body.clinicContactName)
    if (body.shippingTemperature !== undefined) setText('shippingTemperature', body.shippingTemperature)
    if (body.remarks !== undefined) setText('remarks', body.remarks)
    if (body.shippingMethodId !== undefined && body.shippingMethodId) {
      data.shippingMethodId = Number(body.shippingMethodId)
    }

    if (Object.keys(data).length === 0) {
      return errorResponse('ไม่มีข้อมูลที่จะแก้ไข')
    }

    // Build a before→after diff for the audit trail (JSON-safe string values).
    const norm = (v: unknown): string | null => (v === null || v === undefined ? null : String(v))
    const changes: Record<string, { from: string | null; to: string | null }> = {}
    for (const key of Object.keys(data)) {
      const before = norm((outbound as unknown as Record<string, unknown>)[key])
      const after = norm(data[key])
      if (before !== after) {
        changes[key] = { from: before, to: after }
      }
    }

    const updatedDoc = await prisma.$transaction(async (tx) => {
      const u = await tx.outboundHeader.update({ where: { id: outboundId }, data })
      await tx.eventLog.create({
        data: {
          eventType: 'OUTBOUND_EDIT',
          productItemId: null,
          userId: user.userId,
          details: {
            deliveryNoteNo: u.deliveryNoteNo,
            outboundStatus: String(outbound.status),
            editedBy: user.displayName,
            changes,
          },
        },
      })
      return u
    })

    return successResponse({
      id: updatedDoc.id,
      deliveryNoteNo: updatedDoc.deliveryNoteNo,
      message: 'อัปเดตข้อมูลเอกสารแล้ว',
    })
  }

  // Update header fields (only for DRAFT status)
  if (outbound.status !== 'DRAFT') {
    return errorResponse('Can only update DRAFT outbounds')
  }

  const allowedFields = [
    'shippingMethodId',
    'deliveryNoteNo',
    'contractNo',
    'salesPersonName',
    'companyContact',
    'clinicAddress',
    'clinicPhone',
    'clinicEmail',
    'clinicContactName',
    'poNo',
    'remarks',
  ]

  const updateData: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field]
    }
  }

  // Handle submit for approval
  if (body.submit) {
    updateData.status = 'PENDING'
  }

  const updated = await prisma.outboundHeader.update({
    where: { id: outboundId },
    data: updateData,
    include: {
      warehouse: { select: { id: true, name: true } },
      clinic: { select: { id: true, name: true } },
      createdBy: { select: { id: true, displayName: true } },
    },
  })

  // Notify managers when outbound submitted for approval
  if (body.submit) {
    const { notifyManagers } = await import('@/lib/push-notification')
    notifyManagers({
      title: 'ใบส่งสินค้ารออนุมัติ',
      body: `ใบส่ง ${outbound.deliveryNoteNo} ถูกส่งเข้ารออนุมัติ`,
      url: '/th/dashboard/approval',
      tag: `outbound-pending-${outbound.id}`,
    }).catch(() => {})
  }

  return successResponse(updated)
}

// PUT /api/warehouse/outbound/[id] - Full edit of Outbound (only PENDING status)
async function handlePUT(request: NextRequest, context: HandlerContext) {
  if (!context.params) {
    return errorResponse('Missing params')
  }

  const { id } = await context.params
  const outboundId = parseInt(id)
  const body = await request.json()
  const user = context.user

  if (isNaN(outboundId)) {
    return errorResponse('Invalid Outbound ID')
  }

  const outbound = await prisma.outboundHeader.findUnique({
    where: { id: outboundId },
    include: {
      lines: {
        include: {
          productItem: true,
        },
      },
    },
  })

  if (!outbound) {
    return errors.notFound('Outbound')
  }

  // Only allow editing PENDING outbounds
  if (outbound.status !== 'PENDING') {
    return errorResponse('Can only edit PENDING outbounds')
  }

  // Validate required fields
  if (!body.clinicId) {
    return errorResponse('Clinic is required')
  }

  if (!body.linesByProductMaster || body.linesByProductMaster.length === 0) {
    return errorResponse('At least one product line is required')
  }

  // Items the user explicitly skipped in the preview — excluded from FIFO re-selection.
  // Must be filtered the same way as the create path so both paths stay in agreement.
  const excludeItemIds: number[] = Array.isArray(body.excludeItemIds)
    ? body.excludeItemIds.map(Number).filter((n: number) => Number.isInteger(n) && n > 0)
    : []

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Revert all current product items to IN_STOCK
      for (const line of outbound.lines) {
        await tx.productItem.update({
          where: { id: line.productItemId },
          data: {
            status: 'IN_STOCK',
            assignedClinicId: null,
          },
        })
      }

      // 2. Delete all current lines
      await tx.outboundLine.deleteMany({
        where: { outboundId: outboundId },
      })

      // 3. Create new lines with FIFO selection
      const newLines = []
      for (const lineReq of body.linesByProductMaster) {
        const { productMasterId, quantity } = lineReq

        // Get product master info
        const productMaster = await tx.productMaster.findUnique({
          where: { id: productMasterId },
          include: { defaultUnit: true },
        })

        if (!productMaster) {
          throw new Error(`Product master ${productMasterId} not found`)
        }

        if (!productMaster.defaultUnitId) {
          throw new Error(`Product ${productMaster.sku} has no unit defined`)
        }

        // FEFO → FIFO → serial12: nearest expiry first, then oldest received, then
        // serial number as a deterministic tiebreaker. Without the serial tiebreaker,
        // same-batch items (identical expDate + createdAt) come back in arbitrary
        // physical/heap order — which is how an edit could drop a middle block of
        // serials (e.g. 020–030) even though lower serials were still in stock.
        // Must match the create path in outbound/route.ts.
        const availableItems = await tx.productItem.findMany({
          where: {
            productMasterId: productMasterId,
            status: 'IN_STOCK',
            ...(excludeItemIds.length > 0 ? { id: { notIn: excludeItemIds } } : {}),
          },
          orderBy: [
            { expDate: 'asc' },
            { createdAt: 'asc' },
            { serial12: 'asc' },
          ],
          take: quantity,
        })

        if (availableItems.length < quantity) {
          throw new Error(`Insufficient stock for ${productMaster.sku}: need ${quantity}, have ${availableItems.length}`)
        }

        // Create outbound lines and update product item status
        for (const item of availableItems) {
          const newLine = await tx.outboundLine.create({
            data: {
              outboundId: outboundId,
              productItemId: item.id,
              sku: productMaster.sku,
              itemName: productMaster.nameTh || productMaster.nameEn || productMaster.sku,
              modelSize: productMaster.modelSize,
              quantity: 1,
              unitId: productMaster.defaultUnitId!,
              // Snapshot lot/expDate from the item — same as the create path.
              // Without these the delivery document shows empty LOT/EXP after an edit.
              lot: item.lot,
              expDate: item.expDate,
            },
          })

          // Update product item status to PENDING_OUT and assign clinic
          await tx.productItem.update({
            where: { id: item.id },
            data: {
              status: 'PENDING_OUT',
              assignedClinicId: body.clinicId,
            },
          })

          newLines.push(newLine)
        }
      }

      // 4. Update header fields
      const updated = await tx.outboundHeader.update({
        where: { id: outboundId },
        data: {
          warehouseId: body.warehouseId || outbound.warehouseId,
          shippingMethodId: body.shippingMethodId || outbound.shippingMethodId,
          clinicId: body.clinicId,
          deliveryNoteNo: body.deliveryNoteNo,
          contractNo: body.contractNo,
          salesPersonName: body.salesPersonName,
          companyContact: body.companyContact,
          clinicAddress: body.clinicAddress,
          clinicPhone: body.clinicPhone,
          clinicEmail: body.clinicEmail,
          clinicContactName: body.clinicContactName,
          purchaseOrderId: body.purchaseOrderId,
          remarks: body.remarks,
          shippingTemperature: body.shippingTemperature || null,
        },
        include: {
          warehouse: { select: { id: true, name: true } },
          clinic: { select: { id: true, name: true } },
          lines: true,
        },
      })

      return {
        ...updated,
        linesCreated: newLines.length,
      }
    })

    return successResponse(result)
  } catch (error) {
    console.error('Update outbound error:', error)
    return errorResponse(error instanceof Error ? error.message : 'Failed to update outbound')
  }
}

export const GET = withRoles<RouteParams>(['ADMIN', 'MANAGER', 'WAREHOUSE'], handleGET)
export const PATCH = withRoles<RouteParams>(['ADMIN', 'MANAGER', 'WAREHOUSE'], handlePATCH)
export const PUT = withRoles<RouteParams>(['ADMIN', 'MANAGER', 'WAREHOUSE'], handlePUT)
