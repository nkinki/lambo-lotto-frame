import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

export async function POST(request: NextRequest) {
    console.log('Lambo Lotto Webhook processing started.');
    try {
        const body = await request.json();
        const event = JSON.parse(Buffer.from(body.payload, 'base64').toString());

        console.log('Successfully decoded event payload:', JSON.stringify(event, null, 2));

        const notificationDetails = event.notificationDetails;
        const fid = event.fid;

        // Handle added/enabled events
        if (['miniapp_added', 'notifications_enabled', 'frame_added'].includes(event.event)) {
            if (notificationDetails && notificationDetails.token) {
                const { token, url } = notificationDetails;
                console.log(`Token found for event '${event.event}' for FID ${fid}. Attempting to save token: ${token}`);

                // Save token with app_id = 'lambo-lotto' and fid
                await pool.query(
                    'INSERT INTO notification_tokens (token, url, fid, app_id, created_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (token) DO UPDATE SET url = EXCLUDED.url, fid = EXCLUDED.fid, app_id = EXCLUDED.app_id',
                    [token, url, fid, 'lambo-lotto']
                );

                console.log('✅ SUCCESS: Token saved for Lambo Lotto:', token);
            }
        }

        // Handle removed/disabled events
        if (['miniapp_removed', 'notifications_disabled', 'frame_removed'].includes(event.event)) {
            if (notificationDetails?.token) {
                const tokenToRemove = notificationDetails.token;
                console.log(`Attempting to remove token: ${tokenToRemove}`);
                await pool.query('DELETE FROM notification_tokens WHERE token = $1', [tokenToRemove]);
                console.log('✅ SUCCESS: Token removal processed for:', tokenToRemove);
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('❌ LAMBO_LOTTO_WEBHOOK_ERROR:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
