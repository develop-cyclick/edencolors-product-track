/**
 * Client-side helper for QR-label printing/downloading.
 *
 * Flow: ask the server for the lightweight item list (`format: 'json'`), then
 * render the QR images + PDF in the browser (offloading that work from the
 * DigitalOcean server), and finally print or download the resulting Blob.
 *
 * The heavy jspdf/qrcode modules are dynamically imported so they stay out of
 * the initial page bundle.
 */

export interface LabelRequestBody {
  productItemIds?: number[]
  grnId?: number
  layout: 'individual' | 'grid'
  batchId?: number
  reason?: string
}

export type LabelProgress = (done: number, total: number) => void

/**
 * Fetch the item list from the server and build the label PDF in the browser.
 * Throws an Error (with the server's message when available) on failure.
 */
export async function buildLabelBlob(
  body: LabelRequestBody,
  onProgress?: LabelProgress,
  signal?: AbortSignal,
): Promise<Blob> {
  const res = await fetch('/api/warehouse/labels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, format: 'json' }),
    signal,
  })

  if (!res.ok) {
    let message = 'Failed to generate labels'
    try {
      const err = await res.json()
      if (err?.error) message = err.error
    } catch {
      // ignore parse errors, keep default message
    }
    throw new Error(message)
  }

  const { data } = (await res.json()) as {
    data: {
      items: import('@/lib/pdf-label-core').LabelData[]
      dimensions: { widthMm: number; heightMm: number }
    }
  }

  const {
    generateGridLabelPDFBlob,
    generateIndividualLabelPDFBlob,
  } = await import('@/lib/client/pdf-label-browser')

  if (body.layout === 'grid') {
    return generateGridLabelPDFBlob(data.items, {
      widthMm: data.dimensions.widthMm,
      heightMm: data.dimensions.heightMm,
      onProgress,
      signal,
    })
  }

  return generateIndividualLabelPDFBlob(data.items, { onProgress, signal })
}

/**
 * Print a PDF blob via a hidden, off-screen iframe (auto-opens the print
 * dialog). Cleans itself up after 60s.
 */
export function printBlob(blob: Blob): void {
  const url = window.URL.createObjectURL(blob)

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.src = url
  iframe.onload = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
  }
  document.body.appendChild(iframe)

  window.setTimeout(() => {
    if (iframe.parentNode) document.body.removeChild(iframe)
    window.URL.revokeObjectURL(url)
  }, 60000)
}

/**
 * Trigger a browser download of a PDF blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}
