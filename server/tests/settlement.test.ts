/**
 * Settlement / wallet / idempotency tests (requires local MongoDB).
 * Uses an isolated `color-arena-test` database — never touches the live DB.
 * Run: npm run test:settlement
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { GameRound } from '../src/models/GameRound';
import { Bet } from '../src/models/Bet';
import { User } from '../src/models/User';
import { Transaction } from '../src/models/Transaction';
import { claimRoundForSettlement, payoutWinners } from '../src/services/roundEngine';
import { placeBet } from '../src/controllers/gameController';

const URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/color-arena-test';

before(async () => {
  await mongoose.connect(URI);
  // Fresh DB incl. indexes: stale index definitions from older code must not linger.
  await mongoose.connection.db?.dropDatabase();
});

after(async () => {
  await mongoose.connection.db?.dropDatabase();
  await mongoose.disconnect();
});

async function makeUser(balance: number, email: string) {
  return User.create({ name: 'T', email, passwordHash: 'x', virtualBalance: balance, role: 'user' });
}

async function makeRound(status: any = 'BETTING_OPEN') {
  const now = new Date();
  return GameRound.create({
    roundNumber: Math.floor(Math.random() * 1e9),
    status,
    startTime: now,
    bettingCloseTime: new Date(now.getTime() + 60000),
    colorTotals: { RED: 0, GREEN: 0, BLUE: 0 },
  });
}

function txCount(betId: any, type: string) {
  return Transaction.countDocuments({ referenceId: betId, type });
}

// --- Single-color settlement -------------------------------------------------

test('RED win credits NET only + records fee separately', async () => {
  const u = await makeUser(9900, `w1_${Date.now()}@t.com`);
  const round: any = await makeRound();
  const bet: any = await Bet.create({ userId: u._id, roundId: round._id, color: 'RED', amount: 100 });

  await payoutWinners(round, 'RED');

  const after = await User.findById(u._id).lean();
  assert.equal(after!.virtualBalance, 9900 + 180); // net only, not 200

  const win = await Transaction.findOne({ referenceId: bet._id, type: 'WIN_PAYOUT' }).lean();
  assert.ok(win);
  assert.equal(win!.amount, 180);
  assert.equal(win!.balanceBefore, 9900);
  assert.equal(win!.balanceAfter, 10080);
  assert.deepEqual(
    { m: win!.meta.multiplier, g: win!.meta.grossPayout, f: win!.meta.platformFee, n: win!.meta.netPayout, b: win!.meta.betAmount },
    { m: 2.0, g: 200, f: 20, n: 180, b: 100 }
  );

  const fee = await Transaction.findOne({ referenceId: bet._id, type: 'PLATFORM_FEE' }).lean();
  assert.ok(fee, 'platform fee recorded separately');
  assert.equal(fee!.amount, 20);
  // Fee tx is informational: it must not move the wallet balance.
  assert.equal(fee!.balanceBefore, fee!.balanceAfter);
});

test('duplicate settlement does NOT double-pay or double-record fee', async () => {
  const u = await makeUser(9900, `w2_${Date.now()}@t.com`);
  const round: any = await makeRound();
  const bet: any = await Bet.create({ userId: u._id, roundId: round._id, color: 'GREEN', amount: 100 });

  await payoutWinners(round, 'GREEN');
  await payoutWinners(round, 'GREEN'); // retry / double tick
  await payoutWinners(round, 'GREEN'); // third time for luck

  const after = await User.findById(u._id).lean();
  assert.equal(after!.virtualBalance, 9900 + 180);
  assert.equal(await txCount(bet._id, 'WIN_PAYOUT'), 1);
  assert.equal(await txCount(bet._id, 'PLATFORM_FEE'), 1);
});

test('losers are not credited', async () => {
  const u = await makeUser(5000, `w3_${Date.now()}@t.com`);
  const round: any = await makeRound();
  const bet: any = await Bet.create({ userId: u._id, roundId: round._id, color: 'BLUE', amount: 100 });

  await payoutWinners(round, 'RED');

  assert.equal((await User.findById(u._id).lean())!.virtualBalance, 5000);
  assert.equal(await txCount(bet._id, 'WIN_PAYOUT'), 0);
  assert.equal(await txCount(bet._id, 'PLATFORM_FEE'), 0);
});

// --- Combination settlement ---------------------------------------------------

test('RED_BLUE pays RED and BLUE at 1.5x, GREEN loses', async () => {
  const r = await makeUser(1000, `c1_${Date.now()}@t.com`);
  const b = await makeUser(1000, `c2_${Date.now()}@t.com`);
  const g = await makeUser(1000, `c3_${Date.now()}@t.com`);
  const round: any = await makeRound();
  const betR: any = await Bet.create({ userId: r._id, roundId: round._id, color: 'RED', amount: 100 });
  const betB: any = await Bet.create({ userId: b._id, roundId: round._id, color: 'BLUE', amount: 100 });
  await Bet.create({ userId: g._id, roundId: round._id, color: 'GREEN', amount: 100 });

  await payoutWinners(round, 'RED_BLUE');

  assert.equal((await User.findById(r._id).lean())!.virtualBalance, 1000 + 135);
  assert.equal((await User.findById(b._id).lean())!.virtualBalance, 1000 + 135);
  assert.equal((await User.findById(g._id).lean())!.virtualBalance, 1000);
  assert.equal((await Transaction.findOne({ referenceId: betR._id, type: 'WIN_PAYOUT' }).lean())!.amount, 135);
  assert.equal((await Transaction.findOne({ referenceId: betB._id, type: 'PLATFORM_FEE' }).lean())!.amount, 15);
});

// --- Round-level guards --------------------------------------------------------

test('atomic claim: second settlement claim on same round returns null', async () => {
  const round: any = await makeRound('BETTING_OPEN');
  const first = await claimRoundForSettlement(round._id);
  assert.ok(first, 'first claim succeeds');
  const second = await claimRoundForSettlement(round._id);
  assert.equal(second, null, 'already-claimed round cannot be claimed again');
});

test('bet after betting closes is rejected', async () => {
  const u = await makeUser(10000, `w4_${Date.now()}@t.com`);
  const round: any = await makeRound('BETTING_CLOSED');

  const req: any = { params: { roundId: round._id.toString() }, body: { color: 'RED', amount: 100 }, userId: u._id.toString() };
  let code = 0;
  let body: any = null;
  const res: any = { status(c: number) { code = c; return this; }, json(o: any) { body = o; return this; } };

  await placeBet(req, res);
  assert.equal(code, 400);
  assert.match(String(body?.error || ''), /not open|closed/i);
  assert.equal(await Bet.countDocuments({ roundId: round._id }), 0);
  assert.equal((await User.findById(u._id).lean())!.virtualBalance, 10000);
});
