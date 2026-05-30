import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { MenuItem } from '../../services/menu.service';
import { Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';
import { useTelegram } from '@/hooks/useTelegram';

interface MenuRowProps {
  item: MenuItem;
  onEdit?: (item: MenuItem) => void;
  onDelete?: (id: number) => void;
  onToggle?: (id: number) => void;
  showActions?: boolean;
  loading?: boolean;
}

/**
 * MenuRow — компактная строка блюда (Variant B).
 * Миниатюра + название/описание + цена; для админа — панель действий снизу.
 */
export const MenuRow = memo(({
  item,
  onEdit,
  onDelete,
  onToggle,
  showActions = false,
  loading = false,
}: MenuRowProps) => {
  const { colorScheme, hapticFeedback } = useTelegram();
  const isDark = colorScheme === 'dark';
  const accentText = isDark ? 'text-lavender-400' : 'text-peach-600';
  const [isToggling, setIsToggling] = useState(false);

  const formatPrice = (price?: number) =>
    price != null ? `${price.toLocaleString('ru-RU')} ₽` : null;

  const handleEdit = () => {
    hapticFeedback?.selectionChanged();
    onEdit?.(item);
  };

  const handleDelete = () => {
    hapticFeedback?.impactOccurred('medium');
    onDelete?.(item.id);
  };

  const handleToggle = async () => {
    if (isToggling) return;
    setIsToggling(true);
    hapticFeedback?.impactOccurred('light');
    try {
      await onToggle?.(item.id);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div
      className={cn(
        'rounded-2xl bg-muted/40 p-3 transition-all',
        !item.isActive && 'opacity-55',
        loading && 'opacity-50 pointer-events-none'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Миниатюра */}
        <div className={cn(
          'flex items-center justify-center w-[52px] h-[52px] shrink-0 rounded-2xl overflow-hidden',
          isDark ? 'bg-lavender-500/12' : 'bg-peach-500/10'
        )}>
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              loading="lazy"
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <span className={cn('text-lg font-extrabold', accentText)}>
              {item.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Название + описание */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {item.name}
            </h3>
            {!item.isActive && (
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-coral-500/14 text-coral-500">
                не активно
              </span>
            )}
          </div>
          {item.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {item.description}
            </p>
          )}
        </div>

        {/* Цена */}
        {item.price != null && (
          <div className={cn('shrink-0 text-[15px] font-extrabold tracking-tight tabular-nums', accentText)}>
            {formatPrice(item.price)}
          </div>
        )}
      </div>

      {/* Действия (только админ) */}
      {showActions && (
        <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-border/50">
          <motion.button
            onClick={handleEdit}
            disabled={loading}
            whileTap={{ scale: 0.95 }}
            className="flex-1 flex items-center justify-center gap-1 text-xs font-medium h-9 rounded-lg bg-lavender-500/10 hover:bg-lavender-500/15 text-lavender-600 dark:text-lavender-400 transition-colors disabled:opacity-50"
          >
            <Edit2 className={ICON_SIZES.sm} />
            Изм.
          </motion.button>

          <motion.button
            onClick={handleDelete}
            disabled={loading}
            whileTap={{ scale: 0.95 }}
            className="flex-1 flex items-center justify-center gap-1 text-xs font-medium h-9 rounded-lg bg-coral-500/10 hover:bg-coral-500/15 text-coral-600 dark:text-coral-400 transition-colors disabled:opacity-50"
          >
            <Trash2 className={ICON_SIZES.sm} />
            Удал.
          </motion.button>

          <motion.button
            onClick={handleToggle}
            disabled={loading || isToggling}
            whileTap={{ scale: 0.95 }}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 text-xs font-medium h-9 rounded-lg transition-colors disabled:opacity-50',
              item.isActive
                ? 'bg-primary/10 hover:bg-primary/15 text-primary'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
            )}
          >
            {isToggling ? (
              <div className={cn(ICON_SIZES.sm, 'animate-spin rounded-full border-2 border-current border-t-transparent')} />
            ) : item.isActive ? (
              <>
                <CheckCircle className={ICON_SIZES.sm} />
                Акт.
              </>
            ) : (
              <>
                <XCircle className={ICON_SIZES.sm} />
                Неакт.
              </>
            )}
          </motion.button>
        </div>
      )}
    </div>
  );
}, (prev, next) => (
  prev.item.id === next.item.id &&
  prev.item.name === next.item.name &&
  prev.item.isActive === next.item.isActive &&
  prev.item.price === next.item.price &&
  prev.item.description === next.item.description &&
  prev.item.imageUrl === next.item.imageUrl &&
  prev.loading === next.loading &&
  prev.showActions === next.showActions
));

MenuRow.displayName = 'MenuRow';
