import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(request: NextRequest) {
  try {
    const { winningId, playerFid } = await request.json();

    if (!winningId || !playerFid) {
      return NextResponse.json(
        { success: false, error: 'Winning ID and Player FID are required' },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    
    try {
      // Check if the winning exists and is owned by the user
      const checkResult = await client.query(`
        SELECT 
          lw.id,
          lw.amount_won,
          lw.claimed_at
        FROM lottery_winnings lw
        WHERE lw.id = $1 AND lw.player_fid = $2
      `, [winningId, playerFid]);

      if (checkResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Winning not found or not owned by user' },
          { status: 404 }
        );
      }

      const winning = checkResult.rows[0];

      if (!winning.claimed_at) {
        return NextResponse.json(
          { success: false, error: 'Prize is not claimed yet' },
          { status: 400 }
        );
      }

      // Reset the claim status
      const updateResult = await client.query(`
        UPDATE lottery_winnings 
        SET claimed_at = NULL
        WHERE id = $1
        RETURNING *
      `, [winningId]);

      // Add back the amount to treasury
      await client.query(`
        UPDATE lottery_stats 
        SET total_jackpot = total_jackpot + $1
        WHERE id = 1
      `, [winning.amount_won]);

      client.release();

      return NextResponse.json({
        success: true,
        message: 'Claim status reset successfully',
        winning: updateResult.rows[0]
      });

    } catch (error) {
      client.release();
      throw error;
    }

  } catch (error) {
    console.error('Error resetting claim:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset claim' },
      { status: 500 }
    );
  }
}
