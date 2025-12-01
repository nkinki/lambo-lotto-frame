import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userFid = searchParams.get('fid');

    if (!userFid) {
      return NextResponse.json(
        { success: false, error: 'User FID is required' },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    
    // Get user's winnings
    const result = await client.query(`
      SELECT 
        lw.id,
        lw.player_fid,
        lw.draw_id,
        lw.ticket_id,
        lw.amount_won,
        lw.claimed_at,
        lw.created_at,
        ld.draw_number,
        ld.winning_number,
        lt.number as ticket_number
      FROM lottery_winnings lw
      JOIN lottery_draws ld ON lw.draw_id = ld.id
      JOIN lottery_tickets lt ON lw.ticket_id = lt.id
      WHERE lw.player_fid = $1
      ORDER BY lw.created_at DESC
    `, [userFid]);

    client.release();

    return NextResponse.json({
      success: true,
      winnings: result.rows
    });

  } catch (error) {
    console.error('Error fetching user winnings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user winnings' },
      { status: 500 }
    );
  }
}
