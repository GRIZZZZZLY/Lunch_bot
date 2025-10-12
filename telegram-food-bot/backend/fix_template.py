#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для замены getMessage функции в шаблоне POLL_ENDED
"""

import re

# Читаем файл
with open('src/services/notification.service.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Новая функция getMessage
new_message_func = """      getMessage: (data: PollEndedNotificationData) => {
        let message = `🗳️ Голосование завершилось!\\n\\n`;
        message += `👥 Всего голосов: ${data.totalVotes}\\n\\n`;

        // Multi-Winner режим
        if (data.mode === 'multi-winner' && data.winners) {
          if (data.winners.length > 0) {
            message += `🍽️ *Кто что заказывает:*\\n\\n`;
            data.winners.forEach((winner, index) => {
              const voterCount = winner.voters?.length || winner.voterIds?.length || 0;
              const votersText = getPluralForm(voterCount, 'человек', 'человека', 'человек');
              message += `${index + 1}. *${winner.menuItemName}* — ${voterCount} ${votersText}\\n`;
              
              if (winner.voters && winner.voters.length > 0) {
                const displayVoters = winner.voters.slice(0, 3);
                const voterNames = displayVoters.map(v => v.firstName).join(', ');
                message += `   👤 ${voterNames}`;
                if (winner.voters.length > 3) {
                  message += ` и ещё ${winner.voters.length - 3}`;
                }
                message += `\\n`;
              }
              message += `\\n`;
            });
          }

          if (data.bringOwn && data.bringOwn.count > 0) {
            const bringOwnText = getPluralForm(data.bringOwn.count, 'человек', 'человека', 'человек');
            message += `🥪 *Принесу своё:* ${data.bringOwn.count} ${bringOwnText}\\n`;
            if (data.bringOwn.voters && data.bringOwn.voters.length > 0) {
              const names = data.bringOwn.voters.slice(0, 3).map(v => v.firstName).join(', ');
              message += `   👤 ${names}`;
              if (data.bringOwn.voters.length > 3) {
                message += ` и ещё ${data.bringOwn.voters.length - 3}`;
              }
              message += `\\n`;
            }
            message += `\\n`;
          }

          if (data.skipped && data.skipped.count > 0) {
            const skippedText = getPluralForm(data.skipped.count, 'человек', 'человека', 'человек');
            message += `⏭️ *Пропустили:* ${data.skipped.count} ${skippedText}\\n\\n`;
          }

          message += `✅ Заказ оформлен!`;
        } 
        else {
          if (data.winnerItem) {
            message += `🏆 *Победитель:* ${data.winnerItem.name}\\n`;
            if (data.winnerItem.price) {
              message += `💰 Цена: ${data.winnerItem.price} руб.\\n`;
            }
          }

          if (data.topItems && data.topItems.length > 0) {
            message += `\\n📊 *Топ блюд:*\\n`;
            data.topItems.slice(0, 3).forEach((item, index) => {
              const emoji = ['🥇', '🥈', '🥉'][index] || '•';
              message += `${emoji} ${item.item.name} - ${item.votes} ${getPluralForm(item.votes, 'голос', 'голоса', 'голосов')} (${item.percentage}%)\\n`;
            });
          }

          message += `\\n🎲 Сейчас запустится рулетка для выбора ответственного...`;
        }

        return message;
      },"""

# Паттерн для поиска старой функции getMessage в шаблоне POLL_ENDED
pattern = r'(templates\.set\(NotificationType\.POLL_ENDED, \{\s+type: NotificationType\.POLL_ENDED,\s+getTitle: [^\n]+,\s+)getMessage: \(data: PollEndedNotificationData\) => \{[^}]+?return message;\s+\},'

# Заменяем
new_content = re.sub(pattern, r'\1' + new_message_func, content, flags=re.DOTALL)

# Проверяем, была ли замена
if new_content != content:
    print("[OK] Replacement successful!")
    # Сохраняем
    with open('src/services/notification.service.ts', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("[OK] File saved!")
else:
    print("[INFO] Pattern not found - trying alternative method...")
    print("Trying alternative method...")
    
    # Альтернативный метод - ищем по номерам строк (68-88)
    lines = content.split('\n')
    if len(lines) > 88:
        # Найдем начало шаблона POLL_ENDED
        start_idx = -1
        for i, line in enumerate(lines):
            if 'templates.set(NotificationType.POLL_ENDED' in line:
                start_idx = i
                break
        
        if start_idx != -1:
            # Найдем getMessage
            for i in range(start_idx, min(start_idx + 30, len(lines))):
                if 'getMessage: (data: PollEndedNotificationData)' in lines[i]:
                    # Найдем закрывающую скобку
                    bracket_count = 0
                    end_idx = -1
                    for j in range(i, min(i + 30, len(lines))):
                        bracket_count += lines[j].count('{') - lines[j].count('}')
                        if 'return message;' in lines[j] and bracket_count == 0:
                            end_idx = j + 1
                            break
                    
                    if end_idx != -1:
                        # Заменяем строки
                        new_lines = lines[:i] + new_message_func.split('\n') + lines[end_idx:]
                        new_content = '\n'.join(new_lines)
                        
                        with open('src/services/notification.service.ts', 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        print("[OK] Replacement done via alternative method!")
                        break

print("Done!")
