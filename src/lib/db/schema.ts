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
export const bookingTypeEnum = pgEnum('booking_type', ['individual', 'private_group', 'public_group']);
export const bookingApprovalStatusEnum = pgEnum('booking_approval_status', [
  'pending_review',
  'accepted',
  'declined',
  'expired',
  'cancelled',
]);
export const bookingPaymentStatusEnum = pgEnum('booking_payment_status', [
  'not_required',
  'awaiting_client_payment',
  'authorized',
  'captured',
  'refunded',
  'failed',
]);
export const bookingFulfillmentStatusEnum = pgEnum('booking_fulfillment_status', [
  'scheduled',
  'completed',
  'disputed',
]);
export const bookingCapacityStatusEnum = pgEnum('booking_capacity_status', [
  'open',
  'full',
  'closed',
]);
export const groupTypeEnum = pgEnum('group_type', ['private', 'public']);
export const participantStatusEnum = pgEnum('participant_status', [
  'requested',
  'awaiting_payment',
  'awaiting_coach',
  'accepted',
  'declined',
  'cancelled',
  'completed',
]);
export const participantPaymentStatusEnum = pgEnum('participant_payment_status', [
  'requires_payment_method',
  'authorized',
  'captured',
  'refunded',
  'cancelled',
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

    username: varchar('username', { length: 30 }).unique(),
    role: userRoleEnum('role').notNull().default('client'),
    status: userStatusEnum('status').notNull().default('active'),
    profileComplete: boolean('profileComplete').notNull().default(false),
    lastLoginAt: timestamp('lastLoginAt'),
    platformFeePercentage: decimal('platformFeePercentage', { precision: 5, scale: 2 })
      .notNull()
      .default('15.00'),

    timezone: text('timezone').notNull().default('America/Chicago'),

    onboardingPhotoUrl: text('onboardingPhotoUrl'),
    onboardingVideoUrl: text('onboardingVideoUrl'),

    deletedAt: timestamp('deletedAt'),
    deletedBy: text('deletedBy'),
  },
  (table) => [
    uniqueIndex('user_email_idx').on(table.email),
    uniqueIndex('user_username_idx').on(table.username),
    index('user_role_idx').on(table.role),
    index('user_status_idx').on(table.status),
    index('user_deleted_at_idx').on(table.deletedAt),
  ]
);

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
    password: text('password'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [index('account_user_id_idx').on(table.userId)]
);

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

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
    >(),
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
    >(),
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
    
    groupBookingsEnabled: boolean('groupBookingsEnabled').notNull().default(false),
    allowPrivateGroups: boolean('allowPrivateGroups').notNull().default(false),
    allowPublicGroups: boolean('allowPublicGroups').notNull().default(false),
    
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),

    updatedBy: text('updatedBy').references(() => user.id),
  },
  (table) => [
    index('coach_location_idx').using('gin', table.location),
    index('coach_specialties_idx').using('gin', table.specialties),
    index('coach_reputation_idx').on(table.reputationScore),
    index('coach_approval_status_idx').on(table.adminApprovalStatus),
  ]
);

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
      .references(() => user.id, { onDelete: 'set null' }),
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
    .references(() => message.id, { onDelete: 'cascade' }),
  conversationId: text('conversationId')
    .notNull()
    .references(() => conversation.id, { onDelete: 'cascade' }),
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

