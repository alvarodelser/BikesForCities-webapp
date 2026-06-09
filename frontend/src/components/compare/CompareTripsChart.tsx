import { useState, useEffect, useRef } from 'react';
import type { CityData } from '../../constants/cities';
import { fetchCities, fetchStationMonthly } from '../../services/api';
import { fmtMonth } from '../../utils/formatters';

const COLORS = [
    '#00cac3', '#e1ac55', '#af4749', '#3b9ddd', '#84cc16',
    '#a855f7', '#f97316', '#e05fa3', '#22d3ee', '#facc15',
    '#f43f5e', '#10b981',
];

const ROW_H = 34;   // mirror CompareOverviewChart so card heights match
const VW = 1000;
const ML = 64;
const MR = 210;     // wider: room for leader lines + city labels
const MT = 16;
const MB = 36;
const CW = VW - ML - MR;
const MIN_GAP = 22;
const TOOLTIP_Y_THRESHOLD = 50; // viewBox units (~px) — how close the cursor must be to a line

interface Pt { month: string; trips: number }
interface Series { city: CityData; color: string; points: Pt[] }

function niceYTicks(max: number, n = 4): number[] {
    if (max <= 0) return [0];
    const raw = max / n;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = Math.ceil(raw / mag) * mag;
    return Array.from({ length: n + 1 }, (_, i) => i * step);
}

function fmtTrips(v: number): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
    return String(v);
}

function spreadY(items: { y: number; i: number }[], ch: number): { y: number; i: number }[] {
    const s = [...items].sort((a, b) => a.y - b.y);
    for (let k = 1; k < s.length; k++) {
        if (s[k].y - s[k - 1].y < MIN_GAP) s[k].y = s[k - 1].y + MIN_GAP;
    }
    for (let k = s.length - 1; k >= 1; k--) {
        if (s[k].y > ch) s[k].y = ch;
        if (s[k].y - s[k - 1].y < MIN_GAP) s[k - 1].y = s[k].y - MIN_GAP;
    }
    for (const item of s) item.y = Math.max(0, Math.min(ch, item.y));
    return s;
}

