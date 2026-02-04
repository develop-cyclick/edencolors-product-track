import jsPDF from 'jspdf'
import QRCode from 'qrcode'
import { loadSarabunFont } from './fonts/sarabun-font'
import fs from 'fs'
import path from 'path'

// 4x6 inch label dimensions in mm
const LABEL_WIDTH_MM = 101.6  // 4 inches
const LABEL_HEIGHT_MM = 152.4 // 6 inches

// A4 dimensions in mm
const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297

// Safe margins in mm
const MARGIN_MM = 6

// QR code size in mm (for individual labels)
const QR_SIZE_MM = 60

// Grid layout settings
const GRID_COLUMNS = 8
const GRID_MARGIN_MM = 5
const GRID_GAP_MM = 2

// Banner image cache
let bannerImageBase64: string | null = null

/**
 * Load the banner image as base64 from public folder
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

interface LabelData {
  serialNumber: string
  qrCodeUrl: string
  productName?: string
  sku?: string
  lot?: string
  mfgDate?: string
  expDate?: string
}

/**
 * Generate a PDF with 4x6 inch labels for QR codes
 * Each page contains one serial with its QR code
 */
export async function generateLabelPDF(labels: LabelData[]): Promise<Buffer> {
  // Create PDF with custom page size (4x6 inches in mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [LABEL_WIDTH_MM, LABEL_HEIGHT_MM],
  })

  // Use helvetica for now - custom Thai fonts have issues with jsPDF 4.x
  // TODO: Fix Thai font support with proper font embedding
  const fontFamily = 'helvetica'

  // Try to load Thai font (may fail silently in jsPDF 4.x)
  try {
    loadSarabunFont(doc)
  } catch {
    // Ignore font loading errors, use helvetica fallback
  }

  // Load banner image
  const bannerImage = loadBannerImage()

  // Banner dimensions for 4x6 label (aspect ratio ~3.5:1)
  const bannerWidth = LABEL_WIDTH_MM - (MARGIN_MM * 2)
  const bannerHeight = bannerImage ? bannerWidth * 0.28 : 0

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i]

    if (i > 0) {
      doc.addPage([LABEL_WIDTH_MM, LABEL_HEIGHT_MM], 'portrait')
    }

    // Generate QR code as data URL
    // Using 'M' error correction (15% recovery) - good balance between reliability and scan-ability
    // 'H' (30%) makes QR too dense and hard to scan with phone cameras
    const qrDataUrl = await QRCode.toDataURL(label.qrCodeUrl, {
      width: 400,
      margin: 1,  // Minimal margin - the physical label provides enough border
      errorCorrectionLevel: 'M', // Medium - easier to scan than 'H'
    })

    const centerX = LABEL_WIDTH_MM / 2

    // Calculate positions
    let yPos = MARGIN_MM

    // Draw banner image on top if available
    if (bannerImage) {
      doc.addImage(bannerImage, 'JPEG', MARGIN_MM, yPos, bannerWidth, bannerHeight)
      yPos += bannerHeight + 4
    } else {
      // Fallback: Company/Brand Header (text only)
      yPos += 10
      doc.setFontSize(14)
      doc.setFont(fontFamily, 'bold')
      doc.text('QR Authenticity', centerX, yPos, { align: 'center' })
      yPos += 8
    }

    // QR Code - centered
    const qrX = (LABEL_WIDTH_MM - QR_SIZE_MM) / 2
    doc.addImage(qrDataUrl, 'PNG', qrX, yPos, QR_SIZE_MM, QR_SIZE_MM)
    yPos += QR_SIZE_MM + 8

    // Serial Number (prominent)
    doc.setFontSize(18)
    doc.setFont(fontFamily, 'bold')
    doc.text(formatSerial(label.serialNumber), centerX, yPos, { align: 'center' })
    yPos += 8

    // Scan instruction
    doc.setFontSize(9)
    doc.setFont(fontFamily, 'normal')
    doc.text('Scan QR to verify authenticity', centerX, yPos, { align: 'center' })
    yPos += 6

    // Product info section (smaller text)
    if (label.productName || label.sku || label.lot || label.expDate) {
      yPos += 4

      doc.setFontSize(8)
      doc.setFont(fontFamily, 'normal')

      if (label.sku) {
        doc.text(`SKU: ${label.sku}`, MARGIN_MM, yPos)
        yPos += 4
      }

      // Lot and Exp on same line if both present
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

    // Footer note
    doc.setFontSize(7)
    doc.setTextColor(128, 128, 128)
    doc.setFont(fontFamily, 'normal')
    doc.text('Print at actual size (100%)', centerX, LABEL_HEIGHT_MM - MARGIN_MM, { align: 'center' })
    doc.setTextColor(0, 0, 0)
  }

  // Return as Buffer
  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}

/**
 * Format serial number with dashes for readability
 * 123456789012 -> 1234-5678-9012
 */
