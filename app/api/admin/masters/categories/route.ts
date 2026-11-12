import { NextRequest } from 'next/server'
import { ProductStatus } from '@prisma/client'
import prisma from '@/lib/prisma'
import { withAdmin, withWarehouse } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'

// GET /api/admin/masters/categories - List all product categories
// Allow WAREHOUSE role to read categories for GRN creation
export const GET = withWarehouse(async () => {
  try {
    const categories = await prisma.productCategory.findMany({
      orderBy: { nameTh: 'asc' },
    })
    return successResponse({ categories })
  } catch (error) {
    console.error('List categories error:', error)
    return errors.internalError()
  }
})

// POST /api/admin/masters/categories - Create a new category
export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()

    if (!body.nameTh) {
      return errorResponse('Thai name (nameTh) is required', 400)
    }

    // Validate serialCode: required, single A-Z character
    if (!body.serialCode || !/^[A-Z]$/.test(body.serialCode)) {
      return errorResponse('Serial code must be a single uppercase letter (A-Z)', 400)
    }

    // Check uniqueness
    const existing = await prisma.productCategory.findUnique({
      where: { serialCode: body.serialCode },
    })
    if (existing) {
      return errorResponse(`Serial code "${body.serialCode}" is already used by "${existing.nameTh}"`, 400)
    }

    const category = await prisma.productCategory.create({
      data: {
        nameTh: body.nameTh,
        nameEn: body.nameEn || null,
        serialCode: body.serialCode,
        isActive: body.isActive ?? true,
      },
    })

    return successResponse({ category }, 201)
  } catch (error) {
    console.error('Create category error:', error)
    return errors.internalError()
  }
})

// PATCH /api/admin/masters/categories - Update a category (requires id in body)
export const PATCH = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()

    if (!body.id) {
      return errorResponse('Category ID is required', 400)
    }

    // Validate serialCode if provided
    const newSerialCode = body.serialCode as string | undefined
    let oldSerialCode: string | null = null

    if (newSerialCode !== undefined) {
      if (!/^[A-Z]$/.test(newSerialCode)) {
        return errorResponse('Serial code must be a single uppercase letter (A-Z)', 400)
      }
      // Check uniqueness (exclude current)
      const existing = await prisma.productCategory.findFirst({
        where: { serialCode: newSerialCode, NOT: { id: body.id } },
      })
      if (existing) {
        return errorResponse(`Serial code "${newSerialCode}" is already used by "${existing.nameTh}"`, 400)
      }
      // Get old serialCode to update existing serials
      const current = await prisma.productCategory.findUnique({
        where: { id: body.id },
        select: { serialCode: true },
      })
      if (current && current.serialCode !== newSerialCode) {
        oldSerialCode = current.serialCode
      }
    }

    // Changing serialCode rewrites serial12 of EVERY item in this category (below), including
    // SHIPPED/ACTIVATED units whose QR labels are already printed and in customers' hands —
    // which would break verification of already-distributed products. Block it when the
    // category has any item that has left PENDING_LINK, unless an explicit `force` flag is sent.
    if (oldSerialCode && newSerialCode) {
      const distributedCount = await prisma.productItem.count({
        where: { categoryId: body.id, status: { not: ProductStatus.PENDING_LINK } },
      })
      if (distributedCount > 0 && !body.force) {
        return errorResponse(
          `ไม่สามารถเปลี่ยนรหัส Serial ของหมวดนี้ได้: มีสินค้า ${distributedCount} รายการที่ผูก serial แล้ว (ออกจากคลัง/ใช้งานแล้ว) — การเปลี่ยนจะทำให้ serial12 และ QR ที่พิมพ์/แจกไปแล้วใช้ไม่ได้`,
          400
        )
      }
    }

    // Use transaction to update category + all related serial numbers
    const category = await prisma.$transaction(async (tx) => {
      const updated = await tx.productCategory.update({
        where: { id: body.id },
        data: {
          ...(body.nameTh && { nameTh: body.nameTh }),
          ...(body.nameEn !== undefined && { nameEn: body.nameEn }),
          ...(newSerialCode && { serialCode: newSerialCode }),
          ...(body.isActive !== undefined && { isActive: body.isActive }),
        },
      })

      // If serialCode changed, update all existing serial12 and sequence_counters
      if (oldSerialCode && newSerialCode) {
        // Update serial12 position 2 for all ProductItems in this category
        await tx.$executeRaw`
          UPDATE product_items
          SET serial12 = LEFT(serial12, 1) || ${newSerialCode} || SUBSTRING(serial12, 3)
          WHERE category_id = ${body.id}
            AND LENGTH(serial12) >= 2
        `

        // Update sequence_counters: rename prefixes with old category char to new
        // Counter name format: SER_{typeChar}{categoryChar}{productSerialCode}
        // We need to replace the category char (position 5 in name, position 2 in prefix)
        await tx.$executeRaw`
          UPDATE sequence_counters
          SET name = 'SER_' || LEFT(prefix, 1) || ${newSerialCode} || SUBSTRING(prefix, 3),
              prefix = LEFT(prefix, 1) || ${newSerialCode} || SUBSTRING(prefix, 3)
          WHERE name LIKE 'SER__' || ${oldSerialCode} || '%'
        `
      }

      return updated
    })

    return successResponse({ category })
  } catch (error) {
    console.error('Update category error:', error)
    return errors.internalError()
  }
})

// DELETE /api/admin/masters/categories - Delete a category (requires id in body)
export const DELETE = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()

    if (!body.id) {
      return errorResponse('Category ID is required', 400)
    }

    await prisma.productCategory.delete({
      where: { id: body.id },
    })

    return successResponse({ message: 'Category deleted successfully' })
  } catch (error) {
    console.error('Delete category error:', error)
    return errors.internalError()
  }
})
