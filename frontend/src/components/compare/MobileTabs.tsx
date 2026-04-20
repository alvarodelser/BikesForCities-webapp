import { type ReactNode, Children, isValidElement, useEffect, useState } from 'react';
import { useViewport } from '../../hooks/useViewport';

interface TabProps { id: string; label: string; children: ReactNode; }
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

  useEffect(() => {
    const onHashChange = () => {
      const t = readHashTab();
      if (t) setActive(t);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const tabs: { id: string; label: string; content: ReactNode }[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || child.type !== Tab) return;
    const props = child.props as TabProps;
    tabs.push({ id: props.id, label: props.label, content: props.children });
  });

  if (!isMobile) {
    return <>{tabs.map((t) => <div key={t.id}>{t.content}</div>)}</>;
  }

  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div>
      <div role="tablist" className="flex gap-2 px-3 py-3 border-b border-black/10 overflow-x-auto shrink-0 custom-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === current.id}
            onClick={() => {
              setActive(t.id);
              history.replaceState(null, '', `#tab=${t.id}`);
            }}
            className={`
              px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200
              ${
                t.id === current.id
                  ? 'bg-white text-[var(--blue)] shadow-sm'
                  : 'bg-[var(--blue)] text-white hover:opacity-90'
              }
            `}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{current.content}</div>
    </div>
  );
}

MobileTabs.Tab = Tab;
export default MobileTabs;
