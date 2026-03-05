import * as XLSX from 'xlsx'

interface SheetData {
  name: string
  headers: string[]
  rows: (string | number | null | undefined)[][]
}

export function generateExcelBuffer(sheets: SheetData[]): ArrayBuffer {
  const wb = XLSX.utils.book_new()

  for (const sheet of sheets) {
    const data = [sheet.headers, ...sheet.rows]
    const ws = XLSX.utils.aoa_to_sheet(data)

    // Auto-width columns
    const colWidths = sheet.headers.map((h, i) => {
      const maxLen = Math.max(
        h.length,
        ...sheet.rows.map(r => String(r[i] ?? '').length)
      )
      return { wch: Math.min(maxLen + 2, 50) }
    })
    ws['!cols'] = colWidths

    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31))
  }

  const arr: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return arr
}
