# 14 — Дублирование: четыре реализации русской плюрализации, пять копий `escapeHtml`

- **Приоритет:** P2, **но пункт 14.1 делается ДО задач 06 и 07** —
  `getVotesWord` и вторая копия `getPluralForm` живут ровно в тех файлах,
  которые режут задачи 06 и 07; иначе дубликаты разъедутся по новым модулям.
  **14.1 и 09.4 конфликтуют по файлу** `notification.service.ts` (кодировка и
  плюрализация в одном файле) — делать строго один за другим, сначала 09.4
- **Оценка:** 3–4 часа на плюрализацию, 2–3 часа на выборки и `escapeHtml`
- **Тип:** DRY
- **Область:** `backend/src/services/*`, `backend/src/bot/keyboards/*`, `backend/src/jobs/*`

## 14.1 Четыре реализации плюрализации в backend

На фронтенде есть один общий модуль — `frontend-new/src/shared/lib/pluralize.ts`
с `pluralize(n, one, few, many)` и `pluralForm`. Он используется 8+ раз
(`StatsPage`, `ProfilePage`, `ShoppingView`, `adminMappers`, `PollResultsPage`,
`MenuPage`).

В backend то же самое написано четыре раза:

| Файл | Реализация | Использование |
|---|---|---|
| `bot/keyboards/poll.keyboard.ts` | `getPluralForm(count, one, few, many)` | строки 135, 174 |
| `services/notification.service.ts:23` | **своя копия** `getPluralForm` с той же сигнатурой | строка 137 |
| `services/poll.service.extensions.ts:353` | `getVotesWord(count)` — захардкожено на слово «голос» | `createPollResultsMessage` |
| `jobs/debt-reminder.job.ts:9` | `pluralize(count, one, few, many)` — четвёртое имя того же | строки 33, 38, 41 |

Четыре функции, четыре имени, одна логика. Причём одна из них
(`getVotesWord`) — деградировавшая версия: она умеет только одно слово, и
следующий, кому нужна плюрализация в сообщении бота, напишет пятую.

**Что делать:** один модуль `backend/src/utils/pluralize.ts` с той же
сигнатурой и тем же именем, что на фронте (`pluralize(n, one, few, many)`) —
чтобы человек, читающий обе половины продукта, видел одно имя. Удалить четыре
локальные копии. `getVotesWord(n)` заменяется на
`pluralize(n, 'голос', 'голоса', 'голосов')` — так уже написано в
`poll.keyboard.ts:135`, то есть форма ответа не меняется.

**Подводный камень:** проверьте, что все четыре реализации дают одинаковый
результат на границах: 1, 2, 4, 5, 11, 12, 14, 21, 111, 0. `getVotesWord`
обрабатывает 11–19 отдельной ветвью — убедитесь, что общая функция делает то
же. Тест на таблицу значений — до замены. В `admin.service.test.ts:641` уже
есть параметризованный тест склонения дней — используйте его как образец.

---

## 14.2 Повторяющиеся выборки (Repowise: 390 планов рефакторинга)

`get_health(include=["refactoring"])` даёт 390 планов; большинство — мелкие
`extract_method`. Полезны те, что помечены `dry_violation` с 2–3 вхождениями в
**разных** файлах. Примеры:

**Выборка блюд по id голосов** — 3 вхождения:

```
backend/src/services/poll.service.ts:1194-1201
backend/src/services/vote.service.ts:999-1006
backend/src/services/vote.service.ts:1155-1163
```

Код:

```ts
const menuItemIds = votesByItem.map(v => v.menuItemId).filter((id): id is number => id !== null);
const menuItems = await prisma.menuItem.findMany({ where: { id: { in: menuItemIds } }, ... });
```

Это не просто дубль — это **общее правило домена**: «голоса → блюда, `null`
отбрасываются». Правило должно жить в одном месте, потому что если изменится
трактовка `menuItemId === null` (голос «за любое»), сейчас придётся править три
места, и одно наверняка забудут.

**Что делать:** взять только межфайловые `dry_violation` с
`occurrence_count >= 3` и вынести в методы соответствующего сервиса. Порог
именно 3, а не 2: вхождения с `occurrence_count: 2` (например, «выборка
просроченных опросов» в `poll.service.ts:1243-1255` и `user.service.ts:282-294`)
дают отдачу около нуля — два места правятся руками быстрее, чем заводится
третья абстракция. Внутрифайловые дубли не трогать — они уйдут сами при
разрезании god-файлов (задачи 06, 07).

**Игнорировать `suggested_site` от Repowise:** он предлагает
`{"module": "backend/__tests__", "suggested_name": "tests_helper"}` — это
артефакт эвристики, а не осмысленное место. Кладите по домену.

---

## 14.3 Дублирование `escapeHtml` — пять мест

| Место | Как объявлено |
|---|---|
| `services/notification.service.ts` | приватный метод класса |
| `services/feedback.service.ts:62` | **инлайновая стрелка внутри метода** (`.replace(/&/g, '&amp;')` на строке 64), используется на строках 72, 75, 76 |
| `bot/keyboards/poll.keyboard.ts` | проверить |
| `bot/keyboards/webapp.keyboard.ts` | проверить |
| `jobs/debt-reminder.job.ts` | проверить |

Копия в `feedback.service.ts` показательна: она объявлена **внутри метода**,
то есть её не найдёт ни grep по `function escapeHtml`, ни knip. Ищите по
`replace(/&/g`.

Проверьте, эскейпится ли пользовательский ввод в каждом месте, где строится
HTML-сообщение — **скорее всего где-то нет**, и это не только DRY, но и
источник ошибок `Bad Request: can't parse entities` на именах с `&` или `<`
(см. подводный камень в задаче 07).

**Что делать:** один `backend/src/utils/telegram-html.ts` с `escapeHtml`, и
пройтись по всем местам, где строится HTML-сообщение с пользовательскими
данными.

## Критерии готовности

- [ ] `grep -rn "getPluralForm\|getVotesWord" backend/src` → только импорты
      из общего util.
- [ ] Общий `pluralize` покрыт таблицей значений 0,1,2,4,5,11,12,14,21,111.
- [ ] Имя и сигнатура совпадают с `frontend-new/src/shared/lib/pluralize.ts`.
- [ ] Межфайловые `dry_violation` с **3+** вхождениями закрыты.
- [ ] `escapeHtml` — один; пять копий (включая инлайновую в
      `feedback.service.ts:62`) удалены; есть тест на `& < >` в русском тексте.

## Проверка

```powershell
npm --prefix backend run lint
npm --prefix backend test
```
