import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withRoles } from '@/lib/api-middleware'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/admin/masters/warehouses
async function handleGET() {
  const warehouses = await prisma.warehouse.findMany({
    orderBy: { name: 'asc' },
  })

  return successResponse({ warehouses })
}

// POST /api/admin/masters/warehouses
async function handlePOST(request: NextRequest) {
  const body = await request.json()

  if (!body.name) {
    return errorResponse('Name is required', 400)
  }

  const warehouse = await prisma.warehouse.create({
    data: {
      name: body.name,
      isActive: body.isActive ?? true,
    },
  })

  return successResponse({ warehouse }, 201)
}

// PATCH /api/admin/masters/warehouses
async function handlePATCH(request: NextRequest) {
  const body = await request.json()

  if (!body.id) {
    return errorResponse('Warehouse ID is required', 400)
  }

  const warehouse = await prisma.warehouse.update({
    where: { id: body.id },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  })

  return successResponse({ warehouse })
}

// DELETE /api/admin/masters/warehouses
async function handleDELETE(request: NextRequest) {
  const body = await request.json()

  if (!body.id) {
    return errorResponse('Warehouse ID is required', 400)
  }

  await prisma.warehouse.delete({
    where: { id: body.id },
  })

  return successResponse({ message: 'Warehouse deleted successfully' })
}

export const GET = withRoles(['ADMIN', 'MANAGER', 'WAREHOUSE'], handleGET)
export const POST = withRoles(['ADMIN'], handlePOST)
export const PATCH = withRoles(['ADMIN'], handlePATCH)
export const DELETE = withRoles(['ADMIN'], handleDELETE)
