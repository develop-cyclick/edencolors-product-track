import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdmin } from '@/lib/api-middleware'
import { successResponse, errors } from '@/lib/api-response'
import {
  ALL_ROLES,
  PERMISSION_PAGES,
  PERMISSION_SETTING_KEY,
  mergePermissions,
} from '@/lib/permissions'

// GET /api/admin/permissions
// Returns the role list, the page registry (with labels), and the effective
// role→page matrix (defaults overlaid with the stored admin override).
export const GET = withAdmin(async () => {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: PERMISSION_SETTING_KEY },
    })

    let stored: Record<string, unknown> | null = null
    if (row) {
      try {
        stored = JSON.parse(row.value)
      } catch {
        stored = null
      }
    }

    return successResponse({
      roles: ALL_ROLES,
      pages: PERMISSION_PAGES,
      matrix: mergePermissions(stored),
    })
  } catch (error) {
    console.error('Get permissions error:', error)
    return errors.internalError()
  }
})

// PUT /api/admin/permissions
// Body: { matrix: Record<pageKey, roleName[]> }
// The incoming matrix is sanitized via mergePermissions (unknown keys/roles
// dropped, ADMIN forced onto every page, locked pages forced to all roles),
// then persisted as a single SystemSetting JSON value.
export const PUT = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const incoming = body?.matrix

    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return errors.badRequest('matrix object is required')
    }

    const clean = mergePermissions(incoming as Record<string, unknown>)

    await prisma.systemSetting.upsert({
      where: { key: PERMISSION_SETTING_KEY },
      update: { value: JSON.stringify(clean) },
      create: { key: PERMISSION_SETTING_KEY, value: JSON.stringify(clean) },
    })

    return successResponse({ matrix: clean })
  } catch (error) {
    console.error('Update permissions error:', error)
    return errors.internalError()
  }
})
