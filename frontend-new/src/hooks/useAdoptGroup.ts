import { useEffect } from 'react';

import { useAppStore } from '@/store/useAppStore';

/**
 * Сделать текущей команду открытого объекта.
 *
 * Ссылка на опрос или закупку команды Б открывает их в контексте Б: иначе
 * меню, права и соседние экраны продолжали бы показывать команду А. Группу
 * берём из объекта, который сервер уже отдал, — значит, членство проверено и
 * подставлять чужую команду наугад не приходится.
 *
 * `groupId` приходит строкой у опроса и числом у закупки, в сторе — строка.
 */
export function useAdoptGroup(groupId: string | number | null | undefined): void {
  const currentGroupId = useAppStore((s) => s.currentGroupId);
  const setCurrentGroupId = useAppStore((s) => s.setCurrentGroupId);

  useEffect(() => {
    if (groupId === null || groupId === undefined) return;
    const id = String(groupId);
    if (id !== currentGroupId) setCurrentGroupId(id);
  }, [groupId, currentGroupId, setCurrentGroupId]);
}
