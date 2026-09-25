/* Подсказка там, где человек становится получателем денег: без реквизитов
   должникам некуда переводить. Форма открывается тут же, поверх экрана, и
   начатое (лист закупки, экран бюджета) не теряется.

   Реквизиты запрашиваются, только пока подсказка смонтирована, а форма
   грузится отдельным чанком по нажатию: главная у порога скорости и не должна
   платить за это на старте. */
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { usePaymentInfo, useUpdatePaymentInfo } from '@/hooks/useUser';
import { hasPaymentInfo } from '@/shared/lib/phone';
import { Button } from '@/components/rl/primitives';
import { InlineNotice } from '@/shared/ui';

const EditPaymentInfoSheet = lazy(() =>
  import('./EditPaymentInfoSheet').then((m) => ({ default: m.EditPaymentInfoSheet })),
);

/** `className` — у обёртки, которая есть только вместе с подсказкой: отступы
    экрана не остаются пустой полосой, когда реквизиты на месте. */
export function PaymentMissingNotice({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const info = usePaymentInfo();
  const update = useUpdatePaymentInfo();
  const [open, setOpen] = useState(false);

  /* «Реквизитов нет» — только по прочитанному ответу: пока он грузится или
     чтение упало, подсказка соврала бы. */
  const missing = info.isSuccess && !hasPaymentInfo(info.data);
  if (!missing && !open) return null;

  return (
    <>
      {missing && (
        <div className={className}>
          <InlineNotice tone="warning">
            {children}
            <div style={{ marginTop: 'var(--space-2)' }}>
              <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
                Указать реквизиты
              </Button>
            </div>
          </InlineNotice>
        </div>
      )}
      {open && (
        <Suspense fallback={null}>
          <EditPaymentInfoSheet
            open
            initial={info.data}
            busy={update.isPending}
            onClose={() => setOpen(false)}
            onSubmit={async (data) => {
              /* Промис возвращается листу: отказ он показывает сам. */
              await update.mutateAsync(data);
              setOpen(false);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
