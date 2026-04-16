export default function TerrainLegend() {
    return (
        <div className="flex flex-col gap-y-2.5">
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: '#8d6e63' }} />
                <span className="text-xs font-semibold text-black/60">Zonas de Pendiente</span>
            </div>
        </div>
    );
}
