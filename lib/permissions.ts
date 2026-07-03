/**
 * Role → page access registry + pure helpers.
 *
 * This is the single source of truth for "which role can access which dashboard
 * page". It is PURE (no `prisma`, no `fs`) so both server code (layout guard,
 * API route) and client code (sidebar, settings matrix) can import it.
 *
 * The effective matrix = these defaults, overlaid with an admin-configured
 * override stored in `SystemSetting['permissions.pagesByRole']`, then with two
 * safety rules forced on top:
 *   1. ADMIN can access every page (never removable) — prevents lockout.
 *   2. `locked` pages (the dashboard root) are always allowed to every role —
 *      keeps it usable as a redirect target with no loops.
 */

export const ALL_ROLES = ['ADMIN', 'MANAGER', 'WAREHOUSE', 'MARKETING'] as const
export type RoleName = (typeof ALL_ROLES)[number]

export const PERMISSION_SETTING_KEY = 'permissions.pagesByRole'

export interface PermissionPage {
  key: string
  labelTh: string
  labelEn: string
  defaultRoles: RoleName[]
  /** Always allowed to every role, not editable (e.g. dashboard root). */
  locked?: boolean
}

// The canonical page list. `key` = the first path segment after
// `/{locale}/dashboard/` (root page uses 'dashboard'). Seeded from the roles
// previously hardcoded in components/dashboard/sidebar.tsx.
export const PERMISSION_PAGES: PermissionPage[] = [
  { key: 'dashboard', labelTh: 'แดชบอร์ด', labelEn: 'Dashboard', defaultRoles: ['ADMIN', 'MANAGER', 'WAREHOUSE', 'MARKETING'], locked: true },
  { key: 'pre-generate', labelTh: 'สร้าง QR ล่วงหน้า', labelEn: 'Pre-Generate QR', defaultRoles: ['ADMIN', 'WAREHOUSE'] },
  { key: 'grn', labelTh: 'รับเข้าคลัง', labelEn: 'GRN', defaultRoles: ['ADMIN', 'WAREHOUSE'] },
  { key: 'purchase-orders', labelTh: 'ใบสั่งซื้อ', labelEn: 'Purchase Orders', defaultRoles: ['ADMIN', 'WAREHOUSE'] },
  { key: 'outbound', labelTh: 'ส่งออก', labelEn: 'Outbound', defaultRoles: ['ADMIN', 'WAREHOUSE'] },
  { key: 'approval', labelTh: 'รออนุมัติ', labelEn: 'Approval', defaultRoles: ['ADMIN', 'MANAGER'] },
  { key: 'products', labelTh: 'สินค้าในคลัง', labelEn: 'Products', defaultRoles: ['ADMIN', 'MANAGER', 'WAREHOUSE'] },
  { key: 'clinics', labelTh: 'คลินิก', labelEn: 'Clinics', defaultRoles: ['ADMIN'] },
  { key: 'damaged-products', labelTh: 'เสียหาย/รับคืน/ยืม/คืนสินค้า', labelEn: 'Damaged/Return/Borrow', defaultRoles: ['ADMIN', 'WAREHOUSE'] },
  { key: 'users', labelTh: 'ผู้ใช้งาน', labelEn: 'Users', defaultRoles: ['ADMIN'] },
  { key: 'logs', labelTh: 'Event Logs', labelEn: 'Logs', defaultRoles: ['ADMIN', 'MANAGER'] },
  { key: 'analytics', labelTh: 'วิเคราะห์ข้อมูล', labelEn: 'Analytics', defaultRoles: ['ADMIN', 'MANAGER', 'MARKETING'] },
  { key: 'settings', labelTh: 'ตั้งค่าระบบ', labelEn: 'Settings', defaultRoles: ['ADMIN'] },
]

export type PermissionMatrix = Record<string, RoleName[]>

function isRole(value: unknown): value is RoleName {
  return typeof value === 'string' && (ALL_ROLES as readonly string[]).includes(value)
}

/**
 * Build the effective matrix from an optional stored override.
 * Only known page keys and known roles survive; ADMIN and locked-page rules are
 * always enforced. `stored` may be null (first run) or partial.
 */
export function mergePermissions(stored: Record<string, unknown> | null | undefined): PermissionMatrix {
  const matrix: PermissionMatrix = {}

  for (const page of PERMISSION_PAGES) {
    let roles: RoleName[]

    if (page.locked) {
      roles = [...ALL_ROLES]
    } else {
      const overrideRaw = stored?.[page.key]
      if (Array.isArray(overrideRaw)) {
        // sanitize: keep only valid role names, dedupe
        roles = ALL_ROLES.filter((r) => overrideRaw.includes(r))
      } else {
        roles = [...page.defaultRoles]
      }
    }

    // ADMIN always allowed
    if (!roles.includes('ADMIN')) roles = ['ADMIN', ...roles]
    // keep a stable role order
    matrix[page.key] = ALL_ROLES.filter((r) => roles.includes(r))
  }

  return matrix
}

/**
 * Whether a role may access a page key. Pages NOT in the registry
 * (e.g. reprint/return/borrow) are unrestricted — preserving current behavior.
 */
export function canAccessPageKey(role: string, pageKey: string, matrix: PermissionMatrix): boolean {
  if (role === 'ADMIN') return true
  const allowed = matrix[pageKey]
  if (!allowed) return true // unregistered page → no page-level restriction
  return isRole(role) && allowed.includes(role)
}

/** List of registry page keys the role may access (drives the sidebar menu). */
export function allowedPageKeysForRole(role: string, matrix: PermissionMatrix): string[] {
  return PERMISSION_PAGES.filter((p) => canAccessPageKey(role, p.key, matrix)).map((p) => p.key)
}

/**
 * Derive the page key from a request path.
 * `/th/dashboard`            -> 'dashboard'
 * `/th/dashboard/grn/5`      -> 'grn'
 * `/en/dashboard/analytics/timeline` -> 'analytics'
 */
export function pageKeyFromPath(pathname: string): string {
  const idx = pathname.indexOf('/dashboard')
  if (idx === -1) return 'dashboard'
  const rest = pathname.slice(idx + '/dashboard'.length).replace(/^\/+/, '')
  if (!rest) return 'dashboard'
  return rest.split('/')[0]
}
