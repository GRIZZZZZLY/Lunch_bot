/* Образ проверки продакшена (Dockerfile.production-smoke) берёт браузеры из
   базового образа Playwright, а сам @playwright/test — из package-lock.json.
   Разойдутся версии — контейнер не найдёт браузер и каждый прогон по таймеру
   упадёт с «Executable doesn't exist», то есть тревогой без причины на
   продукте. 24.09.2026 так и случилось: пакет 1.63.0, образ 1.62.1. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (name: string) => readFileSync(join(process.cwd(), name), 'utf8');

describe('образ проверки продакшена', () => {
  it('версия базового образа Playwright совпадает с установленным @playwright/test', () => {
    const image = /FROM mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)/.exec(
      read('Dockerfile.production-smoke'),
    )?.[1];
    const lock = JSON.parse(read('package-lock.json')) as {
      packages: Record<string, { version?: string }>;
    };
    const installed = lock.packages['node_modules/@playwright/test']?.version;

    expect(installed).toBeDefined();
    expect(image).toBe(installed);
  });
});
