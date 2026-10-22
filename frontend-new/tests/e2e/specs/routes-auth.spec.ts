import { expect, test } from '../fixtures/test';
import { expectNoSeriousViolations } from '../fixtures/a11y';

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

  /* Корневые разделы проверяет тест выше. Здесь — остальные маршруты по
     прямой ссылке: экран отрисован и не упал в ошибку. Где в фикстуре есть
     данные, ждём их; пустые экраны узнаём по заголовку, без сверки текста. */
  test('@smoke открывает все пользовательские маршруты без пустого экрана', async ({ appPage }) => {
    const routes: [path: string, data?: string][] = [
      ['/admin'],
      ['/budget'],
      ['/poll/history', 'Опрос #401'],
      ['/poll/401/results', 'Борщ со сметаной'],
      ['/suggestions'],
      ['/suggestions/mine'],
    ];

    for (const [path, data] of routes) {
      await appPage.goto(path);
      await expect(appPage.locator('#root')).not.toBeEmpty();
      if (data) await expect(appPage.getByText(data).first()).toBeVisible();
      else await expect(appPage.getByRole('heading').first()).toBeVisible();
      await expect(appPage.getByRole('heading', { name: 'Не удалось загрузить' })).toHaveCount(0);
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
      await expect(appPage.getByRole('alert')).toBeVisible();
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
      await expect(appPage.getByRole('alert')).toBeVisible();
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
  test('@smoke главная без серьёзных нарушений доступности', async ({ appPage }) => {
    await appPage.goto('/');
    await expect(appPage.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible();
    await expectNoSeriousViolations(appPage);
  });

  /* Меню и итоги опроса не сканирует ни одна другая a11y-спека (профиль —
     profile-a11y.spec.ts): здесь axe ловит кнопки, ссылки и поля без
     доступного имени (button-name, link-name, label) и всё остальное серьёзное.
     Контраст в меню пока выключен: счётчики в невыбранных чипах категорий
     (MenuPage.module.css, `.cat .count { opacity: 0.55 }`) дают 2.48:1 при
     норме 4.5. Починят — убрать disableRules. */
  const screens = [
    { path: '/menu', disableRules: ['color-contrast'] },
    { path: '/poll/401/results', disableRules: [] },
  ];
  for (const { path, disableRules } of screens) {
    test(`${path} без серьёзных нарушений доступности`, async ({ appPage }) => {
      await appPage.goto(path);
      await appPage.waitForLoadState('networkidle');
      await expectNoSeriousViolations(appPage, {
        label: `Нарушения доступности на ${path}`,
        disableRules,
      });
    });
  }

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
