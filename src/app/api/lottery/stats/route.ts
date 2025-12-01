import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  try {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM lottery_stats WHERE id = 1
      `);

      if (result.rows.length === 0) {
        // Create initial stats if none exist
        const newStatsResult = await client.query(`
          INSERT INTO lottery_stats (
            total_tickets, 
            active_tickets, 
            total_jackpot, 
            next_draw_time, 
            last_draw_number
          ) VALUES (0, 0, 1000000, NOW() + INTERVAL '1 day', 0)
          RETURNING *
        `);
        
        return NextResponse.json({ 
          success: true, 
          stats: {
            total_rounds: 0,
            total_tickets_sold: newStatsResult.rows[0].total_tickets,
            total_prize_distributed: 0,
            treasury_balance: newStatsResult.rows[0].total_jackpot
          }
        });
      }

      return NextResponse.json({ 
        success: true, 
        stats: {
          total_rounds: result.rows[0].last_draw_number || 0,
          total_tickets_sold: result.rows[0].total_tickets || 0,
          total_prize_distributed: 0,
          treasury_balance: result.rows[0].total_jackpot || 1000000
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching lottery stats:', error);
    
    // Fallback to mock data for local development
    if (process.env.NODE_ENV === 'development') {
      console.log('Using mock stats for local development');
      const mockStats = {
        total_rounds: 1,
        total_tickets_sold: 0,
        total_prize_distributed: 0,
        treasury_balance: 1000000
      };
      
      return NextResponse.json({ 
        success: true, 
        stats: mockStats
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch lottery stats' },
      { status: 500 }
    );
  }
}