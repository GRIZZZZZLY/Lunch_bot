/* Тема до первой отрисовки. Без этого файла тёмная тема мигала светлым фоном,
   пока грузится основной бандл: data-theme ставит только src/lib/theme.ts.
   Отдельный файл, а не инлайн в index.html: CSP сервера пропускает скрипты
   только со своего origin. Порядок источников — как в computeTheme():
   ручной выбор > тема Telegram > системная. Тему Telegram SDK выводит из
   bg_color той же формулой (isColorDark в telegram-web-app.js). */
(function () {
  function telegramScheme() {
    var raw = null;
    var match = /[#&]tgWebAppThemeParams=([^&]*)/.exec(location.hash);
    if (match) raw = decodeURIComponent(match[1]);
    if (!raw) raw = sessionStorage.getItem('__telegram__themeParams');
    var bg = raw && JSON.parse(raw).bg_color;
    if (!bg) return null;
    var hex = bg.replace(/[\s#]/g, '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var r = parseInt(hex.slice(0, 2), 16);
    var g = parseInt(hex.slice(2, 4), 16);
    var b = parseInt(hex.slice(4, 6), 16);
    return Math.sqrt(0.299 * r * r + 0.587 * g * g + 0.114 * b * b) < 120 ? 'dark' : 'light';
  }

  try {
    var theme = localStorage.getItem('rl-theme');
    if (theme !== 'light' && theme !== 'dark') {
      theme = telegramScheme() || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  } catch (e) {
    // Хранилище или разбор недоступны — тему поставит основной бандл, как раньше.
  }
})();
