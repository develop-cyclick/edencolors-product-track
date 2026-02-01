import { NextRequest, NextResponse } from 'next/server'
import { withRoles } from '@/lib/api-middleware'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import type { JWTPayload } from '@/lib/auth'

type HandlerContext = { user: JWTPayload }

// POST /api/admin/upload - Upload image
async function handlePOST(request: NextRequest, _context: HandlerContext) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Invalid file type. Allowed: jpg, png, webp, gif' }, { status: 400 })
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ success: false, error: 'File too large. Max 5MB' }, { status: 400 })
    }

    // Create uploads directory if not exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
    const filepath = path.join(uploadDir, filename)

    // Write file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    // Return URL
    const url = `/uploads/products/${filename}`

    return NextResponse.json({
      success: true,
      data: { url, filename }
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 })
  }
}

export const POST = withRoles(['ADMIN'], handlePOST)
