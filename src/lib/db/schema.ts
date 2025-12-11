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
export const bookingStatusEnum = pgEnum('booking_status', [
  'pending',
  'awaiting_payment',
  'accepted',
  'declined',
  'cancelled',
  'completed',
  'disputed',
  'open',
]);
export const groupTypeEnum = pgEnum('group_type', ['private', 'public']);
export const participantPaymentStatusEnum = pgEnum('participant_payment_status', [
  'pending',
  'paid',
  'refunded',
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

    username: varchar('username', { length: 30 }).notNull().unique(),
    role: userRoleEnum('role').notNull().default('client'),
    status: userStatusEnum('status').notNull().default('active'),
    profileComplete: boolean('profileComplete').notNull().default(false),
    lastLoginAt: timestamp('lastLoginAt'),
    platformFeePercentage: decimal('platformFeePercentage', { precision: 5, scale: 2 })
      .notNull()
      .default('15.00'),

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
    clientId: text('clientId')
      .notNull()
      .references(() => user.id),
    coachId: text('coachId')
      .notNull()
      .references(() => user.id),
    conversationId: text('conversationId').references(() => conversation.id),

    scheduledStartAt: timestamp('scheduledStartAt', { withTimezone: true }).notNull(),
    scheduledEndAt: timestamp('scheduledEndAt', { withTimezone: true }).notNull(),
    duration: integer('duration').notNull(),
    location: jsonb('location').notNull().$type<{
      name: string;
      address: string;
      notes?: string;
    }>(),
    clientMessage: text('clientMessage'),

    coachRate: decimal('coachRate', { precision: 10, scale: 2 }).notNull(),
    clientPaid: decimal('clientPaid', { precision: 10, scale: 2 }).notNull(),
    platformFee: decimal('platformFee', { precision: 10, scale: 2 }).notNull(),
    stripeFee: decimal('stripeFee', { precision: 10, scale: 2 }).notNull(),
    coachPayout: decimal('coachPayout', { precision: 10, scale: 2 }).notNull(),

    stripePaymentIntentId: varchar('stripePaymentIntentId', {
      length: 255,
    }).unique(),
    stripeTransferId: varchar('stripeTransferId', { length: 255 }),

    paymentDueAt: timestamp('paymentDueAt'),
    paymentCompletedAt: timestamp('paymentCompletedAt'),
    paymentReminderSentAt: timestamp('paymentReminderSentAt'),
    paymentFinalReminderSentAt: timestamp('paymentFinalReminderSentAt'),

    status: bookingStatusEnum('status').notNull().default('pending'),

    coachRespondedAt: timestamp('coachRespondedAt'),
    proposedAlternateTime: jsonb('proposedAlternateTime').$type<{
      startAt: string;
      endAt: string;
    }>(),

    markedCompleteByCoach: boolean('markedCompleteByCoach')
      .notNull()
      .default(false),
    markedCompleteByCoachAt: timestamp('markedCompleteByCoachAt'),
    confirmedByClient: boolean('confirmedByClient').notNull().default(false),
    confirmedByClientAt: timestamp('confirmedByClientAt'),

    cancelledBy: text('cancelledBy').references(() => user.id),
    cancelledAt: timestamp('cancelledAt'),
    cancellationReason: text('cancellationReason'),
    refundAmount: decimal('refundAmount', { precision: 10, scale: 2 }),
    refundProcessedAt: timestamp('refundProcessedAt'),

    idempotencyKey: varchar('idempotencyKey', { length: 255 }).unique(),

    lockedUntil: timestamp('lockedUntil'),

    isGroupBooking: boolean('isGroupBooking').notNull().default(false),
    groupType: groupTypeEnum('groupType'),
    organizerId: text('organizerId').references(() => user.id),
    maxParticipants: integer('maxParticipants'),
    minParticipants: integer('minParticipants'),
    pricePerPerson: decimal('pricePerPerson', { precision: 10, scale: 2 }),
    currentParticipants: integer('currentParticipants').default(0),

    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [
    index('booking_client_idx').on(table.clientId),
    index('booking_coach_idx').on(table.coachId),
    index('booking_status_idx').on(table.status),
    index('booking_scheduled_start_idx').on(table.scheduledStartAt),
    index('booking_payment_intent_idx').on(table.stripePaymentIntentId),
    index('booking_coach_date_status_idx').on(
      table.coachId,
      table.scheduledStartAt,
      table.status
    ),
    index('booking_group_type_idx').on(table.groupType),
    index('booking_organizer_idx').on(table.organizerId),
  ]
);

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
    paymentStatus: participantPaymentStatusEnum('paymentStatus')
      .notNull()
      .default('pending'),
    amountPaid: decimal('amountPaid', { precision: 10, scale: 2 }),
    stripePaymentIntentId: varchar('stripePaymentIntentId', { length: 255 }),
    joinedAt: timestamp('joinedAt').notNull().defaultNow(),
    cancelledAt: timestamp('cancelledAt'),
    refundedAt: timestamp('refundedAt'),
    refundAmount: decimal('refundAmount', { precision: 10, scale: 2 }),
  },
  (table) => [
    uniqueIndex('booking_participant_unique_idx').on(table.bookingId, table.userId),
    index('booking_participant_booking_idx').on(table.bookingId),
    index('booking_participant_user_idx').on(table.userId),
  ]
);

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
