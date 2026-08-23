/**
 * Словарь кодов ошибок как проверяемый контракт.
 *
 * Код ошибки — это не строка для логов, а часть контракта: фронт по нему
 * выбирает текст для пользователя. Здесь проверяется то, что нельзя увидеть
 * ни типами, ни обычными тестами:
 *
 * 1. Каждый код, который отдаёт backend, есть в union `ApiErrorCode`. Иначе
 *    опечатка в литерале проходит молча.
 * 2. Каждый код из union имеет текст во `frontend-new/src/lib/apiError.ts`.
 *    Без этого пользователь вместо причины видит запасную формулировку
 *    вызывающего кода — так было с 39 кодами из 80.
 * 3. Снятые синонимы не вернулись обратно.
 *
 * Тест читает ИСХОДНИКИ, а не импортирует фронтовый модуль: backend и frontend
 * — разные пакеты со своими tsconfig, и импорт через границу превратил бы
 * дешёвую проверку в проблему сборки.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

import {
  API_ERROR_CODES,
  RETIRED_CODE_ALIASES,
  isApiErrorCode,
} from '../../../api/error-codes';

const BACKEND_SRC = join(__dirname, '..', '..', '..');
const FRONTEND_DICTIONARY = join(
  BACKEND_SRC,
  '..',
  '..',
  'frontend-new',
  'src',
  'lib',
  'apiError.ts'
);

/** Все литералы `code: 'X'` в продакшен-коде backend. */
function backendCodeLiterals(): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'node_modules') {
          walk(full);
        }
        continue;
      }
      if (extname(entry.name) !== '.ts' || entry.name.endsWith('.test.ts')) {
        continue;
      }
      const text = readFileSync(full, 'utf8');
      for (const match of text.matchAll(/code:\s*'([A-Z0-9_]+)'/g)) {
        const code = match[1];
        if (!found.has(code)) found.set(code, new Set());
        found.get(code)!.add(entry.name);
      }
    }
  };

  walk(BACKEND_SRC);
  return found;
}

/** Ключи объекта BY_CODE во фронтовом словаре текстов. */
function frontendCodes(): Set<string> {
  const text = readFileSync(FRONTEND_DICTIONARY, 'utf8');
  const start = text.indexOf('const BY_CODE');
  expect(start).toBeGreaterThan(-1);
  const end = text.indexOf('};', start);
  const block = text.slice(start, end);
  return new Set([...block.matchAll(/^\s*([A-Z0-9_]+):/gm)].map(m => m[1]));
}

/**
 * Коды, зашитые в конструкторы классов `utils/error.ts`.
 *
 * Их не находит поиск по `code: 'X'`, а наружу они выходят: `error-handler`
 * отдаёт `code` любого `BaseError` как есть. Именно так один код уже доходил до
 * клиента без текста на фронте — `AuthorizationError` из `cors.ts`.
 */
function errorClassCodes(): Set<string> {
  const text = readFileSync(join(BACKEND_SRC, 'utils', 'error.ts'), 'utf8');
  return new Set(
    [...text.matchAll(/super\([^)]*?'([A-Z0-9_]+)'/gs)].map(m => m[1])
  );
}

/**
 * Коды из union-типов сервисных классов ошибок — `StoreRunError`,
 * `GroupAccessError` и им подобных.
 *
 * Третий способ, которым код попадает в ответ, и его тоже не видит поиск по
 * `code: 'X'`: контроллер пишет `code: err.code`, а список значений живёт в
 * подписи конструктора. На этом уже был сбой: `INVALID_INPUT` из
 * `StoreRunError` сочли мёртвым кодом и убрали у него текст, хотя
 * `store-run.controller` отдаёт его клиенту как 400.
 */
function serviceErrorUnionCodes(): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'node_modules') {
          walk(full);
        }
        continue;
      }
      if (extname(entry.name) !== '.ts' || entry.name.endsWith('.test.ts')) {
        continue;
      }
      const text = readFileSync(full, 'utf8');
      /* `public code:` со списком литералов через |, возможно многострочным. */
      for (const m of text.matchAll(/public code:((?:\s*\|?\s*'[A-Z0-9_]+')+)/g)) {
        for (const lit of m[1].matchAll(/'([A-Z0-9_]+)'/g)) {
          if (!found.has(lit[1])) found.set(lit[1], new Set());
          found.get(lit[1])!.add(entry.name);
        }
      }
    }
  };

  walk(BACKEND_SRC);
  return found;
}

describe('словарь кодов ошибок', () => {
  /* Без этой проверки поломка обхода или регулярки делает тесты ниже
     вакуумными: пустое множество проходит любой filter. */
  it('сборщики кодов вообще что-то находят', () => {
    expect(backendCodeLiterals().size).toBeGreaterThan(60);
    expect(errorClassCodes().size).toBeGreaterThan(10);
    expect(serviceErrorUnionCodes().size).toBeGreaterThan(5);
    expect(frontendCodes().size).toBeGreaterThan(60);
  });

  it('каждый код из классов ошибок внесён в ApiErrorCode', () => {
    const unknown = [...errorClassCodes()].filter(code => !isApiErrorCode(code));

    expect(unknown).toEqual([]);
  });

  it('каждый код из union-типов сервисных ошибок внесён в ApiErrorCode', () => {
    const unknown = [...serviceErrorUnionCodes().entries()]
      .filter(([code]) => !isApiErrorCode(code))
      .map(([code, files]) => `${code} (${[...files].join(', ')})`);

    expect(unknown).toEqual([]);
  });

  it('каждый код из backend внесён в ApiErrorCode', () => {
    const unknown = [...backendCodeLiterals().entries()]
      .filter(([code]) => !isApiErrorCode(code))
      .map(([code, files]) => `${code} (${[...files].join(', ')})`);

    expect(unknown).toEqual([]);
  });

  /* Главное свойство. Код без текста — это не «мелочь в словаре», а
     пользователь, которому вместо причины показали общую фразу. */
  it('у каждого кода есть текст для пользователя во фронтовом словаре', () => {
    const front = frontendCodes();
    const withoutMessage = API_ERROR_CODES.filter(code => !front.has(code));

    expect(withoutMessage).toEqual([]);
  });

  it('снятые синонимы не вернулись в backend', () => {
    const present = [...backendCodeLiterals().keys()].filter(
      code => code in RETIRED_CODE_ALIASES
    );

    expect(present).toEqual([]);
  });

  it('в union нет дубликатов', () => {
    expect(new Set(API_ERROR_CODES).size).toBe(API_ERROR_CODES.length);
  });

  /* Синоним, сведённый к коду, которого нет в union, — это опечатка в самой
     таблице синонимов, и она бы прошла незамеченной. */
  it('каждый синоним указывает на существующий код', () => {
    const broken = Object.entries(RETIRED_CODE_ALIASES).filter(
      ([, target]) => !isApiErrorCode(target)
    );

    expect(broken).toEqual([]);
  });

  it('isApiErrorCode отвергает мусор', () => {
    expect(isApiErrorCode('НЕ_КОД')).toBe(false);
    expect(isApiErrorCode('')).toBe(false);
    expect(isApiErrorCode(undefined)).toBe(false);
    expect(isApiErrorCode(42)).toBe(false);
    expect(isApiErrorCode('INTERNAL_ERROR')).toBe(true);
  });
});
