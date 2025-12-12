import { z } from 'zod';

export const uuidSchema = z.string().regex(/^[a-zA-Z0-9]{32}$|^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/, 'Invalid ID format');
export const stripePaymentIntentIdSchema = z.string().regex(/^pi_[a-zA-Z0-9_]+$/, 'Invalid payment intent ID format');

export const emailSchema = z
  .email('Invalid email format')
  .max(254, 'Email too long');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one lowercase letter, one uppercase letter, and one number'
  );

export const urlSchema = z.string().url('Invalid URL format');

export const positiveNumberSchema = z.number().positive('Must be positive');

export const nonEmptyStringSchema = z.string().trim().min(1, 'Required');

export const userRoleSchema = z.enum(['client', 'coach', 'admin']);

export const userStatusSchema = z.enum(['active', 'inactive', 'suspended']);

export const locationSchema = z.object({
  name: z.string().min(1, 'Location name required').max(100, 'Location name too long'),
  address: z.string().min(1, 'Address required').max(500, 'Address too long'),
  notes: z.string().max(1000, 'Notes too long').optional(),
});

export const athleteLocationSchema = z.object({
  city: z.string().min(1, 'City required').max(100, 'City name too long'),
  state: z.string().min(1, 'State required').max(50, 'State name too long'),
});

export const messageContentSchema = z
  .string()
  .trim()
  .min(1, 'Message cannot be empty')
  .max(5000, 'Message too long (max 5000 characters)');

export const bookingDurationSchema = z
  .number()
  .int()
  .min(15, 'Minimum 15 minutes')
  .max(480, 'Maximum 8 hours')
  .multipleOf(15, 'Duration must be in 15-minute increments');

export const bookingLocationSchema = z.object({
  name: z.string().min(1, 'Location name required').max(100, 'Location name too long'),
  address: z.string().min(1, 'Address required').max(500, 'Address too long'),
  notes: z.string().max(1000, 'Notes too long').optional(),
});

export const createBookingSchema = z.object({
  coachId: uuidSchema,
  scheduledStartAt: z
    .date()
    .refine((date) => date > new Date(), 'Booking must be in the future')
    .refine(
      (date) => date.getMinutes() % 15 === 0,
      'Start time must be in 15-minute increments'
    ),
  scheduledEndAt: z
    .date()
    .refine(
      (date) => date.getMinutes() % 15 === 0,
      'End time must be in 15-minute increments'
    ),
  location: bookingLocationSchema,
  clientMessage: z.string().max(2000, 'Message too long').optional(),
  paymentIntentId: stripePaymentIntentIdSchema.optional(),
}).refine(
  (data) => data.scheduledEndAt > data.scheduledStartAt,
  {
    message: 'End time must be after start time',
    path: ['scheduledEndAt'],
  }
).refine(
  (data) => {
    const duration = data.scheduledEndAt.getTime() - data.scheduledStartAt.getTime();
    return duration >= 15 * 60 * 1000 && duration <= 8 * 60 * 60 * 1000; // 15min to 8hrs
  },
  {
    message: 'Booking duration must be between 15 minutes and 8 hours',
    path: ['scheduledEndAt'],
  }
);

export const specialtySchema = z.object({
  sport: z.string().min(1, 'Sport required').max(50, 'Sport name too long'),
  tags: z.array(z.string().max(30, 'Tag too long')).max(10, 'Too many tags'),
});

export const certificationSchema = z.object({
  name: z.string().min(1, 'Certification name required').max(200, 'Name too long'),
  org: z.string().min(1, 'Organization required').max(200, 'Organization too long'),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  expDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  fileUrl: urlSchema,
});

export const availabilitySlotSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format (HH:MM)'),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format (HH:MM)'),
});

const usernameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9_-]{1,28}[a-zA-Z0-9])?$/;

export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(usernameRegex, 'Username can only contain letters, numbers, underscores, and hyphens')
  .refine(
    (val) => !val.includes('__') && !val.includes('--') && !val.includes('_-') && !val.includes('-_'),
    'Username cannot contain consecutive special characters'
  );

