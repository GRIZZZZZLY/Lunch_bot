# 08 — `category-order.controller.ts`: худший health-скор репозитория, Prisma в HTTP-слое

- **Приоритет:** P1
- **Оценка:** 1 день
- **Зависимости:** только 02, 03, 04. С задачами 05/06/07 **не пересекается** —
  может идти параллельно им
- **Тип:** god-file + протечка слоёв
- **Область:** `backend/src/api/controllers/category-order.controller.ts`, `backend/src/services/category-order.service.ts`

## Метрики

| Показатель | Значение |
|---|---|
| Строк | 958 |
| NLOC | 787, churn-персентиль 95.2 |
| Health | **1.9 / 10** — «худший в репозитории» по сводке `get_health` |
| Maintainability | 5.0 |
| Ручных `success: false` | 53 |
| Прямых обращений к Prisma из контроллера | есть (`prisma.poll`, `prisma.categoryOrder`, `prisma.groupMember`) |

Связанный сервис `category-order.service.ts` (596 строк, health 3.24) отдельно
отмечен в сводке здоровья как критический: «complex conditional (updateCosts),
impact −2.2», плюс **4 находки IO-in-loop / N+1** — больше, чем в любом другом
файле (см. задачу 13).

## Крупнейшие handler'ы

| Метод | Строки | Объём |
|---|---|---|
| `saveOrderItem` | 263–374 | **112** |
| `updateCosts` | 747–851 | **105** |
| `volunteerForCategory` | 656–745 | 90 |
| `deleteOrderItem` | 376–448 | 73 |
| `getParticipants` | 517–589 | 73 |
| `getProgress` | 450–515 | 66 |
| `finalizeCalculation` | 591–651 | 61 |
| `getCategoryOrder` | 201–261 | 61 |
| `getMyCategoryOrdersForPoll` | 140–199 | 60 |
| `getOrderItems` | 902–957 | 56 |

## Протечка слоёв

Контроллер держит собственные авторизационные запросы к базе:

- `canAccessPoll` (52–77): `prisma.poll.findUnique` + `prisma.groupMember.findUnique`
  — правило «участник активной группы этого опроса» описано в HTTP-слое;
- `getCategoryOrderResponsibleUserId` (32–41): `prisma.categoryOrder.findUnique`;
- `isUserParticipant` (43–50): через сервис — то есть в одном файле два разных
  стиля доступа к данным.

Итог: правило доступа к заказам по категориям нельзя переиспользовать ни из
бота, ни из джоба, ни из другого контроллера. При изменении правила его надо
искать в трёх местах (здесь, в `poll.controller`, в `groupAdminMiddleware`).

## Что делать

Тот же порядок, что в задаче 05 — большая часть строк уходит механически:

1. **Задача 04** забирает `getAuthUser`, `canAccessPoll`, `isUserParticipant`,
   `getCategoryOrderResponsibleUserId` в middleware + `CategoryOrderService`.
   Prisma из контроллера исчезает.
2. **Задача 02** забирает разбор `params`/`body` (53 handler'а начинаются с
   `parseInt` + `isNaN`).
3. **Задача 03** забирает `catch`-блоки (перевод на `next(err)`). 53 ручных
   ответа об ошибке при этом **останутся** — массовая замена признана работой
   без адресата; см. врезку в задаче 03.
4. Остаток — бизнес-сценарии `saveOrderItem`, `updateCosts`,
   `volunteerForCategory`, `finalizeCalculation` — переносится в
   `CategoryOrderService` / `OrderCalculationService`.

`updateCosts` (105 строк в контроллере) отдельно отмечен Repowise как
«complex conditional» **уже в сервисе** — значит логика расчёта размазана
между контроллером и сервисом. Свести в один метод сервиса.

## TDD-порядок

Характеризующие тесты до переноса, приоритет — денежные операции:

```ts
describe('updateCosts', () => {
  it('ответственный меняет цену → пересчёт долей участников', ...)
  it('участник (не ответственный) → 403', ...)
  it('цена с копейками не теряет точность', ...)   // Decimal, не float
  it('нулевая цена / отрицательная → 400', ...)
});
```

## Подводные камни

- **Деньги считаются в `Decimal`.** `backend/src/utils/decimal.ts` (148 строк)
  предоставляет `toNumber`. Контроллер вызывает `toNumber` перед ответом.
  При переносе логики в сервис **не приводите к `number` внутри расчёта** —
  только на границе ответа. Иначе появятся ошибки округления в долях, которые
  всплывут не сразу, а на суммах вида 333.33.
- **`serializeBigInt`** — как в задаче 05: остаётся в транспорте.
- **N+1 не трогать здесь.** В `category-order.service.ts` четыре находки
  IO-in-loop. Соблазн «раз уж я здесь» велик, но смешивание рефакторинга слоёв
  с изменением запросов делает регрессию неразличимой. Это задача 13.
- **`finalizeCalculation` необратим.** Он фиксирует расчёт и создаёт долги
  (см. `budget.service`). Если при переносе он станет вызываться дважды
  (например, потерялась проверка статуса), пользователи получат двойные долги.
  Тест на идемпотентность — обязателен до переноса.
- **Порог `functions: 89`** — см. задачу 05: extract-method плодит функции
  быстрее, чем строки, и первым красным станет этот порог, а не `statements`.
- **Пустой список участников.** `getParticipants` возвращает список из сервиса;
  несколько handler'ов дальше делают `.includes(userId)`. Проверьте поведение
  при пустом списке — сейчас оно неявное.

## Критерии готовности

- [ ] `grep -n "prisma\." backend/src/api/controllers/category-order.controller.ts` пусто.
- [ ] Файл ≤ 400 строк.
- [ ] Ни один handler > 40 строк.
- [ ] `updateCosts` — один метод сервиса, покрытый тестами на границы (0,
      отрицательные, копейки, повторный вызов).
- [ ] Health-скор файла > 4.0.

## Проверка

```powershell
npm --prefix backend run lint
npm --prefix backend run build:prod
npm --prefix backend test
```
