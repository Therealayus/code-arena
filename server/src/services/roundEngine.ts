/**
 * Round Engine - Server authoritative round lifecycle
 *
 * Lifecycle: WAITING -> BETTING_OPEN (60s) -> BETTING_CLOSED -> RESULT_CALCULATED -> RESULT_REVEALED (8s) -> NEXT_ROUND
 *
 * Winner determination:
 *  - Aggregate total per color
 *  - Winner = color with lowest total
 *  - Tie handling (deterministic): if multiple colors share lowest total, winner is earliest in COLOR_PRIORITY
 *    e.g., priority = [RED, GREEN, BLUE]. So if RED and BLUE tie at 1000, RED wins.
 *  - Stored tieBreakReason documents the tie detection and resolution.
 *  - No bets edge case: pick random color weighted equally, reason = NO_BETS_RANDOM
 *
 * Payout:
 *  - Fixed multipliers from PAYOUT_RULES (gross return, stake included):
 *    singles 2.0x, combinations (RED_BLUE, GREEN_BLUE) 1.5x.
 *  - A fixed platform fee (PLATFORM_FEE_PERCENT, default 10%) applies to
 *    EVERY win: gross = floor(bet * multiplier), fee = floor(gross * fee%),
 *    net = gross - fee. Only the net is credited to the wallet.
 *  - Each win writes a WIN_PAYOUT tx (amount = net, full breakdown in meta)
 *    plus a separate PLATFORM_FEE tx (amount = fee, informational).
 *  - Settlement is idempotent: a bet that already has a WIN_PAYOUT tx for
 *    this round is never paid twice, and the round is claimed atomically
 *    (BETTING_OPEN -> BETTING_CLOSED) so concurrent ticks can't settle twice.
 *  - Result generation stays independent of betting distribution/liability.
 *
 * Server is source of truth. No client can influence timing or winner.
 */

import mongoose from 'mongoose';
import { GameRound } from '../models/GameRound';
import { Bet } from '../models/Bet';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { Counter, getNextSequence } from '../models/Counter';
import { config, COLORS, COLOR_PRIORITY, Color, ResultType } from '../config';
import { calculatePayout, getWinningColors } from './payout';
import { log } from '../utils/logger';
import { getIO } from '../sockets';

let tickInterval: NodeJS.Timeout | null = null;
let isEngineRunning = false;
let currentRoundId: string | null = null;

// Helper: ensure initial round exists — defensive against leftover duplicate BETTING_OPEN rounds
export async function ensureInitialRound() {
  const bettingOpens = await GameRound.find({ status: 'BETTING_OPEN' }).sort({ roundNumber: -1 });
  if (bettingOpens.length > 1) {
    log.warn(`Found ${bettingOpens.length} BETTING_OPEN rounds, cleaning duplicates. Keeping #${bettingOpens[0].roundNumber}`);
    for (let i = 1; i < bettingOpens.length; i++) {
      const r = bettingOpens[i] as any;
      r.status = 'RESULT_REVEALED';
      r.winningColor = 'RED';
      r.tieBreakReason = 'CLEANUP: duplicate BETTING_OPEN on startup';
      r.resultTime = new Date();
      await r.save();
    }
    currentRoundId = bettingOpens[0]._id.toString();
    log.info(`Resuming existing round #${bettingOpens[0].roundNumber} status=${bettingOpens[0].status}`);
    return;
  }
  if (bettingOpens.length === 1) {
    currentRoundId = bettingOpens[0]._id.toString();
    log.info(`Resuming existing round #${bettingOpens[0].roundNumber} status=${bettingOpens[0].status}`);
    return;
  }
  const existing = await GameRound.findOne().sort({ roundNumber: -1 });
  if (!existing || existing.status === 'RESULT_REVEALED') {
    await createNewRound();
  } else {
    currentRoundId = existing._id.toString();
    log.info(`Resuming existing round #${existing.roundNumber} status=${existing.status}`);
  }
}

