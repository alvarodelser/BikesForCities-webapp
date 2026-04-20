import React from 'react';
import type { ColumnGroup } from './CityCompareTable';

type GroupId = 'Infraestructura' | 'Servicio Bici' | 'Ayuntamiento';

interface ColumnGroupPickerProps {
  groups: ColumnGroup[];
  expanded: Set<GroupId>;
  onToggle: (groupId: GroupId) => void;
}

export const ColumnGroupPicker: React.FC<ColumnGroupPickerProps> = ({
  groups,
  expanded,
  onToggle,
}) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
      {/* Base pill - read-only indicator */}
      <div
        className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/60 text-xs font-semibold opacity-50 cursor-default"
      >
        <span>Base</span>
      </div>

      {/* Group pills */}
      {groups.map((group) => {
        const isExpanded = expanded.has(group.id);
        return (
          <button
            key={group.id}
            onClick={() => onToggle(group.id)}
            className={`
              shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full
              text-white text-xs font-semibold transition-all duration-200
              ${
                isExpanded
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/15'
              }
            `}
          >
            <group.icon size={14} />
            <span>{group.label}</span>
          </button>
        );
      })}
    </div>
  );
};
