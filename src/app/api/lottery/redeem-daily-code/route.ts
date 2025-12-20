import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export async function POST(request: NextRequest) {
    const client = await pool.connect();
    try {
        const body = await request.json();
        const { code, fid } = body;

        if (!code || !fid) {
            return NextResponse.json({ error: 'Missing code or fid' }, { status: 400 });
        }

        // 1. Validate Code
        const codeResult = await client.query(
            'SELECT * FROM lotto_daily_codes WHERE code = $1 AND is_active = TRUE',
            [code]
        );
        if (codeResult.rows.length === 0) {
            return NextResponse.json({ error: 'Invalid or expired code.' }, { status: 400 });
        }

        // 2. Check if user already used THIS code
        const usageResult = await client.query(
            'SELECT * FROM lotto_daily_code_usages WHERE fid = $1 AND code = $2',
            [fid, code]
        );
        if (usageResult.rows.length > 0) {
            return NextResponse.json({ error: 'You have already redeemed this daily code.' }, { status: 400 });
        }

        // 3. Check if user used ANY code today
        const todayResult = await client.query(
            'SELECT * FROM lotto_daily_code_usages WHERE fid = $1 AND used_at > CURRENT_DATE',
            [fid]
        );
        if (todayResult.rows.length > 0) {
            return NextResponse.json({ error: 'You have already redeemed a code today. Come back tomorrow!' }, { status: 400 });
        }

        // 4. Check if subscribed to notifications
        const subResult = await client.query(
            'SELECT * FROM notification_tokens WHERE fid = $1 AND app_id = $2 LIMIT 1',
            [fid, 'lambo-lotto']
        );
        if (subResult.rows.length === 0) {
            return NextResponse.json({
                error: 'You must subscribe to notifications to redeem this code!',
                needsSubscription: true
            }, { status: 403 });
        }

        // 5. Get current active round
        const roundResult = await client.query(
            "SELECT id FROM lottery_draws WHERE status = 'active' ORDER BY draw_number DESC LIMIT 1"
        );
        if (roundResult.rows.length === 0) {
            return NextResponse.json({ error: 'No active lottery round found.' }, { status: 404 });
        }
        const roundId = roundResult.rows[0].id;

        // 6. Check how many tickets user already has (limit 10)
        const ticketCountResult = await client.query(
            'SELECT COUNT(*) FROM lottery_tickets WHERE draw_id = $1 AND player_fid = $2',
            [roundId, fid]
        );
        const currentTickets = parseInt(ticketCountResult.rows[0].count);
        if (currentTickets >= 10) {
            return NextResponse.json({ error: 'You already have the maximum amount of tickets (10) for this round.' }, { status: 400 });
        }
        const ticketsToGrant = Math.min(3, 10 - currentTickets);

        if (ticketsToGrant <= 0) {
            return NextResponse.json({ error: 'You already have 10 tickets in this round.' }, { status: 400 });
        }

        // 7. Find available numbers (1-100)
        const takenResult = await client.query(
            'SELECT number FROM lottery_tickets WHERE draw_id = $1',
            [roundId]
        );
        const takenNumbers = takenResult.rows.map(r => r.number);
        const availableNumbers = [];
        for (let i = 1; i <= 100; i++) {
            if (!takenNumbers.includes(i)) {
                availableNumbers.push(i);
            }
        }

        if (availableNumbers.length < ticketsToGrant) {
            return NextResponse.json({ error: 'Not enough available numbers in this round.' }, { status: 400 });
        }

        // Shuffle and pick
        const shuffled = availableNumbers.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, ticketsToGrant);

        // 8. Grant tickets and record usage in transaction
        await client.query('BEGIN');
        try {
            for (const num of selected) {
                await client.query(
                    `INSERT INTO lottery_tickets (draw_id, player_fid, "number", purchased_at, purchase_price, is_active)
                 VALUES ($1, $2, $3, NOW(), 0, TRUE)`,
                    [roundId, fid, num]
                );
            }
            await client.query(
                'INSERT INTO lotto_daily_code_usages (fid, code) VALUES ($1, $2)',
                [fid, code]
            );
            await client.query('COMMIT');

            return NextResponse.json({
                success: true,
                grantedTickets: selected,
                message: `Success! You received ${ticketsToGrant} free tickets: ${selected.join(', ')}`
            });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        }

    } catch (error: any) {
        console.error('Redeem Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    } finally {
        client.release();
    }
}
