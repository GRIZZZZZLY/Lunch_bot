import { useState, useEffect } from 'react';

const ONBOARDING_KEY = 'food_bot_onboarding_completed';
const ONBOARDING_VERSION = 'v1';

interface OnboardingState {
  isFirstLaunch: boolean;
  isModalOpen: boolean;
  showOnboarding: () => void;
  completeOnboarding: () => void;
}

interface TelegramCloudStorage {
  getItem: (key: string, callback: (err: string | null, value?: string) => void) => void;
  setItem: (key: string, value: string, callback?: (err?: string | null) => void) => void;
  removeItem: (key: string, callback?: (err?: string | null) => void) => void;
}

interface TelegramWebApp {
  version?: string;
  CloudStorage?: TelegramCloudStorage;
  isVersionAtLeast?: (version: string) => boolean;
}

// Global state management
let globalIsModalOpen = false;
let globalListeners: Array<(isOpen: boolean) => void> = [];

const setGlobalModalOpen = (isOpen: boolean) => {
  globalIsModalOpen = isOpen;
  globalListeners.forEach(listener => listener(isOpen));
};

export const useOnboarding = (): OnboardingState => {
  const [isFirstLaunch, setIsFirstLaunch] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(globalIsModalOpen);

  useEffect(() => {
    // Subscribe to global state changes
    const listener = (isOpen: boolean) => setIsModalOpen(isOpen);
    globalListeners.push(listener);

    // Log Telegram WebApp version
    const webAppVersion = (window.Telegram?.WebApp as TelegramWebApp | undefined)?.version || 'unknown';
    console.log(`📱 [Onboarding] Telegram WebApp version: ${webAppVersion}`);

    // Check onboarding status on mount
    checkOnboardingStatus();

    // Cleanup
    return () => {
      globalListeners = globalListeners.filter(l => l !== listener);
    };
  }, []);

  const checkOnboardingStatus = () => {
    // Check localStorage first (fastest)
    const localCompleted = localStorage.getItem(ONBOARDING_KEY);
    const localVersion = localStorage.getItem(`${ONBOARDING_KEY}_version`);

    console.log('📱 [Onboarding] Checking status:', { localCompleted, localVersion });

    // If version mismatch, show onboarding again
    if (localVersion !== ONBOARDING_VERSION) {
      console.log('⚠️ [Onboarding] Version mismatch - showing modal');
      setIsFirstLaunch(true);
      setGlobalModalOpen(true);
      return;
    }

    if (!localCompleted) {
      console.log('⚠️ [Onboarding] Not completed - checking cloud storage');
      // Check Telegram CloudStorage if available (requires v6.9+)
      const webApp = window.Telegram?.WebApp as TelegramWebApp | undefined;
      const cloudStorage = webApp?.CloudStorage;
      const isCloudStorageSupported = webApp?.isVersionAtLeast?.('6.9');
      
      if (cloudStorage && isCloudStorageSupported) {
        console.log('🔄 [Onboarding] Checking cloud storage...');
        try {
          cloudStorage.getItem(
            ONBOARDING_KEY,
            (err: string | null, value?: string) => {
              if (err || !value) {
                console.log('❌ [Onboarding] Cloud storage check failed - showing modal');
                setIsFirstLaunch(true);
                setGlobalModalOpen(true);
              } else {
                console.log('✅ [Onboarding] Found in cloud storage');
              }
            }
          );
        } catch {
          console.log('❌ [Onboarding] Cloud storage error - showing modal');
          setIsFirstLaunch(true);
          setGlobalModalOpen(true);
        }
      } else {
        console.log('⚠️ [Onboarding] Cloud storage not supported - showing modal');
        setIsFirstLaunch(true);
        setGlobalModalOpen(true);
      }
    } else {
      console.log('✅ [Onboarding] Already completed');
    }
  };

  const completeOnboarding = async () => {
    try {
      // Save to localStorage
      localStorage.setItem(ONBOARDING_KEY, 'true');
      localStorage.setItem(`${ONBOARDING_KEY}_version`, ONBOARDING_VERSION);

      // Save to Telegram CloudStorage if available (requires v6.9+)
      const webApp = window.Telegram?.WebApp as TelegramWebApp | undefined;
      const cloudStorage = webApp?.CloudStorage;
      const isCloudStorageSupported = webApp?.isVersionAtLeast?.('6.9');
      
      if (cloudStorage && isCloudStorageSupported) {
        try {
          cloudStorage.setItem(
            ONBOARDING_KEY,
            'true',
            (err?: string | null) => {
              if (err) {
                console.error('❌ [Onboarding] Failed to save to cloud storage:', err);
              } else {
                console.log('✅ [Onboarding] Saved to cloud storage');
              }
            }
          );
        } catch {
          console.error('❌ [Onboarding] Cloud storage error');
        }
      }

      // TODO: Save to backend when API is ready
      // await userService.updateUserProfile({ onboardingCompleted: true });

      setGlobalModalOpen(false);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setGlobalModalOpen(false);
    }
  };

  const showOnboarding = () => {
    setGlobalModalOpen(true);
  };

  return {
    isFirstLaunch,
    isModalOpen,
    showOnboarding,
    completeOnboarding
  };
};

// Debug helper for development
if (import.meta.env.DEV) {
  const devWindow = window as Window & { resetOnboarding?: () => void };
  devWindow.resetOnboarding = () => {
    localStorage.removeItem(ONBOARDING_KEY);
    localStorage.removeItem(`${ONBOARDING_KEY}_version`);
    
    const webApp = window.Telegram?.WebApp as TelegramWebApp | undefined;
    const cloudStorage = webApp?.CloudStorage;
    const isCloudStorageSupported = webApp?.isVersionAtLeast?.('6.9');
    
    if (cloudStorage && isCloudStorageSupported) {
      try {
        cloudStorage.removeItem(ONBOARDING_KEY, () => {
          console.log('✅ Onboarding reset complete (including cloud). Reload the page.');
          window.location.reload();
        });
      } catch {
        console.log('✅ Onboarding reset complete (localStorage only). Cloud storage not available.');
        window.location.reload();
      }
    } else {
      console.log('✅ Onboarding reset complete (localStorage only). Cloud storage not supported.');
      window.location.reload();
    }
  };
  console.log('💡 Debug: Use window.resetOnboarding() to reset onboarding state');
}
