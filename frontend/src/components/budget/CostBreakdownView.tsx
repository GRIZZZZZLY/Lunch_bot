import { useQuery } from '@tanstack/react-query';
import { budgetService } from '../../services/budget.service';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import {
  Receipt,
  TruckIcon,
  Percent,
  Heart,
  DollarSign,
  Users,
  Info
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

interface CostBreakdownViewProps {
  pollId: number;
  userId?: number; // Для выделения текущего пользователя
}

/**
 * Детальная разбивка расходов по заказу
 * Показывает как общие суммы, так и индивидуальные доли
 */
export const CostBreakdownView = ({
  pollId,
  userId,
}: CostBreakdownViewProps) => {
  const { data: breakdown, isLoading } = useQuery({
    queryKey: ['pollCostBreakdown', pollId],
    queryFn: () => budgetService.getPollCostBreakdown(pollId),
    staleTime: 30000, // 30 seconds
  });

  if (isLoading) {
    return (
      <Card className="p-4 space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </Card>
    );
  }

  if (!breakdown) {
    return null;
  }

  const hasAdditionalCosts =
    (breakdown.totalDeliveryCost || 0) > 0 ||
    (breakdown.totalServiceFee || 0) > 0 ||
    (breakdown.totalTip || 0) > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Receipt className={`${ICON_SIZES.md} text-primary`} />
        <h3 className="text-lg font-semibold">Разбивка расходов</h3>
        {breakdown.orderCosts && (
          <Badge variant="secondary" className="ml-auto">
            {new Date(breakdown.orderCosts.enteredAt).toLocaleDateString('ru-RU')}
          </Badge>
        )}
      </div>

      {/* Total Summary */}
      <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Receipt className={ICON_SIZES.sm} />
              Стоимость блюд
            </span>
            <span className="text-lg font-semibold">{breakdown.totalItemsCost.toFixed(2)} ₽</span>
          </div>

          {hasAdditionalCosts && (
            <>
              {breakdown.totalDeliveryCost > 0 && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <TruckIcon className={ICON_SIZES.sm} />
                    Доставка
                  </span>
                  <span className="text-lg font-semibold">
                    {breakdown.totalDeliveryCost.toFixed(2)} ₽
                  </span>
                </div>
              )}

              {breakdown.totalServiceFee > 0 && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Percent className={ICON_SIZES.sm} />
                    Комиссия
                  </span>
                  <span className="text-lg font-semibold">
                    {breakdown.totalServiceFee.toFixed(2)} ₽
                  </span>
                </div>
              )}

              {breakdown.totalTip > 0 && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Heart className={ICON_SIZES.sm} />
                    Чаевые
                  </span>
                  <span className="text-lg font-semibold">{breakdown.totalTip.toFixed(2)} ₽</span>
                </div>
              )}
            </>
          )}

          <div className="h-px bg-border my-2" />

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold">
              <DollarSign className={ICON_SIZES.md} />
              Итого
            </span>
            <span className="text-2xl font-bold text-primary">
              {breakdown.grandTotal.toFixed(2)} ₽
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className={ICON_SIZES.sm} />
            <span>Участников: {breakdown.participantsCount}</span>
          </div>
        </div>
      </Card>

      {/* Notes */}
      {breakdown.orderCosts?.notes && (
        <Card className="p-3 bg-muted/50">
          <p className="text-sm text-muted-foreground flex items-start gap-2">
            <Info className={`${ICON_SIZES.sm} mt-0.5 flex-shrink-0`} />
            <span>{breakdown.orderCosts.notes}</span>
          </p>
        </Card>
      )}

      {/* Individual Breakdown Table */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b bg-muted/50">
          <h4 className="font-semibold flex items-center gap-2">
            <Users className={ICON_SIZES.sm} />
            Детали по участникам
          </h4>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Участник</TableHead>
                <TableHead>Блюдо</TableHead>
                <TableHead className="text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="inline-flex items-center gap-1">
                        Цена
                        <Info className={ICON_SIZES.xs} />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Стоимость блюда</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                {hasAdditionalCosts && (
                  <>
                    {breakdown.totalDeliveryCost > 0 && (
                      <TableHead className="text-right">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="inline-flex items-center gap-1">
                              <TruckIcon className={ICON_SIZES.xs} />
                              <Info className={ICON_SIZES.xs} />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Доля доставки</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                    )}
                    {breakdown.totalServiceFee > 0 && (
                      <TableHead className="text-right">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="inline-flex items-center gap-1">
                              <Percent className={ICON_SIZES.xs} />
                              <Info className={ICON_SIZES.xs} />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Доля комиссии</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                    )}
                    {breakdown.totalTip > 0 && (
                      <TableHead className="text-right">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="inline-flex items-center gap-1">
                              <Heart className={ICON_SIZES.xs} />
                              <Info className={ICON_SIZES.xs} />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Доля чаевых</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                    )}
                  </>
                )}
                <TableHead className="text-right font-semibold">Итого</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdown.transactions.map((tx) => {
                const isCurrentUser = userId && tx.userId === userId;

                return (
                  <TableRow
                    key={tx.transactionId}
                    className={cn(isCurrentUser && 'bg-primary/5')}
                  >
                    <TableCell className="font-medium">
                      {tx.userName}
                      {isCurrentUser && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Ты
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {tx.menuItemName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {tx.itemPrice.toFixed(2)} ₽
                    </TableCell>
                    {hasAdditionalCosts && (
                      <>
                        {breakdown.totalDeliveryCost > 0 && (
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            +{tx.deliveryShare.toFixed(2)} ₽
                          </TableCell>
                        )}
                        {breakdown.totalServiceFee > 0 && (
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            +{tx.serviceShare.toFixed(2)} ₽
                          </TableCell>
                        )}
                        {breakdown.totalTip > 0 && (
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            +{tx.tipShare.toFixed(2)} ₽
                          </TableCell>
                        )}
                      </>
                    )}
                    <TableCell className="text-right font-semibold tabular-nums">
                      {tx.totalAmount.toFixed(2)} ₽
                    </TableCell>
                    <TableCell>
                      {tx.status === 'CONFIRMED' && (
                        <Badge variant="default" className="bg-green-500">
                          ✓ Оплачено
                        </Badge>
                      )}
                      {tx.status === 'PAID' && (
                        <Badge variant="secondary">⏳ Ожидает</Badge>
                      )}
                      {tx.status === 'PENDING' && (
                        <Badge variant="outline">⏰ Не оплачено</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
