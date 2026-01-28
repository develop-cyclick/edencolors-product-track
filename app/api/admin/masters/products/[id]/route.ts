import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withWarehouse, withAdmin } from '@/lib/api-middleware'
import { successResponse, errors } from '@/lib/api-response'
import type { JWTPayload } from '@/lib/auth'

type RouteParams = Promise<{ id: string }>
type HandlerContext = { user: JWTPayload; params?: RouteParams }

// GET /api/admin/masters/products/[id] - Get product master with items
export const GET = withWarehouse(async (request: NextRequest, context: HandlerContext) => {
  try {
    if (!context.params) {
      return errors.badRequest('Missing params')
    }
    const { id } = await context.params
    const productMasterId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const productMaster = await prisma.productMaster.findUnique({
      where: { id: productMasterId },
      include: {
        category: true,
        defaultUnit: true,
      },
    })

    if (!productMaster) {
      return errors.notFound('Product Master')
    }

    // Get items with pagination
    const itemWhere = {
      productMasterId,
      ...(status && { status: status as 'IN_STOCK' | 'PENDING_OUT' | 'SHIPPED' | 'ACTIVATED' | 'RETURNED' }),
    }

    const [items, total] = await Promise.all([
      prisma.productItem.findMany({
        where: itemWhere,
        include: {
          assignedClinic: true,
          grnLine: {
            include: {
              unit: true,
              grnHeader: {
                select: {
                  grnNo: true,
                  receivedAt: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.productItem.count({ where: itemWhere }),
    ])

    // Get status counts
    const statusCounts = await prisma.productItem.groupBy({
      by: ['status'],
      where: { productMasterId },
      _count: { status: true },
    })

    const stats = {
      total: 0,
      inStock: 0,
      pendingOut: 0,
      shipped: 0,
      activated: 0,
      returned: 0,
    }

    statusCounts.forEach((sc) => {
      stats.total += sc._count.status
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

    return successResponse({
      productMaster: {
        ...productMaster,
        stats,
      },
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get product master error:', error)
    return errors.internalError()
  }
})

// PATCH /api/admin/masters/products/[id] - Update a product master
export const PATCH = withAdmin(async (request: NextRequest, context: HandlerContext) => {
  try {
    if (!context.params) {
      return errors.badRequest('Missing params')
    }
    const { id } = await context.params
    const body = await request.json()

    // Check SKU uniqueness if updating
    if (body.sku) {
      const existing = await prisma.productMaster.findFirst({
        where: {
          sku: body.sku,
          NOT: { id: parseInt(id) },
        },
      })
      if (existing) {
        return errors.badRequest('SKU already exists')
      }
    }

    const productMaster = await prisma.productMaster.update({
      where: { id: parseInt(id) },
      data: {
        ...(body.sku && { sku: body.sku }),
        ...(body.nameTh && { nameTh: body.nameTh }),
        ...(body.nameEn !== undefined && { nameEn: body.nameEn }),
        ...(body.categoryId && { categoryId: body.categoryId }),
        ...(body.modelSize !== undefined && { modelSize: body.modelSize }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.defaultUnitId !== undefined && { defaultUnitId: body.defaultUnitId }),
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

// DELETE /api/admin/masters/products/[id] - Delete a product master
export const DELETE = withAdmin(async (_request: NextRequest, context: HandlerContext) => {
  try {
    if (!context.params) {
      return errors.badRequest('Missing params')
    }
    const { id } = await context.params

    // Check if there are product items using this master
    const itemCount = await prisma.productItem.count({
      where: { productMasterId: parseInt(id) },
    })

    if (itemCount > 0) {
      // Soft delete - just deactivate
      await prisma.productMaster.update({
        where: { id: parseInt(id) },
        data: { isActive: false },
      })
      return successResponse({ message: 'Product master deactivated (has items)', deactivated: true })
    }

    await prisma.productMaster.delete({
      where: { id: parseInt(id) },
    })

    return successResponse({ message: 'Product master deleted successfully' })
  } catch (error) {
    console.error('Delete product master error:', error)
    return errors.internalError()
  }
})
