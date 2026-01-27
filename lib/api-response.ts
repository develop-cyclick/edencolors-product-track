import { NextResponse } from 'next/server'

type ApiResponse<T = unknown> = {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * Success response helper
 */
export function successResponse<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status })
}

/**
 * Error response helper
 */
export function errorResponse(
  error: string,
  status = 400
): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error }, { status })
}

/**
 * Message response helper
 */
export function messageResponse(
  message: string,
  status = 200
): NextResponse<ApiResponse> {
  return NextResponse.json({ success: true, message }, { status })
}

/**
 * Common error responses
 */
export const errors = {
  unauthorized: () => errorResponse('Unauthorized', 401),
  forbidden: () => errorResponse('Forbidden', 403),
  notFound: (resource = 'Resource') => errorResponse(`${resource} not found`, 404),
  badRequest: (message = 'Bad request') => errorResponse(message, 400),
  internalError: () => errorResponse('Internal server error', 500),
  validationError: (message: string) => errorResponse(message, 422),
}
