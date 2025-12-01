import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(request: NextRequest) {
  try {
    const client = await pool.connect();
    
    // Get last 5 completed rounds with results
    const result = await client.query(`
      SELECT 
        id,
        draw_number,
        winning_number,
        jackpot,
        total_tickets,
        status,
        start_time,
        end_time,
        created_at
      FROM lottery_draws 
      WHERE status = 'completed' 
      ORDER BY draw_number DESC 
      LIMIT 5
    `);

    client.release();

    return NextResponse.json({
      success: true,
      rounds: result.rows
    });

  } catch (error) {
    console.error('Error fetching recent lottery results:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch recent results' },
      { status: 500 }
    );
  }
}
