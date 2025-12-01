// FÁJL: src/app/api/lottery/verify-purchase/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, fallback } from 'viem';
import { base } from 'viem/chains';
import { Pool } from 'pg';
import { LOTTO_PAYMENT_ROUTER_ADDRESS } from '@/abis/LottoPaymentRouter';

// Adatbázis kapcsolat inicializálása
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Szerver-oldali viem kliens a blokklánc ellenőrzéséhez
const publicClient = createPublicClient({
  chain: base,
  transport: fallback([
    http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
    http('https://base.blockpi.network/v1/rpc/public'),
    http('https://base.llamarpc.com'),
    http('https://base-mainnet.public.blastapi.io')
  ]),
});

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  
  try {
    const body = await request.json();
    const { 
      txHash, 
      fid, 
      round_id, 
      ticket_numbers, 
      playerAddress 
    } = body;

    // Részletes paraméter-ellenőrzés
    const missingParams = [];
    if (!txHash) missingParams.push('txHash');
    if (!fid) missingParams.push('fid');
    if (!round_id) missingParams.push('round_id');
    if (!ticket_numbers) missingParams.push('ticket_numbers');
    if (!Array.isArray(ticket_numbers)) missingParams.push('ticket_numbers (must be an array)');
    if (ticket_numbers && ticket_numbers.length === 0) missingParams.push('ticket_numbers (cannot be empty)');
    if (!playerAddress) missingParams.push('playerAddress');

    if (missingParams.length > 0) {
      console.error('Bad Request: Missing parameters', { missing: missingParams, received_body: body });
      return NextResponse.json({ 
        error: `Missing or invalid required parameters: ${missingParams.join(', ')}` 
      }, { status: 400 });
    }

    // BIZTONSÁGI VALIDÁCIÓ: Ticket number range check
    if (!ticket_numbers.every((num: any) => Number.isInteger(num) && num >= 1 && num <= 100)) {
      console.error('Security: Invalid ticket number range', { ticket_numbers });
      return NextResponse.json({ 
        error: 'Invalid ticket number range. Must be integers between 1-100.' 
      }, { status: 400 });
    }

    // BIZTONSÁGI VALIDÁCIÓ: Maximum 10 tickets per user
    if (ticket_numbers.length > 10) {
      console.error('Security: Too many tickets', { count: ticket_numbers.length });
      return NextResponse.json({ 
        error: 'Maximum 10 tickets per user per round.' 
      }, { status: 400 });
    }

    // --- 1. SZERVER-OLDALI TRANZAKCIÓ ELLENŐRZÉS (JAVÍTVA) ---
    console.log(`[Verifier] Waiting for receipt for txHash: ${txHash}`);
    
    // A waitForTransactionReceipt lecseréli a bonyolult while ciklust.
    // Addig vár, amíg a bizonylat elérhetővé nem válik, vagy lejár a 30 másodperces időkorlát.
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      timeout: 30_000 
    });

    // A waitForTransactionReceipt hibát dob, ha nem találja, így a sikeres eset után folytatódhat a kód.
    if (receipt.status !== 'success') {
      return NextResponse.json({ error: 'On-chain transaction failed.', details: `Status: ${receipt.status}` }, { status: 400 });
    }
    if (receipt.to?.toLowerCase() !== LOTTO_PAYMENT_ROUTER_ADDRESS.toLowerCase()) {
      return NextResponse.json({ error: 'Transaction was sent to the wrong contract address.' }, { status: 400 });
    }
    if (receipt.from?.toLowerCase() !== playerAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Transaction sender does not match the player address.' }, { status: 403 });
    }

    console.log(`[Verifier] Verification successful for txHash: ${txHash}`);

    // --- 2. KUMULATÍV LIMIT ELLENŐRZÉS (max 10 jegy / felhasználó / kör) ---
    const existingCountRes = await client.query(
      `SELECT COUNT(*) AS ticket_count FROM lottery_tickets WHERE draw_id = $1 AND player_fid = $2`,
      [round_id, fid]
    );
    const currentUserTickets = parseInt(existingCountRes.rows[0]?.ticket_count ?? '0', 10);
    if (currentUserTickets + ticket_numbers.length > 10) {
      return NextResponse.json(
        { error: `You already have ${currentUserTickets} tickets in this round. Maximum 10 tickets per user per round.` },
        { status: 400 }
      );
    }

    // --- 3. ADATBÁZISBA ÍRÁS ---
    await client.query('BEGIN');

    const existingTx = await client.query('SELECT id FROM lottery_tickets WHERE transaction_hash = $1', [txHash]);
    if (existingTx.rows.length > 0) {
      await client.query('ROLLBACK');
      console.log(`[Verifier] Transaction ${txHash} already processed.`);
      return NextResponse.json({ success: true, message: 'Purchase was already registered.' });
    }

    console.log(`[Verifier] Registering ${ticket_numbers.length} tickets for round ${round_id}`);
    for (const number of ticket_numbers) {
      // JAVÍTVA: A "number" oszlopnév idézőjelek közé került, mert az SQL-ben foglalt kulcsszó.
      await client.query(
        `INSERT INTO lottery_tickets (draw_id, player_fid, "number", transaction_hash, player_address, purchased_at, purchase_price)
         VALUES ($1, $2, $3, $4, $5, NOW(), 100000)`,
        [round_id, fid, number, txHash, playerAddress]
      );
    }
    
    await client.query('COMMIT');
    console.log(`[Verifier] Successfully committed tickets for txHash: ${txHash}`);
    
    return NextResponse.json({ success: true, message: 'Tickets successfully verified and registered.' });

  } catch (error: any) {
    await client.query('ROLLBACK').catch(rollbackError => console.error('Rollback failed:', rollbackError));
    console.error('[Verifier] API Error:', error);

    // Külön hibakezelés az időtúllépésre
    if (error.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Transaction verification timed out. It might still be processing. Please check back later.' }, { status: 408 });
    }

    return NextResponse.json({ error: 'Internal server error during transaction verification.', details: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}