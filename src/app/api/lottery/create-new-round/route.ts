import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(request: NextRequest) {
  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get the last completed round to calculate new jackpot
      const lastRoundResult = await client.query(`
        SELECT * FROM lottery_draws 
        WHERE status = 'completed' 
        ORDER BY draw_number DESC 
        LIMIT 1
      `);

      let newJackpot = 1000000; // Default 1M CHESS tokens

      if (lastRoundResult.rows.length > 0) {
        const lastRound = lastRoundResult.rows[0];
        
        // Calculate new jackpot: 70% of ticket sales from last round
        const lastRoundTickets = lastRound.total_tickets || 0;
        const ticketRevenue = lastRoundTickets * 20000; // 20,000 CHESS per ticket
        const carryOverAmount = Math.floor(ticketRevenue * 0.7);
        const treasuryAmount = Math.floor(ticketRevenue * 0.3);
        
        newJackpot = 1000000 + carryOverAmount; // Base 1M + carryover
        
        // Update treasury balance in stats
        await client.query(`
          UPDATE lottery_stats 
          SET total_jackpot = total_jackpot + $1
          WHERE id = 1
        `, [treasuryAmount]);
      }

      // Get next draw number
      const nextDrawResult = await client.query(`
        SELECT COALESCE(MAX(draw_number), 0) + 1 as next_draw 
        FROM lottery_draws
      `);
      
      const nextDrawNumber = nextDrawResult.rows[0].next_draw;

      // Calculate new round dates
      const now = new Date();
      const startTime = new Date(now);
      const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +1 day

      // Create new round
      const newRoundResult = await client.query(`
        INSERT INTO lottery_draws (
          draw_number, 
          start_time, 
          end_time, 
          jackpot, 
          status
        ) VALUES ($1, $2, $3, $4, 'active')
        RETURNING *
      `, [nextDrawNumber, startTime, endTime, newJackpot]);

      await client.query('COMMIT');

      return NextResponse.json({ 
        success: true, 
        message: 'New round created successfully',
        round: {
          id: newRoundResult.rows[0].id,
          draw_number: newRoundResult.rows[0].draw_number,
          jackpot: newRoundResult.rows[0].jackpot,
          start_time: newRoundResult.rows[0].start_time,
          end_time: newRoundResult.rows[0].end_time,
          status: newRoundResult.rows[0].status
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating new round:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create new round' },
      { status: 500 }
    );
  }
}
