/**
 * Текущая команда и её смена — в шапке корневых вкладок.
 *
 * Команда — глобальный контекст продукта: главная, статистика и профиль
 * показывают данные ровно одной группы. Раньше сменить её можно было только
 * из меню, и на остальных экранах не было видно, чья это главная.
 *
 * С одной командой не показывается: выбирать не из чего.
 */
import { useMemo, useState } from 'react';

import { BottomSheet } from '@/components/rl/BottomSheet';
import { Icon } from '@/components/rl/Icon';
import { useMyGroups } from '@/hooks/useUser';
import { useAppStore } from '@/store/useAppStore';
import styles from './TeamSwitcher.module.css';

export function TeamSwitcher() {
  const currentGroupId = useAppStore((s) => s.currentGroupId);
  const setCurrentGroupId = useAppStore((s) => s.setCurrentGroupId);
  const { data: groups = [] } = useMyGroups();
  const activeGroups = useMemo(() => groups.filter((g) => g.isActive), [groups]);
  const [open, setOpen] = useState(false);

  const current = activeGroups.find((g) => String(g.id) === currentGroupId);
  if (activeGroups.length < 2 || !current) return null;

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-label={`Команда: ${current.title}. Сменить`}
        onClick={() => setOpen(true)}
      >
        <Icon name="users" size={14} />
        <span className={styles.title}>{current.title}</span>
      </button>

      {open && (
        <BottomSheet title="Команда" onClose={() => setOpen(false)}>
          <div role="radiogroup" aria-label="Команда" className={styles.list}>
            {activeGroups.map((g) => {
              const selected = String(g.id) === currentGroupId;
              return (
                <button
                  key={g.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={styles.option}
                  onClick={() => {
                    setCurrentGroupId(String(g.id));
                    setOpen(false);
                  }}
                >
                  {g.title}
                  {selected && <Icon name="check" size={16} />}
                </button>
              );
            })}
          </div>
        </BottomSheet>
      )}
    </>
  );
}
