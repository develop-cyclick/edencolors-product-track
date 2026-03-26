import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdmin } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'

// Default settings values
const DEFAULT_SETTINGS: Record<string, unknown> = {
  'verify.showClinicName': true,
  'verify.showBranchInfo': true,
  'verify.showClinicAddress': true,
}

// GET /api/admin/system-settings - Get all system settings
export const GET = withAdmin(async () => {
  try {
    const settings = await prisma.systemSetting.findMany()

    // Convert to key-value object, applying defaults
    const settingsMap: Record<string, unknown> = { ...DEFAULT_SETTINGS }
    for (const setting of settings) {
      try {
        settingsMap[setting.key] = JSON.parse(setting.value)
      } catch {
        settingsMap[setting.key] = setting.value
      }
    }

    return successResponse({ settings: settingsMap })
  } catch (error) {
    console.error('Get system settings error:', error)
    return errors.internalError()
  }
})

// PATCH /api/admin/system-settings - Update a system setting
export const PATCH = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { key, value } = body

    if (!key) {
      return errorResponse('Setting key is required', 400)
    }

    if (value === undefined) {
      return errorResponse('Setting value is required', 400)
    }

    // Upsert the setting
    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: {
        value: JSON.stringify(value),
      },
      create: {
        key,
        value: JSON.stringify(value),
      },
    })

    return successResponse({
      setting: {
        key: setting.key,
        value: JSON.parse(setting.value),
      },
    })
  } catch (error) {
    console.error('Update system setting error:', error)
    return errors.internalError()
  }
})
