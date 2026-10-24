/**
 * Отказы операций над долгами как типы.
 *
 * Сервисы бросали голый `Error`, а контроллеры на любой `Error` отвечали 500:
 * чужой долг или попытка изменить закрытый выглядели для клиента поломкой
 * сервера. Статус и код несёт класс, `error-handler` отдаёт их как есть.
 * Коды взяты из `api/error-codes.ts`, текст на фронте у них уже есть.
 */
import { BaseError } from '../utils/error';

/** Долга нет — или он не из этой группы, что для клиента одно и то же. */
export class DebtNotFoundError extends BaseError {
  constructor(message = 'Debt not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * Переход запрещён состоянием долга: он уже закрыт (подтверждён, списан) или
 * сменился, пока шёл запрос. 409, а не 400: запрос корректен, мешает состояние.
 * Код тот же, что у отмены подтверждения. Сообщения прежние — на них смотрят
 * журналы и тесты сервиса.
 */
export class DebtStateError extends BaseError {
  constructor(message: string) {
    super(message, 409, 'WRONG_STATUS');
  }
}
