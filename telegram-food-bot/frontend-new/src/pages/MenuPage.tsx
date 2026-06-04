import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  useMenuItems,
  useCreateMenuItem,
  useDeleteMenuItem,
  useUpdateMenuItem,
} from '@/hooks/useMenu';
import { useAuth } from '@/hooks/useAuth';
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
  const all = [{ id: 'all', label: 'Всё', count: dishes.length }];
  for (const [id, count] of counts) all.push({ id, label: id, count });
  return all;
}

export default function MenuPage() {
  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin;

  const { data: items = [], isLoading, error } = useMenuItems({ activeOnly: false });
  const createMutation = useCreateMenuItem();
  const updateMutation = useUpdateMenuItem();
  const deleteMutation = useDeleteMenuItem();

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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '10px 20px 12px', gap: 12 }}>
        <div>
          <h1 className="font-head tight" style={{ margin: 0, fontSize: 'var(--t-28)', fontWeight: 700, lineHeight: 1.05 }}>
            Меню
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--t-13)', color: 'var(--text-tertiary)' }}>
            <span className="tnum">{dishes.length}</span> блюд · <span className="tnum">{categories.length - 1}</span> категорий
          </p>
        </div>
        {isAdmin && (
          <IconButton variant="secondary" name="plus" aria-label="Добавить блюдо" onClick={() => setAddOpen(true)} />
        )}
      </div>

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
        {!isEmpty && (
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
        )}
      </div>

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
              await createMutation.mutateAsync(input);
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
              await updateMutation.mutateAsync({ id: editTarget.id, data: input });
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
                    await deleteMutation.mutateAsync(deleteTarget.id);
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
  onEdit,
  onDelete,
}: {
  dish: Dish;
  index: number;
  admin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="card anim-rise"
      style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, animationDelay: `${Math.min(index * 45, 300)}ms`, opacity: dish.active ? 1 : 0.6 }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 12,
          flexShrink: 0,
          background: 'var(--accent-tint)',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="menu" size={24} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="font-head" style={{ fontSize: 'var(--t-15)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {dish.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
          <span className="tnum" style={{ fontSize: 'var(--t-15)', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {dish.price} ₽
          </span>
          <span style={{ fontSize: 'var(--t-11)', color: 'var(--text-tertiary)' }}>·</span>
          <span style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)' }}>{dish.category}</span>
        </div>
      </div>
      {admin ? (
        <div style={{ display: 'flex', gap: 4 }}>
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

function EmptyMenu({ canAdd, onAdd }: { canAdd: boolean; onAdd: () => void }) {
  return (
    <CenterCard
      icon="menu"
      title="Меню пустое"
      text={canAdd ? 'Добавьте первое блюдо, чтобы команда могла голосовать за обед.' : 'Администратор ещё не добавил блюда.'}
      action={
        canAdd ? (
          <Button variant="primary" icon="plus" style={{ marginTop: 10 }} onClick={onAdd}>
            Добавить блюдо
          </Button>
        ) : undefined
      }
    />
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
