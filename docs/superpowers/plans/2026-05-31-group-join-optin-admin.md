# Group-Join Opt-In Button + Per-Group Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** При добавлении бота в группу: добавивший становится per-group админом (CREATOR), а welcome-сообщение получает кнопку «✅ Я обедаю», которая регистрирует кликнувшего в БД и ставит `participatesInPolls=true`.

**Architecture:** Изменения только в bot-слое. Per-group роль уже поддержана (`GroupMember.role`, фронт читает `group.role`). Логика «не понижать роль» выносится в тестируемый `GroupService.ensureMemberRole`. Opt-in — новый тонкий хендлер, подключённый в существующий диспетчер `bot.on('callback_query:data')`. Миграций БД нет, фронт и API-контроллеры не трогаем.

**Tech Stack:** TypeScript, Grammy.js, Prisma (PostgreSQL), Jest.

**Spec:** [docs/superpowers/specs/2026-05-31-group-join-optin-admin-design.md](../specs/2026-05-31-group-join-optin-admin-design.md)

---

## File Structure

| Файл | Ответственность | Действие |
|---|---|---|
| `backend/src/services/group.service.ts` | `ensureMemberRole` — идемпотентное назначение роли без понижения | Modify |
| `backend/src/types/user.types.ts` | Добавить `participatesInPolls` в `UpdateUserData` | Modify |
| `backend/src/bot/handlers/group.handlers.ts` | `handleOptInButton` — регистрация кликнувшего + opt-in | Create |
| `backend/src/bot/events/group-events.ts` | `mapChatMemberStatusToRole` + правка `my_chat_member` (adder→CREATOR, sync, 2 кнопки) | Modify |
| `backend/src/bot/bot.ts` | Маршрутизация `optin_` в диспетчере callback | Modify |
| `backend/src/services/__tests__/group.service.test.ts` | Тесты `ensureMemberRole` | Modify |
| `backend/src/bot/handlers/__tests__/group.handlers.test.ts` | Тест `handleOptInButton` | Create |
| `backend/src/bot/events/__tests__/group-events.test.ts` | Тест `mapChatMemberStatusToRole` | Create |

---

## Task 1: `GroupService.ensureMemberRole` (идемпотентно, без понижения)

**Files:**
- Modify: `backend/src/services/group.service.ts`
- Test: `backend/src/services/__tests__/group.service.test.ts`

- [ ] **Step 1: Write the failing tests**

Добавить в конец `describe`-блока в `backend/src/services/__tests__/group.service.test.ts` (рядом с существующими тестами):

```typescript
describe('ensureMemberRole', () => {
  it('creates member with desired role (new member, no downgrade needed)', async () => {
    const addSpy = jest
      .spyOn(GroupService, 'addMemberToGroup')
      .mockResolvedValue({ id: 1, groupId: 10, userId: 5, role: 'CREATOR', isActive: true });
    const setSpy = jest.spyOn(GroupService, 'setMemberRole').mockResolvedValue({} as any);

    const result = await GroupService.ensureMemberRole(10, 5, 'CREATOR');

    expect(addSpy).toHaveBeenCalledWith(10, 5, 'CREATOR');
    expect(setSpy).not.toHaveBeenCalled();
    expect(result.role).toBe('CREATOR');

    addSpy.mockRestore();
    setSpy.mockRestore();
  });

  it('upgrades existing MEMBER to CREATOR', async () => {
    const addSpy = jest
      .spyOn(GroupService, 'addMemberToGroup')
      .mockResolvedValue({ id: 1, groupId: 10, userId: 5, role: 'MEMBER', isActive: true });
    const setSpy = jest
      .spyOn(GroupService, 'setMemberRole')
      .mockResolvedValue({ id: 1, groupId: 10, userId: 5, role: 'CREATOR', isActive: true });

    const result = await GroupService.ensureMemberRole(10, 5, 'CREATOR');

    expect(setSpy).toHaveBeenCalledWith(10, 5, 'CREATOR');
    expect(result.role).toBe('CREATOR');

    addSpy.mockRestore();
    setSpy.mockRestore();
  });

  it('does NOT downgrade existing CREATOR to ADMIN', async () => {
    const addSpy = jest
      .spyOn(GroupService, 'addMemberToGroup')
      .mockResolvedValue({ id: 1, groupId: 10, userId: 5, role: 'CREATOR', isActive: true });
    const setSpy = jest.spyOn(GroupService, 'setMemberRole').mockResolvedValue({} as any);

    const result = await GroupService.ensureMemberRole(10, 5, 'ADMIN');

    expect(setSpy).not.toHaveBeenCalled();
    expect(result.role).toBe('CREATOR');

    addSpy.mockRestore();
    setSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest group.service.test --silent -t "ensureMemberRole"`
