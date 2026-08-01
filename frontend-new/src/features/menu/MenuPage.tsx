/* Меню (Phase 5, система C). Группа — ГЛОБАЛЬНЫЙ контекст: переключение
   здесь меняет useAppStore.currentGroupId и весь продукт (голосование,
   закупки, бюджет) следует за ним. Toggle блюда — с явным groupId (B4).
   FAB удалён: «Добавить блюдо» — кнопка под списком и в пустом состоянии. */
import { useMemo, useState } from 'react';
import {
  useMenuItems,
  useCreateMenuItem,
  useDeleteMenuItem,
  useUpdateMenuItem,
  useToggleMenuItem,
} from '@/hooks/useMenu';
import { useMyGroups } from '@/hooks/useUser';
import { useAppStore } from '@/store/useAppStore';
import { isGroupAdminRole } from '@/lib/permissions';
import type { MenuItem } from '@/types/models';
import { Icon } from '@/components/rl/Icon';
import { EmptyState, ErrorState, Skeleton, Status } from '@/shared/ui';
import { Button, IconButton, Switch } from '@/components/rl/primitives';
import { pluralize } from '@/shared/lib/pluralize';
import { formatPrice } from '@/features/store-run/lib/selectors';
import { useRovingFocus } from '@/shared/lib/useRovingFocus';
import { DishSheet, type DishInput } from './components/DishSheet';
import styles from './MenuPage.module.css';

interface Dish {
  id: number;
  name: string;
  desc: string;
  category: string;
  price: number;
  active: boolean;
}

function toDish(item: MenuItem): Dish {
  return {
    id: item.id,
    name: item.name,
    desc: item.description ?? '',
    category: item.category ?? 'Прочее',
    price: item.price,
    active: item.isActive !== false,
  };
}

export function buildCategories(dishes: Pick<Dish, 'category'>[]): { id: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of dishes) counts.set(d.category, (counts.get(d.category) ?? 0) + 1);
  const all = [{ id: 'all', label: 'Все', count: dishes.length }];
  for (const [id, count] of counts) all.push({ id, label: id, count });
  return all;
}

