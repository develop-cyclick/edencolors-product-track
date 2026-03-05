import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdmin } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'

type Params = { id: string }

// GET /api/admin/clinics/[id] - Get clinic by ID
export const GET = withAdmin<Promise<Params>>(async (_request, { params }) => {
  try {
    const { id } = await params!
    const clinicId = parseInt(id)

    if (isNaN(clinicId)) {
      return errorResponse('Invalid clinic ID', 400)
    }

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
    })

    if (!clinic) {
      return errors.notFound('Clinic')
    }

    return successResponse({ clinic })
  } catch (error) {
    console.error('Get clinic error:', error)
    return errors.internalError()
  }
})

// PATCH /api/admin/clinics/[id] - Update clinic
export const PATCH = withAdmin<Promise<Params>>(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!
    const clinicId = parseInt(id)

    if (isNaN(clinicId)) {
      return errorResponse('Invalid clinic ID', 400)
    }

    const body = await request.json()

    // Check if clinic exists
    const existing = await prisma.clinic.findUnique({
      where: { id: clinicId },
    })

    if (!existing) {
      return errors.notFound('Clinic')
    }

    const clinic = await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.companyName !== undefined && { companyName: body.companyName || null }),
        ...(body.province && { province: body.province }),
        ...(body.branchName !== undefined && { branchName: body.branchName }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    })

    return successResponse({ clinic })
  } catch (error) {
    console.error('Update clinic error:', error)
    return errors.internalError()
  }
})

// DELETE /api/admin/clinics/[id] - Delete clinic
// Use ?hard=true for permanent deletion, otherwise soft delete
export const DELETE = withAdmin<Promise<Params>>(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!
    const clinicId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const hardDelete = searchParams.get('hard') === 'true'

    if (isNaN(clinicId)) {
      return errorResponse('Invalid clinic ID', 400)
    }

    // Check if clinic exists
    const existing = await prisma.clinic.findUnique({
      where: { id: clinicId },
    })

    if (!existing) {
      return errors.notFound('Clinic')
    }

    if (hardDelete) {
      // Permanent delete
      await prisma.clinic.delete({
        where: { id: clinicId },
      })
      return successResponse({ message: 'Clinic deleted permanently' })
    } else {
      // Soft delete
      await prisma.clinic.update({
        where: { id: clinicId },
        data: { isActive: false },
      })
      return successResponse({ message: 'Clinic deactivated successfully' })
    }
  } catch (error) {
    console.error('Delete clinic error:', error)
    return errors.internalError()
  }
})
