import { expect, test } from '../fixtures/test';
import { makeActivePoll } from '../scenarios/data';

/**
 * Текущая команда видна на командных экранах, а ссылки из чата открывают
 * объект в контексте его команды. Раньше сменить команду можно было только
 * из меню, а кнопки «Заказать», «Добавить блюдо» и «Создать голосование»
 * открывали просто главную.
 */
test.describe('Команда в шапке', () => {
  test.use({ scenario: 'groups-multiple' });

  /* Точка на плашке — про ДРУГИЕ команды. Их статусы приходят запросом без
     groupId; если клиент подмешает текущую команду, мок (как и сервер)
     ответит только по ней, и точки не будет. */
  test('на главной точка говорит, что в другой команде идёт голосование', async ({ appPage, api }) => {
    const trigger = appPage.getByRole('button', { name: 'Команда: Команда Ракета. Сменить' });
    await appPage.goto('/');
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAccessibleDescription('');

    api.state.polls = [{ ...makeActivePoll(), id: 502, groupId: '2' }];
    await appPage.reload();
    await expect(trigger).toHaveAccessibleDescription(/\b1\b/);

    await trigger.click();
    await expect(appPage.getByRole('radio', { name: 'Команда Спутник' })).toHaveAccessibleDescription(
      /^Голосуем · /,
    );
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
      await expect(
        appPage.getByRole('button', { name: 'Команда: Команда Спутник. Сменить' }),
      ).toBeVisible();
    });

    test('«Добавить блюдо» открывает форму', async ({ appPage }) => {
      await appPage.goto('/?groupId=-100000000001&action=add');
      await expect(appPage).toHaveURL(/\/menu$/);
      await expect(appPage.getByRole('heading', { name: 'Добавить блюдо' })).toBeVisible();
    });
  });
});
