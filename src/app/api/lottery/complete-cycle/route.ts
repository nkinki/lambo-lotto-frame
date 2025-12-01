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

      // Step 1: Get current active round
      const roundResult = await client.query(`
        SELECT * FROM lottery_draws 
        WHERE status = 'active' 
        ORDER BY draw_number DESC 
        LIMIT 1
      `);

      if (roundResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'No active round found' },
          { status: 400 }
        );
      }

      const round = roundResult.rows[0];

      // Step 2: Check if draw time has arrived
      if (new Date() < new Date(round.end_time)) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'Draw time has not arrived yet' },
          { status: 400 }
        );
      }

      // Step 3: Get all sold tickets for this round
      const ticketsResult = await client.query(`
        SELECT * FROM lottery_tickets 
        WHERE draw_id = $1
        ORDER BY number ASC
      `, [round.id]);

      let winnerFid: number | null = null;
      let winningNumber: number | null = null;

      if (ticketsResult.rows.length > 0) {
        // Generate random winning number (1-100)
        winningNumber = Math.floor(Math.random() * 100) + 1;

        // Find winner (if any ticket matches the winning number)
        const winnerTicket = ticketsResult.rows.find(ticket => ticket.number === winningNumber);
        
        if (winnerTicket) {
          winnerFid = winnerTicket.player_fid;
        }
      }

      // Step 4: Complete current round
      await client.query(`
        UPDATE lottery_draws 
        SET status = 'completed', 
            winning_number = $1
        WHERE id = $2
      `, [winningNumber, round.id]);

      // Step 5: Update lottery stats
      await client.query(`
        UPDATE lottery_stats 
        SET last_draw_number = last_draw_number + 1,
            total_tickets = total_tickets + $1,
            active_tickets = active_tickets - $1
        WHERE id = 1
      `, [ticketsResult.rows.length]);

      // Step 6: Calculate new jackpot for next round
      let newJackpot = 1000000; // Default 1M CHESS tokens
      
      if (ticketsResult.rows.length > 0) {
        // 70% of ticket sales go to next round's jackpot
        const ticketRevenue = ticketsResult.rows.length * 20000; // 20,000 CHESS per ticket
        const carryOverAmount = Math.floor(ticketRevenue * 0.7);
        const treasuryAmount = Math.floor(ticketRevenue * 0.3);
        newJackpot = 1000000 + carryOverAmount;
        
        // Update treasury balance in stats
        await client.query(`
          UPDATE lottery_stats 
          SET total_jackpot = total_jackpot + $1
          WHERE id = 1
        `, [treasuryAmount]);
      }

      // Step 7: Create new round
      const nextDrawNumber = round.draw_number + 1;
      const now = new Date();
      const startTime = new Date(now);
      const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +1 day

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
        message: 'Lottery cycle completed successfully',
        completed_round: {
          id: round.id,
          draw_number: round.draw_number,
          winner_fid: winnerFid,
          winning_number: winningNumber,
          jackpot: round.jackpot,
          tickets_sold: ticketsResult.rows.length
        },
        new_round: {
          id: newRoundResult.rows[0].id,
          draw_number: newRoundResult.rows[0].draw_number,
          jackpot: newRoundResult.rows[0].jackpot,
          start_time: newRoundResult.rows[0].start_time,
          end_time: newRoundResult.rows[0].end_time
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error completing lottery cycle:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to complete lottery cycle' },
      { status: 500 }
    );
  }
}
