import { NextRequest } from 'next/server'
import { withWarehouse } from '@/lib/api-middleware'
import { successResponse, errorResponse, errors } from '@/lib/api-response'
import { getDocumentHistory, DOCUMENT_TYPES, type DocumentType } from '@/lib/document-history'

// GET /api/warehouse/document-history?type=OUTBOUND&id=123 — approval/edit history timeline for one document
async function handleGET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || ''
    const id = parseInt(searchParams.get('id') || '')

    if (!DOCUMENT_TYPES.includes(type as DocumentType) || isNaN(id)) {
      return errorResponse('Invalid document type or id', 400)
    }

    const history = await getDocumentHistory(type as DocumentType, id)
    return successResponse({ history })
  } catch (error) {
    console.error('Document history error:', error)
    return errors.internalError()
  }
}

export const GET = withWarehouse(handleGET)
