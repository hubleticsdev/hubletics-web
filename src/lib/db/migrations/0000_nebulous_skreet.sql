CREATE TYPE "public"."admin_action_type" AS ENUM('approved_coach', 'rejected_coach', 'banned_user', 'suspended_user', 'warned_user', 'deleted_account', 'processed_refund', 'reviewed_message');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending', 'accepted', 'declined', 'cancelled', 'completed', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."flagged_message_action" AS ENUM('no_action', 'warning_sent', 'message_deleted', 'user_suspended', 'user_banned');--> statement-breakpoint
CREATE TYPE "public"."refund_amount" AS ENUM('full', 'partial');--> statement-breakpoint
CREATE TYPE "public"."refund_reason" AS ENUM('coach_no_show', 'coach_cancelled_last_minute', 'unprofessional', 'poor_quality', 'safety_concern', 'other');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'approved', 'denied');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('client', 'coach', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'banned', 'deactivated');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_action" (
	"id" text PRIMARY KEY NOT NULL,
	"adminId" text NOT NULL,
	"action" "admin_action_type" NOT NULL,
	"targetUserId" text,
	"relatedEntityId" text,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "athlete_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"fullName" varchar(255) NOT NULL,
	"profilePhoto" text,
	"location" jsonb NOT NULL,
	"sportsInterested" text[] NOT NULL,
	"experienceLevel" jsonb NOT NULL,
	"budgetRange" jsonb NOT NULL,
	"availability" jsonb NOT NULL,
	"bio" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "athlete_profile_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"coachId" text NOT NULL,
	"conversationId" text,
	"scheduledStartAt" timestamp with time zone NOT NULL,
	"scheduledEndAt" timestamp with time zone NOT NULL,
	"duration" integer NOT NULL,
	"location" jsonb NOT NULL,
	"clientMessage" text,
	"coachRate" numeric(10, 2) NOT NULL,
	"clientPaid" numeric(10, 2) NOT NULL,
	"platformFee" numeric(10, 2) NOT NULL,
	"stripeFee" numeric(10, 2) NOT NULL,
	"coachPayout" numeric(10, 2) NOT NULL,
	"stripePaymentIntentId" varchar(255),
	"stripeTransferId" varchar(255),
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"coachRespondedAt" timestamp,
	"proposedAlternateTime" jsonb,
	"markedCompleteByCoach" boolean DEFAULT false NOT NULL,
	"markedCompleteByCoachAt" timestamp,
	"confirmedByClient" boolean DEFAULT false NOT NULL,
	"confirmedByClientAt" timestamp,
	"cancelledBy" text,
	"cancelledAt" timestamp,
	"cancellationReason" text,
	"refundAmount" numeric(10, 2),
	"refundProcessedAt" timestamp,
	"idempotencyKey" varchar(255),
	"lockedUntil" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "booking_stripePaymentIntentId_unique" UNIQUE("stripePaymentIntentId"),
	CONSTRAINT "booking_idempotencyKey_unique" UNIQUE("idempotencyKey")
);
--> statement-breakpoint
CREATE TABLE "coach_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"fullName" varchar(255) NOT NULL,
	"profilePhoto" text,
	"introVideo" text NOT NULL,
	"location" jsonb NOT NULL,
	"specialties" jsonb NOT NULL,
	"bio" text NOT NULL,
	"certifications" jsonb,
	"accomplishments" text,
	"hourlyRate" numeric(10, 2) NOT NULL,
	"sessionDuration" integer DEFAULT 60 NOT NULL,
	"preferredLocations" jsonb,
	"weeklyAvailability" jsonb NOT NULL,
	"blockedDates" date[],
	"stripeAccountId" varchar(255),
	"stripeOnboardingComplete" boolean DEFAULT false NOT NULL,
	"adminApprovalStatus" "approval_status" DEFAULT 'pending' NOT NULL,
	"adminApprovedAt" timestamp,
	"adminApprovedBy" text,
	"reputationScore" numeric(3, 2) DEFAULT '0.00' NOT NULL,
	"totalReviews" integer DEFAULT 0 NOT NULL,
	"totalLessonsCompleted" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"updatedBy" text,
	CONSTRAINT "coach_profile_userId_unique" UNIQUE("userId"),
	CONSTRAINT "coach_profile_stripeAccountId_unique" UNIQUE("stripeAccountId")
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"coachId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastMessageAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "flagged_message" (
	"id" text PRIMARY KEY NOT NULL,
	"messageId" text NOT NULL,
	"conversationId" text NOT NULL,
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
CREATE TABLE "idempotency_key" (
	"id" text PRIMARY KEY NOT NULL,
	"key" varchar(255) NOT NULL,
	"result" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	CONSTRAINT "idempotency_key_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" text PRIMARY KEY NOT NULL,
	"conversationId" text NOT NULL,
	"senderId" text NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"readAt" timestamp,
	"flagged" boolean DEFAULT false NOT NULL,
	"flaggedReason" text
);
--> statement-breakpoint
CREATE TABLE "refund_request" (
	"id" text PRIMARY KEY NOT NULL,
	"bookingId" text NOT NULL,
	"requestedBy" text NOT NULL,
	"reason" "refund_reason" NOT NULL,
	"description" text NOT NULL,
	"evidencePhotos" text[],
	"requestedAmount" "refund_amount" NOT NULL,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"reviewedBy" text,
	"reviewedAt" timestamp,
	"adminNotes" text,
	"approvedAmount" numeric(10, 2),
	"stripeRefundId" varchar(255),
	"refundProcessedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" text PRIMARY KEY NOT NULL,
	"bookingId" text NOT NULL,
	"reviewerId" text NOT NULL,
	"coachId" text NOT NULL,
	"rating" integer NOT NULL,
	"reviewText" text,
	"flagged" boolean DEFAULT false NOT NULL,
	"flaggedReason" text,
	"adminReviewed" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "review_bookingId_unique" UNIQUE("bookingId")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"role" "user_role" DEFAULT 'client' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"lastLoginAt" timestamp,
	"deletedAt" timestamp,
	"deletedBy" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_action" ADD CONSTRAINT "admin_action_adminId_user_id_fk" FOREIGN KEY ("adminId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_action" ADD CONSTRAINT "admin_action_targetUserId_user_id_fk" FOREIGN KEY ("targetUserId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_profile" ADD CONSTRAINT "athlete_profile_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_clientId_user_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_coachId_user_id_fk" FOREIGN KEY ("coachId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_conversationId_conversation_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."conversation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_cancelledBy_user_id_fk" FOREIGN KEY ("cancelledBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_profile" ADD CONSTRAINT "coach_profile_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_profile" ADD CONSTRAINT "coach_profile_adminApprovedBy_user_id_fk" FOREIGN KEY ("adminApprovedBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_profile" ADD CONSTRAINT "coach_profile_updatedBy_user_id_fk" FOREIGN KEY ("updatedBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_clientId_user_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_coachId_user_id_fk" FOREIGN KEY ("coachId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagged_message" ADD CONSTRAINT "flagged_message_messageId_message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."message"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagged_message" ADD CONSTRAINT "flagged_message_conversationId_conversation_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."conversation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagged_message" ADD CONSTRAINT "flagged_message_senderId_user_id_fk" FOREIGN KEY ("senderId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagged_message" ADD CONSTRAINT "flagged_message_reviewedBy_user_id_fk" FOREIGN KEY ("reviewedBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversationId_conversation_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_senderId_user_id_fk" FOREIGN KEY ("senderId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_request" ADD CONSTRAINT "refund_request_bookingId_booking_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_request" ADD CONSTRAINT "refund_request_requestedBy_user_id_fk" FOREIGN KEY ("requestedBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_request" ADD CONSTRAINT "refund_request_reviewedBy_user_id_fk" FOREIGN KEY ("reviewedBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_bookingId_booking_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_reviewerId_user_id_fk" FOREIGN KEY ("reviewerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_coachId_user_id_fk" FOREIGN KEY ("coachId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "booking_client_idx" ON "booking" USING btree ("clientId");--> statement-breakpoint
CREATE INDEX "booking_coach_idx" ON "booking" USING btree ("coachId");--> statement-breakpoint
CREATE INDEX "booking_status_idx" ON "booking" USING btree ("status");--> statement-breakpoint
CREATE INDEX "booking_scheduled_start_idx" ON "booking" USING btree ("scheduledStartAt");--> statement-breakpoint
CREATE INDEX "booking_payment_intent_idx" ON "booking" USING btree ("stripePaymentIntentId");--> statement-breakpoint
CREATE INDEX "booking_coach_date_status_idx" ON "booking" USING btree ("coachId","scheduledStartAt","status");--> statement-breakpoint
CREATE INDEX "coach_location_idx" ON "coach_profile" USING gin ("location");--> statement-breakpoint
CREATE INDEX "coach_specialties_idx" ON "coach_profile" USING gin ("specialties");--> statement-breakpoint
CREATE INDEX "coach_reputation_idx" ON "coach_profile" USING btree ("reputationScore");--> statement-breakpoint
CREATE INDEX "coach_approval_status_idx" ON "coach_profile" USING btree ("adminApprovalStatus");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_unique_pair_idx" ON "conversation" USING btree ("clientId","coachId");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_key_idx" ON "idempotency_key" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idempotency_key_expires_idx" ON "idempotency_key" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "message_conversation_idx" ON "message" USING btree ("conversationId","createdAt");--> statement-breakpoint
CREATE INDEX "message_sender_idx" ON "message" USING btree ("senderId");--> statement-breakpoint
CREATE INDEX "message_flagged_idx" ON "message" USING btree ("flagged") WHERE "message"."flagged" = true;--> statement-breakpoint
CREATE INDEX "review_coach_idx" ON "review" USING btree ("coachId");--> statement-breakpoint
CREATE INDEX "review_booking_idx" ON "review" USING btree ("bookingId");--> statement-breakpoint
CREATE INDEX "review_coach_created_idx" ON "review" USING btree ("coachId","createdAt");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "user" USING btree ("role");--> statement-breakpoint
CREATE INDEX "user_status_idx" ON "user" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_deleted_at_idx" ON "user" USING btree ("deletedAt");