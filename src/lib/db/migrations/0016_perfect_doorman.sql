CREATE TYPE "public"."flagged_message_type" AS ENUM('regular', 'group');--> statement-breakpoint
ALTER TABLE "flagged_message" ALTER COLUMN "messageId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "flagged_message" ALTER COLUMN "conversationId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "flagged_message" ADD COLUMN "groupMessageId" text;--> statement-breakpoint
ALTER TABLE "flagged_message" ADD COLUMN "messageType" "flagged_message_type" DEFAULT 'regular' NOT NULL;--> statement-breakpoint
ALTER TABLE "flagged_message" ADD COLUMN "groupConversationId" text;--> statement-breakpoint
ALTER TABLE "group_message" ADD COLUMN "flagged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "group_message" ADD COLUMN "flaggedReason" text;--> statement-breakpoint
ALTER TABLE "flagged_message" ADD CONSTRAINT "flagged_message_groupMessageId_group_message_id_fk" FOREIGN KEY ("groupMessageId") REFERENCES "public"."group_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagged_message" ADD CONSTRAINT "flagged_message_groupConversationId_group_conversation_id_fk" FOREIGN KEY ("groupConversationId") REFERENCES "public"."group_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "flagged_message_message_check_idx" ON "flagged_message" USING btree ("messageId" IS NOT NULL OR "groupMessageId" IS NOT NULL);