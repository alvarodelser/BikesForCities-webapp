import React, { useEffect, useMemo, useState } from 'react';
import {
  Route, TrendingUp, Bike, MessageSquare,
} from 'lucide-react';
import { fetchSystemStatus, type SystemStatus, type TimePeriodRow } from '../services/api';

import { MAP_MODES } from '../constants/mapModes';

// ─── Palette & helpers ───────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string; fill: string }> = {
  SUCCESS:      { bg: 'color-mix(in srgb,var(--green-light) 35%,transparent)', text: 'var(--green-dark)', dot: 'var(--green)',  fill: '#22c55e' },
  RUNNING:      { bg: 'color-mix(in srgb,#fde68a 40%,transparent)',            text: '#92400e',           dot: '#f59e0b',       fill: '#f59e0b' },
  FAILED:       { bg: 'color-mix(in srgb,#fecaca 40%,transparent)',            text: '#991b1b',           dot: '#ef4444',       fill: '#ef4444' },
  FAILED_MONTH: { bg: 'color-mix(in srgb,#fed7aa 40%,transparent)',            text: '#9a3412',           dot: '#f97316',       fill: '#f97316' },
  SKIPPED:      { bg: 'color-mix(in srgb,#e2e8f0 40%,transparent)',            text: '#475569',           dot: '#94a3b8',       fill: '#94a3b8' },
};
const defaultStyle = STATUS_STYLE.SKIPPED;

const CITY_COLORS = ['#027A76','#3A6C7F','#7BA492','#F4A24C','#AF4749','#92BEC9','#FF7F50'];

const MODE_META: { key: string; Icon: React.FC<{ size?: number; color?: string }>; label: string }[] = [
  { key: MAP_MODES.INFRASTRUCTURE, Icon: Route,          label: 'Infrastructure' },
  { key: MAP_MODES.TRAFFIC,        Icon: TrendingUp,     label: 'Traffic'        },
  { key: MAP_MODES.STATIONS,       Icon: Bike,           label: 'Stations'       },
  { key: 'forum',                  Icon: MessageSquare,  label: 'Forum'          },
];

function fmt(n: number | undefined | null) { return (n ?? 0).toLocaleString('es-ES'); }

// ─── Small components ────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? defaultStyle;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
          style={{ backgroundColor: s.bg, color: s.text }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.dot }} />
      {status}
    </span>
  );
}

function Badge({ color, children }: { color: 'green' | 'blue'; children: React.ReactNode }) {
  const green = color === 'green';
  return (
    <span className="inline-block text-xs font-semibold uppercase tracking-widest mb-2 px-3 py-1 rounded-full"
          style={{
            color: green ? 'var(--green-dark)' : 'var(--blue-dark)',
            backgroundColor: green
              ? 'color-mix(in srgb,var(--green-light) 40%,transparent)'
              : 'color-mix(in srgb,var(--blue-light) 35%,transparent)',
          }}>
      {children}
    </span>
  );
}

// ─── City table ──────────────────────────────────────────────────────────────