export function generateUsernameFromName(name: string): string {
  let username = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 30);

  if (!/^[a-z0-9]/.test(username)) {
    username = 'user_' + username;
  }

  username = username.replace(/_+$/, '');

  if (username.length < 3) {
    username = username + Math.floor(Math.random() * 1000);
  }

  return username;
}

export const coachProfileSchema = z.object({
  username: usernameSchema,
  fullName: z.string().min(1, 'Full name required').max(100, 'Name too long'),
  profilePhotoUrl: urlSchema.nullable().optional(),
  introVideoUrl: urlSchema,
  cities: z.array(z.string().min(1).max(100)).min(1, 'At least one city required').max(10, 'Too many cities'),
  state: z.string().min(1, 'State required').max(50, 'State too long'),
  specialties: z.array(specialtySchema).min(1, 'At least one specialty required').max(20, 'Too many specialties'),
  bio: z.string().min(10, 'Bio too short').max(2000, 'Bio too long'),
  accomplishments: z.string().max(2000, 'Accomplishments too long').optional(),
  certifications: z.array(certificationSchema).max(20, 'Too many certifications'),
  hourlyRate: z.number().min(10, 'Minimum $10/hour').max(1000, 'Maximum $1000/hour'),
  sessionDuration: bookingDurationSchema,
  weeklyAvailability: z.record(
    z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
    z.array(availabilitySlotSchema).max(5, 'Too many slots per day')
  ),
  preferredLocations: z.array(locationSchema).max(10, 'Too many locations'),
});

export const experienceLevelSchema = z.enum(['beginner', 'intermediate', 'advanced', 'expert']);

export const athleteProfileSchema = z.object({
  username: usernameSchema,
  fullName: z.string().min(1, 'Full name required').max(100, 'Name too long'),
  city: z.string().min(1, 'City required').max(100, 'City name too long'),
  state: z.string().min(1, 'State required').max(50, 'State name too long'),
  profilePhotoUrl: urlSchema.nullable().optional(),
  sports: z.array(z.string().min(1).max(50)).min(1, 'At least one sport required').max(10, 'Too many sports'),
  experienceLevels: z.record(z.string(), z.string()),
  notes: z.string().max(500, 'Notes too long'),
  budgetMin: z.number().min(10, 'Minimum $10').max(1000, 'Maximum $1000'),
  budgetMax: z.number().min(10, 'Minimum $10').max(1000, 'Maximum $1000'),
  preferredTimes: z.array(z.string().max(50, 'Time slot name too long')).max(20, 'Too many time preferences'),
  bio: z.string().max(2000, 'Bio too long'),
}).refine(
  (data) => data.budgetMax >= data.budgetMin,
  {
    message: 'Maximum budget must be greater than minimum',
    path: ['budgetMax'],
  }
);

export const adminActionSchema = z.enum([
  'approved_coach',
  'rejected_coach',
  'suspended_user',
  'activated_user',
  'deleted_user',
  'flagged_message',
  'resolved_dispute',
]);

export const platformFeeSchema = z
  .number()
  .min(0, 'Cannot be negative')
  .max(50, 'Maximum 50% platform fee')
  .multipleOf(0.01, 'Must be in cents (0.01 precision)');

export const uploadThingUrlSchema = z
  .string()
  .url()
  .refine(
    (url) => {
      const validHosts = ['uploadthing.com', 'utfs.io'];
      try {
        const parsedUrl = new URL(url);
        return validHosts.includes(parsedUrl.hostname);
      } catch {
        return false;
      }
    },
    'URL must be from UploadThing (uploadthing.com or utfs.io)'
  );

export const stripeWebhookSchema = z.object({
  id: z.string(),
  object: z.string(),
  api_version: z.string().optional(),
  created: z.number(),
  livemode: z.boolean(),
  pending_webhooks: z.number(),
  request: z.object({
    id: z.string().optional(),
    idempotency_key: z.string().optional(),
  }).optional(),
});

export const updateUserAccountSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').max(100, 'Name too long').trim(),
});

