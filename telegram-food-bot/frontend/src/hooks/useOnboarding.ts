import { useState, useEffect } from 'react';

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
          () => undefined
        );
      } catch {
        // CloudStorage is optional; local persistence above remains authoritative.
      }
    }

    // TODO: Save to backend when API is ready
    // await userService.updateUserProfile({ onboardingCompleted: true });

    setGlobalModalOpen(false);
  } catch {
    setGlobalModalOpen(false);
  }
};

const showOnboarding = () => {
  setGlobalModalOpen(true);
};


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

    // If version mismatch, show onboarding again
    if (localVersion !== ONBOARDING_VERSION) {
      setIsFirstLaunch(true);
      setGlobalModalOpen(true);
      return;
    }

    if (!localCompleted) {
      // Check Telegram CloudStorage if available (requires v6.9+)
      const webApp = window.Telegram?.WebApp as TelegramWebApp | undefined;
      const cloudStorage = webApp?.CloudStorage;
      const isCloudStorageSupported = webApp?.isVersionAtLeast?.('6.9');

      if (cloudStorage && isCloudStorageSupported) {
        try {
          cloudStorage.getItem(
            ONBOARDING_KEY,
            (err: string | null, value?: string) => {
              if (err || !value) {
                setIsFirstLaunch(true);
                setGlobalModalOpen(true);
              }
            }
          );
        } catch {
          setIsFirstLaunch(true);
          setGlobalModalOpen(true);
        }
      } else {
        setIsFirstLaunch(true);
        setGlobalModalOpen(true);
      }
    }
  };

  return {
    isFirstLaunch,
    isModalOpen,
    showOnboarding,
    completeOnboarding: () => {
      void completeOnboarding();
    },
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
          window.location.reload();
        });
      } catch {
        window.location.reload();
      }
    } else {
      window.location.reload();
    }
  };
}
