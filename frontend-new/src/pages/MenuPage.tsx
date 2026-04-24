import { useMemo, useState } from 'react';
import { Search, Filter, MoreVertical, Plus, ChevronDown, X, Trash2, Upload } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useMenuItems, useCreateMenuItem, useDeleteMenuItem, useUpdateMenuItem } from '@/hooks/useMenu';
import type { MenuItem } from '@/types/models';
import '@/styles/menu.css';

const PALETTES = ['peach', 'sage', 'rose', 'lav', 'butter', 'sky'] as const;

function paletteFor(index: number): string {
  return `var(--g-${PALETTES[index % PALETTES.length]})`;
}

interface Dish {
  id: number;
  emoji: string;
  name: string;
  desc: string;
  categoryId: string;
  categoryLabel: string;
  price: number;
  status: 'active' | 'archived';
  bg: string;
}

function toDish(item: MenuItem, index: number): Dish {
  const category = item.category ?? 'other';
  return {
    id: item.id,
    emoji: item.emoji ?? '🍽',
    name: item.name,
    desc: item.description ?? '',
    categoryId: category,
    categoryLabel: category,
    price: item.price,
    status: item.isActive === false ? 'archived' : 'active',
    bg: paletteFor(index),
  };
}

function buildCategories(dishes: Dish[]): { id: string; label: string; count?: number }[] {
  const counts = new Map<string, number>();
  for (const d of dishes) counts.set(d.categoryId, (counts.get(d.categoryId) ?? 0) + 1);
  const all: { id: string; label: string; count?: number }[] = [
    { id: 'all', label: 'Всё', count: dishes.length },
  ];
  for (const [id, count] of counts) all.push({ id, label: id, count });
  return all;
}

