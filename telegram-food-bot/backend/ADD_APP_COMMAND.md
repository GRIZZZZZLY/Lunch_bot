# Добавление команды /app в bot.ts

## Файл уже создан: `src/bot/commands/app.ts` ✅

## Нужно добавить регистрацию команды в `src/bot/bot.ts`

### Шаг 1: Добавьте импорт

Найдите строки (примерно строка 25-28):
```typescript
// Commands
import { startCommand } from './commands/start';
import { helpCommand } from './commands/help';
import { menuCommand } from './commands/menu';
import { startPollCommand } from './commands/startpoll';
```

Добавьте после `menuCommand`:
```typescript
// Commands
import { startCommand } from './commands/start';
import { helpCommand } from './commands/help';
import { menuCommand } from './commands/menu';
import { appCommand } from './commands/app';  // <-- ДОБАВЬТЕ ЭТУ СТРОКУ
import { startPollCommand } from './commands/startpoll';
```

### Шаг 2: Зарегистрируйте команду

Найдите строки (примерно строка 68-71):
```typescript
  // Команды
  bot.command('start', startCommand);
  bot.command('help', helpCommand);
  bot.command('menu', menuCommand);
  bot.command('startpoll', groupOnlyMiddleware, adminMiddleware(), startPollCommand);
```

Добавьте после `menu`:
```typescript
  // Команды
  bot.command('start', startCommand);
  bot.command('help', helpCommand);
  bot.command('menu', menuCommand);
  bot.command('app', appCommand);  // <-- ДОБАВЬТЕ ЭТУ СТРОКУ
  bot.command('startpoll', groupOnlyMiddleware, adminMiddleware(), startPollCommand);
```

### Шаг 3: Перезапустите backend

```bash
cd backend
npm run dev
```

## Готово!

Теперь команда `/app` будет работать в боте.
