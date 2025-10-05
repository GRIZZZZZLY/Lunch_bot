import { useState, useEffect } from 'react';

const ONBOARDING_KEY = 'food_bot_onboarding_completed';
const ONBOARDING_VERSION = 'v1';

interface OnboardingState {
  isFirstLaunch: boolean;
  isModalOpen: boolean;
  showOnboarding: () => void;
  completeOnboarding: () => void;
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
      // Check Telegram CloudStorage if available
      const cloudStorage = (window.Telegram?.WebApp as any)?.CloudStorage;
      if (cloudStorage) {
        cloudStorage.getItem(
          ONBOARDING_KEY,
          (err: any, value: string) => {
            if (err || !value) {
              setIsFirstLaunch(true);
              setGlobalModalOpen(true);
            }
          }
        );
      } else {
        setIsFirstLaunch(true);
        setGlobalModalOpen(true);
      }
    }
  };

  const completeOnboarding = async () => {
    try {
      // Save to localStorage
      localStorage.setItem(ONBOARDING_KEY, 'true');
      localStorage.setItem(`${ONBOARDING_KEY}_version`, ONBOARDING_VERSION);

      // Save to Telegram CloudStorage if available
      const cloudStorage = (window.Telegram?.WebApp as any)?.CloudStorage;
      if (cloudStorage) {
        cloudStorage.setItem(
          ONBOARDING_KEY,
          'true',
          (err: any) => {
            if (err) {
              console.error('Failed to save onboarding status to Telegram Storage:', err);
            }
          }
        );
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
  (window as any).resetOnboarding = () => {
    localStorage.removeItem(ONBOARDING_KEY);
    localStorage.removeItem(`${ONBOARDING_KEY}_version`);
    const cloudStorage = (window.Telegram?.WebApp as any)?.CloudStorage;
    if (cloudStorage) {
      cloudStorage.removeItem(ONBOARDING_KEY, () => {
        console.log('Onboarding reset complete. Reload the page.');
      });
    }
    window.location.reload();
  };
  console.log('Debug: Use window.resetOnboarding() to reset onboarding state');
}
