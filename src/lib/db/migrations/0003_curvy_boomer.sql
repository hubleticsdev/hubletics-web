CREATE TYPE "public"."booking_type" AS ENUM('individual', 'private_group', 'public_group');--> statement-breakpoint
CREATE TABLE "individual_booking_details" (
	"bookingId" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"conversationId" text,
	"clientMessage" text,
	"coachRate" numeric(10, 2) NOT NULL,
	"clientPaysCents" integer NOT NULL,
	"platformFeeCents" integer NOT NULL,
	"coachPayoutCents" integer NOT NULL,
	"stripeTransferId" varchar(255),
	"stripePaymentIntentId" varchar(255),
	"paymentStatus" "booking_payment_status" NOT NULL,
	"paymentDueAt" timestamp,
	"clientConfirmedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "private_group_booking_details" (
	"bookingId" text PRIMARY KEY NOT NULL,
	"organizerId" text NOT NULL,
	"totalParticipants" integer NOT NULL,
	"pricePerPerson" numeric(10, 2) NOT NULL,
	"totalGrossCents" integer NOT NULL,
	"platformFeeCents" integer NOT NULL,
	"coachPayoutCents" integer NOT NULL,
	"stripeTransferId" varchar(255),
	"stripePaymentIntentId" varchar(255),
	"paymentStatus" "booking_payment_status" NOT NULL,
	"paymentDueAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "public_group_lesson_details" (
	"bookingId" text PRIMARY KEY NOT NULL,
	"maxParticipants" integer NOT NULL,
	"minParticipants" integer NOT NULL,
	"pricePerPerson" numeric(10, 2) NOT NULL,
	"capacityStatus" "booking_capacity_status" NOT NULL,
	"currentParticipants" integer DEFAULT 0 NOT NULL,
	"authorizedParticipants" integer DEFAULT 0 NOT NULL,
	"capturedParticipants" integer DEFAULT 0 NOT NULL,
	"stripeTransferId" varchar(255),
	"recurringLessonId" text
);
--> statement-breakpoint
ALTER TABLE "booking" DROP CONSTRAINT "booking_clientId_user_id_fk";
--> statement-breakpoint
ALTER TABLE "booking" DROP CONSTRAINT "booking_conversationId_conversation_id_fk";
--> statement-breakpoint
ALTER TABLE "booking" DROP CONSTRAINT "booking_organizerId_user_id_fk";
--> statement-breakpoint
DROP INDEX "booking_client_idx";--> statement-breakpoint
DROP INDEX "booking_payment_status_idx";--> statement-breakpoint
DROP INDEX "booking_group_type_idx";--> statement-breakpoint
DROP INDEX "booking_organizer_idx";--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "bookingType" "booking_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "individual_booking_details" ADD CONSTRAINT "individual_booking_details_bookingId_booking_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "individual_booking_details" ADD CONSTRAINT "individual_booking_details_clientId_user_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "individual_booking_details" ADD CONSTRAINT "individual_booking_details_conversationId_conversation_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."conversation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_group_booking_details" ADD CONSTRAINT "private_group_booking_details_bookingId_booking_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_group_booking_details" ADD CONSTRAINT "private_group_booking_details_organizerId_user_id_fk" FOREIGN KEY ("organizerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_group_lesson_details" ADD CONSTRAINT "public_group_lesson_details_bookingId_booking_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_group_lesson_details" ADD CONSTRAINT "public_group_lesson_details_recurringLessonId_recurring_group_lesson_id_fk" FOREIGN KEY ("recurringLessonId") REFERENCES "public"."recurring_group_lesson"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_type_idx" ON "booking" USING btree ("bookingType");--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "clientId";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "conversationId";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "clientMessage";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "coachRate";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "pricePerPerson";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "expectedGrossCents";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "platformFeeCents";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "stripeFeeCents";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "coachPayoutCents";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "stripeTransferId";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "primaryStripePaymentIntentId";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "paymentDueAt";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "expiresAt";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "paymentFinalReminderSentAt";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "paymentStatus";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "capacityStatus";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "clientConfirmedAt";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "isGroupBooking";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "groupType";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "organizerId";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "maxParticipants";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "minParticipants";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "currentParticipants";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "authorizedParticipants";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "capturedParticipants";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "recurringLessonId";