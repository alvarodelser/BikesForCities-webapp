import { type ReactNode, Children, isValidElement } from 'react';

interface SlotProps { children: ReactNode; }
function Left({ children }: SlotProps) { return <>{children}</>; }
function Right({ children }: SlotProps) { return <>{children}</>; }

interface DualPanelProps {
  leftRatio?: number;
  children: ReactNode;
}

/**
 * DualPanel renders a two-column grid.
 * Parent is responsible for deciding when to use DualPanel vs single column.
 */
function DualPanel({ leftRatio = 0.45, children }: DualPanelProps) {
  let left: ReactNode = null;
  let right: ReactNode = null;
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Left) left = child;
    else if (child.type === Right) right = child;
  });

  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: `${leftRatio * 100}% minmax(0, 1fr)` }}
    >
      <div className="overflow-y-auto min-w-0">{left}</div>
      <div className="min-w-0">{right}</div>
    </div>
  );
}

DualPanel.Left = Left;
DualPanel.Right = Right;
export default DualPanel;