function smoothLinePath(pts: { x: number; y: number }[], tension = 0.35): string {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    if (pts.length === 2) {
        return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} L${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`;
    }
    let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        const cp1x = p1.x + (p2.x - p0.x) * tension;
        const cp1y = p1.y + (p2.y - p0.y) * tension;
        const cp2x = p2.x - (p3.x - p1.x) * tension;
        const cp2y = p2.y - (p3.y - p1.y) * tension;
        d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
}

const SLOT_COLORS = ['rgb(225,172,85)', 'rgb(175,71,73)'];

interface Props {
    selectedCities?: CityData[];
}

export default function CompareTripsChart({ selectedCities = [] }: Props) {
    const getSlotColor = (city: CityData): string | null => {
        const idx = selectedCities.findIndex(c => c.path === city.path);
        return idx >= 0 ? SLOT_COLORS[idx] : null;
    };
    const [series, setSeries] = useState<Series[]>([]);
    const [allMonths, setAllMonths] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [hovered, setHovered] = useState<number | null>(null);
    const [hoverX, setHoverX] = useState<number | null>(null);  // chart-area x in viewBox units
    const [hoverY, setHoverY] = useState<number | null>(null);  // chart-area y in viewBox units (1:1 with px since VH=svgH)
    const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        let active = true;
        fetchCities().then(async cities => {
            const withId = cities.filter(c => c.id != null);
            const results = await Promise.all(
                withId.map(city =>
                    fetchStationMonthly(city.id!)
                        .then(data => ({ city, data }))
                        .catch(() => ({ city, data: [] as Awaited<ReturnType<typeof fetchStationMonthly>> }))
                )
            );
            if (!active) return;

            const monthSet = new Set<string>();
            results.forEach(({ data }) => {
                data.forEach(pt => { if (pt.month) monthSet.add(pt.month); });
            });
            const months = Array.from(monthSet).sort();

            let colorIdx = 0;
            const built: Series[] = [];
            results.forEach(({ city, data }) => {
                const pts = data
                    .filter(pt => {
                        if (!pt.month) return false;
                        const val = pt.estimated_trips;
                        return val != null && val >= 0;
                    })
                    .map(pt => ({
                        month: pt.month!,
                        trips: pt.estimated_trips!,
                    }))
                    .sort((a, b) => a.month.localeCompare(b.month));
                if (pts.length > 0) {
                    built.push({ city, color: COLORS[colorIdx++ % COLORS.length], points: pts });
                }
            });

            if (active) {
                setSeries(built);
                setAllMonths(months);
                setLoading(false);
            }
        });
        return () => { active = false; };
    }, []);

    if (loading) {
        return (
            <div
                className="rounded-2xl animate-pulse"
                style={{ height: 400, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
        );
    }

    if (!series.length || !allMonths.length) {
        return (
            <div
                className="rounded-2xl flex items-center justify-center"
                style={{ height: 280, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
                <p className="text-sm text-white/30">Sin datos de viajes disponibles</p>
            </div>
        );
    }

    const svgH = Math.max(200, 40 + series.length * ROW_H);
    const VH = svgH;
    const CH = VH - MT - MB;

    const maxTrips = Math.max(...series.flatMap(s => s.points.map(p => p.trips)));
    const yTicks = niceYTicks(maxTrips);
    const yMax = yTicks[yTicks.length - 1] || 1;

    const xOf = (month: string) => {
        const idx = allMonths.indexOf(month);
        return allMonths.length < 2 ? CW / 2 : (idx / (allMonths.length - 1)) * CW;
    };
    const yOf = (trips: number) => CH - (trips / yMax) * CH;

    const yearTicks: { x: number; year: string }[] = [];
    let lastYr = '';
    allMonths.forEach(m => {
        const yr = m.slice(0, 4);
        if (yr !== lastYr) { yearTicks.push({ x: xOf(m), year: yr }); lastYr = yr; }
    });

    const rawLabels = series.map((s, i) => ({
        y: yOf(s.points[s.points.length - 1].trips),
        i,
    }));
    const labels = spreadY(rawLabels, CH);

    // Nearest month to mouse position
    const nearestMonthIdx = hoverX !== null
        ? Math.max(0, Math.min(allMonths.length - 1, Math.round((hoverX / CW) * (allMonths.length - 1))))
        : null;
    const nearestMonth = nearestMonthIdx !== null ? allMonths[nearestMonthIdx] : null;

    // Cities with data at the nearest month, filtered to those whose line is close to the cursor y
    const tooltipCities = (nearestMonth && hoverY !== null)
        ? series
            .map((s, i) => {
                const pt = s.points.find(p => p.month === nearestMonth);
                return { s, i, pt };
            })
            .filter(({ pt }) => {
                if (!pt) return false;
                return Math.abs(yOf(pt.trips) - hoverY) < TOOLTIP_Y_THRESHOLD;
            })
            .sort((a, b) => b.pt!.trips - a.pt!.trips)
        : [];

    // Tooltip x position in container %
    const tooltipLeftPct = nearestMonth !== null
        ? ((ML + xOf(nearestMonth)) / VW) * 100
        : null;
    const flipTooltip = tooltipLeftPct !== null && tooltipLeftPct > 62;

    const handleSVGMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const svgEl = svgRef.current;
        const containerEl = containerRef.current;
        if (!svgEl || !containerEl) return;
        const svgRect = svgEl.getBoundingClientRect();
        const containerRect = containerEl.getBoundingClientRect();
        const svgX = ((e.clientX - svgRect.left) / svgRect.width) * VW;
        const chartX = svgX - ML;
        // VH === svgH so y-scale is 1:1 between viewBox units and CSS px
        const chartY = (e.clientY - svgRect.top) - MT;
        setHoverX(chartX >= 0 && chartX <= CW ? chartX : null);
        setHoverY(chartY >= 0 && chartY <= CH ? chartY : null);
        setTooltipPos({
            x: e.clientX - containerRect.left,
            y: e.clientY - containerRect.top,
        });
    };

    const handleSVGMouseLeave = () => {
        setHoverX(null);
        setHoverY(null);
        setTooltipPos(null);
    };

    return (
        <div
            ref={containerRef}
            className="rounded-2xl p-4 md:p-5"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}
        >
            <div className="mb-4">
                <h3 className="text-sm font-bold text-white">Viajes mensuales en bici compartida</h3>
                <p className="text-xs text-white/50 mt-0.5">Número de viajes por mes desde el primer dato disponible</p>
            </div>

            <svg
                ref={svgRef}
                viewBox={`0 0 ${VW} ${VH}`}
                style={{ width: '100%', height: svgH, display: 'block', cursor: 'crosshair' }}
                preserveAspectRatio="none"
                onMouseMove={handleSVGMouseMove}
                onMouseLeave={handleSVGMouseLeave}
            >
                <defs>
                    <clipPath id="trips-chart-clip">
                        <rect x={0} y={0} width={CW} height={CH} />
                    </clipPath>
                    {series.map(s => (
                        <linearGradient
                            key={s.city.id}
                            id={`trips-grad-${s.city.id}`}
                            x1="0" y1="0" x2="0" y2="1"
                        >
                            <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
                            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                        </linearGradient>
                    ))}
                </defs>

                <g transform={`translate(${ML},${MT})`}>
                    {/* Horizontal grid lines + Y axis labels */}
                    {yTicks.map(t => (
                        <g key={t}>
                            <line
                                x1={0} y1={yOf(t)}
                                x2={CW} y2={yOf(t)}
                                stroke="rgba(255,255,255,0.07)"
                                strokeWidth={1}
                            />
                            <text
                                x={-8} y={yOf(t)}
                                textAnchor="end"
                                dominantBaseline="middle"
                                fontSize={20}
                                fill="rgba(255,255,255,0.35)"
                            >
                                {fmtTrips(t)}
                            </text>
                        </g>
                    ))}

                    {/* Vertical year grid lines + X axis labels */}
                    {yearTicks.map(({ x, year }) => (
                        <g key={year}>
                            <line
                                x1={x} y1={0}
                                x2={x} y2={CH}
                                stroke="rgba(255,255,255,0.05)"
                                strokeWidth={1}
                                strokeDasharray="3,4"
                            />
                            <text
                                x={x} y={CH + 20}
                                textAnchor="middle"
                                fontSize={20}
                                fill="rgba(255,255,255,0.3)"
                            >
                                {year}
                            </text>
                        </g>
                    ))}

                    {/* City lines + area fills — clipped to chart area */}
                    <g clipPath="url(#trips-chart-clip)">
                        {series.map((s, i) => {
                            const pts = s.points.map(pt => ({
                                x: xOf(pt.month),
                                y: yOf(pt.trips),
                            }));
                            const linePath = smoothLinePath(pts);
                            const firstX = pts[0].x;
                            const lastX = pts[pts.length - 1].x;
                            const areaD = `${linePath} L${lastX.toFixed(1)},${CH} L${firstX.toFixed(1)},${CH} Z`;
                            const isHovered = hovered === i;
                            const isDimmed = hovered !== null && !isHovered;

                            return (
                                <g
                                    key={s.city.id}
                                    onMouseEnter={() => setHovered(i)}
                                    onMouseLeave={() => setHovered(null)}
                                    style={{ cursor: 'crosshair' }}
                                >
                                    <path
                                        d={areaD}
                                        fill={`url(#trips-grad-${s.city.id})`}
                                        style={{
                                            opacity: isHovered ? 1 : 0,
                                            transition: 'opacity 0.2s',
                                            pointerEvents: 'none',
                                        }}
                                    />
                                    <path
                                        d={linePath}
                                        fill="none"
                                        stroke={s.color}
                                        strokeWidth={isHovered ? 5 : 2.5}
                                        strokeLinejoin="round"
                                        strokeLinecap="round"
                                        style={{
                                            opacity: isDimmed ? 0.15 : isHovered ? 1 : 0.75,
                                            transition: 'opacity 0.2s, stroke-width 0.15s',
                                            pointerEvents: 'none',
                                        }}
                                    />
                                    {/* Wide transparent hit area */}
                                    <path
                                        d={linePath}
                                        fill="none"
                                        stroke="transparent"
                                        strokeWidth={16}
                                    />
                                </g>
                            );
                        })}
                    </g>

                    {/* Vertical crosshair at nearest month */}
                    {nearestMonth && (
                        <line
                            x1={xOf(nearestMonth)} y1={0}
                            x2={xOf(nearestMonth)} y2={CH}
                            stroke="rgba(255,255,255,0.18)"
                            strokeWidth={1}
                            strokeDasharray="4,3"
                            style={{ pointerEvents: 'none' }}
                        />
                    )}

                    {/* City name labels at right border — also trigger hover */}
                    {labels.map(({ y, i }) => {
                        const s = series[i];
                        const lineEndY = yOf(s.points[s.points.length - 1].trips);
                        const isHovered = hovered === i;
                        const isDimmed = hovered !== null && !isHovered;
                        const slotColor = getSlotColor(s.city);
                        const textX = slotColor ? CW + 36 : CW + 22;
                        return (
                            <g
                                key={s.city.id}
                                onMouseEnter={() => setHovered(i)}
                                onMouseLeave={() => setHovered(null)}
                                style={{ cursor: 'pointer' }}
                            >
                                {Math.abs(y - lineEndY) > 3 && (
                                    <line
                                        x1={CW + 4} y1={lineEndY}
                                        x2={CW + 20} y2={y}
                                        stroke={s.color}
                                        strokeWidth={1}
                                        style={{
                                            opacity: isDimmed ? 0.1 : 0.45,
                                            transition: 'opacity 0.2s',
                                        }}
                                    />
                                )}
                                {slotColor && (
                                    <circle
                                        cx={CW + 27}
                                        cy={y}
                                        r={6}
                                        fill={slotColor}
                                        style={{
                                            opacity: isDimmed ? 0.2 : 1,
                                            transition: 'opacity 0.2s',
                                        }}
                                    />
                                )}
                                <text
                                    x={textX}
                                    y={y}
                                    dominantBaseline="middle"
                                    fontSize={isHovered ? 22 : 19}
                                    fill={slotColor ?? s.color}
                                    fontWeight={isHovered || slotColor ? 700 : 500}
                                    style={{
                                        opacity: isDimmed ? 0.2 : 1,
                                        transition: 'opacity 0.2s',
                                    }}
                                >
                                    {s.city.name}
                                </text>
                            </g>
                        );
                    })}
                </g>
            </svg>

            {/* Tooltip */}
            {tooltipPos && nearestMonth && tooltipCities.length > 0 && (
                <div
                    className="absolute z-30 pointer-events-none rounded-xl px-3 py-2.5"
                    style={{
                        left: tooltipPos.x,
                        top: tooltipPos.y,
                        transform: `translate(${flipTooltip ? 'calc(-100% - 12px)' : '12px'}, -50%)`,
                        background: 'rgba(0,20,35,0.95)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(8px)',
                        whiteSpace: 'nowrap',
                    }}
                >
                    <p className="text-[10px] font-bold text-white/50 mb-1.5 uppercase tracking-wider">
                        {fmtMonth(nearestMonth)}
                    </p>
                    {tooltipCities.map(({ s, i, pt }) => (
                        <div
                            key={i}
                            className="flex items-center gap-2 mb-1 last:mb-0"
                            style={{ opacity: hovered !== null && hovered !== i ? 0.4 : 1 }}
                        >
                            <div
                                className="w-3 h-0.5 rounded-full shrink-0"
                                style={{ backgroundColor: s.color }}
                            />
                            <span className="text-[10px] text-white/80 font-medium">{s.city.name}</span>
                            <span className="text-[10px] font-bold ml-auto pl-3" style={{ color: s.color }}>
                                {fmtTrips(pt!.trips)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
