/**
 * Подсказки «Откуда заказываем»: магазины, которыми группа уже пользовалась.
 *
 * Тап по чипу выбирает запись справочника — тогда имя закупки берёт сервер, а
 * не текст поля. Ручная правка поля выбор сбрасывает: два источника имени
 * одновременно означали бы, что показанное и отправленное расходятся.
 *
 * Долгое нажатие открывает правку. Это единственный вход в переименование и
 * скрытие: отдельного экрана управления справочником нет, потому что справочник
 * копится сам и заводить под него раздел не за чем.
 */
import { useEffect, useRef, useState } from 'react';

import { Chip } from '@/components/rl/primitives';
import type { GroupStore } from '@/services/group-store.service';

/** Сколько чипов показываем. Больше на 390 px не помещается даже в две строки. */
const VISIBLE_LIMIT = 8;
/** Порог долгого нажатия. Ниже — срабатывает на обычном тапе с задержкой. */
const LONG_PRESS_MS = 500;

export function StoreChips({
  stores,
  selectedId,
  onSelect,
  onManage,
}: {
  stores: GroupStore[];
  selectedId: number | null;
  onSelect: (store: GroupStore) => void;
  onManage: (store: GroupStore) => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const [pressedId, setPressedId] = useState<number | null>(null);

  /* Таймер живёт дольше рендера: без снятия он выстрелит по размонтированной
     шторке и откроет правку поверх закрытого экрана. */
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPressedId(null);
  };

  const startPress = (store: GroupStore) => {
    longPressed.current = false;
    setPressedId(store.id);
    timer.current = setTimeout(() => {
      longPressed.current = true;
      clear();
      onManage(store);
    }, LONG_PRESS_MS);
  };

  if (stores.length === 0) return null;

  return (
    <div
      style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}
      role="group"
      aria-label="Магазины, которыми уже пользовались"
    >
      {stores.slice(0, VISIBLE_LIMIT).map((store) => (
        <Chip
          key={store.id}
          on={selectedId === store.id}
          style={{ opacity: pressedId === store.id ? 0.7 : 1 }}
          onPointerDown={() => startPress(store)}
          onPointerUp={clear}
          onPointerLeave={clear}
          onPointerCancel={clear}
          onContextMenu={(e) => {
            /* Долгое нажатие в мобильном вебвью поднимает системное меню
               выделения поверх нашего. Оно тут лишнее. */
            e.preventDefault();
          }}
          onClick={() => {
            if (longPressed.current) {
              longPressed.current = false;
              return;
            }
            onSelect(store);
          }}
        >
          {store.name}
        </Chip>
      ))}
    </div>
  );
}
