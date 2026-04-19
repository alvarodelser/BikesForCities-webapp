import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import type { CityData } from '../../constants/cities';
import { getModeStats } from '../../constants/cityStats';
import { useMapState } from '../../hooks/useMapState';
import { useViewport } from '../../hooks/useViewport';
import MapFilters from './MapFilters';
import CityMap from './CityMap';
import CityStats from './CityStats';
import DualPanel from './DualPanel';

const modeNames: Record<string, string> = {
    'infrastructure': 'Infraestructura',
    'traffic':        'Tráfico',
    'stations':       'Estaciones',
    'terrain':        'Terreno',
    'intersections':  'Intersecciones',
    'accidents':      'Accidentes',
};

const modeColors: Record<string, string> = {
    'infrastructure': 'var(--blue)',
    'traffic':        'var(--red)',
    'stations':       'var(--green)',
    'terrain':        'var(--orange)',
    'intersections':  'var(--yellow)',
    'accidents':      'var(--red)',
};

interface MapSectionProps {
    city: CityData;
}

const MapSection: React.FC<MapSectionProps> = ({ city }) => {
    const { mode, setMode } = useMapState();
    const { isUltrawide } = useViewport();
    const [,setSearchParams] = useSearchParams();

    const isModeAvailable = (m: string | null): boolean => {
        if (!m) return false;
        if (m === 'infrastructure') return true;
        if (!modeNames[m]) return false;
        if (city.available_modes) return city.available_modes[m] === true;
        if (m === 'stations') return (city.stations_count || 0) > 0;
        return false;
    };

    // Redirect to infrastructure if the mode param is invalid for this city
    useEffect(() => {
        if (!isModeAvailable(mode)) {
            setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                next.set('mode', 'infrastructure');
                next.delete('submode');
                return next;
            }, { replace: true });
        }
    }, [mode, city.id]);

    const selectedColor = modeColors[mode] || 'var(--blue)';
    const modeStats = getModeStats(mode, city);
    const modeName  = modeNames[mode] || mode;
    const title    = `Estadísticas de ${modeName}`;
    const subtitle = `Análisis detallado de datos de ${modeName.toLowerCase()} en ${city.name}`;

    const filters = (
        <MapFilters
            city={city}
            selectedMode={mode}
            onModeChange={(newMode) => setMode(newMode)}
            isModeAvailable={isModeAvailable}
        />
    );
    const map   = <CityMap city={city} selectedColor={selectedColor} />;
    const stats = <CityStats title={title} subtitle={subtitle} modeStats={modeStats} />;

    if (!isUltrawide) {
        return (
            <div className="w-full">
                {filters}
                {map}
                {stats}
            </div>
        );
    }

    return (
        <div className="w-full">
            <DualPanel>
                <DualPanel.Left>
                    {filters}
                    {stats}
                </DualPanel.Left>
                <DualPanel.Right>
                    {map}
                </DualPanel.Right>
            </DualPanel>
        </div>
    );
};

export default MapSection;