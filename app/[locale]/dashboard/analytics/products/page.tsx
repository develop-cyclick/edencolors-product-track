'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ActivationRateBadge from '@/components/analytics/activation-rate-badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ProductData {
  products: Array<{
    productMasterId: number;
    sku: string;
    nameTh: string;
    categoryNameTh: string;
    activationType: string;
    maxActivations: number;
    totalShipped: number;
    totalActivated: number;
    totalActivationCount: number;
    activationRate: number;
  }>;
  categories: Array<{
    categoryId: number;
    categoryNameTh: string;
    categoryNameEn: string | null;
    totalShipped: number;
    totalActivated: number;
    activationRate: number;
  }>;
  allCategories: Array<{
    id: number;
    nameTh: string;
    nameEn: string | null;
  }>;
}

export default function ProductsPage() {
  const params = useParams();
  const locale = params?.locale as string || 'th';
  const [data, setData] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, [selectedCategory, selectedType]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory) params.append('categoryId', selectedCategory);
      if (selectedType) params.append('activationType', selectedType);

      const response = await fetch(`/api/analytics/products?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch product data');
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
            {locale === 'th' ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล' : 'Error loading product data'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/${locale}/dashboard/analytics`}
          className="text-[#C9A35A] hover:underline text-sm mb-2 inline-block"
        >
          ← {locale === 'th' ? 'กลับ' : 'Back to Analytics'}
        </Link>
        <h1 className="text-3xl font-bold text-[#2D2D2D]">
          {locale === 'th' ? 'วิเคราะห์สินค้า' : 'Product Analytics'}
        </h1>
        <p className="text-[#666666] mt-1">
          {data.products.length} {locale === 'th' ? 'รายการ' : 'products'}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-[#666666] mb-2">
              {locale === 'th' ? 'หมวดหมู่' : 'Category'}
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A35A]"
            >
              <option value="">{locale === 'th' ? 'ทั้งหมด' : 'All Categories'}</option>
              {data.allCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {locale === 'th' ? category.nameTh : category.nameEn || category.nameTh}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-[#666666] mb-2">
              {locale === 'th' ? 'ประเภทการเปิดใช้งาน' : 'Activation Type'}
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A35A]"
            >
              <option value="">{locale === 'th' ? 'ทั้งหมด' : 'All Types'}</option>
              <option value="SINGLE">{locale === 'th' ? 'ครั้งเดียว' : 'Single'}</option>
              <option value="PACK">{locale === 'th' ? 'หลายครั้ง' : 'Pack'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Category Comparison Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-[#2D2D2D] mb-4">
          {locale === 'th' ? 'เปรียบเทียบหมวดหมู่' : 'Category Comparison'}
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.categories}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={locale === 'th' ? 'categoryNameTh' : 'categoryNameEn'} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="totalShipped"
              fill="#C9A35A"
              name={locale === 'th' ? 'ส่งออก' : 'Shipped'}
            />
            <Bar
              dataKey="totalActivated"
              fill="#2D2D2D"
              name={locale === 'th' ? 'เปิดใช้งาน' : 'Activated'}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-semibold text-[#666666]">
                  {locale === 'th' ? 'SKU' : 'SKU'}
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-[#666666]">
                  {locale === 'th' ? 'สินค้า' : 'Product'}
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-[#666666]">
                  {locale === 'th' ? 'หมวดหมู่' : 'Category'}
                </th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-[#666666]">
                  {locale === 'th' ? 'ประเภท' : 'Type'}
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
              {data.products.map((product) => (
                <tr key={product.productMasterId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono text-sm">{product.sku}</td>
                  <td className="py-3 px-4">
                    <p className="text-sm text-[#2D2D2D]">{product.nameTh}</p>
                  </td>
                  <td className="py-3 px-4 text-sm text-[#666666]">
                    {product.categoryNameTh}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        product.activationType === 'PACK'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {product.activationType === 'PACK' ? (
                        <>
                          PACK
                          {product.totalActivationCount > 0 && (
                            <span className="ml-1">
                              ({product.totalActivationCount} / {product.totalActivated * product.maxActivations})
                            </span>
                          )}
                        </>
                      ) : (
                        'SINGLE'
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-[#2D2D2D]">
                    {product.totalShipped}
                  </td>
                  <td className="py-3 px-4 text-right text-[#2D2D2D]">
                    {product.totalActivated}
                    {product.activationType === 'PACK' && product.totalActivationCount > 0 && (
                      <span className="text-xs text-[#999999] ml-1">
                        ({product.totalActivationCount})
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <ActivationRateBadge rate={product.activationRate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.products.length === 0 && (
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
