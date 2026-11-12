import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withWarehouse, withManager } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'
import { ProductStatus, BorrowStatus } from '@prisma/client'

type HandlerContext = { user: JWTPayload; params?: Promise<{ id: string }> }

// GET /api/warehouse/borrow/[id] - Get borrow transaction details
async function handleGET(_request: NextRequest, context: HandlerContext) {
  try {
    if (!context.params) {
      return errorResponse('Missing params')
    }
    const params = await context.params
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return errorResponse('Invalid transaction ID')
    }

    const transaction = await prisma.borrowTransaction.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, displayName: true, username: true } },
        approvedBy: { select: { id: true, displayName: true, username: true } },
        rejectedBy: { select: { id: true, displayName: true, username: true } },
        lines: {
          include: {
            productItem: {
              select: {
                id: true,
                serial12: true,
                status: true,
                productMaster: {
                  select: {
                    sku: true,
                    nameTh: true,
                    nameEn: true,
                    modelSize: true,
                    category: { select: { nameTh: true, nameEn: true } },
                    documentUnit: { select: { nameTh: true, nameEn: true } },
                  },
                },
              },
            },
            unit: { select: { id: true, nameTh: true, nameEn: true } },
          },
        },
      },
    })

    if (!transaction) {
      return errors.notFound('Borrow transaction')
    }

    return successResponse(transaction)
  } catch (error) {
    console.error('Get borrow transaction error:', error)
    return errors.internalError()
  }
}

