import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { PLATFORM_LABELS } from '@/shared/types/marketing';

interface PlatformMetric {
  platform: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
}

interface MetricsComparisonChartProps {
  data: PlatformMetric[];
  metric?: 'spend' | 'impressions' | 'clicks' | 'conversions';
  height?: number;
}

const COLORS: Record<string, string> = {
  meta: '#6366f1',
  google: '#10b981',
  tiktok: '#f43f5e',
  linkedin: '#3b82f6',
  email: '#8b5cf6',
};

const METRIC_LABELS: Record<string, string> = {
  spend: 'Harcama (TL)',
  impressions: 'Gosterim',
  clicks: 'Tiklama',
  conversions: 'Donusum',
};

const MetricsComparisonChart: React.FC<MetricsComparisonChartProps> = ({
  data,
  metric = 'spend',
  height = 280,
}) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm font-commons text-neutral-400">
        Platform verisi yok
      </div>
    );
  }

  const chartData = data.map(d => ({
    name: PLATFORM_LABELS[d.platform as keyof typeof PLATFORM_LABELS] || d.platform,
    value: d[metric],
    fill: COLORS[d.platform] || '#a3a3a3',
  }));

  return (
    <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
      <h3 className="text-lg font-commons font-semibold text-[#171717] mb-4">
        Platform Karsilastirmasi — {METRIC_LABELS[metric]}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fontFamily: 'TT Commons, sans-serif', fill: '#a3a3a3' }}
            axisLine={{ stroke: '#f5f5f5' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fontFamily: 'TT Commons, sans-serif', fill: '#a3a3a3' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              fontFamily: 'TT Commons, sans-serif',
              fontSize: 13,
              borderRadius: 8,
              border: '1px solid #e5e5e5',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
            formatter={(value: number) => [
              metric === 'spend' ? `${value.toLocaleString()} TL` : value.toLocaleString(),
              METRIC_LABELS[metric],
            ]}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={50}>
            {chartData.map((entry, idx) => (
              <rect key={idx} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MetricsComparisonChart;
