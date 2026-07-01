import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdmin } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'

// Default settings values
const DEFAULT_SETTINGS: Record<string, unknown> = {
  'verify.showClinicName': true,
  'verify.showBranchInfo': true,
  'verify.showClinicAddress': true,
  'label.widthMm': 20,
  'label.heightMm': 34,
}

// Per-key validation. Return string error to reject, or null to accept.
function validateSetting(key: string, value: unknown): string | null {
  // Back-compat: legacy single QR-size knob, superseded by width/height.
  if (key === 'label.qrSizeMm') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 'label.qrSizeMm must be a number'
    }
    if (value < 10 || value > 40) {
      return 'label.qrSizeMm must be between 10 and 40 mm'
    }
  }
  if (key === 'label.widthMm') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 'label.widthMm must be a number'
    }
    if (value < 10 || value > 100) {
      return 'label.widthMm must be between 10 and 100 mm'
    }
  }
  if (key === 'label.heightMm') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 'label.heightMm must be a number'
    }
    if (value < 10 || value > 140) {
      return 'label.heightMm must be between 10 and 140 mm'
    }
  }
  return null
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

    const validationError = validateSetting(key, value)
    if (validationError) {
      return errorResponse(validationError, 400)
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
