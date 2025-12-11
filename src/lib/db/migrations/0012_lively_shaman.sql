CREATE TYPE "public"."group_type" AS ENUM('private', 'public');--> statement-breakpoint
CREATE TYPE "public"."participant_payment_status" AS ENUM('pending', 'paid', 'refunded');--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE 'open';--> statement-breakpoint
CREATE TABLE "booking_participant" (
	"id" text PRIMARY KEY NOT NULL,
	"bookingId" text NOT NULL,
	"userId" text NOT NULL,
	"paymentStatus" "participant_payment_status" DEFAULT 'pending' NOT NULL,
	"amountPaid" numeric(10, 2),
	"stripePaymentIntentId" varchar(255),
	"joinedAt" timestamp DEFAULT now() NOT NULL,
	"cancelledAt" timestamp,
	"refundedAt" timestamp,
	"refundAmount" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "group_pricing_tier" (
	"id" text PRIMARY KEY NOT NULL,
	"coachId" text NOT NULL,
	"minParticipants" integer NOT NULL,
	"maxParticipants" integer,
	"pricePerPerson" numeric(10, 2) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_group_lesson" (
	"id" text PRIMARY KEY NOT NULL,
	"coachId" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"dayOfWeek" integer NOT NULL,
	"startTime" time NOT NULL,
	"duration" integer NOT NULL,
	"maxParticipants" integer NOT NULL,
	"minParticipants" integer NOT NULL,
	"pricePerPerson" numeric(10, 2) NOT NULL,
	"location" jsonb NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"startDate" date NOT NULL,
	"endDate" date,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "isGroupBooking" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "groupType" "group_type";--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "organizerId" text;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "maxParticipants" integer;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "minParticipants" integer;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "pricePerPerson" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "currentParticipants" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "coach_profile" ADD COLUMN "groupBookingsEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_profile" ADD COLUMN "allowPrivateGroups" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_profile" ADD COLUMN "allowPublicGroups" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_participant" ADD CONSTRAINT "booking_participant_bookingId_booking_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_participant" ADD CONSTRAINT "booking_participant_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_pricing_tier" ADD CONSTRAINT "group_pricing_tier_coachId_user_id_fk" FOREIGN KEY ("coachId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_group_lesson" ADD CONSTRAINT "recurring_group_lesson_coachId_user_id_fk" FOREIGN KEY ("coachId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_participant_unique_idx" ON "booking_participant" USING btree ("bookingId","userId");--> statement-breakpoint
CREATE INDEX "booking_participant_booking_idx" ON "booking_participant" USING btree ("bookingId");--> statement-breakpoint
CREATE INDEX "booking_participant_user_idx" ON "booking_participant" USING btree ("userId");--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_organizerId_user_id_fk" FOREIGN KEY ("organizerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_group_type_idx" ON "booking" USING btree ("groupType");--> statement-breakpoint
CREATE INDEX "booking_organizer_idx" ON "booking" USING btree ("organizerId");--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "timezone";