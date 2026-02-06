import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { loadSarabunFont } from './fonts/sarabun-font'

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: { finalY: number }
  }
}

interface BorrowTransactionLine {
  id: number
  sku: string
  itemName: string
  modelSize: string | null
  quantity: number
  lot: string | null
  expDate: string | null
  serial12: string
  unit: string | null
  remarks: string | null
}

interface BorrowTransactionData {
  transactionNo: string
  type: 'BORROW' | 'RETURN'
  borrowerName: string
  clinicName: string | null
  clinicAddress: string | null
  taxInvoiceRef: string | null
  reason: string | null
  remarks: string | null
  createdAt: string
  approvedAt: string | null
  approvedBy: string | null
  lines: BorrowTransactionLine[]
}

/**
 * Format date to DD/MM/YYYY format
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Generate borrow/return transaction PDF matching the reference format
 */
export async function generateBorrowTransactionPDF(data: BorrowTransactionData): Promise<Buffer> {
  try {
    console.log('Starting PDF generation for borrow transaction:', data.transactionNo)

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    // Load Thai font
    let fontLoaded = false
    try {
      fontLoaded = loadSarabunFont(doc)
      console.log('Font loaded:', fontLoaded)
    } catch (fontError) {
      console.warn('Font loading failed, using fallback:', fontError)
    }
    const font = fontLoaded ? 'NotoSansThai' : 'helvetica'

    console.log('Using font:', font)

    // === HEADER ===
    doc.setFont(font, 'bold')
    doc.setFontSize(18)
    doc.text('ใบรับคืน / ยืมสินค้า / คืนสินค้า', 105, 20, { align: 'center' })

    // === TYPE CHECKBOXES ===
    const checkY = 30
    doc.setFont(font, 'normal')
    doc.setFontSize(10)

    // Draw checkboxes
    const drawCheckbox = (x: number, y: number, checked: boolean, label: string) => {
      doc.rect(x, y - 3, 4, 4)
      if (checked) {
        doc.setFont(font, 'bold')
        doc.text('X', x + 0.8, y)
        doc.setFont(font, 'normal')
      }
      doc.text(label, x + 6, y)
    }

    drawCheckbox(50, checkY, false, 'รับคืน')
    drawCheckbox(85, checkY, data.type === 'BORROW', 'ยืมสินค้า')
    drawCheckbox(130, checkY, data.type === 'RETURN', 'คืนสินค้า')

    // === FORM FIELDS ===
    const startY = 42
    const labelWidth = 35
    const lineWidth = 70

    // Row 1: Borrower name & Document No
    doc.text('ชื่อผู้ยืม/คืน', 15, startY)
    doc.line(15 + labelWidth, startY, 15 + labelWidth + lineWidth, startY)
    doc.text(data.borrowerName || '', 15 + labelWidth + 2, startY)

    doc.text('เลขที่เอกสาร', 130, startY)
    doc.line(155, startY, 195, startY)
    doc.text(data.transactionNo, 156, startY)

    // Row 2: Clinic name & Date
    const row2Y = startY + 10
    doc.text('ชื่อคลินิก', 15, row2Y)
    doc.line(15 + labelWidth, row2Y, 15 + labelWidth + lineWidth, row2Y)
    doc.text(data.clinicName || '', 15 + labelWidth + 2, row2Y)

    doc.text('วันที่', 130, row2Y)
    doc.line(155, row2Y, 195, row2Y)
    doc.text(formatDate(data.createdAt), 156, row2Y)

    // Row 3: Address
    const row3Y = row2Y + 10
    doc.text('ที่อยู่', 15, row3Y)
    doc.line(15 + labelWidth, row3Y, 195, row3Y)
    doc.text(data.clinicAddress || '', 15 + labelWidth + 2, row3Y)

    // Row 4: Tax invoice ref
    const row4Y = row3Y + 10
    doc.text('เลขที่ใบกำกับภาษี', 15, row4Y)
    doc.line(15 + 40, row4Y, 100, row4Y)
    doc.text(data.taxInvoiceRef || '', 15 + 42, row4Y)

    // Row 5: Reason
    const row5Y = row4Y + 10
    doc.text('สาเหตุการยืม/คืน', 15, row5Y)
    doc.line(15 + 40, row5Y, 195, row5Y)
    doc.text(data.reason || '', 15 + 42, row5Y)

    // === ITEMS TABLE ===
    const tableStartY = row5Y + 10

    const tableData = data.lines.map((line, index) => [
      (index + 1).toString(),
      line.itemName + (line.modelSize ? ` (${line.modelSize})` : ''),
      line.lot || '',
      line.expDate ? formatDate(line.expDate) : '',
      line.serial12,
      line.quantity.toString(),
      line.unit || '',
      line.remarks || '',
    ])

    autoTable(doc, {
      startY: tableStartY,
      head: [['ลำดับ', 'รายการ', 'LOT.', 'EXP.', 'Number', 'จำนวน', 'หน่วย', 'หมายเหตุ']],
      body: tableData,
      theme: 'grid',
      styles: {
        font: font,
        fontSize: 9,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineWidth: 0.5,
        lineColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: {
        lineWidth: 0.5,
        lineColor: [0, 0, 0],
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },  // ลำดับ
        1: { halign: 'left', cellWidth: 40 },    // รายการ
        2: { halign: 'center', cellWidth: 18 },  // LOT
        3: { halign: 'center', cellWidth: 18 },  // EXP
        4: { halign: 'center', cellWidth: 40, fontSize: 7 },  // Number (19-char serial)
        5: { halign: 'center', cellWidth: 15 },  // จำนวน
        6: { halign: 'center', cellWidth: 15 },  // หน่วย
        7: { halign: 'left', cellWidth: 23 },    // หมายเหตุ
      },
    })

    // Get final Y position after table
    const finalY = (doc as any).lastAutoTable.finalY + 15

    // === SIGNATURE SECTION ===
    // Re-set font after autoTable (autoTable may reset the font)
    doc.setFont(font, 'normal')
    doc.setFontSize(9)

    // Signature row 1: ผู้คืน/ยืมสินค้า and ผู้อนุมัติ (1)
    const sigRow1Y = finalY
    doc.text('ผู้คืน/ยืมสินค้า', 15, sigRow1Y)
    doc.line(40, sigRow1Y, 80, sigRow1Y)

    doc.text('ผู้อนุมัติ', 100, sigRow1Y)
    doc.line(120, sigRow1Y, 160, sigRow1Y)
    if (data.approvedBy) {
      doc.text(data.approvedBy, 121, sigRow1Y)
    }

    // Signature row 2: Date lines
    const sigRow2Y = sigRow1Y + 6
    doc.text('วันที่', 15, sigRow2Y)
    doc.line(30, sigRow2Y, 80, sigRow2Y)
    doc.text(formatDate(data.createdAt), 31, sigRow2Y)

    doc.text('วันที่', 100, sigRow2Y)
    doc.line(115, sigRow2Y, 160, sigRow2Y)
    if (data.approvedAt) {
      doc.text(formatDate(data.approvedAt), 116, sigRow2Y)
    }

    // Signature row 3: ผู้อนุมัติ (2)
    const sigRow3Y = sigRow2Y + 10
    doc.text('ผู้อนุมัติ', 15, sigRow3Y)
    doc.line(40, sigRow3Y, 80, sigRow3Y)

    doc.text('วันที่', 100, sigRow3Y)
    doc.line(115, sigRow3Y, 160, sigRow3Y)

    // Signature row 4: ผู้รับสินค้า (ผู้แทน)
    const sigRow4Y = sigRow3Y + 10
    doc.text('ผู้รับสินค้า (ผู้แทน)', 15, sigRow4Y)
    doc.line(50, sigRow4Y, 90, sigRow4Y)

    doc.text('วันที่', 100, sigRow4Y)
    doc.line(115, sigRow4Y, 160, sigRow4Y)

    // Signature row 5: ผู้รับสินค้า (ลูกค้า)
    const sigRow5Y = sigRow4Y + 10
    doc.text('ผู้รับสินค้า (ลูกค้า)', 15, sigRow5Y)
    doc.line(50, sigRow5Y, 90, sigRow5Y)

    doc.text('วันที่', 100, sigRow5Y)
    doc.line(115, sigRow5Y, 160, sigRow5Y)

    // Signature row 6: ผู้รับสินค้า (Stock)
    const sigRow6Y = sigRow5Y + 10
    doc.text('ผู้รับสินค้า (Stock)', 15, sigRow6Y)
    doc.line(50, sigRow6Y, 90, sigRow6Y)

    doc.text('วันที่', 100, sigRow6Y)
    doc.line(115, sigRow6Y, 160, sigRow6Y)

    // === REMARKS ===
    if (data.remarks) {
      const remarksY = sigRow6Y + 15
      doc.setFont(font, 'normal')
      doc.setFontSize(8)
      doc.text(`หมายเหตุ: ${data.remarks}`, 15, remarksY)
    }

    console.log('PDF generation completed, converting to buffer')
    const output = doc.output('arraybuffer')
    console.log('Buffer size:', output.byteLength)
    return Buffer.from(output)
  } catch (error) {
    console.error('PDF generation error:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    throw new Error(`Failed to generate borrow transaction PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
