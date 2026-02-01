import { EncryptJWT, jwtDecrypt } from 'jose'
import { createHash } from 'crypto'

// QR Token Secret - must be exactly 32 bytes for A256GCM
const QR_SECRET = new TextEncoder().encode(
  (process.env.QR_TOKEN_SECRET || 'qr-token-secret-32-characters!!').slice(0, 32).padEnd(32, '!')
)

export interface QRTokenPayload {
  serialNumber: string  // 12-digit serial
  productItemId: number
  tokenVersion: number
  issuedAt: number      // Unix timestamp
}

/**
 * Create an encrypted QR token (JWE)
 * This token will be embedded in the QR code
 */
export async function createQRToken(payload: QRTokenPayload): Promise<string> {
  const token = await new EncryptJWT({ ...payload })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .encrypt(QR_SECRET)

  return token
}

/**
 * Decrypt and verify a QR token
 */
export async function decryptQRToken(token: string): Promise<QRTokenPayload | null> {
  try {
    const { payload } = await jwtDecrypt(token, QR_SECRET)
    return payload as unknown as QRTokenPayload
  } catch (error) {
    console.error('QR token decryption failed:', error)
    return null
  }
}

/**
 * Hash the token for storage (we don't store the actual token)
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Generate QR code URL with serial number (short URL for easy scanning)
 * The URL will be: {baseUrl}/v/{serial12}
 * This is much shorter than using the full JWE token, making QR codes easier to scan
 */
export function generateQRCodeURL(serial12: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/v/${serial12}`
}

/**
 * Legacy function for backwards compatibility (deprecated)
 * @deprecated Use generateQRCodeURL(serial12) instead
 */
export function generateQRCodeURLWithToken(token: string, locale: 'th' | 'en' = 'th'): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/${locale}/verify?token=${encodeURIComponent(token)}`
}

/**
 * Verify result codes
 */
export const VerifyResult = {
  GENUINE_IN_STOCK: 'GENUINE_IN_STOCK',     // ของแท้ อยู่ในคลัง
  GENUINE_SHIPPED: 'GENUINE_SHIPPED',       // ของแท้ ส่งออกแล้ว
  ACTIVATED: 'ACTIVATED',                   // เปิดใช้งานแล้ว
  RETURNED: 'RETURNED',                     // คืนสินค้า
  REPRINTED: 'REPRINTED',                   // QR ถูกเปลี่ยนใหม่แล้ว (token เก่า)
  INVALID_TOKEN: 'INVALID_TOKEN',           // Token ไม่ถูกต้อง
  NOT_FOUND: 'NOT_FOUND',                   // ไม่พบสินค้า
  REVOKED: 'REVOKED',                       // Token ถูก revoke
} as const

export type VerifyResultType = (typeof VerifyResult)[keyof typeof VerifyResult]
