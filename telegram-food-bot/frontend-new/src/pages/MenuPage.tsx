import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  useMenuItems,
  useCreateMenuItem,
  useDeleteMenuItem,
  useUpdateMenuItem,
  useToggleMenuItem,
} from '@/hooks/useMenu';
import { useAuth } from '@/hooks/useAuth';
import { useMyGroups } from '@/hooks/useUser';
import { useAppStore } from '@/store/useAppStore';
import { isGlobalAdmin } from '@/lib/permissions';
import type { MenuItem } from '@/types/models';
import { Icon } from '@/components/rl/Icon';
import { Badge, Button, Chip, Field, IconButton, SearchBar, Switch } from '@/components/rl/primitives';
import { BottomSheet } from '@/components/rl/BottomSheet';
import { Fab } from '@/components/rl/Fab';

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

function buildCategories(dishes: Dish[]): { id: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of dishes) counts.set(d.category, (counts.get(d.category) ?? 0) + 1);
  const all = [{ id: 'all', label: 'Все', count: dishes.length }];
  for (const [id, count] of counts) all.push({ id, label: id, count });
  return all;
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} ${one}`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

/* Категорийные тинты тайлов из макета: coral / мёд / зелень / золото */
const CATEGORY_TONES = ['var(--danger)', 'var(--accent)', 'var(--success)', 'var(--warning)'];
function categoryTone(category: string): string {
  const hash = [...category].reduce((a, c) => a + c.charCodeAt(0), 0);
  return CATEGORY_TONES[hash % CATEGORY_TONES.length];
}

export default function MenuPage() {
  const { user } = useAuth();
  const isAdmin = isGlobalAdmin(user);

  // Меню per-group: выбор группы здесь локальный (null = текущая активная)
  const currentGroupId = useAppStore((s) => s.currentGroupId);
  const { data: myGroups = [] } = useMyGroups();
  const [menuGroupId, setMenuGroupId] = useState<string | null>(null);
  const activeGroups = useMemo(() => myGroups.filter((g) => g.isActive), [myGroups]);
  const effectiveGroupId = menuGroupId ?? currentGroupId;
  const activeGroup = activeGroups.find((g) => String(g.id) === effectiveGroupId);

  const { data: items = [], isLoading, error } = useMenuItems({ activeOnly: false, groupId: effectiveGroupId });
  const createMutation = useCreateMenuItem();
  const updateMutation = useUpdateMenuItem();
  const deleteMutation = useDeleteMenuItem();
  const toggleMutation = useToggleMenuItem();

  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MenuItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Dish | null>(null);

  const dishes = useMemo(() => items.map(toDish), [items]);
  const categories = useMemo(() => buildCategories(dishes), [dishes]);

  const filtered = useMemo(() => {
    let list = dishes.filter((d) => category === 'all' || d.category === category);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((d) => d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q));
    }
    return list;
  }, [dishes, category, query]);

  const isEmpty = !isLoading && dishes.length === 0;
  const isNoResults = !isLoading && !isEmpty && filtered.length === 0;

  return (
    <div className="rl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 20px 13px' }}>
        <h1 className="font-head" style={{ margin: 0, fontSize: 22, fontWeight: 600, lineHeight: 1.2 }}>
          Меню
        </h1>
        <p className="tnum" style={{ margin: 0, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
          {plural(dishes.length, 'блюдо', 'блюда', 'блюд')}
          {dishes.length > 0 ? ` · ${plural(categories.length - 1, 'категория', 'категории', 'категорий')}` : ''}
          {activeGroup ? ` · ${activeGroup.title}` : ''}
        </p>
      </div>

      {activeGroups.length > 1 && (
        <div className="scroll-area" style={{ display: 'flex', gap: 8, padding: '0 20px 12px', overflowX: 'auto' }}>
          {activeGroups.map((g) => (
            <Chip
              key={g.id}
              on={String(g.id) === effectiveGroupId}
              onClick={() => {
                if (String(g.id) === effectiveGroupId) return;
                setMenuGroupId(String(g.id));
                setCategory('all');
              }}
            >
              {g.title}
            </Chip>
          ))}
        </div>
      )}

      {!isEmpty && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 5,
            padding: '0 20px 12px',
            background: 'linear-gradient(var(--bg-base) 72%, transparent)',
          }}
        >
          <SearchBar value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти блюдо или категорию" />
          <div className="scroll-area" style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', paddingBottom: 2 }}>
            {categories.map((c) => (
              <Chip key={c.id} on={category === c.id} onClick={() => setCategory(c.id)}>
                {c.label}
                <span className="tnum" style={{ opacity: 0.6 }}>
                  {c.count}
                </span>
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: '4px 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {error && (
          <div className="card" style={{ padding: 20, color: 'var(--text-secondary)', fontSize: 'var(--t-13)' }}>
            Не удалось загрузить меню.
          </div>
        )}
        {isLoading && <LoadingList />}
        {isEmpty && <EmptyMenu canAdd={isAdmin} onAdd={() => setAddOpen(true)} />}
        {isNoResults && <NoResults query={query} />}

        {!isLoading &&
          filtered.map((d, i) => (
            <DishRow
              key={d.id}
              dish={d}
              index={i}
              admin={isAdmin}
              toggling={toggleMutation.isPending && toggleMutation.variables === d.id}
              onToggle={() => toggleMutation.mutate(d.id)}
              onEdit={() => {
                const raw = items.find((it) => it.id === d.id);
                if (raw) setEditTarget(raw);
              }}
              onDelete={() => setDeleteTarget(d)}
            />
          ))}
      </div>

      {isAdmin && !addOpen && !editTarget && !deleteTarget && !isEmpty && (
        <Fab label="Добавить блюдо" onClick={() => setAddOpen(true)} />
      )}

      {addOpen && (
        <DishSheet
          title="Добавить блюдо"
          busy={createMutation.isPending}
          onClose={() => setAddOpen(false)}
          onSubmit={async (input) => {
            try {
              await createMutation.mutateAsync({ data: input, groupId: effectiveGroupId ?? undefined });
              setAddOpen(false);
            } catch {
              /* toast shown by hook */
            }
          }}
        />
      )}
      {editTarget && (
        <DishSheet
          title="Редактировать блюдо"
          initial={editTarget}
          busy={updateMutation.isPending}
          onClose={() => setEditTarget(null)}
          onSubmit={async (input) => {
            try {
              await updateMutation.mutateAsync({ id: editTarget.id, data: input, groupId: effectiveGroupId ?? undefined });
              setEditTarget(null);
            } catch {
              /* toast shown */
            }
          }}
        />
      )}
      {deleteTarget && (
        <BottomSheet
          role="alertdialog"
          title={`Удалить «${deleteTarget.name}»?`}
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="secondary" style={{ flex: 1 }} disabled={deleteMutation.isPending} onClick={() => setDeleteTarget(null)}>
                Отмена
              </Button>
              <Button
                variant="danger"
                icon="trash"
                style={{ flex: 1 }}
                loading={deleteMutation.isPending}
                onClick={async () => {
                  try {
                    await deleteMutation.mutateAsync({ id: deleteTarget.id, groupId: effectiveGroupId ?? undefined });
                    setDeleteTarget(null);
                  } catch {
                    /* toast shown */
                  }
                }}
              >
                Удалить
              </Button>
            </>
          }
        >
          <p style={{ margin: 0, fontSize: 'var(--t-13)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Блюдо исчезнет из каталога и истории голосований. Действие нельзя отменить.
          </p>
        </BottomSheet>
      )}
    </div>
  );
}

function DishRow({
  dish,
  index,
  admin,
  toggling,
  onToggle,
  onEdit,
  onDelete,
}: {
  dish: Dish;
  index: number;
  admin: boolean;
  toggling?: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tone = categoryTone(dish.category);
  return (
    <div
      className="card anim-rise"
      style={{
        padding: '12px 14px',
        borderRadius: 20,
        boxShadow: dish.active ? 'var(--shadow-1)' : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        animationDelay: `${Math.min(index * 45, 300)}ms`,
        opacity: dish.active ? 1 : 0.75,
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 15,
          flexShrink: 0,
          background: dish.active ? `color-mix(in srgb, ${tone} 13%, transparent)` : 'var(--border-subtle)',
          boxShadow: dish.active ? `inset 0 0 0 1px color-mix(in srgb, ${tone} 18%, transparent)` : 'none',
          color: dish.active ? tone : 'var(--text-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="target" size={22} stroke={1.6} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: dish.active ? 'var(--text-primary)' : 'var(--text-tertiary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {dish.name}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {dish.category}
            {!dish.active && ' · в архиве'}
          </span>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-tertiary)' }} />
          <span
            className="tnum"
            style={{ fontSize: 12.5, fontWeight: 600, color: dish.active ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}
          >
            {dish.price} ₽
          </span>
        </div>
      </div>
      {admin ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Switch
            on={dish.active}
            disabled={toggling}
            onChange={onToggle}
            aria-label={dish.active ? 'Блюдо активно — выключить' : 'Блюдо в архиве — включить'}
          />
          <IconButton variant="ghost" size="sm" name="edit" aria-label="Изменить" onClick={onEdit} />
          <IconButton variant="ghost" size="sm" name="trash" aria-label="Удалить" style={{ color: 'var(--danger)' }} onClick={onDelete} />
        </div>
      ) : (
        <Badge tone={dish.active ? 'success' : 'neutral'}>{dish.active ? 'Активно' : 'Архив'}</Badge>
      )}
    </div>
  );
}

function LoadingList() {
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="skeleton" style={{ width: 52, height: 52, borderRadius: 12 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 13, width: '60%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 11, width: '35%' }} />
          </div>
          <div className="skeleton" style={{ width: 56, height: 24, borderRadius: 999 }} />
        </div>
      ))}
    </>
  );
}

function CenterCard({ icon, title, text, action }: { icon: 'menu' | 'search' | 'flame'; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="card" style={{ padding: '36px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 18,
          background: 'var(--bg-base)',
          color: 'var(--text-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 6,
          border: '1px solid var(--border-subtle)',
        }}
      >
        <Icon name={icon} size={28} />
      </div>
      <div className="font-head" style={{ fontSize: 'var(--t-16)', fontWeight: 600 }}>
        {title}
      </div>
      <p style={{ margin: 0, fontSize: 'var(--t-13)', color: 'var(--text-tertiary)', maxWidth: 260, lineHeight: 1.5 }}>{text}</p>
      {action}
    </div>
  );
}

/* Эмпти-стейт из макета: двойная орбита, вилка-нож, чипы-призраки — прямо на канвасе */
function EmptyMenu({ canAdd, onAdd }: { canAdd: boolean; onAdd: () => void }) {
  const ghostChip = (text: string, pos: React.CSSProperties) => (
    <div
      style={{
        position: 'absolute',
        padding: '5px 11px',
        borderRadius: 999,
        border: '1px dashed var(--border-subtle)',
        fontSize: 11,
        color: 'var(--text-tertiary)',
        whiteSpace: 'nowrap',
        ...pos,
      }}
    >
      {text}
    </div>
  );
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        textAlign: 'center',
        padding: '48px 0 30px',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 130,
          height: 130,
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '1.5px dashed color-mix(in srgb, var(--accent) 30%, transparent)',
          }}
        />
        <div style={{ position: 'absolute', inset: 16, borderRadius: '50%', border: '1px dashed var(--border-subtle)' }} />
        <div
          style={{
            width: 78,
            height: 78,
            borderRadius: '50%',
            background: 'var(--accent-tint)',
            boxShadow: 'inset 0 0 0 1px var(--accent-ring), 0 16px 36px -16px color-mix(in srgb, var(--accent) 40%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
          }}
        >
          <Icon name="menu" size={34} stroke={1.5} />
        </div>
        {ghostChip('Поке?', { left: -56, top: 14, transform: 'rotate(-7deg)' })}
        {ghostChip('Том-ям?', { right: -72, top: 50, transform: 'rotate(5deg)' })}
        {ghostChip('Пад-тай?', { left: -44, bottom: 6, transform: 'rotate(4deg)' })}
      </div>
      <span className="font-head" style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>
        Меню пустое
      </span>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 250 }}>
        {canAdd
          ? 'Добавьте первое блюдо — команде будет за что голосовать уже сегодня'
          : 'Администратор ещё не добавил блюда'}
      </span>
      {canAdd && (
        <Button variant="primary" size="lg" icon="plus" style={{ marginTop: 8 }} onClick={onAdd}>
          Добавить блюдо
        </Button>
      )}
    </div>
  );
}

function NoResults({ query }: { query: string }) {
  return <CenterCard icon="search" title="Ничего не найдено" text={`По запросу «${query}» нет блюд.`} />;
}

type DishInput = { name: string; price: number; description?: string; category?: string; isActive?: boolean; emoji?: string };

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 'var(--t-13)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}

function DishSheet({
  title,
  initial,
  busy,
  onClose,
  onSubmit,
}: {
  title: string;
  initial?: MenuItem;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: DishInput) => void | Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [cat, setCat] = useState(initial?.category ?? '');
  const [active, setActive] = useState(initial?.isActive !== false);

  const canSubmit = name.trim().length > 0 && Number(price) > 0 && !busy;

  return (
    <BottomSheet
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" style={{ flex: 1 }} disabled={busy} onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="primary"
            icon="check"
            style={{ flex: 1 }}
            loading={busy}
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                price: Number(price),
                description: desc.trim() || undefined,
                category: cat.trim() || undefined,
                isActive: active,
              })
            }
          >
            Сохранить
          </Button>
        </>
      }
    >
      <FormField label="Название">
        <Field value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Пельмени с говядиной" />
      </FormField>
      <FormField label="Описание">
        <Field as="textarea" value={desc} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDesc(e.target.value)} placeholder="Сметана, укроп, свежий чеснок" />
      </FormField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormField label="Цена, ₽">
          <Field value={price} onChange={(e: ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)} placeholder="350" inputMode="numeric" className="tnum" />
        </FormField>
        <FormField label="Категория">
          <Field value={cat} onChange={(e: ChangeEvent<HTMLInputElement>) => setCat(e.target.value)} placeholder="Горячее" />
        </FormField>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 14px',
          borderRadius: 'var(--r-block)',
          background: 'var(--bg-base)',
        }}
      >
        <div>
          <div className="font-head" style={{ fontSize: 'var(--t-15)', fontWeight: 600 }}>
            Активно
          </div>
          <div style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)' }}>Показывать в голосовании</div>
        </div>
        <Switch on={active} onChange={setActive} aria-label="Активно" />
      </div>
    </BottomSheet>
  );
}
