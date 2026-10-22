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
    /* Тип уведомления не выставлен ни ролью, ни атрибутом: в регионе
       «Уведомления» ошибку от успеха отличает только класс. */
    await expect(appPage.locator('.toast-error')).toHaveCount(0);

    const routes = [
      { name: 'Меню', path: '/menu' },
      { name: 'Статистика', path: '/stats' },
      { name: 'Профиль', path: '/profile' },
      { name: 'Главная', path: '/' },
    ] as const;

    for (const route of routes) {
      const link = navigation.getByRole('link', { name: route.name });
      await link.click();
      const urlPattern = route.path === '/' ? /\/$/ : new RegExp(`${route.path}/?$`);
      await expect(appPage).toHaveURL(urlPattern);
      await expect(link).toHaveAttribute('aria-current', 'page');
    }

    await navigation.getByRole('link', { name: 'Меню' }).click();
    const teamTrigger = appPage.getByRole('button', { name: /^Команда: .*\. Сменить$/ });
    if (
      (await teamTrigger.count()) > 0 &&
      (await teamTrigger.getAttribute('aria-label')) !== `Команда: ${identity.groupName}. Сменить`
    ) {
      await teamTrigger.click();
      await appPage.getByRole('radio', { name: identity.groupName, exact: true }).click();
    }
    await expect(appPage.getByText(identity.groupName, { exact: false }).first()).toBeVisible();
    await expect(appPage.getByRole('button', { name: 'Добавить блюдо' })).toHaveCount(0);

    await navigation.getByRole('link', { name: 'Профиль' }).click();
    await expect(appPage.getByRole('button', { name: 'Управление' })).toHaveCount(0);
  });

  test(
    '@prod-smoke открывает пользовательские экраны только для чтения',
    async ({ appPage }) => {
      /* Названия заголовков не сверяем: копия проверки на сервере переезжает
         на новую версию раньше выкладки и должна пройти и на старом
         интерфейсе, а переименование уже ломало выпуск. */
      const routes = ['/budget', '/poll/history', '/suggestions', '/suggestions/mine'];

      for (const path of routes) {
        await appPage.goto(path);
        await expect(appPage.getByRole('heading').first()).toBeVisible();
        await expect(appPage.locator('main')).not.toBeEmpty();
        await expect(
          appPage.getByRole('heading', { name: 'Не удалось загрузить' }),
        ).toHaveCount(0);
      }
    },
  );

  /* Анимации выключены на уровне браузера, а не переждаты.
     Ожидание `getAnimations()` закрывает только те анимации, что уже идут: те,
     что стартуют позже (данные приезжают асинхронно), axe успевает застать на
     полпути. Так 29.08 упал прогон — заголовок «Сейчас» был прочитан как
     #7a756b на #fcfaf4 (4.38 при норме 4.5), хотя это `--text-tertiary`
     #6b655b под неполной прозрачностью, а в конечном кадре контраст 5.58.
     Интерфейс полностью гасит анимации при prefers-reduced-motion
     (styles/motion.css), поэтому проверка палитры становится детерминированной.
     Остальные сценарии смоука работают с обычной анимацией. */
  test.describe('без анимаций', () => {
    test('@prod-smoke главная без серьёзных нарушений доступности', async ({ appPage }) => {
      /* `test.use({ reducedMotion })` здесь не проходит по типам: `test`
         расширен своими фикстурами, и опции контекста в него не попадают.
         `emulateMedia` делает то же самое для этой страницы. */
      await appPage.emulateMedia({ reducedMotion: 'reduce' });
      await appPage.goto('/');
      await expect(appPage.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible();

      /* Второй рубеж: если какая-то анимация переживёт reduced-motion, ждём её
         завершения. Бесконечные (шиммер, спиннер) пропускаем — иначе ожидание
         не кончится. Тот же приём в tests/e2e/specs/*-a11y.spec.ts. */
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
});
