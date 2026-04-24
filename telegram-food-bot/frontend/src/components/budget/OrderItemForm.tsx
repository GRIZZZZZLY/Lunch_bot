import { useState, useEffect, useRef } from 'react';
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
  const [itemName, setItemName] = useState(existingItem?.itemName || '');
  const [price, setPrice] = useState(existingItem?.price?.toString() || '');
  const [notes, setNotes] = useState(existingItem?.notes || '');
  const [showComment, setShowComment] = useState(!!existingItem?.notes);
  const onAutoSaveRef = useRef(onAutoSave);

  useEffect(() => {
    onAutoSaveRef.current = onAutoSave;
  }, [onAutoSave]);

  // Trigger autosave when fields change
  useEffect(() => {
    if (!isEditable) {
      return;
    }

    // Don't save if fields are empty
    if (!itemName.trim() || !price.trim()) {
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      return;
    }

    // Trigger autosave
    onAutoSaveRef.current({
      userId,
      itemName: itemName.trim(),
      price: priceNum,
      notes: notes.trim() || undefined,
    });
  }, [itemName, price, notes, userId, isEditable]);

  return (
    <div className={cn(
      "bg-background p-3",
      !isLast && "border-b border-border"
    )}>
      {/* Name + Fields Row */}
      <div className="flex items-start gap-2">
        <div className="min-w-[100px] pt-2">
          <Label className="text-sm font-medium text-foreground">{userName}</Label>
        </div>
        
        <div className="flex-1 grid grid-cols-2 gap-2">
          <Input
            placeholder="Позиция"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            disabled={!isEditable}
            className="h-9 text-sm"
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="Цена"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={!isEditable}
            className="h-9 text-sm"
          />
        </div>

        {/* Toggle Comment Button */}
        <button
          type="button"
          onClick={() => setShowComment(!showComment)}
          disabled={!isEditable}
          className="mt-1 p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title={showComment ? "Скрыть комментарий" : "Добавить комментарий"}
        >
          {showComment ? (
            <ChevronUp className={ICON_SIZES.sm} />
          ) : (
            <ChevronDown className={ICON_SIZES.sm} />
          )}
        </button>
      </div>

      {/* Collapsible Comment Field */}
      {showComment && (
        <div className="mt-2 pl-[108px]">
          <Textarea
            placeholder="Комментарий (необязательно)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!isEditable}
            className="min-h-[60px] text-sm"
          />
        </div>
      )}
    </div>
  );
}
