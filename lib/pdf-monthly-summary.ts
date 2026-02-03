import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadSarabunFont } from './fonts/sarabun-font';
import { MonthlySummary } from './analytics-queries';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: { finalY: number };
  }
}

interface MonthlySummaryPDFOptions {
  startMonth: string;
  endMonth: string;
  locale: string;
}

/**
 * Format month for display
 */
function formatMonth(month: string, locale: string): string {
  const date = new Date(`${month}-01`);
  if (locale === 'th') {
    return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' });
  }
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

/**
 * Format month for Thai display (separate function for consistency)
 */
function formatMonthThai(month: string): string {
  const date = new Date(`${month}-01`);
  return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' });
}

/**
 * Generate Monthly Summary PDF Report
 */
export async function generateMonthlySummaryPDF(
  summaries: MonthlySummary[],
  options: MonthlySummaryPDFOptions
): Promise<Buffer> {
  try {
    console.log('Starting Monthly Summary PDF generation');

    const doc = new jsPDF({
      orientation: 'landscape', // Wide format for table
      unit: 'mm',
      format: 'a4',
    });

    // Load Thai font
    let fontLoaded = false;
    try {
      fontLoaded = loadSarabunFont(doc);
      console.log('Font loaded:', fontLoaded);
    } catch (fontError) {
      console.warn('Font loading failed, using fallback:', fontError);
    }
    const font = fontLoaded ? 'NotoSansThai' : 'helvetica';

    console.log('Using font:', font);

    // Add header
    doc.setFontSize(18);
    doc.setFont(font, 'bold');
    const title = options.locale === 'th'
      ? 'รายงานสรุปยอดประจำเดือน'
      : 'Monthly Summary Report';
    doc.text(title, 148.5, 15, { align: 'center' });

    // Add period
    doc.setFontSize(12);
    doc.setFont(font, 'normal');
    const period = options.locale === 'th'
      ? `ช่วงเวลา: ${formatMonthThai(options.startMonth)} - ${formatMonthThai(options.endMonth)}`
      : `Period: ${options.startMonth} to ${options.endMonth}`;
    doc.text(period, 148.5, 22, { align: 'center' });

    // Add generation date
    const genDate = options.locale === 'th'
      ? `สร้างเมื่อ: ${new Date().toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}`
      : `Generated: ${new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}`;
    doc.setFontSize(10);
    doc.text(genDate, 148.5, 28, { align: 'center' });

    // Prepare table data
    const headers = options.locale === 'th'
      ? [
          'เดือน',
          'รับเข้า\n(GRN)',
          'สินค้า\nรับเข้า',
          'ใบ PO',
          'ส่งออก',
          'สินค้า\nส่งออก',
          'เปิด\nใช้งาน',
          'เสียหาย',
          'คืนสินค้า'
        ]
      : [
          'Month',
          'GRN\nCount',
          'Items\nReceived',
          'PO\nCount',
          'Deliveries',
          'Items\nShipped',
          'Activated',
          'Damaged',
          'Returned'
        ];

    const rows = summaries.map(s => [
      formatMonth(s.month, options.locale),
      s.grnCount.toString(),
      s.itemsReceived.toString(),
      s.poCount.toString(),
      s.deliveriesCount.toString(),
      s.itemsShipped.toString(),
      s.activationsCount.toString(),
      s.damagedCount.toString(),
      s.returnedCount.toString(),
    ]);

    // Calculate totals
    const totals = summaries.reduce((acc, curr) => ({
      grnCount: acc.grnCount + curr.grnCount,
      itemsReceived: acc.itemsReceived + curr.itemsReceived,
      poCount: acc.poCount + curr.poCount,
      deliveriesCount: acc.deliveriesCount + curr.deliveriesCount,
      itemsShipped: acc.itemsShipped + curr.itemsShipped,
      activationsCount: acc.activationsCount + curr.activationsCount,
      damagedCount: acc.damagedCount + curr.damagedCount,
      returnedCount: acc.returnedCount + curr.returnedCount,
    }), {
      grnCount: 0,
      itemsReceived: 0,
      poCount: 0,
      deliveriesCount: 0,
      itemsShipped: 0,
      activationsCount: 0,
      damagedCount: 0,
      returnedCount: 0,
    });

    // Add totals row
    rows.push([
      options.locale === 'th' ? 'รวมทั้งหมด' : 'Total',
      totals.grnCount.toString(),
      totals.itemsReceived.toString(),
      totals.poCount.toString(),
      totals.deliveriesCount.toString(),
      totals.itemsShipped.toString(),
      totals.activationsCount.toString(),
      totals.damagedCount.toString(),
      totals.returnedCount.toString(),
    ]);

    // Generate table with autoTable
    autoTable(doc, {
      startY: 35,
      head: [headers],
      body: rows,
      theme: 'grid',
      styles: {
        font: font,
        fontSize: 9,
        cellPadding: 3,
        halign: 'center',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [201, 163, 90], // Gold color (#C9A35A)
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 35 }, // Month column left-aligned and wider
      },
      // Highlight totals row
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.row.index === rows.length - 1) {
          data.cell.styles.fillColor = [240, 240, 240];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    // Add footer
    const pageCount = doc.internal.pages.length - 1; // Subtract 1 for the blank first page
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont(font, 'normal');
      doc.text(
        `${options.locale === 'th' ? 'หน้า' : 'Page'} ${i} / ${pageCount}`,
        148.5,
        205,
        { align: 'center' }
      );
    }

    // Return as buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    console.log('Monthly Summary PDF generated successfully');
    return pdfBuffer;
  } catch (error) {
    console.error('Error generating Monthly Summary PDF:', error);
    throw error;
  }
}
