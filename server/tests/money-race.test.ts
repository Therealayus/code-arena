/**
 * Money race-condition tests: concurrent operations must never create,
 * destroy, or double-count coins. Requires local MongoDB (standalone is
 * fine — these paths are exactly the ones that run without transactions).
 * Isolated `color-arena-test` database.
 * Run: npm run test:race
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { GameRound } from '../src/models/GameRound';
import { Bet } from '../src/models/Bet';
import { User } from '../src/models/User';
import { Transaction } from '../src/models/Transaction';
import { PaymentRequest } from '../src/models/PaymentRequest';
import { placeBet } from '../src/controllers/gameController';
import { adjustBalance } from '../src/controllers/adminController';
import { payoutWinners } from '../src/services/roundEngine';

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

function mockRes() {
  const r: any = { code: 200, body: null };
  r.status = (c: number) => { r.code = c; return r; };
  r.json = (o: any) => { r.body = o; return r; };
  return r;
}

async function makeUser(balance: number, email: string) {
  return User.create({ name: 'T', email, passwordHash: 'x', virtualBalance: balance, role: 'user' });
}

async function makeOpenRound() {
  const now = new Date();
  return GameRound.create({
    roundNumber: Math.floor(Math.random() * 1e9),
    status: 'BETTING_OPEN',
    startTime: now,
    bettingCloseTime: new Date(now.getTime() + 60000),
    colorTotals: { RED: 0, GREEN: 0, BLUE: 0 },
  });
}

async function betAs(userId: any, roundId: any, color: string, amount: number) {
  const res = mockRes();
  await placeBet({ params: { roundId: roundId.toString() }, body: { color, amount }, userId: userId.toString() } as any, res);
  return res;
}

test('concurrent bets never overspend: 5x50 on 100 balance => exactly 2 win', async () => {
  const u: any = await makeUser(100, `race1_${Date.now()}@t.com`);
  const round: any = await makeOpenRound();

  const results = await Promise.all([1, 2, 3, 4, 5].map(() => betAs(u._id, round._id, 'RED', 50)));
  const ok = results.filter((r) => r.code === 201).length;
  const rejected = results.filter((r) => r.code === 400).length;

  assert.equal(ok, 2);
  assert.equal(rejected, 3);
  assert.equal((await User.findById(u._id).lean())!.virtualBalance, 0);
  assert.equal(await Bet.countDocuments({ userId: u._id, roundId: round._id }), 2);
  // Ledger reconciles: debits sum == balance delta
  const debits = await Transaction.aggregate([
    { $match: { userId: u._id, type: 'BET_PLACED' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  assert.equal(debits[0]?.total, -100);
});

test('concurrent duplicate settlement: 3x payoutWinners => single credit', async () => {
  const u: any = await makeUser(900, `race2_${Date.now()}@t.com`);
  const round: any = await makeOpenRound();
  await Bet.create({ userId: u._id, roundId: round._id, color: 'RED', amount: 100 });

  await Promise.all([
    payoutWinners(round, 'RED'),
    payoutWinners(round, 'RED'),
    payoutWinners(round, 'RED'),
  ]);

  assert.equal((await User.findById(u._id).lean())!.virtualBalance, 900 + 180);
  const bets = await Bet.find({ roundId: round._id }).lean();
  assert.equal(await Transaction.countDocuments({ referenceId: bets[0]._id, type: 'WIN_PAYOUT' }), 1);
  assert.equal(await Transaction.countDocuments({ referenceId: bets[0]._id, type: 'PLATFORM_FEE' }), 1);
});

test('concurrent double approval: same request approved twice => single credit', async () => {
  const admin: any = await User.create({ name: 'A', email: `adm_${Date.now()}@t.com`, passwordHash: 'x', virtualBalance: 0, role: 'admin' });
  const u: any = await makeUser(0, `race3_${Date.now()}@t.com`);
  const pr: any = await PaymentRequest.create({ userId: u._id, amount: 1000, upiId: 'x@bank', screenshotPath: 's.png', status: 'PENDING' });

  const { verifyPayment } = await import('../src/controllers/paymentController');
  const call = () => {
    const res = mockRes();
    return verifyPayment({ params: { id: pr._id.toString() }, body: { action: 'approve' }, userId: admin._id.toString() } as any, res).then(() => res);
  };
  const [r1, r2] = await Promise.all([call(), call()]);
  const codes = [r1.code, r2.code].sort();
  assert.deepEqual(codes, [200, 400]);

  // 1000 + 5% bonus = 1050 credited exactly once
  assert.equal((await User.findById(u._id).lean())!.virtualBalance, 1050);
  assert.equal(await Transaction.countDocuments({ referenceId: pr._id, type: 'ADMIN_ADJUST' }), 1);
});

test('concurrent first top-ups: referrer paid exactly once', async () => {
  const admin: any = await User.create({ name: 'A', email: `adm2_${Date.now()}@t.com`, passwordHash: 'x', virtualBalance: 0, role: 'admin' });
  const owner: any = await makeUser(0, `own_${Date.now()}@t.com`);
  const friend: any = await User.create({
    name: 'F', email: `fr_${Date.now()}@t.com`, passwordHash: 'x', virtualBalance: 0,
    role: 'user', referralCode: 'ARENA-TEST1', referredBy: owner._id,
  });
  const mkReq = () => PaymentRequest.create({ userId: friend._id, amount: 500, upiId: 'x@bank', screenshotPath: 's.png', status: 'PENDING' });
  const [pr1, pr2]: any[] = await Promise.all([mkReq(), mkReq()]);

  const { verifyPayment } = await import('../src/controllers/paymentController');
  const call = (pr: any) => {
    const res = mockRes();
    return verifyPayment({ params: { id: pr._id.toString() }, body: { action: 'approve' }, userId: admin._id.toString() } as any, res).then(() => res);
  };
  const [r1, r2] = await Promise.all([call(pr1), call(pr2)]);
  assert.equal(r1.code, 200);
  assert.equal(r2.code, 200);

  // Friend: 2x (500 + 5% bonus 25) = 1050. Referrer: exactly 1000 once.
  assert.equal((await User.findById(friend._id).lean())!.virtualBalance, 1050);
  assert.equal((await User.findById(owner._id).lean())!.virtualBalance, 1000);
  assert.equal(await Transaction.countDocuments({ userId: owner._id, type: 'BONUS', 'meta.kind': 'referrer-reward' }), 1);
});

test('concurrent admin adjusts: 10x +100 => exactly +1000, debits floored at 0', async () => {
  const admin: any = await User.create({ name: 'A', email: `adm3_${Date.now()}@t.com`, passwordHash: 'x', virtualBalance: 0, role: 'admin' });
  const u: any = await makeUser(0, `race5_${Date.now()}@t.com`);
  const call = (amount: number) => {
    const res = mockRes();
    return adjustBalance({ params: { id: u._id.toString() }, body: { amount, reason: 'race' }, userId: admin._id.toString() } as any, res).then(() => res);
  };

  const ups = await Promise.all(Array.from({ length: 10 }, () => call(100)));
  assert.ok(ups.every((r) => r.code === 200));
  assert.equal((await User.findById(u._id).lean())!.virtualBalance, 1000);

  // 5 concurrent debits of 300 on 1000 => at most 3 succeed, never negative
  const downs = await Promise.all(Array.from({ length: 5 }, () => call(-300)));
  assert.equal(downs.filter((r) => r.code === 200).length, 3);
  assert.equal(downs.filter((r) => r.code === 400).length, 2);
  const finalBal = (await User.findById(u._id).lean())!.virtualBalance;
  assert.ok(finalBal >= 0 && finalBal < 300);
});
