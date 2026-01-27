import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'

// JWT Secret - must be at least 32 characters
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default-secret-change-in-production-32chars'
)

const JWT_EXPIRES_IN = '7d' // 7 days

export interface JWTPayload {
  userId: number
  username: string
  role: UserRole
  displayName: string
}

/**
 * Create a JWT token for a user
 */
export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(JWT_SECRET)
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

/**
 * Compare a password with a hash
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Check if user has required role
 */
export function hasRole(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole)
}

/**
 * Role hierarchy for permission checks
 * ADMIN > MANAGER > WAREHOUSE
 */
export function hasMinimumRole(userRole: UserRole, minimumRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    [UserRole.ADMIN]: 3,
    [UserRole.MANAGER]: 2,
    [UserRole.WAREHOUSE]: 1,
  }
  return roleHierarchy[userRole] >= roleHierarchy[minimumRole]
}
