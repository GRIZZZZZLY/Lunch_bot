import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MenuList } from '../components/menu/MenuList';
import { VirtualMenuList } from '../components/menu/VirtualMenuList';
import { MenuForm, MenuFormData } from '../components/menu/MenuForm';
import { SuggestDishForm } from '../components/menu/SuggestDishForm';

import { ConfirmDialog } from '../components/modals';
import { EmptyState } from '../components/common/EmptyState';
import { useHaptic } from '../hooks/useHaptic';
import {
  Plus,
  Sparkles,
  Search,
  X,
  Utensils,
} from 'lucide-react';
import { BottomSheet } from '../components/common/BottomSheet';
import { MenuGridSkeleton } from '../components/menu/MenuGridSkeleton';
import { useAuth } from '../hooks/useAuth';
import { useIsGroupAdmin } from '../hooks/useIsGroupAdmin';
import { useTelegram } from '../hooks/useTelegram';
import { useAppStore } from '../store/useAppStore';
import { useCurrentGroup } from '../hooks/useCurrentGroup';
import { getAdminGroups } from '../lib/groups';
import { MenuItem } from '../services/menu.service';
import {
  useCreateMenuItem,
  useDeleteMenuItem,
  useMenuItems,
  useToggleMenuItemStatus,
  useUpdateMenuItem,
} from '../hooks/queries/useMenuQueries';
import { trackEvent, ANALYTICS_EVENTS } from '../lib/analytics';
import { usePendingCount } from '../hooks/useSuggestions';

// New shadcn/ui components
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ThemeToggle } from '../components/ui/theme-toggle';
// import { MediumWaveGradient } from '../components/background'; // REMOVED: убрали оранжевый градиент
import { ICON_SIZES } from '@/lib/design-tokens';
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

/**
 * Страница управления меню
 */
