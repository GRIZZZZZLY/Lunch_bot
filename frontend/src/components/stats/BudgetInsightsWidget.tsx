import { useEffect, useState } from 'react';
import { m } from 'framer-motion';
import { DollarSign, TrendingDown, PiggyBank } from 'lucide-react';
import {
  BudgetInsightApiData,
  CategoryInsightApiData,
  insightsApiService,
} from '../../services/insights.service';
import {
  PastelCard,
  CardHeader,
  CardTitle,
  CardContent,
} from '../ui/pastel-card';
import { useAppStore } from '../../store/useAppStore';

const emptyBudget: BudgetInsightApiData = {
  averagePerDay: 0,
  daysActive: 0,
  projectedMonthly: 0,
  savingsVsExternal: 0,
  totalSpent: 0,
  trend: 'stable',
};

export function BudgetInsightsWidget() {
  const isDark = useAppStore((s) => s.theme) === 'dark';
  const [budget, setBudget] = useState<BudgetInsightApiData>(emptyBudget);
  const [categories, setCategories] = useState<CategoryInsightApiData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadInsights() {
      try {
        setLoading(true);
        setFailed(false);

        const [budgetResponse, categoryResponse] = await Promise.all([
          insightsApiService.getBudgetInsights(),
          insightsApiService.getCategoryInsights(),
        ]);

        if (!cancelled) {
          setBudget(
            budgetResponse.success && budgetResponse.data
              ? budgetResponse.data
              : emptyBudget
          );
          setCategories(
            categoryResponse.success && categoryResponse.data
              ? categoryResponse.data
              : null
          );
          setFailed(!budgetResponse.success || !categoryResponse.success);
        }
      } catch {
        if (!cancelled) {
          setBudget(emptyBudget);
          setCategories(null);
          setFailed(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInsights();

    return () => {
      cancelled = true;
    };
  }, []);

  const textMuted = isDark ? 'text-zinc-300' : 'text-zinc-700';
  const favoriteCategory = categories?.favoriteCategory;

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      <PastelCard variant="default">
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign
              className={`w-5 h-5 ${
                isDark ? 'text-peach-400' : 'text-peach-600'
              }`}
            />
            <CardTitle className="text-lg">Бюджет и аналитика</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading ? (
              <div className={`text-center py-4 text-sm ${textMuted}`}>
                Загружаем аналитику...
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isDark ? 'bg-green-500/20' : 'bg-green-100'
                      }`}
                    >
                      <TrendingDown
                        className={`w-5 h-5 ${
                          isDark ? 'text-green-400' : 'text-green-600'
                        }`}
                      />
                    </div>
                    <div>
                      <p className={`text-xs ${textMuted}`}>Средний чек</p>
                      <p className="text-lg font-semibold">
                        {budget.averagePerDay}₽
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isDark ? 'bg-peach-500/20' : 'bg-peach-100'
                      }`}
                    >
                      <PiggyBank
                        className={`w-5 h-5 ${
                          isDark ? 'text-peach-400' : 'text-peach-600'
                        }`}
                      />
                    </div>
                    <div>
                      <p className={`text-xs ${textMuted}`}>Экономия</p>
                      <p className="text-lg font-semibold">
                        {budget.savingsVsExternal}₽
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className={`rounded-xl border border-border/60 bg-muted/35 px-3 py-3 text-sm ${textMuted}`}
                >
                  {failed ? (
                    <p>Не удалось загрузить подробную аналитику</p>
                  ) : favoriteCategory ? (
                    <p>
                      Любимая категория:{' '}
                      <span className="font-medium">{favoriteCategory}</span>
                    </p>
                  ) : (
                    <p>Подробная аналитика появится после нескольких заказов</p>
                  )}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </PastelCard>
    </m.div>
  );
}
