/**
 * Multi-Winner Voting: Usage Examples
 * 
 * Этот файл содержит готовые примеры использования Multi-Winner API
 * в различных сценариях.
 */

import { pollsService } from '@/services/polls.service';
import type { MultiWinnerResultData } from '@/services/polls.service';

// ============================================
// Example 1: Базовое завершение poll
// ============================================

export async function example1_BasicCompletion() {
  const pollId = 123;

  try {
    const response = await pollsService.completePollMultiWinner(pollId, {
      minVotes: 1,
      maxWinners: null,
      tieBreakMethod: 'earliest',
    });

    if (response.success) {
      console.log('Poll completed successfully!');
      console.log('Winners:', response.data.resultData.winners.length);
      console.log('Bring Own:', response.data.resultData.bringOwn.count);
    }
  } catch (error) {
    console.error('Failed to complete poll:', error);
  }
}

// ============================================
// Example 2: Завершение с фильтрацией minVotes
// ============================================

export async function example2_MinVotesFilter() {
  const pollId = 456;

  // Только блюда с >= 2 голосами попадут в winners
  const response = await pollsService.completePollMultiWinner(pollId, {
    minVotes: 2,
    maxWinners: null,
    tieBreakMethod: 'earliest',
  });

  if (response.success) {
    const { winners } = response.data.resultData;
    console.log(`Блюд с >= 2 голосами: ${winners.length}`);

    winners.forEach((winner) => {
      console.log(`${winner.menuItemName}: ${winner.voteCount} голосов`);
    });
  }
}

// ============================================
// Example 3: Ограничение топ-N победителей
// ============================================

export async function example3_TopNWinners() {
  const pollId = 789;

  // Показываем только топ-5 блюд
  const response = await pollsService.completePollMultiWinner(pollId, {
    minVotes: 1,
    maxWinners: 5,
    tieBreakMethod: 'earliest',
  });

  if (response.success) {
    const { winners } = response.data.resultData;
    console.log('Топ-5 блюд:');

    winners.forEach((winner, index) => {
      const medal = index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🍴';
      console.log(`${medal} ${winner.menuItemName} — ${winner.voteCount} голосов`);
    });
  }
}

// ============================================
// Example 4: Обработка tie-break
// ============================================

export async function example4_HandleTieBreak() {
  const pollId = 101;

  const response = await pollsService.completePollMultiWinner(pollId, {
    minVotes: 1,
    maxWinners: null,
    tieBreakMethod: 'alphabetical', // Тай-брейк по алфавиту
  });

  if (response.success) {
    const { winners, meta } = response.data.resultData;

    if (meta.tieBreak) {
      console.log('⚠️ Tie-break applied!');
      console.log(`Reason: ${meta.tieBreak.reason}`);
      console.log(`Method: ${meta.tieBreak.method}`);
      console.log(`Applied to items: ${meta.tieBreak.appliedTo.join(', ')}`);
    }

    console.log(`Primary winner: ${winners[0]?.menuItemName}`);
  }
}

// ============================================
// Example 5: Форматирование для отображения
// ============================================

export function example5_FormatResults(resultData: MultiWinnerResultData): string {
  let text = '🍽 Результаты голосования:\n\n';

  // Winners
  resultData.winners.forEach((winner, index) => {
    const emoji = index === 0 ? '🏆' : '🍴';
    const plural = getPluralForm(winner.voteCount);

    text += `${emoji} ${winner.menuItemName} — ${winner.voteCount} ${plural}\n`;
    text += `   👤 ${winner.voters.map((v) => v.firstName).join(', ')}\n\n`;
  });

  // Bring Own
  if (resultData.bringOwn.count > 0) {
    const plural = getPluralForm(resultData.bringOwn.count);
    text += `🏠 Принесу своё — ${resultData.bringOwn.count} ${plural}\n`;
    text += `   ${resultData.bringOwn.voters.map((v) => v.firstName).join(', ')}\n\n`;
  }

  // Skipped
  if (resultData.skipped.count > 0) {
    const plural = getPluralForm(resultData.skipped.count);
    text += `🚫 Пропускаю — ${resultData.skipped.count} ${plural}\n\n`;
  }

  // Footer
  const completedAt = new Date(resultData.meta.completedAt).toLocaleString('ru-RU');
  text += `⏱ Завершено: ${completedAt}`;

  return text;
}

function getPluralForm(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'человек';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return 'человека';
  }
  return 'человек';
}

// ============================================
// Example 6: Копирование в буфер обмена
// ============================================

export async function example6_CopyToClipboard(resultData: MultiWinnerResultData) {
  let text = '🍽 Заказ:\n\n';

  resultData.winners.forEach((w) => {
    text += `${w.menuItemName} — ${w.voteCount} шт.\n`;
    text += `  ${w.voters.map((v) => v.firstName).join(', ')}\n\n`;
  });

  if (resultData.bringOwn.count > 0) {
    text += `🏠 Своё: ${resultData.bringOwn.voters.map((v) => v.firstName).join(', ')}\n`;
  }

  try {
    await navigator.clipboard.writeText(text);
    console.log('✅ Copied to clipboard!');
  } catch (error) {
    console.error('Failed to copy:', error);
  }
}

// ============================================
// Example 7: React Component Integration
// ============================================

import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';

