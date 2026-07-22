/**
 * Server-side loader for the role → page access matrix.
 * Split from lib/permissions.ts so that file stays pure (client-importable).
 */
import prisma from './prisma'
import { mergePermissions, PERMISSION_SETTING_KEY, type PermissionMatrix } from './permissions'

/** Load the stored admin override and build the effective role→page matrix. */
export async function loadPermissionMatrix(): Promise<PermissionMatrix> {
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

  return mergePermissions(stored)
}
