import prisma from './prisma'
import type { Prisma } from '@prisma/client'

// Document types that have an approval workflow + a per-document history timeline.
export type DocumentType = 'OUTBOUND' | 'GRN' | 'BORROW' | 'DAMAGED_CLAIM' | 'DAMAGED_ACTION'

export const DOCUMENT_TYPES: DocumentType[] = ['OUTBOUND', 'GRN', 'BORROW', 'DAMAGED_CLAIM', 'DAMAGED_ACTION']

type TxClient = Prisma.TransactionClient

/**
 * Append a document-level event to the audit history (EventLog tagged with documentType+documentId).
 * Use inside the same transaction as the state change so the log and the change commit together.
 * productItemId stays null for document-level events (created/approved/reopened/edited/re-approved).
 */
export async function logDocumentEvent(
  tx: TxClient,
  args: {
    documentType: DocumentType
    documentId: number
    eventType: string
    userId?: number | null
    details?: Prisma.InputJsonValue
    productItemId?: number | null
  }
) {
  return tx.eventLog.create({
    data: {
      eventType: args.eventType,
      documentType: args.documentType,
      documentId: args.documentId,
      productItemId: args.productItemId ?? null,
      userId: args.userId ?? null,
      ...(args.details !== undefined ? { details: args.details } : {}),
    },
  })
}

/**
 * Read the ordered history timeline for one document (oldest first).
 */
export async function getDocumentHistory(documentType: DocumentType, documentId: number) {
  const events = await prisma.eventLog.findMany({
    where: { documentType, documentId },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, displayName: true, username: true } } },
  })
  return events.map((e) => ({
    id: e.id,
    eventType: e.eventType,
    userId: e.userId,
    user: e.user ? { displayName: e.user.displayName, username: e.user.username } : null,
    details: e.details,
    createdAt: e.createdAt,
  }))
}
