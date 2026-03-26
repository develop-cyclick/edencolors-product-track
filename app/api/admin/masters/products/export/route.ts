import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withWarehouse } from '@/lib/api-middleware'
import { generateExcelBuffer } from '@/lib/excel-export'

// GET /api/admin/masters/products/export - Export products overview to Excel
export const GET = withWarehouse(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const locale = searchParams.get('locale') || 'th'

    const productMasters = await prisma.productMaster.findMany({
      where: { isActive: true },
      include: {
        category: true,
        defaultUnit: true,
        _count: { select: { productItems: true } },
      },
      orderBy: { sku: 'asc' },
    })

    // Get stats for each product
    const productMastersWithStats = await Promise.all(
      productMasters.map(async (pm) => {
        const statusCounts = await prisma.productItem.groupBy({
          by: ['status'],
          where: { productMasterId: pm.id },
          _count: { status: true },
        })

        const stats = { total: pm._count.productItems, inStock: 0, pendingOut: 0, shipped: 0, activated: 0, returned: 0 }
        statusCounts.forEach((sc) => {
          switch (sc.status) {
            case 'IN_STOCK': stats.inStock = sc._count.status; break
            case 'PENDING_OUT': stats.pendingOut = sc._count.status; break
            case 'SHIPPED': stats.shipped = sc._count.status; break
            case 'ACTIVATED': stats.activated = sc._count.status; break
            case 'RETURNED': stats.returned = sc._count.status; break
          }
        })

        return { ...pm, stats }
      })
    )

    const isTh = locale === 'th'

    const headers = isTh
      ? ['ลำดับ', 'SKU', 'Serial Prefix', 'ชื่อสินค้า', 'หมวดหมู่', 'รุ่น/ขนาด', 'หน่วย', 'ประเภท', 'ทั้งหมด', 'ส่งออก (เบิก)', 'รอส่งออก (ฝาก)', 'สินค้าคงเหลือในคลัง', 'เปิดใช้แล้ว', 'รับคืน']
      : ['No.', 'SKU', 'Serial Prefix', 'Product Name', 'Category', 'Model/Size', 'Unit', 'Type', 'Total', 'Shipped (withdrawal)', 'Pending Out (deposit)', 'Inventories', 'Activated', 'Returned']

    const rows = productMastersWithStats.map((pm, i) => [
      i + 1,
      pm.sku,
      `${pm.category.serialCode}${pm.serialCode}`,
      isTh ? pm.nameTh : (pm.nameEn || pm.nameTh),
      isTh ? pm.category.nameTh : pm.category.nameEn,
      pm.modelSize || '-',
      pm.defaultUnit ? (isTh ? pm.defaultUnit.nameTh : pm.defaultUnit.nameEn) : '-',
      pm.activationType === 'PACK' ? `Pack (${pm.maxActivations})` : 'Single',
      pm.stats.total,
      pm.stats.shipped,
      pm.stats.pendingOut,
      pm.stats.inStock,
      pm.stats.activated,
      pm.stats.returned,
    ])

    // Summary row
    const totals = productMastersWithStats.reduce(
      (acc, pm) => ({
        total: acc.total + pm.stats.total,
        inStock: acc.inStock + pm.stats.inStock,
        pendingOut: acc.pendingOut + pm.stats.pendingOut,
        shipped: acc.shipped + pm.stats.shipped,
        activated: acc.activated + pm.stats.activated,
        returned: acc.returned + pm.stats.returned,
      }),
      { total: 0, inStock: 0, pendingOut: 0, shipped: 0, activated: 0, returned: 0 }
    )

    rows.push([
      '', '', '', '', '', '', '',
      isTh ? 'รวมทั้งหมด' : 'Grand Total',
      totals.total,
      totals.shipped,
      totals.pendingOut,
      totals.inStock,
      totals.activated,
      totals.returned,
    ])

    const buffer = generateExcelBuffer([
      {
        name: isTh ? 'ภาพรวมสินค้า' : 'Products Overview',
        headers,
        rows,
      },
    ])

    const date = new Date().toISOString().split('T')[0]
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="products-overview-${date}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Export products error:', error)
    return NextResponse.json({ success: false, error: 'Failed to export products' }, { status: 500 })
  }
})
