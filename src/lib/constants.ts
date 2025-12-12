// Centralized constants for the application
export const SPORTS = [
  'Basketball',
  'Tennis',
  'Golf',
  'Swimming',
  'Soccer',
  'Volleyball',
  'Baseball',
  'Hockey',
  'Football',
  'Cycling',
  'Running',
  'Yoga',
  'Pilates',
  'Martial Arts',
  'Boxing',
  'CrossFit',
  'Weightlifting',
  'Track & Field',
  'Wrestling',
  'Gymnastics'
] as const;

export const SPORT_SPECIALTIES: Record<string, string[]> = {
  Basketball: [
    'Shooting',
    'Defense',
    'Conditioning',
    'Footwork',
    'Ball Handling',
    'Rebounding',
    'Team Play',
    'Youth Development'
  ],
  Tennis: [
    'Groundstrokes',
    'Serves',
    'Volleys',
    'Mental Game',
    'Footwork',
    'Strategy',
    'Youth Coaching',
    'Competitive Play'
  ],
  Golf: [
    'Swing Mechanics',
    'Short Game',
    'Course Management',
    'Mental Game',
    'Putting',
    'Driving',
    'Youth Instruction',
    'Senior Golf'
  ],
  Swimming: [
    'Freestyle',
    'Backstroke',
    'Breaststroke',
    'Butterfly',
    'IM Training',
    'Open Water',
    'Water Polo',
    'Triathlon Prep'
  ],
  Soccer: [
    'Technical Skills',
    'Tactics',
    'Goalkeeping',
    'Fitness',
    'Youth Development',
    'Team Building',
    'Scouting',
    'Leadership'
  ],
  Running: [
    'Marathon Training',
    'Sprint Training',
    'Injury Prevention',
    'Nutrition',
    'Track & Field',
    'Trail Running',
    'Ultra Running',
    'Youth Running'
  ],
  'Martial Arts': [
    'Brazilian Jiu-Jitsu',
    'Karate',
    'Taekwondo',
    'Krav Maga',
    'Muay Thai',
    'Judo',
    'Self Defense',
    'Competition Prep'
  ]
} as const;

export const USER_ROLES = ['client', 'coach', 'admin'] as const;
export const USER_STATUSES = ['active', 'inactive', 'suspended', 'pending'] as const;

export const BOOKING_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'cancelled',
  'completed',
  'disputed',
  'open'
] as const;

export const EXPERIENCE_LEVELS = [
  'beginner',
  'intermediate',
  'advanced',
  'expert'
] as const;

export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
] as const;

export const TIME_SLOTS = [
  'Early Morning (5-8 AM)',
  'Morning (8-12 PM)',
  'Afternoon (12-5 PM)',
  'Evening (5-9 PM)',
  'Night (9 PM+)'
] as const;

// Pricing and fees
export const DEFAULT_PLATFORM_FEE_PERCENTAGE = 15;
export const MAX_PLATFORM_FEE_PERCENTAGE = 50;
export const MIN_HOURLY_RATE = 10;
export const MAX_HOURLY_RATE = 1000;

// Booking constraints
export const MAX_ADVANCE_BOOKING_DAYS = 90;
export const MIN_ADVANCE_BOOKING_HOURS = 24;
export const MAX_BOOKING_DURATION_HOURS = 8;
export const BOOKING_CANCELLATION_DEADLINE_HOURS = 24;
export const PAYMENT_DEADLINE_HOURS = 24;
export const GROUP_BOOKING_DEADLINE_HOURS = 24;

export const MAX_PROFILE_PHOTO_SIZE = 5 * 1024 * 1024;
export const MAX_CERTIFICATION_FILE_SIZE = 10 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_CONVERSATION_PARTICIPANTS = 2;

export const MIN_GROUP_SIZE = 2;
export const MAX_GROUP_SIZE = 50;

export const AUTO_CONFIRMATION_DELAY_HOURS = 168;
export const PAYMENT_REMINDER_12H_HOURS = 12;
export const PAYMENT_REMINDER_30M_MINUTES = 30;

// Email verification
export const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const AUTH_RATE_LIMIT = {
  window: '1m',
  max: 5
};

export const API_RATE_LIMIT = {
  window: '1h',
  max: 100
};

export const BOOKING_RATE_LIMIT = {
  window: '1h',
  max: 10
};

export const MESSAGE_RATE_LIMIT = {
  window: '1m',
  max: 60
};

export const EMAIL_FROM = 'noreply@hubletics.com';
export const EMAIL_SUBJECT_PREFIX = 'Hubletics - ';

export const SOCIAL_LINKS = {
  twitter: 'https://twitter.com/hubletics',
  instagram: 'https://instagram.com/hubletics',
  linkedin: 'https://linkedin.com/company/hubletics'
} as const;

export const FEATURES = {
  groupBookings: true,
  advancedAnalytics: false,
  premiumProfiles: false,
  videoConsultations: false
} as const;

export type Sport = typeof SPORTS[number];
export type UserRole = typeof USER_ROLES[number];
export type UserStatus = typeof USER_STATUSES[number];
export type BookingStatus = typeof BOOKING_STATUSES[number];
export type ExperienceLevel = typeof EXPERIENCE_LEVELS[number];
export type DayOfWeek = typeof DAYS_OF_WEEK[number];