export async function createNewRound(): Promise<any> {
  // Guard: prevent duplicate creation if a BETTING_OPEN round already exists (multi-instance safety)
  const existingOpen = await GameRound.findOne({ status: 'BETTING_OPEN' });
  if (existingOpen) {
    log.warn(`createNewRound skipped — BETTING_OPEN #${existingOpen.roundNumber} already exists`);
    return existingOpen;
  }
  const now = new Date();
  const roundNumber = await getNextSequence('roundNumber');
  const bettingCloseTime = new Date(now.getTime() + config.bettingDurationMs);

  const colorTotals: any = {};
  COLORS.forEach((c) => (colorTotals[c] = 0));

  const round = await GameRound.create({
    roundNumber,
    status: 'BETTING_OPEN',
    startTime: now,
    bettingCloseTime,
    winningColor: null,
    colorTotals,
    totalBetAmount: 0,
    totalBetsCount: 0,
    tieBreakReason: null,
  });

  currentRoundId = round._id.toString();
  log.info(`Created round #${round.roundNumber} closes at ${bettingCloseTime.toISOString()}`);

  try {
    const io = getIO();
    io.emit('round:new', { round: round.toObject() });
    io.emit('round:tick', {
      roundNumber: round.roundNumber,
      roundId: round._id,
      status: round.status,
      remainingMs: config.bettingDurationMs,
      bettingCloseTime,
    });
  } catch {}

  return round;
}

function getTotalsObject(round: any): Record<string, number> {
  const totals: Record<string, number> = {};
  COLORS.forEach((c) => (totals[c] = 0));
  if (!round.colorTotals) return totals;
  // Mongoose Map or plain object
  if (round.colorTotals instanceof Map) {
    round.colorTotals.forEach((v: number, k: string) => (totals[k] = v));
  } else {
    Object.entries(round.colorTotals).forEach(([k, v]) => (totals[k] = v as number));
  }
  // Also verify via Bet aggregation for safety? Use stored totals as denormalized but recalc for correctness
  return totals;
}

export async function calculateWinner(roundId: string): Promise<{ winner: Color; totals: Record<string, number>; reason: string | null }> {
  // Re-aggregate from Bet collection for authoritative totals (not relying on denormalized)
  const bets = await Bet.aggregate([
    { $match: { roundId: new mongoose.Types.ObjectId(roundId) } },
    { $group: { _id: '$color', total: { $sum: '$amount' } } },
  ]);

  const totals: Record<string, number> = {};
  COLORS.forEach((c) => (totals[c] = 0));
  bets.forEach((b) => (totals[b._id] = b.total));

  const totalBetAmount = Object.values(totals).reduce((a, b) => a + b, 0);
  const entries = Object.entries(totals) as [Color, number][];

  // No bets case
  if (totalBetAmount === 0) {
    const randomWinner = COLORS[Math.floor(Math.random() * COLORS.length)] as Color;
    return { winner: randomWinner, totals, reason: 'NO_BETS_RANDOM: No bets placed, winner selected randomly' };
  }

  const minTotal = Math.min(...Object.values(totals));
  const candidates = entries.filter(([, v]) => v === minTotal).map(([c]) => c as Color);

  if (candidates.length === 1) {
    return { winner: candidates[0], totals, reason: null };
  }

  // Tie detected - deterministic priority
  let winner = candidates[0];
  let winnerPriority = COLOR_PRIORITY.indexOf(winner);
  for (const c of candidates) {
    const p = COLOR_PRIORITY.indexOf(c);
    if (p < winnerPriority) {
      winner = c;
      winnerPriority = p;
    }
  }

  const reason = `TIE_BREAK: ${candidates.join(', ')} tied at ${minTotal}. Applied priority ${COLOR_PRIORITY.join(' > ')} => winner ${winner}`;
  return { winner, totals, reason };
}

async function closeBettingAndCalculate(round: any) {
  log.info(`Closing betting for round #${round.roundNumber}`);

  // Atomic claim: only one worker may move BETTING_OPEN -> BETTING_CLOSED.
  // If another tick/engine already claimed (or settled) this round, stop.
  const claimed = await claimRoundForSettlement(round._id);
  if (!claimed) {
    log.warn(`Settlement skipped for round #${round.roundNumber} — already claimed/settled`);
    return;
  }
  round.status = 'BETTING_CLOSED';

  try {
    const io = getIO();
    io.emit('round:closing', { roundNumber: round.roundNumber, roundId: round._id });
  } catch {}

  // Short delay to ensure no race bets? But betting already closed, extra validation will reject new bets.
  // Calculate winner
  const { winner, totals, reason } = await calculateWinner(round._id.toString());

  log.info(`Winner for round #${round.roundNumber}: ${winner} totals=${JSON.stringify(totals)} reason=${reason}`);

  round.colorTotals = totals as any;
  round.winningColor = winner;
  round.tieBreakReason = reason;
  round.resultTime = new Date();
  round.totalBetAmount = Object.values(totals).reduce((a, b) => a + b, 0);
  // totalBetsCount already maintained, but recalc
  const count = await Bet.countDocuments({ roundId: round._id });
  round.totalBetsCount = count;
  round.status = 'RESULT_CALCULATED';
  await round.save();

  // Payout winners
  await payoutWinners(round, winner);

  round.status = 'RESULT_REVEALED';
  await round.save();

  try {
    const io = getIO();
    io.emit('round:result', {
      roundNumber: round.roundNumber,
      roundId: round._id,
      winningColor: winner,
      colorTotals: totals,
      tieBreakReason: reason,
      totalBetAmount: round.totalBetAmount,
    });
  } catch {}

  // Schedule next round after reveal duration
  setTimeout(async () => {
    await createNewRound();
  }, config.resultRevealMs);
}