export const booking = pgTable(
  'booking',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    coachId: text('coachId')
      .notNull()
      .references(() => user.id),

    scheduledStartAt: timestamp('scheduledStartAt', { withTimezone: true }).notNull(),
    scheduledEndAt: timestamp('scheduledEndAt', { withTimezone: true }).notNull(),
    duration: integer('duration').notNull(),
    location: jsonb('location').notNull().$type<{
      name: string;
      address: string;
      notes?: string;
    }>(),

    bookingType: bookingTypeEnum('bookingType').notNull(),

    approvalStatus: bookingApprovalStatusEnum('approvalStatus')
      .notNull()
      .default('pending_review'),
    fulfillmentStatus: bookingFulfillmentStatusEnum('fulfillmentStatus')
      .notNull()
      .default('scheduled'),

    coachRespondedAt: timestamp('coachRespondedAt'),
    proposedAlternateTime: jsonb('proposedAlternateTime').$type<{
      startAt: string;
      endAt: string;
    }>(),

    coachConfirmedAt: timestamp('coachConfirmedAt'),
    completedAt: timestamp('completedAt'),

    cancelledBy: text('cancelledBy').references(() => user.id),
    cancelledAt: timestamp('cancelledAt'),
    cancellationReason: text('cancellationReason'),

    idempotencyKey: varchar('idempotencyKey', { length: 255 }).unique(),

    lockedUntil: timestamp('lockedUntil'),

    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [
    index('booking_coach_idx').on(table.coachId),
    index('booking_approval_status_idx').on(table.approvalStatus),
    index('booking_fulfillment_status_idx').on(table.fulfillmentStatus),
    index('booking_scheduled_start_idx').on(table.scheduledStartAt),
    index('booking_coach_date_idx').on(
      table.coachId,
      table.scheduledStartAt
    ),
    index('booking_type_idx').on(table.bookingType),
  ]
);

export const individualBookingDetails = pgTable('individual_booking_details', {
  bookingId: text('bookingId')
    .notNull()
    .references(() => booking.id, { onDelete: 'cascade' })
    .primaryKey(),
  clientId: text('clientId')
    .notNull()
    .references(() => user.id),
  conversationId: text('conversationId').references(() => conversation.id),

  clientMessage: text('clientMessage'),

  coachRate: decimal('coachRate', { precision: 10, scale: 2 }).notNull(),
  clientPaysCents: integer('clientPaysCents').notNull(),
  platformFeeCents: integer('platformFeeCents').notNull(),
  coachPayoutCents: integer('coachPayoutCents').notNull(),

  stripeTransferId: varchar('stripeTransferId', { length: 255 }),
  stripePaymentIntentId: varchar('stripePaymentIntentId', { length: 255 }),
  paymentStatus: bookingPaymentStatusEnum('paymentStatus').notNull(),
  paymentDueAt: timestamp('paymentDueAt'),
  paymentFinalReminderSentAt: timestamp('paymentFinalReminderSentAt'),

  clientConfirmedAt: timestamp('clientConfirmedAt'),
});

export const privateGroupBookingDetails = pgTable('private_group_booking_details', {
  bookingId: text('bookingId')
    .notNull()
    .references(() => booking.id, { onDelete: 'cascade' })
    .primaryKey(),
  organizerId: text('organizerId')
    .notNull()
    .references(() => user.id),

  clientMessage: text('clientMessage'),

  totalParticipants: integer('totalParticipants').notNull(),
  pricePerPerson: decimal('pricePerPerson', { precision: 10, scale: 2 }).notNull(),
  totalGrossCents: integer('totalGrossCents').notNull(),
  platformFeeCents: integer('platformFeeCents').notNull(),
  coachPayoutCents: integer('coachPayoutCents').notNull(),

  stripeTransferId: varchar('stripeTransferId', { length: 255 }),
  stripePaymentIntentId: varchar('stripePaymentIntentId', { length: 255 }),
  paymentStatus: bookingPaymentStatusEnum('paymentStatus').notNull(),
  paymentDueAt: timestamp('paymentDueAt'),
  paymentFinalReminderSentAt: timestamp('paymentFinalReminderSentAt'),

  organizerConfirmedAt: timestamp('organizerConfirmedAt'),
});

