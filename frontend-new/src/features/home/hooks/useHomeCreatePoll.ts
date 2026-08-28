/**
 * Создание голосования из шторки: разовое и по расписанию.
 *
 * Четвёртый сценарий главной (задача 12). Собран вместе, потому что обе ветки
 * читают одну форму, одну выбранную группу и одно расписание: разделять их
 * значило бы дублировать выбор группы и разбор длительности.
 *
 * Здесь же — соответствие «чип длительности ↔ минуты». Оно неполное по своей
 * природе: чипов четыре, а минут в расписании может быть любое число.
 */
import { useCallback, useMemo, useState } from 'react';

import { apiErrorMessage } from '@/lib/apiError';
import { getAdminGroups } from '@/lib/permissions';
import {
  daysToLabels,
  formatScheduleHint,
  labelsToDays,
  parseDaysOfWeek,
  parseNumberArray,
} from '@/lib/schedule';
import { useCreatePoll } from '@/hooks/usePolls';
import {
  useCreateRecurringPoll,
  useDeleteRecurringPoll,
  useRecurringSchedule,
  useUpdateRecurringPoll,
} from '@/hooks/useRecurringPoll';
import { useMenuItems } from '@/hooks/useMenu';
import { useMyGroups } from '@/hooks/useUser';
import { useToast } from '@/hooks/useToast';
import { useAppStore } from '@/store/useAppStore';
import type { SheetSchedule } from '@/components/admin/CreatePollSheet';
import type {
  CreatePollContext,
  CreatePollFormState,
  MenuItemOption,
} from '@/components/admin/types';
import { resolveTargetGroup } from '../lib/selectors';

export function useHomeCreatePoll() {
  const toast = useToast();
  const currentGroupId = useAppStore((s) => s.currentGroupId);

  const groupsQuery = useMyGroups();
  const { data: myGroups = [] } = groupsQuery;
  /* Объект запроса нужен барьеру, а список берётся деструктуризацией с
     умолчанием: `?? []` в теле создаёт новый массив на каждый рендер и попадает
     в зависимости мемоизации ниже. */
  const menuQuery = useMenuItems();
  const { data: allMenu = [] } = menuQuery;

  const [sheetGroupId, setSheetGroupId] = useState<string | null>(null);
  const effectiveSheetGroupId = sheetGroupId ?? currentGroupId;

  const { data: sheetMenu = [] } = useMenuItems({
    activeOnly: true,
    groupId: effectiveSheetGroupId,
  });
  // Расписание запрашиваем для группы, выбранной в шторке: иначе правили бы чужое.
  const { data: recurringSchedule } = useRecurringSchedule(
    effectiveSheetGroupId ? Number(effectiveSheetGroupId) : null,
  );

  const createPollMutation = useCreatePoll();
  const createRecurringMutation = useCreateRecurringPoll();
  const updateRecurringMutation = useUpdateRecurringPoll();
  const deleteRecurringMutation = useDeleteRecurringPoll();

  const adminGroups = useMemo(() => getAdminGroups(myGroups), [myGroups]);
  const canCreate = adminGroups.length > 0;
  /* «Ждём админа» и «бота вообще нет в чате» — разные тупики: во втором ждать
     бессмысленно, и раньше пустой талон говорил новичку неправду. */
  const hasGroup = myGroups.length > 0 || !!currentGroupId;

  const sheetSchedule = useMemo<SheetSchedule | null>(() => {
    if (!recurringSchedule) return null;
    return {
      id: recurringSchedule.id,
      isEnabled: recurringSchedule.isEnabled,
      days: daysToLabels(parseDaysOfWeek(recurringSchedule.daysOfWeek)),
      time: recurringSchedule.timeOfDay,
      durationMinutes: recurringSchedule.duration,
      itemIds: parseNumberArray(recurringSchedule.selectedMenuItemIds).map(String),
    };
  }, [recurringSchedule]);

  const createPollCtx = useMemo<CreatePollContext>(() => {
    const items: MenuItemOption[] = sheetMenu
      .filter((m) => m.isActive !== false)
      .map((m) => ({
        id: String(m.id),
        emoji: m.emoji ?? '',
        name: m.name,
        restaurant: m.category ?? '—',
        price: m.price,
      }));
    return {
      items,
      maxItems: Math.min(8, Math.max(2, items.length)),
      minItems: 2,
      audiences: [{ key: 'all', label: 'Вся группа', sub: 'все участники получат уведомление' }],
      groups: adminGroups.map((g) => ({ id: String(g.id), title: g.title })),
    };
  }, [sheetMenu, adminGroups]);

  /** Отправка формы. `true` — шторку можно закрывать. */
  const submit = useCallback(
    async (form: CreatePollFormState): Promise<boolean> => {
      const groupId = resolveTargetGroup(form.groupId, currentGroupId, adminGroups);
      if (!groupId) {
        toast.error('Нет активной группы. Добавьте бота в групповой чат.');
        return false;
      }

      const selectedMenuItems = form.selectedItems
        .map((id) => Number(id))
        .filter((n) => Number.isFinite(n));
      const duration = form.durationMinutes;

      try {
        if (form.recurring) {
          const daysOfWeek = labelsToDays(form.recurringDays);
          if (daysOfWeek.length === 0) throw new Error('Выберите хотя бы один день недели');
          const payload = {
            groupId: Number(groupId),
            daysOfWeek,
            timeOfDay: form.recurringTime,
            duration,
            selectedMenuItemIds: selectedMenuItems.length ? selectedMenuItems : null,
          };

          if (recurringSchedule) {
            // Сохранение = «хочу, чтобы работало»: выключенное расписание включаем.
            await updateRecurringMutation.mutateAsync({
              id: recurringSchedule.id,
              input: { ...payload, isEnabled: true },
            });
          } else {
            await createRecurringMutation.mutateAsync(payload);
          }
        } else {
          // Q1: одиночный выбор — multi-select UI не существует
          await createPollMutation.mutateAsync({
            groupId,
            duration,
            selectedMenuItems,
            title: form.title.trim() || undefined,
            isMultiSelect: false,
          });
          toast.success('Голосование отправлено в группу');
        }
        return true;
      } catch (err) {
        toast.error(apiErrorMessage(err, 'Не удалось создать опрос'));
        return false;
      }
    },
    [
      adminGroups,
      createPollMutation,
      createRecurringMutation,
      currentGroupId,
      recurringSchedule,
      toast,
      updateRecurringMutation,
    ],
  );

  /** Удаление расписания. `true` — шторку можно закрывать. */
  const deleteSchedule = useCallback(async (): Promise<boolean> => {
    if (!recurringSchedule) return false;

    try {
      await deleteRecurringMutation.mutateAsync({
        id: recurringSchedule.id,
        groupId: recurringSchedule.groupId,
      });
      return true;
    } catch {
      // сообщение уже показал хук
      return false;
    }
  }, [deleteRecurringMutation, recurringSchedule]);

  return {
    allMenu,
    myGroups,
    adminGroups,
    canCreate,
    hasGroup,
    scheduleHint: formatScheduleHint(recurringSchedule),
    sheetSchedule,
    createPollCtx,
    submit,
    deleteSchedule,
    setSheetGroupId,
    submitting:
      createPollMutation.isPending ||
      createRecurringMutation.isPending ||
      updateRecurringMutation.isPending,
    deletingSchedule: deleteRecurringMutation.isPending,
    queries: { groupsQuery, menuQuery },
  };
}
