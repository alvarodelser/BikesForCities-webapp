import type { CityData } from '../../../constants/cities';
import StaticCityMap from '../StaticCityMap';
import CompareTrafficChart from '../CompareTrafficChart';

const SLOT_COLORS = ['rgb(225,172,85)', 'rgb(175,71,73)'];
const CHART_COLORS = ['rgba(225,172,85,0.9)', 'rgba(175,71,73,0.9)'];

interface TrafficCompareContentProps {
    selectedCities: CityData[];
}

export default function TrafficCompareContent({ selectedCities }: TrafficCompareContentProps) {
    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {[0, 1].map(idx => {
                    const city = selectedCities[idx];
                    const cityColor = SLOT_COLORS[idx];

                    if (!city) {
                        return (
                            <div key={idx}>
                                <div
                                    className="relative w-full overflow-hidden rounded-2xl flex flex-col items-center justify-center"
                                    style={{
                                        aspectRatio: '1 / 1',
                                        border: '2px solid rgba(255,255,255,0.08)',
                                        backgroundColor: 'rgba(255,255,255,0.03)',
                                    }}
                                >
                                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/[0.08] flex items-center justify-center">
                                        <span className="text-white/20 text-xl font-bold">{idx + 1}</span>
                                    </div>
                                    <p className="text-white/20 text-xs uppercase tracking-widest font-bold mt-3">Sin selección</p>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={idx}>
                            <div
                                className="relative w-full overflow-hidden rounded-2xl"
                                style={{ aspectRatio: '1 / 1', border: `2px solid ${cityColor}` }}
                            >
                                <div className="absolute inset-0">
                                    <StaticCityMap city={city} mode="traffic" />
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 mt-2 px-1">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cityColor }} />
                                <span className="text-white/70 text-sm font-semibold">{city.name}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {selectedCities.length > 0 && (
                <CompareTrafficChart
                    cities={selectedCities}
                    colors={CHART_COLORS.slice(0, selectedCities.length)}
                />
            )}
        </div>
    );
}
