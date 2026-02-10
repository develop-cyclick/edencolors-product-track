import prisma from './prisma'

/**
 * Serial number format: 19 chars
 * Pos 1: S or P (SINGLE or PACK from activationType)
 * Pos 2: A-Z (category letter: categoryId 1=A, 2=B, 3=C...)
 * Pos 3-7: 5-char serialCode (from ProductMaster)
 * Pos 8-19: 12-digit running number (per-prefix counter)
 *
 * Example: PCBBN01000000000001
 */

export interface SerialParams {
  activationType: 'SINGLE' | 'PACK'
  categoryId: number
  serialCode: string // 5 chars from ProductMaster
}

/**
 * Convert categoryId to letter: 1=A, 2=B, 3=C...
 */
export function categoryIdToLetter(id: number): string {
  return String.fromCharCode(64 + id)
}

/**
 * Generate next serial number (19 chars) with per-prefix counter
 * Uses raw SQL upsert for atomicity
 * @param params - serial params (activationType, categoryId, serialCode)
 * @param tx - optional Prisma transaction client to use instead of default client
 */
export async function generateSerialNumber(
  params: SerialParams,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<string> {
  const typeChar = params.activationType === 'SINGLE' ? 'S' : 'P'
  const categoryChar = categoryIdToLetter(params.categoryId)
  const prefix = `${typeChar}${categoryChar}${params.serialCode}`
  const counterName = `SER_${prefix}`

  const client = tx ?? prisma

  // Use raw SQL for atomic upsert + increment
  const result = await client.$queryRaw<{ current_val: bigint }[]>`
    INSERT INTO sequence_counters (name, prefix, current_val)
    VALUES (${counterName}, ${prefix}, 1)
    ON CONFLICT (name) DO UPDATE SET current_val = sequence_counters.current_val + 1
    RETURNING current_val
  `

  const runningNumber = result[0].current_val.toString().padStart(12, '0')
  return `${prefix}${runningNumber}`
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
 * Generate next Pre-Generated Batch number (format: PG-YYYY-NNNNNN)
 */
export async function generatePreGenBatchNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PG-${year}-`

  const result = await prisma.$transaction(async (tx) => {
    // Update prefix if year changed
    const counter = await tx.sequenceCounter.update({
      where: { name: 'PRE_GEN' },
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
 * Generate next Borrow Transaction number (format: BR-YYYY-NNNNNN)
 */
export async function generateBorrowNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `BR-${year}-`

  const result = await prisma.$transaction(async (tx) => {
    // Update prefix if year changed
    const counter = await tx.sequenceCounter.update({
      where: { name: 'BORROW' },
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
 * Validate serial number format (19 chars: [SP][A-Z][A-Z0-9]{5}\d{12})
 */
export function isValidSerialNumber(serial: string): boolean {
  return /^[SP][A-Z][A-Z0-9]{5}\d{12}$/.test(serial)
}