Expected: FAIL — `GroupService.ensureMemberRole is not a function`.

- [ ] **Step 3: Implement `ensureMemberRole`**

В `backend/src/services/group.service.ts` добавить перед `setMemberRole` (или сразу после `addMemberToGroup`). В начале файла, рядом с импортами, добавить константу приоритетов:

```typescript
// Иерархия ролей участника группы. Выше = больше прав.
const ROLE_PRIORITY: Record<string, number> = { MEMBER: 0, ADMIN: 1, CREATOR: 2 };
```

Метод внутри `class GroupService`:

```typescript
  /**
   * Гарантирует участнику роль не ниже desiredRole.
   * Идемпотентно: создаёт участника при отсутствии, повышает роль при
   * необходимости, но НИКОГДА не понижает (защита CREATOR/ADMIN при ресинке).
   */
  static async ensureMemberRole(
    groupId: number,
    userId: number,
    desiredRole: string
  ): Promise<any> {
    const member = await this.addMemberToGroup(groupId, userId, desiredRole);
    const currentRole = member?.role ?? 'MEMBER';
    const currentPriority = ROLE_PRIORITY[currentRole] ?? 0;
    const desiredPriority = ROLE_PRIORITY[desiredRole] ?? 0;

    if (desiredPriority > currentPriority) {
      return await this.setMemberRole(groupId, userId, desiredRole);
    }
    return member;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest group.service.test --silent -t "ensureMemberRole"`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/services/group.service.ts src/services/__tests__/group.service.test.ts
git commit -m "feat(group): ensureMemberRole — idempotent role assignment без понижения"
```

---

## Task 2: `handleOptInButton` + `UpdateUserData.participatesInPolls`

**Files:**
- Modify: `backend/src/types/user.types.ts`
- Create: `backend/src/bot/handlers/group.handlers.ts`
- Test: `backend/src/bot/handlers/__tests__/group.handlers.test.ts`

- [ ] **Step 1: Extend `UpdateUserData`**

В `backend/src/types/user.types.ts` в интерфейс `UpdateUserData` добавить поле (после `isActive`):

```typescript
export interface UpdateUserData {
  username?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  isAdmin?: boolean;
  isActive?: boolean;
  participatesInPolls?: boolean;
}
```

(`UserService.updateUser` спредит `data` в `prisma.user.update`, так что поле подхватится автоматически.)

- [ ] **Step 2: Write the failing test**

Создать `backend/src/bot/handlers/__tests__/group.handlers.test.ts`:

```typescript
import { handleOptInButton } from '../group.handlers';
import { UserService } from '../../../services/user.service';
import { GroupService } from '../../../services/group.service';

jest.mock('../../../services/user.service');
jest.mock('../../../services/group.service');
jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockedUserService = UserService as jest.Mocked<typeof UserService>;
const mockedGroupService = GroupService as jest.Mocked<typeof GroupService>;

function createCtx() {
  return {
    chat: { id: -1001234567, title: 'Test Group', type: 'supergroup' },
    callbackQuery: {
      from: { id: 999, username: 'eater', first_name: 'Ann', last_name: 'Smith', is_bot: false },
    },
    answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
  } as any;
}

