import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withWarehouse } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'
import { ProductStatus, BorrowStatus } from '@prisma/client'
import { generateBorrowNumber, generateOutboundNumber } from '@/lib/serial-generator'

type HandlerContext = { user: JWTPayload }

// POST /api/warehouse/borrow/convert-to-outbound
// Atomically: return borrowed products → create PO → create Outbound
async function handlePOST(request: NextRequest, context: HandlerContext) {
  try {
    const body = await request.json()
    const user = context.user

    const {
      productItemIds,
      clinicId: inputClinicId,
      clinicName,
      warehouseId,
      shippingMethodId,
      contractNo,
      salesPersonName,
      companyContact,
      clinicAddress,
      clinicPhone,
      clinicEmail,
      clinicContactName,
      remarks,
    } = body as {
      productItemIds: number[]
      clinicId?: number
      clinicName?: string
      warehouseId: number
      shippingMethodId: number
      contractNo?: string
      salesPersonName?: string
      companyContact?: string
      clinicAddress?: string
      clinicPhone?: string
      clinicEmail?: string
      clinicContactName?: string
      remarks?: string
    }

    // Validate required fields
    if (!productItemIds || productItemIds.length === 0) {
      return errorResponse('At least one product is required')
    }
    if (!clinicName?.trim() && !inputClinicId) {
      return errorResponse('Clinic/buyer name is required')
    }
    if (!warehouseId) {
      return errorResponse('Warehouse is required')
    }
    if (!shippingMethodId) {
      return errorResponse('Shipping method is required')
    }

    // Resolve clinicId: use provided ID or find/create a default clinic
    let clinicId = inputClinicId || 0
    if (!clinicId && clinicName?.trim()) {
      // Find or create a generic "อื่นๆ" clinic for free-text entries
      let defaultClinic = await prisma.clinic.findFirst({
        where: { name: 'อื่นๆ (Other)' },
      })
      if (!defaultClinic) {
        defaultClinic = await prisma.clinic.create({
          data: { name: 'อื่นๆ (Other)', address: '-', isActive: true },
        })
      }
      clinicId = defaultClinic.id
    }

    // Generate numbers outside transaction to avoid nested transaction issues
    const borrowTransactionNo = await generateBorrowNumber()
    const outboundNo = await generateOutboundNumber()

    // Generate PO number
    const year = new Date().getFullYear()
    const poPrefix = `PO-${year}-`
    const poCounter = await prisma.sequenceCounter.upsert({
      where: { name: 'PO' },
      update: { currentVal: { increment: 1 } },
      create: { name: 'PO', prefix: poPrefix, currentVal: 1 },
    })
    const poNo = `${poPrefix}${String(poCounter.currentVal).padStart(6, '0')}`

    // Run everything in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Validate all products are BORROWED and have productMasterId
      const items = await tx.productItem.findMany({
        where: { id: { in: productItemIds } },
        include: {
          productMaster: { select: { id: true, sku: true, nameTh: true, nameEn: true, modelSize: true, defaultUnitId: true } },
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

      const missingMaster = items.filter((item) => !item.productMasterId)
      if (missingMaster.length > 0) {
        throw new Error(
          `Products missing product master: ${missingMaster.map((i) => i.serial12).join(', ')}`
        )
      }

      // Get default unit
      const defaultUnit = await tx.unit.findFirst({ where: { nameTh: 'ชิ้น' } })
      const defaultUnitId = defaultUnit?.id || 1

      // 2. Create BorrowTransaction (RETURN, auto-approved)
      const borrowTxn = await tx.borrowTransaction.create({
        data: {
          transactionNo: borrowTransactionNo,
          type: 'RETURN',
          status: BorrowStatus.APPROVED,
          borrowerName: clinicName?.trim() || clinicContactName?.trim() || 'Convert to Outbound',
          clinicName: clinicName?.trim() || null,
          reason: 'Converted borrowed products to PO & Outbound',
          remarks: remarks?.trim() || null,
          createdById: user.userId,
          approvedById: user.userId,
          approvedAt: new Date(),
        },
      })

      // 3. Create borrow lines + update products to IN_STOCK
      for (const item of items) {
        await tx.borrowTransactionLine.create({
          data: {
            borrowTransactionId: borrowTxn.id,
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

        await tx.productItem.update({
          where: { id: item.id },
          data: { status: ProductStatus.IN_STOCK },
        })

        await tx.eventLog.create({
          data: {
            eventType: 'BORROW_RETURN',
            productItemId: item.id,
            userId: user.userId,
            details: {
              transactionNo: borrowTransactionNo,
              reason: 'Converted borrowed products to PO & Outbound',
            },
          },
        })
      }

      // 4. Group products by productMasterId for PO lines
      const groupedByMaster = new Map<number, { masterId: number; count: number }>()
      for (const item of items) {
        const masterId = item.productMasterId!
        const existing = groupedByMaster.get(masterId)
        if (existing) {
          existing.count++
        } else {
          groupedByMaster.set(masterId, { masterId, count: 1 })
        }
      }

      // 5. Create PurchaseOrder (CONFIRMED)
      const purchaseOrder = await tx.purchaseOrder.create({
        data: {
          poNo,
          clinicId,
          status: 'CONFIRMED',
          contractNo: contractNo?.trim() || null,
          salesPersonName: salesPersonName?.trim() || null,
          companyContact: companyContact?.trim() || null,
          clinicAddress: clinicAddress?.trim() || null,
          clinicPhone: clinicPhone?.trim() || null,
          clinicEmail: clinicEmail?.trim() || null,
          clinicContactName: clinicContactName?.trim() || clinicName?.trim() || null,
          remarks: remarks?.trim() || null,
          createdById: user.userId,
          lines: {
            create: Array.from(groupedByMaster.values()).map((g) => ({
              productMasterId: g.masterId,
              quantity: g.count,
              shippedQuantity: 0,
            })),
          },
        },
      })

      // 6. Create OutboundHeader (PENDING, linked to PO)
      const outbound = await tx.outboundHeader.create({
        data: {
          deliveryNoteNo: outboundNo,
          contractNo: contractNo?.trim() || null,
          createdById: user.userId,
          warehouseId,
          shippingMethodId,
          salesPersonName: salesPersonName?.trim() || null,
          companyContact: companyContact?.trim() || null,
          clinicId,
          clinicAddress: clinicAddress?.trim() || null,
          clinicPhone: clinicPhone?.trim() || null,
          clinicEmail: clinicEmail?.trim() || null,
          clinicContactName: clinicContactName?.trim() || clinicName?.trim() || null,
          purchaseOrderId: purchaseOrder.id,
          status: 'PENDING',
          remarks: remarks?.trim() || null,
        },
      })

      // 7. Create OutboundLines + update products to PENDING_OUT
      for (const item of items) {
        await tx.outboundLine.create({
          data: {
            outboundId: outbound.id,
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

        await tx.productItem.update({
          where: { id: item.id },
          data: {
            status: ProductStatus.PENDING_OUT,
            assignedClinicId: clinicId,
          },
        })

        await tx.eventLog.create({
          data: {
            eventType: 'OUTBOUND',
            productItemId: item.id,
            userId: user.userId,
            details: {
              outboundNo,
              poNo,
              clinicId,
              source: 'borrow_convert',
            },
          },
        })
      }

      return {
        borrowTransactionNo,
        poNo,
        outboundNo,
        purchaseOrderId: purchaseOrder.id,
        outboundId: outbound.id,
        itemCount: items.length,
      }
    })

    return successResponse(result, 201)
  } catch (error) {
    console.error('Convert borrow to outbound error:', error)
    if (error instanceof Error) {
      return errorResponse(error.message, 400)
    }
    return errors.internalError()
  }
}

export const POST = withWarehouse(handlePOST)
