import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { connectToDatabase } from '@/lib/server/db'
import { requireAdmin, canManage } from '@/lib/server/authorization'
import { apiError } from '@/lib/server/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 4 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    const auth = await requireAdmin(request)
    if (!auth.user) return NextResponse.json(auth.response, { status: auth.status })
    const allowed = ['teams', 'players', 'content', 'matches'].some(area => canManage(auth.user!.role, area as 'teams' | 'players' | 'content' | 'matches'))
    if (!allowed) return NextResponse.json({ code: 'FORBIDDEN', message: 'Your role cannot upload tournament images.' }, { status: 403 })

    const file = (await request.formData()).get('file')
    if (!(file instanceof File)) return NextResponse.json({ code: 'FILE_REQUIRED', message: 'Choose an image file to upload.' }, { status: 400 })
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ code: 'INVALID_IMAGE_TYPE', message: 'Use JPG, PNG, WEBP or GIF images.' }, { status: 400 })
    if (file.size < 1 || file.size > MAX_BYTES) return NextResponse.json({ code: 'INVALID_IMAGE_SIZE', message: 'Images must be 4 MB or smaller.' }, { status: 400 })

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET
    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ code: 'UPLOAD_NOT_CONFIGURED', message: 'Image uploads are not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to the deployment environment.' }, { status: 503 })
    }

    const timestamp = Math.floor(Date.now() / 1000)
    const signature = createHash('sha1').update('timestamp=' + timestamp + apiSecret).digest('hex')
    const payload = new FormData()
    payload.set('file', file, file.name)
    payload.set('api_key', apiKey)
    payload.set('timestamp', String(timestamp))
    payload.set('signature', signature)

    const response = await fetch('https://api.cloudinary.com/v1_1/' + encodeURIComponent(cloudName) + '/image/upload', { method: 'POST', body: payload })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || typeof result.secure_url !== 'string') {
      return NextResponse.json({ code: 'IMAGE_UPLOAD_FAILED', message: result.error?.message ?? 'The image provider rejected the upload.' }, { status: 502 })
    }
    return NextResponse.json({ url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height }, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}