// PATCH /api/warehouse/borrow/[id] - Approve/Reject borrow transaction (Manager only)
async function handlePATCH(request: NextRequest, context: HandlerContext) {
  try {
    if (!context.params) {
      return errorResponse('Missing params')
    }
    const params = await context.params
    const id = parseInt(params.id)
    const user = context.user

    if (isNaN(id)) {
      return errorResponse('Invalid transaction ID')
    }

    const body = await request.json()
    const { action, rejectedReason } = body as {
      action: 'approve' | 'reject'
      rejectedReason?: string
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return errorResponse('Invalid action (must be approve or reject)')
    }

    // Get the transaction
    const transaction = await prisma.borrowTransaction.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            productItem: true,
          },
        },
      },
    })

    if (!transaction) {
      return errors.notFound('Borrow transaction')
    }

    // Only PENDING borrow transactions can be approved/rejected
    if (transaction.status !== BorrowStatus.PENDING) {
      return errorResponse(`Transaction is already ${transaction.status}`)
    }

    // BORROW / RETURN / REQUISITION / PRODUCT_RETURN all go through approval now
    if (!['BORROW', 'RETURN', 'REQUISITION', 'PRODUCT_RETURN'].includes(transaction.type)) {
      return errorResponse('This transaction type does not require approval')
    }

    if (action === 'reject' && !rejectedReason?.trim()) {
      return errorResponse('Rejection reason is required')
    }

    // Re-validate at approval time: the item status change is deferred to approval, so a
    // request can go stale (the item's status changed via another flow after the request was
    // created) or the same item can sit in two pending requests. Approving blindly would then
    // corrupt stock (e.g. flip an item that was already returned back to REQUISITIONED). Guard
    // by requiring every line's item to still be in the expected SOURCE status for this type.
    if (action === 'approve') {
      const sourceByType: Record<string, ProductStatus[]> = {
        BORROW: [ProductStatus.IN_STOCK],
        RETURN: [ProductStatus.BORROWED],
        REQUISITION: [ProductStatus.BORROWED],
        PRODUCT_RETURN: [ProductStatus.SHIPPED, ProductStatus.ACTIVATED],
      }
      const allowedSource = sourceByType[transaction.type]
      if (allowedSource) {
        const mismatched = transaction.lines.filter(
          (line) => !allowedSource.includes(line.productItem.status)
        )
        if (mismatched.length > 0) {
          const serials = mismatched.map((l) => l.productItem.serial12).join(', ')
          return errorResponse(
            `ไม่สามารถอนุมัติได้: มีสินค้า ${mismatched.length} รายการที่สถานะเปลี่ยนไปแล้ว ` +
              `(ต้องเป็น ${allowedSource.join('/')}) — คำขออาจถูกดำเนินการไปแล้วหรือหมดอายุ: ${serials}`,
            400
          )
        }
      }
    }

    // Update transaction
    const updatedTransaction = await prisma.$transaction(async (tx) => {
      if (action === 'approve') {
        // Update transaction status
        const updated = await tx.borrowTransaction.update({
          where: { id },
          data: {
            status: BorrowStatus.APPROVED,
            approvedById: user.userId,
            approvedAt: new Date(),
          },
        })

        // Apply the item status change that matches this transaction type (deferred until approval)
        const statusByType: Record<string, ProductStatus> = {
          BORROW: ProductStatus.BORROWED,
          RETURN: ProductStatus.IN_STOCK,
          REQUISITION: ProductStatus.REQUISITIONED,
          PRODUCT_RETURN: ProductStatus.RETURNED,
        }
        const eventByType: Record<string, string> = {
          BORROW: 'BORROW',
          RETURN: 'BORROW_RETURN',
          REQUISITION: 'REQUISITION_OUT',
          PRODUCT_RETURN: 'RETURN',
        }
        const targetStatus = statusByType[transaction.type] ?? ProductStatus.BORROWED
        const eventType = eventByType[transaction.type] ?? 'BORROW'

        // Allowed source status per type, re-checked atomically here (not just in the pre-flight
        // guard above) so two concurrent approvals of pending requests for the SAME item can't
        // both flip it — the losing one's conditional update matches 0 rows and aborts the tx.
        const sourceByType: Record<string, ProductStatus[]> = {
          BORROW: [ProductStatus.IN_STOCK],
          RETURN: [ProductStatus.BORROWED],
          REQUISITION: [ProductStatus.BORROWED],
          PRODUCT_RETURN: [ProductStatus.SHIPPED, ProductStatus.ACTIVATED],
        }
        const allowedSource = sourceByType[transaction.type]

        for (const line of transaction.lines) {
          if (allowedSource) {
            const flipped = await tx.productItem.updateMany({
              where: { id: line.productItemId, status: { in: allowedSource } },
              data: { status: targetStatus },
            })
            if (flipped.count === 0) {
              throw new Error('STALE_ITEM')
            }
          } else {
            await tx.productItem.update({
              where: { id: line.productItemId },
              data: { status: targetStatus },
            })
          }

          await tx.eventLog.create({
            data: {
              eventType,
              productItemId: line.productItemId,
              userId: user.userId,
              details: {
                transactionNo: transaction.transactionNo,
                type: transaction.type,
                borrowerName: transaction.borrowerName,
                approvedBy: user.displayName,
                ...(transaction.requisitionType ? { requisitionType: transaction.requisitionType } : {}),
                ...(transaction.reason ? { reason: transaction.reason } : {}),
                ...(transaction.remarks ? { notes: transaction.remarks } : {}),
              },
            },
          })
        }

        return updated
      } else {
        // Reject the transaction
        return await tx.borrowTransaction.update({
          where: { id },
          data: {
            status: BorrowStatus.REJECTED,
            rejectedById: user.userId,
            rejectedAt: new Date(),
            rejectedReason: rejectedReason?.trim(),
          },
        })
      }
    })

    const message =
      action === 'approve'
        ? `Borrow transaction approved: ${transaction.transactionNo}`
        : `Borrow transaction rejected: ${transaction.transactionNo}`

    return successResponse({
      id: updatedTransaction.id,
      transactionNo: updatedTransaction.transactionNo,
      status: updatedTransaction.status,
      message,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'STALE_ITEM') {
      return errorResponse('สถานะสินค้าบางรายการเปลี่ยนไปแล้ว (อาจถูกดำเนินการโดยคำขออื่น) กรุณาตรวจสอบแล้วลองใหม่', 409)
    }
    console.error('Approve/Reject borrow transaction error:', error)
    return errors.internalError()
  }
}

export const GET = withWarehouse(handleGET)
export const PATCH = withManager(handlePATCH)