describe('handleOptInButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGroupService.upsertGroup.mockResolvedValue({ id: 7 } as any);
    mockedUserService.upsertUser.mockResolvedValue({ id: 42 } as any);
    mockedGroupService.addMemberToGroup.mockResolvedValue({} as any);
    mockedUserService.updateUser.mockResolvedValue({} as any);
  });

  it('registers clicker, adds to group, sets participatesInPolls, answers with toast', async () => {
    const ctx = createCtx();

    await handleOptInButton(ctx);

    expect(mockedUserService.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ telegramId: '999', firstName: 'Ann' })
    );
    expect(mockedGroupService.addMemberToGroup).toHaveBeenCalledWith(7, 42);
    expect(mockedUserService.updateUser).toHaveBeenCalledWith(42, { participatesInPolls: true });
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('списке') })
    );
  });

  it('ignores non-group chats', async () => {
    const ctx = createCtx();
    ctx.chat.type = 'private';

    await handleOptInButton(ctx);

    expect(mockedUserService.upsertUser).not.toHaveBeenCalled();
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx jest group.handlers.test --silent`
Expected: FAIL — cannot find module `../group.handlers`.

- [ ] **Step 4: Implement the handler**

Создать `backend/src/bot/handlers/group.handlers.ts`:

```typescript
import { CallbackQueryContext } from 'grammy';
import { BotContext } from '../../types/bot.types';
import { UserService } from '../../services/user.service';
import { GroupService } from '../../services/group.service';
import { logger } from '../../utils/logger';

/**
 * Кнопка «✅ Я обедаю» в приветственном сообщении группы.
 * Регистрирует кликнувшего в БД (надёжный fallback к chat_member при
 * включённом privacy mode) и ставит постоянный флаг participatesInPolls=true.
 * Идемпотентно: повторный клик безопасен (@@unique([groupId, userId])).
 */
export async function handleOptInButton(
  ctx: CallbackQueryContext<BotContext>
): Promise<void> {
  try {
    const chat = ctx.chat;
    if (!chat || (chat.type !== 'group' && chat.type !== 'supergroup')) {
      await ctx.answerCallbackQuery();
      return;
    }

    const from = ctx.callbackQuery.from;

    const group = await GroupService.upsertGroup({
      telegramId: chat.id.toString(),
      title: chat.title || 'Unknown Group',
      type: chat.type,
    });

    const dbUser = await UserService.upsertUser({
      telegramId: from.id.toString(),
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
    });

    await GroupService.addMemberToGroup(group.id, dbUser.id);
    await UserService.updateUser(dbUser.id, { participatesInPolls: true });

    await ctx.answerCallbackQuery({ text: '✅ Готово! Ты в списке обедающих' });

    logger.info('User opted in via group welcome button', {
      chatId: chat.id,
      userId: from.id,
      username: from.username,
    });
  } catch (error) {
    logger.error('Error handling opt-in button:', error);
    await ctx.answerCallbackQuery({ text: 'Не получилось. Попробуй ещё раз.' });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest group.handlers.test --silent`
Expected: PASS (2 passed).

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/types/user.types.ts src/bot/handlers/group.handlers.ts src/bot/handlers/__tests__/group.handlers.test.ts
git commit -m "feat(bot): handleOptInButton — opt-in регистрация кликнувшего в группе"
```

---

## Task 3: Подключить `optin_` в диспетчер callback (`bot.ts`)

**Files:**
- Modify: `backend/src/bot/bot.ts`

Нет unit-теста: существующий диспетчер `bot.on('callback_query:data')` не покрыт юнит-тестами (требует полный Bot-инстанс). Проверка — сборка + ручной прогон в Task 5.

- [ ] **Step 1: Добавить ветку маршрутизации**

В `backend/src/bot/bot.ts` внутри `bot.on('callback_query:data', async (ctx) => { ... try {` добавить блок рядом с другими `if (data.startsWith(...))` (например, сразу после блока `openpoll:`):

```typescript
      // Opt-in «Я обедаю» из приветственного сообщения группы
      if (data.startsWith('optin_')) {
        const { handleOptInButton } = await import('./handlers/group.handlers');
        await handleOptInButton(ctx as any);
        return;
      }
```

- [ ] **Step 2: Verify build**

Run: `cd backend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/bot/bot.ts
git commit -m "feat(bot): route optin_ callback to handleOptInButton"
```

---

## Task 4: `mapChatMemberStatusToRole` (pure helper, tested)

**Files:**
- Modify: `backend/src/bot/events/group-events.ts`
- Test: `backend/src/bot/events/__tests__/group-events.test.ts`

- [ ] **Step 1: Write the failing test**

Создать `backend/src/bot/events/__tests__/group-events.test.ts`:

```typescript
import { mapChatMemberStatusToRole } from '../group-events';

describe('mapChatMemberStatusToRole', () => {
  it('maps creator → CREATOR', () => {
    expect(mapChatMemberStatusToRole('creator')).toBe('CREATOR');
  });

  it('maps administrator → ADMIN', () => {
    expect(mapChatMemberStatusToRole('administrator')).toBe('ADMIN');
  });

  it('maps member and unknown → MEMBER', () => {
    expect(mapChatMemberStatusToRole('member')).toBe('MEMBER');
    expect(mapChatMemberStatusToRole('restricted')).toBe('MEMBER');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest group-events.test --silent`
Expected: FAIL — `mapChatMemberStatusToRole is not a function` / no export.

- [ ] **Step 3: Implement the helper**

В `backend/src/bot/events/group-events.ts` добавить экспортируемую функцию в начале файла (после импортов, до `setupGroupEvents`):

```typescript
/**
 * Маппинг Telegram chat-member статуса в роль участника группы в нашей БД.
 */
export function mapChatMemberStatusToRole(status: string): 'CREATOR' | 'ADMIN' | 'MEMBER' {
  if (status === 'creator') return 'CREATOR';
  if (status === 'administrator') return 'ADMIN';
  return 'MEMBER';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest group-events.test --silent`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/bot/events/group-events.ts src/bot/events/__tests__/group-events.test.ts
git commit -m "feat(bot): mapChatMemberStatusToRole helper"
```

---

## Task 5: Правка `my_chat_member` — adder→CREATOR, sync ролей, две кнопки

**Files:**
- Modify: `backend/src/bot/events/group-events.ts`

Интеграционный код Grammy-события (нет юнит-теста — как и остальной `group-events.ts`). Вся ветвящаяся логика ролей уже покрыта в Task 1 и Task 4. Проверка — сборка + ручной чеклист.

- [ ] **Step 1: Назначить добавившего CREATOR**

В `backend/src/bot/events/group-events.ts`, в блоке `bot.on('my_chat_member', ...)`, сразу после `const group = await GroupService.upsertGroup({...})` (внутри `if (chat.type === 'group' || chat.type === 'supergroup')`) и ПЕРЕД `try { const admins = ...`, вставить:

```typescript
          // Тот, кто добавил бота, становится per-group админом (CREATOR).
          // ctx.myChatMember.from — пользователь, выполнивший действие.
          const adder = ctx.myChatMember.from;
          if (adder && !adder.is_bot) {
            try {
              const adderUser = await UserService.upsertUser({
                telegramId: adder.id.toString(),
                username: adder.username,
                firstName: adder.first_name,
                lastName: adder.last_name,
              });
              await GroupService.ensureMemberRole(group.id, adderUser.id, 'CREATOR');
              logger.info('Bot adder promoted to group CREATOR', {
                chatId: chat.id,
                adderId: adder.id,
              });
            } catch (adderError) {
              logger.warn('Failed to promote bot adder', {
                chatId: chat.id,
                error: adderError instanceof Error ? adderError.message : String(adderError),
              });
            }
          }
```

- [ ] **Step 2: Маппить роль при синке TG-админов**

В том же блоке, в цикле `for (const admin of admins) { ... }`, заменить строку:

```typescript
              await GroupService.addMemberToGroup(group.id, dbUser.id);
```

на:

```typescript
              await GroupService.ensureMemberRole(
                group.id,
                dbUser.id,
                mapChatMemberStatusToRole(admin.status)
              );
```

- [ ] **Step 3: Заменить welcome на две кнопки**

В том же блоке заменить весь вызов `await ctx.reply('👋 Готово! ...', { ... })` на:

```typescript
          // Отправляем приветственное сообщение с двумя кнопками:
          // callback «Я обедаю» (ловит клик, регистрирует) + url открыть Mini App.
          const deepLink = `https://t.me/${ctx.me.username}?start=menu_${chat.id}`;

          await ctx.reply(
            '👋 Бот на месте! Жми «Я обедаю» — попадёшь в список на голосования.',
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '✅ Я обедаю', callback_data: `optin_${chat.id}` }],
                  [{ text: '🍽 Открыть Mini App', url: deepLink }],
                ],
              },
            }
          );
