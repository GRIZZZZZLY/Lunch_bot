# Store Run — единый путь заполнения (Mini App) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать Mini App единственным способом заполнения магазинного заказа: групповая кнопка открывает Mini App напрямую, текстовый ввод в ЛС бота удаляется.

**Architecture:** Групповая кнопка переходит с PM-deep-link (`?start=storerun_`) на Direct Link Mini App (`?startapp=storerun_`) через существующий helper `createDirectLinkMiniAppUrl`. Приёмный конец (App.tsx роутинг + auth.controller авто-membership) уже готов — не трогаем. Весь текстовый стек ввода (handler + service-методы) удаляется атомарно, чтобы tsc оставался зелёным на границе коммита.

**Tech Stack:** TypeScript, Grammy.js (бот), Express. Сборка-проверка: `npx tsc --noEmit`. Деплой: `update-vps.sh` на VPS через `ssh config1`.

**Спека:** `docs/superpowers/specs/2026-06-01-store-run-single-entry-miniapp-design.md`

**Примечание про тесты:** Юнит-тестов на изменяемые/удаляемые сущности нет (проверено grep'ом). Бот-уведомления — побочные эффекты Telegram API без тест-харнесса (плюс globalSetup.ts блокирует обычный прогон Jest). Поэтому верификация каждой задачи — `tsc --noEmit` (EXIT 0) + финальная ручная проверка в проде. TDD-цикл здесь неприменим.

---

### Task 1: Групповая кнопка → Mini App напрямую + чистка DM

**Files:**
- Modify: `backend/src/services/notification.service.ts` (метод `postStoreRunToGroup` + метод `notifyGroupMembersAboutStoreRun` + импорты)

- [ ] **Step 1: Добавить импорт `createDirectLinkMiniAppUrl`**

В шапку файла, рядом с другими импортами (после строки `import { now } from '../utils/date';`), добавить:

```typescript
import { createDirectLinkMiniAppUrl } from '../bot/keyboards/webapp.keyboard';
```

(Циклической зависимости нет: `webapp.keyboard.ts` импортирует только `botConfig`.)

- [ ] **Step 2: Заменить URL групповой кнопки на Direct Link**

В методе `postStoreRunToGroup` найти блок построения сообщения и кнопки. Удалить строку с `botUsername`:

```typescript
    const botUsername = process.env.BOT_USERNAME || 'rocket_lunch_bot';
```

И заменить кнопку. Было:

```typescript
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🛒 Заказать',
                  url: `https://t.me/${botUsername}?start=storerun_${storeRunId}`,
                },
              ],
            ],
          },
```

Стало:

```typescript
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🛒 Заказать',
                  url: createDirectLinkMiniAppUrl(`storerun_${storeRunId}`),
                },
              ],
            ],
          },
```

- [ ] **Step 3: Убрать инструкцию про текстовый ввод из DM**

В методе `notifyGroupMembersAboutStoreRun` найти построение `message`. Было:

```typescript
    const message =
      `🛒 <b>${this.escapeHtml(initiatorName)}</b> идёт в «${this.escapeHtml(storeName)}»\n\n` +
      `Напиши что тебе взять — сбор до ${collectUntilStr}\n\n` +
      `<i>Или просто ответь мне сообщением: что взять, через запятую.</i>`;
```

Стало:

```typescript
    const message =
      `🛒 <b>${this.escapeHtml(initiatorName)}</b> идёт в «${this.escapeHtml(storeName)}»\n\n` +
      `Напиши что тебе взять — сбор до ${collectUntilStr}.\n\n` +
      `<i>Нажми «📱 Заполнить заказ», чтобы открыть список.</i>`;
```

- [ ] **Step 4: Проверить сборку**

Run: `cd backend && npx tsc --noEmit; echo "EXIT=$?"`
Expected: `EXIT=0`

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/notification.service.ts
git commit -m "feat(store-run): group button opens Mini App directly; drop text-reply hint in DM"
```

