import type { NextConfig } from 'next'

const r2PublicUrl = process.env.R2_PUBLIC_URL
const r2Host = r2PublicUrl ? new URL(r2PublicUrl).hostname : undefined

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      // Cloudflare R2 default public domain
      { protocol: 'https', hostname: '**.r2.dev' },
      // Custom R2 public URL (from R2_PUBLIC_URL env var)
      ...(r2Host ? [{ protocol: 'https' as const, hostname: r2Host }] : []),
    ],
  },
}

export default nextConfig
