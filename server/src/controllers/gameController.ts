import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { GameRound } from '../models/GameRound';
import { Bet } from '../models/Bet';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { COLORS, Color, config, PAYOUT_RULES } from '../config';
import { calculatePayout, isWinningBet } from '../services/payout';
import { getIO } from '../sockets';

export function getPayoutRules(_req: any, res: Response) {
  res.json({ payoutRules: PAYOUT_RULES, platformFeePercent: config.platformFeePercent });
}

export async function getCurrentRound(_req: any, res: Response) {
  const round = await GameRound.findOne({ status: { $in: ['BETTING_OPEN', 'BETTING_CLOSED', 'WAITING'] } })
    .sort({ roundNumber: -1 })
    .lean();
  // fallback to latest
  const fallback = round || (await GameRound.findOne().sort({ roundNumber: -1 }).lean());
  if (!fallback) return res.status(404).json({ error: 'No rounds yet' });

  // enrich totals from DB if needed
  res.json(fallback);
}

export async function getHistory(req: any, res: Response) {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    GameRound.find({ status: 'RESULT_REVEALED' }).sort({ roundNumber: -1 }).skip(skip).limit(limit).lean(),
    GameRound.countDocuments({ status: 'RESULT_REVEALED' }),
  ]);
  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
}

export async function getRoundById(req: any, res: Response) {
  const round = await GameRound.findById(req.params.roundId).lean();
  if (!round) return res.status(404).json({ error: 'Round not found' });
  res.json(round);
}

export async function getRoundResult(req: any, res: Response) {
  const round = await GameRound.findById(req.params.roundId).lean();
  if (!round) return res.status(404).json({ error: 'Round not found' });
  if (!round.winningColor) return res.status(400).json({ error: 'Result not yet available' });
  res.json({
    winningColor: round.winningColor,
    colorTotals: round.colorTotals,
    tieBreakReason: round.tieBreakReason,
    roundNumber: round.roundNumber,
    payoutRules: PAYOUT_RULES,
    platformFeePercent: config.platformFeePercent,
  });
}

