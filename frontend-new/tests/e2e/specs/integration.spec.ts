import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { installTelegramMock } from '../mocks/telegram';

const integrationEnabled = process.env.E2E_INTEGRATION === '1';
const botToken = process.env.E2E_BOT_TOKEN || '777000:test_e2e_bot_token';

function signedInitData(): string {
  const params = new URLSearchParams({
    query_id: 'e2e-real-server',
    user: JSON.stringify({
      id: 700000101,
      first_name: 'Анна',
      last_name: 'Тестова',
      username: 'anna_e2e',
      language_code: 'ru',
    }),
    auth_date: String(Math.floor(Date.now() / 1000)),
  });
  const checkString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(checkString).digest('hex'));
  return params.toString();
}

test.describe('Настоящий сервер и тестовая PostgreSQL', () => {
  test.skip(!integrationEnabled, 'Запускается только с E2E_INTEGRATION=1 после безопасного seed');

  test.beforeEach(async ({ context }) => {
    await installTelegramMock(context, { initData: signedInitData(), userId: 700000101 });
  });

  test('@integration health/readiness и договор ошибки авторизации', async ({ request }) => {
    const health = await request.get('/health/ready');
    expect(health.ok()).toBe(true);
    const payload = await health.json();
    expect(payload).toEqual({ ready: true });

    const unauthorized = await request.get('/api/user/groups');
    expect(unauthorized.status()).toBe(401);
    await expect(unauthorized.json()).resolves.toMatchObject({
      success: false,
      code: expect.any(String),
    });
  });

  /**
   * Тестовый пользователь состоит в двух командах (см. `backend/src/scripts/
   * e2e-seed.ts`), поэтому на экране появляется переключатель, и название
   * команды встречается дважды — в подзаголовке и на вкладке.
   *
   * Проверяем ВЫБРАННУЮ вкладку, а не просто наличие текста: так утверждение
   * говорит не «название где-то есть», а «открыта именно эта команда».
   */
  test('@integration входит через подписанный initData и читает seeded menu', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto('/menu');
    await expect(
      page.getByRole('tab', { name: 'Команда E2E', selected: true })
    ).toBeVisible();
    await expect(page.getByText('Борщ E2E')).toBeVisible();
    await expect(page.getByText('Паста E2E')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Добавить блюдо' })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  /**
   * Групповая изоляция на живом экране: меню соседней команды не должно
   * просачиваться в открытую. `PRODUCT.md` называет такое смешение
   * критической ошибкой, а не косметикой.
   */
  test('@integration меню чужой команды не видно в открытой', async ({ page }) => {
    await page.goto('/menu');
    await expect(
      page.getByRole('tab', { name: 'Команда E2E', selected: true })
    ).toBeVisible();

    // Вкладка соседней команды есть, но её блюдо на экране не показано.
    await expect(page.getByRole('tab', { name: 'Команда Б E2E' })).toBeVisible();
    await expect(page.getByText('Плов Б E2E')).toHaveCount(0);

    // Команда, в которой пользователя нет, не предлагается вовсе.
    await expect(page.getByRole('tab', { name: 'Команда В E2E' })).toHaveCount(0);
  });
});
