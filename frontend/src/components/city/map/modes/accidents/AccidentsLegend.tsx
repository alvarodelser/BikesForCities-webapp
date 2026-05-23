import { useEffect, useState } from 'react';
import { useMapState } from '../../../../../hooks/useMapState';

const SEVERITY_LEGEND = [
    { label: 'Fatal (Fallecidos)', color: '#7f1d1d' },
    { label: 'Grave (Hospitalizados)', color: '#dc2626' },
    { label: 'Leve (Asistencia Sanitaria)', color: '#f59e0b' },
    { label: 'Ileso / Sin Asistencia', color: '#3b82f6' },
];

export default function AccidentsLegend() {
    const { submode } = useMapState();
    const isBike = submode !== 'all';

    const [hasSelection, setHasSelection] = useState(false);
    useEffect(() => {
        const handler = (e: Event) => setHasSelection(!!(e as CustomEvent).detail);
        window.addEventListener('map-selection', handler);
        return () => window.removeEventListener('map-selection', handler);
    }, []);

    if (hasSelection) {
        return (
            <p className="text-[9px] text-black/35 italic leading-tight">
                Accidente seleccionado
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-y-3">
            <h3 className="text-sm font-bold text-slate-800 border-b border-black/5 pb-1 mb-1" style={{ fontFamily: "'Archivo Narrow', sans-serif" }}>
                {isBike ? 'Accidentes Ciclistas' : 'Todos los Accidentes'}
            </h3>

            <div className="flex flex-col gap-y-2.5">
                {SEVERITY_LEGEND.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                        <div
                            className="w-3.5 h-3.5 rounded-full border border-white shadow-sm flex-shrink-0"
                            style={{ backgroundColor: item.color }}
                        />
                        <span className="text-xs font-semibold text-black/70 leading-tight">
                            {item.label}
                        </span>
                    </div>
                ))}
            </div>

            <div className="mt-2 text-[10px] text-slate-500 font-medium leading-relaxed bg-black/5 p-2 rounded-lg">
                {isBike
                    ? 'Filtrado: accidentes con al menos una bicicleta o VMU implicada.'
                    : 'Mostrando todos los accidentes registrados en la ciudad.'}
            </div>
        </div>
    );
}
