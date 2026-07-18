import { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { OrderItem } from '@/services/category-order.service';
import { ICON_SIZES } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

interface OrderItemFormProps {
  userId: number;
  userName: string;
  existingItem?: OrderItem;
  onAutoSave: (data: { userId: number; itemName: string; price: number; notes?: string }) => void;
  isLast?: boolean;
  isEditable?: boolean;
}

export function OrderItemForm({
  userId,
  userName,
  existingItem,
  onAutoSave,
  isLast = false,
  isEditable = true,
}: OrderItemFormProps) {
  const itemNameRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const detailsInitializedRef = useRef(false);

  const initializeDetails = (element: HTMLDetailsElement | null) => {
    if (element && !detailsInitializedRef.current) {
      element.open = Boolean(existingItem?.notes);
      detailsInitializedRef.current = true;
    }
  };

  const handleAutoSave = () => {
    if (!isEditable) {
      return;
    }

    const itemName = itemNameRef.current?.value ?? '';
    const price = priceRef.current?.value ?? '';
    const notes = notesRef.current?.value ?? '';

    if (!itemName.trim() || !price.trim()) {
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      return;
    }

    onAutoSave({
      userId,
      itemName: itemName.trim(),
      price: priceNum,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className={cn(
      "rounded-2xl bg-muted/45 p-3",
      isLast && "mb-0"
    )}>
      {/* Name + Fields Row */}
      <div className="flex items-start gap-2">
        <div className="min-w-[88px] pt-2">
          <Label className="text-sm font-semibold text-foreground">{userName}</Label>
        </div>
        
        <div className="flex-1 grid grid-cols-2 gap-2">
          <Input
            ref={itemNameRef}
            placeholder="Позиция"
            aria-label={`Позиция для ${userName}`}
            defaultValue={existingItem?.itemName ?? ''}
            onChange={handleAutoSave}
            disabled={!isEditable}
            className="h-9 text-sm"
          />
          <Input
            ref={priceRef}
            type="number"
            step="0.01"
            min="0"
            placeholder="Цена"
            aria-label={`Цена для ${userName}`}
            defaultValue={existingItem?.price?.toString() ?? ''}
            onChange={handleAutoSave}
            disabled={!isEditable}
            className="h-9 text-sm"
          />
        </div>

      </div>

      {/* Collapsible Comment Field */}
      <details
        ref={initializeDetails}
        className="group/comment"
      >
        <summary
          className="ml-auto -mt-8 flex size-8 cursor-pointer list-none items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden"
          aria-label="Показать или скрыть комментарий"
        >
          <ChevronDown className={cn(ICON_SIZES.sm, 'group-open/comment:hidden')} />
          <ChevronUp className={cn(ICON_SIZES.sm, 'hidden group-open/comment:block')} />
        </summary>
        <div className="mt-2 pl-[96px]">
          <Textarea
            ref={notesRef}
            placeholder="Комментарий (необязательно)"
            aria-label={`Комментарий для ${userName}`}
            defaultValue={existingItem?.notes ?? ''}
            onChange={handleAutoSave}
            disabled={!isEditable}
            className="min-h-[60px] text-sm"
          />
        </div>
      </details>
    </div>
  );
}
