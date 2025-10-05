/**
 * CreatePollForm - Компактная форма создания голосования для BottomSheet
 * 
 * Оптимизирована для mobile:
 * - Минимум полей
 * - Быстрые кнопки для выбора
 * - Virtual scrolling для длинных списков
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
  Send,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useHaptic } from '@/hooks/useHaptic';
import { menuService, MenuItem } from '@/services/menu.service';
import { userService, Group } from '@/services/user.service';
import { pollsService } from '@/services/polls.service';

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
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [duration, setDuration] = useState(30);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [showAllItems, setShowAllItems] = useState(false);
  const [loading, setLoading] = useState(true);
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

      if (menuResponse.success && menuResponse.data) {
        setMenuItems(menuResponse.data);
        // Auto-select all items by default
        setSelectedItems(new Set(menuResponse.data.map(item => item.id)));
      }

      if (groupsResponse.success && groupsResponse.data) {
        setGroups(groupsResponse.data);
        // Auto-select first group
        if (groupsResponse.data.length > 0) {
          setSelectedGroupId(groupsResponse.data[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
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
      if (err.message?.includes('already has an active poll')) {
        errorMessage = 'В этой группе уже есть активное голосование';
      } else if (err.message?.includes('Not enough items')) {
        errorMessage = 'Выберите минимум 2 блюда';
      }
      
      setError(errorMessage);
      haptic.error();
    } finally {
      setCreating(false);
    }
  };

  const toggleItem = (itemId: number) => {
    haptic.light();
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const toggleAll = () => {
    haptic.selection();
    if (selectedItems.size === menuItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(menuItems.map(item => item.id)));
    }
  };

  const setQuickDuration = (minutes: number) => {
    haptic.selection();
    setDuration(minutes);
  };

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
        <AlertCircle className="mx-auto mb-4 text-yellow-500" size={48} />
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
        <AlertCircle className="mx-auto mb-4 text-orange-500" size={48} />
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

  // Compact view: show only first 5 items unless expanded
  const visibleItems = compact && !showAllItems 
    ? menuItems.slice(0, 5) 
    : menuItems;
  
  const hasMore = compact && menuItems.length > 5;

  return (
    <div className="p-6 space-y-5 bg-white dark:bg-gray-900">
      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
          >
            <div className="flex items-start gap-2">
              <AlertCircle size={18} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Group Selection */}
      {groups.length > 0 && (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            <Users size={16} className="text-primary-food-500" />
            <span>Группа</span>
          </label>
          <select
            value={selectedGroupId || ''}
            onChange={(e) => {
              setSelectedGroupId(parseInt(e.target.value));
              haptic.selection();
            }}
            className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-food-500 transition-all"
          >
            {groups.map(group => (
              <option key={group.id} value={group.id}>
                {group.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Duration */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
          <Clock size={16} className="text-primary-food-500" />
          <span>Длительность</span>
        </label>
        
        {/* Quick Duration Buttons */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[15, 30, 60].map((minutes) => (
            <motion.button
              key={minutes}
              whileTap={{ scale: 0.95 }}
              onClick={() => setQuickDuration(minutes)}
              className={cn(
                "p-3 rounded-lg border-2 transition-all",
                duration === minutes
                  ? "border-primary-food-500 bg-primary-food-50 dark:bg-primary-food-900/20"
                  : "border-gray-200 dark:border-gray-700"
              )}
            >
              <div className={cn(
                "text-lg font-bold",
                duration === minutes 
                  ? "text-primary-food-700 dark:text-primary-food-400" 
                  : "text-gray-900 dark:text-white"
              )}>
                {minutes}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">мин</div>
            </motion.button>
          ))}
        </div>

        {/* Custom Duration Input */}
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
          min={1}
          max={1440}
          className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-food-500"
          placeholder="Или введите свое..."
        />
      </div>

      {/* Menu Items Selection */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Блюда ({selectedItems.size} из {menuItems.length})
          </label>
          <button
            onClick={toggleAll}
            className="text-sm font-medium text-primary-food-700 dark:text-primary-food-400 hover:underline"
          >
            {selectedItems.size === menuItems.length ? 'Снять все' : 'Выбрать все'}
          </button>
        </div>

        {/* Validation Warning */}
        {selectedItems.size < 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-3 p-2.5 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
          >
            <p className="text-yellow-700 dark:text-yellow-300 text-xs">
              Выберите минимум 2 блюда
            </p>
          </motion.div>
        )}

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
                  "w-full text-left p-3 rounded-lg border-2 transition-all",
                  isSelected
                    ? "border-primary-food-500 bg-primary-food-50 dark:bg-primary-food-900/20"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {isSelected ? (
                      <CheckCircle2 className="w-5 h-5 text-primary-food-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                      {item.name}
                    </h4>
                    {item.price && (
                      <p className="text-xs font-semibold text-primary-food-700 dark:text-primary-food-400">
                        {item.price} ₽
                      </p>
                    )}
                  </div>

                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-12 h-12 object-cover rounded-lg"
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
              haptic.light();
            }}
            className="w-full mt-2 py-2 text-sm font-medium text-primary-food-700 dark:text-primary-food-400 hover:underline flex items-center justify-center gap-1"
          >
            {showAllItems ? (
              <>
                <span>Показать меньше</span>
                <ChevronUp size={16} />
              </>
            ) : (
              <>
                <span>Показать все ({menuItems.length - 5} еще)</span>
                <ChevronDown size={16} />
              </>
            )}
          </button>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={creating}
            className="flex-1 px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
        )}
        
        <motion.button
          whileTap={{ scale: canCreatePoll() ? 0.95 : 1 }}
          onClick={handleCreate}
          disabled={!canCreatePoll() || creating}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all",
            canCreatePoll() && !creating
              ? "bg-primary-food-600 hover:bg-primary-food-700 text-white"
              : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
          )}
        >
          {creating ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Запуск...</span>
            </>
          ) : (
            <>
              <Send size={18} />
              <span>Запустить</span>
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
};