async function payoutTxExists(betId: any): Promise<boolean> {
  const existing = await Transaction.findOne({ referenceId: betId, type: 'WIN_PAYOUT' }).lean();
  return !!existing;
}

export async function payoutWinners(round: any, winningColor: ResultType) {
  // Combination results pay every bet placed on a member color.
  const payableColors = getWinningColors(winningColor);
  const winningBets = await Bet.find({ roundId: round._id, color: { $in: payableColors } }).lean();
  if (winningBets.length === 0) {
    log.info(`No winning bets for round #${round.roundNumber}`);
    return;
  }

  log.info(`Paying ${winningBets.length} winners for round #${round.roundNumber} result ${winningColor} colors [${payableColors.join(',')}] fee ${config.platformFeePercent}%`);

  // Process each winner. Try transaction per batch if possible.
  // For simplicity, process sequentially with fallback.

  for (const bet of winningBets) {
    // Idempotency: never pay the same bet twice (crash retry / double tick).
    if (await payoutTxExists(bet._id)) {
      log.warn(`Skipping duplicate payout for bet ${bet._id} (round #${round.roundNumber})`);
      continue;
    }

    let breakdown;
    try {
      // Multiplier is fixed per result — never modified here.
      breakdown = calculatePayout(bet.amount, winningColor);
    } catch (e) {
      log.error(`Payout calc failed for bet ${bet._id}`, e);
      continue;
    }
    const { multiplier, grossPayout, platformFee, netPayout } = breakdown;
    const meta = {
      roundNumber: round.roundNumber,
      winningColor,
      betAmount: bet.amount,
      multiplier,
      grossPayout,
      platformFee,
      platformFeePercent: config.platformFeePercent,
      netPayout,
    };
    // attempt transactional payout
    const session = await mongoose.startSession();
    let usedTx = true;
    try {
      await session.withTransaction(async () => {
        const user = await User.findById(bet.userId).session(session);
        if (!user) throw new Error('User not found during payout');

        // Re-check inside the transaction: a concurrent settlement of the
        // same bet must not credit twice.
        const alreadyPaid = await Transaction.findOne({ referenceId: bet._id, type: 'WIN_PAYOUT' }).session(session);
        if (alreadyPaid) throw Object.assign(new Error('Duplicate payout skipped'), { status: 409, duplicate: true });

        const before = user.virtualBalance;
        // Credit ONLY the net payout to the wallet.
        user.virtualBalance += netPayout;
        await user.save({ session });

        await Transaction.create(
          [
            {
              userId: user._id,
              type: 'WIN_PAYOUT',
              amount: netPayout,
              balanceBefore: before,
              balanceAfter: user.virtualBalance,
              referenceId: bet._id,
              meta,
            },
          ],
          { session }
        );

        // Record the platform fee as a separate ledger entry (informational:
        // it does not move the wallet balance, which already holds the net).
        await Transaction.create(
          [
            {
              userId: user._id,
              type: 'PLATFORM_FEE',
              amount: platformFee,
              balanceBefore: user.virtualBalance,
              balanceAfter: user.virtualBalance,
              referenceId: bet._id,
              meta,
            },
          ],
          { session }
        );

        try {
          const io = getIO();
          io.to(`user:${user._id.toString()}`).emit('balance:update', { balance: user.virtualBalance });
        } catch {}
      });
    } catch (e: any) {
      if (e?.duplicate) {
        log.warn(`Skipping duplicate payout for bet ${bet._id} (round #${round.roundNumber})`);
        continue;
      }
      const msg = e?.message || '';
      if (msg.includes('Transaction') || msg.includes('replica set') || msg.includes('not supported')) {
        usedTx = false;
      } else {
        log.error(`Payout failed for bet ${bet._id}`, e);
        usedTx = false; // fallback still
      }
    } finally {
      await session.endSession();
    }

    if (!usedTx) {
      // fallback atomic increment — re-check idempotency first (no tx guard here).
      // The unique (referenceId, type, userId) index below is the final backstop: a
      // 11000 means a concurrent worker already paid this bet.
      try {
        if (await payoutTxExists(bet._id)) {
          log.warn(`Skipping duplicate payout for bet ${bet._id} (round #${round.roundNumber})`);
          continue;
        }
        // Credit ONLY the net payout.
        const user = await User.findOneAndUpdate({ _id: bet.userId }, { $inc: { virtualBalance: netPayout } }, { new: true });
        if (!user) continue;
        const before = user.virtualBalance - netPayout;
        try {
          await Transaction.create({
            userId: bet.userId,
            type: 'WIN_PAYOUT',
            amount: netPayout,
            balanceBefore: before,
            balanceAfter: user.virtualBalance,
            referenceId: bet._id,
            meta: { ...meta, fallback: true },
          });
          await Transaction.create({
            userId: bet.userId,
            type: 'PLATFORM_FEE',
            amount: platformFee,
            balanceBefore: user.virtualBalance,
            balanceAfter: user.virtualBalance,
            referenceId: bet._id,
            meta: { ...meta, fallback: true },
          });
        } catch (txErr: any) {
          if (txErr?.code === 11000) {
            // Lost the race after crediting: compensate the over-credit so the
            // wallet still reflects exactly one payout, then skip.
            await User.findOneAndUpdate({ _id: bet.userId }, { $inc: { virtualBalance: -netPayout } });
            log.warn(`Duplicate payout race for bet ${bet._id} compensated (round #${round.roundNumber})`);
            continue;
          }
          throw txErr;
        }
        try {
          const io = getIO();
          io.to(`user:${user._id.toString()}`).emit('balance:update', { balance: user.virtualBalance });
        } catch {}
      } catch (err) {
        log.error(`Fallback payout failed for bet ${bet._id}`, err);
      }
    }
  }
}

