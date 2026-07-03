import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'
import { loadSarabunFont } from './fonts/sarabun-font'
import {
  drawGridLabelPDF,
  drawIndividualLabelPDF,
  type LabelData,
} from './pdf-label-core'

export type { LabelData }

// Banner image cache
let bannerImageBase64: string | null = null

/**
 * Load the banner image as base64 from public folder (server-side, via fs).
 */
function loadBannerImage(): string | null {
  if (bannerImageBase64) return bannerImageBase64

  try {
    const bannerPath = path.join(process.cwd(), 'public', 'banner-qrcode.jpg')
    if (fs.existsSync(bannerPath)) {
      const imageBuffer = fs.readFileSync(bannerPath)
      bannerImageBase64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`
      return bannerImageBase64
    }
  } catch (error) {
    console.error('Failed to load banner image:', error)
  }
  return null
}

/**
 * Generate a PDF with 4x6 inch labels for QR codes (one label per page).
 * Server-side wrapper: renders QR images, loads assets via fs, returns a Buffer.
 */
export async function generateLabelPDF(labels: LabelData[]): Promise<Buffer> {
  const qrDataUrls = await Promise.all(
    labels.map((label) =>
      QRCode.toDataURL(label.qrCodeUrl, {
        width: 400,
        margin: 1,
        errorCorrectionLevel: 'M',
      }),
    ),
  )

  const doc = drawIndividualLabelPDF(labels, qrDataUrls, {
    bannerDataUrl: loadBannerImage(),
    registerFont: loadSarabunFont,
  })

  return Buffer.from(doc.output('arraybuffer'))
}

/**
 * Generate a single label PDF for one product.
 */
export async function generateSingleLabelPDF(label: LabelData): Promise<Buffer> {
  return generateLabelPDF([label])
}

/**
 * Generate a PDF with QR codes in a grid layout on A4 paper.
 * Server-side wrapper: renders QR images, loads assets via fs, returns a Buffer.
 * See lib/pdf-label-core.ts for the layout logic (shared with the browser).
 */
export async function generateGridLabelPDF(
  labels: LabelData[],
  opts: { widthMm?: number; heightMm?: number } = {},
): Promise<Buffer> {
  const qrDataUrls = await Promise.all(
    labels.map((label) =>
      QRCode.toDataURL(label.qrCodeUrl, {
        width: 250,
        margin: 1,
        errorCorrectionLevel: 'M',
      }),
    ),
  )

  const doc = drawGridLabelPDF(labels, qrDataUrls, {
    ...opts,
    bannerDataUrl: loadBannerImage(),
    registerFont: loadSarabunFont,
  })

  return Buffer.from(doc.output('arraybuffer'))
}
