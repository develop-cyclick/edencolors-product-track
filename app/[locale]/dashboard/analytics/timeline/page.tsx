'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TimelineData {
  activations: Array<{
    id: number;
    serial12: string;
    productName: string;
    sku: string;
    clinicName: string;
    clinicProvince: string;
    customerName: string | null;
    age: number | null;
    gender: string | null;
    province: string | null;
    income: string | null;
    discoveryChannel: string | null;
    createdAt: string;
    daysToActivation: number | null;
  }>;
  demographics: {
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
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    clinics: Array<{ id: number; name: string; province: string }>;
    provinces: string[];
  };
}

export default function TimelinePage() {
  const params = useParams();
  const locale = params?.locale as string || 'th';
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedClinic, setSelectedClinic] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchData();
  }, [search, selectedClinic, selectedProvince, page]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      if (search) params.append('search', search);
      if (selectedClinic) params.append('clinicId', selectedClinic);
      if (selectedProvince) params.append('province', selectedProvince);

      const response = await fetch(`/api/analytics/activations?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch timeline data');
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/analytics/activations/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale,
          search: search || undefined,
          clinicId: selectedClinic || undefined,
          province: selectedProvince || undefined,
        }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-activations-${new Date().toISOString().slice(0, 10)}.xlsx`;
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

  if (loading && !data) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">
            {locale === 'th' ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'Error loading timeline data'}
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Prepare chart data
  const genderChartData = [
    { name: locale === 'th' ? 'ชาย' : 'Male', value: data.demographics.genderDistribution.male },
    { name: locale === 'th' ? 'หญิง' : 'Female', value: data.demographics.genderDistribution.female },
    { name: locale === 'th' ? 'อื่นๆ' : 'Other', value: data.demographics.genderDistribution.other },
  ].filter(item => item.value > 0);

  const ageChartData = [
    { name: '0-18', value: data.demographics.ageGroups['0-18'] },
    { name: '19-30', value: data.demographics.ageGroups['19-30'] },
    { name: '31-45', value: data.demographics.ageGroups['31-45'] },
    { name: '46-60', value: data.demographics.ageGroups['46-60'] },
    { name: '60+', value: data.demographics.ageGroups['60+'] },
  ].filter(item => item.value > 0);

  const provinceChartData = data.demographics.topProvinces.slice(0, 10);

  const incomeChartData = (data.demographics.incomeDistribution || []).map(item => ({
    name: item.income,
    value: item.count,
  }));

  const channelChartData = (data.demographics.discoveryChannelDistribution || []).map(item => ({
    name: item.channel,
    value: item.count,
  }));

  const COLORS = ['#C9A35A', '#2D2D2D', '#999999', '#E8D5A3', '#666666', '#B8924A', '#4A90D9'];

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
            {locale === 'th' ? 'ไทม์ไลน์การเปิดใช้งาน' : 'Activation Timeline'}
          </h1>
          <p className="text-[#666666] mt-1">
            {data.pagination.total} {locale === 'th' ? 'รายการ' : 'activations'}
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

      {/* Demographics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Gender Distribution */}
        {genderChartData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-[#2D2D2D] mb-4">
              {locale === 'th' ? 'สัดส่วนเพศ' : 'Gender Distribution'}
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={genderChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={70}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {genderChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Age Distribution */}
        {ageChartData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 md:col-span-2">
            <h2 className="text-lg font-bold text-[#2D2D2D] mb-4">
              {locale === 'th' ? 'กลุ่มอายุ' : 'Age Distribution'}
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ageChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#C9A35A" name={locale === 'th' ? 'จำนวน' : 'Count'} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top Provinces */}
      {provinceChartData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-[#2D2D2D] mb-4">
            {locale === 'th' ? 'จังหวัดยอดนิยม 10 อันดับ' : 'Top 10 Provinces'}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={provinceChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="province" type="category" width={100} />
              <Tooltip />
              <Bar dataKey="count" fill="#2D2D2D" name={locale === 'th' ? 'จำนวน' : 'Count'} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Income & Discovery Channel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Income Distribution */}
        {incomeChartData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-[#2D2D2D] mb-4">
              {locale === 'th' ? 'รายได้ต่อเดือน' : 'Monthly Income'}
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={incomeChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#C9A35A" name={locale === 'th' ? 'จำนวน' : 'Count'} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Discovery Channel Distribution */}
        {channelChartData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-[#2D2D2D] mb-4">
              {locale === 'th' ? 'ช่องทางที่พบสินค้า' : 'Discovery Channel'}
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={channelChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {channelChartData.map((entry, index) => (
                    <Cell key={`cell-ch-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[250px]">
            <label className="block text-sm font-medium text-[#666666] mb-2">
              {locale === 'th' ? 'ค้นหา' : 'Search'}
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={locale === 'th' ? 'Serial หรือชื่อลูกค้า' : 'Serial or customer name'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A35A]"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-[#666666] mb-2">
              {locale === 'th' ? 'คลินิก' : 'Clinic'}
            </label>
            <select
              value={selectedClinic}
              onChange={(e) => {
                setSelectedClinic(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A35A]"
            >
              <option value="">{locale === 'th' ? 'ทั้งหมด' : 'All Clinics'}</option>
              {data.filters.clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-[#666666] mb-2">
              {locale === 'th' ? 'จังหวัด (ลูกค้า)' : 'Province (Customer)'}
            </label>
            <select
              value={selectedProvince}
              onChange={(e) => {
                setSelectedProvince(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A35A]"
            >
              <option value="">{locale === 'th' ? 'ทั้งหมด' : 'All Provinces'}</option>
              {data.filters.provinces.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
          </div>
        </form>
      </div>

      {/* Activation Timeline */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-[#2D2D2D] mb-4">
          {locale === 'th' ? 'รายการเปิดใช้งาน' : 'Activation List'}
        </h2>
        <div className="space-y-3">
          {data.activations.map((activation) => (
            <div key={activation.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100">
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono font-medium text-[#2D2D2D]">{activation.serial12}</p>
                    <p className="text-sm text-[#666666]">{activation.productName}</p>
                    <p className="text-xs text-[#999999] mt-1">
                      {activation.clinicName} • {activation.clinicProvince}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-[#666666]">
                      {new Date(activation.createdAt).toLocaleDateString(
                        locale === 'th' ? 'th-TH' : 'en-US',
                        { year: 'numeric', month: 'short', day: 'numeric' }
                      )}
                    </p>
                    {activation.daysToActivation !== null && (
                      <p className={`text-xs mt-1 ${activation.daysToActivation <= 7 ? 'text-green-600 font-medium' : 'text-[#999999]'}`}>
                        {activation.daysToActivation.toFixed(1)} {locale === 'th' ? 'วัน' : 'days'}
                      </p>
                    )}
                  </div>
                </div>
                {(activation.customerName || activation.age || activation.gender || activation.province || activation.income || activation.discoveryChannel) && (
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-[#666666]">
                    {activation.customerName && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        {activation.customerName}
                      </span>
                    )}
                    {activation.age && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        {activation.age} {locale === 'th' ? 'ปี' : 'years'}
                      </span>
                    )}
                    {activation.gender && (
                      <span className="flex items-center gap-1">
                        {activation.gender === 'M' ? (locale === 'th' ? 'ชาย' : 'Male') : activation.gender === 'F' ? (locale === 'th' ? 'หญิง' : 'Female') : activation.gender === 'Non-binary' ? (locale === 'th' ? 'นอนไบนารี' : 'Non-binary') : activation.gender === 'Prefer not to say' ? (locale === 'th' ? 'ไม่ระบุ' : 'N/A') : (locale === 'th' ? 'อื่นๆ' : 'Other')}
                      </span>
                    )}
                    {activation.province && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        {activation.province}
                      </span>
                    )}
                    {activation.income && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                          <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                        </svg>
                        {activation.income}
                      </span>
                    )}
                    {activation.discoveryChannel && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        {activation.discoveryChannel}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {data.activations.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[#999999]">
              {locale === 'th' ? 'ไม่พบข้อมูล' : 'No activations found'}
            </p>
          </div>
        )}

        {/* Pagination */}
        {data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm bg-[#C9A35A] text-white rounded-lg hover:bg-[#B8924A] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {locale === 'th' ? 'ก่อนหน้า' : 'Previous'}
            </button>
            <span className="text-sm text-[#666666]">
              {locale === 'th' ? 'หน้า' : 'Page'} {page} {locale === 'th' ? 'จาก' : 'of'} {data.pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(data.pagination.totalPages, page + 1))}
              disabled={page === data.pagination.totalPages}
              className="px-4 py-2 text-sm bg-[#C9A35A] text-white rounded-lg hover:bg-[#B8924A] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {locale === 'th' ? 'ถัดไป' : 'Next'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
