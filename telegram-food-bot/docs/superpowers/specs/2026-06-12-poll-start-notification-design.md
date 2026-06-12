# Уведомление о старте голосования в группе — упрощение + кнопка

**Дата:** 2026-06-12
**Статус:** одобрено

## Проблема

1. Опросы по расписанию (recurring) шлют в группу «компактное» сообщение с деталями
   (блюда/осталось/проголосовало) и **пустой клавиатурой** — `createCompactPollKeyboard`
   возвращает `inline_keyboard: []` для всех статусов. Кнопки «Проголосовать» нет.
2. Ручные опросы из Mini App шлют другой, многословный текст. Два пути — два формата.
3. Пользователь хочет минимальное уведомление: факт запуска + дедлайн.

## Решение

Единый билдер старта + Direct Link кнопка для обоих путей.

### Текст (вариант «Минимум + дедлайн»)

```
🗳️ Голосование за обед запущено!

⏰ До 12:30
```

Кастомный title (если есть и не дефолтный): `🗳️ <title> — голосование запущено!`.
Время — Europe/Moscow, HH:MM.

### Изменения

| Файл | Что |
|---|---|
| `backend/src/bot/keyboards/poll.keyboard.ts` | новый `createPollStartedMessage(endTime, title?)`; `createCompactPollKeyboard('active')` возвращает Direct Link «🗳️ Проголосовать» вместо `[]` |
| `backend/src/services/poll.service.extensions.ts` | `createPollNotificationMessage` → удалить, использовать новый билдер; клавиатура без изменений (`createVoteWebAppKeyboard`) |
| `backend/src/services/recurring-poll.service.ts` | compact message/keyboard → новый билдер + `createVoteWebAppKeyboard(poll.id)` |

### Не трогаем

- Сообщение результатов при завершении (edit как сейчас).
- Напоминания «осталось N минут» (poll-reminder.service, отдельные сообщения).
- Legacy-интервал live-обновления в `/startpoll` (у webapp/recurring путей live-обновлений нет).

### Кнопка

`createVoteWebAppKeyboard(pollId)` → url `https://t.me/<bot>/<app>?startapp=vote_<pollId>`
(web_app-кнопки в группах запрещены Telegram, Direct Link работает).
