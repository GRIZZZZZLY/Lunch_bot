import { useMemo, useState } from 'react';

export interface CalcParticipant {
  id: string;
  name: string;
  initial: string;
  skipReason?: string;
}

export interface CalculatorResult {
  total: number;
  mode: 'even' | 'manual';
  shares: { participantId: string; amount: number }[];
}

interface Props {
  open: boolean;
  participants: CalcParticipant[];
  defaultTotal?: number;
  onClose: () => void;
  onSubmit: (result: CalculatorResult) => void;
}

export function CalculatorModal({
  open,
  participants,
  defaultTotal = 0,
  onClose,
  onSubmit,
}: Props) {
  const [total, setTotal] = useState(defaultTotal);
  const [mode, setMode] = useState<'even' | 'manual'>('even');
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(participants.map((p) => p.id)),
  );
  const [manual, setManual] = useState<Record<string, number>>({});

  const activeCount = selected.size;
  const evenShare = activeCount > 0 ? Math.round(total / activeCount) : 0;

  const shares = useMemo(() => {
    if (mode === 'even') {
      return participants.map((p) => ({
        participantId: p.id,
        amount: selected.has(p.id) ? evenShare : 0,
      }));
    }
    return participants.map((p) => ({
      participantId: p.id,
      amount: selected.has(p.id) ? manual[p.id] ?? 0 : 0,
    }));
  }, [mode, participants, selected, evenShare, manual]);

  const previewTotal = shares.reduce((s, sh) => s + sh.amount, 0);

  if (!open) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    onSubmit({ total, mode, shares });
  }

  return (
    <div className="modal-dim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="st">Рассчитать расходы</div>
        <div className="sd">Введите общую сумму и выберите, кого включить.</div>

        <div className="calc-label">Общая сумма заказа</div>
        <div className="calc-input">
          <input
            inputMode="numeric"
            value={total === 0 ? '' : total.toLocaleString('ru-RU')}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/\D/g, ''));
              setTotal(Number.isFinite(n) ? n : 0);
            }}
          />
          <span className="unit">₽</span>
        </div>

        <div className="calc-mode">
          <button
            type="button"
            className={mode === 'even' ? 'on' : ''}
            onClick={() => setMode('even')}
          >
            Разделить поровну
          </button>
          <button
            type="button"
            className={mode === 'manual' ? 'on' : ''}
            onClick={() => setMode('manual')}
          >
            Ввести вручную
          </button>
        </div>

        <div className="calc-label">Участники · {activeCount} выбрано</div>
        <div className="calc-plist">
          {participants.map((p) => {
            const on = selected.has(p.id);
            const amount =
              mode === 'even' ? (on ? evenShare : 0) : manual[p.id] ?? 0;
            return (
              <div
                key={p.id}
                className={`calc-prow ${on ? 'on' : 'off'}`}
                onClick={() => toggle(p.id)}
              >
                <div className="chk" />
                <div className="pav">{p.initial}</div>
                <div className="pn">
                  {p.name}
                  {p.skipReason ? ` · ${p.skipReason}` : ''}
                </div>
                {mode === 'even' ? (
                  <div className="pa">{amount} ₽</div>
                ) : (
                  <input
                    className="pa"
                    inputMode="numeric"
                    value={amount || ''}
                    disabled={!on}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(/\D/g, ''));
                      setManual((prev) => ({ ...prev, [p.id]: Number.isFinite(n) ? n : 0 }));
                    }}
                    style={{ width: 70, textAlign: 'right' }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="calc-preview">
          <div className="pl">
            {mode === 'even'
              ? `по ${evenShare} ₽ × ${activeCount}`
              : 'вручную'}
          </div>
          <div className="pv">{previewTotal.toLocaleString('ru-RU')} ₽</div>
        </div>

        <button
          type="button"
          className="calc-cta"
          onClick={handleSubmit}
          disabled={total <= 0 || activeCount === 0}
        >
          Создать транзакции →
        </button>
      </div>
    </div>
  );
}
