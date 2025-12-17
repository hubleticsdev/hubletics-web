ALTER TABLE "booking_participant" ADD COLUMN "stripeFeeCents" integer;--> statement-breakpoint
ALTER TABLE "individual_booking_details" ADD COLUMN "stripeFeeCents" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "private_group_booking_details" ADD COLUMN "stripeFeeCents" integer NOT NULL;