import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export const AdminChecklist: React.FC = () => (
  <div className="rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-left">
    <div className="text-sm font-semibold text-foreground">Быстрый старт</div>
    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 h-4 w-4 text-mint-500" />
        <span>Создай голосование</span>
      </div>
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 h-4 w-4 text-peach-500" />
        <span>Проверь меню на сегодня</span>
      </div>
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 h-4 w-4 text-lavender-500" />
        <span>Убедись, что авто-запуск настроен</span>
      </div>
    </div>
  </div>
);
