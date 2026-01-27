import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdmin, withWarehouse } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'

// GET /api/admin/clinics - List all clinics
// Allow WAREHOUSE role to read clinics for outbound creation
export const GET = withWarehouse(async () => {
  try {
    const clinics = await prisma.clinic.findMany({
      orderBy: { name: 'asc' },
    })
    return successResponse({ clinics })
  } catch (error) {
    console.error('List clinics error:', error)
    return errors.internalError()
  }
})

// POST /api/admin/clinics - Create a new clinic
export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.province) {
      return errorResponse('Name and province are required', 400)
    }

    const clinic = await prisma.clinic.create({
      data: {
        name: body.name,
        province: body.province,
        branchName: body.branchName || null,
        isActive: body.isActive ?? true,
      },
    })

    return successResponse({ clinic }, 201)
  } catch (error) {
    console.error('Create clinic error:', error)
    return errors.internalError()
  }
})