export default function MenuPage() {
  const { data: items = [], isLoading, error } = useMenuItems({ activeOnly: false });
  const createMutation = useCreateMenuItem();
  const updateMutation = useUpdateMenuItem();
  const deleteMutation = useDeleteMenuItem();

  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MenuItem | null>(null);
  const [suggExpanded, setSuggExpanded] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Dish | null>(null);

  const dishes = useMemo(() => items.map(toDish), [items]);
  const categories = useMemo(() => buildCategories(dishes), [dishes]);

  const filtered = useMemo(() => {
    let list = dishes.filter((d) => category === 'all' || d.categoryId === category);
    if (searchOpen && query) {
      list = list.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()));
    }
    return list;
  }, [dishes, category, searchOpen, query]);

  const isEmpty = !isLoading && dishes.length === 0;
  const isNoResults = searchOpen && query.length > 0 && filtered.length === 0;

  if (error) {
    return (
      <div className="body" style={{ padding: 16, color: 'var(--ink-2)' }}>
        Не удалось загрузить меню.
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="m-hdr">
        <div className="ttl">Меню</div>
        <div className="r">
          <button
            className="m-ico-btn"
            aria-label="search"
            onClick={() => {
              setSearchOpen((v) => !v);
              if (searchOpen) setQuery('');
            }}
          >
            <Search size={18} />
          </button>
          <button className="m-ico-btn" aria-label="filter">
            <Filter size={18} />
          </button>
          <button className="m-fab-sm" aria-label="add" onClick={() => setAddOpen(true)}>
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="body">
        {searchOpen && (
          <div className="glass-search">
            <Search className="mag" size={16} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Найти блюдо, категорию…"
            />
            {query && (
              <button className="clear" aria-label="Очистить" onClick={() => setQuery('')}>
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {!isEmpty && (
          <div className="chips">
            {categories.map((c) => (
              <button
                key={c.id}
                className={cn('chip', category === c.id && 'active')}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
                {c.count !== undefined && <span style={{ opacity: 0.7 }}> ·{c.count}</span>}
              </button>
            ))}
          </div>
        )}

        {!isLoading && !isEmpty && filtered.length > 0 && (
          <div className="sort-row">
            <span className="count"><b>{filtered.length}</b> блюд{filtered.length === 1 ? 'о' : 'а'}</span>
            <button className="sort-dd">По популярности <ChevronDown size={12} /></button>
          </div>
        )}

        {isLoading && <LoadingList />}
        {isEmpty && <EmptyMenu onAdd={() => setAddOpen(true)} />}
        {isNoResults && <NoResults query={query} />}

        {!isLoading && !isEmpty && !isNoResults && filtered.length > 0 && (
          <>
            <div className="menu-list">
              {filtered.map((d) => (
                <DishRow
                  key={d.id}
                  dish={d}
                  onDelete={() => setDeleteTarget(d)}
                  onEdit={() => {
                    const raw = items.find((i) => i.id === d.id);
                    if (raw) setEditTarget(raw);
                  }}
                />
              ))}
            </div>
            {!searchOpen && (
              <Suggestions expanded={suggExpanded} onToggle={() => setSuggExpanded((v) => !v)} />
            )}
          </>
        )}

        {!addOpen && !deleteTarget && !isEmpty && (
          <button className="fab" aria-label="add" onClick={() => setAddOpen(true)}>
            <Plus size={24} />
          </button>
        )}
      </div>

      {addOpen && (
        <AddDishSheet
          busy={createMutation.isPending}
          onClose={() => setAddOpen(false)}
          onSubmit={async (input) => {
            try {
              await createMutation.mutateAsync(input);
              setAddOpen(false);
            } catch {
              /* toast already shown by onError */
            }
          }}
        />
      )}
      {editTarget && (
        <EditDishSheet
          dish={editTarget}
          busy={updateMutation.isPending}
          onClose={() => setEditTarget(null)}
          onSubmit={async (input) => {
            try {
              await updateMutation.mutateAsync({ id: editTarget.id, data: input });
              setEditTarget(null);
            } catch {
              /* toast already shown */
            }
          }}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmSheet
          dish={deleteTarget}
          busy={deleteMutation.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            try {
              await deleteMutation.mutateAsync(deleteTarget.id);
              setDeleteTarget(null);
            } catch {
              /* toast already shown */
            }
          }}
        />
      )}
    </div>
  );
}

function DishRow({ dish, onDelete, onEdit }: { dish: Dish; onDelete: () => void; onEdit: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="mi">
      <div className="img" style={{ background: dish.bg }}>{dish.emoji}</div>
      <div className="info">
        <div className="n">{dish.name}</div>
        {dish.desc && <div className="d">{dish.desc}</div>}
        <div className="sub-meta">{dish.categoryLabel}</div>
      </div>
      <div className="tail">
        <span className="price">{dish.price} ₽</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}>
          <span className={cn('badge', dish.status === 'active' ? 'active' : 'archived')}>
            {dish.status === 'active' ? 'Активно' : 'Архив'}
          </span>
          <button className="kebab" aria-label="Меню" onClick={() => setMenuOpen((v) => !v)}>
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <div
              role="menu"
              onMouseLeave={() => setMenuOpen(false)}
              style={{
                position: 'absolute', right: 0, top: 28, zIndex: 20,
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 12, minWidth: 144, boxShadow: 'var(--shadow-elev)',
                padding: 4, display: 'flex', flexDirection: 'column',
              }}
            >
              <button
                onClick={() => { setMenuOpen(false); onEdit(); }}
                style={{ padding: '8px 10px', borderRadius: 8, fontSize: 13, background: 'transparent', border: 0, textAlign: 'left', color: 'var(--ink)', cursor: 'pointer' }}
              >
                Редактировать
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDelete(); }}
                style={{ padding: '8px 10px', borderRadius: 8, fontSize: 13, background: 'transparent', border: 0, textAlign: 'left', color: 'var(--coral-500)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Trash2 size={14} /> Удалить
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingList() {
  return (
    <div className="menu-list">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="sk">
          <div className="sh img" />
          <div className="lines">
            <div className="sh ln1" />
            <div className="sh ln2" />
          </div>
          <div className="sh pill" />
        </div>
      ))}
    </div>
  );
}

function EmptyMenu({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty">
      <div className="illo" aria-hidden>
        <div style={{
          width: 120, height: 120, borderRadius: 999,
          background: 'var(--g-peachlav)', display: 'grid', placeItems: 'center',
          fontSize: 56, boxShadow: 'var(--shadow-elev)',
        }}>🍽</div>
      </div>
      <div className="t">Меню пустое</div>
      <div className="s">Добавьте первое блюдо, чтобы команда могла голосовать за обед.</div>
      <button className="btn primary" style={{ marginTop: 8 }} onClick={onAdd}>
        <Plus size={16} /> Добавить блюдо
      </button>
    </div>
  );
}

function NoResults({ query }: { query: string }) {
  return (
    <div className="no-res">
      <div className="big">🤷</div>
      <div className="t">Ничего не найдено</div>
      <div className="s">По запросу «{query}» нет блюд.</div>
    </div>
  );
}

function Suggestions({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <div className="sugg">
      <div className="sh" onClick={onToggle} style={{ cursor: 'pointer' }}>
        <div className="t">💡 Предложено участниками <span className="pill">0</span></div>
        <ChevronDown size={12} style={{ color: 'var(--ink-3)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} />
      </div>
      {expanded && (
        <div style={{ padding: '10px 4px', fontSize: 13, color: 'var(--ink-3)' }}>
          Пока нет предложений от команды.
        </div>
      )}
    </div>
  );
}

function AddDishSheet({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; price: number; description?: string; category?: string; isActive?: boolean }) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('hot');
  const [active, setActive] = useState(true);

  const canSubmit = name.trim().length > 0 && Number(price) > 0 && !busy;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="bs" role="dialog" aria-label="Добавить блюдо">
        <div className="handle" />
        <div className="bs-head">
          <div className="bs-ttl">Добавить блюдо</div>
          <button className="bs-close" onClick={onClose} aria-label="Закрыть"><X size={14} /></button>
        </div>
        <div className="form">
          <div className="upload">
            <div className="ic"><Upload size={18} /></div>
            <div className="h">Загрузить фото</div>
            <div className="s">PNG, JPG · до 2 МБ</div>
          </div>
          <div className="field">
            <label>Название</label>
            <input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="Пельмени с говядиной" />
          </div>
          <div className="field">
            <label>Описание</label>
            <textarea className="inp" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Сметана, укроп, свежий чеснок" />
          </div>
          <div className="field row2">
            <div className="sub">
              <label>Цена</label>
              <div className="suffix">
                <input className="inp" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="350" inputMode="numeric" />
                <span className="sx">₽</span>
              </div>
            </div>
            <div className="sub">
              <label>Категория</label>
              <select className="inp" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="soup">🍜 Супы</option>
                <option value="hot">🥘 Горячее</option>
                <option value="salad">🥗 Салаты</option>
                <option value="dessert">🍰 Десерты</option>
                <option value="drink">🥤 Напитки</option>
              </select>
            </div>
          </div>
          <div className="toggle-row">
            <div>
              <div className="t">Активно</div>
              <div className="s">Показывать в голосовании</div>
            </div>
            <div className={cn('switch', active && 'on')} onClick={() => setActive((v) => !v)} role="switch" aria-checked={active} />
          </div>
          <div className="bs-foot">
            <button className="btn ghost" onClick={onClose} disabled={busy}>Отмена</button>
            <button
              className="btn primary"
              disabled={!canSubmit}
              onClick={() =>
                onSubmit({
                  name: name.trim(),
                  price: Number(price),
                  description: desc.trim() || undefined,
                  category,
                  isActive: active,
                })
              }
            >
              {busy ? 'Сохраняю…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function EditDishSheet({
  dish,
  busy,
  onClose,
  onSubmit,
}: {
  dish: MenuItem;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; price: number; description?: string; category?: string; isActive?: boolean; emoji?: string }) => void | Promise<void>;
}) {
  const [name, setName] = useState(dish.name);
  const [desc, setDesc] = useState(dish.description ?? '');
  const [price, setPrice] = useState(String(dish.price));
  const [category, setCategory] = useState(dish.category ?? 'hot');
  const [emoji, setEmoji] = useState(dish.emoji ?? '🍽');
  const [active, setActive] = useState(dish.isActive !== false);

  const canSubmit = name.trim().length > 0 && Number(price) > 0 && !busy;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="bs" role="dialog" aria-label="Редактировать блюдо">
        <div className="handle" />
        <div className="bs-head">
          <div className="bs-ttl">Редактировать блюдо</div>
          <button className="bs-close" onClick={onClose} aria-label="Закрыть"><X size={14} /></button>
        </div>
        <div className="form">
          <div className="field">
            <label>Эмодзи</label>
            <input className="inp" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} />
          </div>
          <div className="field">
            <label>Название</label>
            <input className="inp" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Описание</label>
            <textarea className="inp" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="field row2">
            <div className="sub">
              <label>Цена</label>
              <div className="suffix">
                <input className="inp" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" />
                <span className="sx">₽</span>
              </div>
            </div>
            <div className="sub">
              <label>Категория</label>
              <select className="inp" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="soup">🍜 Супы</option>
                <option value="hot">🥘 Горячее</option>
                <option value="salad">🥗 Салаты</option>
                <option value="dessert">🍰 Десерты</option>
                <option value="drink">🥤 Напитки</option>
                <option value="other">Другое</option>
              </select>
            </div>
          </div>
          <div className="toggle-row">
            <div>
              <div className="t">Активно</div>
              <div className="s">Показывать в голосовании</div>
            </div>
            <div className={cn('switch', active && 'on')} onClick={() => setActive((v) => !v)} role="switch" aria-checked={active} />
          </div>
          <div className="bs-foot">
            <button className="btn ghost" onClick={onClose} disabled={busy}>Отмена</button>
            <button
              className="btn primary"
              disabled={!canSubmit}
              onClick={() =>
                onSubmit({
                  name: name.trim(),
                  price: Number(price),
                  description: desc.trim() || undefined,
                  category,
                  isActive: active,
                  emoji: emoji.trim() || undefined,
                })
              }
            >
              {busy ? 'Сохраняю…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function DeleteConfirmSheet({
  dish,
  busy,
  onCancel,
  onConfirm,
}: {
  dish: Dish;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <>
      <div className="scrim" onClick={onCancel} />
      <div className="bs" role="alertdialog" aria-label="Удалить блюдо">
        <div className="handle" />
        <div className="bs-head">
          <div className="bs-ttl">Удалить «{dish.name}»?</div>
          <button className="bs-close" onClick={onCancel} aria-label="Закрыть"><X size={14} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 2px 18px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12, display: 'grid', placeItems: 'center',
            fontSize: 26, background: dish.bg, flexShrink: 0,
          }}>{dish.emoji}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.4 }}>
            Блюдо исчезнет из каталога и истории голосований. Действие нельзя отменить.
          </div>
        </div>
        <div className="bs-foot">
          <button className="btn ghost" onClick={onCancel} disabled={busy}>Отмена</button>
          <button className="btn destructive" onClick={onConfirm} disabled={busy}>
            <Trash2 size={14} /> {busy ? 'Удаляю…' : 'Удалить'}
          </button>
        </div>
      </div>
    </>
  );
}
