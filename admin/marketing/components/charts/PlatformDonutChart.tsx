import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PLATFORM_LABELS } from '@/shared/types/marketing';

interface PlatformDonutChartProps {
  data: Array<{
    platform: string;
    spend: number;
  }>;
  height?: number;
}

const COLORS: Record<string, string> = {
  meta: '#6366f1',
  google: '#10b981',
  tiktok: '#f43f5e',
  linkedin: '#3b82f6',
  email: '#8b5cf6',
};

const PlatformDonutChart: React.FC<PlatformDonutChartProps> = ({ data, height = 280 }) => {
  const filteredData = data.filter(d => d.spend > 0);

  if (filteredData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm font-commons text-neutral-400">
        Butce verisi yok
      </div>
    );
  }

  const totalSpend = filteredData.reduce((sum, d) => sum + d.spend, 0);

  const chartData = filteredData.map(d => ({
    name: PLATFORM_LABELS[d.platform as keyof typeof PLATFORM_LABELS] || d.platform,
    value: d.spend,
    color: COLORS[d.platform] || '#a3a3a3',
    percent: ((d.spend / totalSpend) * 100).toFixed(1),
  }));

  return (
    <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
      <h3 className="text-lg font-commons font-semibold text-[#171717] mb-4">Butce Dagilimi</h3>
      <div className="flex items-center gap-6">
        <div className="flex-1">
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
              >
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  fontFamily: 'TT Commons, sans-serif',
                  fontSize: 13,
                  borderRadius: 8,
                  border: '1px solid #e5e5e5',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
                formatter={(value: number) => [`${value.toLocaleString()} TL`, 'Harcama']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3 min-w-[140px]">
          {chartData.map((entry) => (
            <div key={entry.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <div>
                <p className="text-sm font-commons font-medium text-[#171717]">{entry.name}</p>
                <p className="text-xs font-commons text-neutral-500">%{entry.percent}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlatformDonutChart;
