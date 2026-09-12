/**
 * Admin account-management tests: password reset, ban/unban, support contact.
 * Isolated `color-arena-test` database — never touches the live DB.
 * Run: npm run test:admin
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../src/models/User';
import {
  resetUserPassword,
  setUserBan,
  updateSupportContact,
  getPublicSupportContact,
} from '../src/controllers/adminController';
import { login } from '../src/controllers/authController';

const URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/color-arena-test';

before(async () => {
  await mongoose.connect(URI);
  await User.deleteMany({});
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

async function makeUser(email: string, role: 'user' | 'admin' = 'user') {
  const hash = await bcrypt.hash('oldpass123', 10);
  return User.create({ name: 'T', email, passwordHash: hash, virtualBalance: 1000, role });
}

test('admin can reset a user password; old stops working, new works', async () => {
  const admin: any = await makeUser(`adm_${Date.now()}@t.com`, 'admin');
  const u: any = await makeUser(`u1_${Date.now()}@t.com`);

  const res = mockRes();
  await resetUserPassword({ params: { id: u._id.toString() }, body: { newPassword: 'brandnew99' }, userId: admin._id.toString() } as any, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.ok, true);

  const loginOld = mockRes();
  await login({ body: { email: u.email, password: 'oldpass123' } } as any, loginOld);
  assert.equal(loginOld.code, 401);

  const loginNew = mockRes();
  await login({ body: { email: u.email, password: 'brandnew99' } } as any, loginNew);
  assert.equal(loginNew.code, 200);
});

test('reset rejects short passwords and unknown users', async () => {
  const admin: any = await makeUser(`adm2_${Date.now()}@t.com`, 'admin');
  const u: any = await makeUser(`u2_${Date.now()}@t.com`);

  const short = mockRes();
  await resetUserPassword({ params: { id: u._id.toString() }, body: { newPassword: '123' }, userId: admin._id.toString() } as any, short);
  assert.equal(short.code, 400);

  const missing = mockRes();
  await resetUserPassword({ params: { id: new mongoose.Types.ObjectId().toString() }, body: { newPassword: 'validpass1' }, userId: admin._id.toString() } as any, missing);
  assert.equal(missing.code, 404);
});

test('cannot reset another admin password or ban an admin', async () => {
  const admin: any = await makeUser(`adm3_${Date.now()}@t.com`, 'admin');
  const admin2: any = await makeUser(`adm4_${Date.now()}@t.com`, 'admin');

  const r = mockRes();
  await resetUserPassword({ params: { id: admin2._id.toString() }, body: { newPassword: 'hacked123' }, userId: admin._id.toString() } as any, r);
  assert.equal(r.code, 403);

  const b = mockRes();
  await setUserBan({ params: { id: admin2._id.toString() }, body: { banned: true } } as any, b);
  assert.equal(b.code, 403);
});

test('ban blocks login; unban restores it', async () => {
  const admin: any = await makeUser(`adm5_${Date.now()}@t.com`, 'admin');
  const u: any = await makeUser(`u5_${Date.now()}@t.com`);

  const ban = mockRes();
  await setUserBan({ params: { id: u._id.toString() }, body: { banned: true, reason: 'test ban' }, userId: admin._id.toString() } as any, ban);
  assert.equal(ban.code, 200);
  assert.equal(ban.body.isBanned, true);

  const blocked = mockRes();
  await login({ body: { email: u.email, password: 'oldpass123' } } as any, blocked);
  assert.equal(blocked.code, 403);

  const unban = mockRes();
  await setUserBan({ params: { id: u._id.toString() }, body: { banned: false }, userId: admin._id.toString() } as any, unban);
  assert.equal(unban.code, 200);
  assert.equal(unban.body.isBanned, false);

  const back = mockRes();
  await login({ body: { email: u.email, password: 'oldpass123' } } as any, back);
  assert.equal(back.code, 200);
});

test('support telegram: update normalizes, public endpoint exposes it', async () => {
  await User.deleteMany({ role: 'admin' }); // single-admin lookup must be deterministic
  const admin: any = await makeUser(`adm6_${Date.now()}@t.com`, 'admin');

  const upd = mockRes();
  await updateSupportContact({ body: { telegram: '@arenasupport' }, userId: admin._id.toString() } as any, upd);
  assert.equal(upd.code, 200);
  assert.equal(upd.body.telegram, 'https://t.me/arenasupport');

  const pub = mockRes();
  await getPublicSupportContact({} as any, pub);
  assert.equal(pub.body.telegram, 'https://t.me/arenasupport');

  const full = mockRes();
  await updateSupportContact({ body: { telegram: 'https://t.me/other_admin' }, userId: admin._id.toString() } as any, full);
  assert.equal(full.body.telegram, 'https://t.me/other_admin');

  const bad = mockRes();
  await updateSupportContact({ body: { telegram: '   ' }, userId: admin._id.toString() } as any, bad);
  assert.equal(bad.code, 400);
});
