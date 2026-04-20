import React from 'react';
import type { ColumnGroup } from './CityCompareTable';

type GroupId = 'Infraestructura' | 'Servicio Bici' | 'Ayuntamiento';

interface ColumnGroupPickerProps {
  groups: ColumnGroup[];
  activeGroup: GroupId;
  onSelect: (groupId: GroupId) => void;
}

export const ColumnGroupPicker: React.FC<ColumnGroupPickerProps> = ({
  groups,
  activeGroup,
  onSelect,
}) => {
  return (
    <div className="flex border-b border-white/10">
      {groups.map((group) => {
        const isActive = group.id === activeGroup;
        return (
          <button
            key={group.id}
            onClick={() => onSelect(group.id)}
            className={`
              flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold
              relative transition-colors duration-200 select-none
              ${isActive ? 'text-white' : 'text-white/40 hover:text-white/60'}
            `}
          >
            <group.icon size={12} />
            <span>{group.label}</span>
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[var(--green-light)]" />
            )}
          </button>
        );
      })}
    </div>
  );
};
