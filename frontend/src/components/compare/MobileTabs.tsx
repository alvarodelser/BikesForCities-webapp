import { type ReactNode, Children, isValidElement, useEffect, useState, useRef } from 'react';
import { useViewport } from '../../hooks/useViewport';

interface TabProps { id: string; label: ReactNode; children: ReactNode; }
function Tab({ children }: TabProps) { return <>{children}</>; }

interface MobileTabsProps {
  defaultTab: string;
  children: ReactNode;
}

function readHashTab(): string | null {
  const m = typeof window !== 'undefined' ? window.location.hash.match(/#tab=([\w-]+)/) : null;
  return m ? m[1] : null;
}

function MobileTabs({ defaultTab, children }: MobileTabsProps) {
  const { isMobile } = useViewport();
  const [active, setActive] = useState<string>(() => readHashTab() ?? defaultTab);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  useEffect(() => {
    const onHashChange = () => {
      const t = readHashTab();
      if (t) setActive(t);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const tabs: { id: string; label: ReactNode; content: ReactNode }[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || child.type !== Tab) return;
    const props = child.props as TabProps;
    tabs.push({ id: props.id, label: props.label, content: props.children });
  });

  const activateTab = (id: string) => {
    setActive(id);
    history.replaceState(null, '', `#tab=${id}`);
  };

  const goNext = () => {
    const idx = tabs.findIndex(t => t.id === active);
    if (idx < tabs.length - 1) activateTab(tabs[idx + 1].id);
  };

  const goPrev = () => {
    const idx = tabs.findIndex(t => t.id === active);
    if (idx > 0) activateTab(tabs[idx - 1].id);
  };

  if (!isMobile) {
    return <>{tabs.map((t) => <div key={t.id}>{t.content}</div>)}</>;
  }

  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  const currentIdx = tabs.findIndex(t => t.id === current.id);

  return (
    <div>
      {/* ── Tab bar ── */}
      <div
        role="tablist"
        className="flex border-b border-white/10 relative"
        style={{ backgroundColor: 'rgba(0,56,73,0.6)' }}
      >
        {tabs.map((t) => {
          const isActive = t.id === current.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => activateTab(t.id)}
              className={`
                flex-1 relative py-3.5 px-2 text-sm font-semibold tracking-wide
                transition-colors duration-200 select-none
                ${isActive ? 'text-white' : 'text-white/40 hover:text-white/70'}
              `}
            >
              {t.label}
              {/* Active underline */}
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[var(--green-light)]"
                  style={{ animation: 'tabUnderline 0.2s ease' }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Swipe hint dots ── */}
      <div className="flex justify-center gap-1.5 pt-2.5 pb-0.5">
        {tabs.map((t, i) => (
          <div
            key={t.id}
            className={`rounded-full transition-all duration-300 ${
              i === currentIdx
                ? 'w-4 h-1.5 bg-[var(--green-light)]'
                : 'w-1.5 h-1.5 bg-white/20'
            }`}
          />
        ))}
      </div>

      {/* ── Tab panel with swipe ── */}
      <div
        role="tabpanel"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
          touchStartY.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
          // Only treat as a horizontal swipe if clearly horizontal (dx > dy threshold)
          if (Math.abs(dx) > 50 && Math.abs(dx) > dy * 1.5) {
            if (dx < 0) goNext();
            else goPrev();
          }
        }}
      >
        {current.content}
      </div>

      <style>{`
        @keyframes tabUnderline {
          from { transform: scaleX(0.4); opacity: 0; }
          to   { transform: scaleX(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}

MobileTabs.Tab = Tab;
export default MobileTabs;
