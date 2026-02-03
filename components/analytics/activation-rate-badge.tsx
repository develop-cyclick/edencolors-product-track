import React from 'react';

interface ActivationRateBadgeProps {
  rate: number;
  showPercentage?: boolean;
}

export default function ActivationRateBadge({ rate, showPercentage = true }: ActivationRateBadgeProps) {
  // Color coding: <50% red, 50-75% yellow, >75% green
  let bgColor = 'bg-red-100';
  let textColor = 'text-red-700';

  if (rate >= 75) {
    bgColor = 'bg-green-100';
    textColor = 'text-green-700';
  } else if (rate >= 50) {
    bgColor = 'bg-yellow-100';
    textColor = 'text-yellow-700';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
      {rate.toFixed(1)}{showPercentage && '%'}
    </span>
  );
}
