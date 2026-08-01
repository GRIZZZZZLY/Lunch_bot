/* Смок-регрессия единой системы токенов: одна система тем, никакого
   дубля в redesign-v2/index.css, грейн и радиальные фоны удалены. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// vitest всегда запускается из корня пакета (npm test)
const read = (name: string) => readFileSync(join(process.cwd(), 'src', 'styles', name), 'utf8');
const tokensCss = read('tokens.css');
const indexCss = read('index.css');
const redesignCss = read('redesign-v2.css');

const SEMANTIC_TOKENS = [
  '--canvas',
  '--surface',
  '--surface-secondary',
  '--elevated',
  '--text-primary',
  '--text-secondary',
  '--text-tertiary',
  '--divider',
  '--accent',
  '--accent-foreground',
  '--success',
  '--warning',
  '--danger',
  '--overlay',
  '--focus-ring',
];

function themeBlock(css: string, theme: 'light' | 'dark'): string {
  const start = css.indexOf(`[data-theme='${theme}'] {`);
  expect(start, `нет блока темы ${theme}`).toBeGreaterThan(-1);
  const end = css.indexOf('}', start);
  return css.slice(start, end);
}

describe('tokens.css — единственный источник тем', () => {
  it.each(['light', 'dark'] as const)('тема %s определяет все семантические токены', (theme) => {
    const block = themeBlock(tokensCss, theme);
    for (const token of SEMANTIC_TOKENS) {
      expect(block, `${token} отсутствует в теме ${theme}`).toContain(`${token}:`);
    }
  });

  it('палитра фиксированная: подхват Telegram theme variables удалён (решение владельца 2026-07-19)', () => {
    expect(tokensCss).not.toContain('--tg-theme-');
    expect(tokensCss).not.toContain('tg-synced');
  });

  it('redesign-v2.css больше не определяет темы и токены', () => {
    expect(redesignCss).not.toContain('[data-theme');
    expect(redesignCss).not.toContain('--text-primary:');
    expect(redesignCss).not.toContain('--bg-base:');
  });

  it('index.css больше не определяет старую палитру', () => {
    expect(indexCss).not.toContain('--pri:');
    expect(indexCss).not.toContain('--ink:');
  });
});

describe('визуальный фундамент 2B', () => {
  it('SVG-грейн поверх модалок удалён', () => {
    expect(indexCss).not.toContain('body::after');
    expect(indexCss).not.toContain('feTurbulence');
  });

  it('радиальные засветки удалены; допустима только dot-текстура под контентом', () => {
    // старые декоративные засветки «Графит и мёд» (radial 120%/80%…) запрещены
    expect(indexCss).not.toMatch(/radial-gradient\(\s*\d+%/);
    expect(tokensCss).not.toContain('--bg-page: radial');
    // фактура системы C: ровно один radial-gradient — точки из --texture-dot,
    // на body::before с z-index:-1 (не поверх модалок)
    const radials = indexCss.match(/radial-gradient/g) ?? [];
    expect(radials.length).toBe(1);
    expect(indexCss).toContain('var(--texture-dot');
    expect(indexCss).toContain('z-index: -1');
    const backgroundDefs = indexCss.match(/^html\s*\{|^html\.dark\s*\{/gm) ?? [];
    expect(backgroundDefs.length).toBe(1);
  });

  it('доменные токены системы C определены в обеих темах', () => {
    for (const theme of ['light', 'dark'] as const) {
      const block = themeBlock(tokensCss, theme);
      for (const token of ['--vote', '--shop', '--money', '--texture-dot']) {
        expect(block, `${token} отсутствует в теме ${theme}`).toContain(`${token}:`);
      }
    }
  });

  it('доменные тона Status опираются на собственные *-on-tint', () => {
    const statusCss = readFileSync(
      join(process.cwd(), 'src', 'shared', 'ui', 'Status.module.css'),
      'utf8',
    );
    for (const role of ['vote', 'shop', 'money'] as const) {
      for (const theme of ['light', 'dark'] as const) {
        expect(
          themeBlock(tokensCss, theme),
          `--${role}-on-tint отсутствует в теме ${theme}`,
        ).toContain(`--${role}-on-tint:`);
      }
      expect(statusCss).toContain(`background: var(--${role}-tint)`);
      expect(statusCss).toContain(`color: var(--${role}-on-tint)`);
    }
  });

  it('текст на тинте берёт *-on-tint, а не базовый статусный токен', () => {
    const statusCss = readFileSync(
      join(process.cwd(), 'src', 'shared', 'ui', 'Status.module.css'),
      'utf8',
    );
    for (const role of ['success', 'warning', 'danger', 'info'] as const) {
      for (const theme of ['light', 'dark'] as const) {
        expect(
          themeBlock(tokensCss, theme),
          `--${role}-on-tint отсутствует в теме ${theme}`,
        ).toContain(`--${role}-on-tint:`);
      }
      // базовые токены рассчитаны на --surface и на своём тинте дают <4.5:1
      expect(statusCss).toContain(`color: var(--${role}-on-tint)`);
      expect(redesignCss).toContain(`.badge--${role} { background: var(--${role}-tint)`);
      expect(redesignCss).not.toContain(`var(--${role}-tint); color: var(--${role}); }`);
    }
  });

  it('фаза 7 закрыта: блок совместимых алиасов удалён, потребителей не осталось', () => {
    // Алиасы (--t-*, --sp-*, --bg-*, --ink*, --r-*, --dur-*, --accent-glow…)
    // были вторым словарём поверх канонического. Один и тот же отступ жил под
    // двумя именами, и выбор между ними зависел от того, кто писал файл.
    expect(tokensCss).not.toContain('COMPATIBILITY ALIASES');
    for (const alias of ['--accent-glow', '--bg-base', '--ink', '--pri', '--sans', '--safe-top']) {
      expect(tokensCss, `${alias} всё ещё объявлен`).not.toContain(`${alias}:`);
    }
    for (const css of [redesignCss, indexCss, tokensCss]) {
      for (const alias of ['var(--t-15)', 'var(--sp-4)', 'var(--r-card)', 'var(--dur-2)']) {
        expect(css, `${alias} всё ещё используется`).not.toContain(alias);
      }
    }
  });

  it('шрифты self-hosted, без Google Fonts CDN', () => {
    expect(tokensCss).toContain("url('/fonts/onest-");
    expect(tokensCss).toContain("url('/fonts/unbounded-");
    expect(tokensCss).toContain('font-display: swap');
    expect(tokensCss).not.toContain('fonts.googleapis.com');
  });
});