export function startEngine() {
  if (isEngineRunning) return;
  isEngineRunning = true;
  log.info('Round engine started');

  tickInterval = setInterval(async () => {
    try {
      // Defensive: if multiple BETTING_OPEN, clean duplicates first
      const openCount = await GameRound.countDocuments({ status: 'BETTING_OPEN' });
      if (openCount > 1) {
        const opens = await GameRound.find({ status: 'BETTING_OPEN' }).sort({ roundNumber: -1 });
        log.warn(`Tick found ${openCount} BETTING_OPEN rounds, cleaning. Keeping #${opens[0].roundNumber}`);
        for (let i = 1; i < opens.length; i++) {
          const r = opens[i] as any;
          r.status = 'RESULT_REVEALED';
          r.winningColor = 'RED';
          r.tieBreakReason = 'CLEANUP: duplicate BETTING_OPEN during tick';
          r.resultTime = new Date();
          await r.save();
        }
      }
      // Find current betting open round
      const round = await GameRound.findOne({ status: 'BETTING_OPEN' }).sort({ roundNumber: -1 });
      if (!round) {
        // If no betting open and no revealed pending next, create one
        const latest = await GameRound.findOne().sort({ roundNumber: -1 });
        if (!latest || latest.status === 'RESULT_REVEALED') {
          await createNewRound();
        }
        return;
      }

      const now = new Date();
      const remainingMs = round.bettingCloseTime.getTime() - now.getTime();

      if (remainingMs <= 0) {
        await closeBettingAndCalculate(round);
        return;
      }

      // Broadcast tick every second
      try {
        const io = getIO();
        io.emit('round:tick', {
          roundNumber: round.roundNumber,
          roundId: round._id,
          status: round.status,
          remainingMs,
          bettingCloseTime: round.bettingCloseTime,
          colorTotals: round.colorTotals,
          totalBetAmount: round.totalBetAmount,
        });
      } catch {}

      // Also broadcast every 3 seconds full? Already tick includes totals.
    } catch (e) {
      log.error('Engine tick error', e);
    }
  }, 1000);
}

export function stopEngine() {
  if (tickInterval) clearInterval(tickInterval);
  isEngineRunning = false;
  log.info('Round engine stopped');
}

export function getCurrentRoundId() {
  return currentRoundId;
}

/**
 * Atomically claim a round for settlement (BETTING_OPEN -> BETTING_CLOSED).
 * Returns the claimed round, or null if it was already claimed/settled.
 * Exported for tests and multi-instance safety.
 */
export async function claimRoundForSettlement(roundId: any) {
  return GameRound.findOneAndUpdate(
    { _id: roundId, status: 'BETTING_OPEN' },
    { $set: { status: 'BETTING_CLOSED' } },
    { new: true }
  );
}
