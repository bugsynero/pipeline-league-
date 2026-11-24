import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import mongoose from 'mongoose'

export function apiError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Invalid request.', details: error.flatten() }, { status: 400 })
  const candidate = error as { code?: number; name?: string; message?: string }
  if (candidate?.code === 11000) return NextResponse.json({ code: 'DUPLICATE_RECORD', message: 'A record with one of these unique values already exists.' }, { status: 409 })
  if (candidate instanceof mongoose.Error.ValidationError || candidate?.name === 'ValidationError' || candidate?.name === 'CastError') return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'The supplied record is invalid.' }, { status: 400 })
  const message = error instanceof Error ? error.message : 'An unexpected server error occurred.'
  const status = message.includes('MONGODB_URI') ? 503 : 500
  return NextResponse.json({ code: status === 503 ? 'DATABASE_NOT_CONFIGURED' : 'INTERNAL_ERROR', message: status === 503 ? 'The tournament database is not configured.' : 'The request could not be completed.' }, { status })
}
