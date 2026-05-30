/**
 * CreatePollForm - Р¤РѕСЂРјР° СЃРѕР·РґР°РЅРёСЏ РіРѕР»РѕСЃРѕРІР°РЅРёСЏ СЃ glassmorphism РґРёР·Р°Р№РЅРѕРј
 * 
 * РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅР° РґР»СЏ mobile:
 * - Glassmorphism & time-based РіСЂР°РґРёРµРЅС‚С‹
 * - Smart presets & live preview
 * - Enhanced РІРёР·СѓР°Р»РёР·Р°С†РёСЏ Р±Р»СЋРґ
 * - Progress indicators
 * - Haptic feedback
 */

import React, { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Users,
  CheckCircle2,
  Circle,
  AlertCircle,
  Check,
  Shuffle,
  X,
  ChevronLeft,
} from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PastelCard, CardContent } from '../ui/pastel-card';
import { Progress } from '../ui/progress';
import { cn } from '@/lib/utils';
import { TYPOGRAPHY_H3, TYPOGRAPHY_SMALL } from '@/lib/typography';
import { useAuth } from '@/hooks/useAuth';
import { useHaptic } from '@/hooks/useHaptic';
import { menuService, MenuItem } from '@/services/menu.service';
import { userService, Group } from '@/services/user.service';
import { pollsService } from '@/services/polls.service';
import { ICON_SIZES } from '@/lib/design-tokens';

interface CreatePollFormProps {
  onSuccess?: (pollId: number) => void;
  onCancel?: () => void;
}

