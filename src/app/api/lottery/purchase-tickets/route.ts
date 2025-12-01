import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Purchase tickets request body:', body);
    
    // Support both old and new format
    const { 
      fid, 
      ticketNumbers, 
      ticket_numbers, 
      round_id,
      playerAddress, 
      playerName, 
      playerAvatar 
    } = body;
    
    // Use new format if available, fallback to old format
    const finalFid = fid;
    const finalTicketNumbers = ticket_numbers || ticketNumbers;
    const finalRoundId = round_id;
    
    if (!finalFid || !finalTicketNumbers || !Array.isArray(finalTicketNumbers) || finalTicketNumbers.length === 0) {
      console.log('Validation failed:', { finalFid, finalTicketNumbers, isArray: Array.isArray(finalTicketNumbers) });
      return NextResponse.json(
        { success: false, error: 'Invalid request data. Required: fid, ticket_numbers (array)' },
        { status: 400 }
      );
    }

    if (finalTicketNumbers.length > 10) {
      return NextResponse.json(
        { success: false, error: 'Maximum 10 tickets can be purchased at once' },
        { status: 400 }
      );
    }

    // Check if user already has 10 tickets in this round
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get current active round (use round_id if provided, otherwise get active round)
      let round;
      if (finalRoundId) {
        const roundResult = await client.query(`
          SELECT id, total_tickets FROM lottery_draws 
          WHERE id = $1 AND status = 'active'
        `, [finalRoundId]);
        
        if (roundResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return NextResponse.json(
            { success: false, error: 'Invalid or inactive round ID' },
            { status: 400 }
          );
        }
        round = roundResult.rows[0];
      } else {
        const roundResult = await client.query(`
          SELECT id, total_tickets FROM lottery_draws 
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
        round = roundResult.rows[0];
      }

      // Check how many tickets the user already has in this round
      const userTicketsResult = await client.query(`
        SELECT COUNT(*) as ticket_count FROM lottery_tickets 
        WHERE draw_id = $1 AND player_fid = $2
      `, [round.id, finalFid]);

      const currentUserTickets = parseInt(userTicketsResult.rows[0].ticket_count);
      
      if (currentUserTickets + finalTicketNumbers.length > 10) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: `You already have ${currentUserTickets} tickets in this round. Maximum 10 tickets per user per round.` },
          { status: 400 }
        );
      }

      const currentTickets = round.total_tickets || 0;

      // Check if there are enough available numbers
      if (currentTickets + finalTicketNumbers.length > 100) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'Not enough available ticket numbers' },
          { status: 400 }
        );
      }

      // Check if any of the requested numbers are already taken
      const existingTickets = await client.query(`
        SELECT number FROM lottery_tickets 
        WHERE draw_id = $1 AND number = ANY($2)
      `, [round.id, finalTicketNumbers]);

      if (existingTickets.rows.length > 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { 
            success: false, 
            error: 'Some ticket numbers are already taken',
            takenNumbers: existingTickets.rows.map(t => t.number)
          },
          { status: 400 }
        );
      }

      // Insert tickets
      const insertedTickets = [];
      for (const number of finalTicketNumbers) {
        const ticketResult = await client.query(`
          INSERT INTO lottery_tickets (
            draw_id, player_fid, player_address, player_name, player_avatar, number
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `, [round.id, finalFid, playerAddress || '0x0000000000000000000000000000000000000000', playerName || 'Anonymous', playerAvatar || '', number]);
        
        insertedTickets.push(ticketResult.rows[0]);
      }

      // Update round ticket count
      await client.query(`
        UPDATE lottery_draws 
        SET total_tickets = total_tickets + $1
        WHERE id = $2
      `, [finalTicketNumbers.length, round.id]);

      // Update stats
      await client.query(`
        UPDATE lottery_stats 
        SET total_tickets = total_tickets + $1,
            active_tickets = active_tickets + $1
        WHERE id = 1
      `, [finalTicketNumbers.length]);

      await client.query('COMMIT');

      return NextResponse.json({ 
        success: true, 
        message: `Successfully purchased ${finalTicketNumbers.length} tickets`,
        tickets: insertedTickets,
        round_id: round.id,
        total_cost: finalTicketNumbers.length * 20000 // 20,000 CHESS per ticket
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error purchasing tickets:', error);
    
    // Fallback to mock data for local development
    if (process.env.NODE_ENV === 'development') {
      console.log('Using mock purchase for local development');
      const body = await request.json();
      const { fid, ticketNumbers, ticket_numbers } = body;
      const finalTicketNumbers = ticket_numbers || ticketNumbers;
      const finalFid = fid;
      
      const mockTickets = finalTicketNumbers.map((number: number, index: number) => ({
        id: index + 1,
        draw_id: 1,
        player_fid: finalFid,
        player_address: '0x0000000000000000000000000000000000000000',
        player_name: 'Anonymous',
        player_avatar: '',
        number: number,
        is_active: true,
        created_at: new Date().toISOString()
      }));
      
      return NextResponse.json({ 
        success: true, 
        message: `Successfully purchased ${finalTicketNumbers.length} tickets (MOCK)`,
        tickets: mockTickets,
        round_id: 1,
        total_cost: finalTicketNumbers.length * 20000
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to purchase tickets' },
      { status: 500 }
    );
  }
}