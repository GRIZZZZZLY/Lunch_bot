import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Header } from '../components/layout/Layout';
import { MenuList } from '../components/menu/MenuList';
import { MenuForm, MenuFormData } from '../components/menu/MenuForm';
import { SearchInput } from '../components/common/SearchInput';
import { CategoryFilter } from '../components/common/CategoryFilter';
import { SortSelector, SortOption } from '../components/common/SortSelector';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { PullToRefresh } from '../components/common/PullToRefresh';
import { EmptyMenuState, EmptySearchState } from '../components/common/EmptyState';
import { useHaptic } from '../hooks/useHaptic';
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
  const { mainButton, backButton } = useTelegram();
  const { addNotification } = useUI();
  const haptic = useHaptic();
  
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

  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [sortBy, setSortBy] = useState<string>('name');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Опции сортировки
  const sortOptions: SortOption[] = [
    { value: 'name', label: 'По названию', icon: '🔤' },
    { value: 'price', label: 'По цене', icon: '💰' },
    { value: 'category', label: 'По категории', icon: '📂' },
    { value: 'date', label: 'По дате', icon: '📅' },
  ];

  // Фильтрация и сортировка блюд
  const filteredAndSortedItems = useMemo(() => {
    let filtered = menuItems;

    // Фильтр по поиску
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower) ||
        item.category?.toLowerCase().includes(searchLower)
      );
    }

    // Фильтр по категории
    if (selectedCategory) {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Сортировка
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return (a.price || 0) - (b.price || 0);
        case 'category':
          return (a.category || '').localeCompare(b.category || '');
        case 'date':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [menuItems, searchTerm, selectedCategory, sortBy]);

  // Загрузка данных при монтировании
  useEffect(() => {
    loadMenuItems();
    loadCategories();
    loadCategoryCounts();
  }, []);

  // Настройка Telegram кнопок
  useEffect(() => {
    if (user?.isAdmin) {
      mainButton.setText('Добавить блюдо');
      mainButton.onClick(() => setShowAddForm(true));
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
        setShowAddForm(false);
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
    <Layout>
      <Header />
      
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="space-y-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Меню ресторана
          </h1>
          {menuLoading && (
            <LoadingSpinner size="sm" />
          )}
        </div>

        {/* Улучшенный поиск с skeleton */}
        {menuLoading ? (
          <SearchFilterSkeleton />
        ) : (
          <div className="space-y-4 animate-fade-in-up">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Поиск блюд по названию или описанию..."
              className="w-full"
            />

            <div className="flex flex-col lg:flex-row gap-4">
              {/* Фильтр по категориям */}
              <div className="flex-1">
                <CategoryFilter
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                  itemCounts={categoryCounts}
                  className="bg-telegram-bg-color"
                />
              </div>

              {/* Сортировка */}
              <div className="lg:w-64">
                <SortSelector
                  options={sortOptions}
                  value={sortBy}
                  onChange={setSortBy}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* Улучшенная статистика с skeleton */}
        {menuLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <StatCardSkeleton key={index} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-telegram-secondary-bg-color rounded-xl p-4 border border-telegram-secondary-bg-color/50 animate-scale-in hover:scale-105 transition-transform duration-200">
              <div className="text-2xl font-bold text-telegram-button-color animate-pulse-soft">
                {filteredAndSortedItems.length}
              </div>
              <div className="text-sm text-telegram-hint-color">
                {searchTerm || selectedCategory ? 'Показано' : 'Всего блюд'}
              </div>
            </div>
            
            <div className="bg-telegram-secondary-bg-color rounded-xl p-4 border border-telegram-secondary-bg-color/50 animate-scale-in hover:scale-105 transition-transform duration-200" style={{ animationDelay: '100ms' }}>
              <div className="text-2xl font-bold text-green-500 animate-pulse-soft">
                {filteredAndSortedItems.filter(item => item.isActive).length}
              </div>
              <div className="text-sm text-telegram-hint-color">Активных</div>
            </div>
            
            <div className="bg-telegram-secondary-bg-color rounded-xl p-4 border border-telegram-secondary-bg-color/50 animate-scale-in hover:scale-105 transition-transform duration-200" style={{ animationDelay: '200ms' }}>
              <div className="text-2xl font-bold text-purple-500 animate-pulse-soft">
                {categories.length}
              </div>
              <div className="text-sm text-telegram-hint-color">Категорий</div>
            </div>
            
            <div className="bg-telegram-secondary-bg-color rounded-xl p-4 border border-telegram-secondary-bg-color/50 animate-scale-in hover:scale-105 transition-transform duration-200" style={{ animationDelay: '300ms' }}>
              <div className="text-2xl font-bold text-orange-500 animate-pulse-soft">
                ₽{filteredAndSortedItems.reduce((sum, item) => sum + (item.price || 0), 0)}
              </div>
              <div className="text-sm text-telegram-hint-color">Общая стоимость</div>
            </div>
          </div>
        )}

        {/* Результаты поиска */}
        {searchTerm && (
          <div className="bg-telegram-button-color/10 rounded-lg p-3 border-l-4 border-telegram-button-color animate-slide-down">
            <p className="text-sm text-telegram-text-color">
              <span className="font-semibold">Найдено:</span> {filteredAndSortedItems.length} из {menuItems.length} блюд
              {selectedCategory && <span> в категории "{selectedCategory}"</span>}
            </p>
          </div>
        )}

        {/* Список блюд с skeleton */}
        {menuLoading ? (
          <MenuListSkeleton count={6} />
        ) : filteredAndSortedItems.length === 0 ? (
          searchTerm || selectedCategory ? (
            <EmptySearchState />
          ) : (
            <EmptyMenuState onAction={user?.isAdmin ? () => setShowAddForm(true) : undefined} />
          )
        ) : (
          <div className="animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            <MenuList
              items={filteredAndSortedItems}
              loading={menuLoading}
              onEdit={setEditingItem}
              onDelete={handleDeleteItem}
              onToggleStatus={handleToggleStatus}
              onAdd={() => setShowAddForm(true)}
              showActions={user?.isAdmin}
              selectedCategory={selectedCategory}
            />
          </div>
        )}
        </div>
      </PullToRefresh>

      {/* Формы добавления и редактирования */}
      {showAddForm && (
        <MenuForm
          onSubmit={handleAddItem}
          onCancel={() => setShowAddForm(false)}
          loading={menuLoading}
        />
      )}

      {editingItem && (
        <MenuForm
          item={editingItem}
          onSubmit={handleEditItem}
          onCancel={() => setEditingItem(null)}
          loading={menuLoading}
        />
      )}
    </Layout>
  );
};
