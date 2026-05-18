import { useState, useEffect } from 'react';
import type { CityData } from '../../constants/cities';
import { fetchCities } from '../../services/api';
import { formatPercentage, formatDistance } from '../../utils/formatters';

const BAR_COLOR = '#027A76';
const LINE_COLOR = '#00cac3';
const SLOT_COLORS = ['rgb(225,172,85)', 'rgb(175,71,73)'];
const ROW_H = 34;
const LABEL_W = 112;
const VW = 1000;   // SVG virtual width for sub-pixel line positioning

function niceTicks(max: number, count: number): number[] {
    if (max <= 0) return Array.from({ length: count + 1 }, (_, i) => i);
    const raw = max / count;
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = Math.ceil(raw / magnitude) * magnitude;
    return Array.from({ length: count + 1 }, (_, i) => Math.round(i * step));
}

function tickTranslate(v: number, ticks: number[]): string {
    if (v === ticks[0]) return 'translateX(0%)';
    if (v === ticks[ticks.length - 1]) return 'translateX(-100%)';
    return 'translateX(-50%)';
}

interface Props {
    selectedCities?: CityData[];
}

export default function CompareOverviewChart({ selectedCities = [] }: Props) {
    const [cities, setCities] = useState<CityData[]>([]);
    const [mounted, setMounted] = useState(false);
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    useEffect(() => {
        let active = true;
        fetchCities().then(data => {
            if (!active) return;
            const filtered = data.filter(c => c.coverage != null && c.cyclingNetwork != null);
            const sorted = [...filtered].sort((a, b) => (b.coverage ?? 0) - (a.coverage ?? 0));
            setCities(sorted);
            setTimeout(() => { if (active) setMounted(true); }, 80);
        });
        return () => { active = false; };
    }, []);

    if (cities.length === 0) {
        return (
            <div
                className="rounded-2xl animate-pulse"
                style={{ height: 320, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
        );
    }

    const n = cities.length;
    const totalH = n * ROW_H;

    const maxCovPct = Math.ceil((Math.max(...cities.map(c => c.coverage ?? 0)) * 100) / 10) * 10;
    const covStep = maxCovPct <= 40 ? 10 : 20;
    const covTicks = Array.from({ length: Math.floor(maxCovPct / covStep) + 1 }, (_, i) => i * covStep);

    const maxKm = Math.max(...cities.map(c => c.cyclingNetwork ?? 0), 1);
    const kmTicks = niceTicks(maxKm, 4);
    const kmMax = kmTicks[kmTicks.length - 1];

    const hovered = hoveredIdx !== null ? cities[hoveredIdx] : null;

    const getSlotColor = (city: CityData): string | null => {
        const idx = selectedCities.findIndex(c => c.path === city.path);
        return idx >= 0 ? SLOT_COLORS[idx] : null;
    };

    // Shared style for the SVG / dots overlay — covers chart-body area only
    const overlayStyle: React.CSSProperties = {
        position: 'absolute',
        left: LABEL_W,
        top: 0,
        width: `calc(100% - ${LABEL_W}px)`,
        height: totalH,
        overflow: 'visible',
        pointerEvents: 'none',
    };

    return (
        <div
            className="rounded-2xl p-4 md:p-5"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                    <h3 className="text-sm font-bold text-white">Cobertura y red ciclista</h3>
                    <p className="text-xs text-white/50 mt-0.5">Ordenadas por cobertura de edificios junto a carril bici</p>
                </div>
                <div className="flex gap-4 shrink-0">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: BAR_COLOR }} />
                        <span className="text-xs text-white/60">Cobertura (%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-0.5 rounded-full" style={{ backgroundColor: LINE_COLOR }} />
                        <span className="text-xs text-white/60">Red (km)</span>
                    </div>
                </div>
            </div>

            <div>

                    {/* Top axis — km */}
                    <div style={{ paddingLeft: LABEL_W, marginBottom: 4 }}>
                        <div className="relative" style={{ height: 16 }}>
                            {kmTicks.map(v => (
                                <span
                                    key={v}
                                    className="absolute text-[9px] tabular-nums leading-none"
                                    style={{
                                        left: `${(v / kmMax) * 100}%`,
                                        bottom: 0,
                                        transform: tickTranslate(v, kmTicks),
                                        color: `${LINE_COLOR}99`,
                                    }}
                                >
                                    {v} km
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Rows container — DOM order is critical:
                        1. row separators + bars (bottom)
                        2. SVG grid + polyline (middle — on top of bars)
                        3. dots wrapper (top — on top of line)
                        4. tooltip */}
                    <div className="relative" style={{ height: totalH, overflow: 'visible' }}>

                        {/* Row separators */}
                        {cities.map((_, i) => i > 0 && (
                            <div
                                key={i}
                                className="absolute left-0 right-0"
                                style={{ top: i * ROW_H, borderTop: '1px solid rgba(255,255,255,0.04)' }}
                            />
                        ))}

                        {/* City rows — bars only, no dots (dots rendered separately above the line) */}
                        {cities.map((city, i) => {
                            const coveragePct = (city.coverage ?? 0) * 100;
                            const barWidthPct = (coveragePct / maxCovPct) * 100;
                            const isHov = hoveredIdx === i;
                            const slotColor = getSlotColor(city);

                            return (
                                <div
                                    key={city.path}
                                    className="absolute flex items-center cursor-pointer"
                                    style={{ top: i * ROW_H, height: ROW_H, left: 0, right: 0 }}
                                    onMouseEnter={() => setHoveredIdx(i)}
                                    onMouseLeave={() => setHoveredIdx(null)}
                                >
                                    {/* City label */}
                                    <div
                                        className="shrink-0 flex items-center gap-1.5 pr-2"
                                        style={{ width: LABEL_W }}
                                    >
                                        {slotColor && (
                                            <div
                                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                                style={{ backgroundColor: slotColor }}
                                            />
                                        )}
                                        <span
                                            className="text-[11px] truncate"
                                            style={{
                                                color: slotColor ?? (isHov ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.65)'),
                                                fontWeight: slotColor || isHov ? 600 : 400,
                                                transition: 'color 0.15s',
                                            }}
                                        >
                                            {city.name}
                                        </span>
                                    </div>

                                    {/* Coverage bar */}
                                    <div className="flex-1 relative" style={{ height: ROW_H }}>
                                        <div
                                            className="absolute rounded-r-sm"
                                            style={{
                                                left: 0,
                                                top: '30%',
                                                height: '40%',
                                                width: mounted ? `${barWidthPct}%` : 0,
                                                backgroundColor: BAR_COLOR,
                                                opacity: isHov ? 1 : 0.8,
                                                filter: isHov && !slotColor ? 'brightness(1.25)' : 'none',
                                                transition: `width 0.65s cubic-bezier(0.34,1.56,0.64,1) ${i * 35}ms, opacity 0.15s`,
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}

                        {/* SVG: grid lines + km polyline — rendered after bars so line paints on top */}
                        <svg
                            style={overlayStyle}
                            viewBox={`0 0 ${VW} ${totalH}`}
                            preserveAspectRatio="none"
                        >
                            {/* Coverage % vertical grid lines */}
                            {covTicks.filter(v => v > 0).map(v => (
                                <line
                                    key={`cov-${v}`}
                                    x1={(v / maxCovPct) * VW} y1={0}
                                    x2={(v / maxCovPct) * VW} y2={totalH}
                                    stroke="rgba(255,255,255,0.07)"
                                    strokeWidth={1}
                                />
                            ))}
                            {/* km vertical grid lines — dashed teal */}
                            {kmTicks.filter(v => v > 0).map(v => (
                                <line
                                    key={`km-${v}`}
                                    x1={(v / kmMax) * VW} y1={0}
                                    x2={(v / kmMax) * VW} y2={totalH}
                                    stroke={`${LINE_COLOR}28`}
                                    strokeWidth={1}
                                    strokeDasharray="3,3"
                                />
                            ))}
                            {/* km connecting polyline */}
                            {mounted && (
                                <polyline
                                    points={cities.map((city, i) => {
                                        const x = ((city.cyclingNetwork ?? 0) / kmMax) * VW;
                                        const y = i * ROW_H + ROW_H / 2;
                                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                                    }).join(' ')}
                                    fill="none"
                                    stroke={LINE_COLOR}
                                    strokeWidth={2.5}
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                    opacity={0.8}
                                />
                            )}
                        </svg>

                        {/* Dots wrapper — rendered after SVG so dots paint on top of the line.
                            Same position/size as SVG; dots use left% + top(px) matching polyline coords. */}
                        {mounted && (
                            <div style={overlayStyle}>
                                {cities.map((city, i) => {
                                    const kmWidthPct = ((city.cyclingNetwork ?? 0) / kmMax) * 100;
                                    const isHov = hoveredIdx === i;
                                    const size = isHov ? 13 : 9;
                                    return (
                                        <div
                                            key={city.path}
                                            className="absolute rounded-full"
                                            style={{
                                                width: size,
                                                height: size,
                                                left: `${kmWidthPct}%`,
                                                top: i * ROW_H + ROW_H / 2,
                                                transform: 'translate(-50%, -50%)',
                                                backgroundColor: LINE_COLOR,
                                                transition: 'width 0.15s, height 0.15s',
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        )}

                        {/* Tooltip — right-anchored, vertically centered on the hovered row */}
                        {hovered && hoveredIdx !== null && (
                            <div
                                className="absolute z-30 pointer-events-none rounded-xl px-3 py-2"
                                style={{
                                    right: 4,
                                    top: hoveredIdx * ROW_H + ROW_H / 2,
                                    transform: 'translateY(-50%)',
                                    background: 'rgba(0,20,35,0.95)',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    backdropFilter: 'blur(8px)',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                <p className="text-[11px] font-bold text-white mb-1.5">{hovered.name}</p>
                                <div className="flex items-center gap-1.5 mb-1">
                                    <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: getSlotColor(hovered) ?? BAR_COLOR }} />
                                    <span className="text-[10px] text-white/70">{formatPercentage(hovered.coverage ?? 0)}% cobertura</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-0.5 rounded-full shrink-0" style={{ backgroundColor: LINE_COLOR }} />
                                    <span className="text-[10px] text-white/70">{formatDistance(hovered.cyclingNetwork ?? 0)} km red</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom axis — coverage % */}
                    <div style={{ paddingLeft: LABEL_W, marginTop: 4 }}>
                        <div className="relative" style={{ height: 16 }}>
                            {covTicks.map(v => (
                                <span
                                    key={v}
                                    className="absolute text-[9px] tabular-nums leading-none"
                                    style={{
                                        left: `${(v / maxCovPct) * 100}%`,
                                        top: 2,
                                        transform: tickTranslate(v, covTicks),
                                        color: 'rgba(255,255,255,0.4)',
                                    }}
                                >
                                    {v}%
                                </span>
                            ))}
                        </div>
                    </div>

            </div>
        </div>
    );
}
