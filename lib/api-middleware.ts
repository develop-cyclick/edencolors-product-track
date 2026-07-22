import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { getCurrentUser } from './session'
import { hasRole, hasMinimumRole, JWTPayload } from './auth'
import { errors } from './api-response'
import { canAccessPageKey } from './permissions'
import { loadPermissionMatrix } from './permissions-server'

type ApiHandler<T = unknown> = (
  request: NextRequest,
  context: { user: JWTPayload; params?: T }
) => Promise<NextResponse>

/**
 * Require authentication for an API route
 */
export function withAuth<T = unknown>(handler: ApiHandler<T>) {
  return async (request: NextRequest, context?: { params?: T }) => {
    const user = await getCurrentUser()

    if (!user) {
      return errors.unauthorized()
    }

    return handler(request, { user, params: context?.params })
  }
}

/**
 * Require specific roles for an API route
 */
export function withRoles<T = unknown>(roles: UserRole[], handler: ApiHandler<T>) {
  return async (request: NextRequest, context?: { params?: T }) => {
    const user = await getCurrentUser()

    if (!user) {
      return errors.unauthorized()
    }

    if (!hasRole(user.role, roles)) {
      return errors.forbidden()
    }

    return handler(request, { user, params: context?.params })
  }
}

/**
 * Require minimum role level for an API route
 */
export function withMinRole<T = unknown>(minimumRole: UserRole, handler: ApiHandler<T>) {
  return async (request: NextRequest, context?: { params?: T }) => {
    const user = await getCurrentUser()

    if (!user) {
      return errors.unauthorized()
    }

    if (!hasMinimumRole(user.role, minimumRole)) {
      return errors.forbidden()
    }

    return handler(request, { user, params: context?.params })
  }
}

/**
 * Require access to a dashboard page per the admin-configurable role→page
 * matrix (the same matrix that drives the sidebar and layout guard). Use for
 * API routes backing a page whose access is granted by ticking roles in
 * Settings → สิทธิ์การใช้งาน, so granting the page also grants its actions.
 * ADMIN always passes.
 */
export function withPageAccess<T = unknown>(pageKey: string, handler: ApiHandler<T>) {
  return async (request: NextRequest, context?: { params?: T }) => {
    const user = await getCurrentUser()

    if (!user) {
      return errors.unauthorized()
    }

    const matrix = await loadPermissionMatrix()
    if (!canAccessPageKey(user.role, pageKey, matrix)) {
      return errors.forbidden()
    }

    return handler(request, { user, params: context?.params })
  }
}

/**
 * Admin only routes
 */
export function withAdmin<T = unknown>(handler: ApiHandler<T>) {
  return withRoles([UserRole.ADMIN], handler)
}

/**
 * Manager or Admin routes
 */
export function withManager<T = unknown>(handler: ApiHandler<T>) {
  return withRoles([UserRole.ADMIN, UserRole.MANAGER], handler)
}

/**
 * Warehouse, Manager, or Admin routes
 */
export function withWarehouse<T = unknown>(handler: ApiHandler<T>) {
  return withRoles([UserRole.ADMIN, UserRole.MANAGER, UserRole.WAREHOUSE], handler)
}

/**
 * Analytics routes - Admin, Manager, or Marketing
 */
export function withAnalytics<T = unknown>(handler: ApiHandler<T>) {
  return withRoles([UserRole.ADMIN, UserRole.MANAGER, UserRole.MARKETING], handler)
}
