import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { loadSarabunFont } from './fonts/sarabun-font'

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: { finalY: number }
  }
}

interface DeliveryNoteLine {
  id: number
  sku: string
  itemName: string
  modelSize: string | null
  quantity: number
  lot: string | null
  expDate: string | null
  serial12: string
  unit: string | null
}

interface DeliveryNoteData {
  deliveryNoteNo: string
  customerName: string
  customerAddress: string
  customerPhone: string
  customerContact: string
  shippedDate: string
  contractNo: string | null
  poNo: string | null
  shippingMethod: string | null
  deliveryBy: string | null
  stockPreparedBy: string | null
  lines: DeliveryNoteLine[]
  remarks: string | null
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
 * Generate delivery note PDF matching the reference format
 */
export async function generateDeliveryNotePDF(data: DeliveryNoteData): Promise<Buffer> {
  try {
    console.log('Starting PDF generation for delivery note:', data.deliveryNoteNo)

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
  doc.setFontSize(20)
  doc.text('ใบส่งสินค้า', 105, 20, { align: 'center' })

  doc.setFont(font, 'normal')
  doc.setFontSize(10)
  doc.text('ผู้ส่งสินค้า : บริษัท อีเดนคัลเลอร์ (ประเทศไทย) จำกัด', 15, 30)

  // === CUSTOMER INFO SECTION ===
  const startY = 40

  // Left column
  doc.setFontSize(10)
  doc.text(`ลูกค้า`, 15, startY)
  doc.line(35, startY, 100, startY) // Underline
  doc.text(data.customerName, 36, startY)

  // Right column
  doc.text(`ที่อยู่`, 110, startY)
  doc.line(125, startY, 195, startY)
  doc.text(data.customerAddress || '', 126, startY)

  // Second row
  const row2Y = startY + 8
  doc.text(`โทรศัพท์/ชื่อผู้ติดต่อ`, 15, row2Y)
  doc.line(55, row2Y, 100, row2Y)
  doc.text(`${data.customerPhone || ''} / ${data.customerContact || ''}`, 56, row2Y)

  doc.text(`IV No.`, 110, row2Y)
  doc.line(125, row2Y, 160, row2Y)
  doc.text(data.deliveryNoteNo, 126, row2Y)

  doc.text(`ส่งของวันที่`, 165, row2Y)
  doc.line(185, row2Y, 195, row2Y)
  doc.text(formatDate(data.shippedDate), 186, row2Y)

  // Third row
  const row3Y = row2Y + 8
  doc.text(`Contract No.`, 15, row3Y)
  doc.line(45, row3Y, 100, row3Y)
  if (data.contractNo) {
    doc.text(data.contractNo, 46, row3Y)
  }

  // PO No if available
  if (data.poNo) {
    doc.text(`PO No.`, 110, row3Y)
    doc.line(130, row3Y, 195, row3Y)
    doc.text(data.poNo, 131, row3Y)
  }

  // === ITEMS TABLE ===
  const tableStartY = row3Y + 10

  const tableData = data.lines.map((line, index) => [
    (index + 1).toString(),
    line.itemName + (line.modelSize ? ` (${line.modelSize})` : ''),
    line.lot || '',
    line.expDate ? formatDate(line.expDate) : '',
    line.serial12,
    line.quantity.toString(),
    line.unit || '',
    data.remarks || '',
  ])

  autoTable(doc, {
    startY: tableStartY,
    head: [['ลำดับ', 'รายการ', 'LOT.', 'EXP.', 'Number', 'จำนวน', 'หน่วย', 'หมายเหตุ']],
    body: tableData,
    foot: [['', '**ทางบริษัทไม่รับเปลี่ยน/คืน สินค้าทุกกรณี**', '', '', '', '', '', '']],
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
    footStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineWidth: 0.5,
      lineColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
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
  const finalY = (doc as any).lastAutoTable.finalY + 10

  // === INSPECTION INSTRUCTIONS ===
  doc.setFontSize(8)
  doc.setFont(font, 'bold')
  doc.text('การตรวจเช็คสินค้า', 15, finalY)

  doc.setFont(font, 'normal')
  let instructionY = finalY + 5
  const instructions = [
    '- ในกรณีมีแมสฯ ไปส่ง Grab Bike / Lalamove ให้ถ่ายรูปสินค้าที่ได้รับทั้งหมด พร้อมกับแมสฯ ที่ไปส่งว่าได้สินค้าครบหรือไม่',
    '- กรณีได้รับสินค้าเป็นพัสดุ Kerry / EMS จะต้องบันทึก VDO ขณะที่ทำการเปิดกล่อง และเช็คจำนวนสินค้าว่ามีครบตาม',
    '  ที่ใบส่งสินค้าชั่วคราวระบุไว้หรือไม่',
  ]

  instructions.forEach((text) => {
    doc.text(text, 15, instructionY)
    instructionY += 4
  })

  instructionY += 2
  doc.setFont(font, 'bold')
  doc.text('***หากได้รับสินค้าครบถ้วนสมบูรณ์กรุณาเซ็นรับสินค้าลงในใบส่งสินค้าชั่วคราวฉบับนี้', 15, instructionY)
  instructionY += 4
  doc.text('แล้วถ่ายรูป / สแกน ส่งเอกสารกลับมาที่ผู้แทนที่ดูแล หรือส่งที่ Admin ของบริษัทฯ***', 15, instructionY)

  instructionY += 5
  doc.setFont(font, 'normal')
  doc.text('*** หากลูกค้าได้รับสินค้าแล้ว ไม่มีการแจ้งกลับมาที่บริษัทฯ ภายใน 7 วัน ทางบริษัทฯ จะถือว่า', 15, instructionY)
  instructionY += 4
  doc.text('ลูกค้าได้รับสินค้าครบตามจำนวน ในใบส่งสินค้าชั่วคราวที่บริษัทฯ ได้แนบไปให้***', 15, instructionY)

  // === CONTACT INFO ===
  instructionY += 6
  doc.setFontSize(7)
  doc.setFont(font, 'bold')
  doc.text('Admin E-mail : cs@edencolorsthailand.com / Line ID : araclar_arapeel / TEL. 02-1250142 061-4659629', 105, instructionY, { align: 'center' })

  // === SIGNATURE SECTION ===
  const sigY = instructionY + 10

  // Shipping info
  doc.setFontSize(9)
  doc.text(`ส่งโดย`, 15, sigY)
  doc.line(35, sigY, 85, sigY)
  if (data.deliveryBy) {
    doc.text(data.deliveryBy, 36, sigY)
  }

  doc.text(`วันที่`, 90, sigY)
  doc.line(105, sigY, 140, sigY)
  doc.text(formatDate(data.shippedDate), 106, sigY)

  const sig2Y = sigY + 6
  doc.text(`ผู้จัดสต็อกส่ง`, 15, sig2Y)
  doc.line(40, sig2Y, 85, sig2Y)
  if (data.stockPreparedBy) {
    doc.text(data.stockPreparedBy, 41, sig2Y)
  }

  doc.text(`วันที่`, 90, sig2Y)
  doc.line(105, sig2Y, 140, sig2Y)
  doc.text(formatDate(data.shippedDate), 106, sig2Y)

  // Received signature
  const sig3Y = sig2Y + 10
  doc.text(`ได้รับสินค้าครบถ้วน  ลงชื่อตัวบรรจง`, 15, sig3Y)
  doc.line(70, sig3Y, 120, sig3Y)
  doc.text(`ผู้รับสินค้า`, 160, sig3Y)

  const sig4Y = sig3Y + 6
  doc.text(`วันที่`, 90, sig4Y)
  doc.line(105, sig4Y, 140, sig4Y)

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
    throw new Error(`Failed to generate delivery note PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
