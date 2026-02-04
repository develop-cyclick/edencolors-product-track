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

    // Only BORROW type requires approval
    if (transaction.type !== 'BORROW') {
      return errorResponse('Only borrow transactions require approval')
    }

    if (action === 'reject' && !rejectedReason?.trim()) {
      return errorResponse('Rejection reason is required')
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

        // Update all product items to BORROWED status
        for (const line of transaction.lines) {
          await tx.productItem.update({
            where: { id: line.productItemId },
            data: { status: ProductStatus.BORROWED },
          })

          // Log the borrow event
          await tx.eventLog.create({
            data: {
              eventType: 'BORROW',
              productItemId: line.productItemId,
              userId: user.userId,
              details: {
                transactionNo: transaction.transactionNo,
                borrowerName: transaction.borrowerName,
                approvedBy: user.displayName,
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
    console.error('Approve/Reject borrow transaction error:', error)
    return errors.internalError()
  }
}

export const GET = withWarehouse(handleGET)
export const PATCH = withManager(handlePATCH)
