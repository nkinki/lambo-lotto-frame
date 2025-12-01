import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});


export async function GET() {
  try {
    // Get the last completed round with a winning number
    const query = `
      SELECT winning_number 
      FROM lottery_draws 
      WHERE status = 'completed' AND winning_number IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 1
    `;

    const result = await pool.query(query);

    if (result.rows.length > 0) {
      return NextResponse.json({
        success: true,
        winning_number: result.rows[0].winning_number
      });
    } else {
      return NextResponse.json({
        success: true,
        winning_number: null
      });
    }
  } catch (error) {
    console.error('Error fetching last winning number:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch last winning number' },
      { status: 500 }
    );
  }
}
