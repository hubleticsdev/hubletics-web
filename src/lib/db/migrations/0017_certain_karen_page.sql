CREATE TABLE "flagged_group_message" (
	"id" text PRIMARY KEY NOT NULL,
	"groupMessageId" text NOT NULL,
	"groupConversationId" text NOT NULL,
	"senderId" text NOT NULL,
	"content" text NOT NULL,
	"violations" text[] NOT NULL,
	"reviewedAt" timestamp,
	"reviewedBy" text,
	"action" "flagged_message_action",
	"adminNotes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flagged_message" DROP CONSTRAINT "flagged_message_groupMessageId_group_message_id_fk";
--> statement-breakpoint
ALTER TABLE "flagged_message" DROP CONSTRAINT "flagged_message_groupConversationId_group_conversation_id_fk";
--> statement-breakpoint
DROP INDEX "flagged_message_message_check_idx";--> statement-breakpoint
ALTER TABLE "flagged_message" ALTER COLUMN "messageId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "flagged_message" ALTER COLUMN "conversationId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "flagged_group_message" ADD CONSTRAINT "flagged_group_message_groupMessageId_group_message_id_fk" FOREIGN KEY ("groupMessageId") REFERENCES "public"."group_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagged_group_message" ADD CONSTRAINT "flagged_group_message_groupConversationId_group_conversation_id_fk" FOREIGN KEY ("groupConversationId") REFERENCES "public"."group_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagged_group_message" ADD CONSTRAINT "flagged_group_message_senderId_user_id_fk" FOREIGN KEY ("senderId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagged_group_message" ADD CONSTRAINT "flagged_group_message_reviewedBy_user_id_fk" FOREIGN KEY ("reviewedBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagged_message" DROP COLUMN "groupMessageId";--> statement-breakpoint
ALTER TABLE "flagged_message" DROP COLUMN "messageType";--> statement-breakpoint
ALTER TABLE "flagged_message" DROP COLUMN "groupConversationId";--> statement-breakpoint
DROP TYPE "public"."flagged_message_type";