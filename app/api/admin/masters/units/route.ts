import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdmin, withWarehouse } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'

// GET /api/admin/masters/units - List all units
// Allow WAREHOUSE role to read units for GRN creation
export const GET = withWarehouse(async () => {
  try {
    const units = await prisma.unit.findMany({
      orderBy: { nameTh: 'asc' },
    })
    return successResponse({ units })
  } catch (error) {
    console.error('List units error:', error)
    return errors.internalError()
  }
})

// POST /api/admin/masters/units - Create a new unit
export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()

    if (!body.nameTh) {
      return errorResponse('Thai name (nameTh) is required', 400)
    }

    const unit = await prisma.unit.create({
      data: {
        nameTh: body.nameTh,
        nameEn: body.nameEn || null,
        isActive: body.isActive ?? true,
      },
    })

    return successResponse({ unit }, 201)
  } catch (error) {
    console.error('Create unit error:', error)
    return errors.internalError()
  }
})

// PATCH /api/admin/masters/units - Update a unit (requires id in body)
export const PATCH = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()

    if (!body.id) {
      return errorResponse('Unit ID is required', 400)
    }

    const unit = await prisma.unit.update({
      where: { id: body.id },
      data: {
        ...(body.nameTh && { nameTh: body.nameTh }),
        ...(body.nameEn !== undefined && { nameEn: body.nameEn }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    })

    return successResponse({ unit })
  } catch (error) {
    console.error('Update unit error:', error)
    return errors.internalError()
  }
})

// DELETE /api/admin/masters/units - Delete a unit (requires id in body)
export const DELETE = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()

    if (!body.id) {
      return errorResponse('Unit ID is required', 400)
    }

    await prisma.unit.delete({
      where: { id: body.id },
    })

    return successResponse({ message: 'Unit deleted successfully' })
  } catch (error) {
    console.error('Delete unit error:', error)
    return errors.internalError()
  }
})