const useMenuPageController = () => {
  const { user } = useAuth();
  const isGroupAdmin = useIsGroupAdmin();
  const { mainButton, backButton, colorScheme } = useTelegram();
  const addNotification = useAppStore((state) => state.addNotification);
  const haptic = useHaptic();
  const theme = useAppStore((state) => state.theme);
  const isDark = theme === "dark";
  const navigate = useNavigate();

  // Группы пользователя для свитчера и мульти-группового создания
  const { currentGroupId, groups, currentGroup } = useCurrentGroup();
  const setCurrentGroupId = useAppStore((state) => state.setCurrentGroupId);
  const adminGroups = getAdminGroups(groups);

  // Load menu items using React Query
  const {
    data: menuItems = [],
    isLoading: menuLoading,
    refetch: refetchMenu,
  } = useMenuItems();

  // Load pending suggestions count (only for admin)
  const { data: pendingCount = 0 } = usePendingCount();

  // React Query mutations
  const { mutate: createItemMutation, isPending: isCreating } =
    useCreateMenuItem();
  const { mutate: updateItemMutation, isPending: isUpdating } =
    useUpdateMenuItem();
  const { mutate: deleteItemMutation, isPending: isDeleting } =
    useDeleteMenuItem();
  const { mutate: toggleStatusMutation, isPending: isToggling } =
    useToggleMenuItemStatus();
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // ✅ UX FIX: Show search by default if 10+ items (Hidden Feature fix)
  const [searchVisible, setSearchVisible] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Объединяем состояния в одно
  const [formState, setFormState] = useState({ isOpen: false, clickCount: 0 });
  const [suggestFormOpen, setSuggestFormOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const openBottomSheet = useCallback(() => {
    setFormState((prev) => ({ ...prev, isOpen: true }));
  }, []);

  const closeBottomSheet = useCallback(() => {
    setFormState((prev) => ({ ...prev, isOpen: false }));
    // mainButton всегда скрыт - используем FAB вместо него
  }, []);

  // Фильтрация блюд по поиску
  const filteredItems = useMemo(() => {
    let filtered = menuItems;

    // Фильтр по поисковому запросу
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query),
      );
    }

    // Сортировка по названию (по умолчанию)
    // ✅ FIX: Копируем массив перед сортировкой, чтобы не мутировать кэш React Query
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

    return sorted;
  }, [menuItems, searchQuery]);

  // Загрузка данных при монтировании (React Query auto-loads)
  useEffect(() => {
    // loadMenuItems() больше не нужен - React Query загружает автоматически
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
    haptic.success();
  };

  const handleAddItem = async (formData: MenuFormData) => {
    const { groupIds, ...itemData } = formData;

    createItemMutation(
      { data: itemData, groupIds },
      {
        onSuccess: (items) => {
          const count = items?.length ?? 0;
          addNotification({
            type: "success",
            message: `Блюдо "${itemData.name}" добавлено${count > 1 ? ` в ${count} групп` : ""}`,
          });
          closeBottomSheet();
          haptic.success();

          // P1.2.4: Track menu item creation
          trackEvent(ANALYTICS_EVENTS.MENU_ITEM_ADDED, {
            itemName: itemData.name,
            price: itemData.price,
          });
        },
        onError: () => {
          addNotification({
            type: "error",
            message: "Ошибка добавления блюда",
          });
          haptic.error();
        },
      },
    );
  };

  const handleEditItem = async (itemData: MenuFormData) => {
    if (!editingItem) return;

    updateItemMutation(
      { id: editingItem.id, data: itemData },
      {
        onSuccess: (_data) => {
          addNotification({
            type: "success",
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
        onError: () => {
          addNotification({
            type: "error",
            message: "Ошибка обновления блюда",
          });
          haptic.error();
        },
      },
    );
  };

  const handleDeleteItem = (id: number) => {
    // Находим блюдо для отображения его имени в диалоге
    const item = menuItems.find((i) => i.id === id);
    if (!item) return;

    // Открываем диалог подтверждения
    setItemToDelete({ id, name: item.name });
    haptic.light();
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;

    deleteItemMutation(itemToDelete.id, {
      onSuccess: () => {
        addNotification({
          type: "success",
          message: "Блюдо удалено",
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
      onError: () => {
        addNotification({
          type: "error",
          message: "Ошибка удаления блюда",
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
          type: "success",
          message: `Блюдо ${data?.isActive ? "активировано" : "деактивировано"}`,
        });
        haptic.success();
      },
      onError: () => {
        addNotification({
          type: "error",
          message: "Ошибка изменения статуса",
        });
        haptic.error();
      },
    });
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
  const activeCount = menuItems.filter((item) => item.isActive).length;
  const avgPrice =
    totalCount > 0
      ? Math.round(
          menuItems.reduce((sum, item) => sum + (item.price || 0), 0) /
            totalCount,
        )
      : 0;

  return {
    user,
    isGroupAdmin,
    mainButton,
    backButton,
    colorScheme,
    addNotification,
    haptic,
    theme,
    isDark,
    navigate,
    currentGroupId,
    groups,
    currentGroup,
    setCurrentGroupId,
    adminGroups,
    menuItems,
    menuLoading,
    refetchMenu,
    pendingCount,
    createItemMutation,
    isCreating,
    updateItemMutation,
    isUpdating,
    deleteItemMutation,
    isDeleting,
    toggleStatusMutation,
    isToggling,
    editingItem,
    setEditingItem,
    searchQuery,
    setSearchQuery,
    searchVisible,
    setSearchVisible,
    searchInputRef,
    formState,
    setFormState,
    suggestFormOpen,
    setSuggestFormOpen,
    itemToDelete,
    setItemToDelete,
    openBottomSheet,
    closeBottomSheet,
    filteredItems,
    handleRefresh,
    handleAddItem,
    handleEditItem,
    handleDeleteItem,
    confirmDeleteItem,
    handleToggleStatus,
    toggleSearch,
    totalCount,
    activeCount,
    avgPrice,
  };
};

export const MenuPage: React.FC = () => {
  const {
    isGroupAdmin,
    haptic,
    navigate,
    currentGroupId,
    groups,
    currentGroup,
    setCurrentGroupId,
    adminGroups,
    menuItems,
    menuLoading,
    pendingCount,
    editingItem,
    setEditingItem,
    searchQuery,
    setSearchQuery,
    searchVisible,
    searchInputRef,
    formState,
    suggestFormOpen,
    setSuggestFormOpen,
    itemToDelete,
    setItemToDelete,
    openBottomSheet,
    closeBottomSheet,
    filteredItems,
    handleAddItem,
    handleEditItem,
    handleDeleteItem,
    confirmDeleteItem,
    handleToggleStatus,
    toggleSearch,
    totalCount,
    activeCount,
    avgPrice,
  } = useMenuPageController();
  return (
    <>
      {/* Background removed - using neutral bg-background from Layout */}

      <m.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-4 pb-24 min-h-screen"
      >
        {/* 1. Compact Header (44px) */}
        <m.div variants={itemVariants}>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <Utensils className={ICON_SIZES.lg} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Меню</h1>
                {groups.length > 1 ? (
                  <select
                    value={currentGroupId ?? ""}
                    onChange={(e) => setCurrentGroupId(Number(e.target.value))}
                    className="mt-0.5 bg-transparent text-sm text-muted-foreground focus:outline-none"
                    aria-label="Выбрать группу"
                  >
                    {groups.map((grp) => (
                      <option key={grp.id} value={grp.id}>
                        {grp.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {currentGroup?.title ?? ""}
                  </p>
                )}
              </div>
            </div>

            <div className="relative flex-1 flex items-center justify-end min-w-0 h-11">
              <AnimatePresence>
                {searchVisible && (
                  <m.div
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    exit={{ opacity: 0, scaleX: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute inset-y-0 right-0 w-full"
                    style={{ originX: 1 }}
                  >
                    <div className="relative h-full">
                      <Search
                        className={`${ICON_SIZES.sm} absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none`}
                      />
                      <Input
                        ref={searchInputRef}
                        placeholder="Поиск блюд..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-11 pl-10 pr-16 bg-background/50 border-none focus-visible:ring-1 focus-visible:ring-peach-500"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {searchQuery && (
                          <button
                            type="button"
                            aria-label="Очистить поиск"
                            onClick={() => setSearchQuery("")}
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X className={ICON_SIZES.sm} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={toggleSearch}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Закрыть поиск"
                        >
                          <X className={ICON_SIZES.sm} />
                        </button>
                      </div>
                    </div>
                  </m.div>
                )}
              </AnimatePresence>

              {!searchVisible && (
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={toggleSearch}
                    className="size-11"
                  >
                    <Search className={ICON_SIZES.md} />
                  </Button>

                  {isGroupAdmin && (
                    <ThemeToggle
                      variant="ghost"
                      size="icon"
                      className="size-11"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </m.div>

        {/* 2. Compact subtitle (счётчики) + доступ к предложке (admin) */}
        {!menuLoading && menuItems.length > 0 && (
          <m.div
            variants={itemVariants}
            className="flex items-center justify-between gap-2 px-1"
          >
            <p className="text-sm text-muted-foreground tabular-nums">
              <span className="font-semibold text-foreground">
                {totalCount}
              </span>{" "}
              блюд
              {" · "}
              {activeCount} активных
              {avgPrice > 0 && (
                <>
                  {" "}
                  · средняя{" "}
                  <span className="font-semibold text-foreground">
                    {avgPrice} ₽
                  </span>
                </>
              )}
            </p>

            {isGroupAdmin && pendingCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  navigate("/admin/suggestions");
                  haptic.light();
                }}
                className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-butter-500/14 text-butter-600 dark:text-butter-400 transition-colors hover:bg-butter-500/20"
              >
                <Sparkles className={ICON_SIZES.sm} />
                Предложка
                <span className="ml-0.5 min-w-4 h-4 px-1 rounded-full bg-coral-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {pendingCount}
                </span>
              </button>
            )}
          </m.div>
        )}

        {/* Menu Items List - Grid Layout */}
        {menuLoading ? (
          <MenuGridSkeleton count={8} />
        ) : filteredItems.length === 0 ? (
          searchQuery ? (
            <EmptyState
              type="no-results"
              onAction={() => {
                setSearchQuery("");
                haptic.light();
              }}
            />
          ) : (
            <EmptyState type="no-menu" />
          )
        ) : (
          <m.div variants={itemVariants} className="flex-1">
            {/* P1.3: Виртуализация для больших списков (> 50 items) */}
            {filteredItems.length > 50 ? (
              <VirtualMenuList
                items={filteredItems}
                isAdmin={isGroupAdmin}
                onEdit={setEditingItem}
                onDelete={handleDeleteItem}
                onToggleStatus={handleToggleStatus}
              />
            ) : (
              <MenuList
                items={filteredItems}
                loading={menuLoading}
                onEdit={setEditingItem}
                onDelete={handleDeleteItem}
                onToggleStatus={handleToggleStatus}
                onAdd={openBottomSheet}
                showActions={isGroupAdmin}
              />
            )}
          </m.div>
        )}
      </m.div>

      {/* 6. Contextual FAB - Single unified button */}
      <m.button
        className="fixed bottom-24 sm:bottom-20 right-4 z-30 flex items-center gap-2 rounded-2xl bg-primary px-6 py-3.5 font-medium text-primary-foreground shadow-md"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          if (isGroupAdmin) {
            openBottomSheet();
          } else {
            setSuggestFormOpen(true);
          }
          haptic.medium();
        }}
      >
        {isGroupAdmin ? (
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
      </m.button>

      {/* Bottom Sheets */}
      <BottomSheet
        isOpen={formState.isOpen}
        onClose={closeBottomSheet}
        title="Добавить блюдо"
        snapPoints={[100]}
        initialSnap={0}
      >
        <MenuForm
          onSubmit={handleAddItem}
          onCancel={closeBottomSheet}
          loading={menuLoading}
          adminGroups={adminGroups.map((grp) => ({
            id: grp.id,
            title: grp.title,
          }))}
          defaultGroupId={currentGroupId}
        />
      </BottomSheet>

      {editingItem && (
        <BottomSheet
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          title="Редактировать блюдо"
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
        description={`Удалить «${itemToDelete?.name}»? Отменить будет нельзя.`}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        variant="danger"
      />
    </>
  );
};
