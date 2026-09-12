/**
 * Referral + top-up bonus integration tests (requires local MongoDB).
 * Isolated `color-arena-test` database — never touches the live DB.
 * Run: npm run test:referral
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from '../src/models/User';
import { Transaction } from '../src/models/Transaction';
import { PaymentRequest } from '../src/models/PaymentRequest';
import { register } from '../src/controllers/authController';
import { verifyPayment } from '../src/controllers/paymentController';
import { config } from '../src/config';

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

async function registerUser(name: string, email: string, referralCode?: string) {
  const req: any = { body: { name, email, password: 'test1234', referralCode } };
  const res = mockRes();
  await register(req, res);
  return res;
}

test('signup without code: base balance, own code, no bonus', async () => {
  const res = await registerUser('Ref A', `refa_${Date.now()}@t.com`);
  assert.equal(res.code, 201);
  assert.match(res.body.user.referralCode, /^ARENA-[A-Z2-9]{6}$/);
  assert.equal(res.body.user.virtualBalance, config.initialBalance);
  assert.equal(res.body.referralBonus, 0);
});

test('signup with valid code: friend gets +500, referrer count +1', async () => {
  const owner = await registerUser('Owner', `owner_${Date.now()}@t.com`);
  const ownerCode = owner.body.user.referralCode;

  const res = await registerUser('Friend', `friend_${Date.now()}@t.com`, ownerCode);
  assert.equal(res.code, 201);
  assert.equal(res.body.user.virtualBalance, config.initialBalance + 500);
  assert.equal(res.body.referralBonus, 500);

  const bonus = await Transaction.findOne({ userId: res.body.user.id, type: 'BONUS' }).lean();
  assert.ok(bonus);
  assert.equal(bonus!.amount, 500);
  assert.equal(bonus!.meta.kind, 'referral-signup');

  const updated = await User.findById(owner.body.user.id).lean();
  assert.equal(updated!.referralCount, 1);
});

test('signup with invalid code is rejected', async () => {
  const res = await registerUser('Bad', `bad_${Date.now()}@t.com`, 'ARENA-ZZZZZZ');
  assert.equal(res.code, 400);
});

test('approval credits amount + deposit bonus; referrer paid once on first top-up', async () => {
  const owner = await registerUser('Owner2', `owner2_${Date.now()}@t.com`);
  const friend = await registerUser('Friend2', `friend2_${Date.now()}@t.com`, owner.body.user.referralCode);
  const friendId = friend.body.user.id;
  const ownerId = owner.body.user.id;
  const startFriend = friend.body.user.virtualBalance; // 10500
  const startOwner = owner.body.user.virtualBalance; // 10000

  // First top-up Rs 2000 => +10% => +200 bonus
  const pr: any = await PaymentRequest.create({ userId: friendId, amount: 2000, upiId: 'x@bank', screenshotPath: 's.png', status: 'PENDING' });
  const res = mockRes();
  await verifyPayment({ params: { id: pr._id.toString() }, body: { action: 'approve' }, userId: ownerId } as any, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.depositBonus, { coins: 200, percent: 10 });
  assert.equal(res.body.referrerRewardPaid, true);
  assert.equal(res.body.newBalance, startFriend + 2000 + 200);

  const bonusTx = await Transaction.findOne({ referenceId: pr._id, type: 'BONUS', 'meta.kind': 'deposit-bonus' }).lean();
  assert.ok(bonusTx);
  assert.equal(bonusTx!.amount, 200);

  const ownerAfter = await User.findById(ownerId).lean();
  assert.equal(ownerAfter!.virtualBalance, startOwner + 1000);
  assert.equal(ownerAfter!.referralEarned, 1000);

  // Second top-up: bonus again, but NO referrer reward repeat
  const pr2: any = await PaymentRequest.create({ userId: friendId, amount: 500, upiId: 'x@bank', screenshotPath: 's2.png', status: 'PENDING' });
  const res2 = mockRes();
  await verifyPayment({ params: { id: pr2._id.toString() }, body: { action: 'approve' }, userId: ownerId } as any, res2);
  assert.equal(res2.code, 200);
  assert.deepEqual(res2.body.depositBonus, { coins: 25, percent: 5 });
  assert.equal(res2.body.referrerRewardPaid, false);
  assert.equal((await User.findById(ownerId).lean())!.virtualBalance, startOwner + 1000);

  // Re-approving the same request is rejected (no double credit)
  const res3 = mockRes();
  await verifyPayment({ params: { id: pr._id.toString() }, body: { action: 'approve' }, userId: ownerId } as any, res3);
  assert.equal(res3.code, 400);
});

test('approval below lowest tier: no bonus tx, no crash', async () => {
  const u = await registerUser('Plain', `plain_${Date.now()}@t.com`);
  const pr: any = await PaymentRequest.create({ userId: u.body.user.id, amount: 100, upiId: 'x@bank', screenshotPath: 's.png', status: 'PENDING' });
  const res = mockRes();
  await verifyPayment({ params: { id: pr._id.toString() }, body: { action: 'approve' }, userId: u.body.user.id } as any, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.depositBonus, { coins: 0, percent: 0 });
  assert.equal(res.body.newBalance, config.initialBalance + 100);
  assert.equal(await Transaction.countDocuments({ referenceId: pr._id, type: 'BONUS' }), 0);
});
