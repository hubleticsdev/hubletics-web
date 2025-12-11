import { NextRequest, NextResponse } from 'next/server';

export function validateCronAuth(request: NextRequest): NextResponse | null {
  if (!process.env.CRON_SECRET) {
    console.error('[CRON] CRON_SECRET environment variable not configured');
    return NextResponse.json(
      { 
        success: false,
        error: 'Server configuration error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  
  if (authHeader !== expectedAuth) {
    console.warn('[CRON] Unauthorized cron request attempt');
    return NextResponse.json(
      { 
        success: false,
        error: 'Unauthorized',
        timestamp: new Date().toISOString(),
      },
      { status: 401 }
    );
  }

  return null;
}