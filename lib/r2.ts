import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const endpoint = process.env.R2_ENDPOINT
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const bucket = process.env.R2_BUCKET_NAME
const publicUrl = process.env.R2_PUBLIC_URL

if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
  throw new Error('Missing R2 env vars: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL')
}

export const r2 = new S3Client({
  region: 'auto',
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
})

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )
  return `${publicUrl!.replace(/\/$/, '')}/${key}`
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

export function buildR2Key(folder: string, originalName: string): string {
  const ext = (originalName.split('.').pop() || 'bin').toLowerCase()
  const stamp = Date.now()
  const rand = Math.random().toString(36).slice(2, 10)
  return `${folder}/${stamp}-${rand}.${ext}`
}
