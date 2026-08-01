/* Регрессия доступности денежного контура: закупка → расчёт → долги.
   Статусные чипы здесь стоят на собственном тинте, и базовые токены
   --success/--warning когда-то давали 3.7–3.99:1 при пороге 4.5 (аудит
   2026-08-01). Проверяем обе темы: в тёмной тинт затемняет фон, в светлой
   осветляет, поэтому провал воспроизводился только в светлой. */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/test';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Экраны входят анимацией `screenIn` (opacity 0 → 1). Пока она играет, axe
 * читает БЛЕКЛЫЕ цвета: --text-tertiary #6b655b поверх канваса при alpha 0.89
 * измеряется как #7a746a и даёт 4.03 вместо 5.03. Тест из-за этого падал
 * примерно в одном прогоне из шести — не на дефекте палитры, а на гонке с
 * анимацией. Ждём завершения всех конечных анимаций; бесконечные (шиммер
 * скелетона, спиннер) пропускаем, иначе ожидание не кончится никогда.
 */
async function settleAnimations(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

async function expectNoSeriousViolations(page: Page) {
  await settleAnimations(page);
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const blocking = violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => ({
        target: node.target.join(' '),
        summary: node.failureSummary,
      })),
    }));
  expect(blocking, 'serious/critical нарушения WCAG').toEqual([]);
}

test.describe('Доступность: долги', () => {
  test.describe('должник', () => {
    test.use({ scenario: 'budget-debtor', role: 'debtor' });
    test('@smoke светлая тема без serious-нарушений', async ({ appPage }) => {
      await appPage.goto('/budget');
      await expect(appPage.getByRole('button', { name: 'Оплатил' })).toBeVisible();
      await expectNoSeriousViolations(appPage);
    });
  });

  test.describe('ответственный', () => {
    test.use({ scenario: 'budget-responsible', role: 'responsible' });
    test('чип «оплачено» на тинте держит контраст', async ({ appPage }) => {
      await appPage.goto('/budget');
      await expect(appPage.getByRole('button', { name: 'Подтвердить' })).toBeVisible();
      await expectNoSeriousViolations(appPage);
    });
  });
});

test.describe('Доступность: закупка', () => {
  test.describe('сбор', () => {
    test.use({ scenario: 'store-collecting', role: 'storeInitiator' });
    test('чип «Сбор» на тинте держит контраст', async ({ appPage }) => {
      await appPage.goto('/store-run/601');
      await expect(appPage.getByRole('button', { name: 'Закрыть сбор' })).toBeVisible();
      await expectNoSeriousViolations(appPage);
    });
  });

  test.describe('покупки', () => {
    test.use({ scenario: 'store-shopping', role: 'storeInitiator' });
    test('@smoke чипы «Куплено» и «В магазине» держат контраст', async ({ appPage }) => {
      await appPage.goto('/store-run/601');
      await expect(appPage.getByRole('button', { name: 'Рассчитать' })).toBeVisible();
      await expectNoSeriousViolations(appPage);
    });
  });

  test.describe('итог', () => {
    test.use({ scenario: 'store-settled', role: 'storeParticipant' });
    test('чип «Рассчитано» держит контраст', async ({ appPage }) => {
      await appPage.goto('/store-run/601');
      await expect(appPage.getByRole('button', { name: 'На главную' })).toBeVisible();
      await expectNoSeriousViolations(appPage);
    });
  });
});
