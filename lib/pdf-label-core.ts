import jsPDF from 'jspdf'

/**
 * Isomorphic core for QR-label PDF generation.
 *
 * Contains only pure layout math + jsPDF drawing. It has NO Node-only
 * dependencies (no `fs`, no `Buffer`, no `qrcode`) so the exact same code runs
 * on the server AND in the browser. Callers inject the heavy/environment-
 * specific pieces:
 *   - `qrDataUrls`: pre-rendered QR PNG data-URLs (index-aligned with `labels`)
 *   - `bannerDataUrl`: the banner image as a data-URL (or null)
 *   - `registerFont`: optional callback to register a Thai font into the doc
 *
 * The draw functions RETURN the jsPDF document; the caller serializes it
 * (`doc.output('arraybuffer')` → Buffer on the server, `doc.output('blob')` in
 * the browser).
 */

export interface LabelData {
  serialNumber: string
  qrCodeUrl: string
  productName?: string
  sku?: string
  lot?: string
  mfgDate?: string
  expDate?: string
}

/**
 * A QR module matrix (structurally compatible with `qrcode`'s BitMatrix). The
 * callers build it with `QRCode.create(text, ...).modules` and inject it here,
 * so this core stays free of the `qrcode` dependency. `get(row, col)` returns a
 * truthy value for a dark module.
 */
export interface QrMatrix {
  size: number
  get(row: number, col: number): number
}

// ============================================
// GRID LAYOUT (A4 sticker sheet) constants
// ============================================
export const GRID = {
  A4_WIDTH_MM: 210,
  A4_HEIGHT_MM: 297,
  MARGIN_MM: 5,
  GAP_MM: 2,
  // Default sticker (dashed cut box) size; overridable per call. QR auto-fits.
  W_DEF: 20,
  W_MIN: 10,
  W_MAX: 100,
  H_DEF: 34,
  H_MIN: 10,
  H_MAX: 140,
  // Smallest scannable QR square, and the strip reserved for the serial number.
  QR_MIN_MM: 10,
  SERIAL_TEXT_MM: 6,
  SERIAL_GAP_MM: 3,
} as const

// Banner aspect: rendered banner height = cellWidth * this ratio.
export const BANNER_ASPECT_RATIO = 0.28

// ============================================
// INDIVIDUAL LAYOUT (4x6 inch label) constants
// ============================================
const INDIVIDUAL = {
  LABEL_WIDTH_MM: 101.6, // 4 inches
  LABEL_HEIGHT_MM: 152.4, // 6 inches
  MARGIN_MM: 6,
  QR_SIZE_MM: 60,
} as const

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export interface GridGeometry {
  cellWidth: number
  cellHeight: number
  bannerHeight: number
  qrSize: number
  gridColumns: number
  rowsPerPage: number
  itemsPerPage: number
}

/**
 * Derive the grid geometry (sticker box, QR size, columns/rows per A4 page)
 * from the configured sticker width/height. Shared by the PDF drawing code and
 * the settings-page preview so they never drift.
 *
 * @param bannerRatio fraction of cellWidth reserved for the banner on top
 *        (default assumes a banner is present; pass 0 for no banner).
 */
export function computeGridGeometry(
  widthMm?: number,
  heightMm?: number,
  bannerRatio: number = BANNER_ASPECT_RATIO,
): GridGeometry {
  const cellWidth = clamp(widthMm ?? GRID.W_DEF, GRID.W_MIN, GRID.W_MAX)
  const cellHeight = clamp(heightMm ?? GRID.H_DEF, GRID.H_MIN, GRID.H_MAX)

  const bannerHeight = cellWidth * bannerRatio

  // Largest square that fits the width and the height left after the banner
  // (top) and the serial-number strip (bottom).
  const qrSize = Math.max(
    GRID.QR_MIN_MM,
    Math.min(cellWidth, cellHeight - bannerHeight - GRID.SERIAL_TEXT_MM),
  )

  const usableWidth = GRID.A4_WIDTH_MM - GRID.MARGIN_MM * 2
  const gridColumns = Math.max(
    1,
    Math.floor((usableWidth + GRID.GAP_MM) / (cellWidth + GRID.GAP_MM)),
  )

  const usableHeight = GRID.A4_HEIGHT_MM - GRID.MARGIN_MM * 2
  const rowsPerPage = Math.max(
    1,
    Math.floor((usableHeight + GRID.GAP_MM) / (cellHeight + GRID.GAP_MM)),
  )

  return {
    cellWidth,
    cellHeight,
    bannerHeight,
    qrSize,
    gridColumns,
    rowsPerPage,
    itemsPerPage: gridColumns * rowsPerPage,
  }
}

/**
 * Format serial number with dashes for readability.
 * New 19-char format: PCBBN01000000000001 -> PCBBN01-000000-000001
 */