function formatSerial(serial: string): string {
  const cleaned = serial.replace(/\D/g, '')
  if (cleaned.length !== 12) return serial

  return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}`
}

/**
 * Generate a single label PDF for one product
 */
export async function generateSingleLabelPDF(label: LabelData): Promise<Buffer> {
  return generateLabelPDF([label])
}

/**
 * Generate a PDF with QR codes in a grid layout on A4 paper
 * 8 columns, multiple rows per page
 * Each cell includes: banner image on top, QR code, and serial number
 */
export async function generateGridLabelPDF(labels: LabelData[]): Promise<Buffer> {
  // Create PDF with A4 page size
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const fontFamily = 'helvetica'

  // Try to load Thai font
  try {
    loadSarabunFont(doc)
  } catch {
    // Ignore font loading errors
  }

  // Load banner image
  const bannerImage = loadBannerImage()

  // Calculate cell dimensions
  const usableWidth = A4_WIDTH_MM - (GRID_MARGIN_MM * 2)
  const cellWidth = (usableWidth - (GRID_GAP_MM * (GRID_COLUMNS - 1))) / GRID_COLUMNS

  // Banner dimensions (aspect ratio ~3.5:1 based on the original image)
  const bannerHeight = bannerImage ? cellWidth * 0.28 : 0

  // QR size adjusted to fit with banner
  const qrSize = cellWidth - 2 // Slightly smaller than cell for padding
  const cellHeight = bannerHeight + qrSize + 8 // Banner + QR + space for serial number

  // Calculate rows per page
  const usableHeight = A4_HEIGHT_MM - (GRID_MARGIN_MM * 2)
  const rowsPerPage = Math.floor((usableHeight + GRID_GAP_MM) / (cellHeight + GRID_GAP_MM))
  const itemsPerPage = GRID_COLUMNS * rowsPerPage

  // Generate all QR codes first
  // Using 'M' error correction - easier to scan than 'H'
  const qrDataUrls: string[] = []
  for (const label of labels) {
    const qrDataUrl = await QRCode.toDataURL(label.qrCodeUrl, {
      width: 250,
      margin: 1,  // Minimal margin for grid layout
      errorCorrectionLevel: 'M', // Medium - better scan-ability
    })
    qrDataUrls.push(qrDataUrl)
  }

  // Draw labels
  for (let i = 0; i < labels.length; i++) {
    const pageIndex = Math.floor(i / itemsPerPage)
    const indexOnPage = i % itemsPerPage

    // Add new page if needed
    if (i > 0 && indexOnPage === 0) {
      doc.addPage('a4', 'portrait')
    }

    // Calculate position
    const col = indexOnPage % GRID_COLUMNS
    const row = Math.floor(indexOnPage / GRID_COLUMNS)

    const x = GRID_MARGIN_MM + col * (cellWidth + GRID_GAP_MM)
    const y = GRID_MARGIN_MM + row * (cellHeight + GRID_GAP_MM)

    // Draw cell border (light gray, dashed for cutting guide)
    doc.setDrawColor(200, 200, 200)
    doc.setLineDashPattern([1, 1], 0)
    doc.rect(x, y, cellWidth, cellHeight)
    doc.setLineDashPattern([], 0)

    let currentY = y

    // Draw banner image on top if available
    if (bannerImage) {
      doc.addImage(bannerImage, 'JPEG', x, currentY, cellWidth, bannerHeight)
      currentY += bannerHeight
    }

    // Draw QR code - centered in cell, below banner
    const qrX = x + (cellWidth - qrSize) / 2
    doc.addImage(qrDataUrls[i], 'PNG', qrX, currentY, qrSize, qrSize)
    currentY += qrSize

    // Draw serial number below QR
    doc.setFontSize(5)
    doc.setFont(fontFamily, 'bold')
    doc.setTextColor(0, 0, 0)

    // Format serial: full 12 digits
    const serial = labels[i].serialNumber
    const formattedSerial = serial.length === 12
      ? serial
      : serial.padStart(12, '0')

    doc.text(formattedSerial, x + cellWidth / 2, currentY + 4, { align: 'center' })
  }

  // Add page info in footer
  const totalPages = Math.ceil(labels.length / itemsPerPage)
  for (let p = 0; p < totalPages; p++) {
    doc.setPage(p + 1)
    doc.setFontSize(6)
    doc.setFont(fontFamily, 'normal')
    doc.setTextColor(150, 150, 150)

    const startItem = p * itemsPerPage + 1
    const endItem = Math.min((p + 1) * itemsPerPage, labels.length)
    doc.text(
      `Page ${p + 1}/${totalPages} | Items ${startItem}-${endItem} of ${labels.length}`,
      A4_WIDTH_MM / 2,
      A4_HEIGHT_MM - 3,
      { align: 'center' }
    )
  }

  // Return as Buffer
  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}