```

- [ ] **Step 4: Verify build + full test suite**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: tsc без ошибок; все тесты зелёные (258 прежних + новые из Task 1/2/4).

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/bot/events/group-events.ts
git commit -m "feat(bot): adder→CREATOR, role-mapped admin sync, two-button welcome on bot join"
```

---

## Task 6: Ручная проверка + финал

- [ ] **Step 1: Manual smoke test**

1. Запустить dev (`.\start-dev.ps1`) или прод-дев.
2. Добавить @rocket_lunch_bot в тест-группу другим аккаунтом-владельцем.
3. Проверить welcome: текст + 2 кнопки (`✅ Я обедаю`, `🍽 Открыть Mini App`).
4. Третьим аккаунтом нажать `✅ Я обедаю` → тост «✅ Готово! Ты в списке обедающих».
5. БД (Prisma Studio / `npm run list-users`): кликнувший есть, `participatesInPolls=true`; добавивший — `GroupMember.role=CREATOR` в этой группе.
6. Добавившим открыть Mini App (кнопка / Menu Button) → на экране создания голосования группа доступна для управления (per-group admin работает).
7. Проверить, что чужой аккаунт (не добавивший, не глобальный admin) НЕ видит глобальную админку.

- [ ] **Step 2: Self-review diff**

Run: `cd backend && git log --oneline -6 && git diff main --stat`
Expected: затронуты только перечисленные в File Structure файлы; миграций в `prisma/migrations/` нет.

---

## Self-Review (выполнено автором плана)

- **Spec coverage:** ✅ Приветственное сообщение+кнопка (Task 5), регистрация кликнувших в БД (Task 2), добавивший→per-group админ CREATOR (Task 5/Task 1), изоляция глобальной админки (не трогаем — проверка Task 6), guard «не понижать» (Task 1), маппинг status→role (Task 4), privacy-mode fallback (Task 2 callback). Без миграций — `GroupMember.role` уже есть.
- **Placeholders:** нет — весь код приведён.
- **Type/signature consistency:** `ensureMemberRole(groupId, userId, desiredRole)`, `mapChatMemberStatusToRole(status)`, `handleOptInButton(ctx)`, `addMemberToGroup(groupId, userId)` — имена согласованы между задачами и существующим кодом.
