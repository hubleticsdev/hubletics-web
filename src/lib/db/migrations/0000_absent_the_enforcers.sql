CREATE TYPE "public"."admin_action_type" AS ENUM('approved_coach', 'rejected_coach', 'banned_user', 'suspended_user', 'warned_user', 'deleted_account', 'processed_refund', 'reviewed_message');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."booking_approval_status" AS ENUM('pending_review', 'accepted', 'declined', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."booking_capacity_status" AS ENUM('open', 'full', 'closed');--> statement-breakpoint
CREATE TYPE "public"."booking_fulfillment_status" AS ENUM('scheduled', 'completed', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."booking_payment_status" AS ENUM('not_required', 'awaiting_client_payment', 'authorized', 'captured', 'refunded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."flagged_message_action" AS ENUM('no_action', 'warning_sent', 'message_deleted', 'user_suspended', 'user_banned');--> statement-breakpoint
CREATE TYPE "public"."group_type" AS ENUM('private', 'public');--> statement-breakpoint
CREATE TYPE "public"."participant_payment_status" AS ENUM('requires_payment_method', 'authorized', 'captured', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."participant_status" AS ENUM('requested', 'awaiting_payment', 'awaiting_coach', 'accepted', 'declined', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."refund_amount" AS ENUM('full', 'partial');--> statement-breakpoint
CREATE TYPE "public"."refund_reason" AS ENUM('coach_no_show', 'coach_cancelled_last_minute', 'unprofessional', 'poor_quality', 'safety_concern', 'other');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'approved', 'denied');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('pending', 'client', 'coach', 'admin');--> statement-breakpoint
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
	"pricePerPerson" numeric(10, 2),
	"expectedGrossCents" integer,
	"platformFeeCents" integer,
	"stripeFeeCents" integer,
	"coachPayoutCents" integer,
	"stripeTransferId" varchar(255),
	"primaryStripePaymentIntentId" varchar(255),
	"paymentDueAt" timestamp,
	"expiresAt" timestamp,
	"paymentFinalReminderSentAt" timestamp,
	"approvalStatus" "booking_approval_status" DEFAULT 'pending_review' NOT NULL,
	"paymentStatus" "booking_payment_status" DEFAULT 'not_required' NOT NULL,
	"fulfillmentStatus" "booking_fulfillment_status" DEFAULT 'scheduled' NOT NULL,
	"capacityStatus" "booking_capacity_status",
	"coachRespondedAt" timestamp,
	"proposedAlternateTime" jsonb,
	"coachConfirmedAt" timestamp,
	"clientConfirmedAt" timestamp,
	"completedAt" timestamp,
	"cancelledBy" text,
	"cancelledAt" timestamp,
	"cancellationReason" text,
	"idempotencyKey" varchar(255),
	"lockedUntil" timestamp,
	"isGroupBooking" boolean DEFAULT false NOT NULL,
	"groupType" "group_type",
	"organizerId" text,
	"maxParticipants" integer,
	"minParticipants" integer,
	"currentParticipants" integer DEFAULT 0,
	"authorizedParticipants" integer DEFAULT 0,
	"capturedParticipants" integer DEFAULT 0,
	"recurringLessonId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "booking_idempotencyKey_unique" UNIQUE("idempotencyKey")
);
--> statement-breakpoint
CREATE TABLE "booking_participant" (
	"id" text PRIMARY KEY NOT NULL,
	"bookingId" text NOT NULL,
	"userId" text NOT NULL,
	"role" varchar(20) DEFAULT 'participant' NOT NULL,
	"status" "participant_status" DEFAULT 'requested' NOT NULL,
	"paymentStatus" "participant_payment_status" DEFAULT 'requires_payment_method' NOT NULL,
	"amountPaid" numeric(10, 2),
	"amountCents" integer,
	"stripePaymentIntentId" varchar(255),
	"expiresAt" timestamp,
	"authorizedAt" timestamp,
	"capturedAt" timestamp,
	"refundedAt" timestamp,
	"refundAmount" numeric(10, 2),
	"joinedAt" timestamp DEFAULT now() NOT NULL,
	"cancelledAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "booking_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"bookingId" text NOT NULL,
	"participantId" text,
	"stripePaymentIntentId" varchar(255) NOT NULL,
	"amountCents" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'usd' NOT NULL,
	"captureMethod" varchar(32) DEFAULT 'manual' NOT NULL,
	"status" varchar(50) NOT NULL,
	"lastEventAt" timestamp DEFAULT now() NOT NULL,
	"idempotencyKey" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_state_transition" (
	"id" text PRIMARY KEY NOT NULL,
	"bookingId" text NOT NULL,
	"participantId" text,
	"oldStatus" text NOT NULL,
	"newStatus" text NOT NULL,
	"changedBy" text,
	"reason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
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
	"groupBookingsEnabled" boolean DEFAULT false NOT NULL,
	"allowPrivateGroups" boolean DEFAULT false NOT NULL,
	"allowPublicGroups" boolean DEFAULT false NOT NULL,
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
	"readBy" jsonb DEFAULT '[]'::jsonb,
	"flagged" boolean DEFAULT false NOT NULL,
	"flaggedReason" text
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
	"senderId" text,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"readAt" timestamp,
	"flagged" boolean DEFAULT false NOT NULL,
	"flaggedReason" text
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
	"username" varchar(30) NOT NULL,
	"role" "user_role" DEFAULT 'client' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"profileComplete" boolean DEFAULT false NOT NULL,
	"lastLoginAt" timestamp,
	"platformFeePercentage" numeric(5, 2) DEFAULT '15.00' NOT NULL,
	"onboardingPhotoUrl" text,
	"onboardingVideoUrl" text,
	"deletedAt" timestamp,
	"deletedBy" text,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
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
ALTER TABLE "booking" ADD CONSTRAINT "booking_organizerId_user_id_fk" FOREIGN KEY ("organizerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_participant" ADD CONSTRAINT "booking_participant_bookingId_booking_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_participant" ADD CONSTRAINT "booking_participant_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_payment" ADD CONSTRAINT "booking_payment_bookingId_booking_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_payment" ADD CONSTRAINT "booking_payment_participantId_booking_participant_id_fk" FOREIGN KEY ("participantId") REFERENCES "public"."booking_participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_state_transition" ADD CONSTRAINT "booking_state_transition_bookingId_booking_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_state_transition" ADD CONSTRAINT "booking_state_transition_participantId_booking_participant_id_fk" FOREIGN KEY ("participantId") REFERENCES "public"."booking_participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_state_transition" ADD CONSTRAINT "booking_state_transition_changedBy_user_id_fk" FOREIGN KEY ("changedBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_profile" ADD CONSTRAINT "coach_profile_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_profile" ADD CONSTRAINT "coach_profile_adminApprovedBy_user_id_fk" FOREIGN KEY ("adminApprovedBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_profile" ADD CONSTRAINT "coach_profile_updatedBy_user_id_fk" FOREIGN KEY ("updatedBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_clientId_user_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_coachId_user_id_fk" FOREIGN KEY ("coachId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagged_group_message" ADD CONSTRAINT "flagged_group_message_groupMessageId_group_message_id_fk" FOREIGN KEY ("groupMessageId") REFERENCES "public"."group_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagged_group_message" ADD CONSTRAINT "flagged_group_message_groupConversationId_group_conversation_id_fk" FOREIGN KEY ("groupConversationId") REFERENCES "public"."group_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagged_group_message" ADD CONSTRAINT "flagged_group_message_senderId_user_id_fk" FOREIGN KEY ("senderId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagged_group_message" ADD CONSTRAINT "flagged_group_message_reviewedBy_user_id_fk" FOREIGN KEY ("reviewedBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagged_message" ADD CONSTRAINT "flagged_message_messageId_message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagged_message" ADD CONSTRAINT "flagged_message_conversationId_conversation_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagged_message" ADD CONSTRAINT "flagged_message_senderId_user_id_fk" FOREIGN KEY ("senderId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagged_message" ADD CONSTRAINT "flagged_message_reviewedBy_user_id_fk" FOREIGN KEY ("reviewedBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_conversation" ADD CONSTRAINT "group_conversation_bookingId_booking_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_conversation_participant" ADD CONSTRAINT "group_conversation_participant_conversationId_group_conversation_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."group_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_conversation_participant" ADD CONSTRAINT "group_conversation_participant_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_message" ADD CONSTRAINT "group_message_conversationId_group_conversation_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."group_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_message" ADD CONSTRAINT "group_message_senderId_user_id_fk" FOREIGN KEY ("senderId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_pricing_tier" ADD CONSTRAINT "group_pricing_tier_coachId_user_id_fk" FOREIGN KEY ("coachId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversationId_conversation_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_senderId_user_id_fk" FOREIGN KEY ("senderId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_group_lesson" ADD CONSTRAINT "recurring_group_lesson_coachId_user_id_fk" FOREIGN KEY ("coachId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "booking_approval_status_idx" ON "booking" USING btree ("approvalStatus");--> statement-breakpoint
CREATE INDEX "booking_payment_status_idx" ON "booking" USING btree ("paymentStatus");--> statement-breakpoint
CREATE INDEX "booking_fulfillment_status_idx" ON "booking" USING btree ("fulfillmentStatus");--> statement-breakpoint
CREATE INDEX "booking_scheduled_start_idx" ON "booking" USING btree ("scheduledStartAt");--> statement-breakpoint
CREATE INDEX "booking_coach_date_idx" ON "booking" USING btree ("coachId","scheduledStartAt");--> statement-breakpoint
CREATE INDEX "booking_group_type_idx" ON "booking" USING btree ("groupType");--> statement-breakpoint
CREATE INDEX "booking_organizer_idx" ON "booking" USING btree ("organizerId");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_participant_unique_idx" ON "booking_participant" USING btree ("bookingId","userId");--> statement-breakpoint
CREATE INDEX "booking_participant_booking_idx" ON "booking_participant" USING btree ("bookingId");--> statement-breakpoint
CREATE INDEX "booking_participant_user_idx" ON "booking_participant" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_payment_intent_unique_idx" ON "booking_payment" USING btree ("stripePaymentIntentId");--> statement-breakpoint
CREATE INDEX "booking_payment_booking_idx" ON "booking_payment" USING btree ("bookingId");--> statement-breakpoint
CREATE INDEX "booking_payment_participant_idx" ON "booking_payment" USING btree ("participantId");--> statement-breakpoint
CREATE INDEX "coach_location_idx" ON "coach_profile" USING gin ("location");--> statement-breakpoint
CREATE INDEX "coach_specialties_idx" ON "coach_profile" USING gin ("specialties");--> statement-breakpoint
CREATE INDEX "coach_reputation_idx" ON "coach_profile" USING btree ("reputationScore");--> statement-breakpoint
CREATE INDEX "coach_approval_status_idx" ON "coach_profile" USING btree ("adminApprovalStatus");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_unique_pair_idx" ON "conversation" USING btree ("clientId","coachId");--> statement-breakpoint
CREATE UNIQUE INDEX "group_conv_participant_unique_idx" ON "group_conversation_participant" USING btree ("conversationId","userId");--> statement-breakpoint
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
CREATE UNIQUE INDEX "user_username_idx" ON "user" USING btree ("username");--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "user" USING btree ("role");--> statement-breakpoint
CREATE INDEX "user_status_idx" ON "user" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_deleted_at_idx" ON "user" USING btree ("deletedAt");