---

### Task 2: Удалить текстовый стек ввода (атомарно)

Удаление выполняется одной задачей: bot.ts-ссылки, файл-хендлер и осиротевшие service-методы взаимозависимы по типам, поэтому промежуточные состояния не компилируются. Коммит — только после зелёного tsc.

**Files:**
- Modify: `backend/src/bot/bot.ts` (удалить message:text-обработчик ≈179-189 и callback-блок `storerun_addto:` ≈247-257)
- Delete: `backend/src/bot/handlers/store-run.handlers.ts`
- Modify: `backend/src/services/store-run.service.ts` (удалить `findCollectingRunsForParticipant`, `parseTextOrder`, тип `ParsedOrderLine`, константу `PARSE_MAX_POSITIONS`)

- [ ] **Step 1: Удалить обработчик текстовых сообщений в bot.ts**

Удалить целиком блок (вместе с комментарием):

```typescript
  // Личные сообщения с заказами в магазинный забег ("Иду в магазин")
  bot.on('message:text', async (ctx, next) => {
    try {
      const { handleStoreRunTextMessage } = await import('./handlers/store-run.handlers');
      const consumed = await handleStoreRunTextMessage(ctx as any);
      if (!consumed) await next();
    } catch (err) {
      logger.error('store-run text handler failed', { err });
      await next();
    }
  });
```

- [ ] **Step 2: Удалить callback-блок `storerun_addto:` в bot.ts**

Удалить целиком блок:

```typescript
      // Store run: добавить позиции из кэшированного текста
      if (data.startsWith('storerun_addto:')) {
        const runId = parseCallbackId(data, 1);
        if (!runId) {
          await ctx.answerCallbackQuery('❌ Не получилось открыть забег. Обнови страницу.');
          return;
        }
        const { handleStoreRunAddToCallback } = await import('./handlers/store-run.handlers');
        await handleStoreRunAddToCallback(ctx as any, runId);
        return;
      }
```

- [ ] **Step 3: Удалить файл хендлера**

```bash
git rm backend/src/bot/handlers/store-run.handlers.ts
```

- [ ] **Step 4: Удалить осиротевшие сущности в store-run.service.ts**

Удалить константу (в блоке констант наверху файла):

```typescript
const PARSE_MAX_POSITIONS = 20;
```

Удалить тип:

```typescript
export interface ParsedOrderLine {
  name: string;
  quantity: number;
  notes: null;
}
```

Удалить метод `findCollectingRunsForParticipant` целиком (вместе с JSDoc-комментарием над ним):

```typescript
  /**
   * Активные COLLECTING-забеги, где пользователь — участник (не инициатор).
   * Используется бот-handler-ом текстовых сообщений в личку.
   */
  static async findCollectingRunsForParticipant(userId: number): Promise<StoreRun[]> {
    const memberships = await prisma.groupMember.findMany({
      where: { userId, isActive: true },
      select: { groupId: true },
    });
    const groupIds = memberships.map((m) => m.groupId);
    if (groupIds.length === 0) return [];

    return prisma.storeRun.findMany({
      where: {
        groupId: { in: groupIds },
        status: 'COLLECTING',
        initiatorId: { not: userId },
        collectUntil: { gt: new Date() },
      },
      include: { initiator: true },
      orderBy: { createdAt: 'desc' },
    });
  }
```

Удалить метод `parseTextOrder` целиком (вместе с JSDoc над ним):

```typescript
  /**
   * Разбор свободного текста участника в список позиций.
   * Сплитит по запятым и переводам строк, trim, отбрасывает пустые и слишком длинные.
   */
  static parseTextOrder(text: string): ParsedOrderLine[] {
    return text
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= ITEM_NAME_MAX_LEN)
      .slice(0, PARSE_MAX_POSITIONS)
      .map((name) => ({ name, quantity: 1, notes: null }));
  }
```

