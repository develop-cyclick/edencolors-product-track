import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdmin, withWarehouse } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'

// GET /api/admin/masters/shipping-methods - List all shipping methods
// Allow WAREHOUSE role to read shipping methods for outbound creation
export const GET = withWarehouse(async () => {
  try {
    const shippingMethods = await prisma.shippingMethod.findMany({
      orderBy: { nameTh: 'asc' },
    })
    return successResponse({ shippingMethods })
  } catch (error) {
    console.error('List shipping methods error:', error)
    return errors.internalError()
  }
})

// POST /api/admin/masters/shipping-methods - Create a new shipping method
export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()

    if (!body.nameTh) {
      return errorResponse('Thai name (nameTh) is required', 400)
    }

    const shippingMethod = await prisma.shippingMethod.create({
      data: {
        nameTh: body.nameTh,
        nameEn: body.nameEn || null,
        isActive: body.isActive ?? true,
      },
    })

    return successResponse({ shippingMethod }, 201)
  } catch (error) {
    console.error('Create shipping method error:', error)
    return errors.internalError()
  }
})

// PATCH /api/admin/masters/shipping-methods - Update a shipping method (requires id in body)
export const PATCH = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()

    if (!body.id) {
      return errorResponse('Shipping method ID is required', 400)
    }

    const shippingMethod = await prisma.shippingMethod.update({
      where: { id: body.id },
      data: {
        ...(body.nameTh && { nameTh: body.nameTh }),
        ...(body.nameEn !== undefined && { nameEn: body.nameEn }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    })

    return successResponse({ shippingMethod })
  } catch (error) {
    console.error('Update shipping method error:', error)
    return errors.internalError()
  }
})

// DELETE /api/admin/masters/shipping-methods - Delete a shipping method (requires id in body)
export const DELETE = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()

    if (!body.id) {
      return errorResponse('Shipping method ID is required', 400)
    }

    await prisma.shippingMethod.delete({
      where: { id: body.id },
    })

    return successResponse({ message: 'Shipping method deleted successfully' })
  } catch (error) {
    console.error('Delete shipping method error:', error)
    return errors.internalError()
  }
})
