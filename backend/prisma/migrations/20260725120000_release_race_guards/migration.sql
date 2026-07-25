DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM store_runs
    WHERE status IN ('COLLECTING', 'SHOPPING')
    GROUP BY initiator_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot add active store-run guard: an initiator has multiple active runs';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM transactions
    WHERE category_order_id IS NOT NULL
    GROUP BY category_order_id, from_user_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot add category transaction guard: duplicate debtor transactions exist';
  END IF;
END
$$;

ALTER TABLE "group_members"
ADD COLUMN "participates_in_polls" boolean NOT NULL DEFAULT true;

UPDATE "group_members" AS gm
SET "participates_in_polls" = u."participates_in_polls"
FROM "users" AS u
WHERE u."id" = gm."user_id";

CREATE UNIQUE INDEX "store_runs_one_active_per_initiator"
ON "store_runs" ("initiator_id")
WHERE "status" IN ('COLLECTING', 'SHOPPING');

CREATE UNIQUE INDEX "transactions_category_order_debtor_key"
ON "transactions" ("category_order_id", "from_user_id");

CREATE OR REPLACE FUNCTION guard_completed_category_order_items()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_category_order_id integer;
  target_status text;
BEGIN
  target_category_order_id :=
    CASE WHEN TG_OP = 'DELETE'
      THEN OLD.category_order_id
      ELSE NEW.category_order_id
    END;

  SELECT calculation_status
  INTO target_status
  FROM category_orders
  WHERE id = target_category_order_id
  FOR UPDATE;

  IF target_status = 'COMPLETED' THEN
    RAISE EXCEPTION
      'Order items of a completed category order cannot be changed';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "order_items_completed_category_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "order_items"
FOR EACH ROW
EXECUTE FUNCTION guard_completed_category_order_items();
