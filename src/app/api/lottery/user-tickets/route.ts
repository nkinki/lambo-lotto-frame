import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    
    if (!fid) {
      return NextResponse.json(
        { success: false, error: 'FID parameter is required' },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          lt.id,
          lt.draw_id as round_id,
          lt.player_fid as fid,
          lt.number as ticket_number,
          20000 as purchase_price,
          lt.created_at as purchased_at
        FROM lottery_tickets lt
        JOIN lottery_draws ld ON lt.draw_id = ld.id
        WHERE lt.player_fid = $1 AND ld.status = 'active'
        ORDER BY lt.created_at DESC
      `, [fid]);

      return NextResponse.json({ 
        success: true, 
        tickets: result.rows
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching user tickets:', error);
    
    // Fallback to mock data for local development
    if (process.env.NODE_ENV === 'development') {
      console.log('Using mock user tickets for local development');
      const mockTickets = [
        {
          id: 1,
          round_id: 1,
          fid: parseInt(request.nextUrl.searchParams.get('fid') || '12345'),
          ticket_number: 7,
          purchase_price: 20000,
          purchased_at: new Date().toISOString()
        },
        {
          id: 2,
          round_id: 1,
          fid: parseInt(request.nextUrl.searchParams.get('fid') || '12345'),
          ticket_number: 13,
          purchase_price: 20000,
          purchased_at: new Date().toISOString()
        }
      ];
      
      return NextResponse.json({ 
        success: true, 
        tickets: mockTickets
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user tickets' },
      { status: 500 }
    );
  }
}