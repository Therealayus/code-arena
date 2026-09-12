/**
 * Self-service password change tests (users and admins, while logged in).
 * Isolated `color-arena-test` database.
 * Run: npm run test:password
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../src/models/User';
import { changePassword } from '../src/controllers/userController';
import { login } from '../src/controllers/authController';

const URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/color-arena-test';

before(async () => {
  await mongoose.connect(URI);
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

async function makeUser(email: string, role: 'user' | 'admin' = 'user') {
  const hash = await bcrypt.hash('oldpass123', 10);
  return User.create({ name: 'T', email, passwordHash: hash, virtualBalance: 0, role });
}

async function changePw(userId: any, currentPassword: any, newPassword: any) {
  const res = mockRes();
  await changePassword({ body: { currentPassword, newPassword }, userId: userId.toString() } as any, res);
  return res;
}

async function loginWith(email: string, password: string) {
  const res = mockRes();
  await login({ body: { email, password } } as any, res);
  return res;
}

test('user changes own password while logged in', async () => {
  const email = `pw1_${Date.now()}@t.com`;
  const u: any = await makeUser(email);

  const res = await changePw(u._id, 'oldpass123', 'brandnew99');
  assert.equal(res.code, 200);
  assert.equal(res.body.ok, true);

  assert.equal((await loginWith(email, 'oldpass123')).code, 401);
  assert.equal((await loginWith(email, 'brandnew99')).code, 200);
});

test('admin changes own password while logged in', async () => {
  const email = `adm_${Date.now()}@t.com`;
  const a: any = await makeUser(email, 'admin');

  const res = await changePw(a._id, 'oldpass123', 'adminnew99');
  assert.equal(res.code, 200);
  assert.equal((await loginWith(email, 'adminnew99')).code, 200);
});

test('wrong current password is rejected and nothing changes', async () => {
  const email = `pw2_${Date.now()}@t.com`;
  const u: any = await makeUser(email);

  const res = await changePw(u._id, 'notmypass', 'brandnew99');
  assert.equal(res.code, 401);
  assert.equal((await loginWith(email, 'oldpass123')).code, 200);
});

test('invalid new passwords are rejected', async () => {
  const email = `pw3_${Date.now()}@t.com`;
  const u: any = await makeUser(email);

  assert.equal((await changePw(u._id, 'oldpass123', '123')).code, 400);
  assert.equal((await changePw(u._id, 'oldpass123', 'oldpass123')).code, 400);
  assert.equal((await changePw(u._id, 'oldpass123', undefined)).code, 400);
  assert.equal((await changePw(u._id, undefined, 'brandnew99')).code, 400);
  // original still works
  assert.equal((await loginWith(email, 'oldpass123')).code, 200);
});

test('unknown user gets 404', async () => {
  const res = mockRes();
  await changePassword(
    { body: { currentPassword: 'x', newPassword: 'validpass1' }, userId: new mongoose.Types.ObjectId().toString() } as any,
    res
  );
  assert.equal(res.code, 404);
});
