/**
 * Регрессия на автоприближение при фокусе в поле ввода.
 *
 * iOS (Safari и WKWebView, в котором Telegram открывает Mini App) приближает
 * ВСЮ страницу, когда текст в поле меньше 16px. Проявляется только на телефоне
 * и только на iOS, поэтому ни один прогон в jsdom и ни один снимок Playwright
 * этого не поймает — заметно лишь глазами на устройстве.
 *
 * Отсюда проверка исходников, а не поведения: правило «поле = 16px» держится
 * тем, что его нельзя нарушить незаметно. Следующее поле, набранное токеном
 * --text-15, уронит этот тест.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (...parts: string[]) => readFileSync(join(process.cwd(), 'src', ...parts), 'utf8');

/** Минимум, ниже которого iOS начинает приближать страницу. */
const MIN_INPUT_FONT_PX = 16;

/** Файлы, где вообще встречаются правила для полей ввода. */
const CSS_WITH_INPUTS: Array<[label: string, source: string]> = [
  ['styles/redesign-v2.css', read('styles', 'redesign-v2.css')],
  ['shared/ui/TextField.module.css', read('shared', 'ui', 'TextField.module.css')],
  ['features/menu/MenuPage.module.css', read('features', 'menu', 'MenuPage.module.css')],
];

const tokensCss = read('styles', 'tokens.css');
const indexCss = read('styles', 'index.css');

/** Размер токена в пикселях: `--text-15: 15px` → 15. */
function tokenPx(token: string): number {
  const match = new RegExp(`--${token}:\\s*(\\d+(?:\\.\\d+)?)px`).exec(tokensCss);
  if (!match) throw new Error(`Токен --${token} не найден в tokens.css`);
  return Number(match[1]);
}

/** `var(--text-16)` или `15px` → размер в пикселях. */
function declaredPx(value: string): number | null {
  const viaToken = /var\(\s*--text-([\w-]+)\s*\)/.exec(value);
  if (viaToken) return tokenPx(`text-${viaToken[1]}`);

  const literal = /(\d+(?:\.\d+)?)px/.exec(value);
  return literal ? Number(literal[1]) : null;
}

/**
 * Правила с font-size, чей селектор относится к полю ввода.
 *
 * Регулярка ловит только самые внутренние блоки (в теле нет фигурных скобок),
 * поэтому обёртки вроде @media разбираются правильно: совпадут вложенные
 * правила, а не сам @media.
 */
function inputFontSizes(rawSource: string): Array<{ selector: string; px: number }> {
  const out: Array<{ selector: string; px: number }> = [];
  /* Комментарии вырезаются заранее: объяснение перед объявлением разрывало
     цепочку «точка с запятой → font-size», и правило переставало находиться —
     тест зеленел на пустом списке. */
  const source = rawSource.replace(/\/\*[\s\S]*?\*\//g, '');

  for (const [, rawSelector, body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = rawSelector.trim().split('\n').pop()!.trim();
    if (!/input|textarea|\.field\b|\.input\b/.test(selector)) continue;

    const declaration = /(?:^|;)\s*font-size:\s*([^;]+)/.exec(body);
    if (!declaration) continue;

    const px = declaredPx(declaration[1]);
    if (px !== null) out.push({ selector, px });
  }

  return out;
}

describe('поля ввода не вызывают автоприближение на iOS', () => {
  it.each(CSS_WITH_INPUTS)('%s: ни одно поле не мельче 16px', (_label, source) => {
    const tooSmall = inputFontSizes(source).filter(rule => rule.px < MIN_INPUT_FONT_PX);

    expect(tooSmall).toEqual([]);
  });

  it('проверка вообще что-то находит, а не пропускает файлы молча', () => {
    const found = CSS_WITH_INPUTS.flatMap(([, source]) => inputFontSizes(source));

    /* Без этого утверждения сломанная регулярка дала бы зелёный тест на пустом
       списке — и правило перестало бы охраняться незаметно. */
    expect(found.length).toBeGreaterThanOrEqual(4);
    expect(found.every(rule => rule.px >= MIN_INPUT_FONT_PX)).toBe(true);
  });

  it('поле со стилем в разметке тоже 16px', () => {
    const donation = readFileSync(
      join(process.cwd(), 'src', 'components', 'modals', 'DonationModal.tsx'),
      'utf8',
    );

    /* Проверяется РАЗМЕТКА самого <input>, а не файл целиком: рядом живут
       кнопки готовых сумм со своим размером, и приближение вызывают только
       текстовые поля. Огульная проверка по файлу ловила бы кнопку и заставляла
       менять то, что менять не нужно. */
    const input = /<input[\s\S]*?\/>/.exec(donation)?.[0];

    expect(input).toBeDefined();
    expect(input).toContain("fontSize: 'var(--text-16)'");
  });
});

describe('жесты масштабирования', () => {
  it('двойное касание не приближает, щипок остаётся рабочим', () => {
    expect(indexCss).toMatch(/touch-action:\s*manipulation/);
    /* `none` и `pan-*` отняли бы у пользователя щипок. Это отказ в
       масштабировании: WCAG 1.4.4 и critical-нарушение axe, которое ловит
       tests/e2e/specs/routes-auth.spec.ts. */
    expect(indexCss).not.toMatch(/touch-action:\s*(none|pan-)/);
  });

  it('масштабирование не запрещено через viewport', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

    /* Соблазн закрыть исходную жалобу одной строкой в meta. Не работает: iOS
       игнорирует запрет для щипка, а остальные браузеры подчиняются и лишают
       людей масштабирования. */
    expect(html).not.toMatch(/user-scalable\s*=\s*no/);
    expect(html).not.toMatch(/maximum-scale/);
  });
});
