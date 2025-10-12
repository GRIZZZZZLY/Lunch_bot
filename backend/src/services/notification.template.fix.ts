/**
 * Исправленный шаблон POLL_ENDED для адаптивной поддержки single/multi-winner режимов
 * 
 * Использование:
 * Замените содержимое метода getMessage в шаблоне POLL_ENDED (строки 68-88)
 * в файле notification.service.ts этим кодом:
 */

export const getPollEndedMessage = (data: any, getPluralForm: (count: number, one: string, few: string, many: string) => string) => {
  let message = `🗳️ Голосование завершилось!\n\n`;
  message += `👥 Всего голосов: ${data.totalVotes}\n\n`;

  // Multi-Winner режим
  if (data.mode === 'multi-winner' && data.winners) {
    if (data.winners.length > 0) {
      message += `🍽️ *Кто что заказывает:*\n\n`;
      data.winners.forEach((winner: any, index: number) => {
        const voterCount = winner.voters?.length || winner.voterIds?.length || 0;
        const votersText = getPluralForm(voterCount, 'человек', 'человека', 'человек');
        message += `${index + 1}. *${winner.menuItemName}* — ${voterCount} ${votersText}\n`;
        
        // Показываем первых 3 участников
        if (winner.voters && winner.voters.length > 0) {
          const displayVoters = winner.voters.slice(0, 3);
          const voterNames = displayVoters.map((v: any) => v.firstName).join(', ');
          message += `   👤 ${voterNames}`;
          if (winner.voters.length > 3) {
            message += ` и ещё ${winner.voters.length - 3}`;
          }
          message += `\n`;
        }
        message += `\n`;
      });
    }

    if (data.bringOwn && data.bringOwn.count > 0) {
      const bringOwnText = getPluralForm(data.bringOwn.count, 'человек', 'человека', 'человек');
      message += `🥪 *Принесу своё:* ${data.bringOwn.count} ${bringOwnText}\n`;
      if (data.bringOwn.voters && data.bringOwn.voters.length > 0) {
        const names = data.bringOwn.voters.slice(0, 3).map((v: any) => v.firstName).join(', ');
        message += `   👤 ${names}`;
        if (data.bringOwn.voters.length > 3) {
          message += ` и ещё ${data.bringOwn.voters.length - 3}`;
        }
        message += `\n`;
      }
      message += `\n`;
    }

    if (data.skipped && data.skipped.count > 0) {
      const skippedText = getPluralForm(data.skipped.count, 'человек', 'человека', 'человек');
      message += `⏭️ *Пропустили:* ${data.skipped.count} ${skippedText}\n\n`;
    }

    message += `✅ Заказ оформлен!`;
  } 
  // Single-Winner режим
  else {
    if (data.winnerItem) {
      message += `🏆 *Победитель:* ${data.winnerItem.name}\n`;
      if (data.winnerItem.price) {
        message += `💰 Цена: ${data.winnerItem.price} руб.\n`;
      }
    }

    if (data.topItems && data.topItems.length > 0) {
      message += `\n📊 *Топ блюд:*\n`;
      data.topItems.slice(0, 3).forEach((item: any, index: number) => {
        const emoji = ['🥇', '🥈', '🥉'][index] || '•';
        message += `${emoji} ${item.item.name} - ${item.votes} ${getPluralForm(item.votes, 'голос', 'голоса', 'голосов')} (${item.percentage}%)\n`;
      });
    }

    message += `\n🎲 Сейчас запустится рулетка для выбора ответственного...`;
  }

  return message;
};
