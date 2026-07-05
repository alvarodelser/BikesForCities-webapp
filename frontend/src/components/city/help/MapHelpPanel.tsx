import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useHelpContext } from './HelpContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MapHelpPanelProps {
  anchors: { id: string; title: string }[];
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MapHelpPanel({ anchors, onClose }: MapHelpPanelProps) {
  const helpCtx = useHelpContext();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const handleAnchorClick = (id: string) => {
    helpCtx.focus(id);
    onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/60 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Panel de ayuda"
        className={[
          // Stack above everything
          'fixed z-[9999]',
          // Desktop: bottom-left floating panel
          'md:bottom-6 md:left-6 md:w-72 md:rounded-2xl md:max-h-[60vh] md:top-auto md:right-auto',
          // Mobile: full-screen
          'inset-0',
          // Appearance
          'flex flex-col',
          'bg-gray-900/95 backdrop-blur-lg border border-white/20 shadow-2xl',
          'animate-fade-in',
        ].join(' ')}
      >
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          .animate-fade-in {
            animation: fadeIn 0.2s ease-out forwards;
          }
        `}</style>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <h2 className="text-sm font-semibold text-white tracking-wide">Ayuda del mapa</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Cerrar panel de ayuda"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Anchor list */}
        <div className="overflow-y-auto flex-1 py-2">
          {anchors.length === 0 ? (
            <p className="px-4 py-3 text-sm text-white/50 italic">
              No hay secciones de ayuda disponibles.
            </p>
          ) : (
            <ul role="list">
              {anchors.map(({ id, title }) => (
                <li key={id}>
                  <button
                    onClick={() => handleAnchorClick(id)}
                    className={[
                      'w-full text-left px-4 py-2.5 text-sm text-white/80',
                      'hover:bg-white/10 hover:text-white transition-colors',
                      'flex items-center gap-2',
                    ].join(' ')}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" aria-hidden="true" />
                    {title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

export default MapHelpPanel;
