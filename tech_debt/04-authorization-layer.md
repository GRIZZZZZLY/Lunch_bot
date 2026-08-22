# 04 — Авторизация размазана между middleware и контроллерами

- **Приоритет:** P1 (безопасность)
- **Оценка:** 2 дня (не «переставить пять функций»: нужна матрица авторизации
  по эндпоинтам и по 3 теста на каждый переносимый)
- **Предпосылка:** сначала пункт 10.1 (расширение типа Express для `req.user`),
  иначе перенос придётся типизировать вторым проходом
- **Тип:** незавершённая миграция
- **Область:** `backend/src/api/middleware/group-admin.ts`, `backend/src/api/controllers/*`, `backend/src/api/routes/*`
- **Метод:** TDD (авторизационные тесты на каждый переносимый endpoint)

## Что не так

`backend/src/api/middleware/group-admin.ts` экспортирует `groupAdminMiddleware`
и подключён в четырёх роутерах — но всего на **10 эндпоинтах**:

| route-файл | эндпоинтов под middleware | строки |
|---|---|---|
| `poll.routes.ts` | 1 | 71 |
| `category-order.routes.ts` | 1 | 124 |
| `menu.routes.ts` | 4 | 63, 75, 86, 97 |
| `menu-suggestion.routes.ts` | 4 | 42, 48, 60, 68 |

**Коллизия имён:** второй `groupAdminMiddleware` существует в
`backend/src/bot/middleware/auth.ts:92` — это middleware **бота**, не API. При
«сведении к одному набору middleware» их легко перепутать; переименуйте один из
них (например, API-овский в `requireGroupAdmin`) прежде, чем начинать.

Параллельно те же проверки живут **внутри контроллеров**, своими реализациями:

| Файл | Локальные проверки |
|---|---|
| `api/controllers/poll.controller.ts` | `function getAuthUser` (16), `requireGroupMember` (31), `requireGroupAdmin` (52), `parseOptionalGroupId` (82), `getAccessibleGroupIds` (92) |
| `api/controllers/category-order.controller.ts` | `private static getAuthUser` (12), `getCategoryOrderResponsibleUserId` (32), `isUserParticipant` (43), `canAccessPoll` (52) |
| `api/controllers/store-run.controller.ts` | `function getAuthUser` (39) |

Обратите внимание: копий `getAuthUser` три, но объявлены они **по-разному** —
две как `function`, одна как `private static` метод класса. Наивный
`grep "function getAuthUser"` найдёт только две (см. критерии готовности).

`category-order.controller.ts` при этом **ходит в Prisma напрямую** из
контроллера (`prisma.poll.findUnique`, `prisma.groupMember.findUnique`) — то
есть авторизационное правило «участник активной группы этого опроса» описано
в слое HTTP, а не в сервисе, и его нельзя переиспользовать.

Проблема не в стиле, а в том, что **правило доступа существует в трёх
вариантах и обновляется по одному**. Такой класс расхождений и есть типовая
причина утечки данных между группами.

## Что делать

0. **Построить матрицу авторизации до правок:** таблица «эндпоинт → кто может
   сейчас → кто сможет после». Это не бюрократия: в части handler'ов
   авторизация **ветвится внутри** по типу операции (например, ответственный
   может править свои позиции, админ — любые). Перенос такой проверки на
   маршрут меняет момент проверки и может открыть эндпоинт шире, чем сейчас.
   Три теста на 403 этого не покажут — покажет только матрица.
1. Свести к одному набору middleware в `backend/src/api/middleware/`:
   - `requireAuth` — есть `req.user` (заменяет три `getAuthUser`);
   - `requireGroupMember` — участник группы, взятой из `params`/`query`/`body`;
   - `groupAdminMiddleware` — уже есть, оставить как есть;
   - `requirePollAccess` — участник группы, к которой принадлежит `:pollId`
     (переносится из `category-order.controller.canAccessPoll` + `poll.controller.requireGroupMember`);
   - `requireCategoryOrderParticipant` / `requireCategoryOrderResponsible` —
     переносятся из `category-order.controller`.
2. Логику «кто участник/админ» держать в `GroupService`
   (`isUserGroupMember` / `isUserGroupAdmin` уже существуют и уже используются
   `poll.controller`) — middleware только читает решение, Prisma из
   контроллеров и middleware уходит.
3. Подключить в роутерах, удалить локальные копии из контроллеров.
4. `getAccessibleGroupIds` (poll.controller:92) — это не авторизация, а
   выборка scope. Переносится в `GroupService` как метод, а не в middleware.

## TDD-порядок

Для каждого переносимого endpoint'а — три теста **до** правки (они должны быть
зелёными и остаться зелёными, это защита от регрессии доступа):

```ts
it('участник группы получает 200', ...)
it('пользователь из другой группы получает 403', ...)
it('без токена — 401', ...)
```

Отдельно — тест на middleware в изоляции
(`backend/src/api/middleware/__tests__/`): каталог уже существует, там есть
примеры.

## Подводные камни

- **Порядок middleware.** `groupAdminMiddleware` читает `req.user`, значит
  обязан стоять после `telegramAuth`. В `poll.routes.ts` цепочки уже
  выстроены — не переставляйте их «для красоты».
- **Откуда берётся groupId.** У разных endpoint'ов он в разных местах: в
  `params` (`/groups/:groupId/...`), в `query` (инъекция из
  `api.service.buildUrl`), в `body` (создание опроса). Один middleware должен
  уметь все три источника, с фиксированным приоритетом, и это надо
  задокументировать в его docstring — иначе следующая правка внесёт четвёртый
  вариант.
- **Комментарий в `poll.controller.getAccessibleGroupIds`** прямо описывает
  прошлое изменение семантики: раньше `undefined` означало «видно всё» по
  глобальному флагу админа, теперь выборка всегда сужена до групп человека.
  При переносе **нельзя вернуть старое поведение** — это была осознанная
  правка доступа. Перенесите комментарий вместе с кодом.
- **`store-run.controller.getAuthUser` (39)** отличается сигнатурой: принимает
  только `req` и не отвечает клиенту. Не сводите его к тому же хелперу
  «по имени» — сначала посмотрите, кто и как обрабатывает его `null`.
- **Не менять коды/статусы ответов** в этой задаче (см. задачу 03).

## Критерии готовности

- [ ] `grep -rnE "(function|static) getAuthUser" backend/src/api/controllers`
      пусто. **Не** `grep "function getAuthUser"` — он пройдёт, пока копия в
      `category-order.controller.ts` (объявлена как `private static`) жива.
- [ ] Матрица «эндпоинт → доступ до / после» составлена, и по ней нет ни одного
      эндпоинта, открывшегося шире.
- [ ] Коллизия имён `groupAdminMiddleware` (API vs бот) устранена.
- [ ] `grep -rn "prisma\." backend/src/api/controllers/category-order.controller.ts`
      пусто (Prisma ушла из контроллера).
- [ ] Каждая перенесённая проверка имеет тест на 403 из чужой группы.
- [ ] Покрытие backend не упало ниже порогов в `backend/jest.config.js`.

## Проверка

```powershell
npm --prefix backend test
npm --prefix backend run lint
```