export const updateAthleteProfileSchema = z.object({
  fullName: z.string().min(1, 'Full name cannot be empty').max(100, 'Full name too long').trim(),
  profilePhoto: z.string().url('Invalid profile photo URL').optional().nullable(),
  location: z.object({
    city: z.string().min(1, 'City cannot be empty').max(100, 'City too long').trim(),
    state: z.string().min(1, 'State cannot be empty').max(100, 'State too long').trim(),
  }),
  sportsInterested: z.array(z.string().min(1, 'Sport name cannot be empty').max(50, 'Sport name too long')).min(1, 'At least one sport required'),
  experienceLevel: z.record(z.string(), z.object({
    level: z.string().min(1, 'Experience level cannot be empty').max(50, 'Experience level too long'),
    notes: z.string().max(500, 'Notes too long').optional(),
  })),
  budgetRange: z.union([
    z.object({
      min: z.number().min(0, 'Minimum budget cannot be negative'),
      max: z.number().min(0, 'Maximum budget cannot be negative'),
    }).refine(data => data.max >= data.min, 'Maximum budget must be greater than minimum'),
    z.object({
      single: z.number().min(0, 'Budget cannot be negative'),
    }),
  ]),
  availability: z.record(z.string(), z.array(z.object({
    start: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
    end: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  }))),
  bio: z.string().max(1000, 'Bio too long').optional(),
});

export const updateCoachProfileSchema = z.object({
  fullName: z.string().min(1, 'Full name cannot be empty').max(100, 'Full name too long').trim(),
  profilePhoto: z.string().url('Invalid profile photo URL').optional().nullable(),
  introVideo: z.string().url('Invalid intro video URL'),
  location: z.object({
    cities: z.array(z.string().min(1, 'City cannot be empty').max(100, 'City too long')).min(1, 'At least one city required'),
    state: z.string().min(1, 'State cannot be empty').max(100, 'State too long').trim(),
  }),
  specialties: z.array(z.object({
    sport: z.string().min(1, 'Sport cannot be empty').max(50, 'Sport too long'),
    tags: z.array(z.string().min(1, 'Tag cannot be empty').max(30, 'Tag too long')),
  })).min(1, 'At least one specialty required'),
  bio: z.string().min(10, 'Bio must be at least 10 characters').max(2000, 'Bio too long'),
  certifications: z.array(z.object({
    name: z.string().min(1, 'Certification name cannot be empty').max(200, 'Certification name too long'),
    org: z.string().min(1, 'Organization cannot be empty').max(200, 'Organization too long'),
    issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    expDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
    fileUrl: z.string().url('Invalid file URL'),
  })).optional(),
  accomplishments: z.string().max(1000, 'Accomplishments too long').optional(),
  hourlyRate: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid hourly rate format'),
  preferredLocations: z.array(z.object({
    name: z.string().min(1, 'Location name cannot be empty').max(100, 'Location name too long'),
    address: z.string().min(1, 'Address cannot be empty').max(200, 'Address too long'),
    notes: z.string().max(200, 'Notes too long').optional(),
  })).optional(),
  groupBookingsEnabled: z.boolean().optional(),
  allowPrivateGroups: z.boolean().optional(),
  allowPublicGroups: z.boolean().optional(),
});

export const coachSearchFiltersSchema = z.object({
  sport: z.string().min(1, 'Sport cannot be empty').max(50, 'Sport too long').optional(),
  location: z.string().min(1, 'Location cannot be empty').max(100, 'Location too long').optional(),
  minPrice: z.number().min(0, 'Minimum price cannot be negative').optional(),
  maxPrice: z.number().min(0, 'Maximum price cannot be negative').optional(),
  minRating: z.number().min(0, 'Minimum rating cannot be 0').max(5, 'Maximum rating cannot exceed 5').optional(),
  searchQuery: z.string().min(1, 'Search query cannot be empty').max(100, 'Search query too long').optional(),
});

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}

export function safeValidateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
    }
    return { success: false, error: 'Invalid input' };
  }
}

