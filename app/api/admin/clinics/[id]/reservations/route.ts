import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdmin, withWarehouse } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'

type Params = { id: string }

interface Reservation {
  productMasterId: number
  quantity: number
}

// GET /api/admin/clinics/[id]/reservations - Get clinic reservations
export const GET = withWarehouse<Promise<Params>>(async (_request, { params }) => {
  try {
    const { id } = await params!
    const clinicId = parseInt(id)

    if (isNaN(clinicId)) {
      return errorResponse('Invalid clinic ID', 400)
    }

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { id: true, name: true, reservations: true },
    })

    if (!clinic) {
      return errors.notFound('Clinic')
    }

    const reservations = (clinic.reservations as Reservation[]) || []

    // Get ProductMaster info for each reservation
    const productMasterIds = reservations.map((r) => r.productMasterId)
    const productMasters = await prisma.productMaster.findMany({
      where: { id: { in: productMasterIds } },
      include: { defaultUnit: true, category: true },
    })

    const reservationsWithDetails = reservations.map((r) => {
      const pm = productMasters.find((p) => p.id === r.productMasterId)
      return {
        ...r,
        productMaster: pm || null,
      }
    })

    return successResponse({
      clinicId: clinic.id,
      clinicName: clinic.name,
      reservations: reservationsWithDetails,
    })
  } catch (error) {
    console.error('Get clinic reservations error:', error)
    return errors.internalError()
  }
})

// PUT /api/admin/clinics/[id]/reservations - Update all reservations (replace)
export const PUT = withAdmin<Promise<Params>>(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!
    const clinicId = parseInt(id)

    if (isNaN(clinicId)) {
      return errorResponse('Invalid clinic ID', 400)
    }

    const body = await request.json()
    const reservations: Reservation[] = body.reservations || []

    // Validate reservations
    for (const r of reservations) {
      if (!r.productMasterId || typeof r.quantity !== 'number' || r.quantity < 0) {
        return errorResponse('Invalid reservation: productMasterId and quantity are required', 400)
      }
    }

    // Validate ProductMasters exist
    const productMasterIds = reservations.map((r) => r.productMasterId)
    const productMasters = await prisma.productMaster.findMany({
      where: { id: { in: productMasterIds }, isActive: true },
    })

    if (productMasters.length !== productMasterIds.length) {
      return errorResponse('Some ProductMasters not found or inactive', 400)
    }

    // Update clinic reservations
    const clinic = await prisma.clinic.update({
      where: { id: clinicId },
      data: { reservations: reservations },
    })

    return successResponse({
      clinicId: clinic.id,
      reservations: clinic.reservations,
    })
  } catch (error) {
    console.error('Update clinic reservations error:', error)
    return errors.internalError()
  }
})

// PATCH /api/admin/clinics/[id]/reservations - Update single reservation
export const PATCH = withAdmin<Promise<Params>>(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!
    const clinicId = parseInt(id)

    if (isNaN(clinicId)) {
      return errorResponse('Invalid clinic ID', 400)
    }

    const body = await request.json()
    const { productMasterId, quantity } = body

    if (!productMasterId || typeof quantity !== 'number') {
      return errorResponse('productMasterId and quantity are required', 400)
    }

    // Get current clinic
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
    })

    if (!clinic) {
      return errors.notFound('Clinic')
    }

    // Validate ProductMaster exists
    const productMaster = await prisma.productMaster.findUnique({
      where: { id: productMasterId, isActive: true },
    })

    if (!productMaster) {
      return errorResponse('ProductMaster not found or inactive', 400)
    }

    const currentReservations = (clinic.reservations as Reservation[]) || []
    let newReservations: Reservation[]

    if (quantity <= 0) {
      // Remove reservation
      newReservations = currentReservations.filter((r) => r.productMasterId !== productMasterId)
    } else {
      // Add or update reservation
      const existingIndex = currentReservations.findIndex((r) => r.productMasterId === productMasterId)
      if (existingIndex >= 0) {
        newReservations = [...currentReservations]
        newReservations[existingIndex] = { productMasterId, quantity }
      } else {
        newReservations = [...currentReservations, { productMasterId, quantity }]
      }
    }

    // Update clinic
    const updatedClinic = await prisma.clinic.update({
      where: { id: clinicId },
      data: { reservations: newReservations },
    })

    return successResponse({
      clinicId: updatedClinic.id,
      reservations: updatedClinic.reservations,
    })
  } catch (error) {
    console.error('Patch clinic reservation error:', error)
    return errors.internalError()
  }
})
