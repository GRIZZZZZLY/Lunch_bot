import { authService } from '@/services/auth.service';
import { userService } from '@/services/user.service';
import { useAppStore } from '@/store/useAppStore';
import { queryClient } from './queryClient';
import { getInitData } from './telegram';
import { captureError, identifyUser } from './monitoring';

export async function bootstrapAuth(): Promise<void> {
  const store = useAppStore.getState();
  store.setAuthStatus('authenticating');

  try {
    const initData = getInitData();
    const result = await authService.validateInitData(initData);

    if (result.success) {
      authService.setToken(result.token);
      // Resolve the active group BEFORE flipping auth status, so group-scoped
      // queries (menu, polls, budget) carry `groupId` on their first request.
      try {
        const groups = (await userService.getMyGroups()).data ?? [];
        const active = groups.find((g) => g.isActive) ?? groups[0];
        if (active) store.setCurrentGroupId(String(active.id));
        /* Тот же список тут же просит useMyGroups — это был второй запрос за
           одними данными на каждом открытии. Кладём ответ в кэш под его ключом:
           хук получает группы готовыми, а барьер первого экрана не ждёт сеть. */
        queryClient.setQueryData(['user', 'groups'], groups);
      } catch (groupErr) {
        captureError(groupErr, { source: 'bootstrapAuth:groups' });
      }
      store.setUser(result.user);
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