export async function getRoundBets(req: AuthRequest, res: Response) {
  const { roundId } = req.params;
  // if admin, return all, else only user's bets
  const isAdmin = req.user?.role === 'admin';
  const filter: any = { roundId };
  if (!isAdmin) filter.userId = req.userId;

  const bets = await Bet.find(filter).sort({ createdAt: -1 }).lean();
  const round = await GameRound.findById(roundId).lean();
  // Attach the settled payout breakdown to each winning bet of a decided round.
  const enriched = bets.map((b: any) => {
    let payout = null;
    if (round?.winningColor) {
      try {
        payout = isWinningBet(b.color, round.winningColor as string)
          ? calculatePayout(b.amount, round.winningColor as string)
          : null;
      } catch {
        payout = null;
      }
    }
    return { ...b, payout };
  });
  // also return totals
  const totalsAgg = await Bet.aggregate([
    { $match: { roundId: new mongoose.Types.ObjectId(roundId) } },
    { $group: { _id: '$color', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const totals: Record<string, number> = {};
  COLORS.forEach((c) => (totals[c] = 0));
  totalsAgg.forEach((t) => (totals[t._id] = t.total));

  res.json({ bets: enriched, totals });
}

// Place bet: critical path with concurrency safety
export async function placeBet(req: AuthRequest, res: Response) {
  const { roundId } = req.params;
  const { color, amount } = req.body;
  const betAmount = Number(amount);

  if (!COLORS.includes(color)) return res.status(400).json({ error: `Invalid color. Allowed: ${COLORS.join(', ')}` });
  if (!Number.isInteger(betAmount) || betAmount <= 0) return res.status(400).json({ error: 'Amount must be positive integer' });
  if (betAmount < 10) return res.status(400).json({ error: 'Minimum bet is 10 coins' });
  if (betAmount > 100000) return res.status(400).json({ error: 'Maximum bet is 100000 coins' });

  // Validate round
  const round = await GameRound.findById(roundId);
  if (!round) return res.status(404).json({ error: 'Round not found' });
  if (round.status !== 'BETTING_OPEN') return res.status(400).json({ error: `Betting is ${round.status}, not open` });
  if (new Date() >= round.bettingCloseTime) {
    return res.status(400).json({ error: 'Betting window closed' });
  }

  // Attempt transactional bet if replica set, else fallback to atomic
  const session = await mongoose.startSession();
  let useTransaction = true;
  try {
    // test if transactions supported
    // We'll try transaction; if fails due to not replica set, fallback
    let result: any = null;
    try {
      await session.withTransaction(async () => {
        const user = await User.findById(req.userId).session(session);
        if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
        if (user.virtualBalance < betAmount) throw Object.assign(new Error('Insufficient balance'), { status: 400 });

        const balanceBefore = user.virtualBalance;
        user.virtualBalance -= betAmount;
        await user.save({ session });

        const bet = await Bet.create(
          [
            {
              userId: user._id,
              roundId: round._id,
              color,
              amount: betAmount,
            },
          ],
          { session }
        );

        await Transaction.create(
          [
            {
              userId: user._id,
              type: 'BET_PLACED',
              amount: -betAmount,
              balanceBefore,
              balanceAfter: user.virtualBalance,
              referenceId: bet[0]._id,
              meta: { roundNumber: round.roundNumber, color },
            },
          ],
          { session }
        );

        // update round totals atomically within transaction
        // increment color total and totalBetAmount
        await GameRound.updateOne(
          { _id: round._id },
          {
            $inc: { [`colorTotals.${color}`]: betAmount, totalBetAmount: betAmount, totalBetsCount: 1 },
          },
          { session }
        );

        result = { bet: bet[0], balance: user.virtualBalance, balanceBefore, balanceAfter: user.virtualBalance };
      });
    } catch (txErr: any) {
      // Detect if transaction not supported (standalone mongod)
      const msg = txErr?.message || '';
      if (msg.includes('Transaction') || msg.includes('replica set') || msg.includes('not supported')) {
        useTransaction = false;
        throw txErr;
      }
      // if our custom error with status, rethrow
      if (txErr.status) throw txErr;
      throw txErr;
    }

    if (useTransaction && result) {
      // broadcast bet update via socket
      try {
        const io = getIO();
        const updated = await GameRound.findById(roundId).lean();
        io.emit('round:betUpdate', {
          roundNumber: updated?.roundNumber,
          roundId: updated?._id,
          colorTotals: updated?.colorTotals,
          totalBetAmount: updated?.totalBetAmount,
          totalBetsCount: updated?.totalBetsCount,
        });
        io.to(`user:${req.userId}`).emit('balance:update', { balance: result.balance });
      } catch {}
      return res.status(201).json(result);
    }
  } catch (e: any) {
    if ((useTransaction as boolean) === false) {
      // fallback non-transactional but atomic balance check
      // Use findOneAndUpdate with condition
    } else {
      if (e.status) return res.status(e.status).json({ error: e.message });
      // Write conflicts mean a concurrent bet touched the same wallet and the
      // transaction was safely aborted (no money moved) — ask client to retry.
      if (e.message && /WriteConflict|TransientTransaction|UnknownTransactionCommitResult|NoSuchTransaction/i.test(e.message)) {
        return res.status(409).json({ error: 'High traffic — please retry your bet' });
      }
      // if transaction failed for other reason but not our fallback case, return error
      if (e.message && e.message !== 'Insufficient balance') {
        // if it's transaction not supported, handle below
        if (e.message.includes('Transaction') || e.message.includes('replica set')) {
          useTransaction = false;
        } else {
          return res.status(500).json({ error: e.message });
        }
      } else if (e.message === 'Insufficient balance') {
        return res.status(400).json({ error: e.message });
      }
    }
  } finally {
    await session.endSession();
  }

  // Fallback path: atomic without multi-doc transaction (for standalone Mongo)
  if (!useTransaction) {
    // Atomic decrement with condition
    const user = await User.findOneAndUpdate(
      { _id: req.userId, virtualBalance: { $gte: betAmount } },
      { $inc: { virtualBalance: -betAmount } },
      { new: true }
    );
    if (!user) return res.status(400).json({ error: 'Insufficient balance' });

    // Need to fetch before balance
    // Since we already updated, compute before as after + amount
    const balanceAfter = user.virtualBalance;
    const balanceBefore = balanceAfter + betAmount;

    const bet = await Bet.create({
      userId: req.userId,
      roundId: round._id,
      color,
      amount: betAmount,
    });

    await Transaction.create({
      userId: req.userId,
      type: 'BET_PLACED',
      amount: -betAmount,
      balanceBefore,
      balanceAfter,
      referenceId: bet._id,
      meta: { roundNumber: round.roundNumber, color },
    });

    await GameRound.updateOne(
      { _id: round._id },
      { $inc: { [`colorTotals.${color}`]: betAmount, totalBetAmount: betAmount, totalBetsCount: 1 } }
    );

    try {
      const io = getIO();
      const updated = await GameRound.findById(roundId).lean();
      io.emit('round:betUpdate', {
        roundNumber: updated?.roundNumber,
        roundId: updated?._id,
        colorTotals: updated?.colorTotals,
        totalBetAmount: updated?.totalBetAmount,
        totalBetsCount: updated?.totalBetsCount,
      });
      io.to(`user:${req.userId}`).emit('balance:update', { balance: balanceAfter });
    } catch {}

    return res.status(201).json({ bet, balance: balanceAfter, balanceBefore, balanceAfter });
  }

  return res.status(500).json({ error: 'Failed to place bet' });
}
