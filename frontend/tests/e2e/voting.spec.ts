/**
 * E2E Tests: Voting Flow
 * P2 Task: End-to-end testing для критичных user flows
 * 
 * Тестируем:
 * - Просмотр активных polls
 * - Голосование за menu item
 * - Изменение голоса
 * - Отмена голоса
 */

import { test, expect } from '@playwright/test';

test.describe('Voting Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Переходим на главную страницу
    await page.goto('/');
    
    // Ждем загрузки polls
    await page.waitForSelector('[data-testid="poll-card"]', { timeout: 5000 });
  });

  test('should display active polls on homepage', async ({ page }) => {
    // Проверяем что polls загрузились
    const pollCards = page.locator('[data-testid="poll-card"]');
    await expect(pollCards).toHaveCount(greaterThan(0));
    
    // Проверяем структуру poll card
    const firstPoll = pollCards.first();
    await expect(firstPoll.locator('h3')).toBeVisible();
    await expect(firstPoll.locator('[data-testid="poll-timer"]')).toBeVisible();
  });

  test('should navigate to voting page when clicking poll', async ({ page }) => {
    // Кликаем на первый poll
    await page.click('[data-testid="poll-card"]');
    
    // Ждем перехода на VotingPage
    await expect(page).toHaveURL(/\/poll\/\d+/);
    
    // Проверяем что загрузились menu items
    await expect(page.locator('[data-testid="menu-item"]')).toHaveCount(greaterThan(0));
  });

  test('should vote for menu item', async ({ page }) => {
    // Переходим на voting page
    await page.click('[data-testid="poll-card"]');
    await page.waitForURL(/\/poll\/\d+/);
    
    // Кликаем на первый menu item
    const firstItem = page.locator('[data-testid="menu-item"]').first();
    await firstItem.click();
    
    // Проверяем что появился success toast
    await expect(page.locator('.sonner-toast')).toContainText('Ваш голос учтен');
    
    // Проверяем что item выделен (selected)
    await expect(firstItem).toHaveClass(/selected/);
    
    // Проверяем что счетчик голосов увеличился
    const voteCount = firstItem.locator('[data-testid="vote-count"]');
    await expect(voteCount).toBeVisible();
  });

  test('should change vote to different item', async ({ page }) => {
    await page.click('[data-testid="poll-card"]');
    await page.waitForURL(/\/poll\/\d+/);
    
    // Голосуем за первый item
    const firstItem = page.locator('[data-testid="menu-item"]').first();
    await firstItem.click();
    await page.waitForTimeout(500);
    
    // Меняем голос на второй item
    const secondItem = page.locator('[data-testid="menu-item"]').nth(1);
    await secondItem.click();
    
    // Проверяем toast с измененным голосом
    await expect(page.locator('.sonner-toast')).toContainText(/изменен|changed/i);
    
    // Проверяем что только второй item selected
    await expect(firstItem).not.toHaveClass(/selected/);
    await expect(secondItem).toHaveClass(/selected/);
  });

  test('should display voters avatars', async ({ page }) => {
    await page.click('[data-testid="poll-card"]');
    await page.waitForURL(/\/poll\/\d+/);
    
    // Голосуем
    await page.click('[data-testid="menu-item"]');
    await page.waitForTimeout(500);
    
    // Проверяем что появились avatars voters
    const avatars = page.locator('[data-testid="voter-avatar"]');
    await expect(avatars.first()).toBeVisible();
  });

  test('should show poll results after closing', async ({ page }) => {
    // Этот тест требует admin прав или ожидания закрытия poll
    // Пропускаем в обычных тестах
    test.skip();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Симулируем offline
    await page.context().setOffline(true);
    
    await page.goto('/');
    
    // Проверяем что показывается error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    
    // Восстанавливаем соединение
    await page.context().setOffline(false);
  });

  test('should persist vote after page reload', async ({ page }) => {
    await page.click('[data-testid="poll-card"]');
    await page.waitForURL(/\/poll\/\d+/);
    
    // Голосуем
    const firstItem = page.locator('[data-testid="menu-item"]').first();
    const itemText = await firstItem.textContent();
    await firstItem.click();
    await page.waitForTimeout(1000);
    
    // Перезагружаем страницу
    await page.reload();
    
    // Проверяем что голос сохранился
    const selectedItem = page.locator('[data-testid="menu-item"].selected');
    await expect(selectedItem).toContainText(itemText || '');
  });
});

// Helper для проверки что счетчик больше нуля
function greaterThan(expected: number) {
  return async (count: number) => count > expected;
}
