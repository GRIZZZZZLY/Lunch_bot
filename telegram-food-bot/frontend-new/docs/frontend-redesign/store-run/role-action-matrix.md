# Store Run — матрица ролей и действий

Роли: **P** участник (active member группы), **I** инициатор, **O** владелец
позиции (подмножество P/I для конкретной строки), **X** не член группы.
Столбцы: **Visible** (виден ли контрол) · **Enabled** · **Confirm** · **Endpoint**
· **Ожидаемая ошибка бэкенда при нарушении**.

Проверки бэкенда — из [../store-run-state-machine.md](../store-run-state-machine.md).
UI обязан показывать контрол только там, где бэкенд его разрешит (иначе гарантированный
403/409 — как баг B2).

## COLLECTING

| Действие | Роль | Visible | Enabled | Confirm | Endpoint | Ошибка при нарушении |
|---|---|---|---|---|---|---|
| Добавить позицию | P, I | да | да | — | POST `/store-runs/:id/items` | 409 WRONG_STATUS вне COLLECTING |
| Редактировать позицию | O | да (своя) | да | — | PATCH `/items/:itemId` | 403 не владелец / 409 вне COLLECTING |
| Удалить позицию | O | да (своя) | да | **да** | DELETE `/items/:itemId` | 403 не владелец (фикс B2) |
| Удалить чужую | I, P | **нет** | — | — | — | 403 (поэтому скрыто) |
| Закрыть сбор | I | да | нет при 0 позиций | **да** | POST `/start-shopping` | 403 не инициатор / 409 |
| Отменить закупку | I | да | да | **да** | POST `/cancel` | 403 / 409 не из COLLECTING |
| Просмотр | P, I | да | — | — | GET `/store-runs/:id` | X → 403 |

## SHOPPING

| Действие | Роль | Visible | Enabled | Confirm | Endpoint | Ошибка при нарушении |
|---|---|---|---|---|---|---|
| Отметить «Куплено» + цена | I | да | да | — | POST `/items/:itemId/price` {status:BOUGHT, price≥0} | 403 не инициатор / 409 вне SHOPPING |
| Отметить «Не нашли» | I | да | да | — | POST `/items/:itemId/price` {status:NOT_FOUND, price:null} | 403 / 409 |
| Переключить BOUGHT↔NOT_FOUND | I | да | да | — | тот же price-endpoint | 403 / 409 |
| Рассчитать (settle) | I | да | нет, если есть BOUGHT без цены | **да, если есть REQUESTED** | POST `/settle` | 403 / 409 |
| Добавить / редактировать / удалить | P, I, O | **нет** | — | — | — | 409 WRONG_STATUS |
| Отменить | I | **нет** (из SHOPPING отмены нет) | — | — | — | 409 (только cron-автоотмена) |
| Просмотр | P, I | да | — | — | GET `/store-runs/:id` | X → 403 |

- Участник (не инициатор) в SHOPPING: все mutation-контролы **невидимы**, экран
  read-only с личной ориентировочной суммой.
- Раннего ручного перехода COLLECTING→SHOPPING по таймеру нет — это делает cron.

## SETTLED / CANCELLED (терминальные)

| Действие | Роль | Visible | Enabled | Endpoint | Ошибка при нарушении |
|---|---|---|---|---|---|
| Любая mutation | все | **нет** | — | — | 409 WRONG_STATUS |
| Просмотр | P, I | да | — | GET `/store-runs/:id` | X → 403 |
| «На главную» (навигация) | все | да (OQ1/OQ2) | да | — (client route) | — |

## Не член группы (X) — все статусы

- GET `/store-runs/:id` → 403 FORBIDDEN. UI: ErrorState `forbidden` «Вы не
  состоите в этой группе» (раздельно с 404, фикс B4). Контролы не показываются.

## Инварианты видимости (для реализации)

- `isInitiator = run.initiatorId === user.id`.
- `isOwner(item) = item.userId === user.id`.
- COLLECTING: edit/delete ⇔ `isOwner(item)`. Никогда не показывать удаление,
  если `!isOwner` (даже инициатору).
- SHOPPING: price/статус-контролы ⇔ `isInitiator`.
- Терминальные: mutation-контролов нет ни у кого.
