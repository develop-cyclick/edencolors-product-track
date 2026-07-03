import QRCode from 'qrcode'
import {
  drawGridLabelPDF,
  drawIndividualLabelPDF,
  type LabelData,
} from '@/lib/pdf-label-core'

/**
 * Browser-side QR-label PDF generation.
 *
 * This is the counterpart to lib/pdf-label.ts (server). It runs entirely in the
 * user's browser so the DigitalOcean server never has to rasterize QR images or
 * assemble large PDFs. QR generation is chunked so the tab stays responsive for
 * big batches (e.g. 2000 stickers), and it reports progress.
 *
 * Import this module dynamically (`await import(...)`) so jspdf/qrcode stay out
 * of the initial bundle.
 */

export type { LabelData }

export interface GenerateOptions {
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

// How many QR codes to render before yielding to the event loop.
const CHUNK_SIZE = 50

// ---------------------------------------------------------------------------
// Banner asset (fetched once, cached — mirrors the server's fs-based cache)
// ---------------------------------------------------------------------------
let bannerPromise: Promise<string | null> | null = null

async function fetchBannerDataUrl(): Promise<string | null> {
  if (bannerPromise) return bannerPromise

  bannerPromise = (async () => {
    try {
      const res = await fetch('/banner-qrcode.jpg')
      if (!res.ok) return null
      const blob = await res.blob()
      return await new Promise<string | null>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      })
    } catch {
      return null
    }
  })()

  // Cache even on failure to avoid refetch storms.
  return bannerPromise
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}

/**
 * Render all QR PNG data-URLs for the given labels, chunked + yielding so the
 * UI thread isn't blocked. Reports progress via onProgress.
 */
async function renderQrDataUrls(
  labels: LabelData[],
  width: number,
  opts: GenerateOptions,
): Promise<string[]> {
  const qrDataUrls: string[] = new Array(labels.length)

  for (let i = 0; i < labels.length; i++) {
    throwIfAborted(opts.signal)
    qrDataUrls[i] = await QRCode.toDataURL(labels[i].qrCodeUrl, {
      width,
      margin: 1,
      errorCorrectionLevel: 'M',
    })

    if (i % CHUNK_SIZE === 0) {
      opts.onProgress?.(i, labels.length)
      // Yield to keep the tab responsive.
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  opts.onProgress?.(labels.length, labels.length)
  return qrDataUrls
}

/**
 * Generate the A4 grid sticker-sheet PDF in the browser. Returns a Blob ready
 * for printing or download.
 */
export async function generateGridLabelPDFBlob(
  labels: LabelData[],
  opts: GenerateOptions & { widthMm?: number; heightMm?: number } = {},
): Promise<Blob> {
  const bannerDataUrl = await fetchBannerDataUrl()
  const qrDataUrls = await renderQrDataUrls(labels, 250, opts)
  throwIfAborted(opts.signal)

  const doc = drawGridLabelPDF(labels, qrDataUrls, {
    widthMm: opts.widthMm,
    heightMm: opts.heightMm,
    bannerDataUrl,
    // No registerFont: grid draws only banner + QR + ASCII serial (helvetica).
  })

  return doc.output('blob')
}

/**
 * Generate the 4x6" individual-label PDF (one per page) in the browser.
 */
export async function generateIndividualLabelPDFBlob(
  labels: LabelData[],
  opts: GenerateOptions = {},
): Promise<Blob> {
  const bannerDataUrl = await fetchBannerDataUrl()
  const qrDataUrls = await renderQrDataUrls(labels, 400, opts)
  throwIfAborted(opts.signal)

  const doc = drawIndividualLabelPDF(labels, qrDataUrls, { bannerDataUrl })

  return doc.output('blob')
}
