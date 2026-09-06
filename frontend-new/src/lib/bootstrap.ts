import { authService } from '@/services/auth.service';
import { userService } from '@/services/user.service';
import { useAppStore } from '@/store/useAppStore';
import { queryClient } from './queryClient';
import { getInitData } from './telegram';
import { captureError, identifyUser } from './monitoring';
import { readPreferredGroupId, resolveInitialGroupId } from './groupPreference';

export async function bootstrapAuth(): Promise<void> {
  const store = useAppStore.getState();
  store.setAuthStatus('authenticating');

  try {
    const initData = getInitData();
    const result = await authService.validateInitData(initData);

    if (result.success) {
      authService.setToken(result.token);
      /* Пользователь в сторе ДО выбора команды: `setCurrentGroupId`
         запоминает выбор по id пользователя, и без него запоминать нечего.
         Экраны смотрят на authStatus, он переключается ниже. */
      store.setUser(result.user);
      // Resolve the active group BEFORE flipping auth status, so group-scoped
      // queries (menu, polls, budget) carry `groupId` on their first request.
      try {
        const groups = (await userService.getMyGroups()).data ?? [];
        /* Сначала последняя выбранная команда этого человека, если он всё ещё
           в ней состоит; иначе прежнее правило (isActive, затем первая).
           Проверка по актуальному списку обязательна: за время, пока
           приложение было закрыто, из команды могли исключить. */
        const initial = resolveInitialGroupId(
          groups,
          readPreferredGroupId(result.user.id)
        );
        if (initial) store.setCurrentGroupId(initial);
        /* Тот же список тут же просит useMyGroups — это был второй запрос за
           одними данными на каждом открытии. Кладём ответ в кэш под его ключом:
           хук получает группы готовыми, а барьер первого экрана не ждёт сеть. */
        queryClient.setQueryData(['user', 'groups'], groups);
      } catch (groupErr) {
        captureError(groupErr, { source: 'bootstrapAuth:groups' });
      }
      store.setAuthStatus('authenticated');
      store.setAuthError(null);
      identifyUser({ id: result.user.id, username: result.user.username });
    } else {
      store.setAuthStatus('error');
      store.setAuthError(result.error ?? 'Authentication failed');
    }
  } catch (err) {
    captureError(err, { source: 'bootstrapAuth' });
    store.setAuthStatus('error');
    store.setAuthError(err instanceof Error ? err.message : 'Authentication failed');
  }
}
