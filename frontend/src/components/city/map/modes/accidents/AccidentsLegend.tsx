import React from 'react';

const SEVERITY_LEGEND = [
    { label: 'Fatal (Fallecidos)', color: '#7f1d1d' },
    { label: 'Grave (Hospitalizados)', color: '#dc2626' },
    { label: 'Leve (Asistencia Sanitaria)', color: '#f59e0b' },
    { label: 'Ileso / Sin Asistencia', color: '#3b82f6' },
];

export default function AccidentsLegend() {
    return (
        <div className="flex flex-col gap-y-3">
            <h3 className="text-sm font-bold font-[Archivo_Narrow] text-slate-800 border-b border-black/5 pb-1 mb-1">
                Accidentes Ciclistas
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
                Se muestran únicamente accidentes en los que al menos un ciclista o bicicleta estuvo implicado.
            </div>
        </div>
    );
}
