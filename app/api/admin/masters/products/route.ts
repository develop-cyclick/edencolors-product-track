import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdmin, withWarehouse } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'

// GET /api/admin/masters/products - List all product masters
// Allow WAREHOUSE role to read for GRN creation
export const GET = withWarehouse(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const categoryId = searchParams.get('categoryId')
    const activeOnly = searchParams.get('activeOnly') !== 'false'

    const where = {
      ...(activeOnly && { isActive: true }),
      ...(categoryId && { categoryId: parseInt(categoryId) }),
      ...(search && {
        OR: [
          { sku: { contains: search, mode: 'insensitive' as const } },
          { nameTh: { contains: search, mode: 'insensitive' as const } },
          { nameEn: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }

    const productMasters = await prisma.productMaster.findMany({
      where,
      include: {
        category: true,
        defaultUnit: true,
        _count: {
          select: { productItems: true },
        },
      },
      orderBy: { sku: 'asc' },
    })

    // Get stock counts for each product master
    const productMastersWithStats = await Promise.all(
      productMasters.map(async (pm) => {
        const statusCounts = await prisma.productItem.groupBy({
          by: ['status'],
          where: { productMasterId: pm.id },
          _count: { status: true },
        })

        const stats = {
          total: pm._count.productItems,
          inStock: 0,
          pendingOut: 0,
          shipped: 0,
          activated: 0,
          returned: 0,
        }

        statusCounts.forEach((sc) => {
          switch (sc.status) {
            case 'IN_STOCK':
              stats.inStock = sc._count.status
              break
            case 'PENDING_OUT':
              stats.pendingOut = sc._count.status
              break
            case 'SHIPPED':
              stats.shipped = sc._count.status
              break
            case 'ACTIVATED':
              stats.activated = sc._count.status
              break
            case 'RETURNED':
              stats.returned = sc._count.status
              break
          }
        })

        return {
          ...pm,
          stats,
        }
      })
    )

    return successResponse({ productMasters: productMastersWithStats })
  } catch (error) {
    console.error('List product masters error:', error)
    return errors.internalError()
  }
})

// POST /api/admin/masters/products - Create a new product master
export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()

    if (!body.sku || !body.nameTh || !body.categoryId || !body.serialCode) {
      return errorResponse('SKU, Thai name (nameTh), categoryId, and serialCode are required', 400)
    }

    // Validate serialCode: exactly 5 chars, uppercase alphanumeric
    const serialCode = (body.serialCode as string).toUpperCase()
    if (!/^[A-Z0-9]{5}$/.test(serialCode)) {
      return errorResponse('Serial Code must be exactly 5 uppercase alphanumeric characters', 400)
    }

    // Check if SKU already exists
    const existing = await prisma.productMaster.findUnique({
      where: { sku: body.sku },
    })
    if (existing) {
      return errorResponse('SKU already exists', 400)
    }

    // Check if serialCode already exists
    const existingSerialCode = await prisma.productMaster.findUnique({
      where: { serialCode },
    })
    if (existingSerialCode) {
      return errorResponse('Serial Code already exists', 400)
    }

    const productMaster = await prisma.productMaster.create({
      data: {
        sku: body.sku,
        serialCode,
        nameTh: body.nameTh,
        nameEn: body.nameEn || null,
        imageUrl: body.imageUrl || null,
        categoryId: body.categoryId,
        modelSize: body.modelSize || null,
        description: body.description || null,
        defaultUnitId: body.defaultUnitId || null,
        activationType: body.activationType || 'SINGLE',
        maxActivations: body.activationType === 'PACK' ? (body.maxActivations || 1) : 1,
        isActive: body.isActive ?? true,
      },
      include: {
        category: true,
        defaultUnit: true,
      },
    })

    return successResponse({ productMaster }, 201)
  } catch (error) {
    console.error('Create product master error:', error)
    return errors.internalError()
  }
})

// PATCH /api/admin/masters/products - Update a product master (requires id in body)
export const PATCH = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()

    if (!body.id) {
      return errorResponse('Product Master ID is required', 400)
    }

    // Check SKU uniqueness if updating
    if (body.sku) {
      const existing = await prisma.productMaster.findFirst({
        where: {
          sku: body.sku,
          NOT: { id: body.id },
        },
      })
      if (existing) {
        return errorResponse('SKU already exists', 400)
      }
    }

    // Validate and check serialCode uniqueness if updating
    let serialCodeUpdate: string | undefined
    if (body.serialCode !== undefined) {
      serialCodeUpdate = (body.serialCode as string).toUpperCase()
      if (!/^[A-Z0-9]{5}$/.test(serialCodeUpdate)) {
        return errorResponse('Serial Code must be exactly 5 uppercase alphanumeric characters', 400)
      }
      const existingSerialCode = await prisma.productMaster.findFirst({
        where: {
          serialCode: serialCodeUpdate,
          NOT: { id: body.id },
        },
      })
      if (existingSerialCode) {
        return errorResponse('Serial Code already exists', 400)
      }
    }

    const productMaster = await prisma.productMaster.update({
      where: { id: body.id },
      data: {
        ...(body.sku && { sku: body.sku }),
        ...(serialCodeUpdate && { serialCode: serialCodeUpdate }),
        ...(body.nameTh && { nameTh: body.nameTh }),
        ...(body.nameEn !== undefined && { nameEn: body.nameEn }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
        ...(body.categoryId && { categoryId: body.categoryId }),
        ...(body.modelSize !== undefined && { modelSize: body.modelSize }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.defaultUnitId !== undefined && { defaultUnitId: body.defaultUnitId }),
        ...(body.activationType !== undefined && { activationType: body.activationType }),
        ...(body.maxActivations !== undefined && {
          maxActivations: body.activationType === 'PACK' ? body.maxActivations : 1
        }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
      include: {
        category: true,
        defaultUnit: true,
      },
    })

    return successResponse({ productMaster })
  } catch (error) {
    console.error('Update product master error:', error)
    return errors.internalError()
  }
})

// DELETE /api/admin/masters/products - Delete a product master (requires id in body)
export const DELETE = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()

    if (!body.id) {
      return errorResponse('Product Master ID is required', 400)
    }

    // Check if there are product items using this master
    const itemCount = await prisma.productItem.count({
      where: { productMasterId: body.id },
    })

    if (itemCount > 0 && !body.force) {
      // Soft delete - just deactivate
      await prisma.productMaster.update({
        where: { id: body.id },
        data: { isActive: false },
      })
      return successResponse({ message: 'Product master deactivated (has items)', deactivated: true })
    }

    await prisma.productMaster.delete({
      where: { id: body.id },
    })

    return successResponse({ message: 'Product master deleted successfully' })
  } catch (error) {
    console.error('Delete product master error:', error)
    return errors.internalError()
  }
})