export function formatSerial(serial: string): string {
  if (serial.length === 19) {
    const prefix = serial.slice(0, 7)
    const running = serial.slice(7)
    return `${prefix}-${running.slice(0, 6)}-${running.slice(6, 12)}`
  }
  return serial
}

interface DrawOpts {
  bannerDataUrl?: string | null
  registerFont?: (doc: jsPDF) => void
}

// Quiet zone (blank margin) around the QR, in modules. Kept at 1 to match the
// previous raster path (`margin: 1`) so the physical module size is unchanged.
const QR_QUIET_MODULES = 1

/**
 * Draw a QR code as VECTOR rectangles (one filled square per dark module) in
 * pure CMYK black (K only) instead of embedding a raster PNG.
 *
 * Why: print factories convert the PDF to CMYK. A raster RGB black becomes a
 * muddy "rich black" (looks brown), and the white raster background can be
 * misread as black by the RIP. Drawing vectors in `0 0 0 1 k` (100% K) prints a
 * clean black, and leaving white areas UNDRAWN lets the paper show through — no
 * white pixels to misinterpret. Vectors are also crisp at any print resolution.
 *
 * Adjacent dark modules in a row are merged into a single rectangle (run-length)
 * to avoid hairline seams between squares and to keep the op count down.
 */
function drawVectorQr(
  doc: jsPDF,
  matrix: QrMatrix,
  x: number,
  y: number,
  sizeMm: number,
): void {
  const totalModules = matrix.size + QR_QUIET_MODULES * 2
  const moduleMm = sizeMm / totalModules
  const offset = QR_QUIET_MODULES * moduleMm

  doc.setFillColor(0, 0, 0, 1) // CMYK: 0 0 0 1 k => pure K black

  for (let row = 0; row < matrix.size; row++) {
    let col = 0
    while (col < matrix.size) {
      if (!matrix.get(row, col)) {
        col++
        continue
      }
      // Extend the run over consecutive dark modules, draw them as one rect.
      let run = 1
      while (col + run < matrix.size && matrix.get(row, col + run)) run++
      doc.rect(
        x + offset + col * moduleMm,
        y + offset + row * moduleMm,
        run * moduleMm,
        moduleMm,
        'F',
      )
      col += run
    }
  }
}

/**
 * Draw QR codes in a grid on A4 paper. `qrDataUrls` must be index-aligned with
 * `labels`. Returns the jsPDF document (caller serializes it).
 */
export function drawGridLabelPDF(
  labels: LabelData[],
  qrMatrices: QrMatrix[],
  opts: DrawOpts & { widthMm?: number; heightMm?: number } = {},
): jsPDF {
  // compress: true => FlateDecode the page content streams. The QR is now drawn
  // as many small vector rects; compression keeps a 2000-label sheet small.
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })

  const fontFamily = 'helvetica'
  opts.registerFont?.(doc)

  const bannerImage = opts.bannerDataUrl ?? null

  const {
    cellWidth,
    cellHeight,
    bannerHeight,
    qrSize,
    gridColumns,
    itemsPerPage,
  } = computeGridGeometry(opts.widthMm, opts.heightMm, bannerImage ? BANNER_ASPECT_RATIO : 0)

  for (let i = 0; i < labels.length; i++) {
    const indexOnPage = i % itemsPerPage

    if (i > 0 && indexOnPage === 0) {
      doc.addPage('a4', 'portrait')
    }

    const col = indexOnPage % gridColumns
    const row = Math.floor(indexOnPage / gridColumns)

    const x = GRID.MARGIN_MM + col * (cellWidth + GRID.GAP_MM)
    const y = GRID.MARGIN_MM + row * (cellHeight + GRID.GAP_MM)

    // Banner on top. Pass a stable alias so jsPDF embeds the banner image only
    // ONCE and references it in every cell — without this, the ~360KB banner is
    // re-embedded per label, bloating a 2000-label PDF to hundreds of MB.
    if (bannerImage) {
      doc.addImage(bannerImage, 'JPEG', x, y, cellWidth, bannerHeight, 'banner', 'FAST')
    }

    // QR - centered horizontally, centered in the space between banner + serial strip
    const qrAreaTop = y + bannerHeight
    const qrAreaHeight = cellHeight - bannerHeight - GRID.SERIAL_TEXT_MM
    const qrX = x + (cellWidth - qrSize) / 2
    const qrY = qrAreaTop + Math.max(0, (qrAreaHeight - qrSize) / 2)
    // Vector QR in pure CMYK K (see drawVectorQr) — prints clean at the factory.
    drawVectorQr(doc, qrMatrices[i], qrX, qrY, qrSize)

    // Serial number right under the QR (clamped inside the box)
    doc.setFontSize(4)
    doc.setFont(fontFamily, 'bold')
    doc.setTextColor(0, 0, 0, 1) // CMYK K

    const serial = labels[i].serialNumber
    const serialY = Math.min(qrY + qrSize + GRID.SERIAL_GAP_MM, y + cellHeight - 1)
    doc.text(serial, x + cellWidth / 2, serialY, { align: 'center' })
  }

  // Footer page info
  const totalPages = Math.ceil(labels.length / itemsPerPage)
  for (let p = 0; p < totalPages; p++) {
    doc.setPage(p + 1)
    doc.setFontSize(6)
    doc.setFont(fontFamily, 'normal')
    doc.setTextColor(0, 0, 0, 0.4) // CMYK K-gray

    const startItem = p * itemsPerPage + 1
    const endItem = Math.min((p + 1) * itemsPerPage, labels.length)
    doc.text(
      `Page ${p + 1}/${totalPages} | Items ${startItem}-${endItem} of ${labels.length}`,
      GRID.A4_WIDTH_MM / 2,
      GRID.A4_HEIGHT_MM - 3,
      { align: 'center' },
    )
  }

  return doc
}

