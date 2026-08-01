-- Мягкое удаление блюда.
--
-- Жёсткое удаление рвало историю: deleteMenuItem обнуляло menuItemId у ВСЕХ
-- голосов за блюдо и winnerMenuItemId у ВСЕХ результатов, где оно побеждало, и
-- только потом удаляло запись. В завершённых опросах пропадал победитель.
--
-- Колонка nullable и без значения по умолчанию: старый код о ней не знает и
-- продолжает работать, поэтому миграцию безопасно накатывать ДО выкладки кода.
-- Так она и была накачена на проде 2026-08-02 отдельным контролируемым шагом
-- (бэкап снят до правки) — IF NOT EXISTS делает повторный прогон no-op, чтобы
-- `prisma migrate deploy` смог записать миграцию, ничего не сломав.

ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "menu_items_group_id_deleted_at_idx"
  ON "menu_items"("group_id", "deleted_at");
