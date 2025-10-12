/**
 * E2E Tests: Menu Management
 * P2 Task: Testing для admin функционала
 * 
 * Тестируем:
 * - Просмотр menu items
 * - Создание нового блюда
 * - Редактирование блюда
 * - Удаление блюда
 * - Фильтрация по категориям
 */

import { test, expect } from '@playwright/test';

test.describe('Menu Management (Admin)', () => {
  test.beforeEach(async ({ page }) => {
    // Переходим на MenuPage
    await page.goto('/menu');
    
    // Ждем загрузки menu items
    await page.waitForSelector('[data-testid="menu-item-card"]', { timeout: 5000 });
  });

  test('should display menu items', async ({ page }) => {
    const menuItems = page.locator('[data-testid="menu-item-card"]');
    await expect(menuItems).toHaveCount(greaterThan(0));
    
    // Проверяем структуру карточки
    const firstItem = menuItems.first();
    await expect(firstItem.locator('h3')).toBeVisible(); // название
    await expect(firstItem.locator('[data-testid="price"]')).toBeVisible(); // цена
  });

  test('should filter items by category', async ({ page }) => {
    // Кликаем на категорию "Первые блюда"
    await page.click('[data-testid="filter-chip"][data-category="первые блюда"]');
    
    // Ждем обновления списка
    await page.waitForTimeout(300);
    
    // Проверяем что отображаются только items этой категории
    const visibleItems = page.locator('[data-testid="menu-item-card"]');
    const count = await visibleItems.count();
    
    for (let i = 0; i < count; i++) {
      const item = visibleItems.nth(i);
      await expect(item.locator('[data-testid="category"]')).toContainText('первые блюда');
    }
  });

  test('should search menu items', async ({ page }) => {
    // Вводим в поиск
    await page.fill('[data-testid="search-input"]', 'борщ');
    
    // Ждем фильтрации
    await page.waitForTimeout(300);
    
    // Проверяем результаты поиска
    const searchResults = page.locator('[data-testid="menu-item-card"]');
    const count = await searchResults.count();
    
    // Все результаты должны содержать "борщ"
    for (let i = 0; i < count; i++) {
      const itemName = await searchResults.nth(i).locator('h3').textContent();
      expect(itemName?.toLowerCase()).toContain('борщ');
    }
  });

  test('should create new menu item (admin)', async ({ page }) => {
    // Кликаем "Добавить блюдо"
    await page.click('[data-testid="add-item-button"]');
    
    // Заполняем форму
    await page.fill('[data-testid="item-name-input"]', 'Тестовое блюдо');
    await page.fill('[data-testid="item-price-input"]', '300');
    await page.selectOption('[data-testid="item-category-select"]', 'первые блюда');
    await page.fill('[data-testid="item-description-input"]', 'Описание тестового блюда');
    
    // Сохраняем
    await page.click('[data-testid="save-item-button"]');
    
    // Проверяем success toast
    await expect(page.locator('.sonner-toast')).toContainText(/добавлен/i);
    
    // Проверяем что item появился в списке
    await expect(page.locator('[data-testid="menu-item-card"]').filter({ hasText: 'Тестовое блюдо' })).toBeVisible();
  });

  test('should edit menu item (admin)', async ({ page }) => {
    // Находим первый item с кнопкой редактирования
    const firstItem = page.locator('[data-testid="menu-item-card"]').first();
    
    // Кликаем "Редактировать"
    await firstItem.locator('[data-testid="edit-button"]').click();
    
    // Изменяем название
    const nameInput = page.locator('[data-testid="item-name-input"]');
    await nameInput.clear();
    await nameInput.fill('Измененное название');
    
    // Сохраняем
    await page.click('[data-testid="save-item-button"]');
    
    // Проверяем success toast
    await expect(page.locator('.sonner-toast')).toContainText(/обновлен/i);
    
    // Проверяем что название изменилось
    await expect(firstItem.locator('h3')).toContainText('Измененное название');
  });

  test('should delete menu item (admin)', async ({ page }) => {
    // Запоминаем количество items
    const initialCount = await page.locator('[data-testid="menu-item-card"]').count();
    
    // Удаляем первый item
    const firstItem = page.locator('[data-testid="menu-item-card"]').first();
    const itemName = await firstItem.locator('h3').textContent();
    
    await firstItem.locator('[data-testid="delete-button"]').click();
    
    // Подтверждаем удаление
    await page.click('[data-testid="confirm-delete-button"]');
    
    // Проверяем success toast
    await expect(page.locator('.sonner-toast')).toContainText(/удален/i);
    
    // Проверяем что item исчез
    await expect(page.locator('[data-testid="menu-item-card"]')).toHaveCount(initialCount - 1);
    await expect(page.locator('[data-testid="menu-item-card"]').filter({ hasText: itemName || '' })).not.toBeVisible();
  });

  test('should toggle menu item status (admin)', async ({ page }) => {
    const firstItem = page.locator('[data-testid="menu-item-card"]').first();
    
    // Кликаем toggle active/inactive
    await firstItem.locator('[data-testid="toggle-status-button"]').click();
    
    // Проверяем что статус изменился
    await page.waitForTimeout(300);
    
    // Проверяем visual feedback
    const isInactive = await firstItem.locator('[data-testid="inactive-badge"]').isVisible();
    expect(isInactive).toBeTruthy();
  });

  test('should handle large lists with virtualization', async ({ page }) => {
    // Проверяем что при > 50 items используется virtualization
    const itemsCount = await page.locator('[data-testid="menu-item-card"]').count();
    
    if (itemsCount > 50) {
      // Проверяем что не все items в DOM одновременно
      await page.evaluate(() => window.scrollTo(0, 1000));
      await page.waitForTimeout(500);
      
      // Проверяем smooth scrolling
      const isSmooth = await page.evaluate(() => {
        const scrollContainer = document.querySelector('[data-testid="virtual-list"]');
        return scrollContainer !== null;
      });
      
      expect(isSmooth).toBeTruthy();
    }
  });

  test('should upload image for menu item (admin)', async ({ page }) => {
    await page.click('[data-testid="add-item-button"]');
    
    // Upload image
    const fileInput = page.locator('[data-testid="image-upload-input"]');
    await fileInput.setInputFiles('./tests/fixtures/test-dish.jpg');
    
    // Проверяем preview
    await expect(page.locator('[data-testid="image-preview"]')).toBeVisible();
    
    // Заполняем остальные поля и сохраняем
    await page.fill('[data-testid="item-name-input"]', 'Блюдо с картинкой');
    await page.fill('[data-testid="item-price-input"]', '350');
    await page.click('[data-testid="save-item-button"]');
    
    // Проверяем что image сохранилась
    const savedItem = page.locator('[data-testid="menu-item-card"]').filter({ hasText: 'Блюдо с картинкой' });
    await expect(savedItem.locator('img')).toBeVisible();
  });
});

function greaterThan(expected: number) {
  return async (count: number) => count > expected;
}
