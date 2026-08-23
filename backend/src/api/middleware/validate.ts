/**
 * Валидация входа запроса: тело, path-параметры, query.
 *
 * Почему не переиспользован `validation.ts`
 * ----------------------------------------
 * Тот файл написан и покрыт тестами, но его контракт мёртв в обе стороны, и
 * наследовать его было нельзя:
 *
 * - `validateWithSchema` валидирует ТОЛЬКО `req.body`; ни `params`, ни `query`
 *   он не трогает;
 * - `validateIdParam` кладёт число в `(req as any).validatedId`, и читателей у
 *   этого поля нет ни одного. Слот при этом ОДИН на запрос: на маршруте с двумя
 *   id-параметрами второй вызов молча перетирал бы первый, и ошибка вылезла бы
 *   не 400-м, а неверным объектом;
 * - для `query` готового примитива не было вовсе.
 *
 * Решение, принятое один раз на весь проект
 * -----------------------------------------
 * Схема и способ прочитать разобранное значение — ОДИН объект (`Contract`).
 * Маршрут подключает `contract.middleware`, контроллер читает
 * `contract.get(req)`. Рассинхронизация «в роутере одна схема, в контроллере
 * другая» физически невозможна: это одна и та же ссылка.
 *
 * `get()` разбирает вход сам, если middleware не отработал, и запоминает
 * результат. Это не «страховка на всякий случай», а следствие того, что
 * разбор — одна функция: ответ на невалидный вход одинаков (400 и тот же код)
 * независимо от того, кто первым его вызвал. Практический смысл — 400+ тестов
 * контроллеров продолжают вызывать handler напрямую с `params: { id: '1' }`.
 * Гарантию, что в проде вход отсекается ДО контроллера (и до middleware
 * авторизации, которые сами читают params), даёт не этот запасной путь, а тест
 * `routes/param-validation.test.ts`: он обходит стек каждого роутера и требует
 * контракт на каждом маршруте с `:параметром`.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

import type { ApiErrorCode } from '../error-codes';
import { BaseError } from '../../utils/error';
import { respondProblem } from '../../utils/problem';

/** Одна проблема одного поля — форма, которую уже отдаёт `validation.ts`. */
export interface FieldIssue {
  field: string;
  message: string;
  code: string;
}

/**
 * 400, а не 422: контроллеры отдавали за плохой параметр именно 400, и фронт
 * различает эти ответы. `ValidationError` из `utils/error.ts` не подошёл — он
 * жёстко зашит на 422 и на код `VALIDATION_ERROR`, а нам нужны `INVALID_POLL_ID`
 * и его родня, у которых на фронте есть свой текст.
 */
export class RequestValidationError extends BaseError {
  public readonly issues: FieldIssue[];

  constructor(issues: FieldIssue[], code: ApiErrorCode, detail: string) {
    super(detail, 400, code);
    this.issues = issues;
  }
}

/**
 * Код ошибки контракта.
 *
 * Одного кода на контракт не хватает, и это не теоретическое замечание:
 * `GET /api/polls/popular-items` до сих отдавал `INVALID_LIMIT` за плохой
 * `limit` и `MISSING_GROUP_ID` за отсутствующий `groupId`, а на фронте у этих
 * кодов РАЗНЫЕ тексты для пользователя. Свернуть их в один `VALIDATION_ERROR`
 * значило бы заменить «Укажите группу» на «Проверьте заполненные поля».
 */
export type ContractCode =
  | ApiErrorCode
  | { default: ApiErrorCode; byField: Partial<Record<string, ApiErrorCode>> };

function resolveCode(code: ContractCode, issues: FieldIssue[]): ApiErrorCode {
  if (typeof code === 'string') return code;
  for (const issue of issues) {
    const mapped = code.byField[issue.field];
    if (mapped) return mapped;
  }
  return code.default;
}

/**
 * Ответить 400, если ошибка — провал разбора входа; иначе не трогать её.
 *
 * Нужен в КАЖДОМ `catch` контроллера, который читает контракт, и это не
 * перестраховка. Разбор вызывается первой строкой внутри `try`; без этой
 * проверки его исключение попадало бы в общий обработчик и превращалось в
 * `500 INTERNAL_ERROR` вместо 400 — ровно та подмена статуса, которую задача
 * закрывает. Проверено: 42 теста контроллера голосований показали 500 там, где
 * ожидали 400, как только валидация переехала из тела handler'а.
 */
export function respondIfInvalidInput(
  req: Request,
  res: Response,
  error: unknown,
): boolean {
  if (!(error instanceof RequestValidationError)) return false;

  respondProblem(res, req, {
    status: 400,
    code: error.code as ApiErrorCode,
    title: 'Validation failed',
    detail: error.message,
    extensions: { errors: error.issues },
  });
  return true;
}

type Source = 'body' | 'params' | 'query';

interface Slot {
  schema: z.ZodTypeAny;
  data: unknown;
}

declare module 'express-serve-static-core' {
  interface Request {
    /**
     * Разобранный вход, по одному слоту на источник. Слот помнит СХЕМУ, которой
     * разобран: если на маршруте по ошибке окажутся два разных контракта на один
     * источник, второй не получит чужие данные под своим типом — он разберёт
     * вход заново.
     */
    validated?: Partial<Record<Source, Slot>>;
  }
}

