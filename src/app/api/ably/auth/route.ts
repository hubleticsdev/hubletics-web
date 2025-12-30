import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createTokenRequest } from '@/lib/ably/server';
import { withRateLimit, apiRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
    const rateLimitResponse = await withRateLimit(request, apiRateLimit);
    if (rateLimitResponse) return rateLimitResponse;

    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Use the session user ID as the client ID
        const clientId = session.user.id;

        const tokenRequest = await createTokenRequest(clientId);

        return NextResponse.json(tokenRequest);
    } catch (error) {
        console.error('Ably auth error:', error);
        return NextResponse.json(
            { error: 'Authentication failed' },
            { status: 500 }
        );
    }
}
