/* Витрина дизайн-направлений: три экрана Rocket Lunch на ЖИВЫХ компонентах
   из window.RocketLunchUI (синхронизированный бандл). Направление задаётся
   HTML-обёрткой (токен-оверрайды + классы), сами экраны общие.
   Инварианты соблюдены: одна primary CTA, статусы текстом, ≥44px,
   Осталось→Куплено→Не нашли, inline-цена, price за строку. */
/* eslint-disable */
// @ts-nocheck
const React = (window as any).React;
const RL = (window as any).RocketLunchUI;
const { Button, IconButton, TextField, Status, InlineNotice, DSThemeRoot } = RL;

const h = React.createElement;

/* ---------- мини-иконки (инлайн svg, вне бандла — только для витрины) ---------- */
function Svg({ d, size = 22 }: { d: string; size?: number }) {
  return h(
    'svg',
    { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' },
    ...d.split('|').map((p, i) => h('path', { key: i, d: p })),
  );
}
const IC = {
  home: 'M3 10.5 12 4l9 6.5|M5 9.5V20h14V9.5|M9.5 20v-5h5v5',
  menu: 'M7 3v4|M9.5 3v4|M12 3v4|M7 7h5|M9.5 7v14|M16.5 21V3c2.4 1 3.5 3.8 3.5 6.8 0 2.3-1.4 3.7-3.5 3.7',
  stats: 'M4 20V10|M10 20V4|M16 20v-7|M22 20H2',
  user: 'M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6|M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  back: 'M15 5l-7 7 7 7',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
};

/* ---------- каркас телефона ---------- */
function Phone({ children, nav }: any) {
  return h(
    'div',
    { className: 'scr-phone' },
    h('div', { className: 'scr-body' }, children),
    nav !== false && h(BottomNav, null),
  );
}

function BottomNav() {
  const tabs = [
    ['home', 'Главная', true],
    ['menu', 'Меню', false],
    ['stats', 'Статистика', false],
    ['user', 'Профиль', false],
  ];
  return h(
    'nav',
    { className: 'scr-nav' },
    ...tabs.map(([ic, label, on]) =>
      h('div', { key: label, className: 'scr-nav-item' + (on ? ' on' : '') }, h(Svg, { d: IC[ic as string], size: 22 }), h('span', null, label)),
    ),
  );
}

function AppHeader() {
  return h(
    'header',
    { className: 'scr-appbar' },
    h('div', { className: 'scr-logo' }, h(Svg, { d: IC.spark, size: 16 })),
    h('div', { className: 'scr-logotype' }, 'Rocket Lunch'),
  );
}

function ScreenHeader({ title, status }: any) {
  return h(
    'header',
    { className: 'scr-appbar scr-detail' },
    h('span', { className: 'scr-back' }, h(Svg, { d: IC.back, size: 20 })),
    h('h1', { className: 'scr-title' }, title),
    status,
  );
}

function Section({ label, count, children }: any) {
  return h(
    'section',
    { className: 'scr-section' },
    h('div', { className: 'scr-sechead' }, h('span', { className: 'scr-seclabel' }, label), count != null && h('span', { className: 'scr-seccount' }, '· ' + count)),
    children,
  );
}

function Avatar({ name }: any) {
  return h('div', { className: 'scr-avatar' }, name[0]);
}

function Bar({ value }: any) {
  return h('div', { className: 'scr-bar' }, h('div', { className: 'scr-bar-fill', style: { width: value + '%' } }));
}

/* ---------- HOME ---------- */
function HomeScreen() {
  const options = [
    ['Том-ям с креветками', 46, true],
    ['Пицца «Маргарита»', 31, false],
    ['Шаурма классическая', 23, false],
  ];
  return h(
    Phone,
    null,
    h(AppHeader, null),
    h(
      'div',
      { className: 'scr-scroll' },
      h('div', { className: 'scr-greeting' }, h('div', { className: 'scr-caption' }, 'Пятница, 18 июля'), h('h1', { className: 'scr-h1' }, 'Добрый день, Игорь')),
      h(
        Section,
        { label: 'Голосуем за обед' },
        h('div', { className: 'scr-pollmeta' }, h(Status, { tone: 'accent', icon: 'clock' }, 'Идёт · 12:41'), h('span', { className: 'scr-votes tnum' }, '13 голосов')),
        ...options.map(([name, pct, mine]) =>
          h(
            'div',
            { key: name, className: 'scr-option' + (mine ? ' mine' : '') },
            h('div', { className: 'scr-option-top' }, h('span', { className: 'scr-option-name' }, name), h('span', { className: 'scr-option-pct tnum' }, pct + '%')),
            h(Bar, { value: pct }),
          ),
        ),
        h('div', { className: 'scr-cta-inline' }, h(Button, { block: true }, 'Голосовать')),
      ),
      h(
        Section,
        { label: 'Сейчас' },
        h(
          'div',
          { className: 'scr-row scr-link' },
          h('div', { className: 'scr-row-main' }, h('div', { className: 'scr-row-name' }, 'Пятёрочка у офиса'), h('div', { className: 'scr-row-sub' }, 'Игорь в магазине · 2 из 4')),
          h(Status, { tone: 'warning', icon: 'cart' }, 'В магазине'),
        ),
        h(
          'div',
          { className: 'scr-row scr-link' },
          h('div', { className: 'scr-row-main' }, h('div', { className: 'scr-row-name' }, 'Бюджет команды'), h('div', { className: 'scr-row-sub' }, 'Вы должны за вчерашний обед')),
          h('span', { className: 'scr-money tnum' }, '260 ₽'),
        ),
      ),
    ),
  );
}

/* ---------- STORE RUN: COLLECTING (участник) ---------- */
function CollectingScreen() {
  return h(
    Phone,
    { nav: false },
    h(ScreenHeader, { title: 'Пятёрочка у офиса', status: h(Status, { tone: 'accent', icon: 'clock' }, 'Сбор') }),
    h(
      'div',
      { className: 'scr-scroll' },
      h(
        'div',
        { className: 'scr-summary' },
        h(Avatar, { name: 'Игорь' }),
        h('div', { className: 'scr-summary-meta' }, h('div', { className: 'scr-row-name' }, 'Инициатор: Игорь'), h('div', { className: 'scr-row-sub' }, '2 участника · 3 позиции')),
      ),
      h(
        'div',
        { className: 'scr-countdown' },
        h('div', { className: 'scr-countdown-row' }, h('span', { className: 'scr-time tnum' }, '13:59'), h('span', { className: 'scr-row-sub' }, 'до 14:30')),
        h(Bar, { value: 62 }),
      ),
      h(
        Section,
        { label: 'Мои позиции', count: 2 },
        h(
          'div',
          { className: 'scr-row' },
          h('div', { className: 'scr-row-main' }, h('div', { className: 'scr-row-name' }, 'Хлеб бородинский')),
          h('div', { className: 'scr-row-actions' }, h(IconButton, { name: 'edit', 'aria-label': 'Изменить' }), h(IconButton, { name: 'trash', 'aria-label': 'Удалить' })),
        ),
        h(
          'div',
          { className: 'scr-row' },
          h(
            'div',
            { className: 'scr-row-main' },
            h('div', { className: 'scr-row-name' }, 'Кофе Lavazza Qualità Oro ', h('span', { className: 'scr-qty tnum' }, '×2')),
            h('div', { className: 'scr-row-sub' }, 'тёмная обжарка, если есть'),
          ),
          h('div', { className: 'scr-row-actions' }, h(IconButton, { name: 'edit', 'aria-label': 'Изменить' }), h(IconButton, { name: 'trash', 'aria-label': 'Удалить' })),
        ),
      ),
      h(
        Section,
        { label: 'Аня', count: 1 },
        h(
          'div',
          { className: 'scr-row' },
          h(
            'div',
            { className: 'scr-row-main' },
            h('div', { className: 'scr-row-name' }, 'Молоко 3.2% ', h('span', { className: 'scr-qty tnum' }, '×2')),
            h('div', { className: 'scr-row-sub' }, 'синюю пачку'),
          ),
        ),
      ),
    ),
    h('div', { className: 'scr-cta' }, h(Button, { block: true }, 'Добавить позицию')),
  );
}

/* ---------- STORE RUN: SHOPPING (инициатор, mixed) ---------- */
function ShoppingScreen() {
  return h(
    Phone,
    { nav: false },
    h(ScreenHeader, { title: 'Пятёрочка у офиса', status: h(Status, { tone: 'warning', icon: 'cart' }, 'В магазине') }),
    h(
      'div',
      { className: 'scr-scroll' },
      h(
        'div',
        { className: 'scr-progress' },
        h('div', { className: 'scr-countdown-row' }, h('span', { className: 'scr-progress-label tnum' }, 'Обработано 2 из 4'), h('span', { className: 'scr-row-sub tnum' }, 'осталось 2')),
        h(Bar, { value: 50 }),
      ),
      h(
        Section,
        { label: 'Осталось', count: 2 },
        h(
          'div',
          { className: 'scr-row scr-col' },
          h(
            'div',
            { className: 'scr-row-top' },
            h(
              'div',
              { className: 'scr-row-main' },
              h('div', { className: 'scr-row-name' }, 'Кофе Lavazza Qualità Oro ', h('span', { className: 'scr-qty tnum' }, '×2')),
              h('div', { className: 'scr-row-sub' }, 'тёмная обжарка, если есть'),
            ),
            h('span', { className: 'scr-owner' }, 'Александра К.'),
          ),
          h('div', { className: 'scr-item-actions' }, h(Button, { variant: 'secondary' }, 'Куплено'), h(Button, { variant: 'secondary' }, 'Не нашли')),
        ),
        h(
          'div',
          { className: 'scr-row scr-col' },
          h('div', { className: 'scr-row-top' }, h('div', { className: 'scr-row-main' }, h('div', { className: 'scr-row-name' }, 'Хлеб бородинский')), h('span', { className: 'scr-owner' }, 'Игорь')),
          h(
            'div',
            { className: 'scr-editor' },
            h(TextField, { label: 'Цена за всё, ₽', inputMode: 'decimal', defaultValue: '54', suffix: '₽' }),
            h('div', { className: 'scr-item-actions' }, h(Button, { variant: 'secondary' }, 'Отмена'), h(Button, null, 'Сохранить')),
          ),
        ),
      ),
      h(
        Section,
        { label: 'Куплено', count: 1 },
        h(
          'div',
          { className: 'scr-row scr-col' },
          h('div', { className: 'scr-row-top' }, h('div', { className: 'scr-row-main' }, h('div', { className: 'scr-row-name' }, 'Молоко 3.2% ', h('span', { className: 'scr-qty tnum' }, '×2'))), h('span', { className: 'scr-owner' }, 'Аня')),
          h('div', { className: 'scr-statusline' }, h(Status, { tone: 'success', icon: 'check' }, 'Куплено'), h('span', { className: 'scr-money tnum' }, '112,5 ₽')),
          h('div', { className: 'scr-item-actions' }, h(Button, { variant: 'secondary' }, 'Изменить цену'), h(Button, { variant: 'ghost' }, 'Не нашли')),
        ),
      ),
      h(
        Section,
        { label: 'Не нашли', count: 1 },
        h(
          'div',
          { className: 'scr-row scr-col' },
          h('div', { className: 'scr-row-top' }, h('div', { className: 'scr-row-main' }, h('div', { className: 'scr-row-name' }, 'Кефир 1%')), h('span', { className: 'scr-owner' }, 'Аня')),
          h('div', { className: 'scr-statusline' }, h(Status, { tone: 'danger' }, 'Не нашли')),
          h('div', { className: 'scr-item-actions' }, h(Button, { variant: 'secondary' }, 'Всё-таки куплено')),
        ),
      ),
      h(InlineNotice, { tone: 'info' }, 'Завершите расчёт после покупки. Незавершённая закупка может быть отменена автоматически.'),
    ),
    // активна мутация строки (открыт редактор цены) → settle заблокирован; primary в редакторе
    h('div', { className: 'scr-cta' }, h(Button, { block: true, disabled: true }, 'Рассчитать')),
  );
}

/* ---------- mount ---------- */
const params = new URLSearchParams(location.search);
const screen = params.get('screen') || 'home';
const theme = params.get('theme') || 'light';
const SCREENS: any = { home: HomeScreen, collecting: CollectingScreen, shopping: ShoppingScreen };
const Root = SCREENS[screen] || HomeScreen;

(window as any).ReactDOM.createRoot(document.getElementById('root')).render(
  h(DSThemeRoot, { theme }, h(Root, null)),
);
