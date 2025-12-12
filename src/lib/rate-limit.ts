import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from '@/lib/env';

const redis = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

export const authRateLimit = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  analytics: true,
}) : null;

export const apiRateLimit = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 h'),
  analytics: true,
}) : null;

export const bookingRateLimit = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  analytics: true,
}) : null;

export const messageRateLimit = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  analytics: true,
}) : null;

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfIP = request.headers.get('cf-connecting-ip');

  return forwarded?.split(',')[0]?.trim() ||
         realIP ||
         cfIP ||
         'anonymous';
}

export async function rateLimit(
  request: Request,
  limiter: Ratelimit | null,
  identifier?: string
): Promise<{ success: boolean; limit: number; remaining: number; reset: Date }> {
  if (!limiter) {
    return {
      success: true,
      limit: 999999,
      remaining: 999998,
      reset: new Date(Date.now() + 3600000),
    };
  }

  const ip = identifier || getClientIP(request);

  const result = await limiter.limit(ip);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: new Date(result.reset),
  };
}

export async function withRateLimit(
  request: Request,
  limiter: Ratelimit | null = apiRateLimit,
  identifier?: string
) {
  const result = await rateLimit(request, limiter, identifier);

  if (!result.success) {
    return new Response(JSON.stringify({
      error: 'Too many requests',
      retryAfter: Math.ceil((result.reset.getTime() - Date.now()) / 1000),
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil((result.reset.getTime() - Date.now()) / 1000).toString(),
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.reset.getTime().toString(),
      },
    });
  }

  return null;
}
