import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test.describe('Безопасная проверка продакшена только для чтения', () => {
  test('@prod-smoke сервер готов принимать запросы', async ({ request }) => {
    const response = await request.get('/health/ready');
    expect(response.ok()).toBe(true);
    await expect(response.json()).resolves.toEqual({ ready: true });
  });

  test('@prod-smoke тестовый участник входит и открывает основные разделы', async ({
    appPage,
    identity,
  }) => {
    await appPage.goto('/');
    const navigation = appPage.getByRole('navigation', { name: 'Основная навигация' });
    await expect(navigation).toBeVisible();
    await expect(appPage.getByRole('alert')).toHaveCount(0);

    const routes = [
      { name: 'Меню', path: '/menu', text: 'Меню' },
      { name: 'Статистика', path: '/stats', text: 'Статистика' },
      { name: 'Профиль', path: '/profile', text: 'Оформление' },
      { name: 'Главная', path: '/', text: 'Rocket Lunch' },
    ] as const;

    for (const route of routes) {
      await navigation.getByRole('link', { name: route.name }).click();
      const urlPattern = route.path === '/' ? /\/$/ : new RegExp(`${route.path}/?$`);
      await expect(appPage).toHaveURL(urlPattern);
      await expect(appPage.getByText(route.text, { exact: true }).first()).toBeVisible();
    }

    await navigation.getByRole('link', { name: 'Меню' }).click();
    const groupTab = appPage.getByRole('tab', { name: identity.groupName, exact: true });
    if ((await groupTab.count()) > 0) await groupTab.click();
    await expect(appPage.getByText(identity.groupName, { exact: false }).first()).toBeVisible();
    await expect(appPage.getByRole('button', { name: 'Добавить блюдо' })).toHaveCount(0);

    await navigation.getByRole('link', { name: 'Профиль' }).click();
    await expect(appPage.getByRole('button', { name: 'Управление' })).toHaveCount(0);
  });

  test(
    '@prod-smoke открывает пользовательские экраны только для чтения',
    async ({ appPage }) => {
      /* У `/suggestions/mine` собственный заголовок: страница одна, но
         `onlyMine` меняет его на «Мои предложения»
         (features/suggestions/SuggestionsPage.tsx). */
      const routes = [
        { path: '/budget', heading: 'Бюджет команды' },
        { path: '/poll/history', heading: 'История голосований' },
        { path: '/suggestions', heading: 'Предложения блюд' },
        { path: '/suggestions/mine', heading: 'Мои предложения' },
      ] as const;

      for (const route of routes) {
        await appPage.goto(route.path);
        await expect(appPage.getByRole('heading', { name: route.heading })).toBeVisible();
        await expect(appPage.locator('main')).not.toBeEmpty();
        await expect(
          appPage.getByRole('heading', { name: 'Не удалось загрузить' }),
        ).toHaveCount(0);
      }
    },
  );

  test('@prod-smoke мобильная компоновка и доступность не нарушены', async ({ appPage }) => {
    await appPage.goto('/');
    await expect(appPage.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible();

    const overflow = await appPage.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);

    /* Экран входит анимацией: на её середине axe читает промежуточные цвета
       (#e6e2da на #f4f0e8 — контраст 1.13) и отчитывается о сотнях нарушений
       палитры, которых в конечном кадре нет. Ждём конечные анимации,
       бесконечные (шиммер, спиннер) пропускаем — иначе ожидание не кончится.
       Тот же приём в локальных a11y-тестах: tests/e2e/specs/*-a11y.spec.ts. */
    await appPage.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
          .map(animation => animation.finished.catch(() => undefined)),
      ),
    );

    const result = await new AxeBuilder({ page: appPage })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const blocking = result.violations.filter(
      violation => violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(blocking).toEqual([]);
  });
});
