import { type ReactNode, Children, isValidElement } from 'react';
import { useViewport } from '../../hooks/useViewport';

interface SlotProps { children: ReactNode; }
function Left({ children }: SlotProps) { return <>{children}</>; }
function Right({ children }: SlotProps) { return <>{children}</>; }

interface DualPanelProps {
  breakpoint?: 'ultrawide';
  leftRatio?: number;
  children: ReactNode;
}

function DualPanel({ leftRatio = 0.4, children }: DualPanelProps) {
  const { isUltrawide } = useViewport();

  let left: ReactNode = null;
  let right: ReactNode = null;
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Left) left = child;
    else if (child.type === Right) right = child;
  });

  if (!isUltrawide) {
    return <>{left}{right}</>;
  }

  return (
    <div
      className="grid gap-[var(--space-gutter)]"
      style={{ gridTemplateColumns: `${leftRatio * 100}% 1fr` }}
    >
      <div className="overflow-y-auto">{left}</div>
      <div>{right}</div>
    </div>
  );
}

DualPanel.Left = Left;
DualPanel.Right = Right;
export default DualPanel;
