/**
 * Доменные сбои голосования как типы.
 *
 * До этого сервис бросал `new Error('Poll not found')`, а статус выбирал
 * контроллер, сравнивая сообщение со списком литералов. Договор держался на том,
 * что обе стороны повторяют одну строку: стоило сервису переписать текст — и
 * осмысленный 404 становился 500, причём молча. Теперь статус и код несёт сам
 * класс, а `error-handler` отдаёт их клиенту (`BaseError` он распознаёт).
 *
 * Сообщения оставлены ДОСЛОВНО прежними: на них опираются существующие тесты
 * сервисов и обработчики бота, которые сверяются с `error.message`. Типизация —
 * добавление, а не смена контракта.
 *
 * Коды взяты из `api/error-codes.ts` и уже имеют текст на фронте. Новых кодов
 * здесь нет намеренно: сведение синонимов (`NOT_FOUND` vs `POLL_NOT_FOUND`) —
 * отдельное решение вместе с фронтом, см. задачу 03.
 */
import { BaseError } from '../utils/error';

/** Голосования нет. */
export class PollNotFoundError extends BaseError {
  constructor(message = 'Poll not found') {
    super(message, 404, 'POLL_NOT_FOUND');
  }
}

/** Голосование уже завершено — повторное завершение бессмысленно. */
export class PollAlreadyCompletedError extends BaseError {
  constructor(message = 'Poll is already completed') {
    super(message, 400, 'POLL_ALREADY_COMPLETED');
  }
}

/** Голосование не активно: голосовать или завершать нечего. */
export class PollNotActiveError extends BaseError {
  constructor(message = 'Poll is not active') {
    super(message, 400, 'NOT_ACTIVE');
  }
}

/**
 * Состояние голосования не позволяет операцию — конфликт, а не ошибка ввода.
 *
 * 409 здесь не выдумка: контроллер уже отдавал его за «отменить можно только
 * активное голосование». Тот же смысл был у «Poll is already cancelled» при
 * попытке завершить отменённое, но там сравнение строк не совпадало и клиент
 * получал 500.
 */
export class PollStateError extends BaseError {
  constructor(message: string) {
    super(message, 409, 'INVALID_POLL_STATE');
  }
}

/** Рулетку не запустить: за голосование никто не голосовал. */
export class NoVotersError extends BaseError {
  constructor(message = 'No voters found') {
    super(message, 400, 'NO_VOTERS');
  }
}
