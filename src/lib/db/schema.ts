/**
 * Hubletics Database Schema
 *
 * This schema integrates with better-auth for authentication and includes
 * all application-specific tables for the coaching marketplace platform.
 *
 * CLEANUP CONSIDERATIONS:
 *
 * 1. Expired Sessions:
 *    - Sessions have an expiresAt timestamp
 *    - Consider a cron job to delete sessions where expiresAt < NOW()
 *    - Frequency: Daily or weekly
 *
 * 2. Expired Verification Tokens:
 *    - Verification records have expiresAt timestamp
 *    - Should be cleaned up regularly to prevent table bloat
 *    - Frequency: Daily
 *
 * 3. Expired Idempotency Keys:
 *    - Idempotency keys have expiresAt timestamp
 *    - Clean up expired keys to maintain performance
 *    - Frequency: Daily
 *    - Index on expiresAt helps with efficient cleanup
 *
 * 4. Soft Deleted Users:
 *    - Users have deletedAt field for soft deletes
 *    - Consider permanent deletion after retention period (e.g., 90 days)
 *    - Ensure CASCADE behavior handles related records appropriately
 *
 * 5. Old Booking Locks:
 *    - Bookings have lockedUntil for preventing race conditions
 *    - Stale locks should be released if lockedUntil < NOW()
 *    - Can be done during booking queries or via periodic cleanup
 *
 * 6. Completed/Cancelled Bookings:
 *    - Consider archiving old bookings (> 1 year old) to separate table
 *    - Keep recent bookings for quick access and analytics
 *
 * 7. Old Messages:
 *    - Message history can grow large over time
 *    - Consider archiving messages older than retention period
 *    - Keep flagged messages separate for admin review
 *
 * AUDIT TRAIL:
 * - Key admin actions logged in admin_action table
 * - Consider adding createdBy/updatedBy fields to sensitive tables
 * - User soft deletes track deletedBy for accountability
 */

import {
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
  decimal,
  integer,
  jsonb,
  date,
  time,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ============================================================================
// ENUMS
// ============================================================================

export const userRoleEnum = pgEnum('user_role', ['pending', 'client', 'coach', 'admin']);
export const userStatusEnum = pgEnum('user_status', [
  'active',
  'suspended',
  'banned',
  'deactivated',
]);
export const approvalStatusEnum = pgEnum('approval_status', [
  'pending',
  'approved',
  'rejected',
]);
export const bookingStatusEnum = pgEnum('booking_status', [
  'pending',
  'accepted',
  'declined',
  'cancelled',
  'completed',
  'disputed',
]);
export const refundReasonEnum = pgEnum('refund_reason', [
  'coach_no_show',
  'coach_cancelled_last_minute',
  'unprofessional',
  'poor_quality',
  'safety_concern',
  'other',
]);
export const refundAmountEnum = pgEnum('refund_amount', ['full', 'partial']);
export const refundStatusEnum = pgEnum('refund_status', [
  'pending',
  'approved',
  'denied',
]);
export const adminActionTypeEnum = pgEnum('admin_action_type', [
  'approved_coach',
  'rejected_coach',
  'banned_user',
  'suspended_user',
  'warned_user',
  'deleted_account',
  'processed_refund',
  'reviewed_message',
]);
export const flaggedMessageActionEnum = pgEnum('flagged_message_action', [
  'no_action',
  'warning_sent',
  'message_deleted',
  'user_suspended',
  'user_banned',
]);

// ============================================================================
// BETTER-AUTH CORE TABLES
// ============================================================================

// User table (better-auth core table with our extensions)
export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('emailVerified').notNull().default(false),
    image: text('image'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),

    // Our custom extensions
    role: userRoleEnum('role').notNull().default('client'),
    status: userStatusEnum('status').notNull().default('active'),
    profileComplete: boolean('profileComplete').notNull().default(false),
    lastLoginAt: timestamp('lastLoginAt'),

    // Soft delete support
    deletedAt: timestamp('deletedAt'),
    deletedBy: text('deletedBy'), // Admin ID who performed deletion
  },
  (table) => [
    uniqueIndex('user_email_idx').on(table.email),
    index('user_role_idx').on(table.role),
    index('user_status_idx').on(table.status),
    index('user_deleted_at_idx').on(table.deletedAt),
  ]
);

