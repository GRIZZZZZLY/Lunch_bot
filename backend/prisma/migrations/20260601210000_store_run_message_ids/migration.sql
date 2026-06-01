-- Add group message id and DM message ids to store_runs for deletion on cancel
ALTER TABLE "store_runs" ADD COLUMN "group_message_id" INTEGER;
ALTER TABLE "store_runs" ADD COLUMN "dm_messages" TEXT;
