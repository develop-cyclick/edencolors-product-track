import { NextRequest, NextResponse } from 'next/server'
import { withAnalytics } from '@/lib/api-middleware'
import { errors } from '@/lib/api-response'
import {
  getOverviewStats,
  getActivationTrend,
  getCategoryStats,
  getTopClinics,
  getProvinceDistribution,
} from '@/lib/analytics-queries'
import { generateExcelBuffer } from '@/lib/excel-export'

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const locale = body.locale || 'th'
    const th = locale === 'th'

    const [stats, trend, categories, topClinics, provinces] = await Promise.all([
      getOverviewStats(),
      getActivationTrend(30),
      getCategoryStats(),
      getTopClinics(10),
      getProvinceDistribution(),
    ])

    const sheets = [
      {
        name: th ? 'ภาพรวม' : 'Overview',
        headers: [th ? 'รายการ' : 'Metric', th ? 'ค่า' : 'Value'],
        rows: [
          [th ? 'สินค้าทั้งหมด' : 'Total Items', stats.total],
          [th ? 'ส่งออกแล้ว' : 'Shipped', stats.shipped],
          [th ? 'เปิดใช้งานแล้ว' : 'Activated', stats.activated],
          [th ? 'อัตราเปิดใช้งาน (%)' : 'Activation Rate (%)', stats.activationRate],
          [th ? 'เฉลี่ยวันถึงเปิดใช้งาน' : 'Avg Days to Activation', stats.avgDaysToActivation],
        ],
      },
      {
        name: th ? 'แนวโน้ม 30 วัน' : 'Trend 30 Days',
        headers: [th ? 'วันที่' : 'Date', th ? 'ส่งออก' : 'Shipped', th ? 'เปิดใช้งาน' : 'Activated'],
        rows: trend.map(t => [t.date, t.shipped, t.activated]),
      },
      {
        name: th ? 'หมวดหมู่' : 'Categories',
        headers: [
          th ? 'หมวดหมู่' : 'Category',
          th ? 'ส่งออก' : 'Shipped',
          th ? 'เปิดใช้งาน' : 'Activated',
          th ? 'อัตรา (%)' : 'Rate (%)',
        ],
        rows: categories.map(c => [c.categoryNameTh, c.totalShipped, c.totalActivated, c.activationRate]),
      },
      {
        name: th ? 'คลินิก Top 10' : 'Top 10 Clinics',
        headers: [
          th ? 'คลินิก' : 'Clinic',
          th ? 'จังหวัด' : 'Province',
          th ? 'ส่งออก' : 'Shipped',
          th ? 'เปิดใช้งาน' : 'Activated',
          th ? 'อัตรา (%)' : 'Rate (%)',
          th ? 'เฉลี่ยวัน' : 'Avg Days',
        ],
        rows: topClinics.map(c => [
          c.name + (c.branchName ? ` (${c.branchName})` : ''),
          c.province,
          c.totalShipped,
          c.totalActivated,
          c.activationRate,
          c.avgDaysToActivation,
        ]),
      },
      {
        name: th ? 'จังหวัด' : 'Provinces',
        headers: [
          th ? 'จังหวัด' : 'Province',
          th ? 'ส่งออก' : 'Shipped',
          th ? 'เปิดใช้งาน' : 'Activated',
          th ? 'อัตรา (%)' : 'Rate (%)',
        ],
        rows: provinces.map(p => [p.province, p.shipped, p.activated, p.activationRate]),
      },
    ]

    const buffer = generateExcelBuffer(sheets)
    const filename = `analytics-overview-${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Overview export error:', error)
    return errors.internalError()
  }
}

export const POST = withAnalytics(handlePOST)
