import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout/Layout';
import { PageHeader } from '../components/common/PageHeader';
import { MenuList } from '../components/menu/MenuList';
import { VirtualMenuList } from '../components/menu/VirtualMenuList';
import { MenuForm, MenuFormData } from '../components/menu/MenuForm';
import { SuggestDishForm } from '../components/menu/SuggestDishForm';
import { SearchInput } from '../components/common/SearchInput';
import { FilterChips } from '../components/menu/FilterChips';
import { ConfirmDialog } from '../components/modals';
import { SortSelector, SortOption } from '../components/common/SortSelector';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { PullToRefresh } from '../components/common/PullToRefresh';
import { EmptyState } from '../components/common/EmptyState';
import { useHaptic } from '../hooks/useHaptic';
import { 
  Plus, 
  UtensilsCrossed, 
  Sparkles, 
  Tag, 
  Search, 
  Settings,
  X,
  Utensils,
  Filter,
  ChevronDown,
  Zap
} from 'lucide-react';
import { GlassHeroCard, GlassSearchBar } from '../components/glass';
import { BottomSheet } from '../components/common/BottomSheet';
import { 
  MenuListSkeleton, 
  StatCardSkeleton, 
  SearchFilterSkeleton 
} from '../components/common/SkeletonLoader';
import { MenuGridSkeleton, FilterChipsSkeleton } from '../components/menu/MenuGridSkeleton';
import { useAuth } from '../hooks/useAuth';
import { useTelegram } from '../hooks/useTelegram';
import { useMenu as useMenuHook, useUI, useAppStore } from '../store/useAppStore';
import { menuService, MenuItem } from '../services/menu.service';
import { useMenuItems, useMenuCategories, useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem, useToggleMenuItemStatus } from '../hooks/queries';
import { trackEvent, ANALYTICS_EVENTS } from '../lib/analytics';
import { mockApiService } from '../services/mockApi.service';
import { usePendingCount } from '../hooks/useSuggestions';

// New shadcn/ui components
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { PastelCard, CardContent } from '../components/ui/pastel-card';
import { ThemeToggle } from '../components/ui/theme-toggle';
// import { MediumWaveGradient } from '../components/background'; // REMOVED: убрали оранжевый градиент
import { cn } from '../lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';
import { TYPOGRAPHY_H2, TYPOGRAPHY_TINY } from '../lib/typography';

/**
 * Страница управления меню
 */
