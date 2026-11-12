import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withWarehouse } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'
import { ProductStatus, BorrowStatus } from '@prisma/client'
import { generateBorrowNumber } from '@/lib/serial-generator'

type HandlerContext = { user: JWTPayload }

const VALID_REQUISITION_TYPES = ['DEMON', 'CLAIM', 'MARKETING', 'OTHER']

// POST /api/warehouse/borrow/requisition-out
// "เบิกไปใช้" — take BORROWED items OUT of the warehouse permanently (e.g. marketing gives
// them to a celebrity to promote) WITHOUT creating a PO / outbound document. The items become
// REQUISITIONED (left the warehouse). A BorrowTransaction (type 'REQUISITION') is recorded for history.
async function handlePOST(request: NextRequest, context: HandlerContext) {
  try {
    const body = await request.json()
    const user = context.user

    const {
      productItemIds,
      requisitionType,
      requisitionTypeOther,
      borrowerName,
      clinicName,
      clinicAddress,
      remarks,
    } = body as {
      productItemIds: number[]
      requisitionType?: string
      requisitionTypeOther?: string
      borrowerName?: string
      clinicName?: string
      clinicAddress?: string
      remarks?: string
    }

    if (!productItemIds || productItemIds.length === 0) {
      return errorResponse('At least one product is required')
    }

    const normalizedRequisitionType = VALID_REQUISITION_TYPES.includes(requisitionType || '')
      ? (requisitionType as string)
      : null

    const transactionNo = await generateBorrowNumber()

    const result = await prisma.$transaction(async (tx) => {
      // Validate all products are BORROWED
      const items = await tx.productItem.findMany({
        where: { id: { in: productItemIds } },
        include: {
          productMaster: { select: { defaultUnitId: true } },
        },
      })

      if (items.length !== productItemIds.length) {
        throw new Error('Some products not found')
      }

      const notBorrowed = items.filter((item) => item.status !== ProductStatus.BORROWED)
      if (notBorrowed.length > 0) {
        throw new Error(
          `Products not in BORROWED status: ${notBorrowed.map((i) => i.serial12).join(', ')}`
        )
      }

      const defaultUnit = await tx.unit.findFirst({ where: { nameTh: 'ชิ้น' } })
      const defaultUnitId = defaultUnit?.id || 1

      // Record a BorrowTransaction (type REQUISITION, auto-approved) for history/traceability
      const requisitionTxn = await tx.borrowTransaction.create({
        data: {
          transactionNo,
          type: 'REQUISITION',
          status: BorrowStatus.PENDING, // requisition-out now requires manager approval
          borrowerName: borrowerName?.trim() || 'เบิกไปใช้',
          clinicName: clinicName?.trim() || null,
          clinicAddress: clinicAddress?.trim() || null,
          reason: 'เบิกไปใช้ (ออกจากคลังถาวร)',
          remarks: remarks?.trim() || null,
          requisitionType: normalizedRequisitionType,
          requisitionTypeOther:
            normalizedRequisitionType === 'OTHER' ? requisitionTypeOther?.trim() || null : null,
          createdById: user.userId,
        },
      })

      for (const item of items) {
        await tx.borrowTransactionLine.create({
          data: {
            borrowTransactionId: requisitionTxn.id,
            productItemId: item.id,
            sku: item.sku,
            itemName: item.name,
            modelSize: item.modelSize,
            quantity: 1,
            unitId: item.productMaster?.defaultUnitId || defaultUnitId,
            lot: item.lot,
            expDate: item.expDate,
          },
        })
        // Status change (→ REQUISITIONED) + REQUISITION_OUT event are deferred to approval.
      }

      return { transactionNo, itemCount: items.length }
    })

    return successResponse(result, 201)
  } catch (error) {
    console.error('Requisition-out error:', error)
    if (error instanceof Error) {
      return errorResponse(error.message, 400)
    }
    return errors.internalError()
  }
}

export const POST = withWarehouse(handlePOST)
