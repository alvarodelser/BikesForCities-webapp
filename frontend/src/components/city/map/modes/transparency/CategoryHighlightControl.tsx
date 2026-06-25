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

  const displayed = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? categories.filter(c => c.name.toLowerCase().includes(q) || c.code.includes(q))
      : categories;
    // Selected areas float to the top; within each group keep code order.
    return [...base].sort((a, b) => {
      const sel = (selected.has(b.code) ? 1 : 0) - (selected.has(a.code) ? 1 : 0);
      return sel !== 0 ? sel : a.code.localeCompare(b.code);
    });
  }, [categories, query, selected]);

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
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`, boxShadow: `0 4px 12px ${ACCENT}55` }}
        >
          <ListChecks size={13} color="white" weight="bold" />
        </div>
        <h3 className="text-xs font-bold text-[var(--blue-dark)] min-w-0 flex-1 truncate">Áreas destacadas</h3>
      </div>

      <div className="px-3 pb-1.5">
        <div className="relative">
          <MagnifyingGlass
            size={13}
            weight="bold"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--blue-dark)]/40"
          />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar área…"
            aria-label="Buscar área de gasto"
            className="w-full rounded-lg border bg-white/70 pl-8 pr-3 py-1 text-xs text-[var(--blue-dark)] placeholder:text-[var(--blue-dark)]/40 focus:outline-none focus:ring-2"
            style={{ borderColor: 'rgba(0,0,0,0.08)' }}
          />
        </div>
      </div>

      <div className="px-2 pb-2 overflow-y-auto" style={{ maxHeight: 132 }}>
        {displayed.length === 0 ? (
          <p className="px-2 py-3 text-xs text-[var(--blue-dark)]/40">Sin resultados.</p>
        ) : (
          displayed.map(cat => {
            const isOn = selected.has(cat.code);
            return (
              <button
                key={cat.code}
                type="button"
                role="checkbox"
                aria-checked={isOn}
                onClick={() => toggle(cat.code)}
                className="w-full flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-colors hover:bg-black/5"
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
