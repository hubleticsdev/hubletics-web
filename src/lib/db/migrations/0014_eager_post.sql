CREATE TYPE "public"."payout_status" AS ENUM('pending', 'in_transit', 'paid', 'failed', 'canceled');--> statement-breakpoint
CREATE TABLE "coach_payout" (
	"id" text PRIMARY KEY NOT NULL,
	"coachId" text NOT NULL,
	"stripePayoutId" varchar(255) NOT NULL,
	"stripeAccountId" varchar(255) NOT NULL,
	"amountCents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'usd' NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"arrivalDate" timestamp,
	"failedReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coach_payout_stripePayoutId_unique" UNIQUE("stripePayoutId")
);
--> statement-breakpoint
ALTER TABLE "coach_payout" ADD CONSTRAINT "coach_payout_coachId_user_id_fk" FOREIGN KEY ("coachId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_payout_coach_idx" ON "coach_payout" USING btree ("coachId");--> statement-breakpoint
CREATE INDEX "coach_payout_account_idx" ON "coach_payout" USING btree ("stripeAccountId");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_payout_stripe_idx" ON "coach_payout" USING btree ("stripePayoutId");