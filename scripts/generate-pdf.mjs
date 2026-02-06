import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generatePDF() {
    console.log('Starting PDF generation...');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Read HTML file
    const htmlPath = join(__dirname, '..', 'docs', 'New-Version', '06_TESTING_GUIDE.html');
    const htmlContent = readFileSync(htmlPath, 'utf-8');

    // Set content
    await page.setContent(htmlContent, {
        waitUntil: 'networkidle0'
    });

    // Wait for fonts to load
    await page.evaluateHandle('document.fonts.ready');

    // Generate PDF
    const pdfPath = join(__dirname, '..', 'docs', 'New-Version', '06_TESTING_GUIDE.pdf');
    await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: {
            top: '15mm',
            right: '15mm',
            bottom: '15mm',
            left: '15mm'
        },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
            <div style="font-size: 10px; width: 100%; text-align: center; color: #666;">
                <span class="pageNumber"></span> / <span class="totalPages"></span>
            </div>
        `
    });

    console.log(`PDF generated successfully: ${pdfPath}`);

    await browser.close();
}

generatePDF().catch(console.error);