export default function MenuPage() {
  // Группа — глобальный контекст всего продукта (решение плана миграции):
  // никаких локальных «только для меню» групп.
  const currentGroupId = useAppStore((s) => s.currentGroupId);
  const setCurrentGroupId = useAppStore((s) => s.setCurrentGroupId);
  const { data: myGroups = [] } = useMyGroups();
  const activeGroups = useMemo(() => myGroups.filter((g) => g.isActive), [myGroups]);
  // Смена группы перезапрашивает меню, поэтому стрелки только двигают фокус.
  const groupTabs = useRovingFocus(
    activeGroups.length,
    activeGroups.findIndex((g) => String(g.id) === currentGroupId),
  );
  const activeGroup = activeGroups.find((g) => String(g.id) === currentGroupId);

  // Управление меню — по РОЛИ в выбранной группе (совпадает с бэком:
  // menu.routes → groupAdminMiddleware, глобальный isAdmin не в счёт).
  const isAdmin = isGroupAdminRole(activeGroup?.role);

  const { data: items = [], isLoading, error, refetch } = useMenuItems({ activeOnly: false, groupId: currentGroupId });
  const createMutation = useCreateMenuItem();
  const updateMutation = useUpdateMenuItem();
  const deleteMutation = useDeleteMenuItem();
  const toggleMutation = useToggleMenuItem();

  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MenuItem | null>(null);

  const dishes = useMemo(() => items.map(toDish), [items]);
  const categories = useMemo(() => buildCategories(dishes), [dishes]);

  const filtered = useMemo(() => {
    let list = dishes.filter((d) => category === 'all' || d.category === category);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((d) => d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q));
    return list;
  }, [dishes, category, query]);

  const isEmpty = !isLoading && !error && dishes.length === 0;
  const isNoResults = !isLoading && !error && !isEmpty && filtered.length === 0;

  const switchGroup = (id: string) => {
    if (id === currentGroupId) return;
    // смена глобальной группы: все group-scoped запросы перезапросятся по ключам
    setCurrentGroupId(id);
    setCategory('all');
    setQuery('');
  };

  return (
    <div className={`rl ${styles.screen}`}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Меню</h1>
          <p className={`tnum ${styles.subtitle}`}>
            {pluralize(dishes.length, 'блюдо', 'блюда', 'блюд')}
            {activeGroup ? ` · ${activeGroup.title}` : ''}
          </p>
        </div>
      </div>

      {activeGroups.length > 1 && (
        <div className={styles.cats} role="tablist" aria-label="Группа">
          {activeGroups.map((g, idx) => {
            const { ref, ...roving } = groupTabs.getItemProps(idx);
            return (
              <button
                key={g.id}
                ref={ref}
                type="button"
                role="tab"
                aria-selected={String(g.id) === currentGroupId}
                className={`${styles.cat}${String(g.id) === currentGroupId ? ` ${styles.on}` : ''}`}
                onClick={() => switchGroup(String(g.id))}
                {...roving}
              >
                {g.title}
              </button>
            );
          })}
        </div>
      )}

      {!isEmpty && !error && (
        <>
          <label className={styles.search}>
            <Icon name="search" size={16} />
            <input
              value={query}
              placeholder="Поиск блюд"
              aria-label="Поиск блюд"
              onChange={(e) => setQuery(e.target.value)}
            />
            {/* На телефоне запрос иначе стирается забоем по одному символу. */}
            {query && (
              <button
                type="button"
                className={styles.searchClear}
                aria-label="Очистить поиск"
                onClick={() => setQuery('')}
              >
                <Icon name="x" size={16} />
              </button>
            )}
          </label>
          {/* aria-pressed, а не только цвет: рядом, в той же шапке, переключатель
              групп сделан правильным tablist с aria-selected, а фильтр категорий
              не сообщал своё состояние вообще. Здесь не tablist — панелей нет,
              фильтруется один и тот же список, поэтому переключатель-кнопка. */}
          <div className={styles.cats}>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={category === c.id}
                className={`${styles.cat}${category === c.id ? ` ${styles.on}` : ''}`}
                onClick={() => setCategory(c.id)}
              >
                {c.label} <span className={`tnum ${styles.count}`}>· {c.count}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <div className={styles.stateWrap}>
          <ErrorState kind="network" onRetry={() => refetch()} />
        </div>
      )}

      {isLoading && (
        <div className={styles.group} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <Skeleton variant="text" width="55%" />
                <div style={{ height: 6 }} />
                <Skeleton variant="text" width="35%" height={10} />
              </div>
              <Skeleton variant="text" width={52} />
            </div>
          ))}
        </div>
      )}

      {isEmpty && (
        <div className={styles.stateWrap}>
          <EmptyState
            icon="menu"
            title="Меню пустое"
            description={
              isAdmin
                ? 'Добавьте первое блюдо — команде будет за что голосовать.'
                : 'Администратор ещё не добавил блюда.'
            }
            action={
              isAdmin ? (
                <Button onClick={() => setAddOpen(true)}>Добавить блюдо</Button>
              ) : undefined
            }
          />
        </div>
      )}

      {isNoResults && (
        <div className={styles.stateWrap}>
          <EmptyState icon="search" title="Ничего не нашлось" description={`По запросу «${query.trim()}» блюд нет.`} />
        </div>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div className={styles.group}>
          {filtered.map((d) => (
            <div key={d.id} className={`${styles.row}${d.active ? '' : ` ${styles.archived}`}`}>
              <div className={styles.rowMain}>
                {/* Имя занимает строку целиком, чип «Скрыто» уехал к описанию.
                    Рядом с именем он отбирал ~90 px: сначала «Борщ со сметаной»
                    переносился на две строки, а с обрезкой превращался в
                    «Борщ со см…». Имя — то, по чему ищут блюдо, и оно получает
                    всю ширину; во второй строке запас есть. */}
                <div className={styles.name}>
                  <span className={styles.dishName}>{d.name}</span>
                </div>
                <div className={styles.meta}>
                  {!d.active && <Status tone="neutral">Скрыто</Status>}
                  {(d.desc || d.category) && (
                    <span className={styles.desc}>{d.desc || d.category}</span>
                  )}
                </div>
              </div>
              {/* formatPrice, а не «{price} ₽»: это было единственное место в
                  продукте, где деньги шли без разрядов — «1340 ₽» против
                  «1 340 ₽» на остальных экранах. */}
              <span className={`tnum ${styles.price}`}>{formatPrice(d.price)}</span>
              {isAdmin && (
                <div className={styles.rowActions}>
                  <Switch
                    on={d.active}
                    disabled={toggleMutation.isPending && toggleMutation.variables?.id === d.id}
                    onChange={() =>
                      toggleMutation.mutate({ id: d.id, groupId: currentGroupId ?? undefined })
                    }
                    aria-label={d.active ? `Скрыть «${d.name}»` : `Показать «${d.name}»`}
                  />
                  <IconButton
                    name="edit"
                    aria-label={`Изменить «${d.name}»`}
                    onClick={() => {
                      const raw = items.find((it) => it.id === d.id);
                      if (raw) setEditTarget(raw);
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!isLoading && !error && !isEmpty && (
        <div className={styles.addWrap}>
          {isAdmin ? (
            <Button variant="secondary" block onClick={() => setAddOpen(true)}>
              Добавить блюдо
            </Button>
          ) : (
            <p className={styles.viewerNote}>
              Хотите блюдо, которого нет? Предложите его в «Предложениях» из профиля.
            </p>
          )}
        </div>
      )}

      {addOpen && (
        <DishSheet
          title="Добавить блюдо"
          busy={createMutation.isPending}
          onClose={() => setAddOpen(false)}
          onSubmit={(input: DishInput) =>
            createMutation.mutate(
              { data: input, groupId: currentGroupId ?? undefined },
              { onSuccess: () => setAddOpen(false) },
            )
          }
        />
      )}
      {editTarget && (
        <DishSheet
          title="Изменить блюдо"
          initial={editTarget}
          busy={updateMutation.isPending}
          deleting={deleteMutation.isPending}
          onClose={() => setEditTarget(null)}
          onSubmit={(input: DishInput) =>
            updateMutation.mutate(
              { id: editTarget.id, data: input, groupId: currentGroupId ?? undefined },
              { onSuccess: () => setEditTarget(null) },
            )
          }
          onDelete={() =>
            deleteMutation.mutate(
              { id: editTarget.id, groupId: currentGroupId ?? undefined },
              { onSuccess: () => setEditTarget(null) },
            )
          }
        />
      )}
    </div>
  );
}
