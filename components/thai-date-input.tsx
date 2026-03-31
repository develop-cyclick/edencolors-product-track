'use client';

import React from 'react';

interface ThaiDateInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
}

function formatThaiDate(isoDate: string): string {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  const buddhistYear = parseInt(year) + 543;
  return `${day}/${month}/${buddhistYear}`;
}

export default function ThaiDateInput({ value, onChange, className, required }: ThaiDateInputProps) {
  return (
    <div className="relative">
      <div
        className={`${className} pointer-events-none absolute inset-0 flex items-center `}
      >
        {value ? (
          <span>{formatThaiDate(value)}</span>
        ) : (
          <span className="text-gray-400">วว/ดด/ปปปป</span>
        )}
      </div>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={`${className} relative z-10 cursor-pointer w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
      />
    </div>
  );
}
