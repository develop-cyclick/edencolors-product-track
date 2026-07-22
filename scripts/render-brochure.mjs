import puppeteer from 'puppeteer'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  const htmlPath = join(__dirname, '..', 'docs', 'brochure', 'brochure.html')
  const outPath = join(__dirname, '..', 'docs', 'brochure', 'EdenColors-QR-System-Brochure.pdf')

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()

  // Navigate via file:// so relative image paths resolve
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0', timeout: 120000 })
  await page.evaluateHandle('document.fonts.ready')
  // Ensure all images are fully decoded before printing
  await page.evaluate(async () => {
    await Promise.all(
      Array.from(document.images).map((img) =>
        img.complete ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r })
      )
    )
  })

  await page.pdf({
    path: outPath,
    printBackground: true,
    preferCSSPageSize: true,
  })

  await browser.close()
  console.log(`PDF written to ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
