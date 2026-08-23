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

/**
 * В группе уже идёт голосование.
 *
 * Класс жил в `poll.service.ts` и наследовал `Error`, поэтому статус ему
 * выбирал контроллер (два одинаковых блока `catch`). Теперь 400 и код несёт он
 * сам; `groupId` и `existingPollId` остаются полями — на них смотрят логи.
 */
export class PollAlreadyActiveError extends BaseError {
  constructor(
    public readonly groupId: number,
    public readonly existingPollId: number
  ) {
    super(
      `Group ${groupId} already has an active poll (#${existingPollId})`,
      400,
      'POLL_ALREADY_ACTIVE'
    );
  }
}

/**
 * Группы, для которой создают голосование, нет.
 *
 * Имя с приставкой `Poll` намеренно: в `utils/error.ts` живёт другой
 * `GroupNotFoundError` — ошибка бота с 400 и своим текстом для чата. Здесь
 * речь про HTTP-ответ 404, и два разных класса с одним именем в одном проекте
 * — верный способ однажды импортировать не тот.
 */
export class PollGroupNotFoundError extends BaseError {
  constructor(message = 'Group not found') {
    super(message, 404, 'GROUP_NOT_FOUND');
  }
}

/** Повторить голосование нечем: в группе нет активных блюд. */
export class NoMenuItemsError extends BaseError {
  constructor(message = 'No menu items available') {
    super(message, 400, 'NO_MENU_ITEMS');
  }
}

/** Голосование из одного блюда — не голосование; нужно минимум два. */
export class NotEnoughMenuItemsError extends BaseError {
  constructor(message = 'At least 2 active menu items required') {
    super(message, 400, 'NOT_ENOUGH_ITEMS');
  }
}

/** Рулетку не запустить: за голосование никто не голосовал. */
export class NoVotersError extends BaseError {
  constructor(message = 'No voters found') {
    super(message, 400, 'NO_VOTERS');
  }
}
