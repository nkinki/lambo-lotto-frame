import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.NEON_DB_URL || 'postgresql://test:test@localhost:5432/test',
});

// Alap főnyeremény (jackpot) konstansként definiálva
const BASE_JACKPOT = 1000000;

export async function POST(request: NextRequest) {
  try {
    const { round_id } = await request.json();

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Aktuális aktív kör lekérdezése
      let round;
      if (round_id) {
        const roundResult = await client.query(`SELECT * FROM lottery_draws WHERE id = $1 AND status = 'active'`, [round_id]);
        if (roundResult.rows.length === 0) {
          throw new Error('Invalid or inactive round ID');
        }
        round = roundResult.rows[0];
      } else {
        const roundResult = await client.query(`SELECT * FROM lottery_draws WHERE status = 'active' ORDER BY draw_number DESC LIMIT 1`);
        if (roundResult.rows.length === 0) {
          throw new Error('No active round found');
        }
        round = roundResult.rows[0];
      }

      // Eladott szelvények lekérdezése az adott körben
      const ticketsResult = await client.query(`SELECT * FROM lottery_tickets WHERE draw_id = $1`, [round.id]);
      const totalTickets = ticketsResult.rows.length;

      // Nyertes szám generálása (1-100)
      const winningNumber = Math.floor(Math.random() * 100) + 1;

      // Nyertes keresése
      const winner = totalTickets > 0 ? ticketsResult.rows.find(ticket => ticket.number === winningNumber) : undefined;

      // Bevételek és a kincstárba/jackpotba kerülő összegek kiszámítása
      const totalRevenue = totalTickets * 100000; // 100,000 token per szelvény
      const carryOverAmount = Math.floor(totalRevenue * 0.7); // 70% a jackpothoz
      const treasuryAmount = totalRevenue - carryOverAmount; // 30% a kincstárba

      // --- JAVÍTÁS: Új jackpot számítása ---
      let newRoundJackpot;
      if (winner) {
        // Ha van nyertes, a következő kör jackpotja visszaáll az alap 1M-ra.
        newRoundJackpot = BASE_JACKPOT;
      } else {
        // JAVÍTÁS: `parseInt` használata, hogy a `round.jackpot`-ot biztosan számként kezelje összeadás előtt.
        // Ez megakadályozza a szövegek összefűzését (pl. '70000' + '70000' -> '7000070000').
        const currentJackpot = parseInt(round.jackpot || '0', 10);
        newRoundJackpot = currentJackpot + carryOverAmount;
      }
      
      // Jelenlegi kör lezárása 'completed' státusszal
      await client.query(`
        UPDATE lottery_draws 
        SET 
          status = 'completed',
          winning_number = $1,
          total_tickets = $2,
          end_time = NOW()
        WHERE id = $3
      `, [winningNumber, totalTickets, round.id]);

      // Új kör létrehozása a helyesen kiszámolt jackpottal
      const newRoundResult = await client.query(`
        INSERT INTO lottery_draws (
          draw_number, start_time, end_time, jackpot, status
        ) VALUES (
          $1 + 1, NOW(), NOW() + INTERVAL '1 day', $2, 'active'
        )
        RETURNING *
      `, [round.draw_number, newRoundJackpot]);

      await client.query('COMMIT');

      // Draw completed successfully
      console.log('✅ Lambo Lottery draw completed successfully');

      // Send email notification
      try {
        console.log('📧 Sending lottery results email...');
        
        // Prepare winners data for email
        const winners = winner ? [{
          player_fid: winner.player_fid,
          number: winningNumber,
          amount_won: parseInt(round.jackpot || '0', 10)
        }] : [];
        
        const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://farc-nu.vercel.app'}/api/lottery/send-results`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            round: { 
              id: round.id, 
              draw_number: round.draw_number,
              jackpot: round.jackpot
            },
            winningNumber,
            winners,
            totalPayout: winner ? parseInt(round.jackpot || '0', 10) : 0,
            nextJackpot: newRoundResult.rows[0].jackpot
          })
        });

        if (emailResponse.ok) {
          console.log('✅ Lottery results email sent successfully');
        } else {
          console.log('⚠️ Lottery results email failed');
        }
      } catch (emailError) {
        console.log('⚠️ Lottery results email error (non-critical):', emailError);
      }

      // Válasz küldése a frontend felé
      if (winner) {
        return NextResponse.json({
          success: true,
          hasWinner: true,
          winner: {
            fid: winner.player_fid,
            number: winningNumber,
            player_name: winner.player_name,
            player_address: winner.player_address,
            jackpot_won: round.jackpot 
          },
          round: { id: round.id, draw_number: round.draw_number, total_tickets: totalTickets },
          new_round: newRoundResult.rows[0],
          message: `Winner found! Jackpot of ${round.jackpot} claimed. Next round starts with ${BASE_JACKPOT}.`
        });
      } else {
        return NextResponse.json({
          success: true,
          hasWinner: false,
          winning_number: winningNumber,
          round: { id: round.id, draw_number: round.draw_number, total_tickets: totalTickets },
          new_round: newRoundResult.rows[0],
          message: "No winner found. Jackpot rolls over to the next round."
        });
      }

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error drawing winner:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error processing POST request:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: `Failed to draw winner: ${errorMessage}` }, { status: 500 });
  }
}