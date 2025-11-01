# Исправление отображения групп

## Проблема
После добавления бота в группу, группа не отображалась в списке доступных групп для запуска голосования.

## Причина
Эндпоинт `GET /api/user/groups` возвращал только те группы, где пользователь уже создавал голосования:

```typescript
// ❌ Старая логика
const groups = await prisma.group.findMany({
  where: {
    isActive: true,
    polls: {
      some: {
        createdBy: user.id, // Требовало наличие poll от пользователя
      },
    },
  },
  ...
});
```

## Решение (Вариант 1 - упрощенная версия)

### 1. Изменен эндпоинт `GET /api/user/groups`
Теперь возвращает **ВСЕ активные группы**, где есть бот:

```typescript
// ✅ Новая логика
const groups = await prisma.group.findMany({
  where: {
    isActive: true, // Только условие активности
  },
  orderBy: { createdAt: 'desc' },
});
```

**Файл:** `backend/src/api/controllers/user.controller.ts`

### 2. Добавлена проверка прав администратора в `/startpoll`
Проверка прав происходит непосредственно при попытке запустить голосование:

```typescript
// ✅ Проверка прав через Telegram API
const chatMember = await ctx.api.getChatMember(chat.id, user.id);
const isAdmin = chatMember.status === 'creator' || chatMember.status === 'administrator';

if (!isAdmin) {
  await ctx.reply(
    '⚠️ Только администраторы группы могут запускать голосования.\n\n' +
    'Если вы должны быть администратором, попросите создателя группы назначить вас.'
  );
  return;
}
```

**Файл:** `backend/src/bot/commands/startpoll.ts` (уже было реализовано ранее)

## Преимущества решения

✅ **Простота:** Минимальные изменения кода  
✅ **Прозрачность:** Пользователь сразу видит все группы  
✅ **Безопасность:** Проверка прав при создании голосования  
✅ **UX:** Понятное сообщение об ошибке для неадминов  

## Как работает теперь

1. **Добавление бота в группу:**
   - Событие `my_chat_member` → `GroupService.upsertGroup()`
   - Группа сохраняется в БД с `isActive: true`

2. **Отображение в UI:**
   - `GET /api/user/groups` → возвращает все активные группы
   - Пользователь видит группу сразу после добавления бота

3. **Создание голосования:**
   - `/startpoll` → проверка `getChatMember()` через Telegram API
   - Если не админ → понятная ошибка
   - Если админ → голосование создается

## Дополнительные улучшения (опционально)

### Вариант А: Добавить флаг `isAdmin` в ответ API
```typescript
// В user.controller.ts
const groupsWithAdminStatus = await Promise.all(
  groups.map(async (group) => {
    const isAdmin = await checkIfUserIsAdmin(group.telegramId, user.telegramId);
    return { ...group, isAdmin };
  })
);
```

### Вариант Б: Добавить таблицу `GroupMember`
```prisma
model GroupMember {
  id         Int      @id @default(autoincrement())
  groupId    Int
  userId     Int
  role       String   @default("member")
  joinedAt   DateTime @default(now())
  
  group      Group    @relation(fields: [groupId], references: [id])
  user       User     @relation(fields: [userId], references: [id])
  
  @@unique([groupId, userId])
}
```

## Тестирование

1. Добавьте бота в новую группу
2. Откройте Mini App
3. Проверьте что группа отображается в списке
4. Попробуйте запустить голосование:
   - Если вы админ → голосование должно запуститься
   - Если вы не админ → должно быть сообщение об ошибке

## Измененные файлы

- `backend/src/api/controllers/user.controller.ts` - изменена логика `getUserGroups()`
- `backend/src/bot/commands/startpoll.ts` - добавлена проверка прав (было ранее)

## Дата изменений
2025-10-31
