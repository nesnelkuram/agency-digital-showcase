import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { AggregatedMetrics } from '@/shared/utils/performanceAggregator';
import { formatChartDate } from '@/shared/utils/performanceAggregator';

interface ROASTrendChartProps {
  data: AggregatedMetrics[];
  height?: number;
  targetROAS?: number;
}

const ROASTrendChart: React.FC<ROASTrendChartProps> = ({ data, height = 280, targetROAS }) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm font-commons text-neutral-400">
        ROAS verisi yok
      </div>
    );
  }

  // Calculate CTR trend as proxy (ROAS needs revenue data)
  const chartData = data.map(d => ({
    ...d,
    ctrFormatted: d.ctr.toFixed(2),
  }));

  return (
    <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
      <h3 className="text-lg font-commons font-semibold text-[#171717] mb-4">CTR Trendi (%)</h3>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="ctrGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
          <XAxis
            dataKey="date"
            tickFormatter={formatChartDate}
            tick={{ fontSize: 11, fontFamily: 'TT Commons, sans-serif', fill: '#a3a3a3' }}
            axisLine={{ stroke: '#f5f5f5' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `%${v.toFixed(1)}`}
            tick={{ fontSize: 11, fontFamily: 'TT Commons, sans-serif', fill: '#a3a3a3' }}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          {targetROAS && (
            <ReferenceLine
              y={targetROAS}
              stroke="#ef4444"
              strokeDasharray="3 3"
              label={{
                value: `Hedef: %${targetROAS}`,
                position: 'right',
                fill: '#ef4444',
                fontSize: 11,
                fontFamily: 'TT Commons, sans-serif',
              }}
            />
          )}
          <Tooltip
            contentStyle={{
              fontFamily: 'TT Commons, sans-serif',
              fontSize: 13,
              borderRadius: 8,
              border: '1px solid #e5e5e5',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
            formatter={(value: number) => [`%${value.toFixed(2)}`, 'CTR']}
            labelFormatter={(label) => `Tarih: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="ctr"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#ctrGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#10b981' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ROASTrendChart;
