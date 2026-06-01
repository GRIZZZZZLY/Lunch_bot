import React from 'react';
import { useCurrentGroup } from '../../hooks/useCurrentGroup';
import { useAppStore } from '../../store/useAppStore';

export const GroupSelector: React.FC = () => {
  const { groups, currentGroupId } = useCurrentGroup();
  const setCurrentGroupId = useAppStore((s) => s.setCurrentGroupId);

  if (groups.length <= 1) return null;

  return (
    <select
      value={currentGroupId ?? ''}
      onChange={(e) => setCurrentGroupId(Number(e.target.value))}
      className="text-sm bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
      aria-label="Выбрать группу"
    >
      {groups.map((g) => (
        <option key={g.id} value={g.id}>{g.title}</option>
      ))}
    </select>
  );
};
