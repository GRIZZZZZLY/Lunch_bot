import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Header } from '../components/layout/Layout';
import { PageHeader } from '../components/common/PageHeader';
import { MenuList } from '../components/menu/MenuList';
import { MenuForm, MenuFormData } from '../components/menu/MenuForm';
import { SearchInput } from '../components/common/SearchInput';
import { CategoryFilter } from '../components/common/CategoryFilter';
import { SortSelector, SortOption } from '../components/common/SortSelector';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { PullToRefresh } from '../components/common/PullToRefresh';
import { EmptyMenuState, EmptySearchState } from '../components/common/EmptyState';
import { useHaptic } from '../hooks/useHaptic';
import { Plus, UtensilsCrossed, Sparkles, Tag } from 'lucide-react';
import { GlassHeroCard, GlassSearchBar } from '../components/glass';
import { BottomSheet } from '../components/common/BottomSheet';
import { 
  MenuListSkeleton, 
  StatCardSkeleton, 
  SearchFilterSkeleton 
} from '../components/common/SkeletonLoader';
import { useAuth } from '../hooks/useAuth';
import { useTelegram } from '../hooks/useTelegram';
import { useMenu, useUI } from '../store/useAppStore';
import { menuService, MenuItem } from '../services/menu.service';
import { mockApiService } from '../services/mockApi.service';

/**
 * Страница управления меню
 */
