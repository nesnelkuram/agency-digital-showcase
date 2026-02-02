import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import type { AggregatedMetrics } from '@/shared/utils/performanceAggregator';
import { formatChartDate, formatCompact } from '@/shared/utils/performanceAggregator';

interface SpendTrendChartProps {
  data: AggregatedMetrics[];
  height?: number;
  showArea?: boolean;
}

const CHART_COLORS = {
  spend: '#6366f1',
  grid: '#f5f5f5',
  axis: '#a3a3a3',
};

const SpendTrendChart: React.FC<SpendTrendChartProps> = ({ data, height = 280, showArea = true }) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm font-commons text-neutral-400">
        Grafik icin yeterli veri yok
      </div>
    );
  }

  const ChartComponent = showArea ? AreaChart : LineChart;

  return (
    <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
      <h3 className="text-lg font-commons font-semibold text-[#171717] mb-4">Harcama Trendi</h3>
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.spend} stopOpacity={0.15} />
              <stop offset="95%" stopColor={CHART_COLORS.spend} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis
            dataKey="date"
            tickFormatter={formatChartDate}
            tick={{ fontSize: 11, fontFamily: 'TT Commons, sans-serif', fill: CHART_COLORS.axis }}
            axisLine={{ stroke: CHART_COLORS.grid }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `${formatCompact(v)} TL`}
            tick={{ fontSize: 11, fontFamily: 'TT Commons, sans-serif', fill: CHART_COLORS.axis }}
            axisLine={false}
            tickLine={false}
            width={70}
          />
          <Tooltip
            contentStyle={{
              fontFamily: 'TT Commons, sans-serif',
              fontSize: 13,
              borderRadius: 8,
              border: '1px solid #e5e5e5',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
            formatter={(value: number) => [`${value.toFixed(2)} TL`, 'Harcama']}
            labelFormatter={(label) => `Tarih: ${label}`}
          />
          {showArea ? (
            <Area
              type="monotone"
              dataKey="spend"
              stroke={CHART_COLORS.spend}
              strokeWidth={2}
              fill="url(#spendGradient)"
              dot={false}
              activeDot={{ r: 4, fill: CHART_COLORS.spend }}
            />
          ) : (
            <Line
              type="monotone"
              dataKey="spend"
              stroke={CHART_COLORS.spend}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
};

export default SpendTrendChart;
