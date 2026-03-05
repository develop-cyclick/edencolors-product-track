'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ActivationRateBadge from '@/components/analytics/activation-rate-badge';

interface Clinic {
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

interface ClinicsData {
  clinics: Clinic[];
  provinces: string[];
  totalClinics: number;
}

export default function ClinicsPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params?.locale as string || 'th';
  const [data, setData] = useState<ClinicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);

  // Filters
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('activationRate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchData();
  }, [selectedProvince, sortBy, sortOrder]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedProvince) params.append('province', selectedProvince);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      const response = await fetch(`/api/analytics/clinics?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch clinic data');
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 text-[#C9A35A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-[#C9A35A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/analytics/clinics/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, province: selectedProvince || undefined }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-clinics-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">
            {locale === 'th' ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'Error loading clinic data'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/${locale}/dashboard/analytics`}
            className="text-[#C9A35A] hover:underline text-sm mb-2 inline-block"
          >
            ← {locale === 'th' ? 'กลับ' : 'Back to Analytics'}
          </Link>
          <h1 className="text-3xl font-bold text-[#2D2D2D]">
            {locale === 'th' ? 'ประสิทธิภาพคลินิก' : 'Clinic Performance'}
          </h1>
          <p className="text-[#666666] mt-1">
            {data.totalClinics} {locale === 'th' ? 'คลินิก' : 'clinics'}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-2 bg-[var(--color-charcoal)] text-white rounded-lg hover:bg-[var(--color-charcoal)]/90 disabled:opacity-50 transition-colors flex items-center gap-2 h-fit"
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
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-[#666666] mb-2">
              {locale === 'th' ? 'จังหวัด' : 'Province'}
            </label>
            <select
              value={selectedProvince}
              onChange={(e) => setSelectedProvince(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A35A]"
            >
              <option value="">{locale === 'th' ? 'ทั้งหมด' : 'All Provinces'}</option>
              {data.provinces.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Clinic Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="text-left py-3 px-4 text-sm font-semibold text-[#666666] cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    {locale === 'th' ? 'คลินิก' : 'Clinic'}
                    <SortIcon column="name" />
                  </div>
                </th>
                <th
                  className="text-left py-3 px-4 text-sm font-semibold text-[#666666] cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('province')}
                >
                  <div className="flex items-center gap-2">
                    {locale === 'th' ? 'จังหวัด' : 'Province'}
                    <SortIcon column="province" />
                  </div>
                </th>
                <th
                  className="text-right py-3 px-4 text-sm font-semibold text-[#666666] cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('totalShipped')}
                >
                  <div className="flex items-center justify-end gap-2">
                    {locale === 'th' ? 'ส่งออก' : 'Shipped'}
                    <SortIcon column="totalShipped" />
                  </div>
                </th>
                <th
                  className="text-right py-3 px-4 text-sm font-semibold text-[#666666] cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('totalActivated')}
                >
                  <div className="flex items-center justify-end gap-2">
                    {locale === 'th' ? 'เปิดใช้งาน' : 'Activated'}
                    <SortIcon column="totalActivated" />
                  </div>
                </th>
                <th
                  className="text-right py-3 px-4 text-sm font-semibold text-[#666666] cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('activationRate')}
                >
                  <div className="flex items-center justify-end gap-2">
                    {locale === 'th' ? 'อัตรา' : 'Rate'}
                    <SortIcon column="activationRate" />
                  </div>
                </th>
                <th
                  className="text-right py-3 px-4 text-sm font-semibold text-[#666666] cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('avgDaysToActivation')}
                >
                  <div className="flex items-center justify-end gap-2">
                    {locale === 'th' ? 'เฉลี่ยวัน' : 'Avg Days'}
                    <SortIcon column="avgDaysToActivation" />
                  </div>
                </th>
                <th
                  className="text-right py-3 px-4 text-sm font-semibold text-[#666666] cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('lastActivationDate')}
                >
                  <div className="flex items-center justify-end gap-2">
                    {locale === 'th' ? 'เปิดใช้ล่าสุด' : 'Last Activation'}
                    <SortIcon column="lastActivationDate" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.clinics.map((clinic) => (
                <tr
                  key={clinic.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/${locale}/dashboard/analytics/clinics/${clinic.id}`)}
                >
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-[#2D2D2D]">{clinic.name}</p>
                      {clinic.branchName && (
                        <p className="text-xs text-[#999999]">{clinic.branchName}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#666666]">{clinic.province}</td>
                  <td className="py-3 px-4 text-right text-[#2D2D2D]">{clinic.totalShipped}</td>
                  <td className="py-3 px-4 text-right text-[#2D2D2D]">{clinic.totalActivated}</td>
                  <td className="py-3 px-4 text-right">
                    <ActivationRateBadge rate={clinic.activationRate} />
                  </td>
                  <td className="py-3 px-4 text-right text-[#666666]">
                    {clinic.avgDaysToActivation !== null
                      ? `${clinic.avgDaysToActivation.toFixed(1)}`
                      : 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-right text-[#666666] text-sm">
                    {clinic.lastActivationDate
                      ? new Date(clinic.lastActivationDate).toLocaleDateString(
                          locale === 'th' ? 'th-TH' : 'en-US'
                        )
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.clinics.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[#999999]">
              {locale === 'th' ? 'ไม่พบข้อมูล' : 'No data found'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
