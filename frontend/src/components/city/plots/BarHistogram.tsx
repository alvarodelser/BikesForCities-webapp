import React, { type ReactNode, useState } from 'react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import GlassCard from '../../ui/GlassCard';

interface BarHistogramProps {
  data: { label: string; value: number }[];
  accent: string;
  title: string;
  subtitle?: string;
  helpContent?: ReactNode;
  gradient?: boolean;
  referenceLineX?: number;
  referenceLabel?: string;
}

const GRADIENT_ID = 'barHistogramGradient';

export const BarHistogram: React.FC<BarHistogramProps> = ({
  data,
  accent,
  title,
  subtitle,
  helpContent,
  gradient = false,
  referenceLineX,
  referenceLabel,
}) => {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <GlassCard surface="glass" className="w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-base font-semibold text-gray-800 leading-tight">{title}</h3>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {helpContent && (
          <button
            type="button"
            aria-label="Toggle help"
            onClick={() => setShowHelp((v) => !v)}
            className="ml-2 flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none"
          >
            ❓
          </button>
        )}
      </div>

      {/* Help overlay */}
      {showHelp && helpContent && (
        <div className="mb-3 rounded-xl bg-white/70 border border-gray-200 p-3 text-sm text-gray-700 shadow-inner">
          {helpContent}
        </div>
      )}

      {/* Chart */}
      <div className="w-full" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            {gradient && (
              <defs>
                <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={1} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0.35} />
                </linearGradient>
              </defs>
            )}
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: '#d1d5db' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(255,255,255,0.95)',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#1f2937',
              }}
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            />
            {referenceLineX !== undefined && (
              <ReferenceLine
                x={referenceLineX}
                stroke="#ef4444"
                strokeDasharray="4 4"
                label={
                  referenceLabel
                    ? { value: referenceLabel, position: 'top', fontSize: 11, fill: '#ef4444' }
                    : undefined
                }
              />
            )}
            <Bar
              dataKey="value"
              fill={gradient ? `url(#${GRADIENT_ID})` : accent}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
};

export default BarHistogram;
