ALTER TABLE "booking" ADD COLUMN "paymentDueAt" timestamp;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "paymentCompletedAt" timestamp;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "paymentReminderSentAt" timestamp;