import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withWarehouse } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'
import { ProductStatus, BorrowStatus, Prisma } from '@prisma/client'
import { generateBorrowNumber } from '@/lib/serial-generator'

type HandlerContext = { user: JWTPayload }

// GET /api/warehouse/borrow - List borrow transactions
async function handleGET(request: NextRequest, _context: HandlerContext) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const type = searchParams.get('type') || '' // BORROW or RETURN
    const status = searchParams.get('status') || '' // PENDING, APPROVED, REJECTED, RETURNED

    const skip = (page - 1) * limit

    const where: Prisma.BorrowTransactionWhereInput = {
      ...(type && { type }),
      ...(status && { status: status as BorrowStatus }),
      ...(search && {
        OR: [
          { transactionNo: { contains: search, mode: 'insensitive' } },
          { borrowerName: { contains: search, mode: 'insensitive' } },
          { clinicName: { contains: search, mode: 'insensitive' } },
          { lines: { some: { sku: { contains: search, mode: 'insensitive' } } } },
          { lines: { some: { productItem: { serial12: { contains: search } } } } },
        ],
      }),
    }

    const [items, total] = await Promise.all([
      prisma.borrowTransaction.findMany({
        where,
        include: {
          createdBy: { select: { id: true, displayName: true } },
          approvedBy: { select: { id: true, displayName: true } },
          rejectedBy: { select: { id: true, displayName: true } },
          lines: {
            include: {
              productItem: { select: { id: true, serial12: true, status: true } },
              unit: { select: { id: true, nameTh: true, nameEn: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.borrowTransaction.count({ where }),
    ])

    return successResponse({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('List borrow transactions error:', error instanceof Error ? error.message : error)
    return errors.internalError()
  }
}

// POST /api/warehouse/borrow - Create new borrow/return transaction
async function handlePOST(request: NextRequest, context: HandlerContext) {
  try {
    const body = await request.json()
    const user = context.user

    const {
      type,
      borrowerName,
      clinicName,
      clinicAddress,
      taxInvoiceRef,
      reason,
      remarks,
      productItemIds,
    } = body as {
      type: 'BORROW' | 'RETURN'
      borrowerName: string
      clinicName?: string
      clinicAddress?: string
      taxInvoiceRef?: string
      reason?: string
      remarks?: string
      productItemIds: number[]
    }

    // Validation
    if (!type || !['BORROW', 'RETURN'].includes(type)) {
      return errorResponse('Invalid transaction type (must be BORROW or RETURN)')
    }

    if (!borrowerName?.trim()) {
      return errorResponse('Borrower name is required')
    }

    if (!productItemIds || productItemIds.length === 0) {
      return errorResponse('At least one product is required')
    }

    // Verify all products exist
    const items = await prisma.productItem.findMany({
      where: { id: { in: productItemIds } },
      include: {
        productMaster: { select: { defaultUnitId: true } },
      },
    })

    if (items.length !== productItemIds.length) {
      return errorResponse('Some products not found')
    }

    // Validate product status based on transaction type
    if (type === 'BORROW') {
      // For borrowing, products must be IN_STOCK
      const invalidItems = items.filter((item) => item.status !== ProductStatus.IN_STOCK)
      if (invalidItems.length > 0) {
        return errorResponse(
          `Cannot borrow products not in stock: ${invalidItems.map((i) => i.serial12).join(', ')}`
        )
      }
    } else {
      // For returning borrowed items, products must be BORROWED
      const invalidItems = items.filter((item) => item.status !== ProductStatus.BORROWED)
      if (invalidItems.length > 0) {
        return errorResponse(
          `Cannot return products that are not borrowed: ${invalidItems.map((i) => i.serial12).join(', ')}`
        )
      }
    }

    // Generate transaction number
    const transactionNo = await generateBorrowNumber()

    // Create transaction
    const transaction = await prisma.$transaction(async (tx) => {
      // Create the transaction header
      const borrowTransaction = await tx.borrowTransaction.create({
        data: {
          transactionNo,
          type,
          status: type === 'BORROW' ? BorrowStatus.PENDING : BorrowStatus.APPROVED, // RETURN is auto-approved
          borrowerName: borrowerName.trim(),
          clinicName: clinicName?.trim() || null,
          clinicAddress: clinicAddress?.trim() || null,
          taxInvoiceRef: taxInvoiceRef?.trim() || null,
          reason: reason?.trim() || null,
          remarks: remarks?.trim() || null,
          createdById: user.userId,
          ...(type === 'RETURN' && {
            approvedById: user.userId,
            approvedAt: new Date(),
          }),
        },
      })

      // Get default unit (ชิ้น)
      const defaultUnit = await tx.unit.findFirst({
        where: { nameTh: 'ชิ้น' },
      })
      const defaultUnitId = defaultUnit?.id || 1

      // Create transaction lines
      for (const item of items) {
        await tx.borrowTransactionLine.create({
          data: {
            borrowTransactionId: borrowTransaction.id,
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

        // For RETURN type, update product status immediately back to IN_STOCK
        if (type === 'RETURN') {
          await tx.productItem.update({
            where: { id: item.id },
            data: { status: ProductStatus.IN_STOCK },
          })

          // Log the return event
          await tx.eventLog.create({
            data: {
              eventType: 'BORROW_RETURN',
              productItemId: item.id,
              userId: user.userId,
              details: {
                transactionNo,
                borrowerName: borrowerName.trim(),
                reason: reason?.trim() || null,
              },
            },
          })
        }
      }

      return borrowTransaction
    })

    const message =
      type === 'BORROW'
        ? `Borrow request created (pending approval): ${transactionNo}`
        : `Products returned to stock: ${transactionNo}`

    return successResponse(
      {
        id: transaction.id,
        transactionNo: transaction.transactionNo,
        type: transaction.type,
        status: transaction.status,
        message,
      },
      201
    )
  } catch (error) {
    console.error('Create borrow transaction error:', error)
    return errors.internalError()
  }
}

export const GET = withWarehouse(handleGET)
export const POST = withWarehouse(handlePOST)