export function Example7_ReactComponent({ pollId }: { pollId: number }) {
  // Fetch result
  const { data: pollResult, refetch } = useQuery({
    queryKey: ['pollResult', pollId],
    queryFn: () => pollsService.getPollResult(pollId),
  });

  // Complete mutation
  const { mutate: completePoll, isPending } = useMutation({
    mutationFn: () =>
      pollsService.completePollMultiWinner(pollId, {
        minVotes: 1,
        maxWinners: null,
        tieBreakMethod: 'earliest',
      }),
    onSuccess: () => {
      refetch();
    },
  });

  if (!pollResult) return <div>Loading...</div>;

  // Parse result
  const resultData: MultiWinnerResultData = JSON.parse(
    pollResult.rouletteData || '{}'
  );

  if (resultData.mode !== 'multi-winner') {
    return <div>Not multi-winner result</div>;
  }

  return (
    <div>
      <h2>📊 Результаты</h2>

      {/* Winners */}
      {resultData.winners.map((winner) => (
        <div key={winner.menuItemId}>
          <h3>{winner.menuItemName}</h3>
          <p>{winner.voteCount} человек</p>
          <ul>
            {winner.voters.map((voter) => (
              <li key={voter.userId}>{voter.firstName}</li>
            ))}
          </ul>
        </div>
      ))}

      {/* Complete Button */}
      <button onClick={() => completePoll()} disabled={isPending}>
        {isPending ? 'Завершение...' : 'Завершить голосование'}
      </button>
    </div>
  );
}

// ============================================
// Example 8: Error Handling
// ============================================

export async function example8_ErrorHandling(pollId: number) {
  try {
    const response = await pollsService.completePollMultiWinner(pollId);

    if (!response.success) {
      // API вернул ошибку
      switch (response.error?.code) {
        case 'FORBIDDEN':
          console.error('❌ Только админы могут завершать голосования');
          break;
        case 'NOT_FOUND':
          console.error('❌ Голосование не найдено');
          break;
        case 'ALREADY_COMPLETED':
          console.log('ℹ️ Голосование уже завершено (идемпотентность)');
          // Можно использовать существующий результат
          break;
        case 'FEATURE_DISABLED':
          console.error('⚠️ Multi-Winner временно отключен');
          break;
        default:
          console.error('❌ Неизвестная ошибка:', response.error);
      }
      return null;
    }

    return response.data;
  } catch (error) {
    // Network/Transport ошибка
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('🌐 Network error. Check your connection.');
    } else {
      console.error('💥 Unexpected error:', error);
    }
    return null;
  }
}

// ============================================
// Example 9: Backend Integration (Node.js)
// ============================================

/**
 * Пример использования на backend (например, в CLI скрипте)
 */
export async function example9_BackendUsage() {
  // Импорты для backend
  // import { PollService } from './services/poll.service';

  const pollId = 123;
  const adminUserId = 1;

  try {
    const result = await PollService.completePollMultiWinner(pollId, adminUserId, {
      minVotes: 1,
      maxWinners: null,
      tieBreakMethod: 'earliest',
    });

    console.log('✅ Poll completed:', result.id);

    // Parse result data
    const resultData = JSON.parse(result.rouletteData!);

    console.log(`Winners: ${resultData.winners.length}`);
    console.log(`Bring Own: ${resultData.bringOwn.count}`);
    console.log(`Skipped: ${resultData.skipped.count}`);

    // Отправляем уведомление в Telegram
    await sendTelegramNotification(pollId, resultData);
  } catch (error) {
    console.error('Failed to complete poll:', error);
    throw error;
  }
}

async function sendTelegramNotification(
  pollId: number,
  resultData: MultiWinnerResultData
) {
  // См. пример в backend/src/bot/handlers/poll.handlers.ts
  console.log('Sending Telegram notification...');
}

// ============================================
// Example 10: Testing with Mock Data
// ============================================

export function example10_MockData(): MultiWinnerResultData {
  return {
    version: 1,
    mode: 'multi-winner',
    winners: [
      {
        menuItemId: 1,
        menuItemName: 'Борщ',
        menuItemSnapshot: { price: 250, category: 'первые блюда' },
        voterIds: [101, 102, 103],
        voters: [
          { userId: 101, firstName: 'Иван', lastName: 'Иванов' },
          { userId: 102, firstName: 'Мария' },
          { userId: 103, firstName: 'Петр' },
        ],
        voteCount: 3,
        votedAt: [
          '2025-01-10T11:00:00Z',
          '2025-01-10T11:05:00Z',
          '2025-01-10T11:10:00Z',
        ],
      },
      {
        menuItemId: 2,
        menuItemName: 'Плов',
        menuItemSnapshot: { price: 300 },
        voterIds: [104, 105],
        voters: [
          { userId: 104, firstName: 'Алексей' },
          { userId: 105, firstName: 'Дмитрий' },
        ],
        voteCount: 2,
        votedAt: ['2025-01-10T11:15:00Z', '2025-01-10T11:20:00Z'],
      },
    ],
    bringOwn: {
      voterIds: [106],
      voters: [{ userId: 106, firstName: 'Анна' }],
      count: 1,
    },
    skipped: {
      voterIds: [],
      voters: [],
      count: 0,
    },
    meta: {
      primaryWinnerId: 1,
      tieBreak: null,
      completedAt: '2025-01-10T12:00:00Z',
      completedBy: 1,
      params: {
        minVotes: 1,
        maxWinners: null,
      },
    },
  };
}

// Использование mock data для тестирования UI
const mockData = example10_MockData();
console.log(example5_FormatResults(mockData));
