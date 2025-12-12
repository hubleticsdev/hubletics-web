CREATE TABLE "group_conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"bookingId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastMessageAt" timestamp,
	CONSTRAINT "group_conversation_bookingId_unique" UNIQUE("bookingId")
);
--> statement-breakpoint
CREATE TABLE "group_conversation_participant" (
	"id" text PRIMARY KEY NOT NULL,
	"conversationId" text NOT NULL,
	"userId" text NOT NULL,
	"joinedAt" timestamp DEFAULT now() NOT NULL,
	"lastReadAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "group_message" (
	"id" text PRIMARY KEY NOT NULL,
	"conversationId" text NOT NULL,
	"senderId" text,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"readBy" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "recurringLessonId" text;--> statement-breakpoint
ALTER TABLE "group_conversation" ADD CONSTRAINT "group_conversation_bookingId_booking_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_conversation_participant" ADD CONSTRAINT "group_conversation_participant_conversationId_group_conversation_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."group_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_conversation_participant" ADD CONSTRAINT "group_conversation_participant_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_message" ADD CONSTRAINT "group_message_conversationId_group_conversation_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."group_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_message" ADD CONSTRAINT "group_message_senderId_user_id_fk" FOREIGN KEY ("senderId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "group_conv_participant_unique_idx" ON "group_conversation_participant" USING btree ("conversationId","userId");