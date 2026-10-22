import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

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

/** axe по текущему экрану: serious и critical нарушения WCAG 2.1 AA роняют тест. */
export async function expectNoSeriousViolations(
  page: Page,
  { label = 'serious/critical нарушения WCAG', disableRules = [] as string[] } = {},
) {
  await settleAnimations(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(TAGS)
    .disableRules(disableRules)
    .analyze();
  const blocking = violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => ({
        target: node.target.join(' '),
        summary: node.failureSummary,
      })),
    }));
  expect(blocking, label).toEqual([]);
}
