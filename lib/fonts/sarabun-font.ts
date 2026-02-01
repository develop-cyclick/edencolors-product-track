import { jsPDF } from 'jspdf'
import * as fs from 'fs'
import * as path from 'path'

// Cache for font data to avoid re-reading files
let regularFontBase64: string | null = null
let boldFontBase64: string | null = null
let fontLoadAttempted = false
let fontLoadSuccess = false

/**
 * Load and register Noto Sans Thai font with jsPDF
 * Uses Noto Sans Thai which has full Thai character support
 */
export function loadSarabunFont(doc: jsPDF): boolean {
  // If we already tried and failed, use fallback immediately
  if (fontLoadAttempted && !fontLoadSuccess) {
    console.log('Using fallback font (helvetica) - Thai font previously failed to load')
    doc.setFont('helvetica', 'normal')
    return false
  }

  try {
    // Get font paths - use Noto Sans Thai for full Thai support
    const fontsDir = path.join(process.cwd(), 'lib', 'fonts')
    const regularFontPath = path.join(fontsDir, 'NotoSansThai-Regular.ttf')
    const boldFontPath = path.join(fontsDir, 'NotoSansThai-Bold.ttf')

    // Check if files exist
    if (!fs.existsSync(regularFontPath)) {
      console.error('Font file not found:', regularFontPath)
      throw new Error(`Font file not found: ${regularFontPath}`)
    }
    if (!fs.existsSync(boldFontPath)) {
      console.error('Font file not found:', boldFontPath)
      throw new Error(`Font file not found: ${boldFontPath}`)
    }

    // Read font files and convert to base64 (cache for performance)
    if (!regularFontBase64) {
      regularFontBase64 = fs.readFileSync(regularFontPath).toString('base64')
      console.log('Loaded NotoSansThai-Regular.ttf, size:', regularFontBase64.length)
    }
    if (!boldFontBase64) {
      boldFontBase64 = fs.readFileSync(boldFontPath).toString('base64')
      console.log('Loaded NotoSansThai-Bold.ttf, size:', boldFontBase64.length)
    }

    // Add fonts to jsPDF's virtual file system
    doc.addFileToVFS('NotoSansThai-Regular.ttf', regularFontBase64)
    doc.addFileToVFS('NotoSansThai-Bold.ttf', boldFontBase64)

    // Register fonts with family name 'NotoSansThai'
    doc.addFont('NotoSansThai-Regular.ttf', 'NotoSansThai', 'normal')
    doc.addFont('NotoSansThai-Bold.ttf', 'NotoSansThai', 'bold')

    // Set default font
    doc.setFont('NotoSansThai', 'normal')

    fontLoadAttempted = true
    fontLoadSuccess = true
    console.log('Thai font (NotoSansThai) loaded successfully')
    return true
  } catch (error) {
    console.error('Failed to load Thai font:', error)
    fontLoadAttempted = true
    fontLoadSuccess = false

    // Fall back to helvetica if font loading fails
    doc.setFont('helvetica', 'normal')
    return false
  }
}

/**
 * Check if text contains Thai characters
 */
export function containsThai(text: string): boolean {
  // Thai Unicode range: \u0E00-\u0E7F
  return /[\u0E00-\u0E7F]/.test(text)
}
