'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ActivationRateBadge from '@/components/analytics/activation-rate-badge';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ClinicDetailData {
  clinic: {
    id: number;
    name: string;
    branchName: string | null;
    province: string;
  };
  stats: {
    totalShipped: number;
    totalActivated: number;
    activationRate: number;
  };
  products: Array<{
    id: number;
    serial12: string;
    sku: string;
    name: string;
    status: string;
    activationCount: number;
    activationType: string;
    maxActivations: number;
    shippedDate: string | null;
    activatedDate: string | null;
    daysToActivation: number | null;
    activations: Array<{
      id: number;
      activationNumber: number;
      customerName: string | null;
      age: number | null;
      gender: string | null;
      province: string | null;
      createdAt: string;
    }>;
  }>;
  demographics: {
    gender: {
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
  };
}

export default function ClinicDetailPage() {
  const params = useParams();
  const locale = params?.locale as string || 'th';
  const clinicId = params?.id as string;
  const [data, setData] = useState<ClinicDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    if (clinicId) {
      fetchData();
    }
  }, [clinicId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics/clinics/${clinicId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch clinic details');
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
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
            {locale === 'th' ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'Error loading clinic details'}
          </p>
        </div>
      </div>
    );
  }

  const filteredProducts = data.products.filter((product) => {
    if (statusFilter === 'ALL') return true;
    return product.status === statusFilter;
  });

  // Prepare chart data
  const genderChartData = [
    { name: locale === 'th' ? 'ชาย' : 'Male', value: data.demographics.gender.male },
    { name: locale === 'th' ? 'หญิง' : 'Female', value: data.demographics.gender.female },
    { name: locale === 'th' ? 'อื่นๆ' : 'Other', value: data.demographics.gender.other },
  ].filter(item => item.value > 0);

  const ageChartData = [
    { name: '0-18', value: data.demographics.ageGroups['0-18'] },
    { name: '19-30', value: data.demographics.ageGroups['19-30'] },
    { name: '31-45', value: data.demographics.ageGroups['31-45'] },
    { name: '46-60', value: data.demographics.ageGroups['46-60'] },
    { name: '60+', value: data.demographics.ageGroups['60+'] },
  ].filter(item => item.value > 0);

  const COLORS = ['#C9A35A', '#2D2D2D', '#999999'];

  const totalDemographicData = genderChartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/${locale}/dashboard/analytics/clinics`}
          className="text-[#C9A35A] hover:underline text-sm mb-2 inline-block"
        >
          ← {locale === 'th' ? 'กลับรายการคลินิก' : 'Back to Clinics'}
        </Link>
        <h1 className="text-3xl font-bold text-[#2D2D2D]">{data.clinic.name}</h1>
        {data.clinic.branchName && (
          <p className="text-[#666666]">{data.clinic.branchName}</p>
        )}
        <p className="text-[#999999] text-sm">{data.clinic.province}</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-[#666666] mb-1">
            {locale === 'th' ? 'ส่งออกทั้งหมด' : 'Total Shipped'}
          </p>
          <p className="text-3xl font-bold text-[#2D2D2D]">{data.stats.totalShipped}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-[#666666] mb-1">
            {locale === 'th' ? 'เปิดใช้งานแล้ว' : 'Total Activated'}
          </p>
          <p className="text-3xl font-bold text-[#2D2D2D]">{data.stats.totalActivated}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-[#666666] mb-1">
            {locale === 'th' ? 'อัตราการเปิดใช้งาน' : 'Activation Rate'}
          </p>
          <p className="text-3xl font-bold text-[#2D2D2D]">
            {data.stats.activationRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Demographics */}
      {totalDemographicData > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gender Distribution */}
          {genderChartData.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-[#2D2D2D] mb-4">
                {locale === 'th' ? 'สัดส่วนเพศ' : 'Gender Distribution'}
              </h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={genderChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
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
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-[#2D2D2D] mb-4">
                {locale === 'th' ? 'กลุ่มอายุ' : 'Age Groups'}
              </h2>
              <ResponsiveContainer width="100%" height={250}>
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
      )}

      {/* Product Status Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#2D2D2D]">
            {locale === 'th' ? 'รายการสินค้า' : 'Product List'}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-sm ${
                statusFilter === 'ALL'
                  ? 'bg-[#C9A35A] text-white'
                  : 'bg-gray-100 text-[#666666] hover:bg-gray-200'
              }`}
            >
              {locale === 'th' ? 'ทั้งหมด' : 'All'} ({data.products.length})
            </button>
            <button
              onClick={() => setStatusFilter('SHIPPED')}
              className={`px-3 py-1 rounded-lg text-sm ${
                statusFilter === 'SHIPPED'
                  ? 'bg-[#C9A35A] text-white'
                  : 'bg-gray-100 text-[#666666] hover:bg-gray-200'
              }`}
            >
              {locale === 'th' ? 'ส่งออกแล้ว' : 'Shipped'} (
              {data.products.filter((p) => p.status === 'SHIPPED').length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVATED')}
              className={`px-3 py-1 rounded-lg text-sm ${
                statusFilter === 'ACTIVATED'
                  ? 'bg-[#C9A35A] text-white'
                  : 'bg-gray-100 text-[#666666] hover:bg-gray-200'
              }`}
            >
              {locale === 'th' ? 'เปิดใช้งานแล้ว' : 'Activated'} (
              {data.products.filter((p) => p.status === 'ACTIVATED').length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-semibold text-[#666666]">
                  {locale === 'th' ? 'Serial' : 'Serial'}
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-[#666666]">
                  {locale === 'th' ? 'SKU' : 'SKU'}
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-[#666666]">
                  {locale === 'th' ? 'สินค้า' : 'Product'}
                </th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-[#666666]">
                  {locale === 'th' ? 'สถานะ' : 'Status'}
                </th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-[#666666]">
                  {locale === 'th' ? 'วันที่ส่งออก' : 'Shipped Date'}
                </th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-[#666666]">
                  {locale === 'th' ? 'วันที่เปิดใช้งาน' : 'Activated Date'}
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-[#666666]">
                  {locale === 'th' ? 'จำนวนวัน' : 'Days'}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono text-sm">{product.serial12}</td>
                  <td className="py-3 px-4 text-sm text-[#666666]">{product.sku}</td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-sm text-[#2D2D2D]">{product.name}</p>
                      {product.activationType === 'PACK' && (
                        <p className="text-xs text-[#999999]">
                          {product.activationCount} / {product.maxActivations} {locale === 'th' ? 'ครั้ง' : 'times'}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        product.status === 'ACTIVATED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-sm text-[#666666]">
                    {product.shippedDate
                      ? new Date(product.shippedDate).toLocaleDateString(
                          locale === 'th' ? 'th-TH' : 'en-US'
                        )
                      : '-'}
                  </td>
                  <td className="py-3 px-4 text-center text-sm text-[#666666]">
                    {product.activatedDate
                      ? new Date(product.activatedDate).toLocaleDateString(
                          locale === 'th' ? 'th-TH' : 'en-US'
                        )
                      : '-'}
                  </td>
                  <td className="py-3 px-4 text-right text-sm">
                    {product.daysToActivation !== null ? (
                      <span className={product.daysToActivation <= 7 ? 'text-green-600 font-medium' : 'text-[#666666]'}>
                        {product.daysToActivation.toFixed(1)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[#999999]">
              {locale === 'th' ? 'ไม่พบข้อมูล' : 'No products found'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
