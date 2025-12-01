import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function POST(request: NextRequest) {
  try {
    const { round, winningNumber, winners, totalPayout, nextJackpot } = await request.json();

    if (!round) {
      return NextResponse.json(
        { success: false, error: 'Missing required data: round' },
        { status: 400 }
      );
    }

    // Format the email content
    const winnersList = winners && winners.length > 0 
      ? winners.map((winner: any, index: number) => 
          `${index + 1}. FID ${winner.player_fid} - Number ${winner.number} - ${(winner.amount_won / 1e18).toFixed(2)} CHESS`
        ).join('\n')
      : 'No winners this round';

    // Use the nextJackpot parameter from the request
    const nextJackpotAmount = parseInt(nextJackpot || '0', 10);
    console.log('Next jackpot received:', nextJackpot, 'Parsed:', nextJackpotAmount);

    // Generate random emoji combinations for variety
    const emojiSets = [
      { lottery: '🏁', winner: '🏆', jackpot: '💰', next: '🎰', tip: '💡', fire: '🔥' },
      { lottery: '🎲', winner: '⭐', jackpot: '💎', next: '🎯', tip: '🔥', fire: '⚡' },
      { lottery: '🎪', winner: '👑', jackpot: '💸', next: '🎲', tip: '⚡', fire: '🚀' },
      { lottery: '🎊', winner: '🏅', jackpot: '💵', next: '🎮', tip: '🚀', fire: '💫' },
      { lottery: '🎈', winner: '🥇', jackpot: '💴', next: '🎲', tip: '💫', fire: '🌟' },
      { lottery: '🎯', winner: '🎖️', jackpot: '💶', next: '🎲', tip: '⭐', fire: '✨' },
      { lottery: '🎮', winner: '🏅', jackpot: '💷', next: '🎰', tip: '🎯', fire: '🔥' }
    ];
    
    const randomEmoji = emojiSets[Math.floor(Math.random() * emojiSets.length)];
    
    // Generate random motivational messages
    const noWinnerMessages = [
      "The jackpot keeps growing! 🌱",
      "Bigger and better next time! 📈", 
      "The pot is getting massive! 🚀",
      "Someone's going to be very lucky! 🍀",
      "The jackpot is heating up! 🔥",
      "The prize pool is expanding! 💎",
      "Next round could be yours! ⭐",
      "The jackpot is building up! 🏗️"
    ];
    
    const winnerMessages = [
      "Lucky winners take it all! 🎉",
      "The jackpot has been claimed! 💰",
      "Winners are celebrating! 🥳",
      "The pot has been won! 🏆",
      "Congratulations to the lucky ones! 🎊",
      "Amazing! Winners struck gold! ✨",
      "Incredible! The jackpot is claimed! 🌟",
      "Fantastic! Lucky numbers hit! 🎯"
    ];
    
    const randomNoWinnerMsg = noWinnerMessages[Math.floor(Math.random() * noWinnerMessages.length)];
    const randomWinnerMsg = winnerMessages[Math.floor(Math.random() * winnerMessages.length)];

    // Generate random compact layouts
    const layouts = [
      {
        header: `${randomEmoji.lottery} LAMBO LOTTERY RESULTS ${randomEmoji.lottery}`,
        box: `┌─────────────────────────────────┐\n│  Round #${round.draw_number} Results  │\n└─────────────────────────────────┘`,
        separator: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      },
      {
        header: `${randomEmoji.fire} LOTTERY DRAW ${randomEmoji.fire}`,
        box: `╔═════════════════════════════════╗\n║  Round #${round.draw_number} Results  ║\n╚═════════════════════════════════╝`,
        separator: '═══════════════════════════════════════════'
      },
      {
        header: `${randomEmoji.lottery} DRAW RESULTS ${randomEmoji.lottery}`,
        box: `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n┃  Round #${round.draw_number} Results  ┃\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`,
        separator: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      },
      {
        header: `${randomEmoji.fire} LOTTERY ${randomEmoji.fire}`,
        box: `┌─────────────────────────────────┐\n│  Round #${round.draw_number}  │\n└─────────────────────────────────┘`,
        separator: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      },
      {
        header: `${randomEmoji.lottery} RESULTS ${randomEmoji.lottery}`,
        box: `╭─────────────────────────────────╮\n│  Round #${round.draw_number} Results  │\n╰─────────────────────────────────╯`,
        separator: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      }
    ];
    
    const randomLayout = layouts[Math.floor(Math.random() * layouts.length)];

    const emailContent = `
${randomLayout.header}

${randomLayout.box}

${randomEmoji.winner} Winning: ${winningNumber || 'TBD'}
${randomEmoji.jackpot} Payout: ${(totalPayout / 1e18).toFixed(2)} CHESS
${randomEmoji.jackpot} Next Jackpot: ${nextJackpotAmount.toLocaleString()} CHESS

${winners && winners.length > 0 ? `🏆 WINNERS:` : `🎯 RESULTS:`}
${winnersList}

${winners && winners.length === 0 ? `
${randomEmoji.tip} ${randomNoWinnerMsg}

${randomEmoji.fire} Jackpot rolls over!
${randomEmoji.tip} Buy tickets for the next draw!
${randomEmoji.next} Next draw: 19:05 UTC
💰 Price: 100,000 CHESS each

https://farc-nu.vercel.app/promote
` : `
${randomEmoji.winner} ${randomWinnerMsg}

${randomEmoji.fire} Jackpot won! Resets to 1M CHESS!
${randomEmoji.tip} New round starts now!
${randomEmoji.next} Next draw: 19:05 UTC
💰 Price: 100,000 CHESS each

https://farc-nu.vercel.app/promote
`}

${randomLayout.separator}
AppRank BUY A LAMBO Lottery
    `.trim();

    const adminEmail = process.env.ADMIN_EMAIL;
    console.log('Admin email:', adminEmail);
    console.log('Email user:', process.env.EMAIL_USER);
    
    if (!adminEmail) {
      throw new Error('ADMIN_EMAIL environment variable not set');
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: adminEmail,
      subject: `🏁 BUY A LAMBO Lottery Results - Round #${round.draw_number} - Number ${winningNumber}`,
      text: emailContent,
    };

    await transporter.sendMail(mailOptions);

    console.log('✅ Lambo Lottery results email sent successfully');

    return NextResponse.json({
      success: true,
      message: 'Lambo Lottery results email sent successfully'
    });

  } catch (error) {
    console.error('❌ Error sending Lambo Lottery results email:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to send email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}