import { authService } from '@/services/auth.service';
import { useAppStore } from '@/store/useAppStore';
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
