import React from 'react';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down';
    label: string;
  };
  color?: string;
  textColor?: string;
}

export default function StatsCard({
  label,
  value,
  icon,
  trend,
  color = 'bg-[#C9A35A]',
  textColor = 'text-white',
}: StatsCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-[#444444] mb-1">{label}</p>
          <p className="text-3xl font-bold text-[#2D2D2D]">{value}</p>
          {trend && (
            <div className="flex items-center mt-2">
              {trend.direction === 'up' ? (
                <svg className="w-4 h-4 text-green-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-red-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              )}
              <span className={`text-sm ${trend.direction === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                {trend.value}%
              </span>
              <span className="text-sm text-[#666666] ml-1">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={`${color} ${textColor} p-4 rounded-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
