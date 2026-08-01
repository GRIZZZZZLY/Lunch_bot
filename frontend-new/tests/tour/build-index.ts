import fs from 'node:fs';
import path from 'node:path';

const TOUR_DIR = path.resolve(process.cwd(), 'ui-tour');

const SECTION_TITLES: Record<string, string> = {
  '01-entry': 'Точки входа и авторизация',
  '02-home': 'Главная: голосование и закупки',
  '03-menu': 'Меню',
  '04-stats': 'Статистика',
  '05-profile': 'Профиль',
  '06-admin': 'Админ-панель',
  '07-budget': 'Бюджет и долги',
  '08-suggestions': 'Предложения блюд',
  '09-store-run': 'Закупка в магазине',
  '10-poll': 'История и результаты опросов',
  '11-misc': 'Прочие маршруты',
  '12-dark': 'Тёмная тема',
};

function humanize(file: string): string {
  return file
    .replace(/\.png$/, '')
    .replace(/^\d+-/, '')
    .replace(/-/g, ' ');
}

/** Собирает статичную галерею, чтобы весь тур смотрелся одной страницей. */
export default function buildIndex(): void {
  if (!fs.existsSync(TOUR_DIR)) return;

  const sections = fs
    .readdirSync(TOUR_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  let total = 0;
  const body = sections
    .map((section) => {
      const files = fs
        .readdirSync(path.join(TOUR_DIR, section))
        .filter((file) => file.endsWith('.png'))
        .sort();
      total += files.length;
      const cards = files
        .map(
          (file) => `      <figure>
        <img src="${section}/${file}" alt="${humanize(file)}" loading="lazy" width="390" height="844" />
        <figcaption>${humanize(file)}</figcaption>
      </figure>`,
        )
        .join('\n');
      return `    <section>
      <h2>${SECTION_TITLES[section] ?? section} <small>${files.length}</small></h2>
      <div class="grid">
${cards}
      </div>
    </section>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Rocket Lunch — тур по интерфейсу</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 32px; background: #14161a; color: #e8eaed;
         font: 15px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif; }
  h1 { margin: 0 0 4px; font-size: 26px; letter-spacing: -0.02em; }
  p.lead { margin: 0 0 32px; color: #9aa0a6; }
  h2 { margin: 40px 0 16px; font-size: 18px; letter-spacing: -0.01em; }
  h2 small { color: #9aa0a6; font-weight: 400; font-size: 13px; }
  .grid { display: grid; gap: 24px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
  figure { margin: 0; }
  img { width: 100%; height: auto; border-radius: 14px; background: #000;
        border: 1px solid #2b2f36; display: block; }
  figcaption { margin-top: 8px; font-size: 12px; color: #9aa0a6; }
</style>
</head>
<body>
  <h1>Rocket Lunch — тур по интерфейсу</h1>
  <p class="lead">${total} состояний, 390×844, моки Telegram WebApp и API из сквозных тестов.</p>
${body}
</body>
</html>
`;

  fs.writeFileSync(path.join(TOUR_DIR, 'index.html'), html, 'utf8');
  process.stdout.write(`\nГалерея: ${path.join(TOUR_DIR, 'index.html')} (${total} снимков)\n`);
}
