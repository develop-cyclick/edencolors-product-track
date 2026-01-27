import { NextRequest } from 'next/server'
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

    const category = await prisma.productCategory.create({
      data: {
        nameTh: body.nameTh,
        nameEn: body.nameEn || null,
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

    const category = await prisma.productCategory.update({
      where: { id: body.id },
      data: {
        ...(body.nameTh && { nameTh: body.nameTh }),
        ...(body.nameEn !== undefined && { nameEn: body.nameEn }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
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
