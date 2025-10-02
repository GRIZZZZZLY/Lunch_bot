import React, { useState, useRef, useEffect } from 'react';
import { useHaptic } from '../../hooks/useHaptic';

export interface Tab {
  id: string;
  label: string;
  icon?: string | React.ReactNode;
  content: React.ReactNode;
  badge?: number | string;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onTabChange?: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  fullWidth?: boolean;
  enableSwipe?: boolean;
  className?: string;
}

/**
 * Tabs - компонент для навигации между разделами
 */
export const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultTab,
  onTabChange,
  variant = 'underline',
  fullWidth = false,
  enableSwipe = true,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabButtonsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const haptic = useHaptic();

  const minSwipeDistance = 50;

  // Обновление позиции индикатора
  useEffect(() => {
    const activeButton = tabButtonsRef.current.get(activeTab);
    if (activeButton && variant === 'underline') {
      const { offsetLeft, offsetWidth } = activeButton;
      setIndicatorStyle({
        left: offsetLeft,
        width: offsetWidth,
      });
    }
  }, [activeTab, variant]);

  const handleTabClick = (tabId: string, disabled?: boolean) => {
    if (disabled) return;
    
    haptic.selection();
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  // Swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!enableSwipe) return;
    setTouchEnd(0);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!enableSwipe) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!enableSwipe) return;
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    const currentIndex = tabs.findIndex(tab => tab.id === activeTab);

    if (isLeftSwipe && currentIndex < tabs.length - 1) {
      const nextTab = tabs[currentIndex + 1];
      if (!nextTab.disabled) {
        handleTabClick(nextTab.id);
      }
    }

    if (isRightSwipe && currentIndex > 0) {
      const prevTab = tabs[currentIndex - 1];
      if (!prevTab.disabled) {
        handleTabClick(prevTab.id);
      }
    }
  };

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content;

  // Стили для разных вариантов
  const getTabButtonClass = (tab: Tab) => {
    const baseClass = 'relative flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all';
    const isActive = activeTab === tab.id;
    const isDisabled = tab.disabled;

    if (isDisabled) {
      return `${baseClass} text-telegram-hint-color/50 cursor-not-allowed`;
    }

    switch (variant) {
      case 'pills':
        return `${baseClass} rounded-full ${
          isActive
            ? 'bg-telegram-button-color text-white'
            : 'text-telegram-text-color hover:bg-telegram-secondary-bg-color'
        }`;
      case 'underline':
        return `${baseClass} ${
          isActive
            ? 'text-telegram-button-color'
            : 'text-telegram-hint-color hover:text-telegram-text-color'
        }`;
      default:
        return `${baseClass} ${
          isActive
            ? 'bg-telegram-secondary-bg-color text-telegram-button-color'
            : 'text-telegram-text-color hover:bg-telegram-secondary-bg-color/50'
        }`;
    }
  };

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Tab Headers */}
      <div
        ref={tabsRef}
        className={`relative flex ${fullWidth ? 'justify-between' : 'justify-start'} gap-2 border-b border-telegram-hint-color/10 mb-4 overflow-x-auto scrollbar-hide`}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) {
                tabButtonsRef.current.set(tab.id, el);
              }
            }}
            onClick={() => handleTabClick(tab.id, tab.disabled)}
            disabled={tab.disabled}
            className={getTabButtonClass(tab)}
          >
            {/* Icon */}
            {tab.icon && (
              <span className="text-lg">
                {typeof tab.icon === 'string' ? tab.icon : tab.icon}
              </span>
            )}

            {/* Label */}
            <span className="whitespace-nowrap">{tab.label}</span>

            {/* Badge */}
            {tab.badge !== undefined && (
              <span className="ml-1 px-2 py-0.5 text-xs font-semibold bg-red-500 text-white rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        ))}

        {/* Underline Indicator */}
        {variant === 'underline' && (
          <div
            className="absolute bottom-0 h-0.5 bg-telegram-button-color transition-all duration-300 ease-out"
            style={{
              left: `${indicatorStyle.left}px`,
              width: `${indicatorStyle.width}px`,
            }}
          />
        )}
      </div>

      {/* Tab Content */}
      <div
        className="animate-fade-in"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {activeTabContent}
      </div>
    </div>
  );
};

/**
 * Controlled Tabs - для внешнего управления активной вкладкой
 */
export const ControlledTabs: React.FC<
  Omit<TabsProps, 'defaultTab'> & {
    activeTab: string;
    setActiveTab: (id: string) => void;
  }
> = ({ activeTab, setActiveTab, tabs, ...props }) => {
  return (
    <Tabs
      {...props}
      tabs={tabs}
      defaultTab={activeTab}
      onTabChange={setActiveTab}
    />
  );
};

/**
 * Tab Panel - для использования без автоматического управления контентом
 */
export const TabPanels: React.FC<{
  children: React.ReactNode;
  activeTab: string;
  tabId: string;
  className?: string;
}> = ({ children, activeTab, tabId, className = '' }) => {
  if (activeTab !== tabId) return null;

  return (
    <div className={`animate-fade-in ${className}`}>
      {children}
    </div>
  );
};

/**
 * Пример использования:
 * 
 * // Базовое использование:
 * <Tabs
 *   tabs={[
 *     {
 *       id: 'active',
 *       label: 'Активные',
 *       icon: '🟢',
 *       content: <ActivePolls />,
 *     },
 *     {
 *       id: 'completed',
 *       label: 'Завершённые',
 *       icon: '✅',
 *       content: <CompletedPolls />,
 *       badge: 5,
 *     },
 *     {
 *       id: 'archived',
 *       label: 'Архив',
 *       icon: '📦',
 *       content: <ArchivedPolls />,
 *       disabled: true,
 *     },
 *   ]}
 *   variant="underline"
 *   fullWidth
 *   enableSwipe
 * />
 * 
 * // Controlled вариант:
 * const [activeTab, setActiveTab] = useState('stats');
 * 
 * <ControlledTabs
 *   activeTab={activeTab}
 *   setActiveTab={setActiveTab}
 *   tabs={[...]}
 * />
 * 
 * // С TabPanels для большего контроля:
 * const [activeTab, setActiveTab] = useState('day');
 * 
 * <div>
 *   <Tabs tabs={tabsConfig} />
 *   
 *   <TabPanels activeTab={activeTab} tabId="day">
 *     <DayStats />
 *   </TabPanels>
 *   
 *   <TabPanels activeTab={activeTab} tabId="week">
 *     <WeekStats />
 *   </TabPanels>
 * </div>
 */
