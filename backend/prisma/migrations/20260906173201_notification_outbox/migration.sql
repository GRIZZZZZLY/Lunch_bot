-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "transition_version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" SERIAL NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "transition_version" INTEGER NOT NULL,
    "message_type" TEXT NOT NULL,
    "recipient_chat_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_until" TIMESTAMP(3),
    "sent_message_id" INTEGER,
    "sent_at" TIMESTAMP(3),
    "last_error_category" TEXT,
    "last_error_code" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_events_status_next_attempt_at_idx" ON "outbox_events"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "outbox_events_status_created_at_idx" ON "outbox_events"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_identity_key" ON "outbox_events"("entity_type", "entity_id", "transition_version", "message_type", "recipient_chat_id");
