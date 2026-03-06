import { NextRequest, NextResponse } from 'next/server'
import { withAnalytics } from '@/lib/api-middleware'
import { errors } from '@/lib/api-response'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { generateExcelBuffer } from '@/lib/excel-export'

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const locale = body.locale || 'th'
    const th = locale === 'th'

    // Build filters
    const clinicFilter = body.clinicId
      ? Prisma.sql`AND pi.assigned_clinic_id = ${parseInt(body.clinicId)}`
      : Prisma.empty
    const provinceFilter = body.province
      ? Prisma.sql`AND c.province = ${body.province}`
      : Prisma.empty
    const startFilter = body.startDate
      ? Prisma.sql`AND a.created_at >= ${body.startDate}::date`
      : Prisma.empty
    const endFilter = body.endDate
      ? Prisma.sql`AND a.created_at <= (${body.endDate}::date + INTERVAL '1 day')`
      : Prisma.empty
    const searchFilter = body.search
      ? Prisma.sql`AND (pi.serial12 ILIKE ${'%' + body.search + '%'} OR a.customer_name ILIKE ${'%' + body.search + '%'})`
      : Prisma.empty

    const result: any[] = await prisma.$queryRaw`
      SELECT
        a.id,
        pi.serial12,
        pi.sku,
        pi.name as product_name,
        c.name as clinic_name,
        c.province as clinic_province,
        a.customer_name,
        a.gender,
        a.age,
        a.province as customer_province,
        a.income,
        a.discovery_channel,
        a.activation_number,
        a.created_at,
        EXTRACT(EPOCH FROM (a.created_at - oh.shipped_at)) / 86400 as days_to_activation
      FROM activations a
      JOIN product_items pi ON a.product_item_id = pi.id
      LEFT JOIN clinics c ON pi.assigned_clinic_id = c.id
      LEFT JOIN outbound_lines ol ON ol.product_item_id = pi.id
      LEFT JOIN outbound_headers oh ON ol.outbound_id = oh.id AND oh.status = 'APPROVED'
      WHERE a.activation_number = 1
        ${clinicFilter}
        ${provinceFilter}
        ${startFilter}
        ${endFilter}
        ${searchFilter}
      ORDER BY a.created_at DESC
    `

    const genderLabel = (g: string | null) => {
      if (!g) return '-'
      if (g === 'M') return th ? 'ชาย' : 'Male'
      if (g === 'F') return th ? 'หญิง' : 'Female'
      if (g === 'Non-binary') return th ? 'นอนไบนารี' : 'Non-binary'
      if (g === 'Prefer not to say') return th ? 'ไม่ต้องการระบุ' : 'Prefer not to say'
      return th ? 'เพศอื่นๆ' : 'Other'
    }

    const sheets = [
      {
        name: th ? 'การเปิดใช้งาน' : 'Activations',
        headers: [
          '#',
          'Serial',
          'SKU',
          th ? 'สินค้า' : 'Product',
          th ? 'คลินิก' : 'Clinic',
          th ? 'จังหวัด (คลินิก)' : 'Province (Clinic)',
          th ? 'ลูกค้า' : 'Customer',
          th ? 'เพศ' : 'Gender',
          th ? 'อายุ' : 'Age',
          th ? 'จังหวัด (ลูกค้า)' : 'Province (Customer)',
          th ? 'รายได้ต่อเดือน' : 'Monthly Income',
          th ? 'ช่องทางที่พบสินค้า' : 'Discovery Channel',
          th ? 'วันที่เปิดใช้งาน' : 'Activation Date',
          th ? 'วันจัดส่ง→เปิดใช้งาน' : 'Days to Activation',
        ],
        rows: result.map((r, i) => [
          i + 1,
          r.serial12,
          r.sku,
          r.product_name,
          r.clinic_name || '-',
          r.clinic_province || '-',
          r.customer_name || '-',
          genderLabel(r.gender),
          r.age ?? '-',
          r.customer_province || '-',
          r.income || '-',
          r.discovery_channel || '-',
          new Date(r.created_at).toLocaleDateString('th-TH'),
          r.days_to_activation ? Math.round(parseFloat(r.days_to_activation) * 10) / 10 : '-',
        ]),
      },
    ]

    const buffer = generateExcelBuffer(sheets)
    const filename = `analytics-activations-${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Activations export error:', error)
    return errors.internalError()
  }
}

export const POST = withAnalytics(handlePOST)
