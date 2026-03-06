import { Prisma } from '@prisma/client';
import prisma from './prisma';

/**
 * Analytics Query Library
 * Shared functions for analytics dashboard
 */

// ============================================
// OVERVIEW METRICS
// ============================================

export interface OverviewStats {
  total: number;
  shipped: number;
  activated: number;
  activationRate: number;
  avgDaysToActivation: number | null;
}

export async function getOverviewStats(): Promise<OverviewStats> {
  // Get counts using efficient FILTER clauses
  const statsResult: any[] = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE status IN ('SHIPPED', 'ACTIVATED'))::int as shipped,
      COUNT(*) FILTER (WHERE status = 'ACTIVATED')::int as activated
    FROM product_items
    WHERE status NOT IN ('PENDING_LINK', 'RETURNED', 'DAMAGED')
  `;

  const stats = statsResult[0];
  const activationRate = stats.shipped > 0 ? (stats.activated / stats.shipped) * 100 : 0;

  // Calculate average time-to-activation
  const avgTimeResult: any[] = await prisma.$queryRaw`
    SELECT
      AVG(
        EXTRACT(EPOCH FROM (a.created_at - oh.shipped_at)) / 86400
      )::numeric(10,2) as avg_days
    FROM activations a
    JOIN product_items pi ON a.product_item_id = pi.id
    JOIN outbound_lines ol ON ol.product_item_id = pi.id
    JOIN outbound_headers oh ON ol.outbound_id = oh.id
    WHERE oh.status = 'APPROVED'
      AND oh.shipped_at IS NOT NULL
      AND a.activation_number = 1
  `;

  const avgDays = avgTimeResult[0]?.avg_days ? parseFloat(avgTimeResult[0].avg_days) : null;

  return {
    total: stats.total,
    shipped: stats.shipped,
    activated: stats.activated,
    activationRate: Math.round(activationRate * 10) / 10,
    avgDaysToActivation: avgDays,
  };
}

// ============================================
// TREND DATA
// ============================================

export interface TrendData {
  date: string;
  shipped: number;
  activated: number;
}

export async function getActivationTrend(days: number = 30): Promise<TrendData[]> {
  const result: any[] = await prisma.$queryRaw`
    WITH date_series AS (
      SELECT generate_series(
        CURRENT_DATE - ${days}::int,
        CURRENT_DATE,
        '1 day'::interval
      )::date as date
    ),
    shipped_counts AS (
      SELECT
        oh.shipped_at::date as date,
        COUNT(DISTINCT ol.product_item_id)::int as count
      FROM outbound_headers oh
      JOIN outbound_lines ol ON ol.outbound_id = oh.id
      WHERE oh.status = 'APPROVED'
        AND oh.shipped_at IS NOT NULL
        AND oh.shipped_at >= CURRENT_DATE - ${days}::int
      GROUP BY oh.shipped_at::date
    ),
    activated_counts AS (
      SELECT
        a.created_at::date as date,
        COUNT(DISTINCT a.product_item_id)::int as count
      FROM activations a
      WHERE a.created_at >= CURRENT_DATE - ${days}::int
        AND a.activation_number = 1
      GROUP BY a.created_at::date
    )
    SELECT
      ds.date::text,
      COALESCE(sc.count, 0) as shipped,
      COALESCE(ac.count, 0) as activated
    FROM date_series ds
    LEFT JOIN shipped_counts sc ON ds.date = sc.date
    LEFT JOIN activated_counts ac ON ds.date = ac.date
    ORDER BY ds.date
  `;

  return result;
}

// ============================================
// CLINIC ANALYTICS
// ============================================

export interface ClinicStats {
  id: number;
  name: string;
  branchName: string | null;
  province: string;
  totalShipped: number;
  totalActivated: number;
  activationRate: number;
  avgDaysToActivation: number | null;
  lastActivationDate: Date | null;
}

export async function getClinicStats(filters?: {
  province?: string;
  startDate?: string;
  endDate?: string;
}): Promise<ClinicStats[]> {
  const provinceFilter = filters?.province ? Prisma.sql`AND c.province = ${filters.province}` : Prisma.empty;
  const dateFilter = filters?.startDate && filters?.endDate
    ? Prisma.sql`AND oh.shipped_at >= ${filters.startDate}::date AND oh.shipped_at <= ${filters.endDate}::date`
    : Prisma.empty;

  const result: any[] = await prisma.$queryRaw`
    SELECT
      c.id,
      c.name,
      c.branch_name as "branchName",
      c.province,
      COUNT(DISTINCT CASE
        WHEN pi.status IN ('SHIPPED', 'ACTIVATED') THEN pi.id
      END)::int as "totalShipped",
      COUNT(DISTINCT CASE
        WHEN pi.status = 'ACTIVATED' THEN pi.id
      END)::int as "totalActivated",
      (COUNT(DISTINCT CASE WHEN pi.status = 'ACTIVATED' THEN pi.id END)::float /
       NULLIF(COUNT(DISTINCT CASE WHEN pi.status IN ('SHIPPED', 'ACTIVATED') THEN pi.id END), 0) * 100
      )::numeric(5,2) as "activationRate",
      AVG(
        CASE
          WHEN a.created_at IS NOT NULL AND oh.shipped_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (a.created_at - oh.shipped_at)) / 86400
        END
      )::numeric(10,2) as "avgDaysToActivation",
      MAX(a.created_at) as "lastActivationDate"
    FROM clinics c
    LEFT JOIN product_items pi ON pi.assigned_clinic_id = c.id
    LEFT JOIN outbound_lines ol ON ol.product_item_id = pi.id
    LEFT JOIN outbound_headers oh ON ol.outbound_id = oh.id AND oh.status = 'APPROVED'
    LEFT JOIN activations a ON a.product_item_id = pi.id AND a.activation_number = 1
    WHERE c.is_active = true
      ${provinceFilter}
      ${dateFilter}
    GROUP BY c.id, c.name, c.branch_name, c.province
    HAVING COUNT(DISTINCT CASE WHEN pi.status IN ('SHIPPED', 'ACTIVATED') THEN pi.id END) > 0
    ORDER BY "activationRate" DESC NULLS LAST, c.name
  `;

  return result.map(row => ({
    ...row,
    activationRate: row.activationRate ? parseFloat(row.activationRate) : 0,
    avgDaysToActivation: row.avgDaysToActivation ? parseFloat(row.avgDaysToActivation) : null,
  }));
}

export async function getClinicDetail(clinicId: number) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: {
      id: true,
      name: true,
      branchName: true,
      address: true,
    },
  });

  if (!clinic) {
    return null;
  }

  // Get product items shipped to this clinic
  const productItems = await prisma.productItem.findMany({
    where: {
      assignedClinicId: clinicId,
      status: {
        in: ['SHIPPED', 'ACTIVATED'],
      },
    },
    select: {
      id: true,
      serial12: true,
      sku: true,
      name: true,
      status: true,
      activationCount: true,
      productMaster: {
        select: {
          activationType: true,
          maxActivations: true,
        },
      },
      outboundLines: {
        select: {
          outbound: {
            select: {
              shippedAt: true,
            },
          },
        },
        where: {
          outbound: {
            status: 'APPROVED',
          },
        },
        take: 1,
        orderBy: {
          createdAt: 'asc',
        },
      },
      activations: {
        select: {
          id: true,
          activationNumber: true,
          customerName: true,
          age: true,
          gender: true,
          province: true,
          income: true,
          discoveryChannel: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Calculate stats
  const stats = {
    totalShipped: productItems.length,
    totalActivated: productItems.filter(p => p.status === 'ACTIVATED').length,
    activationRate: productItems.length > 0
      ? (productItems.filter(p => p.status === 'ACTIVATED').length / productItems.length) * 100
      : 0,
  };

  return {
    clinic,
    productItems,
    stats,
  };
}

// ============================================
// CATEGORY ANALYTICS
// ============================================

export interface CategoryStats {
  categoryId: number;
  categoryNameTh: string;
  categoryNameEn: string | null;
  totalShipped: number;
  totalActivated: number;
  activationRate: number;
}

export async function getCategoryStats(): Promise<CategoryStats[]> {
  const result: any[] = await prisma.$queryRaw`
    SELECT
      pc.id as "categoryId",
      pc.name_th as "categoryNameTh",
      pc.name_en as "categoryNameEn",
      COUNT(*) FILTER (WHERE pi.status IN ('SHIPPED', 'ACTIVATED'))::int as "totalShipped",
      COUNT(*) FILTER (WHERE pi.status = 'ACTIVATED')::int as "totalActivated",
      (COUNT(*) FILTER (WHERE pi.status = 'ACTIVATED')::float /
       NULLIF(COUNT(*) FILTER (WHERE pi.status IN ('SHIPPED', 'ACTIVATED')), 0) * 100
      )::numeric(5,2) as "activationRate"
    FROM product_categories pc
    LEFT JOIN product_items pi ON pi.category_id = pc.id
    WHERE pc.is_active = true
    GROUP BY pc.id, pc.name_th, pc.name_en
    HAVING COUNT(*) FILTER (WHERE pi.status IN ('SHIPPED', 'ACTIVATED')) > 0
    ORDER BY "activationRate" DESC NULLS LAST
  `;

  return result.map(row => ({
    ...row,
    activationRate: row.activationRate ? parseFloat(row.activationRate) : 0,
  }));
}

// ============================================
// TOP PERFORMERS
// ============================================

export async function getTopClinics(limit: number = 10): Promise<ClinicStats[]> {
  const allClinics = await getClinicStats();
  return allClinics
    .filter(c => c.totalShipped >= 5) // Minimum threshold
    .slice(0, limit);
}

// ============================================
// PROVINCE DISTRIBUTION
// ============================================

export interface ProvinceStats {
  province: string;
  shipped: number;
  activated: number;
  activationRate: number;
}

export async function getProvinceDistribution(): Promise<ProvinceStats[]> {
  const result: any[] = await prisma.$queryRaw`
    SELECT
      c.province,
      COUNT(DISTINCT CASE WHEN pi.status IN ('SHIPPED', 'ACTIVATED') THEN pi.id END)::int as shipped,
      COUNT(DISTINCT CASE WHEN pi.status = 'ACTIVATED' THEN pi.id END)::int as activated,
      (COUNT(DISTINCT CASE WHEN pi.status = 'ACTIVATED' THEN pi.id END)::float /
       NULLIF(COUNT(DISTINCT CASE WHEN pi.status IN ('SHIPPED', 'ACTIVATED') THEN pi.id END), 0) * 100
      )::numeric(5,2) as "activationRate"
    FROM clinics c
    LEFT JOIN product_items pi ON pi.assigned_clinic_id = c.id
    WHERE c.is_active = true
    GROUP BY c.province
    HAVING COUNT(DISTINCT CASE WHEN pi.status IN ('SHIPPED', 'ACTIVATED') THEN pi.id END) > 0
    ORDER BY shipped DESC
  `;

  return result.map(row => ({
    province: row.province,
    shipped: row.shipped,
    activated: row.activated,
    activationRate: row.activationRate ? parseFloat(row.activationRate) : 0,
  }));
}

// ============================================
// RECENT ACTIVATIONS
// ============================================

export interface RecentActivation {
  id: number;
  serial12: string;
  productName: string;
  clinicName: string;
  province: string;
  customerName: string | null;
  activationNumber: number;
  createdAt: Date;
  daysToActivation: number | null;
}

export async function getRecentActivations(limit: number = 10): Promise<RecentActivation[]> {
  const result: any[] = await prisma.$queryRaw`
    SELECT
      a.id,
      pi.serial12 as "serial12",
      pi.name as "productName",
      c.name as "clinicName",
      c.province,
      a.customer_name as "customerName",
      a.activation_number as "activationNumber",
      a.created_at as "createdAt",
      EXTRACT(EPOCH FROM (a.created_at - oh.shipped_at)) / 86400 as "daysToActivation"
    FROM activations a
    JOIN product_items pi ON a.product_item_id = pi.id
    LEFT JOIN clinics c ON pi.assigned_clinic_id = c.id
    LEFT JOIN outbound_lines ol ON ol.product_item_id = pi.id
    LEFT JOIN outbound_headers oh ON ol.outbound_id = oh.id AND oh.status = 'APPROVED'
    WHERE a.activation_number = 1
    ORDER BY a.created_at DESC
    LIMIT ${limit}
  `;

  return result.map(row => ({
    ...row,
    daysToActivation: row.daysToActivation ? Math.round(parseFloat(row.daysToActivation) * 10) / 10 : null,
  }));
}

// ============================================
// DEMOGRAPHICS
// ============================================

export interface DemographicStats {
  genderDistribution: {
    male: number;
    female: number;
    other: number;
  };
  ageGroups: {
    '0-18': number;
    '19-30': number;
    '31-45': number;
    '46-60': number;
    '60+': number;
  };
  topProvinces: Array<{
    province: string;
    count: number;
  }>;
  incomeDistribution: Array<{
    income: string;
    count: number;
  }>;
  discoveryChannelDistribution: Array<{
    channel: string;
    count: number;
  }>;
}

export async function getDemographicStats(): Promise<DemographicStats> {
  // Gender distribution
  const genderResult: any[] = await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE gender = 'M')::int as male,
      COUNT(*) FILTER (WHERE gender = 'F')::int as female,
      COUNT(*) FILTER (WHERE gender NOT IN ('M', 'F') OR gender IS NULL)::int as other
    FROM activations
    WHERE activation_number = 1
  `;

  // Age groups
  const ageResult: any[] = await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE age >= 0 AND age <= 18)::int as "0-18",
      COUNT(*) FILTER (WHERE age >= 19 AND age <= 30)::int as "19-30",
      COUNT(*) FILTER (WHERE age >= 31 AND age <= 45)::int as "31-45",
      COUNT(*) FILTER (WHERE age >= 46 AND age <= 60)::int as "46-60",
      COUNT(*) FILTER (WHERE age > 60)::int as "60+"
    FROM activations
    WHERE activation_number = 1 AND age IS NOT NULL
  `;

  // Top provinces
  const provinceResult: any[] = await prisma.$queryRaw`
    SELECT
      province,
      COUNT(*)::int as count
    FROM activations
    WHERE activation_number = 1 AND province IS NOT NULL
    GROUP BY province
    ORDER BY count DESC
    LIMIT 10
  `;

  // Income distribution
  const incomeResult: any[] = await prisma.$queryRaw`
    SELECT
      income,
      COUNT(*)::int as count
    FROM activations
    WHERE activation_number = 1 AND income IS NOT NULL AND income != ''
    GROUP BY income
    ORDER BY count DESC
  `;

  // Discovery channel distribution
  const channelResult: any[] = await prisma.$queryRaw`
    SELECT
      discovery_channel as channel,
      COUNT(*)::int as count
    FROM activations
    WHERE activation_number = 1 AND discovery_channel IS NOT NULL AND discovery_channel != ''
    GROUP BY discovery_channel
    ORDER BY count DESC
  `;

  return {
    genderDistribution: {
      male: genderResult[0]?.male || 0,
      female: genderResult[0]?.female || 0,
      other: genderResult[0]?.other || 0,
    },
    ageGroups: {
      '0-18': ageResult[0]?.['0-18'] || 0,
      '19-30': ageResult[0]?.['19-30'] || 0,
      '31-45': ageResult[0]?.['31-45'] || 0,
      '46-60': ageResult[0]?.['46-60'] || 0,
      '60+': ageResult[0]?.['60+'] || 0,
    },
    topProvinces: provinceResult,
    incomeDistribution: incomeResult,
    discoveryChannelDistribution: channelResult,
  };
}

// ============================================
// PRODUCT ANALYTICS
// ============================================

export interface ProductStats {
  productMasterId: number;
  sku: string;
  nameTh: string;
  categoryNameTh: string;
  activationType: string;
  maxActivations: number;
  totalShipped: number;
  totalActivated: number;
  totalActivationCount: number; // For PACK products
  activationRate: number;
}

export async function getProductStats(): Promise<ProductStats[]> {
  const result: any[] = await prisma.$queryRaw`
    SELECT
      pm.id as "productMasterId",
      pm.sku,
      pm.name_th as "nameTh",
      pc.name_th as "categoryNameTh",
      pm.activation_type as "activationType",
      pm.max_activations as "maxActivations",
      COUNT(DISTINCT pi.id) FILTER (WHERE pi.status IN ('SHIPPED', 'ACTIVATED'))::int as "totalShipped",
      COUNT(DISTINCT pi.id) FILTER (WHERE pi.status = 'ACTIVATED')::int as "totalActivated",
      COUNT(a.id)::int as "totalActivationCount",
      (COUNT(DISTINCT pi.id) FILTER (WHERE pi.status = 'ACTIVATED')::float /
       NULLIF(COUNT(DISTINCT pi.id) FILTER (WHERE pi.status IN ('SHIPPED', 'ACTIVATED')), 0) * 100
      )::numeric(5,2) as "activationRate"
    FROM product_masters pm
    LEFT JOIN product_items pi ON pi.product_master_id = pm.id
    LEFT JOIN product_categories pc ON pm.category_id = pc.id
    LEFT JOIN activations a ON a.product_item_id = pi.id
    WHERE pm.is_active = true
    GROUP BY pm.id, pm.sku, pm.name_th, pc.name_th, pm.activation_type, pm.max_activations
    HAVING COUNT(DISTINCT pi.id) FILTER (WHERE pi.status IN ('SHIPPED', 'ACTIVATED')) > 0
    ORDER BY "activationRate" DESC NULLS LAST
  `;

  return result.map(row => ({
    ...row,
    activationRate: row.activationRate ? parseFloat(row.activationRate) : 0,
  }));
}

// ============================================
// MONTHLY SUMMARY
// ============================================

export interface MonthlySummary {
  month: string; // YYYY-MM format
  grnCount: number;
  itemsReceived: number;
  itemsOk: number;
  itemsDefective: number;
  poCount: number;
  poConfirmed: number;
  deliveriesCount: number;
  itemsShipped: number;
  activationsCount: number;
  damagedCount: number;
  returnedCount: number;
}

export interface MonthlySummaryTotals {
  totalGRN: number;
  totalReceived: number;
  totalPO: number;
  totalShipped: number;
  totalActivated: number;
  totalDamaged: number;
  totalReturned: number;
}

export async function getMonthlySummary(
  startMonth: string, // 'YYYY-MM'
  endMonth: string     // 'YYYY-MM'
): Promise<MonthlySummary[]> {
  const startDate = `${startMonth}-01`;
  const endDate = `${endMonth}-01`;

  // Generate month series for complete date range
  const result = await prisma.$queryRaw<MonthlySummary[]>`
    WITH month_series AS (
      SELECT generate_series(
        DATE_TRUNC('month', ${startDate}::date),
        DATE_TRUNC('month', ${endDate}::date),
        '1 month'::interval
      )::date as month
    ),
    grn_stats AS (
      SELECT
        DATE_TRUNC('month', gh.received_at)::date as month,
        COUNT(DISTINCT gh.id)::int as grn_count,
        COUNT(DISTINCT pi.id)::int as items_received,
        COUNT(DISTINCT pi.id) FILTER (WHERE gl.inspection_status = 'OK')::int as items_ok,
        COUNT(DISTINCT pi.id) FILTER (WHERE gl.inspection_status IN ('DAMAGED', 'CLAIM', 'BROKEN'))::int as items_defective
      FROM grn_headers gh
      JOIN grn_lines gl ON gh.id = gl.grn_header_id
      JOIN product_items pi ON gl.product_item_id = pi.id
      WHERE gh.received_at >= ${startDate}::date
        AND gh.received_at < (DATE_TRUNC('month', ${endDate}::date) + INTERVAL '1 month')
      GROUP BY DATE_TRUNC('month', gh.received_at)
    ),
    po_stats AS (
      SELECT
        DATE_TRUNC('month', created_at)::date as month,
        COUNT(*)::int as po_count,
        COUNT(*) FILTER (WHERE status IN ('CONFIRMED', 'COMPLETED'))::int as po_confirmed
      FROM purchase_orders
      WHERE created_at >= ${startDate}::date
        AND created_at < (DATE_TRUNC('month', ${endDate}::date) + INTERVAL '1 month')
      GROUP BY DATE_TRUNC('month', created_at)
    ),
    outbound_stats AS (
      SELECT
        DATE_TRUNC('month', oh.shipped_at)::date as month,
        COUNT(DISTINCT oh.id)::int as deliveries_count,
        COUNT(DISTINCT ol.product_item_id)::int as items_shipped
      FROM outbound_headers oh
      JOIN outbound_lines ol ON oh.id = ol.outbound_id
      WHERE oh.status = 'APPROVED'
        AND oh.shipped_at IS NOT NULL
        AND oh.shipped_at >= ${startDate}::date
        AND oh.shipped_at < (DATE_TRUNC('month', ${endDate}::date) + INTERVAL '1 month')
      GROUP BY DATE_TRUNC('month', oh.shipped_at)
    ),
    activation_stats AS (
      SELECT
        DATE_TRUNC('month', created_at)::date as month,
        COUNT(*)::int as activations_count
      FROM activations
      WHERE activation_number = 1
        AND created_at >= ${startDate}::date
        AND created_at < (DATE_TRUNC('month', ${endDate}::date) + INTERVAL '1 month')
      GROUP BY DATE_TRUNC('month', created_at)
    ),
    damage_stats AS (
      SELECT
        DATE_TRUNC('month', el.created_at)::date as month,
        COUNT(DISTINCT CASE WHEN pi.status = 'DAMAGED' THEN pi.id END)::int as damaged_count,
        COUNT(DISTINCT CASE WHEN pi.status = 'RETURNED' THEN pi.id END)::int as returned_count
      FROM event_logs el
      JOIN product_items pi ON el.product_item_id = pi.id
      WHERE el.event_type IN ('DAMAGE', 'RETURN')
        AND el.created_at >= ${startDate}::date
        AND el.created_at < (DATE_TRUNC('month', ${endDate}::date) + INTERVAL '1 month')
      GROUP BY DATE_TRUNC('month', el.created_at)
    )
    SELECT
      TO_CHAR(ms.month, 'YYYY-MM') as month,
      COALESCE(grn.grn_count, 0) as "grnCount",
      COALESCE(grn.items_received, 0) as "itemsReceived",
      COALESCE(grn.items_ok, 0) as "itemsOk",
      COALESCE(grn.items_defective, 0) as "itemsDefective",
      COALESCE(po.po_count, 0) as "poCount",
      COALESCE(po.po_confirmed, 0) as "poConfirmed",
      COALESCE(out.deliveries_count, 0) as "deliveriesCount",
      COALESCE(out.items_shipped, 0) as "itemsShipped",
      COALESCE(act.activations_count, 0) as "activationsCount",
      COALESCE(dmg.damaged_count, 0) as "damagedCount",
      COALESCE(dmg.returned_count, 0) as "returnedCount"
    FROM month_series ms
    LEFT JOIN grn_stats grn ON ms.month = grn.month
    LEFT JOIN po_stats po ON ms.month = po.month
    LEFT JOIN outbound_stats out ON ms.month = out.month
    LEFT JOIN activation_stats act ON ms.month = act.month
    LEFT JOIN damage_stats dmg ON ms.month = dmg.month
    ORDER BY ms.month DESC
  `;

  return result;
}
