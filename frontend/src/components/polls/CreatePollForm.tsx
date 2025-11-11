/**
 * CreatePollForm - Форма создания голосования с glassmorphism дизайном
 * 
 * Оптимизирована для mobile:
 * - Glassmorphism & time-based градиенты
 * - Smart presets & live preview
 * - Enhanced визуализация блюд
 * - Progress indicators
 * - Haptic feedback
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  Users, 
  CheckCircle2, 
  Circle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Utensils,
  Check,
  Shuffle,
  Loader,
  X,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PastelCard, CardContent, CardHeader, CardTitle } from '../ui/pastel-card';
import { Progress } from '../ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useHaptic } from '@/hooks/useHaptic';
import { menuService, MenuItem } from '@/services/menu.service';
import { userService, Group } from '@/services/user.service';
import { pollsService } from '@/services/polls.service';
import { RecurringPollForm } from './RecurringPollForm';
import { ICON_SIZES } from '@/lib/design-tokens';

interface CreatePollFormProps {
  onSuccess?: (pollId: number) => void;
  onCancel?: () => void;
  compact?: boolean;
}

export const CreatePollForm: React.FC<CreatePollFormProps> = ({
  onSuccess,
  onCancel,
  compact = true,
}) => {
  const { user } = useAuth();
  const haptic = useHaptic();

  // State
  const [activeTab, setActiveTab] = useState<'single' | 'recurring'>('single');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [duration, setDuration] = useState(30);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [showAllItems, setShowAllItems] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creationStep, setCreationStep] = useState(0);
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

      console.log('[CreatePollForm] 🔍 Menu response:', {
        success: menuResponse.success,
        dataLength: menuResponse.data?.length || 0,
        data: menuResponse.data,
        error: menuResponse.error
      });

      if (menuResponse.success && menuResponse.data) {
        setMenuItems(menuResponse.data);
        // ✅ UX FIX: Don't pre-select all items (Paradox of Choice)
        // Admin can use "🎲 Случайные 5" or select manually
        // Was: setSelectedItems(new Set(menuResponse.data.map(item => item.id)));
        console.log('[CreatePollForm] ✅ Menu items loaded:', menuResponse.data.length);
      } else {
        console.error('[CreatePollForm] ❌ Failed to load menu:', menuResponse.error);
      }

      console.log('[CreatePollForm] 🔍 Groups response:', {
        success: groupsResponse.success,
        dataLength: groupsResponse.data?.length || 0,
      });

      if (groupsResponse.success && groupsResponse.data) {
        setGroups(groupsResponse.data);
        // Auto-select first group
        if (groupsResponse.data.length > 0) {
          setSelectedGroupId(groupsResponse.data[0].id);
        }
      }
    } catch (err) {
      console.error('[CreatePollForm] ❌ Error loading data:', err);
      setError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

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
      setError('Заполните все поля корректно');
      haptic.error();
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const response = await pollsService.createPollFromWebApp({
        groupId: selectedGroupId!,
        duration,
        selectedMenuItems: Array.from(selectedItems),
        title: 'Голосование за обед',
      });

      if (response.success && response.data) {
        haptic.success();
        onSuccess?.(response.data.pollId);
      } else {
        throw new Error(response.error || 'Failed to create poll');
      }
    } catch (err: any) {
      console.error('Error creating poll:', err);
      
      let errorMessage = 'Ошибка создания голосования';
      
      // Проверяем разные типы ошибок
      const errorText = err.error || err.message || '';
      
      if (errorText.includes('already has an active poll') || errorText.includes('Group already has active poll')) {
        errorMessage = 'В этой группе уже есть активное голосование. Дождитесь его завершения.';
      } else if (errorText.includes('Not enough items') || errorText.includes('NOT_ENOUGH_ITEMS')) {
        errorMessage = 'Выберите минимум 2 блюда';
      } else if (errorText.includes('Network error') || err.code === 'NETWORK_ERROR') {
        errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
      } else if (errorText.includes('Access denied') || err.code === 'ACCESS_DENIED') {
        errorMessage = 'Недостаточно прав для создания голосования';
      } else if (err.code === 'INVALID_GROUP') {
        errorMessage = 'Выберите группу';
      } else if (errorText) {
        errorMessage = `Ошибка: ${errorText}`;
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
    console.log('[CreatePollForm] 🎲 selectRandom clicked', { 
      totalItems: menuItems.length,
      currentSelected: selectedItems.size 
    });
    
    haptic.impact();
    
    // Случайный выбор от 3 до 6 блюд (или меньше если блюд мало)
    const maxCount = Math.min(6, menuItems.length);
    const minCount = Math.min(3, menuItems.length);
    const count = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;
    
    console.log('[CreatePollForm] 🎲 Selecting random items', { count, maxCount, minCount });
    
    const shuffled = [...menuItems].sort(() => Math.random() - 0.5);
    const randomItems = shuffled.slice(0, count);
    const newSelection = new Set(randomItems.map(item => item.id));
    
    console.log('[CreatePollForm] ✅ Random items selected', { 
      selectedIds: Array.from(newSelection),
      selectedNames: randomItems.map(i => i.name)
    });
    
    setSelectedItems(newSelection);
  };

  // Format duration для live preview
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} мин`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}ч ${mins}м` : `${hours} час${hours > 1 ? 'а' : ''}`;
    }
  };

  // Все блюда без фильтрации
  const visibleItems = compact && !showAllItems 
    ? menuItems.slice(0, 5) 
    : menuItems;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 bg-white dark:bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="p-6 text-center bg-white dark:bg-gray-900">
        <AlertCircle className={`${ICON_SIZES['2xl']} mx-auto mb-4 text-yellow-500`} />
        <p className="text-gray-600 dark:text-gray-400">
          Только администраторы могут запускать голосования
        </p>
      </div>
    );
  }

  // Check if no menu items
  if (menuItems.length === 0) {
    return (
      <div className="p-6 text-center bg-white dark:bg-gray-900">
        <AlertCircle className={`${ICON_SIZES['2xl']} mx-auto mb-4 text-orange-500`} />
        <p className="text-gray-900 dark:text-white font-semibold mb-2">
          Меню пустое
        </p>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Добавьте блюда в меню перед созданием голосования
        </p>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Закрыть
          </button>
        )}
      </div>
    );
  }

  const hasMore = compact && menuItems.length > 5;

  return (
    <div className="relative space-y-0 bg-white dark:bg-gray-900">


      {/* Tabs for Single vs Recurring */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="pt-12">
        <div className="px-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <Zap className={ICON_SIZES.sm} />
              Разовое
            </TabsTrigger>
            <TabsTrigger value="recurring" className="flex items-center gap-2">
              <RotateCcw className={ICON_SIZES.sm} />
              Автоматическое
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Single Poll Form */}
        <TabsContent value="single">
          <div className="p-6 pt-4 space-y-5">
      {/* 🎨 Group Selection - Pastel Card */}
      {groups.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <PastelCard variant="lavender">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800">
                  <Users className={`${ICON_SIZES.md} text-gray-600 dark:text-gray-400`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Группа
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-gray-400">
                    Где запустить голосование
                  </p>
                </div>
              </div>
              
              {/* Группы как радио-кнопки */}
              <div className="space-y-2">
                {groups.map((group, index) => (
                  <motion.button
                    key={group.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + index * 0.05 }}
                    onClick={() => {
                      setSelectedGroupId(group.id);
                    }}
                    className={cn(
                      "w-full p-3 rounded-2xl border-2 transition-all",
                      selectedGroupId === group.id
                        ? "border-lavender-500 bg-lavender-50 dark:bg-lavender-500/10"
                        : "border-gray-200 dark:border-gray-700 hover:border-lavender-300 dark:hover:border-lavender-700"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {group.title}
                      </span>
                      {selectedGroupId === group.id && (
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                        >
                          <CheckCircle2 className="text-lavender-500" size={20} />
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </CardContent>
          </PastelCard>
        </motion.div>
      )}

      {/* 🎨 Duration - Smart Presets */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <PastelCard variant="sky">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-mint-500/20">
                  <Clock className={`${ICON_SIZES.md} text-mint-500`} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">Длительность голосования</h3>
                </div>
              </div>
              
              {/* Live countdown preview */}
              <motion.div 
                key={duration}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className="px-3 py-1.5 rounded-lg bg-mint-50 dark:bg-mint-500/10"
              >
                <span className="text-sm font-bold text-mint-700 dark:text-mint-400">
                  {formatDuration(duration)}
                </span>
              </motion.div>
            </div>

            {/* Slider для выбора времени */}
            <div>
              <input
                type="range"
                min={5}
                max={240}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #5CAE87 0%, #5CAE87 ${(duration / 240) * 100}%, #e5e7eb ${(duration / 240) * 100}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-400 mt-1">
                <span>5 мин</span>
                <span>4 часа</span>
              </div>
            </div>
          </CardContent>
        </PastelCard>
      </motion.div>

      {/* 🎨 Menu Items Selection - Enhanced */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <PastelCard variant="peach">
          <CardContent className="pt-6">
            {/* Header с статистикой */}
            <div className="mb-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-lavender-500/20">
                  <Utensils className={`${ICON_SIZES.md} text-lavender-500`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Блюда в голосовании
                  </h3>
                  <motion.p 
                    key={selectedItems.size}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    className="text-xs text-gray-400 dark:text-gray-400"
                  >
                    Выбрано <span className="font-bold text-lavender-600 dark:text-lavender-400">
                      {selectedItems.size} {selectedItems.size === 1 ? 'блюдо' : selectedItems.size < 5 ? 'блюда' : 'блюд'}
                    </span>
                  </motion.p>
                </div>
              </div>
            </div>

            {/* Progress bar визуализация */}
            <div className="mb-3">
              <Progress 
                value={(selectedItems.size / menuItems.length) * 100}
                className="h-2"
              />
            </div>

            {/* Quick actions */}
            <div className="flex gap-2 mb-4">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={toggleAll}
                className="px-4 py-2 rounded-lg text-sm font-medium border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
              >
                <X className={ICON_SIZES.sm} />
                <span>{selectedItems.size === menuItems.length ? 'Снять всё' : 'Выбрать всё'}</span>
              </motion.button>
              
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={selectRandom}
                className="px-4 py-2 rounded-lg text-sm font-medium border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
              >
                <Shuffle className={ICON_SIZES.sm} />
                <span>Случайный выбор</span>
              </motion.button>
            </div>

            {/* Validation hint */}
            <AnimatePresence>
              {selectedItems.size < 2 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className={cn(ICON_SIZES.sm, "text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5")} />
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      💡 Выберите минимум 2 блюда для голосования
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

        {/* Items List */}
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
                    ? "border-primary-food-500 bg-primary-food-50 dark:bg-primary-food-900/20"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {isSelected ? (
                      <CheckCircle2 className={`${ICON_SIZES.md} text-primary-food-500`} />
                    ) : (
                      <Circle className={`${ICON_SIZES.md} text-gray-300 dark:text-gray-600`} />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                      {item.name}
                    </h4>
                  </div>

                  {item.price && (
                    <div className="flex-shrink-0 px-2 py-1 rounded-md bg-primary-food-50 dark:bg-primary-food-900/20">
                      <p className="text-sm font-semibold text-primary-food-700 dark:text-primary-food-400 whitespace-nowrap">
                        {item.price} ₽
                      </p>
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

            {/* Show More Button */}
            {hasMore && (
              <button
                onClick={() => {
                  setShowAllItems(!showAllItems);
                }}
                className="w-full mt-3 py-2 text-sm font-medium text-lavender-600 dark:text-lavender-400 flex items-center justify-center gap-1 hover:underline"
              >
                {showAllItems ? (
                  <>
                    <span>Показать меньше</span>
                    <ChevronUp className={ICON_SIZES.sm} />
                  </>
                ) : (
                  <>
                    <span>Показать все ({menuItems.length - 5} еще)</span>
                    <ChevronDown className={ICON_SIZES.sm} />
                  </>
                )}
              </button>
            )}
          </CardContent>
        </PastelCard>
      </motion.div>

        {/* Error Alert - показывается перед кнопками */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border-2 border-red-300 dark:border-red-700 shadow-lg"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className={cn(ICON_SIZES.md, "text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5")} />
                <p className="text-red-700 dark:text-red-300 text-sm font-medium">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Button */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <motion.button
            whileTap={{ scale: canCreatePoll() ? 0.95 : 1 }}
            onClick={handleCreate}
            disabled={!canCreatePoll() || creating}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-lg transition-all shadow-lg",
              canCreatePoll() && !creating
                ? "bg-gradient-to-r from-lavender-500 to-lavender-600 hover:from-lavender-600 hover:to-lavender-700 text-white shadow-lavender-500/30 hover:shadow-lavender-600/40"
                : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            )}
          >
            {creating ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Запуск голосования...</span>
              </>
            ) : (
              <>
                <Check className={ICON_SIZES.md} />
                <span>Запустить голосование</span>
              </>
            )}
          </motion.button>
        </div>
          </div>
        </TabsContent>

        {/* Recurring Poll Form */}
        <TabsContent value="recurring">
          <RecurringPollForm
            groups={groups}
            menuItems={menuItems}
            selectedGroupId={selectedGroupId}
            onSuccess={() => {
              haptic.success();
              onSuccess?.(0); // No pollId for recurring schedules
            }}
            onCancel={onCancel}
            compact={compact}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
