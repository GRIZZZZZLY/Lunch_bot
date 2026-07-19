import { Clock, Users, CheckCircle2 } from "lucide-react";
import { CategoryOrder } from "@/services/category-order.service";
import { CalculationProgress } from "@/services/category-order.service";

interface WaitingCalculationViewProps {
  categoryOrder: CategoryOrder;
  progress: CalculationProgress;
}

export function WaitingCalculationView({
  categoryOrder,
  progress,
}: WaitingCalculationViewProps) {
  const progressPercentage = progress.percentage;
  const deliveryCost = categoryOrder.deliveryCost ?? 0;
  const serviceFee = categoryOrder.serviceFee ?? 0;
  const tip = categoryOrder.tip ?? 0;
  const participantCount = Math.max(categoryOrder.participantCount, 1);
  const responsibleName =
    categoryOrder.responsibleUser?.firstName || "ответственный";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-lavender-500/12">
          <Clock className="h-6 w-6 text-lavender-600 dark:text-lavender-400" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          Ожидаем расчёт
        </h3>
        <p className="text-sm text-muted-foreground">
          Ответственный <span className="font-medium">{responsibleName}</span>{" "}
          вводит заказы
        </p>
      </div>

      {/* Category Info */}
      <div className="rounded-lg border border-border/70 p-4 bg-muted/35">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Категория:</span>
          <span className="text-sm font-medium text-foreground">
            {categoryOrder.category}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm text-muted-foreground">Участников:</span>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {categoryOrder.participantCount}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Прогресс:</span>
          <span className="font-medium text-foreground">
            {progress.filled} / {progress.total}
          </span>
        </div>

        <div className="relative">
          <div className="overflow-hidden h-3 rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium text-white drop-shadow">
              {progressPercentage}%
            </span>
          </div>
        </div>

        {/* Progress Status */}
        <div className="flex items-center gap-2 text-sm">
          {progress.isComplete ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-mint-600 dark:text-mint-400" />
              <span className="font-medium text-mint-600 dark:text-mint-400">
                Все заказы заполнены!
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              Осталось заполнить: {progress.total - progress.filled}
            </span>
          )}
        </div>
      </div>

      {/* Info Message */}
      <div className="rounded-lg border border-lavender-500/18 bg-lavender-500/8 p-4">
        <p className="text-sm text-foreground">
          💡 Ты получишь уведомление со своей суммой, как только{" "}
          {responsibleName} завершит расчёт.
        </p>
      </div>

      {/* Additional Costs (if any) */}
      {deliveryCost + serviceFee + tip > 0 && (
        <div className="rounded-lg border border-border/70 p-4 space-y-2 bg-card/72">
          <h4 className="text-sm font-medium text-foreground">
            Дополнительные расходы:
          </h4>
          {deliveryCost > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Доставка:</span>
              <span className="text-foreground">
                {deliveryCost.toFixed(2)} ₽
                <span className="text-xs text-muted-foreground ml-1">
                  ({(deliveryCost / participantCount).toFixed(2)} ₽/чел)
                </span>
              </span>
            </div>
          )}
          {serviceFee > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Сервис:</span>
              <span className="text-foreground">
                {serviceFee.toFixed(2)} ₽
                <span className="text-xs text-muted-foreground ml-1">
                  ({(serviceFee / participantCount).toFixed(2)} ₽/чел)
                </span>
              </span>
            </div>
          )}
          {tip > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Чаевые:</span>
              <span className="text-foreground">
                {tip.toFixed(2)} ₽
                <span className="text-xs text-muted-foreground ml-1">
                  ({(tip / participantCount).toFixed(2)} ₽/чел)
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Calculation Status */}
      <div className="text-center pt-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-xs text-foreground/72">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span>
            {categoryOrder.calculationStatus === "PENDING" &&
              "Ожидание начала расчёта"}
            {categoryOrder.calculationStatus === "IN_PROGRESS" &&
              "Расчёт в процессе"}
            {categoryOrder.calculationStatus === "COMPLETED" &&
              "Расчёт завершён"}
          </span>
        </div>
      </div>
    </div>
  );
}
