import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.NEON_DB_URL || 'postgresql://test:test@localhost:5432/test',
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roundId = searchParams.get('round_id');
    
    if (!roundId) {
      return NextResponse.json(
        { success: false, error: 'round_id parameter is required' },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT number FROM lottery_tickets 
        WHERE draw_id = $1
        ORDER BY number
      `, [roundId]);

      return NextResponse.json({ 
        success: true, 
        takenNumbers: result.rows.map(row => row.number)
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching taken numbers:', error);
    
    // Fallback to mock data for local development
    if (process.env.NODE_ENV === 'development') {
      console.log('Using mock taken numbers for local development');
      const mockTakenNumbers = [1, 7, 13, 24, 28, 29, 38, 44, 45, 66, 72, 84, 86, 88, 99]; // Mock taken numbers
      
      return NextResponse.json({ 
        success: true, 
        takenNumbers: mockTakenNumbers
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch taken numbers' },
      { status: 500 }
    );
  }
}
