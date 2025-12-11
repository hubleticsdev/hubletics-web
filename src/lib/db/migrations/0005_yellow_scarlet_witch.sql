ALTER TABLE "flagged_message" DROP CONSTRAINT "flagged_message_messageId_message_id_fk";
--> statement-breakpoint
ALTER TABLE "flagged_message" DROP CONSTRAINT "flagged_message_conversationId_conversation_id_fk";
--> statement-breakpoint
ALTER TABLE "message" DROP CONSTRAINT "message_senderId_user_id_fk";
--> statement-breakpoint
ALTER TABLE "message" ALTER COLUMN "senderId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "username" varchar(30) NOT NULL;--> statement-breakpoint
ALTER TABLE "flagged_message" ADD CONSTRAINT "flagged_message_messageId_message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagged_message" ADD CONSTRAINT "flagged_message_conversationId_conversation_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_senderId_user_id_fk" FOREIGN KEY ("senderId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_username_idx" ON "user" USING btree ("username");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_username_unique" UNIQUE("username");