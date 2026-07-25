-- Начисление опыта должно иметь устойчивый ключ события. PostgreSQL допускает
-- несколько NULL в UNIQUE, поэтому старые и явно ручные начисления совместимы.
ALTER TABLE "xp_history"
  ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "xp_history_idempotency_key_key"
  ON "xp_history"("idempotency_key");