// Session table (better-auth core table)
export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expiresAt').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_user_id_idx').on(table.userId)]
);

// Account table (better-auth core table for OAuth)
export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
    refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
    scope: text('scope'),
    password: text('password'), // For email/password auth
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [index('account_user_id_idx').on(table.userId)]
);

// Verification table (better-auth core table)
export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

// ============================================================================
// PROFILE TABLES
// ============================================================================

export const athleteProfile = pgTable('athlete_profile', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('userId')
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  fullName: varchar('fullName', { length: 255 }).notNull(),
  profilePhoto: text('profilePhoto'),
  location: jsonb('location').notNull().$type<{
    city: string;
    state: string;
  }>(),
  sportsInterested: text('sportsInterested').array().notNull(),
  experienceLevel: jsonb('experienceLevel').notNull().$type<
    Record<string, { level: string; notes?: string }>
  >(),
  budgetRange: jsonb('budgetRange').notNull().$type<
    { min: number; max: number } | { single: number }
  >(),
  availability: jsonb('availability').notNull().$type<
    Record<string, Array<{ start: string; end: string }>>
  >(), // { "Monday": [{ start: "09:00", end: "12:00" }], ... }
  bio: text('bio'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const coachProfile = pgTable(
  'coach_profile',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('userId')
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'cascade' }),
    fullName: varchar('fullName', { length: 255 }).notNull(),
    profilePhoto: text('profilePhoto'),
    introVideo: text('introVideo').notNull(),
    location: jsonb('location').notNull().$type<{
      cities: string[];
      state: string;
    }>(),
    specialties: jsonb('specialties').notNull().$type<
      Array<{ sport: string; tags: string[] }>
    >(),
    bio: text('bio').notNull(),
    certifications: jsonb('certifications').$type<
      Array<{
        name: string;
        org: string;
        issueDate: string;
        expDate?: string;
        fileUrl: string;
      }>
    >(),
    accomplishments: text('accomplishments'),
    hourlyRate: decimal('hourlyRate', { precision: 10, scale: 2 }).notNull(),
    sessionDuration: integer('sessionDuration').notNull().default(60),
    preferredLocations: jsonb('preferredLocations').$type<
      Array<{ name: string; address: string; notes?: string }>
    >(),
    weeklyAvailability: jsonb('weeklyAvailability').notNull().$type<
      Record<string, Array<{ start: string; end: string }>>
    >(), // { "Monday": [{ start: "09:00", end: "12:00" }, { start: "17:00", end: "20:00" }], ... }
    blockedDates: date('blockedDates', { mode: 'string' }).array(),
    stripeAccountId: varchar('stripeAccountId', { length: 255 }).unique(),
    stripeOnboardingComplete: boolean('stripeOnboardingComplete')
      .notNull()
      .default(false),
    adminApprovalStatus: approvalStatusEnum('adminApprovalStatus')
      .notNull()
      .default('pending'),
    adminApprovedAt: timestamp('adminApprovedAt'),
    adminApprovedBy: text('adminApprovedBy').references(() => user.id),
    reputationScore: decimal('reputationScore', { precision: 3, scale: 2 })
      .notNull()
      .default('0.00'),
    totalReviews: integer('totalReviews').notNull().default(0),
    totalLessonsCompleted: integer('totalLessonsCompleted')
      .notNull()
      .default(0),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),

    // Audit trail (who made changes to this profile)
    updatedBy: text('updatedBy').references(() => user.id),
  },
  (table) => [
    index('coach_location_idx').using('gin', table.location),
    index('coach_specialties_idx').using('gin', table.specialties),
    index('coach_reputation_idx').on(table.reputationScore),
    index('coach_approval_status_idx').on(table.adminApprovalStatus),
  ]
);

// ============================================================================
// MESSAGING TABLES
// ============================================================================

export const conversation = pgTable(
  'conversation',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clientId: text('clientId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    coachId: text('coachId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    lastMessageAt: timestamp('lastMessageAt'),
  },
  (table) => [
    uniqueIndex('conversation_unique_pair_idx').on(
      table.clientId,
      table.coachId
    ),
  ]
);

