import React, { useMemo, useState } from 'react';
import { ListChecks, MagnifyingGlass } from '@phosphor-icons/react';

const ACCENT = '#3A6C7F';

interface CategoryHighlightControlProps {
  categories: { code: string; name: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

export const CategoryHighlightControl: React.FC<CategoryHighlightControlProps> = ({
  categories,
  selected,
  onChange,
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      c => c.name.toLowerCase().includes(q) || c.code.includes(q),
    );
  }, [categories, query]);

  const toggle = (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange(next);
  };

  return (
    <div
      className="rounded-2xl border bg-white/80 backdrop-blur-sm overflow-hidden w-1/3 flex flex-col"
      style={{ borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`, boxShadow: `0 4px 12px ${ACCENT}55` }}
        >
          <ListChecks size={16} color="white" weight="bold" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-[var(--blue-dark)]">Áreas destacadas</h3>
          <p className="text-[10px] text-[var(--blue)] opacity-70 leading-snug">
            Elige qué áreas resaltar en el gráfico y seguir en el tiempo.
          </p>
        </div>
      </div>

      <div className="px-4 pb-2">
        <div className="relative">
          <MagnifyingGlass
            size={14}
            weight="bold"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--blue-dark)]/40"
          />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar área…"
            className="w-full rounded-xl border bg-white/70 pl-8 pr-3 py-1.5 text-xs text-[var(--blue-dark)] placeholder:text-[var(--blue-dark)]/40 focus:outline-none focus:ring-2"
            style={{ borderColor: 'rgba(0,0,0,0.08)' }}
          />
        </div>
      </div>

      <div className="px-2 pb-3 overflow-y-auto" style={{ maxHeight: 220 }}>
        {filtered.length === 0 ? (
          <p className="px-2 py-3 text-xs text-[var(--blue-dark)]/40">Sin resultados.</p>
        ) : (
          filtered.map(cat => {
            const isOn = selected.has(cat.code);
            return (
              <button
                key={cat.code}
                onClick={() => toggle(cat.code)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors hover:bg-black/5"
              >
                <span
                  className="w-4 h-4 rounded-[5px] border flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold"
                  style={{
                    backgroundColor: isOn ? ACCENT : 'transparent',
                    borderColor: isOn ? ACCENT : 'rgba(0,0,0,0.25)',
                  }}
                >
                  {isOn ? '✓' : ''}
                </span>
                <span className="flex-1 min-w-0 truncate text-xs text-[var(--blue-dark)]">{cat.name}</span>
                <span className="text-[10px] text-[var(--blue-dark)]/35 flex-shrink-0">{cat.code}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CategoryHighlightControl;
