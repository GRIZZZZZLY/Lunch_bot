import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '../fixtures/test';

test.describe('Авторизация и маршруты', () => {
  test('показывает состояние загрузки при медленной авторизации', async ({ appPage, api }) => {
    api.delay('POST', '/auth/validate', 600);
    await appPage.goto('/');
    await expect(appPage.getByRole('status', { name: 'Загрузка' })).toBeVisible();
    await expect(appPage.getByText('Сегодня ещё не решали')).toBeVisible();
  });

  test('@smoke открывает все корневые разделы через нижнюю навигацию', async ({ appPage, api }) => {
    await appPage.goto('/');
    await expect
      .poll(() => api.lastRequest('POST', '/auth/validate')?.body)
      .toEqual({ initData: api.state.initData });
    const navigation = appPage.getByRole('navigation', { name: 'Основная навигация' });
    await expect(navigation).toBeVisible();

    const routes = [
      { name: 'Меню', url: '/menu', heading: 'Меню' },
      { name: 'Статистика', url: '/stats', heading: 'Статистика' },
      { name: 'Профиль', url: '/profile', heading: 'Анна Тестова' },
      { name: 'Главная', url: '/', heading: 'Сегодня ещё не решали' },
    ];

    for (const route of routes) {
      await navigation.getByRole('link', { name: route.name }).click();
      await expect(appPage).toHaveURL(route.url);
      await expect(appPage.getByText(route.heading, { exact: true }).first()).toBeVisible();
    }
  });

  test('@smoke открывает все пользовательские маршруты без пустого экрана', async ({ appPage }) => {
    const routes = [
      ['/', 'Сегодня ещё не решали'],
      ['/menu', 'Меню'],
      ['/stats', 'Статистика'],
      ['/profile', 'Анна Тестова'],
      ['/admin', 'Раздел доступен только администраторам группы.'],
      ['/budget', 'Нет активных расчётов'],
      ['/poll/history', 'Опрос #401'],
      ['/poll/401/results', 'Борщ со сметаной'],
      ['/suggestions', 'Пока пусто'],
      ['/suggestions/mine', 'У вас пока нет предложений'],
    ] as const;

    for (const [path, expected] of routes) {
      await appPage.goto(path);
      await expect(appPage.locator('#root')).not.toBeEmpty();
      await expect(appPage.getByText(expected, { exact: false }).first()).toBeVisible();
    }
  });

  test('неизвестный адрес показывает 404 и возвращает на главную', async ({ appPage }) => {
    await appPage.goto('/unknown/e2e');
    await expect(appPage.getByText('Экран не найден')).toBeVisible();
    await appPage.getByRole('button', { name: 'На главную' }).click();
    await expect(appPage).toHaveURL('/');
  });

  test.describe('ошибки входа', () => {
    test.use({ scenario: 'auth-error' });

    test('показывает понятную ошибку и позволяет повторить вход', async ({ appPage, api }) => {
      await appPage.goto('/');
      await expect(appPage.getByRole('alert')).toContainText('Не удалось войти');
      api.state.validateAuth = true;
      await appPage.getByRole('button', { name: 'Повторить' }).click();
      await expect(appPage.getByText('Сегодня ещё не решали')).toBeVisible();
      expect(api.requests('POST', '/auth/validate')).toHaveLength(2);
    });
  });

  test.describe('отсутствующий initData', () => {
    test.use({ scenario: 'auth-missing-init-data' });

    test('не выдаёт доступ и не показывает пустой экран', async ({ appPage }) => {
      await appPage.goto('/');
      await expect(appPage.getByRole('alert')).toContainText('Не удалось проверить данные Telegram');
      await expect(appPage.getByRole('navigation', { name: 'Основная навигация' })).toHaveCount(0);
    });
  });

  test.describe('просроченная сессия', () => {
    test.use({ scenario: 'expired-session' });

    test('обновляет токен и повторяет исходный запрос', async ({ appPage, api }) => {
      await appPage.goto('/');
      await expect(appPage.getByText('Сегодня ещё не решали')).toBeVisible();
      expect(api.requests('POST', '/auth/refresh')).toHaveLength(1);
      expect(api.requests('GET', '/user/groups').filter((request) => !request.query.groupId)).toHaveLength(2);
    });
  });
});

test.describe('Общие проверки Mini App', () => {
  test('@smoke не имеет горизонтальной прокрутки и серьёзных нарушений доступности', async ({ appPage }) => {
    await appPage.goto('/');
    const overflow = await appPage.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
    const navigationFits = await appPage
      .getByRole('navigation', { name: 'Основная навигация' })
      .getByRole('link')
      .evaluateAll((links) =>
        links.every((link) => {
          const rect = link.getBoundingClientRect();
          return rect.left >= 0 && rect.right <= window.innerWidth;
        }),
      );
    expect(navigationFits).toBe(true);

    /* Ждём конца анимаций входа, иначе axe меряет цвет посреди затухания:
       --text-tertiary #6b655b читается как #7c766d и даёт 4.28 при пороге 4.5.
       Это не дефект палитры, а гонка — тот же случай уже описан в
       money-a11y.spec.ts. Бесконечные анимации (шиммер, спиннер) пропускаем,
       иначе ожидание не кончится никогда. */
    await appPage.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => undefined)),
      ),
    );

    const results = await new AxeBuilder({ page: appPage })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(blocking).toEqual([]);
  });

  test('интерактивные элементы имеют доступное имя', async ({ appPage }) => {
    for (const path of ['/', '/menu', '/profile', '/poll/401/results']) {
      await appPage.goto(path);
      await appPage.waitForLoadState('networkidle');
      const unnamed = await appPage.locator('button:visible, a:visible, input:visible, textarea:visible, select:visible').evaluateAll(
        (elements) =>
          elements
            .filter((element) => {
              const label = element.getAttribute('aria-label');
              const labelledBy = element.getAttribute('aria-labelledby');
              const text = element.textContent?.trim();
              const placeholder = element.getAttribute('placeholder');
              const id = element.getAttribute('id');
              const explicitLabel = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
              const wrappingLabel = element.closest('label');
              return !label && !labelledBy && !text && !placeholder && !explicitLabel && !wrappingLabel;
            })
            .map((element) => element.outerHTML.slice(0, 240)),
      );
      expect(unnamed, `Элементы без имени на ${path}`).toEqual([]);
    }
  });

  test('синхронизирует тему и Telegram BackButton', async ({ appPage, telegram }) => {
    await appPage.goto('/profile');
    const viewport = await appPage.evaluate(() => ({
      bottom: document.documentElement.style.getPropertyValue('--safe-area-bottom'),
      stableHeight: document.documentElement.style.getPropertyValue('--viewport-stable-height'),
    }));
    expect(viewport).toEqual({ bottom: '40px', stableHeight: '844px' });
    await expect.poll(async () => (await telegram.calls()).some((call) => call.method === 'expand')).toBe(true);
    await appPage.evaluate(() => localStorage.removeItem('rl-theme'));
    await telegram.setTheme('dark');
    await expect(appPage.locator('html')).toHaveAttribute('data-theme', 'dark');

    await appPage.goto('/poll/history');
    await expect.poll(async () => (await telegram.calls()).some((call) => call.method === 'BackButton.show')).toBe(true);
    await telegram.clickBack();
    await expect(appPage).toHaveURL('/');
  });
});
