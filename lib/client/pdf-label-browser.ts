import QRCode from 'qrcode'
import {
  drawGridLabelPDF,
  drawIndividualLabelPDF,
  type LabelData,
  type QrMatrix,
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

// How many QR codes to build before yielding to the event loop.
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
 * Build all QR module matrices for the given labels, chunked + yielding so the
 * UI thread isn't blocked. Reports progress via onProgress. The matrices are
 * drawn as vector QR (pure CMYK K) by the shared core — no raster involved.
 */
async function renderQrMatrices(
  labels: LabelData[],
  opts: GenerateOptions,
): Promise<QrMatrix[]> {
  const qrMatrices: QrMatrix[] = new Array(labels.length)

  for (let i = 0; i < labels.length; i++) {
    throwIfAborted(opts.signal)
    qrMatrices[i] = QRCode.create(labels[i].qrCodeUrl, {
      errorCorrectionLevel: 'M',
    }).modules

    if (i % CHUNK_SIZE === 0) {
      opts.onProgress?.(i, labels.length)
      // Yield to keep the tab responsive.
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  opts.onProgress?.(labels.length, labels.length)
  return qrMatrices
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
  const qrMatrices = await renderQrMatrices(labels, opts)
  throwIfAborted(opts.signal)

  const doc = drawGridLabelPDF(labels, qrMatrices, {
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
  const qrMatrices = await renderQrMatrices(labels, opts)
  throwIfAborted(opts.signal)

  const doc = drawIndividualLabelPDF(labels, qrMatrices, { bannerDataUrl })

  return doc.output('blob')
}
