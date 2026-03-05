'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import StatsCard from '@/components/analytics/stats-card';
import ActivationRateBadge from '@/components/analytics/activation-rate-badge';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface AnalyticsData {
  stats: {
    total: number;
    shipped: number;
    activated: number;
    activationRate: number;
    avgDaysToActivation: number | null;
  };
  trend: Array<{
    date: string;
    shipped: number;
    activated: number;
  }>;
  categories: Array<{
    categoryId: number;
    categoryNameTh: string;
    categoryNameEn: string | null;
    totalShipped: number;
    totalActivated: number;
    activationRate: number;
  }>;
  topClinics: Array<{
    id: number;
    name: string;
    province: string;
    totalShipped: number;
    totalActivated: number;
    activationRate: number;
  }>;
  provinceDistribution: Array<{
    province: string;
    shipped: number;
    activated: number;
    activationRate: number;
  }>;
  recentActivations: Array<{
    id: number;
    serial12: string;
    productName: string;
    clinicName: string;
    province: string;
    customerName: string | null;
    createdAt: string;
    daysToActivation: number | null;
  }>;
}

export default function AnalyticsPage() {
  const params = useParams();
  const locale = params?.locale as string || 'th';
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics/overview');

      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/analytics/overview/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-overview-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      console.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">
            {locale === 'th' ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'Error loading analytics data'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-[#2D2D2D]">
          {locale === 'th' ? 'วิเคราะห์ข้อมูล' : 'Analytics Dashboard'}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 bg-[var(--color-charcoal)] text-white rounded-lg hover:bg-[var(--color-charcoal)]/90 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {exporting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            Excel
          </button>
          <Link
            href={`/${locale}/dashboard/analytics/clinics`}
            className="px-4 py-2 bg-[#C9A35A] text-white rounded-lg hover:bg-[#B8924A] transition-colors"
          >
            {locale === 'th' ? 'คลินิก' : 'Clinics'}
          </Link>
          <Link
            href={`/${locale}/dashboard/analytics/products`}
            className="px-4 py-2 bg-[#C9A35A] text-white rounded-lg hover:bg-[#B8924A] transition-colors"
          >
            {locale === 'th' ? 'สินค้า' : 'Products'}
          </Link>
          <Link
            href={`/${locale}/dashboard/analytics/timeline`}
            className="px-4 py-2 bg-[#C9A35A] text-white rounded-lg hover:bg-[#B8924A] transition-colors"
          >
            {locale === 'th' ? 'ไทม์ไลน์' : 'Timeline'}
          </Link>
          <Link
            href={`/${locale}/dashboard/analytics/monthly-summary`}
            className="px-4 py-2 bg-[#C9A35A] text-white rounded-lg hover:bg-[#B8924A] transition-colors"
          >
            {locale === 'th' ? 'สรุปรายเดือน' : 'Monthly Summary'}
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatsCard
          label={locale === 'th' ? 'สินค้าทั้งหมด' : 'Total Products'}
          value={data.stats.total.toLocaleString()}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
        <StatsCard
          label={locale === 'th' ? 'ส่งออกแล้ว' : 'Shipped'}
          value={data.stats.shipped.toLocaleString()}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          }
        />
        <StatsCard
          label={locale === 'th' ? 'เปิดใช้งานแล้ว' : 'Activated'}
          value={data.stats.activated.toLocaleString()}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard
          label={locale === 'th' ? 'อัตราการเปิดใช้งาน' : 'Activation Rate'}
          value={`${data.stats.activationRate.toFixed(1)}%`}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <StatsCard
          label={locale === 'th' ? 'เฉลี่ยวันเปิดใช้งาน' : 'Avg Days to Activation'}
          value={data.stats.avgDaysToActivation !== null ? `${data.stats.avgDaysToActivation.toFixed(1)} ${locale === 'th' ? 'วัน' : 'days'}` : 'N/A'}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* 30-Day Activation Trend */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-[#2D2D2D] mb-4">
          {locale === 'th' ? 'แนวโน้ม 30 วันล่าสุด' : '30-Day Trend'}
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.trend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => new Date(date).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', { month: 'short', day: 'numeric' })}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(date) => new Date(date).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US')}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="shipped"
              stroke="#C9A35A"
              name={locale === 'th' ? 'ส่งออก' : 'Shipped'}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="activated"
              stroke="#2D2D2D"
              name={locale === 'th' ? 'เปิดใช้งาน' : 'Activated'}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Category Performance */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-[#2D2D2D] mb-4">
          {locale === 'th' ? 'ประสิทธิภาพตามหมวดหมู่' : 'Category Performance'}
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.categories}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={locale === 'th' ? 'categoryNameTh' : 'categoryNameEn'} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="totalShipped" fill="#C9A35A" name={locale === 'th' ? 'ส่งออก' : 'Shipped'} />
            <Bar dataKey="totalActivated" fill="#2D2D2D" name={locale === 'th' ? 'เปิดใช้งาน' : 'Activated'} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top 10 Clinics */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#2D2D2D]">
            {locale === 'th' ? 'คลินิกยอดนิยม 10 อันดับ' : 'Top 10 Clinics'}
          </h2>
          <Link
            href={`/${locale}/dashboard/analytics/clinics`}
            className="text-[#C9A35A] hover:underline text-sm"
          >
            {locale === 'th' ? 'ดูทั้งหมด' : 'View All'}
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-[#666666]">
                  {locale === 'th' ? 'คลินิก' : 'Clinic'}
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-[#666666]">
                  {locale === 'th' ? 'จังหวัด' : 'Province'}
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-[#666666]">
                  {locale === 'th' ? 'ส่งออก' : 'Shipped'}
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-[#666666]">
                  {locale === 'th' ? 'เปิดใช้งาน' : 'Activated'}
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-[#666666]">
                  {locale === 'th' ? 'อัตรา' : 'Rate'}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.topClinics.map((clinic) => (
                <tr key={clinic.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <Link
                      href={`/${locale}/dashboard/analytics/clinics/${clinic.id}`}
                      className="text-[#C9A35A] hover:underline font-medium"
                    >
                      {clinic.name}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-[#666666]">{clinic.province}</td>
                  <td className="py-3 px-4 text-right text-[#2D2D2D]">{clinic.totalShipped}</td>
                  <td className="py-3 px-4 text-right text-[#2D2D2D]">{clinic.totalActivated}</td>
                  <td className="py-3 px-4 text-right">
                    <ActivationRateBadge rate={clinic.activationRate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activations */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#2D2D2D]">
            {locale === 'th' ? 'การเปิดใช้งานล่าสุด' : 'Recent Activations'}
          </h2>
          <Link
            href={`/${locale}/dashboard/analytics/timeline`}
            className="text-[#C9A35A] hover:underline text-sm"
          >
            {locale === 'th' ? 'ดูทั้งหมด' : 'View All'}
          </Link>
        </div>
        <div className="space-y-3">
          {data.recentActivations.map((activation) => (
            <div key={activation.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-[#2D2D2D]">{activation.serial12}</p>
                <p className="text-sm text-[#666666]">{activation.productName}</p>
                <p className="text-xs text-[#999999]">
                  {activation.clinicName} • {activation.province}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-[#666666]">
                  {new Date(activation.createdAt).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US')}
                </p>
                {activation.daysToActivation !== null && (
                  <p className="text-xs text-[#999999]">
                    {activation.daysToActivation.toFixed(1)} {locale === 'th' ? 'วัน' : 'days'}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
