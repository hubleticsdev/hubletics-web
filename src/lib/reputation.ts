// Centralized reputation and review system for Hubletics
export interface ReputationData {
  averageRating: number;
  totalReviews: number;
  ratingBreakdown: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface ReputationDisplay {
  averageRating: number;
  totalReviews: number;
  formattedRating: string;
  starRating: number;
  hasReviews: boolean;
}

export function parseReputationScore(reputationScore: string | number | null): number {
  if (!reputationScore) return 0;
  const score = typeof reputationScore === 'string' ? parseFloat(reputationScore) : reputationScore;
  return Number.isFinite(score) ? score : 0;
}

export function formatRating(rating: number, totalReviews: number): string {
  if (totalReviews === 0) return 'No reviews';
  return rating.toFixed(1);
}

export function getStarRating(rating: number): number {
  return Math.round(rating * 2) / 2;
}

export function calculateReputationFromReviews(reviews: Array<{ rating: number }>): ReputationData {
  if (!reviews || reviews.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
  }

  const totalReviews = reviews.length;
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  const averageRating = sum / totalReviews;

  const ratingBreakdown = reviews.reduce((acc, review) => {
    const rating = Math.floor(review.rating) as keyof typeof acc;
    if (rating >= 1 && rating <= 5) {
      acc[rating]++;
    }
    return acc;
  }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as ReputationData['ratingBreakdown']);

  return {
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews,
    ratingBreakdown
  };
}

export function getReputationDisplay(reputationScore: string | number | null, totalReviews: number): ReputationDisplay {
  const averageRating = parseReputationScore(reputationScore);

  return {
    averageRating,
    totalReviews,
    formattedRating: formatRating(averageRating, totalReviews),
    starRating: getStarRating(averageRating),
    hasReviews: totalReviews > 0
  };
}

export function isValidRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

export function isValidAverageRating(rating: number): boolean {
  return Number.isFinite(rating) && rating >= 1 && rating <= 5;
}

export function formatReputationScoreForStorage(rating: number): string {
  if (!isValidAverageRating(rating)) {
    throw new Error('Invalid rating: must be between 1 and 5');
  }
  return rating.toFixed(2);
}

export const REPUTATION_THRESHOLDS = {
  EXCELLENT: 4.5,
  GOOD: 3.5,
  AVERAGE: 2.5,
  POOR: 1.5
} as const;

export function getReputationLevel(rating: number): 'excellent' | 'good' | 'average' | 'poor' | 'none' {
  if (rating === 0) return 'none';
  if (rating >= REPUTATION_THRESHOLDS.EXCELLENT) return 'excellent';
  if (rating >= REPUTATION_THRESHOLDS.GOOD) return 'good';
  if (rating >= REPUTATION_THRESHOLDS.AVERAGE) return 'average';
  return 'poor';
}
