import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { round, winningNumber, winners, totalPayout, nextJackpot } = await request.json();

    if (!round || !winningNumber) {
      return NextResponse.json(
        { success: false, error: 'Missing required data' },
        { status: 400 }
      );
    }

    // Generate random emoji combinations for variety
    const emojiSets = [
      { lottery: '🏁', winner: '🏆', jackpot: '💰', next: '🎰', tip: '💡' },
      { lottery: '🎲', winner: '⭐', jackpot: '💎', next: '🎯', tip: '🔥' },
      { lottery: '🎪', winner: '👑', jackpot: '💸', next: '🎲', tip: '⚡' },
      { lottery: '🎊', winner: '🏅', jackpot: '💵', next: '🎮', tip: '🚀' },
      { lottery: '🎈', winner: '🥇', jackpot: '💴', next: '🎲', tip: '💫' }
    ];
    
    const randomEmoji = emojiSets[Math.floor(Math.random() * emojiSets.length)];
    
    // Generate random motivational messages
    const noWinnerMessages = [
      "The jackpot keeps growing! 🌱",
      "Bigger and better next time! 📈", 
      "The pot is getting massive! 🚀",
      "Someone's going to be very lucky! 🍀",
      "The jackpot is heating up! 🔥"
    ];
    
    const winnerMessages = [
      "Lucky winners take it all! 🎉",
      "The jackpot has been claimed! 💰",
      "Winners are celebrating! 🥳",
      "The pot has been won! 🏆",
      "Congratulations to the lucky ones! 🎊"
    ];
    
    const randomNoWinnerMsg = noWinnerMessages[Math.floor(Math.random() * noWinnerMessages.length)];
    const randomWinnerMsg = winnerMessages[Math.floor(Math.random() * winnerMessages.length)];

    // Format the winners list
    const winnersList = winners && winners.length > 0 
      ? winners.map((winner: any, index: number) => 
          `${index + 1}. FID ${winner.player_fid} - Number ${winner.number} - ${(winner.amount_won / 1e18).toFixed(2)} CHESS`
        ).join('\n')
      : 'No winners this round';

    // Use the nextJackpot parameter from the request
    const nextJackpotAmount = parseInt(nextJackpot || '0', 10);

    const formattedContent = `
${randomEmoji.lottery} LAMBO LOTTERY DRAW RESULTS ${randomEmoji.lottery}

┌─────────────────────────────────┐
│  Round #${round.draw_number} Results  │
└─────────────────────────────────┘

${randomEmoji.winner} Winning Number: ${winningNumber}
${randomEmoji.jackpot} Total Payout: ${(totalPayout / 1e18).toFixed(2)} CHESS
${randomEmoji.jackpot} Next Jackpot: ${nextJackpotAmount.toLocaleString()} CHESS

${winners && winners.length > 0 ? `🏆 WINNERS:` : `🎯 RESULTS:`}
${winnersList}

${winners && winners.length === 0 ? `
${randomEmoji.tip} ${randomNoWinnerMsg}

The jackpot rolls over to the next round!
Don't miss out - buy your tickets for tomorrow's draw!

${randomEmoji.tip} TIP: The more tickets you buy, the higher your chances of winning!
${randomEmoji.next} Next draw: Tomorrow at 19:05 UTC

Get your tickets now: https://farc-nu.vercel.app/promote
` : `
${randomEmoji.winner} ${randomWinnerMsg}

The jackpot has been won and resets to 1,000,000 CHESS!
New round starts now - buy your tickets for the next draw!

${randomEmoji.next} Next draw: Tomorrow at 19:05 UTC
Get your tickets: https://farc-nu.vercel.app/promote
`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated message from AppRank Lambo Lottery.
    `.trim();

    return NextResponse.json({
      success: true,
      formattedContent,
      round: round.draw_number,
      winningNumber,
      nextJackpot: nextJackpotAmount
    });

  } catch (error) {
    console.error('❌ Error formatting results:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to format results',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