export const CreatePollForm: React.FC<CreatePollFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { user } = useAuth();
  const haptic = useHaptic();
  
  // РћРїСЂРµРґРµР»СЏРµРј С‚РµРјСѓ: РїСЂРѕРІРµСЂСЏРµРј CSS РєР»Р°СЃСЃ 'dark' РЅР° РґРѕРєСѓРјРµРЅС‚Рµ
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  // РЎР»РµРґРёРј Р·Р° РёР·РјРµРЅРµРЅРёСЏРјРё С‚РµРјС‹ С‡РµСЂРµР· MutationObserver
  useEffect(() => {
    const updateTheme = () => {
      const newIsDark = document.documentElement.classList.contains('dark');
      setIsDark(newIsDark);
      console.log('рџЋЁ [CreatePollForm] Theme changed:', newIsDark ? 'dark' : 'light');
    };

    // РћР±РЅРѕРІР»СЏРµРј СЃСЂР°Р·Сѓ
    updateTheme();

    // РќР°Р±Р»СЋРґР°РµРј Р·Р° РёР·РјРµРЅРµРЅРёСЏРјРё РєР»Р°СЃСЃР° РЅР° html
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          updateTheme();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // State
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [duration, setDuration] = useState(30);
  const [isMultiSelect, setIsMultiSelect] = useState(true); // РњРЅРѕР¶РµСЃС‚РІРµРЅРЅС‹Р№ РІС‹Р±РѕСЂ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ
  const maxSelections = 3; // РњР°РєСЃ. 3 Р±Р»СЋРґР°
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [menuResponse, groupsResponse] = await Promise.all([
        menuService.getActiveItems(),
        userService.getUserGroups(),
      ]);

      console.log('[CreatePollForm] рџ”Ќ Menu response:', {
        success: menuResponse.success,
        dataLength: menuResponse.data?.length || 0,
        data: menuResponse.data,
        error: menuResponse.error
      });

      if (menuResponse.success && menuResponse.data) {
        setMenuItems(menuResponse.data);
        // вњ… UX FIX: Don't pre-select all items (Paradox of Choice)
        // Admin can use "рџЋІ РЎР»СѓС‡Р°Р№РЅС‹Рµ 5" or select manually
        // Was: setSelectedItems(new Set(menuResponse.data.map(item => item.id)));
        console.log('[CreatePollForm] вњ… Menu items loaded:', menuResponse.data.length);
      } else {
        console.error('[CreatePollForm] вќЊ Failed to load menu:', menuResponse.error);
      }

      console.log('[CreatePollForm] рџ”Ќ Groups response:', {
        success: groupsResponse.success,
        dataLength: groupsResponse.data?.length || 0,
      });

      if (groupsResponse.success && groupsResponse.data) {
        setGroups(groupsResponse.data);
      }
    } catch (err) {
      console.error('[CreatePollForm] вќЊ Error loading data:', err);
      setError('РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РґР°РЅРЅС‹С…');
    } finally {
      setLoading(false);
    }
  };

  const DURATION_PRESETS = [
    { label: '15Рј', value: 15 },
    { label: '30Рј', value: 30 },
    { label: '1С‡', value: 60 },
    { label: '2С‡', value: 120 },
  ];

  const canAdvance = (): boolean => selectedGroupId !== null;

  const adminGroups = useMemo(() => {
    if (user?.isAdmin) {
      return groups;
    }

    return groups.filter(group => group.role === 'ADMIN' || group.role === 'CREATOR');
  }, [groups, user?.isAdmin]);

  useEffect(() => {
    if (selectedGroupId && adminGroups.some(group => group.id === selectedGroupId)) {
      return;
    }

    if (adminGroups.length > 0) {
      setSelectedGroupId(adminGroups[0].id);
    } else {
      setSelectedGroupId(null);
    }
  }, [adminGroups, selectedGroupId]);

  const canCreatePoll = (): boolean => {
    return (
      selectedGroupId !== null &&
      selectedItems.size >= 2 &&
      duration >= 1 &&
      duration <= 1440
    );
  };

  const handleCreate = async () => {
    if (!canCreatePoll()) {
      setError('Р—Р°РїРѕР»РЅРёС‚Рµ РІСЃРµ РїРѕР»СЏ РєРѕСЂСЂРµРєС‚РЅРѕ');
      haptic.error();
      return;
    }

    try {
      setCreating(true);
      setError(null);

      // РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРё РґРѕР±Р°РІР»СЏРµРј "Р•РґР° СЃ СЃРѕР±РѕР№" Рє РІС‹Р±СЂР°РЅРЅС‹Рј Р±Р»СЋРґР°Рј
      const takeawayItem = menuItems.find(item => item.name === 'Р•РґР° СЃ СЃРѕР±РѕР№');
      const finalSelectedItems = Array.from(selectedItems);
      if (takeawayItem && !finalSelectedItems.includes(takeawayItem.id)) {
        finalSelectedItems.push(takeawayItem.id);
      }

      const response = await pollsService.createPollFromWebApp({
        groupId: selectedGroupId!,
        duration,
        selectedMenuItems: finalSelectedItems,
        title: 'Р“РѕР»РѕСЃРѕРІР°РЅРёРµ Р·Р° РѕР±РµРґ',
        isMultiSelect,
        maxSelections: isMultiSelect ? maxSelections : 1,
      });

      if (response.success && response.data) {
        haptic.success();
        onSuccess?.(response.data.pollId);
      } else {
        throw new Error(response.error || 'Failed to create poll');
      }
    } catch (err: unknown) {
      console.error('Error creating poll:', err);
      
      let errorMessage = 'РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ РіРѕР»РѕСЃРѕРІР°РЅРёСЏ';
      
      // РџСЂРѕРІРµСЂСЏРµРј СЂР°Р·РЅС‹Рµ С‚РёРїС‹ РѕС€РёР±РѕРє
      const errorObj = err as { error?: string; message?: string; code?: string };
      const errorText = errorObj?.error || errorObj?.message || '';
      
      if (errorText.includes('already has an active poll') || errorText.includes('Group already has active poll')) {
        errorMessage = 'Р’ СЌС‚РѕР№ РіСЂСѓРїРїРµ СѓР¶Рµ РµСЃС‚СЊ Р°РєС‚РёРІРЅРѕРµ РіРѕР»РѕСЃРѕРІР°РЅРёРµ. Р”РѕР¶РґРёС‚РµСЃСЊ РµРіРѕ Р·Р°РІРµСЂС€РµРЅРёСЏ.';
      } else if (errorText.includes('Not enough items') || errorText.includes('NOT_ENOUGH_ITEMS')) {
        errorMessage = 'Р’С‹Р±РµСЂРёС‚Рµ РјРёРЅРёРјСѓРј 2 Р±Р»СЋРґР°';
      } else if (errorText.includes('Network error') || errorObj?.code === 'NETWORK_ERROR') {
        errorMessage = 'РћС€РёР±РєР° СЃРµС‚Рё. РџСЂРѕРІРµСЂСЊС‚Рµ РїРѕРґРєР»СЋС‡РµРЅРёРµ Рє РёРЅС‚РµСЂРЅРµС‚Сѓ.';
      } else if (errorText.includes('Access denied') || errorObj?.code === 'ACCESS_DENIED') {
        errorMessage = 'РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ РґР»СЏ СЃРѕР·РґР°РЅРёСЏ РіРѕР»РѕСЃРѕРІР°РЅРёСЏ';
      } else if (errorObj?.code === 'INVALID_GROUP') {
        errorMessage = 'Р’С‹Р±РµСЂРёС‚Рµ РіСЂСѓРїРїСѓ';
      } else if (errorText) {
        errorMessage = `РћС€РёР±РєР°: ${errorText}`;
      }
      
      setError(errorMessage);
      haptic.error();
    } finally {
      setCreating(false);
    }
  };

  const toggleItem = (itemId: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const toggleAll = () => {
    if (selectedItems.size === menuItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(menuItems.map(item => item.id)));
    }
  };

  const selectRandom = () => {
    console.log('[CreatePollForm] рџЋІ selectRandom clicked', { 
      totalItems: menuItems.length,
      currentSelected: selectedItems.size 
    });
    
    haptic.impact();
    
    // РЎР»СѓС‡Р°Р№РЅС‹Р№ РІС‹Р±РѕСЂ РѕС‚ 3 РґРѕ 6 Р±Р»СЋРґ (РёР»Рё РјРµРЅСЊС€Рµ РµСЃР»Рё Р±Р»СЋРґ РјР°Р»Рѕ)
    const maxCount = Math.min(6, menuItems.length);
    const minCount = Math.min(3, menuItems.length);
    const count = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;
    
    console.log('[CreatePollForm] рџЋІ Selecting random items', { count, maxCount, minCount });
    
    const shuffled = [...menuItems].sort(() => Math.random() - 0.5);
    const randomItems = shuffled.slice(0, count);
    const newSelection = new Set(randomItems.map(item => item.id));
    
    console.log('[CreatePollForm] вњ… Random items selected', { 
      selectedIds: Array.from(newSelection),
      selectedNames: randomItems.map(i => i.name)
    });
    
    setSelectedItems(newSelection);
  };

  // Format duration РґР»СЏ live preview
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} РјРёРЅ`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}С‡ ${mins}Рј` : `${hours} С‡Р°СЃ${hours > 1 ? 'Р°' : ''}`;
    }
  };

  // Р’СЃРµ Р±Р»СЋРґР° Р±РµР· С„РёР»СЊС‚СЂР°С†РёРё
  const visibleItems = menuItems;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const canManagePolls = !!user?.isAdmin || adminGroups.length > 0;

  if (!canManagePolls) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className={`${ICON_SIZES['2xl']} mx-auto mb-4 text-yellow-500`} />
        <p className="text-gray-600 dark:text-gray-400">
          РўРѕР»СЊРєРѕ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂС‹ РіСЂСѓРїРї РјРѕРіСѓС‚ Р·Р°РїСѓСЃРєР°С‚СЊ РіРѕР»РѕСЃРѕРІР°РЅРёСЏ
        </p>
      </div>
    );
  }

  // Check if no menu items
  if (menuItems.length === 0) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className={cn(
          ICON_SIZES['2xl'],
          "mx-auto mb-4",
          isDark ? "text-lavender-500" : "text-peach-500"
        )} />
        <p className="text-gray-900 dark:text-white font-semibold mb-2">
          РњРµРЅСЋ РїСѓСЃС‚РѕРµ
        </p>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Р”РѕР±Р°РІСЊС‚Рµ Р±Р»СЋРґР° РІ РјРµРЅСЋ РїРµСЂРµРґ СЃРѕР·РґР°РЅРёРµРј РіРѕР»РѕСЃРѕРІР°РЅРёСЏ
        </p>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Р—Р°РєСЂС‹С‚СЊ
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-9 h-1 rounded-full bg-muted-foreground/30" />
      </div>

      {/* Progress bar */}
      <div className="flex gap-1.5 px-6 pt-3">
        <div className={cn(
          'flex-1 h-1 rounded-full transition-colors',
          isDark ? 'bg-lavender-500' : 'bg-peach-500'
        )} />
        <div className={cn(
          'flex-1 h-1 rounded-full transition-colors',
          step === 2
            ? isDark ? 'bg-lavender-500' : 'bg-peach-500'
            : 'bg-muted'
        )} />
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4">
              <h2 className="text-xl font-bold text-foreground">РЎРѕР·РґР°С‚СЊ РіРѕР»РѕСЃРѕРІР°РЅРёРµ</h2>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Р—Р°РєСЂС‹С‚СЊ"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="px-6 pb-8 space-y-5">
              {/* Р“СЂСѓРїРїР° */}
              {adminGroups.length > 0 && (
                <PastelCard variant="default" className={cn(
                  "border-l-4",
                  isDark ? "border-lavender-500" : "border-peach-500"
                )}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800">
                        <Users className={`${ICON_SIZES.md} text-gray-600 dark:text-gray-400`} />
                      </div>
                      <div>
                        <h3 className={cn(TYPOGRAPHY_H3.className, "text-gray-900 dark:text-white")}>
                          Р“СЂСѓРїРїР°
                        </h3>
                        <p className={cn(TYPOGRAPHY_SMALL.className, "text-gray-400 dark:text-gray-400")}>
                          Р“РґРµ Р·Р°РїСѓСЃС‚РёС‚СЊ РіРѕР»РѕСЃРѕРІР°РЅРёРµ
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {adminGroups.map((group, index) => (
                        <motion.button
                          key={group.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 * index }}
                          onClick={() => setSelectedGroupId(group.id)}
                          className={cn(
                            "w-full p-3 rounded-2xl border-2 transition-all duration-200",
                            selectedGroupId === group.id
                              ? isDark
                                ? "border-lavender-500 bg-lavender-500/5"
                                : "border-peach-500 bg-peach-50"
                              : isDark
                                ? "border-border hover:border-lavender-300"
                                : "border-border hover:border-peach-300"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {group.title}
                            </span>
                            {selectedGroupId === group.id && (
                              <CheckCircle2 className={isDark ? "text-lavender-500" : "text-peach-500"} size={20} />
                            )}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </CardContent>
                </PastelCard>
              )}

              {/* Р”Р»РёС‚РµР»СЊРЅРѕСЃС‚СЊ */}
              <PastelCard variant="default" className={cn(
                "border-l-4",
                isDark ? "border-lavender-500" : "border-peach-500"
              )}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2.5 rounded-xl",
                        isDark ? "bg-lavender-500/20" : "bg-peach-500/20"
                      )}>
                        <Clock className={cn(ICON_SIZES.md, isDark ? "text-lavender-500" : "text-peach-500")} />
                      </div>
                      <h3 className={cn(TYPOGRAPHY_H3.className, "text-gray-900 dark:text-white")}>
                        Р”Р»РёС‚РµР»СЊРЅРѕСЃС‚СЊ
                      </h3>
                    </div>
                    <motion.div
                      key={duration}
                      initial={{ scale: 1.2 }}
                      animate={{ scale: 1 }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg",
                        isDark ? "bg-lavender-500/10 text-lavender-400" : "bg-peach-50 text-peach-700"
                      )}
                    >
                      <span className="text-sm font-bold">{formatDuration(duration)}</span>
                    </motion.div>
                  </div>

                  {/* РџСЂРµСЃРµС‚С‹ */}
                  <div className="flex gap-2 mb-3">
                    {DURATION_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setDuration(preset.value)}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-sm font-medium transition-all border-2",
                          duration === preset.value
                            ? isDark
                              ? "border-lavender-500 bg-lavender-500/10 text-lavender-400"
                              : "border-peach-500 bg-peach-50 text-peach-700"
                            : "border-border text-muted-foreground hover:border-muted-foreground/40"
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* РЎР»Р°Р№РґРµСЂ */}
                  <input
                    type="range"
                    min={5}
                    max={240}
                    step={5}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full adaptive-slider"
                    style={{
                      '--slider-progress': `${Math.min(100, Math.max(0, ((duration - 5) / 235) * 100))}%`,
                    } as CSSProperties}
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>5 РјРёРЅ</span>
                    <span>4 С‡Р°СЃР°</span>
                  </div>
                </CardContent>
              </PastelCard>

              {/* РўРёРї РіРѕР»РѕСЃРѕРІР°РЅРёСЏ */}
              <PastelCard variant="default" className={cn(
                "border-l-4",
                isDark ? "border-lavender-500" : "border-peach-500"
              )}>
                <CardContent className="pt-6">
                  <h3 className={cn(TYPOGRAPHY_H3.className, "text-gray-900 dark:text-white mb-3")}>
                    РўРёРї РіРѕР»РѕСЃРѕРІР°РЅРёСЏ
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setIsMultiSelect(false); haptic.selection(); }}
                      className={cn(
                        'p-3 rounded-xl border-2 transition-all text-center',
                        !isMultiSelect
                          ? isDark ? 'border-lavender-500 bg-lavender-500/5' : 'border-peach-500 bg-peach-50'
                          : 'border-border bg-background hover:border-muted-foreground/30'
                      )}
                    >
                      <Circle className={cn('mx-auto mb-1.5', ICON_SIZES.md,
                        !isMultiSelect
                          ? isDark ? 'text-lavender-500' : 'text-peach-500'
                          : 'text-muted-foreground'
                      )} />
                      <span className="text-sm font-medium block">РћРґРЅРѕ Р±Р»СЋРґРѕ</span>
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setIsMultiSelect(true); haptic.selection(); }}
                      className={cn(
                        'p-3 rounded-xl border-2 transition-all text-center',
                        isMultiSelect
                          ? isDark ? 'border-lavender-500 bg-lavender-500/5' : 'border-peach-500 bg-peach-50'
                          : 'border-border bg-background hover:border-muted-foreground/30'
                      )}
                    >
                      <CheckCircle2 className={cn('mx-auto mb-1.5', ICON_SIZES.md,
                        isMultiSelect
                          ? isDark ? 'text-lavender-500' : 'text-peach-500'
                          : 'text-muted-foreground'
                      )} />
                      <span className="text-sm font-medium block">РќРµСЃРєРѕР»СЊРєРѕ Р±Р»СЋРґ</span>
                      <span className="text-xs text-muted-foreground">(РґРѕ {maxSelections} С€С‚)</span>
                    </motion.button>
                  </div>
                </CardContent>
              </PastelCard>

              {/* РљРЅРѕРїРєР° Р”Р°Р»РµРµ */}
              <motion.button
                whileTap={{ scale: canAdvance() ? 0.95 : 1 }}
                onClick={() => { if (canAdvance()) { haptic.impact(); setStep(2); } }}
                disabled={!canAdvance()}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-lg transition-all shadow-lg",
                  canAdvance()
                    ? isDark
                      ? "bg-gradient-to-r from-lavender-500 to-lavender-600 text-white shadow-lavender-500/30"
                      : "bg-gradient-to-r from-peach-500 to-coral-500 text-white shadow-peach-500/30"
                    : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                )}
              >
                <span>Р”Р°Р»РµРµ В· Р’С‹Р±СЂР°С‚СЊ Р±Р»СЋРґР°</span>
              </motion.button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                РќР°Р·Р°Рґ
              </button>
              <h2 className="text-lg font-bold text-foreground">Р’С‹Р±РµСЂРёС‚Рµ Р±Р»СЋРґР°</h2>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Р—Р°РєСЂС‹С‚СЊ"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="px-6 pb-8 space-y-4">
              <PastelCard variant="default">
                <CardContent className="pt-6">
                  {/* РЎС‡С‘С‚С‡РёРє + РґРµР№СЃС‚РІРёСЏ */}
                  <div className="flex items-center justify-between mb-3">
                    <motion.p
                      key={selectedItems.size}
                      initial={{ scale: 1.1 }}
                      animate={{ scale: 1 }}
                      className="text-sm text-gray-600 dark:text-gray-400"
                    >
                      Р’С‹Р±СЂР°РЅРѕ <span className={cn("font-bold", isDark ? "text-lavender-500" : "text-peach-500")}>
                        {selectedItems.size} {selectedItems.size === 1 ? 'Р±Р»СЋРґРѕ' : selectedItems.size < 5 ? 'Р±Р»СЋРґР°' : 'Р±Р»СЋРґ'}
                      </span>
                    </motion.p>
                    <div className="flex gap-3">
                      <button
                        onClick={toggleAll}
                        className={cn("text-sm font-medium", isDark ? "text-lavender-400" : "text-peach-600")}
                      >
                        {selectedItems.size === menuItems.length ? 'РЎРЅСЏС‚СЊ РІСЃС‘' : 'Р’С‹Р±СЂР°С‚СЊ РІСЃС‘'}
                      </button>
                      <button
                        onClick={selectRandom}
                        className={cn("text-sm font-medium flex items-center gap-1", isDark ? "text-lavender-400" : "text-peach-600")}
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                        РЎР»СѓС‡Р°Р№РЅРѕ
                      </button>
                    </div>
                  </div>

                  {/* РџСЂРѕРіСЂРµСЃСЃ РІС‹Р±РѕСЂР° */}
                  <Progress
                    value={(selectedItems.size / menuItems.length) * 100}
                    className={cn(
                      "h-2 mb-4",
                      isDark
                        ? "[&>div]:bg-gradient-to-r [&>div]:from-lavender-400 [&>div]:to-lavender-600"
                        : "[&>div]:bg-gradient-to-r [&>div]:from-peach-400 [&>div]:to-coral-500"
                    )}
                  />

                  {/* РџРѕРґСЃРєР°Р·РєР° */}
                  <AnimatePresence>
                    {selectedItems.size < 2 && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="mb-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex items-start gap-2">
                          <AlertCircle className={cn(ICON_SIZES.sm, "text-gray-500 flex-shrink-0 mt-0.5")} />
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            Р’С‹Р±РµСЂРёС‚Рµ РјРёРЅРёРјСѓРј 2 Р±Р»СЋРґР°
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* РЎРїРёСЃРѕРє Р±Р»СЋРґ */}
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {visibleItems.map((item) => {
                      const isSelected = selectedItems.has(item.id);
                      return (
                        <motion.button
                          key={item.id}
                          layout
                          onClick={() => toggleItem(item.id)}
                          className={cn(
                            "w-full text-left p-3 rounded-2xl border-2 transition-all",
                            isSelected
                              ? isDark
                                ? "border-lavender-500 bg-lavender-500/5"
                                : "border-peach-500 bg-peach-50"
                              : "border-border bg-background"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              {isSelected ? (
                                <CheckCircle2 className={cn(ICON_SIZES.md, isDark ? "text-lavender-500" : "text-peach-500")} />
                              ) : (
                                <Circle className={`${ICON_SIZES.md} text-muted-foreground/30`} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                                {item.name}
                              </h4>
                            </div>
                            {item.price && (
                              <div className={cn(
                                "flex-shrink-0 px-2 py-1 rounded-md",
                                isDark ? "bg-lavender-900/20 text-lavender-400" : "bg-peach-50 text-peach-700"
                              )}>
                                <p className="text-sm font-semibold whitespace-nowrap">{item.price} в‚Ѕ</p>
                              </div>
                            )}
                            {item.imageUrl && (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className={`${ICON_SIZES['2xl']} object-cover rounded-lg`}
                              />
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </CardContent>
              </PastelCard>

              {/* РћС€РёР±РєР° */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border-2 border-red-300 dark:border-red-700"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className={cn(ICON_SIZES.md, "text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5")} />
                      <p className="text-red-700 dark:text-red-300 text-sm font-medium">{error}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Р—Р°РїСѓСЃС‚РёС‚СЊ */}
              <motion.button
                whileTap={{ scale: canCreatePoll() ? 0.95 : 1 }}
                onClick={handleCreate}
                disabled={!canCreatePoll() || creating}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-lg transition-all shadow-lg",
                  canCreatePoll() && !creating
                    ? isDark
                      ? "bg-gradient-to-r from-lavender-500 to-lavender-600 text-white shadow-lavender-500/30"
                      : "bg-gradient-to-r from-peach-500 to-coral-500 text-white shadow-peach-500/30"
                    : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                )}
              >
                {creating ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Р—Р°РїСѓСЃРє РіРѕР»РѕСЃРѕРІР°РЅРёСЏ...</span>
                  </>
                ) : (
                  <>
                    <Check className={ICON_SIZES.md} />
                    <span>Р—Р°РїСѓСЃС‚РёС‚СЊ РіРѕР»РѕСЃРѕРІР°РЅРёРµ</span>
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
