import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export function apiError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Invalid request.', details: error.flatten() }, { status: 400 })
  const message = error instanceof Error ? error.message : 'An unexpected server error occurred.'
  const status = message.includes('MONGODB_URI') ? 503 : 500
  return NextResponse.json({ code: status === 503 ? 'DATABASE_NOT_CONFIGURED' : 'INTERNAL_ERROR', message: status === 503 ? 'The tournament database is not configured.' : 'The request could not be completed.' }, { status })
}
export function requireJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('A JSON object is required.')
  return value as Record<string, unknown>
}
