/**
 * Деньги на главной: строка «Бюджет команды» и отметка об оплате.
 *
 * Долги и кредиты — отдельный от голосования сценарий, и на главной он живёт
 * ровно одной строкой. Вынесен из тела `HomePage` (задача 12), потому что
 * правка голосования не должна иметь возможности задеть деньги.
 *
 * Списки берутся деструктуризацией с умолчанием (`data: debts = []`), а не
 * `query.data ?? []`: второй вариант создаёт новый массив на каждый рендер и
 * ломает мемоизацию `budgetRow` ниже.
 */
import { useMemo } from 'react';

import { useCredits, useDebts, useMarkPaid } from '@/hooks/useBudget';
import { budgetRow } from '../lib/selectors';

export function useHomeBudget() {
  const debtsQuery = useDebts();
  const { data: debts = [] } = debtsQuery;
  const creditsQuery = useCredits();
  const { data: credits = [] } = creditsQuery;
  const markPaid = useMarkPaid();

  const budget = useMemo(() => budgetRow(debts, credits), [debts, credits]);

  return {
    budget,
    markPaid,
    /* Для барьера первого экрана — целые запросы, а не распакованные списки. */
    queries: { debtsQuery, creditsQuery },
  };
}
