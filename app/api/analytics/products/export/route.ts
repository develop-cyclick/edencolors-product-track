import { NextRequest, NextResponse } from 'next/server'
import { withAnalytics } from '@/lib/api-middleware'
import { errors } from '@/lib/api-response'
import { getProductStats, getCategoryStats } from '@/lib/analytics-queries'
import { generateExcelBuffer } from '@/lib/excel-export'

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const locale = body.locale || 'th'
    const th = locale === 'th'
    const categoryId = body.categoryId || undefined
    const activationType = body.activationType || undefined

    const [products, categories] = await Promise.all([
      getProductStats(),
      getCategoryStats(),
    ])

    // Filter products (same logic as GET route)
    let filteredProducts = products

    if (categoryId) {
      const categoryIdNum = parseInt(categoryId)
      if (!isNaN(categoryIdNum)) {
        filteredProducts = products.filter(
          (p) => p.categoryNameTh === categories.find((c) => c.categoryId === categoryIdNum)?.categoryNameTh
        )
      }
    }

    if (activationType) {
      filteredProducts = filteredProducts.filter(
        (p) => p.activationType === activationType
      )
    }

    const sheets = [
      {
        name: th ? 'สินค้า' : 'Products',
        headers: [
          'SKU',
          th ? 'ชื่อสินค้า' : 'Product Name',
          th ? 'หมวดหมู่' : 'Category',
          th ? 'ประเภท' : 'Type',
          th ? 'จำนวนเปิดใช้สูงสุด' : 'Max Activations',
          th ? 'ส่งออก' : 'Shipped',
          th ? 'เปิดใช้งาน' : 'Activated',
          th ? 'อัตรา (%)' : 'Rate (%)',
        ],
        rows: filteredProducts.map((p) => [
          p.sku,
          p.nameTh,
          p.categoryNameTh,
          p.activationType,
          p.maxActivations,
          p.totalShipped,
          p.totalActivated,
          p.activationRate,
        ]),
      },
      {
        name: th ? 'หมวดหมู่' : 'Categories',
        headers: [
          th ? 'หมวดหมู่' : 'Category',
          th ? 'ส่งออก' : 'Shipped',
          th ? 'เปิดใช้งาน' : 'Activated',
          th ? 'อัตรา (%)' : 'Rate (%)',
        ],
        rows: categories.map((c) => [
          th ? c.categoryNameTh : (c.categoryNameEn || c.categoryNameTh),
          c.totalShipped,
          c.totalActivated,
          c.activationRate,
        ]),
      },
    ]

    const buffer = generateExcelBuffer(sheets)
    const filename = `analytics-products-${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Products export error:', error)
    return errors.internalError()
  }
}

export const POST = withAnalytics(handlePOST)