export const message = pgTable(
  'message',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversationId: text('conversationId')
      .notNull()
      .references(() => conversation.id, { onDelete: 'cascade' }),
    senderId: text('senderId')
      .notNull()
      .references(() => user.id),
    content: text('content').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    readAt: timestamp('readAt'),
    flagged: boolean('flagged').notNull().default(false),
    flaggedReason: text('flaggedReason'),
  },
  (table) => [
    index('message_conversation_idx').on(table.conversationId, table.createdAt),
    index('message_sender_idx').on(table.senderId),
    index('message_flagged_idx')
      .on(table.flagged)
      .where(sql`${table.flagged} = true`),
  ]
);

export const flaggedMessage = pgTable('flagged_message', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  messageId: text('messageId')
    .notNull()
    .references(() => message.id),
  conversationId: text('conversationId')
    .notNull()
    .references(() => conversation.id),
  senderId: text('senderId')
    .notNull()
    .references(() => user.id),
  content: text('content').notNull(),
  violations: text('violations').array().notNull(),
  reviewedAt: timestamp('reviewedAt'),
  reviewedBy: text('reviewedBy').references(() => user.id),
  action: flaggedMessageActionEnum('action'),
  adminNotes: text('adminNotes'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

// ============================================================================
// BOOKING TABLES
// ============================================================================

export const booking = pgTable(
  'booking',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clientId: text('clientId')
      .notNull()
      .references(() => user.id),
    coachId: text('coachId')
      .notNull()
      .references(() => user.id),
    conversationId: text('conversationId').references(() => conversation.id),

    // Booking details (using timestamptz for proper timezone handling)
    scheduledStartAt: timestamp('scheduledStartAt', { withTimezone: true }).notNull(),
    scheduledEndAt: timestamp('scheduledEndAt', { withTimezone: true }).notNull(),
    duration: integer('duration').notNull(), // Duration in minutes for easy calculations
    location: jsonb('location').notNull().$type<{
      name: string;
      address: string;
      notes?: string;
    }>(),
    clientMessage: text('clientMessage'),

    // Pricing
    coachRate: decimal('coachRate', { precision: 10, scale: 2 }).notNull(),
    clientPaid: decimal('clientPaid', { precision: 10, scale: 2 }).notNull(),
    platformFee: decimal('platformFee', { precision: 10, scale: 2 }).notNull(),
    stripeFee: decimal('stripeFee', { precision: 10, scale: 2 }).notNull(),
    coachPayout: decimal('coachPayout', { precision: 10, scale: 2 }).notNull(),

    // Stripe
    stripePaymentIntentId: varchar('stripePaymentIntentId', {
      length: 255,
    }).unique(),
    stripeTransferId: varchar('stripeTransferId', { length: 255 }),

    // Status
    status: bookingStatusEnum('status').notNull().default('pending'),

    // Response handling
    coachRespondedAt: timestamp('coachRespondedAt'),
    proposedAlternateTime: jsonb('proposedAlternateTime').$type<{
      startAt: string; // ISO 8601 timestamp with timezone
      endAt: string; // ISO 8601 timestamp with timezone
    }>(),

    // Completion
    markedCompleteByCoach: boolean('markedCompleteByCoach')
      .notNull()
      .default(false),
    markedCompleteByCoachAt: timestamp('markedCompleteByCoachAt'),
    confirmedByClient: boolean('confirmedByClient').notNull().default(false),
    confirmedByClientAt: timestamp('confirmedByClientAt'),

    // Cancellation
    cancelledBy: text('cancelledBy').references(() => user.id),
    cancelledAt: timestamp('cancelledAt'),
    cancellationReason: text('cancellationReason'),
    refundAmount: decimal('refundAmount', { precision: 10, scale: 2 }),
    refundProcessedAt: timestamp('refundProcessedAt'),

    // Idempotency
    idempotencyKey: varchar('idempotencyKey', { length: 255 }).unique(),

    // Locking
    lockedUntil: timestamp('lockedUntil'),

    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [
    index('booking_client_idx').on(table.clientId),
    index('booking_coach_idx').on(table.coachId),
    index('booking_status_idx').on(table.status),
    index('booking_scheduled_start_idx').on(table.scheduledStartAt),
    index('booking_payment_intent_idx').on(table.stripePaymentIntentId),
    // Composite index for common query pattern: coach's bookings by date and status
    index('booking_coach_date_status_idx').on(
      table.coachId,
      table.scheduledStartAt,
      table.status
    ),
  ]
);

export const review = pgTable(
  'review',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    bookingId: text('bookingId')
      .notNull()
      .unique()
      .references(() => booking.id),
    reviewerId: text('reviewerId')
      .notNull()
      .references(() => user.id),
    coachId: text('coachId')
      .notNull()
      .references(() => user.id),
    rating: integer('rating').notNull(),
    reviewText: text('reviewText'),
    flagged: boolean('flagged').notNull().default(false),
    flaggedReason: text('flaggedReason'),
    adminReviewed: boolean('adminReviewed').notNull().default(false),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [
    index('review_coach_idx').on(table.coachId),
    index('review_booking_idx').on(table.bookingId),
    // Composite index for fetching coach's reviews chronologically
    index('review_coach_created_idx').on(table.coachId, table.createdAt),
  ]
);

export const refundRequest = pgTable('refund_request', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  bookingId: text('bookingId')
    .notNull()
    .references(() => booking.id),
  requestedBy: text('requestedBy')
    .notNull()
    .references(() => user.id),
  reason: refundReasonEnum('reason').notNull(),
  description: text('description').notNull(),
  evidencePhotos: text('evidencePhotos').array(),
  requestedAmount: refundAmountEnum('requestedAmount').notNull(),

  // Admin review
  status: refundStatusEnum('status').notNull().default('pending'),
  reviewedBy: text('reviewedBy').references(() => user.id),
  reviewedAt: timestamp('reviewedAt'),
  adminNotes: text('adminNotes'),
  approvedAmount: decimal('approvedAmount', { precision: 10, scale: 2 }),

  // Stripe
  stripeRefundId: varchar('stripeRefundId', { length: 255 }),
  refundProcessedAt: timestamp('refundProcessedAt'),

  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

// ============================================================================
// ADMIN TABLES
// ============================================================================

export const adminAction = pgTable('admin_action', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  adminId: text('adminId')
    .notNull()
    .references(() => user.id),
  action: adminActionTypeEnum('action').notNull(),
  targetUserId: text('targetUserId').references(() => user.id),
  relatedEntityId: text('relatedEntityId'),
  notes: text('notes'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

// ============================================================================
// UTILITY TABLES
// ============================================================================

export const idempotencyKey = pgTable(
  'idempotency_key',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    key: varchar('key', { length: 255 }).notNull().unique(),
    result: jsonb('result').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    expiresAt: timestamp('expiresAt').notNull(),
  },
  (table) => [
    uniqueIndex('idempotency_key_idx').on(table.key),
    index('idempotency_key_expires_idx').on(table.expiresAt),
  ]
);

// ============================================================================
// RELATIONS (for Drizzle relational queries)
// ============================================================================

export const userRelations = relations(user, ({ one, many }) => ({
  athleteProfile: one(athleteProfile, {
    fields: [user.id],
    references: [athleteProfile.userId],
  }),
  coachProfile: one(coachProfile, {
    fields: [user.id],
    references: [coachProfile.userId],
  }),
  sessions: many(session),
  accounts: many(account),
  sentMessages: many(message, { relationName: 'sender' }),
  conversationsAsClient: many(conversation, { relationName: 'client' }),
  conversationsAsCoach: many(conversation, { relationName: 'coach' }),
  bookingsAsClient: many(booking, { relationName: 'client' }),
  bookingsAsCoach: many(booking, { relationName: 'coach' }),
  reviewsGiven: many(review, { relationName: 'reviewer' }),
  reviewsReceived: many(review, { relationName: 'coach' }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const athleteProfileRelations = relations(athleteProfile, ({ one }) => ({
  user: one(user, {
    fields: [athleteProfile.userId],
    references: [user.id],
  }),
}));

export const coachProfileRelations = relations(coachProfile, ({ one }) => ({
  user: one(user, {
    fields: [coachProfile.userId],
    references: [user.id],
  }),
  approvedBy: one(user, {
    fields: [coachProfile.adminApprovedBy],
    references: [user.id],
  }),
}));

export const conversationRelations = relations(
  conversation,
  ({ one, many }) => ({
    client: one(user, {
      fields: [conversation.clientId],
      references: [user.id],
      relationName: 'client',
    }),
    coach: one(user, {
      fields: [conversation.coachId],
      references: [user.id],
      relationName: 'coach',
    }),
    messages: many(message),
    bookings: many(booking),
  })
);

export const messageRelations = relations(message, ({ one }) => ({
  conversation: one(conversation, {
    fields: [message.conversationId],
    references: [conversation.id],
  }),
  sender: one(user, {
    fields: [message.senderId],
    references: [user.id],
    relationName: 'sender',
  }),
}));

export const flaggedMessageRelations = relations(flaggedMessage, ({ one }) => ({
  message: one(message, {
    fields: [flaggedMessage.messageId],
    references: [message.id],
  }),
  conversation: one(conversation, {
    fields: [flaggedMessage.conversationId],
    references: [conversation.id],
  }),
  sender: one(user, {
    fields: [flaggedMessage.senderId],
    references: [user.id],
  }),
  reviewer: one(user, {
    fields: [flaggedMessage.reviewedBy],
    references: [user.id],
  }),
}));

export const bookingRelations = relations(booking, ({ one }) => ({
  client: one(user, {
    fields: [booking.clientId],
    references: [user.id],
    relationName: 'client',
  }),
  coach: one(user, {
    fields: [booking.coachId],
    references: [user.id],
    relationName: 'coach',
  }),
  conversation: one(conversation, {
    fields: [booking.conversationId],
    references: [conversation.id],
  }),
  review: one(review, {
    fields: [booking.id],
    references: [review.bookingId],
  }),
  cancelledByUser: one(user, {
    fields: [booking.cancelledBy],
    references: [user.id],
  }),
}));

export const reviewRelations = relations(review, ({ one }) => ({
  booking: one(booking, {
    fields: [review.bookingId],
    references: [booking.id],
  }),
  reviewer: one(user, {
    fields: [review.reviewerId],
    references: [user.id],
    relationName: 'reviewer',
  }),
  coach: one(user, {
    fields: [review.coachId],
    references: [user.id],
    relationName: 'coach',
  }),
}));

export const refundRequestRelations = relations(refundRequest, ({ one }) => ({
  booking: one(booking, {
    fields: [refundRequest.bookingId],
    references: [booking.id],
  }),
  requester: one(user, {
    fields: [refundRequest.requestedBy],
    references: [user.id],
  }),
  reviewer: one(user, {
    fields: [refundRequest.reviewedBy],
    references: [user.id],
  }),
}));

export const adminActionRelations = relations(adminAction, ({ one }) => ({
  admin: one(user, {
    fields: [adminAction.adminId],
    references: [user.id],
  }),
  targetUser: one(user, {
    fields: [adminAction.targetUserId],
    references: [user.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS (for use throughout the app)
// ============================================================================

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;

export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;

export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;

export type AthleteProfile = typeof athleteProfile.$inferSelect;
export type NewAthleteProfile = typeof athleteProfile.$inferInsert;

export type CoachProfile = typeof coachProfile.$inferSelect;
export type NewCoachProfile = typeof coachProfile.$inferInsert;

export type Conversation = typeof conversation.$inferSelect;
export type NewConversation = typeof conversation.$inferInsert;

export type Message = typeof message.$inferSelect;
export type NewMessage = typeof message.$inferInsert;

export type FlaggedMessage = typeof flaggedMessage.$inferSelect;
export type NewFlaggedMessage = typeof flaggedMessage.$inferInsert;

export type Booking = typeof booking.$inferSelect;
export type NewBooking = typeof booking.$inferInsert;

export type Review = typeof review.$inferSelect;
export type NewReview = typeof review.$inferInsert;

export type RefundRequest = typeof refundRequest.$inferSelect;
export type NewRefundRequest = typeof refundRequest.$inferInsert;

export type AdminAction = typeof adminAction.$inferSelect;
export type NewAdminAction = typeof adminAction.$inferInsert;

export type IdempotencyKey = typeof idempotencyKey.$inferSelect;
export type NewIdempotencyKey = typeof idempotencyKey.$inferInsert;
