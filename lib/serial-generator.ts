import prisma from './prisma'

/**
 * Generate next serial number (12 digits, auto-running)
 * Uses database sequence counter with row locking for atomicity
 */
export async function generateSerialNumber(): Promise<string> {
  // Use transaction with row lock to prevent duplicate serials
  const result = await prisma.$transaction(async (tx) => {
    // Get and increment the counter atomically
    const counter = await tx.sequenceCounter.update({
      where: { name: 'SERIAL' },
      data: {
        currentVal: {
          increment: 1,
        },
      },
    })

    return counter.currentVal
  })

  // Format as 12-digit string with leading zeros
  return result.toString().padStart(12, '0')
}

/**
 * Generate next GRN number (format: GRN-YYYY-NNNNNN)
 */
export async function generateGRNNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `GRN-${year}-`

  const result = await prisma.$transaction(async (tx) => {
    // Update prefix if year changed
    const counter = await tx.sequenceCounter.update({
      where: { name: 'GRN' },
      data: {
        prefix: prefix,
        currentVal: {
          increment: 1,
        },
      },
    })

    return counter
  })

  // Format as 6-digit number
  return `${result.prefix}${result.currentVal.toString().padStart(6, '0')}`
}

/**
 * Generate next Outbound number (format: OUT-YYYY-NNNNNN)
 */
export async function generateOutboundNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `OUT-${year}-`

  const result = await prisma.$transaction(async (tx) => {
    // Update prefix if year changed
    const counter = await tx.sequenceCounter.update({
      where: { name: 'OUTBOUND' },
      data: {
        prefix: prefix,
        currentVal: {
          increment: 1,
        },
      },
    })

    return counter
  })

  // Format as 6-digit number
  return `${result.prefix}${result.currentVal.toString().padStart(6, '0')}`
}

/**
 * Validate serial number format (12 digits)
 */
export function isValidSerialNumber(serial: string): boolean {
  return /^\d{12}$/.test(serial)
}
