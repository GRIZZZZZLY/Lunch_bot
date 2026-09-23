import { expect, test } from '../fixtures/test';

/**
 * Текущая команда видна на командных экранах, а ссылки из чата открывают
 * объект в контексте его команды. Раньше сменить команду можно было только
 * из меню, а кнопки «Заказать», «Добавить блюдо» и «Создать голосование»
 * открывали просто главную.
 */
test.describe('Команда в шапке', () => {
  test.use({ scenario: 'groups-multiple' });

  test('видна на главной и меняется в одно касание', async ({ appPage, api }) => {
    await appPage.goto('/');
    const trigger = appPage.getByRole('button', { name: 'Команда: Команда Ракета. Сменить' });
    await expect(trigger).toBeVisible();

    await trigger.click();
    await expect(appPage.getByRole('radio', { name: 'Архивная группа' })).toHaveCount(0);
    await appPage.getByRole('radio', { name: 'Команда Спутник' }).click();

    await expect(
      appPage.getByRole('button', { name: 'Команда: Команда Спутник. Сменить' }),
    ).toBeVisible();
    await expect
      .poll(() =>
        api.state.requests.some(
          (request) => request.query.groupId === '2' || request.path.endsWith('/2'),
        ),
      )
      .toBe(true);
  });

  test('в меню не дублирует его собственный переключатель', async ({ appPage }) => {
    await appPage.goto('/menu');
    await expect(appPage.getByRole('tab', { name: 'Команда Ракета' })).toBeVisible();
    await expect(appPage.getByRole('button', { name: /^Команда: / })).toHaveCount(0);
  });
});

test.describe('Ссылки из чата', () => {
  test.describe('закупка', () => {
    test.use({ scenario: 'store-collecting' });

    test('«Заказать» открывает закупку', async ({ appPage }) => {
      await appPage.goto('/?storeRunId=601');
      await expect(appPage).toHaveURL(/\/store-run\/601$/);
      await expect(appPage.getByText('Пятёрочка у офиса').first()).toBeVisible();
    });
  });

  test.describe('группа', () => {
    test.use({ scenario: 'groups-multiple', role: 'admin' });

    test('«Открыть меню группы» делает её текущей', async ({ appPage }) => {
      await appPage.goto('/?groupId=-100000000002');
      await expect(appPage).toHaveURL(/\/menu$/);
      await expect(appPage.getByRole('tab', { name: 'Команда Спутник' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    test('«Добавить блюдо» открывает форму', async ({ appPage }) => {
      await appPage.goto('/?groupId=-100000000001&action=add');
      await expect(appPage).toHaveURL(/\/menu$/);
      await expect(appPage.getByRole('heading', { name: 'Добавить блюдо' })).toBeVisible();
    });
  });
});