export interface Contract<S extends z.ZodTypeAny> {
  readonly schema: S;
  readonly source: Source;
  readonly code: ContractCode;
  /** Подключается в цепочку роутера — отвечает 400 до контроллера. */
  readonly middleware: ContractMiddleware;
  /** Читается в контроллере — возвращает типизированное значение. */
  get(req: Request): z.infer<S>;
}

/**
 * Middleware несёт ссылку на свой контракт.
 *
 * Не для удобства: тест `routes/param-validation.test.ts` обходит `router.stack`
 * и до этого мог проверять только ИМЕНА слоёв. Проверить, что схема отвергает
 * мусор в конкретном поле, он не мог — и именно поэтому пропустил два дефекта,
 * которые нашло ревью (повторяющийся `groupId` в query и обязательные поля там,
 * где фронт присылает одно). Через эту ссылку тест доходит до схемы и генерирует
 * мусор по её же полям.
 */
export type ContractMiddleware = RequestHandler & {
  contract: Pick<Contract<z.ZodTypeAny>, 'schema' | 'source' | 'code'>;
};

/**
 * Повторяющийся параметр query с ОДИНАКОВЫМ значением сводится к одному.
 *
 * `?groupId=5&groupId=5` — не выдумка: `frontend-new/src/services/api.service.ts`
 * в `buildUrl` подмешивает `groupId` из стора, а `admin.service.ts` и
 * `suggestions.service.ts` уже встроили его в сам путь. `qs` отдаёт `['5','5']`,
 * `z.coerce.number()` даёт NaN — и восемь работавших админских эндпоинтов начали
 * бы отвечать 400. Раньше это проходило случайно: `parseInt(['5','5'])`
 * приводит массив к строке `'5,5'` и возвращает 5.
 *
 * РАЗНЫЕ значения (`?groupId=5&groupId=7`) не сводятся: выбрать одно из них
 * молча — это ровно та подмена, против которой задача и заведена. Такой запрос
 * дойдёт до схемы и получит 400.
 */
export function collapseRepeatedValue(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const unique = Array.from(new Set(value.map(item => String(item))));
  return unique.length === 1 ? unique[0] : value;
}

function collapseRepeatedQueryValues(raw: unknown): unknown {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return raw;

  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const collapsed = collapseRepeatedValue(value);
    if (collapsed !== value) changed = true;
    out[key] = collapsed;
  }

  return changed ? out : raw;
}

function toIssues(error: z.ZodError): FieldIssue[] {
  return error.errors.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

function describe(source: Source, issues: FieldIssue[]): string {
  const where = source === 'body' ? 'body' : source === 'params' ? 'path' : 'query';
  return `Invalid request ${where}: ${issues
    .map(issue => (issue.field ? `${issue.field} — ${issue.message}` : issue.message))
    .join('; ')}`;
}

function makeContract<S extends z.ZodTypeAny>(
  source: Source,
  schema: S,
  code: ContractCode,
): Contract<S> {
  function parse(req: Request): z.infer<S> {
    const store = (req.validated ??= {});
    const slot = store[source];
    if (slot && slot.schema === schema) {
      return slot.data;
    }

    const raw =
      source === 'body'
        ? req.body
        : source === 'params'
          ? req.params
          : collapseRepeatedQueryValues(req.query);
    const result = schema.safeParse(raw);

    if (!result.success) {
      const issues = toIssues(result.error);
      throw new RequestValidationError(
        issues,
        resolveCode(code, issues),
        describe(source, issues),
      );
    }

    /* Тело — единственный источник, который перезаписывается: контроллеры
       читают `req.body.x` напрямую в десятках мест, и им нужны приведённые
       значения. `params` и `query` остаются строками намеренно — их тип в
       Express (`Record<string, string>` / `ParsedQs`) не даёт положить туда
       число, а тихое приведение через `as any` — ровно то, от чего уходим. */
    if (source === 'body') {
      req.body = result.data;
    }

    store[source] = { schema, data: result.data };
    return result.data;
  }

  function respond(req: Request, res: Response, next: NextFunction): void {
    try {
      parse(req);
      next();
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      next(error);
    }
  }

  /* Имена нужны не для красоты: тесты, которые обходят `router.stack`, читают
     цепочку по `handle.name`. Анонимная стрелка сделала бы такой тест слепым. */
  const handler: RequestHandler =
    source === 'body'
      ? function validateBody(req, res, next) {
          respond(req, res, next);
        }
      : source === 'params'
        ? function validateParams(req, res, next) {
            respond(req, res, next);
          }
        : function validateQuery(req, res, next) {
            respond(req, res, next);
          };

  const middleware = Object.assign(handler, {
    contract: { schema, source, code },
  }) as ContractMiddleware;

  return { schema, source, code, middleware, get: parse };
}

export function bodyContract<S extends z.ZodTypeAny>(
  schema: S,
  code: ContractCode = 'VALIDATION_ERROR',
): Contract<S> {
  return makeContract('body', schema, code);
}

export function paramsContract<S extends z.ZodTypeAny>(
  schema: S,
  code: ContractCode = 'INVALID_ID',
): Contract<S> {
  return makeContract('params', schema, code);
}

export function queryContract<S extends z.ZodTypeAny>(
  schema: S,
  code: ContractCode = 'VALIDATION_ERROR',
): Contract<S> {
  return makeContract('query', schema, code);
}
