/**
 * Доменные сбои подачи и снятия голоса как типы.
 *
 * Причин отказать в голосе много (голосование закрыто, истекло, блюдо не из
 * этого голосования, человек не в списке ожидаемых), а ответ у них один и тот
 * же — 400 с кодом `POLL_ERROR`; различает их текст. Так контроллер и отвечал,
 * перебирая список сообщений в `catch`; теперь это один класс.
 *
 * Сообщения сохранены дословно: `vote.controller.ts` и обработчики бота
 * сверяются с `error.message`.
 */
import { BaseError } from '../utils/error';

/** Голос не принят: состояние голосования или выбор этого не позволяют. */
export class VotingError extends BaseError {
  constructor(message: string) {
    super(message, 400, 'POLL_ERROR');
  }
}

/** Голосование с одиночным выбором, а пришло несколько блюд. */
export class SingleSelectionOnlyError extends BaseError {
  constructor(message = 'This poll allows only single selection') {
    super(message, 400, 'SINGLE_SELECTION_ONLY');
  }
}

/** Блюд выбрано больше, чем разрешает голосование. */
export class MaxSelectionsExceededError extends BaseError {
  constructor(maxSelections: number) {
    super(`Maximum ${maxSelections} selections allowed`, 400, 'MAX_SELECTIONS_EXCEEDED');
  }
}

/** Снимать нечего — голоса этого человека в голосовании нет. */
export class VoteNotFoundError extends BaseError {
  constructor(message = 'Vote not found') {
    super(message, 404, 'VOTE_NOT_FOUND');
  }
}
