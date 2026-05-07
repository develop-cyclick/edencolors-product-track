import { NextRequest, NextResponse } from 'next/server'
import { withRoles } from '@/lib/api-middleware'
import { uploadToR2, buildR2Key } from '@/lib/r2'
import type { JWTPayload } from '@/lib/auth'

type HandlerContext = { user: JWTPayload }

// POST /api/admin/upload - Upload image to Cloudflare R2
async function handlePOST(request: NextRequest, _context: HandlerContext) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Invalid file type. Allowed: jpg, png, webp, gif' }, { status: 400 })
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ success: false, error: 'File too large. Max 5MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const key = buildR2Key('products', file.name)
    const url = await uploadToR2(key, buffer, file.type)

    return NextResponse.json({
      success: true,
      data: { url, filename: key },
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 })
  }
}

export const POST = withRoles(['ADMIN'], handlePOST)
