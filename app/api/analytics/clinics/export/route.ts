import { NextRequest, NextResponse } from 'next/server'
import { withAnalytics } from '@/lib/api-middleware'
import { errors } from '@/lib/api-response'
import { getClinicStats } from '@/lib/analytics-queries'
import { generateExcelBuffer } from '@/lib/excel-export'

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const locale = body.locale || 'th'
    const th = locale === 'th'

    const clinics = await getClinicStats({
      province: body.province || undefined,
      startDate: body.startDate || undefined,
      endDate: body.endDate || undefined,
    })

    const sheets = [
      {
        name: th ? 'คลินิก' : 'Clinics',
        headers: [
          th ? 'ชื่อคลินิก' : 'Clinic Name',
          th ? 'สาขา' : 'Branch',
          th ? 'จังหวัด' : 'Province',
          th ? 'ส่งออก' : 'Shipped',
          th ? 'เปิดใช้งาน' : 'Activated',
          th ? 'อัตรา (%)' : 'Rate (%)',
          th ? 'เฉลี่ยวัน' : 'Avg Days',
          th ? 'เปิดใช้งานล่าสุด' : 'Last Activation',
        ],
        rows: clinics.map(c => [
          c.name,
          c.branchName || '-',
          c.province,
          c.totalShipped,
          c.totalActivated,
          c.activationRate,
          c.avgDaysToActivation,
          c.lastActivationDate ? new Date(c.lastActivationDate).toLocaleDateString('th-TH') : '-',
        ]),
      },
    ]

    const buffer = generateExcelBuffer(sheets)
    const filename = `analytics-clinics-${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Clinics export error:', error)
    return errors.internalError()
  }
}

export const POST = withAnalytics(handlePOST)