export const MenuPage: React.FC = () => {
  const { user } = useAuth();
  const { mainButton, backButton, colorScheme } = useTelegram();
  const { addNotification } = useUI();
  const haptic = useHaptic();
  const theme = useAppStore((state) => state.theme);
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  
  // Load menu items using React Query
  const { data: menuItems = [], isLoading: menuLoading, refetch: refetchMenu } = useMenuItems();
  const { data: categoriesData = [], refetch: refetchCategories } = useMenuCategories();
  
  // Load pending suggestions count (only for admin)
  const { data: pendingCount = 0 } = usePendingCount();
  
  // React Query mutations
  const { mutate: createItemMutation, isPending: isCreating } = useCreateMenuItem();
  const { mutate: updateItemMutation, isPending: isUpdating } = useUpdateMenuItem();
  const { mutate: deleteItemMutation, isPending: isDeleting } = useDeleteMenuItem();
  const { mutate: toggleStatusMutation, isPending: isToggling } = useToggleMenuItemStatus();
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = categoriesData; // Use categories from React Query
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // ✅ UX FIX: Show search by default if 10+ items (Hidden Feature fix)
  const [searchVisible, setSearchVisible] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Объединяем состояния в одно
  const [formState, setFormState] = useState({ isOpen: false, clickCount: 0 });
  const [suggestFormOpen, setSuggestFormOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: number; name: string } | null>(null);
  
  const openBottomSheet = useCallback(() => {
    console.log('Opening BottomSheet');
    setFormState(prev => ({ ...prev, isOpen: true }));
  }, []);
  
  const closeBottomSheet = useCallback(() => {
    console.log('Closing BottomSheet');
    setFormState(prev => ({ ...prev, isOpen: false }));
    // mainButton всегда скрыт - используем FAB вместо него
  }, []);

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
    // ✅ FIX: Копируем массив перед сортировкой, чтобы не мутировать кэш React Query
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

    return sorted;
  }, [menuItems, selectedCategory, searchQuery]);

  // Загрузка данных при монтировании (React Query auto-loads)
  useEffect(() => {
    // loadMenuItems() и loadCategories() больше не нужны - React Query загружает автоматически
    loadCategoryCounts();
  }, []);

  // Настройка Telegram UI
  useEffect(() => {
    // Скрываем mainButton - используем FAB вместо него
    mainButton.hide();
    backButton.hide();

    return () => {
      mainButton.hide();
      backButton.hide();
    };
  }, [mainButton, backButton]);

  // React Query handles loading automatically
  
  const handleRefresh = async () => {
    await refetchMenu();
    await refetchCategories();
    await loadCategoryCounts();
    haptic.success();
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
    console.log('[MenuPage] Adding item:', itemData);
    
    createItemMutation(itemData, {
      onSuccess: (data) => {
        console.log('[MenuPage] Item added successfully:', data);
        addNotification({
          type: 'success',
          message: `Блюдо "${itemData.name}" добавлено`,
        });
        closeBottomSheet();
        haptic.success();
        
        // P1.2.4: Track menu item creation
        trackEvent(ANALYTICS_EVENTS.MENU_ITEM_ADDED, {
          itemName: itemData.name,
          category: itemData.category,
          price: itemData.price,
        });
      },
      onError: (error) => {
        console.error('Error adding menu item:', error);
        addNotification({
          type: 'error',
          message: 'Ошибка добавления блюда',
        });
        haptic.error();
      },
    });
  };

  const handleEditItem = async (itemData: MenuFormData) => {
    if (!editingItem) return;
    console.log('[MenuPage] Editing item:', editingItem.id, itemData);
    
    updateItemMutation({ id: editingItem.id, data: itemData }, {
      onSuccess: (data) => {
        console.log('[MenuPage] Item updated successfully:', data);
        addNotification({
          type: 'success',
          message: `Блюдо "${itemData.name}" обновлено`,
        });
        setEditingItem(null);
        closeBottomSheet();
        haptic.success();
        
        // P1.2.4: Track menu item edit
        trackEvent(ANALYTICS_EVENTS.MENU_ITEM_EDITED, {
          itemId: editingItem.id,
          itemName: itemData.name,
        });
      },
      onError: (error) => {
        console.error('[MenuPage] Error updating item:', error);
        addNotification({
          type: 'error',
          message: 'Ошибка обновления блюда',
        });
        haptic.error();
      },
    });
  };

  const handleDeleteItem = (id: number) => {
    // Находим блюдо для отображения его имени в диалоге
    const item = menuItems.find(i => i.id === id);
    if (!item) return;

    // Открываем диалог подтверждения
    setItemToDelete({ id, name: item.name });
    haptic.light();
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;

    console.log('[MenuPage] Deleting item:', itemToDelete.id);

    deleteItemMutation(itemToDelete.id, {
      onSuccess: () => {
        console.log('[MenuPage] Item deleted successfully');
        addNotification({
          type: 'success',
          message: 'Блюдо удалено',
        });
        // Закрываем форму редактирования если она открыта
        if (editingItem?.id === itemToDelete.id) {
          setEditingItem(null);
        }
        haptic.success();

        // P1.2.4: Track menu item deletion
        trackEvent(ANALYTICS_EVENTS.MENU_ITEM_DELETED, {
          itemId: itemToDelete.id,
        });

        // Закрываем диалог
        setItemToDelete(null);
      },
      onError: (error) => {
        console.error('[MenuPage] Error deleting item:', error);
        addNotification({
          type: 'error',
          message: 'Ошибка удаления блюда',
        });
        haptic.error();

        // Закрываем диалог
        setItemToDelete(null);
      },
    });
  };

  const handleToggleStatus = async (id: number) => {
    toggleStatusMutation(id, {
      onSuccess: (data) => {
        addNotification({
          type: 'success',
          message: `Блюдо ${data?.isActive ? 'активировано' : 'деактивировано'}`,
        });
        haptic.success();
      },
      onError: (error) => {
        console.error('Error toggling item status:', error);
        addNotification({
          type: 'error',
          message: 'Ошибка изменения статуса',
        });
        haptic.error();
      },
    });
  };

  // Container animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  // Toggle search visibility
  const toggleSearch = () => {
    setSearchVisible(!searchVisible);
    haptic.light();
    
    // Focus input when opening
    if (!searchVisible) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  };

  // Calculate stats
  const totalCount = menuItems.length;
  const activeCount = menuItems.filter(item => item.isActive).length;
  const avgPrice = totalCount > 0 
    ? Math.round(menuItems.reduce((sum, item) => sum + (item.price || 0), 0) / totalCount)
    : 0;

  return (
    <>
      {/* Background removed - using neutral bg-background from Layout */}
      
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-4 pb-24 min-h-screen"
      >
        
        {/* 1. Compact Header (44px) */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Utensils className={`${ICON_SIZES.lg} text-peach-500`} />
              <h1 className="text-2xl font-bold text-foreground">Меню</h1>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Search toggle */}
              <Button 
                size="icon" 
                variant="ghost"
                onClick={toggleSearch}
                className="size-11"
              >
                <Search className={ICON_SIZES.md} />
              </Button>
              
              {/* Settings (admin only) */}
              {user?.isAdmin && (
                <ThemeToggle variant="ghost" size="icon" className="size-11" />
              )}
            </div>
          </div>
        </motion.div>

        {/* 2. Stats Grid with Glassmorphism */}
        {!menuLoading && menuItems.length > 0 && (
          <motion.div variants={itemVariants}>
            <div className="grid grid-cols-2 gap-2">
              {/* Total Items */}
              <PastelCard variant="default" className="overflow-hidden border-l-4 border-orange-500 dark:border-purple-500">
                <CardContent className="p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-peach-500/10 dark:bg-peach-500/20">
                      <Utensils className={`${ICON_SIZES.sm} text-peach-500`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xl font-bold text-foreground">{totalCount}</div>
                      <div className="text-xs text-muted-foreground">Всего блюд</div>
                    </div>
                  </div>
                </CardContent>
              </PastelCard>

              {/* Categories */}
              <PastelCard variant="default" className="overflow-hidden border-l-4 border-blue-500">
                <CardContent className="p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-500/10 dark:bg-blue-500/20">
                      <Tag className={`${ICON_SIZES.sm} text-blue-500`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xl font-bold text-foreground">{categories.length}</div>
                      <div className="text-xs text-muted-foreground">Категорий</div>
                    </div>
                  </div>
                </CardContent>
              </PastelCard>

              {/* Active Items OR Pending Suggestions (admin) */}
              {user?.isAdmin && pendingCount > 0 ? (
                <PastelCard variant="default" 
                  className="overflow-hidden cursor-pointer transition-shadow hover:shadow-md" 
                  onClick={() => {
                    navigate('/admin/suggestions');
                    haptic.light();
                  }}
                >
                  <CardContent className="p-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-butter-500/10 dark:bg-butter-500/20 relative">
                        <Sparkles className={`${ICON_SIZES.sm} text-butter-500`} />
                        {pendingCount > 0 && (
                          <div className="size-4 absolute -top-1 -right-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {pendingCount}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xl font-bold text-foreground">{pendingCount}</div>
                        <div className="text-xs text-muted-foreground">Ожидают</div>
                      </div>
                    </div>
                  </CardContent>
                </PastelCard>
              ) : (
                <PastelCard variant="default" className="overflow-hidden border-l-4 border-green-500">
                  <CardContent className="p-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-mint-500/10 dark:bg-mint-500/20">
                        <Sparkles className={`${ICON_SIZES.sm} text-mint-500`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xl font-bold text-foreground">{activeCount}/{totalCount}</div>
                        <div className="text-xs text-muted-foreground">Активных</div>
                      </div>
                    </div>
                  </CardContent>
                </PastelCard>
              )}

              {/* Average Price */}
              {avgPrice > 0 && (
                <PastelCard variant="default" className="overflow-hidden border-l-4 border-amber-500">
                  <CardContent className="p-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-butter-500/10 dark:bg-butter-500/20">
                        <span className="text-lg">💰</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xl font-bold text-foreground">₽{avgPrice}</div>
                        <div className="text-xs text-muted-foreground">Средняя цена</div>
                      </div>
                    </div>
                  </CardContent>
                </PastelCard>
              )}
            </div>
          </motion.div>
        )}

        {/* 3. Expandable Search */}
        <AnimatePresence>
          {searchVisible && (
            <motion.div
              variants={itemVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, height: 0 }}
            >
              <PastelCard variant="default" className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="relative">
                    <Search className={`${ICON_SIZES.sm} absolute left-3 top-1/2 -translate-y-1/2  text-muted-foreground pointer-events-none`} />
                    <Input
                      ref={searchInputRef}
                      placeholder="Поиск блюд..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-background/50 border-none focus-visible:ring-1 focus-visible:ring-peach-500 h-11"
                    />
                    {searchQuery && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 p-2 -m-2">
                        <button
                          onClick={() => setSearchQuery('')}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className={ICON_SIZES.sm} />
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </PastelCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 4. Filter Chips - Horizontal Scroll */}
        {!menuLoading && categories.length > 0 && (
          <motion.div 
            variants={itemVariants}
            className="sticky top-0 z-10 bg-background/95 backdrop-blur-md -mx-4 px-4 py-3"
          >
            <FilterChips
              categories={categories}
              categoryCounts={categoryCounts}
              selectedCategory={selectedCategory}
              onCategorySelect={setSelectedCategory}
            />
          </motion.div>
        )}
        
        {/* Loading state for filters */}
        {menuLoading && (
          <motion.div variants={itemVariants}>
            <FilterChipsSkeleton />
          </motion.div>
        )}

        {/* 5. Menu Items List - Grid Layout */}
        {menuLoading ? (
          <MenuGridSkeleton count={8} />
        ) : filteredItems.length === 0 ? (
          (selectedCategory || searchQuery) ? (
            <EmptyState
              type="no-results"
              onAction={() => {
                setSearchQuery('');
                setSelectedCategory(null);
                haptic.light();
              }}
            />
          ) : (
            <EmptyState
              type="no-menu"
            />
          )
        ) : (
          <motion.div variants={itemVariants} className="flex-1">
            {/* P1.3: Виртуализация для больших списков (> 50 items) */}
            {filteredItems.length > 50 ? (
              <VirtualMenuList
                items={filteredItems}
                isAdmin={user?.isAdmin}
                onEdit={setEditingItem}
                onDelete={handleDeleteItem}
                onToggleStatus={handleToggleStatus}
                selectedCategory={selectedCategory}
              />
            ) : (
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
            )}
          </motion.div>
        )}
      </motion.div>

      {/* 6. Contextual FAB - Single unified button */}
      <motion.button
        className="fixed bottom-24 sm:bottom-20 right-4 z-30 flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-br from-peach-500 to-coral-500 dark:from-purple-500 dark:to-violet-500 text-white shadow-lg shadow-peach-500/30 dark:shadow-purple-500/30 font-medium"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          if (user?.isAdmin) {
            openBottomSheet();
          } else {
            setSuggestFormOpen(true);
          }
          haptic.medium();
        }}
      >
        {user?.isAdmin ? (
          <>
            <Plus className={ICON_SIZES.md} />
            <span>Добавить блюдо</span>
          </>
        ) : (
          <>
            <Sparkles className={ICON_SIZES.md} />
            <span>Предложить блюдо</span>
          </>
        )}
      </motion.button>

      {/* Bottom Sheets */}
      <BottomSheet
        isOpen={formState.isOpen}
        onClose={closeBottomSheet}
        title="Добавить блюдо"
        enableBackdrop={true}
        snapPoints={[100]}
        initialSnap={0}
      >
        <MenuForm
          onSubmit={handleAddItem}
          onCancel={closeBottomSheet}
          loading={menuLoading}
        />
      </BottomSheet>
      
      {editingItem && (
        <BottomSheet
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          title="Редактировать блюдо"
          enableBackdrop={true}
          snapPoints={[100]}
          initialSnap={0}
        >
          <MenuForm
            item={editingItem}
            onSubmit={handleEditItem}
            onCancel={() => setEditingItem(null)}
            loading={menuLoading}
          />
        </BottomSheet>
      )}

      {/* Форма предложения блюда для обычных пользователей */}
      <SuggestDishForm
        isOpen={suggestFormOpen}
        onClose={() => setSuggestFormOpen(false)}
      />

      {/* Диалог подтверждения удаления */}
      <ConfirmDialog
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmDeleteItem}
        title="Удалить блюдо?"
        description={`Вы уверены, что хотите удалить "${itemToDelete?.name}" из меню? Это действие нельзя отменить.`}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        variant="danger"
      />
    </>
  );
};

/**
 * Helper: Get category icon
 */
function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    'первые блюда': '🍲',
    'вторые блюда': '🍖',
    'салаты': '🥗',
    'десерты': '🍰',
    'напитки': '🥤',
    'закуски': '🥨',
    'супы': '🍜',
    'мясо': '🥩',
    'рыба': '🐟',
    'овощи': '🥬',
    'паста': '🍝',
    'пицца': '🍕',
    'бургеры': '🍔',
    'азиатская': '🍜',
    'итальянская': '🍝',
    'японская': '🍣',
    'default': '🍽️'
  };

  const lowerCategory = category.toLowerCase();
  return icons[lowerCategory] || icons.default;
}
