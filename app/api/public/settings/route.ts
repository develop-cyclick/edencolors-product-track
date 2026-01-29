import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Default settings values for public access
const DEFAULT_SETTINGS: Record<string, unknown> = {
  'verify.showClinicInfo': true,
}

// Public settings keys that can be accessed without authentication
const PUBLIC_SETTINGS_KEYS = [
  'verify.showClinicInfo',
]

// GET /api/public/settings - Get public system settings
export async function GET() {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: { in: PUBLIC_SETTINGS_KEYS },
      },
    })

    // Convert to key-value object, applying defaults
    const settingsMap: Record<string, unknown> = {}
    for (const key of PUBLIC_SETTINGS_KEYS) {
      settingsMap[key] = DEFAULT_SETTINGS[key]
    }
    for (const setting of settings) {
      try {
        settingsMap[setting.key] = JSON.parse(setting.value)
      } catch {
        settingsMap[setting.key] = setting.value
      }
    }

    return NextResponse.json({
      success: true,
      data: { settings: settingsMap },
    })
  } catch (error) {
    console.error('Get public settings error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
