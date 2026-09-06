/**
 * Последняя выбранная команда, чтобы приложение открывалось там, где его
 * закрыли.
 *
 * Выбор жил только в памяти стора: при каждом запуске `bootstrapAuth` брал
 * первую команду с флагом `isActive` — а это флаг самой ГРУППЫ, не выбор
 * человека, — либо просто первую в списке. Человек из двух команд каждый раз
 * попадал не туда, куда шёл.
 *
 * Хранится по пользователю: одно устройство может открывать разные аккаунты
 * Telegram, и чужой выбор подставлять нельзя.
 *
 * Всякое обращение к `localStorage` обёрнуто: в Telegram WebView он может быть
 * недоступен или переполнен, а невозможность запомнить выбор не повод ломать
 * запуск. Не запомнили — работает прежнее правило выбора.
 */
const KEY_PREFIX = 'rl.preferredGroup.';

function keyFor(userId: number): string {
  return `${KEY_PREFIX}${userId}`;
}

/** Сохранённый выбор или `null`, если его нет либо хранилище недоступно. */
export function readPreferredGroupId(userId: number): string | null {
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export function writePreferredGroupId(userId: number, groupId: string): void {
  try {
    window.localStorage.setItem(keyFor(userId), groupId);
  } catch {
    /* Не запомнили — не беда, см. заголовок файла. */
  }
}

/**
 * Какую команду открыть.
 *
 * Сохранённый выбор проверяется по АКТУАЛЬНОМУ списку членств: человека могли
 * исключить из команды, пока приложение было закрыто, и подставлять её id
 * значило бы уйти в 403 на первом же запросе. Не подтвердился — прежнее
 * правило: команда с флагом `isActive`, иначе первая в списке.
 */
export function resolveInitialGroupId(
  groups: Array<{ id: number | string; isActive?: boolean }>,
  preferred: string | null
): string | null {
  if (groups.length === 0) return null;

  const stillAvailable =
    preferred !== null && groups.some((g) => String(g.id) === preferred);
  if (stillAvailable) return preferred;

  const active = groups.find((g) => g.isActive) ?? groups[0];
  return active ? String(active.id) : null;
}