export const publicGroupLessonDetails = pgTable('public_group_lesson_details', {
  bookingId: text('bookingId')
    .notNull()
    .references(() => booking.id, { onDelete: 'cascade' })
    .primaryKey(),

  clientMessage: text('clientMessage'),

  maxParticipants: integer('maxParticipants').notNull(),
  minParticipants: integer('minParticipants').notNull(),
  pricePerPerson: decimal('pricePerPerson', { precision: 10, scale: 2 }).notNull(),

  capacityStatus: bookingCapacityStatusEnum('capacityStatus').notNull(),
  currentParticipants: integer('currentParticipants').notNull().default(0),
  authorizedParticipants: integer('authorizedParticipants').notNull().default(0),
  capturedParticipants: integer('capturedParticipants').notNull().default(0),

  stripeTransferId: varchar('stripeTransferId', { length: 255 }),
  recurringLessonId: text('recurringLessonId').references(() => recurringGroupLesson.id),
});

export const groupPricingTier = pgTable('group_pricing_tier', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  coachId: text('coachId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  minParticipants: integer('minParticipants').notNull(),
  maxParticipants: integer('maxParticipants'), // null means "X+"
  pricePerPerson: decimal('pricePerPerson', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const coachAllowedDurations = pgTable('coach_allowed_durations', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  coachId: text('coachId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  durationMinutes: integer('durationMinutes').notNull(),
  isDefault: boolean('isDefault').notNull().default(false),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
}, (table) => [
  index('coach_allowed_durations_coach_idx').on(table.coachId),
  uniqueIndex('coach_allowed_durations_unique_idx').on(table.coachId, table.durationMinutes),
]);

export const bookingParticipant = pgTable(
  'booking_participant',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    bookingId: text('bookingId')
      .notNull()
      .references(() => booking.id, { onDelete: 'cascade' }),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    /**
     * IMPORTANT: Semantics differ by booking type:
     *
     * Private Group:
     * - role: 'organizer' (pays for everyone) or 'participant' (invited, doesn't pay)
     * - paymentStatus: Only meaningful for organizer (always 'requires_payment_method' for participants)
     * - stripePaymentIntentId: Only set for organizer
     *
     * Public Group:
     * - role: Always 'participant'
     * - paymentStatus: Tracks each participant's individual payment
     * - stripePaymentIntentId: Each participant has their own PI
     */
    role: varchar('role', { length: 20 }).notNull().default('participant'),
    status: participantStatusEnum('status')
      .notNull()
      .default('requested'),
    paymentStatus: participantPaymentStatusEnum('paymentStatus')
      .notNull()
      .default('requires_payment_method'),
    amountPaid: decimal('amountPaid', { precision: 10, scale: 2 }),
    amountCents: integer('amountCents'),
    stripePaymentIntentId: varchar('stripePaymentIntentId', { length: 255 }),
    expiresAt: timestamp('expiresAt'),
    authorizedAt: timestamp('authorizedAt'),
    capturedAt: timestamp('capturedAt'),
    refundedAt: timestamp('refundedAt'),
    refundAmount: decimal('refundAmount', { precision: 10, scale: 2 }),
    joinedAt: timestamp('joinedAt').notNull().defaultNow(),
    cancelledAt: timestamp('cancelledAt'),
  },
  (table) => [
    uniqueIndex('booking_participant_unique_idx').on(table.bookingId, table.userId),
    index('booking_participant_booking_idx').on(table.bookingId),
    index('booking_participant_user_idx').on(table.userId),
  ]
);

export const bookingParticipantRelations = relations(bookingParticipant, ({ one }) => ({
  user: one(user, {
    fields: [bookingParticipant.userId],
    references: [user.id],
  }),
  booking: one(booking, {
    fields: [bookingParticipant.bookingId],
    references: [booking.id],
  }),
}));

export const bookingPayment = pgTable(
  'booking_payment',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    bookingId: text('bookingId')
      .notNull()
      .references(() => booking.id, { onDelete: 'cascade' }),
    participantId: text('participantId').references(() => bookingParticipant.id, {
      onDelete: 'cascade',
    }),
    stripePaymentIntentId: varchar('stripePaymentIntentId', { length: 255 }).notNull(),
    amountCents: integer('amountCents').notNull(),
    currency: varchar('currency', { length: 10 }).notNull().default('usd'),
    captureMethod: varchar('captureMethod', { length: 32 }).notNull().default('manual'),
    status: varchar('status', { length: 50 }).notNull(),
    lastEventAt: timestamp('lastEventAt').notNull().defaultNow(),
    idempotencyKey: varchar('idempotencyKey', { length: 255 }),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('booking_payment_intent_unique_idx').on(table.stripePaymentIntentId),
    index('booking_payment_booking_idx').on(table.bookingId),
    index('booking_payment_participant_idx').on(table.participantId),
  ]
);

export const bookingStateTransition = pgTable('booking_state_transition', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  bookingId: text('bookingId')
    .notNull()
    .references(() => booking.id, { onDelete: 'cascade' }),
  participantId: text('participantId').references(() => bookingParticipant.id, {
    onDelete: 'cascade',
  }),
  oldStatus: text('oldStatus').notNull(),
  newStatus: text('newStatus').notNull(),
  changedBy: text('changedBy').references(() => user.id),
  reason: text('reason'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const recurringGroupLesson = pgTable('recurring_group_lesson', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  coachId: text('coachId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  dayOfWeek: integer('dayOfWeek').notNull(),
  startTime: time('startTime').notNull(),
  duration: integer('duration').notNull(),
  maxParticipants: integer('maxParticipants').notNull(),
  minParticipants: integer('minParticipants').notNull(),
  pricePerPerson: decimal('pricePerPerson', { precision: 10, scale: 2 }).notNull(),
  location: jsonb('location').notNull().$type<{
    name: string;
    address: string;
    notes?: string;
  }>(),
  isActive: boolean('isActive').notNull().default(true),
  startDate: date('startDate', { mode: 'string' }).notNull(),
  endDate: date('endDate', { mode: 'string' }),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export const review = pgTable(
  'review',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    bookingId: text('bookingId')
      .notNull()
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
    index('review_coach_created_idx').on(table.coachId, table.createdAt),
    uniqueIndex('review_booking_reviewer_unique_idx').on(
      table.bookingId,
      table.reviewerId
    ),
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

  status: refundStatusEnum('status').notNull().default('pending'),
  reviewedBy: text('reviewedBy').references(() => user.id),
  reviewedAt: timestamp('reviewedAt'),
  adminNotes: text('adminNotes'),
  approvedAmount: decimal('approvedAmount', { precision: 10, scale: 2 }),

  stripeRefundId: varchar('stripeRefundId', { length: 255 }),
  refundProcessedAt: timestamp('refundProcessedAt'),

  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

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

  // Removed bookingsAsClient - use individualDetails.clientId or privateGroupDetails.organizerId instead
  bookingsAsCoach: many(booking, { relationName: 'coach' }),

  // Add these instead:
  individualBookingsAsClient: many(individualBookingDetails, { relationName: 'client' }),
  privateGroupBookingsAsOrganizer: many(privateGroupBookingDetails, { relationName: 'organizer' }),

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

export const coachProfileRelations = relations(coachProfile, ({ one, many }) => ({
  user: one(user, {
    fields: [coachProfile.userId],
    references: [user.id],
  }),
  approvedBy: one(user, {
    fields: [coachProfile.adminApprovedBy],
    references: [user.id],
  }),
  allowedDurations: many(coachAllowedDurations),
}));

export const coachAllowedDurationsRelations = relations(coachAllowedDurations, ({ one }) => ({
  coach: one(coachProfile, {
    fields: [coachAllowedDurations.coachId],
    references: [coachProfile.userId],
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

export const flaggedGroupMessage = pgTable('flagged_group_message', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  groupMessageId: text('groupMessageId')
    .notNull()
    .references(() => groupMessage.id, { onDelete: 'cascade' }),
  groupConversationId: text('groupConversationId')
    .notNull()
    .references(() => groupConversation.id, { onDelete: 'cascade' }),
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

export const flaggedGroupMessageRelations = relations(flaggedGroupMessage, ({ one }) => ({
  groupMessage: one(groupMessage, {
    fields: [flaggedGroupMessage.groupMessageId],
    references: [groupMessage.id],
  }),
  groupConversation: one(groupConversation, {
    fields: [flaggedGroupMessage.groupConversationId],
    references: [groupConversation.id],
  }),
  sender: one(user, {
    fields: [flaggedGroupMessage.senderId],
    references: [user.id],
  }),
  reviewer: one(user, {
    fields: [flaggedGroupMessage.reviewedBy],
    references: [user.id],
  }),
}));

export const individualBookingDetailsRelations = relations(individualBookingDetails, ({ one }) => ({
  booking: one(booking, {
    fields: [individualBookingDetails.bookingId],
    references: [booking.id],
  }),
  client: one(user, {
    fields: [individualBookingDetails.clientId],
    references: [user.id],
    relationName: 'client',
  }),
  conversation: one(conversation, {
    fields: [individualBookingDetails.conversationId],
    references: [conversation.id],
  }),
}));

export const privateGroupBookingDetailsRelations = relations(privateGroupBookingDetails, ({ one }) => ({
  booking: one(booking, {
    fields: [privateGroupBookingDetails.bookingId],
    references: [booking.id],
  }),
  organizer: one(user, {
    fields: [privateGroupBookingDetails.organizerId],
    references: [user.id],
    relationName: 'organizer',
  }),
}));

export const publicGroupLessonDetailsRelations = relations(publicGroupLessonDetails, ({ one }) => ({
  booking: one(booking, {
    fields: [publicGroupLessonDetails.bookingId],
    references: [booking.id],
  }),
  recurringLesson: one(recurringGroupLesson, {
    fields: [publicGroupLessonDetails.recurringLessonId],
    references: [recurringGroupLesson.id],
  }),
}));

export const bookingRelations = relations(booking, ({ one }) => ({
  coach: one(user, {
    fields: [booking.coachId],
    references: [user.id],
    relationName: 'coach',
  }),
  individualDetails: one(individualBookingDetails, {
    fields: [booking.id],
    references: [individualBookingDetails.bookingId],
  }),
  privateGroupDetails: one(privateGroupBookingDetails, {
    fields: [booking.id],
    references: [privateGroupBookingDetails.bookingId],
  }),
  publicGroupDetails: one(publicGroupLessonDetails, {
    fields: [booking.id],
    references: [publicGroupLessonDetails.bookingId],
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

export const bookingPaymentRelations = relations(bookingPayment, ({ one }) => ({
  booking: one(booking, {
    fields: [bookingPayment.bookingId],
    references: [booking.id],
  }),
  participant: one(bookingParticipant, {
    fields: [bookingPayment.participantId],
    references: [bookingParticipant.id],
  }),
}));

export const bookingStateTransitionRelations = relations(
  bookingStateTransition,
  ({ one }) => ({
    booking: one(booking, {
      fields: [bookingStateTransition.bookingId],
      references: [booking.id],
    }),
    participant: one(bookingParticipant, {
      fields: [bookingStateTransition.participantId],
      references: [bookingParticipant.id],
    }),
    actor: one(user, {
      fields: [bookingStateTransition.changedBy],
      references: [user.id],
    }),
  })
);

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

export const groupConversation = pgTable('group_conversation', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  bookingId: text('bookingId')
    .notNull()
    .unique()
    .references(() => booking.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  lastMessageAt: timestamp('lastMessageAt'),
});

export const groupConversationParticipant = pgTable(
  'group_conversation_participant',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversationId: text('conversationId')
      .notNull()
      .references(() => groupConversation.id, { onDelete: 'cascade' }),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joinedAt').notNull().defaultNow(),
    lastReadAt: timestamp('lastReadAt'),
  },
  (table) => [
    uniqueIndex('group_conv_participant_unique_idx').on(
      table.conversationId,
      table.userId
    ),
  ]
);

export const groupMessage = pgTable('group_message', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  conversationId: text('conversationId')
    .notNull()
    .references(() => groupConversation.id, { onDelete: 'cascade' }),
  senderId: text('senderId').references(() => user.id, { onDelete: 'set null' }),
  content: text('content').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  readBy: jsonb('readBy').$type<string[]>().default([]),
  flagged: boolean('flagged').notNull().default(false),
  flaggedReason: text('flaggedReason'),
});

export const groupConversationRelations = relations(
  groupConversation,
  ({ one, many }) => ({
    booking: one(booking, {
      fields: [groupConversation.bookingId],
      references: [booking.id],
    }),
    participants: many(groupConversationParticipant),
    messages: many(groupMessage),
  })
);

export const groupConversationParticipantRelations = relations(
  groupConversationParticipant,
  ({ one }) => ({
    conversation: one(groupConversation, {
      fields: [groupConversationParticipant.conversationId],
      references: [groupConversation.id],
    }),
    user: one(user, {
      fields: [groupConversationParticipant.userId],
      references: [user.id],
    }),
  })
);

export const groupMessageRelations = relations(groupMessage, ({ one }) => ({
  conversation: one(groupConversation, {
    fields: [groupMessage.conversationId],
    references: [groupConversation.id],
  }),
  sender: one(user, {
    fields: [groupMessage.senderId],
    references: [user.id],
  }),
}));

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

export type CoachAllowedDurations = typeof coachAllowedDurations.$inferSelect;
export type NewCoachAllowedDurations = typeof coachAllowedDurations.$inferInsert;

export type Conversation = typeof conversation.$inferSelect;
export type NewConversation = typeof conversation.$inferInsert;

export type Message = typeof message.$inferSelect;
export type NewMessage = typeof message.$inferInsert;

export type FlaggedMessage = typeof flaggedMessage.$inferSelect;
export type NewFlaggedMessage = typeof flaggedMessage.$inferInsert;

export type FlaggedGroupMessage = typeof flaggedGroupMessage.$inferSelect;
export type NewFlaggedGroupMessage = typeof flaggedGroupMessage.$inferInsert;

export type Booking = typeof booking.$inferSelect;
export type NewBooking = typeof booking.$inferInsert;

export type IndividualBookingDetails = typeof individualBookingDetails.$inferSelect;
export type NewIndividualBookingDetails = typeof individualBookingDetails.$inferInsert;

export type PrivateGroupBookingDetails = typeof privateGroupBookingDetails.$inferSelect;
export type NewPrivateGroupBookingDetails = typeof privateGroupBookingDetails.$inferInsert;

export type PublicGroupLessonDetails = typeof publicGroupLessonDetails.$inferSelect;
export type NewPublicGroupLessonDetails = typeof publicGroupLessonDetails.$inferInsert;

export type BookingParticipant = typeof bookingParticipant.$inferSelect;
export type NewBookingParticipant = typeof bookingParticipant.$inferInsert;

export type Review = typeof review.$inferSelect;
export type NewReview = typeof review.$inferInsert;

export type RefundRequest = typeof refundRequest.$inferSelect;
export type NewRefundRequest = typeof refundRequest.$inferInsert;

export type AdminAction = typeof adminAction.$inferSelect;
export type NewAdminAction = typeof adminAction.$inferInsert;

export type IdempotencyKey = typeof idempotencyKey.$inferSelect;
export type NewIdempotencyKey = typeof idempotencyKey.$inferInsert;

export type GroupConversation = typeof groupConversation.$inferSelect;
export type NewGroupConversation = typeof groupConversation.$inferInsert;

export type GroupConversationParticipant = typeof groupConversationParticipant.$inferSelect;
export type NewGroupConversationParticipant = typeof groupConversationParticipant.$inferInsert;

export type GroupMessage = typeof groupMessage.$inferSelect;
export type NewGroupMessage = typeof groupMessage.$inferInsert;