ВАЖНО: `ITEM_NAME_MAX_LEN`, `ITEM_NOTES_MAX_LEN`, `COLLECT_MIN_MINUTES`, `COLLECT_MAX_MINUTES`, `ACTIVE_STATUSES` НЕ трогать — используются в других методах (`createStoreRun`, `updateItem`, `sanitizeItemInput`, `getActiveStoreRunsForUser`).

- [ ] **Step 5: Проверить сборку**

Run: `cd backend && npx tsc --noEmit; echo "EXIT=$?"`
Expected: `EXIT=0` (нет висячих ссылок на удалённые символы/модуль)

- [ ] **Step 6: Проверить, что ссылок на удалённое не осталось**

Run: `grep -rn "handleStoreRunTextMessage\|handleStoreRunAddToCallback\|findCollectingRunsForParticipant\|parseTextOrder\|ParsedOrderLine\|storerun_addto\|store-run.handlers" backend/src; echo "EXIT=$?"`
Expected: пусто, `EXIT=1` (grep ничего не нашёл)

- [ ] **Step 7: Commit**

```bash
git add -A backend/src/bot/bot.ts backend/src/bot/handlers backend/src/services/store-run.service.ts
git commit -m "refactor(store-run): remove PM text-entry path (Mini App is the single order-entry)"
```

---

### Task 3: Деплой и ручная верификация

**Files:** нет (деплой + проверка).

- [ ] **Step 1: Push**

```bash
git push origin feature/store-run
```

- [ ] **Step 2: Деплой на VPS**

```bash
ssh config1 'cd /home/zubr/projects/telegram-food-bot/telegram-food-bot && bash update-vps.sh' 2>&1 | tail -20
```
Expected: `✅ Update completed successfully!`, процесс `rocket-lunch-bot` `online`.

- [ ] **Step 3: Ручная проверка сквозного потока**

В Telegram:
1. Создать забег через Mini App (или дождаться существующего).
2. В групповом чате найти сообщение «🛒 … идёт в «…»» с кнопкой «🛒 Заказать».
3. Нажать кнопку → Expected: **открывается Mini App сразу на странице забега** (`/store-run/:id`, ParticipantView), а НЕ личка бота.
4. Заполнить позицию через форму (название/кол-во/заметка) → позиция появляется в «Мой заказ».
5. Написать боту в ЛС любой текст («Кола, Сникерс») → Expected: бот НЕ создаёт позиций (текстовый путь удалён).

- [ ] **Step 4: Проверить логи на ошибки рантайма**

```bash
ssh config1 'pm2 logs rocket-lunch-bot --lines 30 --nostream'
```
Expected: нет ошибок про `store-run.handlers` / отсутствующий модуль.

---

## Self-Review

**1. Покрытие спеки:**
- Групповая кнопка → Direct Link — Task 1 Step 2. ✓
- DM без инструкции про текст — Task 1 Step 3. ✓
- Удалить store-run.handlers.ts — Task 2 Step 3. ✓
- bot.ts: убрать text-handler + storerun_addto — Task 2 Steps 1-2. ✓
- service: убрать findCollectingRunsForParticipant/parseTextOrder/ParsedOrderLine/PARSE_MAX_POSITIONS — Task 2 Step 4. ✓
- start.ts storerun_ — оставить (в спеке «без изменений», в плане не трогается). ✓
- Frontend — без изменений. ✓
- Верификация tsc + ручная — Tasks 1/2 Step «сборка», Task 3. ✓

**2. Плейсхолдеры:** нет TBD/TODO; весь удаляемый/изменяемый код приведён дословно.

**3. Консистентность типов/имён:** `createDirectLinkMiniAppUrl(startParam: string)` — сигнатура совпадает с `webapp.keyboard.ts`. Имена удаляемых символов сверены с grep-выводом (Task 2 Step 6 их же перечисляет).
