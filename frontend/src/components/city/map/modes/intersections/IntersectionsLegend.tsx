export default function IntersectionsLegend() {
    return (
        <div className="flex flex-col gap-y-2.5">
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: 'var(--yellow)' }} />
                <span className="text-xs font-semibold text-black/60">Intersecciones</span>
            </div>
        </div>
    );
}