function CityTable({ cities }: { cities: SystemStatus['cities'] }) {
  const allFeatTypes = useMemo(() => {
    const known = ['bike_lane', 'building'];
    const found = new Set(cities.flatMap(c => Object.keys(c.features ?? {})));
    return [...known.filter(k => found.has(k)), ...([...found].filter(k => !known.includes(k)).sort())];
  }, [cities]);

  return (
    <div className="rounded-2xl overflow-x-auto border" style={{ borderColor: 'color-mix(in srgb,var(--blue-light) 50%,transparent)' }}>
      <table className="w-full text-sm whitespace-nowrap">
        <thead>
          <tr style={{ backgroundColor: 'color-mix(in srgb,var(--blue-light) 25%,white)' }}>
            {['Ciudad', 'Modos', 'Nodos', 'Aristas', 'Rutas', 'Estaciones', 'Viajes/mes',
              ...allFeatTypes].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--blue-dark)' }}>{h.replace('_', ' ')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cities.map((city, i) => (
            <tr key={city.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : 'color-mix(in srgb,var(--blue-light) 10%,white)' }}>
              <td className="px-4 py-3 font-semibold" style={{ color: 'var(--black)' }}>{city.name}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  {MODE_META.map(({ key, Icon, label }) => {
                    const on = city.available_modes?.[key];
                    return (
                      <span key={key} title={label}>
                        <Icon size={14} color={on ? 'var(--green-dark)' : '#cbd5e1'} />
                      </span>
                    );
                  })}
                </div>
              </td>
              <td className="px-4 py-3" style={{ color: 'color-mix(in srgb,var(--black) 70%,transparent)' }}>{fmt(city.nodes)}</td>
              <td className="px-4 py-3" style={{ color: 'color-mix(in srgb,var(--black) 70%,transparent)' }}>{fmt(city.edges)}</td>
              <td className="px-4 py-3" style={{ color: 'color-mix(in srgb,var(--black) 70%,transparent)' }}>{fmt(city.routes)}</td>
              <td className="px-4 py-3" style={{ color: 'color-mix(in srgb,var(--black) 70%,transparent)' }}>{fmt(city.stations_count)}</td>
              <td className="px-4 py-3" style={{ color: 'color-mix(in srgb,var(--black) 70%,transparent)' }}>{fmt(city.monthly_trips)}</td>
              {allFeatTypes.map(ft => (
                <td key={ft} className="px-4 py-3" style={{ color: 'color-mix(in srgb,var(--black) 70%,transparent)' }}>
                  {fmt(city.features?.[ft] ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Scatter plot ─────────────────────────────────────────────────────────────

function ScatterPlot({ cities }: { cities: SystemStatus['cities'] }) {
  const W = 600, H = 360, ML = 70, MR = 20, MT = 20, MB = 50;
  const pw = W - ML - MR, ph = H - MT - MB;

  const maxN = Math.max(...cities.map(c => c.nodes), 1);
  const maxE = Math.max(...cities.map(c => c.edges), 1);

  const tx = (n: number) => ML + (n / maxN) * pw;
  const ty = (e: number) => MT + ph - (e / maxE) * ph;

  const ticks = 5;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ background: 'white', borderRadius: 12 }}>
      {/* Grid */}
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const gx = ML + (i / ticks) * pw;
        const gy = MT + (i / ticks) * ph;
        return (
          <g key={i}>
            <line x1={gx} y1={MT} x2={gx} y2={MT + ph} stroke="#f1f5f9" strokeWidth={1} />
            <line x1={ML} y1={gy} x2={ML + pw} y2={gy} stroke="#f1f5f9" strokeWidth={1} />
            <text x={gx} y={MT + ph + 16} textAnchor="middle" fontSize={9} fill="#94a3b8">
              {fmt(Math.round((maxN * i) / ticks))}
            </text>
            <text x={ML - 6} y={MT + ph - (ph * i) / ticks + 4} textAnchor="end" fontSize={9} fill="#94a3b8">
              {fmt(Math.round((maxE * i) / ticks))}
            </text>
          </g>
        );
      })}
      {/* Axes */}
      <line x1={ML} y1={MT} x2={ML} y2={MT + ph} stroke="#cbd5e1" strokeWidth={1.5} />
      <line x1={ML} y1={MT + ph} x2={ML + pw} y2={MT + ph} stroke="#cbd5e1" strokeWidth={1.5} />
      <text x={ML + pw / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="#64748b">Nodos</text>
      <text x={12} y={MT + ph / 2} textAnchor="middle" fontSize={11} fill="#64748b"
            transform={`rotate(-90,12,${MT + ph / 2})`}>Aristas</text>
      {/* Dots */}
      {cities.map((city, idx) => {
        const x = tx(city.nodes), y = ty(city.edges);
        const color = CITY_COLORS[idx % CITY_COLORS.length];
        return (
          <g key={city.id}>
            <circle cx={x} cy={y} r={8} fill={color} fillOpacity={0.85} stroke="white" strokeWidth={1.5} />
            <text x={x + 12} y={y + 4} fontSize={11} fill="#334155" fontWeight={600}>{city.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Temporal coverage chart ──────────────────────────────────────────────────

function parseTimePeriod(tp: string): { start: Date; months: number } {
  if (/^\d{6}$/.test(tp)) {
    return { start: new Date(+tp.slice(0, 4), +tp.slice(4, 6) - 1, 1), months: 1 };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(tp)) {
    const d = new Date(tp);
    return { start: new Date(d.getUTCFullYear(), d.getUTCMonth(), 1), months: 1 };
  }
  if (/^\d{4}$/.test(tp)) {
    return { start: new Date(+tp, 0, 1), months: 12 };
  }
  return { start: new Date(tp), months: 1 };
}

function monthDiff(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function TemporalChart({ rows = [] }: { rows?: TimePeriodRow[] }) {
  const ROW_H = 22, CITY_H = 30, CITY_GAP = 10;
  const ML = 270, MR = 24, MT = 28, MB = 36;
  const SVG_W = 920;
  const PW = SVG_W - ML - MR;

  const grouped = useMemo(() => {
    const byCity: Record<string, Record<string, TimePeriodRow[]>> = {};
    for (const r of rows) {
      (byCity[r.city] ??= {})[r.process_name] ??= [];
      byCity[r.city][r.process_name].push(r);
    }
    return Object.entries(byCity).sort(([a], [b]) => a.localeCompare(b)).map(([city, procs]) => ({
      city,
      procs: Object.entries(procs).sort(([a], [b]) => a.localeCompare(b)),
    }));
  }, [rows]);

  const { minDate, totalMonths } = useMemo(() => {
    const parsed = rows.map(r => parseTimePeriod(r.time_period));
    const starts = parsed.map(p => p.start.getTime());
    const ends = parsed.map(p => {
      const d = new Date(p.start);
      d.setMonth(d.getMonth() + p.months);
      return d.getTime();
    });
    if (!starts.length) return { minDate: new Date(), totalMonths: 12 };
    const min = new Date(Math.min(...starts));
    const max = new Date(Math.max(...ends));
    min.setDate(1);
    max.setDate(1);
    max.setMonth(max.getMonth() + 1);
    return { minDate: min, totalMonths: Math.max(monthDiff(min, max), 1) };
  }, [rows]);

  const xOf = (d: Date) => ML + (monthDiff(minDate, d) / totalMonths) * PW;
  const wOf = (months: number) => Math.max((months / totalMonths) * PW - 2, 4);

  // Build y positions
  type RowEntry = { city: string; proc: string; y: number };
  const rowEntries: RowEntry[] = [];
  const cityY: { city: string; y: number; rowCount: number }[] = [];
  let curY = MT;
  for (const { city, procs } of grouped) {
    cityY.push({ city, y: curY, rowCount: procs.length });
    curY += CITY_H;
    for (const [proc] of procs) {
      rowEntries.push({ city, proc, y: curY });
      curY += ROW_H;
    }
    curY += CITY_GAP;
  }
  const totalH = curY + MB;

  // Year tick marks
  const startYear = minDate.getFullYear();
  const endYear = new Date(minDate.getFullYear(), minDate.getMonth() + totalMonths, 1).getFullYear();
  const yearTicks: { year: number; x: number }[] = [];
  for (let y = startYear; y <= endYear + 1; y++) {
    const d = new Date(y, 0, 1);
    if (monthDiff(minDate, d) >= 0 && monthDiff(minDate, d) <= totalMonths) {
      yearTicks.push({ year: y, x: xOf(d) });
    }
  }

  if (!rows.length) return (
    <p className="text-sm py-8 text-center" style={{ color: 'color-mix(in srgb,var(--black) 40%,transparent)' }}>
      No hay datos de períodos de tiempo.
    </p>
  );

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${SVG_W} ${totalH}`} style={{ width: '100%', minWidth: 600 }}>
        {/* Year grid + labels */}
        {yearTicks.map(({ year, x }) => (
          <g key={year}>
            <line x1={x} y1={MT - 8} x2={x} y2={totalH - MB} stroke="#e2e8f0" strokeWidth={1} />
            <text x={x} y={MT - 10} textAnchor="middle" fontSize={10} fill="#94a3b8">{year}</text>
          </g>
        ))}

        {/* City sections */}
        {cityY.map(({ city, y, rowCount }) => (
          <g key={city}>
            <rect x={0} y={y - 2} width={SVG_W} height={CITY_H + rowCount * ROW_H + 4}
                  style={{ fill: '#f0faf7' }} rx={6} />
            <text x={8} y={y + CITY_H - 8} fontSize={12} fontWeight={700} style={{ fill: '#015a57' }}>{city}</text>
          </g>
        ))}

        {/* Process rows */}
        {rowEntries.map(({ city, proc, y }) => {
          const procRows = grouped.find(g => g.city === city)?.procs.find(([p]) => p === proc)?.[1] ?? [];
          return (
            <g key={`${city}/${proc}`}>
              <text x={ML - 8} y={y + ROW_H / 2 + 4} textAnchor="end" fontSize={10} fill="#475569">
                {proc.replace(/^\d+_/, '')}
              </text>
              {procRows.map(r => {
                const { start, months } = parseTimePeriod(r.time_period);
                const x = xOf(start);
                const w = wOf(months);
                const s = STATUS_STYLE[r.status] ?? defaultStyle;
                return (
                  <rect key={r.time_period} x={x} y={y + 3} width={w} height={ROW_H - 6}
                        rx={3} fill={s.fill} fillOpacity={0.85}>
                    <title>{r.time_period} — {r.status}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}

        {/* X axis base */}
        <line x1={ML} y1={totalH - MB} x2={ML + PW} y2={totalH - MB} stroke="#cbd5e1" strokeWidth={1} />

        {/* Legend */}
        {(['SUCCESS', 'RUNNING', 'FAILED', 'SKIPPED'] as const).map((s, i) => {
          const style = STATUS_STYLE[s];
          return (
            <g key={s} transform={`translate(${ML + i * 110},${totalH - MB + 14})`}>
              <rect width={10} height={10} rx={2} fill={style.fill} fillOpacity={0.85} />
              <text x={14} y={9} fontSize={10} fill="#64748b">{s}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Ingestion table ──────────────────────────────────────────────────────────

function IngestionTable({ rows = [] }: { rows?: SystemStatus['ingestion'] }) {
  const [cityFilter, setCityFilter] = useState('');
  const [procFilter, setProcFilter] = useState('');

  const cities = useMemo(() => [...new Set(rows.map(r => r.city))].sort(), [rows]);
  const procs  = useMemo(() => [...new Set(rows.map(r => r.process_name))].sort(), [rows]);

  const filtered = rows.filter(r =>
    (!cityFilter || r.city === cityFilter) &&
    (!procFilter || r.process_name === procFilter)
  );

  const selectStyle: React.CSSProperties = {
    backgroundColor: 'white',
    border: '1px solid color-mix(in srgb,var(--green-light) 60%,transparent)',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 13,
    color: 'var(--black)',
    outline: 'none',
    cursor: 'pointer',
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} style={selectStyle}>
          <option value="">Todas las ciudades</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={procFilter} onChange={e => setProcFilter(e.target.value)} style={selectStyle}>
          <option value="">Todos los procesos</option>
          {procs.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {(cityFilter || procFilter) && (
          <button onClick={() => { setCityFilter(''); setProcFilter(''); }}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: 'color-mix(in srgb,var(--green-light) 30%,transparent)', color: 'var(--green-dark)' }}>
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'color-mix(in srgb,var(--green-light) 50%,transparent)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'color-mix(in srgb,var(--green-light) 20%,white)' }}>
              {['Ciudad', 'Proceso', 'Estado', 'Actualizado'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--green-dark)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-6 text-center text-sm"
                      style={{ color: 'color-mix(in srgb,var(--black) 40%,transparent)' }}>Sin resultados.</td></tr>
            ) : filtered.map((row, i) => (
              <tr key={`${row.city}-${row.process_name}`}
                  style={{ backgroundColor: i % 2 === 0 ? 'white' : 'color-mix(in srgb,var(--green-light) 8%,white)' }}>
                <td className="px-5 py-3 font-semibold" style={{ color: 'var(--black)' }}>{row.city}</td>
                <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--black)' }}>{row.process_name}</td>
                <td className="px-5 py-3"><StatusPill status={row.status} /></td>
                <td className="px-5 py-3 text-xs" style={{ color: 'color-mix(in srgb,var(--black) 50%,transparent)' }}>
                  {row.updated_at
                    ? new Date(row.updated_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const StatusPage: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    fetchSystemStatus().then(setStatus).catch(e => setError(e.message));
  }, []);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--cream)' }}>
      <p className="text-sm" style={{ color: '#991b1b' }}>Error: {error}</p>
    </div>
  );

  if (!status) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--cream)' }}>
      <p className="text-sm" style={{ color: 'color-mix(in srgb,var(--black) 50%,transparent)' }}>Cargando…</p>
    </div>
  );

  const generatedAt = new Date(status.generated_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
  const ingestion = status.ingestion ?? [];
  const failedCount  = ingestion.filter(r => r.status.startsWith('FAILED')).length;
  const runningCount = ingestion.filter(r => r.status === 'RUNNING').length;

  const totalNodes  = status.cities.reduce((s, c) => s + c.nodes, 0);
  const totalEdges  = status.cities.reduce((s, c) => s + c.edges, 0);
  const totalRoutes = status.cities.reduce((s, c) => s + c.routes, 0);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--cream)', fontFamily: 'var(--body)' }}>
      <div className="max-w-6xl mx-auto px-6 pt-32 pb-24 md:py-24 space-y-20">

        {/* Header */}
        <section>
          <Badge color="green">Sistema</Badge>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-3" style={{ color: 'var(--black)' }}>
            Estado del sistema
          </h1>
          <p className="text-sm flex flex-wrap items-center gap-3" style={{ color: 'color-mix(in srgb,var(--black) 50%,transparent)' }}>
            <span>Actualizado el {generatedAt}</span>
            {failedCount > 0 && (
              <span className="font-semibold text-xs" style={{ color: '#991b1b' }}>
                · {failedCount} proceso{failedCount > 1 ? 's' : ''} con error
              </span>
            )}
            {runningCount > 0 && (
              <span className="font-semibold text-xs" style={{ color: '#92400e' }}>
                · {runningCount} ejecutándose
              </span>
            )}
          </p>
        </section>

        {/* Summary */}
        <section>
          <Badge color="green">Resumen</Badge>
          <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--black)' }}>Datos cargados</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Ciudades',  value: status.cities.length },
              { label: 'Nodos',     value: fmt(totalNodes) },
              { label: 'Aristas',   value: fmt(totalEdges) },
              { label: 'Rutas',     value: fmt(totalRoutes) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl p-5 border"
                   style={{ backgroundColor: 'color-mix(in srgb,var(--green-light) 20%,white)', borderColor: 'color-mix(in srgb,var(--green-light) 60%,transparent)' }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--green-dark)' }}>{label}</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--black)' }}>{value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* City table */}
        <section>
          <Badge color="blue">Ciudades</Badge>
          <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--black)' }}>Por ciudad</h2>
          <CityTable cities={status.cities} />
        </section>

        {/* Charts row */}
        <section>
          <Badge color="green">Cobertura temporal</Badge>
          <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--black)' }}>Períodos de ingesta</h2>
          <div className="rounded-2xl p-4 border" style={{ backgroundColor: 'white', borderColor: 'color-mix(in srgb,var(--green-light) 40%,transparent)' }}>
            <TemporalChart rows={status.ingestion_time_periods} />
          </div>
        </section>

        <section>
          <Badge color="blue">Grafo</Badge>
          <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--black)' }}>Nodos vs Aristas</h2>
          <div className="rounded-2xl p-4 border" style={{ backgroundColor: 'white', borderColor: 'color-mix(in srgb,var(--blue-light) 40%,transparent)' }}>
            <ScatterPlot cities={status.cities} />
          </div>
        </section>

        {/* Ingestion table */}
        <section className="pb-12">
          <Badge color="green">Ingesta</Badge>
          <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--black)' }}>Estado de la ingesta</h2>
          <IngestionTable rows={ingestion} />
        </section>

      </div>
    </div>
  );
};

export default StatusPage;
