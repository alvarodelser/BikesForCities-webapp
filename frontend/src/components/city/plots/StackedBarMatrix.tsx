import React, { type ReactNode, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
  Cell,
} from 'recharts';
import GlassCard from '../../ui/GlassCard';

interface Segment {
  value: number;
  color: string;
  label: string;
}

interface RowData {
  label: string;
  total: number;
  segments: Segment[];
}

interface StackedBarMatrixProps {
  rows: RowData[];
  segmentLabels: string[];
  title: string;
  subtitle?: string;
  helpContent?: ReactNode;
  onRowClick?: (rowLabel: string) => void;
}

// Convert row segments to percentage values keyed by segmentLabels index
function normaliseRow(row: RowData, numSegments: number) {
  const pct: Record<string, number> = { _rowLabel: 0, _total: row.total };
  // Store the label so XAxis/YAxis can reference it
  const result: Record<string, number | string> = {
    rowLabel: row.label,
    _total: row.total,
  };
  for (let i = 0; i < numSegments; i++) {
    const seg = row.segments[i];
    result[`seg_${i}`] = seg && row.total > 0 ? (seg.value / row.total) * 100 : 0;
  }
  return result;
}

// Custom tooltip that shows raw segment values
function buildTooltipContent(
  rows: RowData[],
  segmentLabels: string[],
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const row = rows.find((r) => r.label === label);
    return (
      <div
        style={{
          background: 'rgba(255,255,255,0.97)',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '13px',
          color: '#1f2937',
          minWidth: 150,
        }}
      >
        <p className="font-semibold mb-1">{label}</p>
        {payload.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (entry: any, idx: number) => {
            const segIdx = parseInt(entry.dataKey.replace('seg_', ''), 10);
            const segLabel = segmentLabels[segIdx] ?? entry.dataKey;
            const rawValue = row?.segments[segIdx]?.value ?? 0;
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: entry.fill,
                    flexShrink: 0,
                  }}
                />
                <span>{segLabel}: </span>
                <span className="font-medium">{rawValue}</span>
                <span className="text-gray-400">({entry.value?.toFixed(1)}%)</span>
              </div>
            );
          },
        )}
        {row && (
          <div className="mt-1 pt-1 border-t border-gray-200 text-gray-500">
            Total: <span className="font-semibold text-gray-700">{row.total}</span>
          </div>
        )}
      </div>
    );
  };
}

// Custom legend renderer
function buildLegend(segmentLabels: string[], rows: RowData[]) {
  return function CustomLegend() {
    return (
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
        {segmentLabels.map((lbl, i) => {
          // Get the color from the first row that has this segment index
          const color = rows[0]?.segments[i]?.color ?? '#9ca3af';
          return (
            <span key={lbl} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: color,
                  flexShrink: 0,
                }}
              />
              {lbl}
            </span>
          );
        })}
      </div>
    );
  };
}

// Custom label showing total count at right end of bar
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TotalLabel({ x, y, width, height, value }: any) {
  if (!value) return null;
  return (
    <text
      x={(x ?? 0) + (width ?? 0) + 6}
      y={(y ?? 0) + (height ?? 0) / 2}
      dominantBaseline="middle"
      fontSize={11}
      fill="#6b7280"
    >
      {value}
    </text>
  );
}

export const StackedBarMatrix: React.FC<StackedBarMatrixProps> = ({
  rows,
  segmentLabels,
  title,
  subtitle,
  helpContent,
  onRowClick,
}) => {
  const [showHelp, setShowHelp] = useState(false);

  const numSegments = segmentLabels.length;
  const chartData = rows.map((r) => normaliseRow(r, numSegments));

  // Bar height + gap per row; min chart height ensures usability
  const barHeight = 28;
  const barGap = 10;
  const chartHeight = Math.max(200, rows.length * (barHeight + barGap) + 60);

  const CustomTooltip = buildTooltipContent(rows, segmentLabels);
  const CustomLegend = buildLegend(segmentLabels, rows);

  return (
    <GlassCard surface="glass" className="w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-base font-semibold text-gray-800 leading-tight">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
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
      <div className="w-full" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 4, right: 48, bottom: 4, left: 80 }}
            barSize={barHeight}
            onClick={
              onRowClick
                ? (payload) => {
                    if (payload?.activePayload?.[0]) {
                      const rowLabel = payload.activePayload[0].payload?.rowLabel as string | undefined;
                      if (rowLabel) onRowClick(rowLabel);
                    }
                  }
                : undefined
            }
          >
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="rowLabel"
              tick={{ fontSize: 12, fill: '#374151' }}
              axisLine={false}
              tickLine={false}
              width={76}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Legend content={<CustomLegend />} />

            {Array.from({ length: numSegments }, (_, i) => {
              const isLast = i === numSegments - 1;
              return (
                <Bar
                  key={`seg_${i}`}
                  dataKey={`seg_${i}`}
                  stackId="stack"
                  name={segmentLabels[i]}
                  radius={
                    i === 0 && numSegments === 1
                      ? [4, 4, 4, 4]
                      : i === 0
                        ? [4, 0, 0, 4]
                        : isLast
                          ? [0, 4, 4, 0]
                          : [0, 0, 0, 0]
                  }
                  isAnimationActive={false}
                >
                  {rows.map((row, rowIdx) => (
                    <Cell key={`cell-${rowIdx}`} fill={row.segments[i]?.color ?? '#9ca3af'} />
                  ))}
                  {isLast && (
                    <LabelList
                      dataKey="_total"
                      content={<TotalLabel />}
                    />
                  )}
                </Bar>
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
};

export default StackedBarMatrix;
