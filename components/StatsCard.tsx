import React from 'react';

type Props = { title: string; value: number | string; className?: string };

export default function StatsCard({ title, value, className = '' }: Props) {
  return (
    <div className={`p-4 bg-white rounded-2xl shadow flex-1 ${className}`}>
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-2xl font-bold mt-2">{value}</div>
    </div>
  );
}