/**
 * Draw one 4x6" label per page. `qrDataUrls` must be index-aligned with
 * `labels`. Returns the jsPDF document (caller serializes it).
 */
export function drawIndividualLabelPDF(
  labels: LabelData[],
  qrMatrices: QrMatrix[],
  opts: DrawOpts = {},
): jsPDF {
  const { LABEL_WIDTH_MM, LABEL_HEIGHT_MM, MARGIN_MM, QR_SIZE_MM } = INDIVIDUAL

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [LABEL_WIDTH_MM, LABEL_HEIGHT_MM],
    compress: true,
  })

  const fontFamily = 'helvetica'
  opts.registerFont?.(doc)

  const bannerImage = opts.bannerDataUrl ?? null
  const bannerWidth = LABEL_WIDTH_MM - MARGIN_MM * 2
  const bannerHeight = bannerImage ? bannerWidth * BANNER_ASPECT_RATIO : 0

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i]

    if (i > 0) {
      doc.addPage([LABEL_WIDTH_MM, LABEL_HEIGHT_MM], 'portrait')
    }

    const centerX = LABEL_WIDTH_MM / 2
    let yPos = MARGIN_MM

    doc.setTextColor(0, 0, 0, 1) // CMYK K for all text on this label

    if (bannerImage) {
      // Stable alias => banner embedded once, referenced on every page.
      doc.addImage(bannerImage, 'JPEG', MARGIN_MM, yPos, bannerWidth, bannerHeight, 'banner', 'FAST')
      yPos += bannerHeight + 4
    } else {
      yPos += 10
      doc.setFontSize(14)
      doc.setFont(fontFamily, 'bold')
      doc.text('QR Authenticity', centerX, yPos, { align: 'center' })
      yPos += 8
    }

    // QR - centered. Vector, pure CMYK K (see drawVectorQr / grid note above).
    const qrX = (LABEL_WIDTH_MM - QR_SIZE_MM) / 2
    drawVectorQr(doc, qrMatrices[i], qrX, yPos, QR_SIZE_MM)
    yPos += QR_SIZE_MM + 8

    // Serial number (prominent)
    doc.setFontSize(14)
    doc.setFont(fontFamily, 'bold')
    doc.text(formatSerial(label.serialNumber), centerX, yPos, { align: 'center' })
    yPos += 8

    // Scan instruction
    doc.setFontSize(9)
    doc.setFont(fontFamily, 'normal')
    doc.text('Scan QR to verify authenticity', centerX, yPos, { align: 'center' })
    yPos += 6

    // Product info
    if (label.productName || label.sku || label.lot || label.expDate) {
      yPos += 4
      doc.setFontSize(8)
      doc.setFont(fontFamily, 'normal')

      if (label.sku) {
        doc.text(`SKU: ${label.sku}`, MARGIN_MM, yPos)
        yPos += 4
      }

      if (label.lot || label.expDate) {
        const lotExpText = [
          label.lot ? `Lot: ${label.lot}` : null,
          label.expDate ? `Exp: ${label.expDate}` : null,
        ]
          .filter(Boolean)
          .join('  |  ')

        doc.text(lotExpText, MARGIN_MM, yPos)
        yPos += 4
      }
    }

    // Footer
    doc.setFontSize(7)
    doc.setTextColor(0, 0, 0, 0.5) // CMYK K-gray
    doc.setFont(fontFamily, 'normal')
    doc.text('Print at actual size (100%)', centerX, LABEL_HEIGHT_MM - MARGIN_MM, { align: 'center' })
    doc.setTextColor(0, 0, 0, 1) // reset to K black
  }

  return doc
}
