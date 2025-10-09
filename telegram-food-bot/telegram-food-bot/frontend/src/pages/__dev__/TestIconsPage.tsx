import React from 'react';
import { PageHeader } from '../../../components/common/PageHeader';
import { CheckCircle2, Circle, Clock, Users, ArrowLeft, Plus } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';

/**
 * Тестовая страница для проверки иконок lucide-react
 */
export function TestIconsPage() {
  return (
    <div className="min-h-screen bg-telegram-bg-color p-4">
      <PageHeader 
        title="Тест иконок Lucide"
        subtitle="Проверка отображения иконок"
        showBack={true}
      />

      <div className="space-y-6 mt-6">
        {/* CheckCircle2 и Circle иконки */}
        <div className="bg-telegram-secondary-bg-color rounded-xl p-6">
          <h2 className="text-lg font-semibold text-telegram-text-color mb-4">
            Иконки выбора (CheckCircle2 & Circle)
          </h2>
          
          <div className="space-y-3">
            {/* Выбранный элемент */}
            <div className="p-4 border-2 border-telegram-button-color bg-telegram-button-color/10 rounded-xl">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-6 text-telegram-button-color" />
                <span className="text-telegram-text-color">Выбранный элемент (CheckCircle2)</span>
              </div>
            </div>

            {/* Ранее выбранный */}
            <div className="p-4 border-2 border-green-500 bg-green-500/10 rounded-xl">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-6 text-green-500" />
                <span className="text-telegram-text-color">Ваш предыдущий выбор</span>
              </div>
            </div>

            {/* Невыбранный */}
            <div className="p-4 border-2 border-gray-300 bg-telegram-secondary-bg-color rounded-xl">
              <div className="flex items-center gap-3">
                <Circle className="size-6 text-gray-300" />
                <span className="text-telegram-text-color">Невыбранный элемент (Circle)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Clock и Users иконки */}
        <div className="bg-telegram-secondary-bg-color rounded-xl p-6">
          <h2 className="text-lg font-semibold text-telegram-text-color mb-4">
            Статистика (Clock & Users)
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-telegram-bg-color rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="size-5 text-telegram-button-color" />
                <div className="text-2xl font-bold text-telegram-button-color">42</div>
              </div>
              <div className="text-sm text-telegram-hint-color">Голосов</div>
            </div>

            <div className="bg-telegram-bg-color rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="size-5 text-orange-500" />
                <div className="text-2xl font-bold text-orange-500">2ч 30м</div>
              </div>
              <div className="text-sm text-telegram-hint-color">Осталось</div>
            </div>
          </div>
        </div>

        {/* Другие иконки */}
        <div className="bg-telegram-secondary-bg-color rounded-xl p-6">
          <h2 className="text-lg font-semibold text-telegram-text-color mb-4">
            Другие иконки (ArrowLeft & Plus)
          </h2>
          
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="size-4" />
              Назад
            </Button>

            <Button variant="default" className="gap-2">
              <Plus className="size-4" />
              Добавить
            </Button>
          </div>
        </div>

        {/* Статус */}
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <p className="text-green-600 dark:text-green-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="size-5" />
            ✅ Все иконки lucide-react загружены и работают!
          </p>
        </div>
      </div>
    </div>
  );
}
