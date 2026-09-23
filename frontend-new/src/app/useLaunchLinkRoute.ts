/**
 * Открыть то, на что вела ссылка запуска: закупку или экран нужной группы.
 *
 * Ссылку на опрос разбирает главная (`useHomePoll`): там опрос показывается
 * на месте активного. Здесь — остальные ссылки из чата: «Заказать» ведёт в
 * закупку, «Открыть меню группы» и «Добавить блюдо» — в меню этой группы,
 * «Создать голосование» — на главную со шторкой создания.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useMyGroups } from '@/hooks/useUser';
import { useToast } from '@/hooks/useToast';
import { getLaunchLink, markLaunchLinkHandled } from '@/lib/launchLink';
import { useAppStore } from '@/store/useAppStore';

export type LaunchAction = 'addDish' | 'createPoll';

export function useLaunchLinkRoute(): void {
  const navigate = useNavigate();
  const toast = useToast();
  const setCurrentGroupId = useAppStore((s) => s.setCurrentGroupId);
  const { data: groups, isSuccess: groupsLoaded } = useMyGroups();

  useEffect(() => {
    const link = getLaunchLink();
    if (!link || link.kind === 'poll') return;

    if (link.kind === 'storeRun') {
      markLaunchLinkHandled();
      navigate(`/store-run/${link.id}`);
      return;
    }

    /* Группа в ссылке — id чата Telegram; сопоставить его можно только со
       списком своих групп. Пока список не пришёл, решать рано. */
    if (!groupsLoaded) return;
    markLaunchLinkHandled();

    const group = groups?.find((g) => g.telegramId === link.chatId);
    if (!group) {
      /* Подставлять текущую команду вместо незнакомой нельзя: человек увидел
         бы меню не той группы и принял бы его за нужное. */
      toast.error('Группа из ссылки недоступна');
      return;
    }

    setCurrentGroupId(String(group.id));
    const state: { launchAction?: LaunchAction } =
      link.action === 'menu' ? {} : { launchAction: link.action };
    navigate(link.action === 'createPoll' ? '/' : '/menu', { state });
  }, [groups, groupsLoaded, navigate, setCurrentGroupId, toast]);
}