export const MenuPage: React.FC = () => {
  const { user } = useAuth();
  const { mainButton, backButton, colorScheme } = useTelegram();
  const { addNotification } = useUI();
  const haptic = useHaptic();
  
  const isDark = colorScheme === 'dark';
  
  const {
    menuItems,
    selectedCategory,
    menuLoading,
    setMenuItems,
    setSelectedCategory,
    setMenuLoading,
    addMenuItem,
    updateMenuItem,
    removeMenuItem,
  } = useMenu();

  const [categories, setCategories] = useState<string[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Объединяем состояния в одно
  const [formState, setFormState] = useState({ isOpen: false, clickCount: 0 });
  
  const openBottomSheet = useCallback(() => {
    console.log('Opening BottomSheet');
    setFormState(prev => ({ ...prev, isOpen: true }));
  }, []);
  
  const closeBottomSheet = useCallback(() => {
    console.log('Closing BottomSheet');
    setFormState(prev => ({ ...prev, isOpen: false }));
    // Показываем mainButton обратно после закрытия
    if (user?.isAdmin) {
      mainButton.show();
    }
  }, [user, mainButton]);

  // Фильтрация блюд по категории и поиску
  const filteredItems = useMemo(() => {
    let filtered = menuItems;

    // Фильтр по категории
    if (selectedCategory) {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Фильтр по поисковому запросу
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query)
      );
    }

    // Сортировка по названию (по умолчанию)
    filtered.sort((a, b) => a.name.localeCompare(b.name));

    return filtered;
  }, [menuItems, selectedCategory, searchQuery]);

  // Загрузка данных при монтировании
  useEffect(() => {
    loadMenuItems();
    loadCategories();
    loadCategoryCounts();
  }, []);

  // Настройка Telegram mainButton (работает!)
  useEffect(() => {
    if (user?.isAdmin) {
      mainButton.setText('Добавить блюдо');
      mainButton.onClick(() => setFormState(prev => ({ ...prev, isOpen: true })));
      mainButton.show();
    } else {
      mainButton.hide();
    }
    backButton.hide();

    return () => {
      mainButton.hide();
      backButton.hide();
    };
  }, [user, mainButton, backButton]);

  const loadMenuItems = async () => {
    try {
      setMenuLoading(true);
      const response = await menuService.getAllItems();
      
      if (response.success && response.data) {
        setMenuItems(response.data);
      } else {
        throw new Error(response.error || 'Failed to load menu items');
      }
    } catch (error) {
      console.error('Error loading menu items:', error);
      addNotification({
        type: 'error',
        message: 'Ошибка загрузки меню',
      });
    } finally {
      setMenuLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadMenuItems();
    await loadCategories();
    await loadCategoryCounts();
    haptic.success();
  };

  const loadCategories = async () => {
    try {
      const response = await menuService.getCategories();
      if (response.success && response.data) {
        setCategories(response.data);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadCategoryCounts = async () => {
    try {
      const response = await mockApiService.getMenuCategoriesWithCount();
      if (response.success && response.data) {
        setCategoryCounts(response.data);
      }
    } catch (error) {
      console.error('Error loading category counts:', error);
    }
  };

  const handleAddItem = async (itemData: MenuFormData) => {
    try {
      const response = await menuService.createItem(itemData);
      
      if (response.success && response.data) {
        addMenuItem(response.data);
        addNotification({
          type: 'success',
          message: `Блюдо "${response.data.name}" добавлено`,
        });
        closeBottomSheet();
        await loadCategories(); // Обновляем категории
      } else {
        throw new Error(response.error || 'Failed to create item');
      }
    } catch (error) {
      console.error('Error adding menu item:', error);
      addNotification({
        type: 'error',
        message: 'Ошибка добавления блюда',
      });
    }
  };

  const handleEditItem = async (itemData: MenuFormData) => {
    if (!editingItem) return;
    
    try {
      const response = await menuService.updateItem(editingItem.id, itemData);
      
      if (response.success && response.data) {
        updateMenuItem(editingItem.id, response.data);
        addNotification({
          type: 'success',
          message: `Блюдо "${response.data.name}" обновлено`,
        });
        setEditingItem(null);
        await loadCategories(); // Обновляем категории
      } else {
        throw new Error(response.error || 'Failed to update item');
      }
    } catch (error) {
      console.error('Error updating menu item:', error);
      addNotification({
        type: 'error',
        message: 'Ошибка обновления блюда',
      });
    }
  };

  const handleDeleteItem = async (id: number) => {
    try {
      const response = await menuService.deleteItem(id);
      
      if (response.success) {
        removeMenuItem(id);
        addNotification({
          type: 'success',
          message: 'Блюдо удалено',
        });
        // Закрываем форму редактирования если она открыта
        if (editingItem?.id === id) {
          setEditingItem(null);
        }
        await loadCategories(); // Обновляем категории
      } else {
        throw new Error(response.error || 'Failed to delete item');
      }
    } catch (error) {
      console.error('Error deleting menu item:', error);
      addNotification({
        type: 'error',
        message: 'Ошибка удаления блюда',
      });
    }
  };

  const handleToggleStatus = async (id: number) => {
    try {
      const response = await menuService.toggleItemStatus(id);
      
      if (response.success && response.data) {
        updateMenuItem(id, { isActive: response.data.isActive });
        addNotification({
          type: 'success',
          message: `Блюдо ${response.data.isActive ? 'активировано' : 'деактивировано'}`,
        });
      } else {
        throw new Error(response.error || 'Failed to toggle status');
      }
    } catch (error) {
      console.error('Error toggling item status:', error);
      addNotification({
        type: 'error',
        message: 'Ошибка изменения статуса',
      });
    }
  };

  return (
    <>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="space-y-4">
        
        {/* Hero Card с статистикой меню */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <GlassHeroCard
            gradient={{ from: '#FB923C', to: '#F97316' }}
            value={menuItems.length.toString()}
            label="Блюд в меню"
            sublabel={`${categories.length} ${categories.length === 1 ? 'категория' : categories.length < 5 ? 'категории' : 'категорий'} · ${menuItems.filter(i => i.isActive).length} активных`}
            textColor="#FFFFFF"
            icon={<UtensilsCrossed size={24} />}
            className="shadow-lg"
          />
        </motion.div>
        

        {/* Glass Search Bar */}
        {!menuLoading && menuItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <GlassSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Поиск блюд..."
              theme={isDark ? 'dark' : 'light'}
            />
          </motion.div>
        )}

        {/* Фильтр по категориям */}
        {!menuLoading && categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <CategoryFilter
              categories={categories}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              itemCounts={categoryCounts}
              className="bg-telegram-bg-color"
            />
          </motion.div>
        )}

        {/* Quick Stats - дополнительная статистика */}
        {!menuLoading && menuItems.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center space-x-2 mb-1">
                <Sparkles size={16} className="text-green-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Активных</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {menuItems.filter(item => item.isActive).length} / {menuItems.length}
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center space-x-2 mb-1">
                <Tag size={16} className="text-purple-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Средняя цена</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                ₽{menuItems.length > 0 ? Math.round(menuItems.reduce((sum, item) => sum + (item.price || 0), 0) / menuItems.length) : 0}
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-100 dark:border-gray-700 col-span-2 md:col-span-1">
              <div className="flex items-center space-x-2 mb-1">
                <UtensilsCrossed size={16} className="text-primary-food-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedCategory ? 'Показано' : 'Всего стоимость'}
                </span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                ₽{filteredItems.reduce((sum, item) => sum + (item.price || 0), 0).toLocaleString('ru-RU')}
              </p>
            </div>
          </div>
        )}

        {/* Список блюд */}
        {menuLoading ? (
          <MenuListSkeleton count={6} />
        ) : filteredItems.length === 0 ? (
          (selectedCategory || searchQuery) ? (
            <EmptySearchState />
          ) : (
            <EmptyMenuState onAction={user?.isAdmin ? openBottomSheet : undefined} />
          )
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            <MenuList
              items={filteredItems}
              loading={menuLoading}
              onEdit={setEditingItem}
              onDelete={handleDeleteItem}
              onToggleStatus={handleToggleStatus}
              onAdd={openBottomSheet}
              showActions={user?.isAdmin}
              selectedCategory={selectedCategory}
            />
          </motion.div>
        )}
        </div>
      </PullToRefresh>

      {/* Форма добавления через BottomSheet */}
      <BottomSheet
        isOpen={formState.isOpen}
        onClose={closeBottomSheet}
        title="Добавить блюдо"
        enableBackdrop={true}
        snapPoints={[85, 95]}
        initialSnap={0}
      >
        <div className="p-4">
          <MenuForm
            onSubmit={handleAddItem}
            onCancel={closeBottomSheet}
            loading={menuLoading}
          />
        </div>
      </BottomSheet>
      
      {/* Форма редактирования */}
      {editingItem && (
        <BottomSheet
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          title="Редактировать блюдо"
          enableBackdrop={true}
          snapPoints={[85, 95]}
          initialSnap={0}
        >
          <div className="p-4">
            <MenuForm
              item={editingItem}
              onSubmit={handleEditItem}
              onCancel={() => setEditingItem(null)}
              loading={menuLoading}
            />
          </div>
        </BottomSheet>
      )}


      

    </>
  );
};
