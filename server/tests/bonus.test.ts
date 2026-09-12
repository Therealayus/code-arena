/**
 * Unit tests for deposit bonus tiers + referral codes. No DB required.
 * Run: npm run test:bonus
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { depositBonusFor, generateReferralCode, isValidReferralCodeFormat } from '../src/services/bonus';
import { DEPOSIT_BONUS_TIERS, REFERRAL_RULES } from '../src/config';

test('below lowest tier earns nothing (499)', () => {
  assert.deepEqual(depositBonusFor(499), { bonusCoins: 0, bonusPercent: 0 });
});

test('tier boundaries: 500 => +5%, 2000 => +10%, 5000 => +15%', () => {
  assert.deepEqual(depositBonusFor(500), { bonusCoins: 25, bonusPercent: 5 });
  assert.deepEqual(depositBonusFor(2000), { bonusCoins: 200, bonusPercent: 10 });
  assert.deepEqual(depositBonusFor(5000), { bonusCoins: 750, bonusPercent: 15 });
});

test('highest qualifying tier wins (1999 => 5%, 4999 => 10%)', () => {
  assert.deepEqual(depositBonusFor(1999), { bonusCoins: 99, bonusPercent: 5 });
  assert.deepEqual(depositBonusFor(4999), { bonusCoins: 499, bonusPercent: 10 });
});

test('large top-up 50000 => +7500 (15%)', () => {
  assert.deepEqual(depositBonusFor(50000), { bonusCoins: 7500, bonusPercent: 15 });
});

test('invalid amounts throw', () => {
  assert.throws(() => depositBonusFor(0));
  assert.throws(() => depositBonusFor(-100));
  assert.throws(() => depositBonusFor(10.5));
});

test('referral codes have the right format', () => {
  for (let i = 0; i < 20; i++) {
    const code = generateReferralCode();
    assert.match(code, /^ARENA-[A-Z2-9]{6}$/);
    assert.equal(isValidReferralCodeFormat(code), true);
  }
  assert.equal(isValidReferralCodeFormat('ARENA-ABCDEF'), true);
  assert.equal(isValidReferralCodeFormat('WRONG-ABCDEF'), false);
  assert.equal(isValidReferralCodeFormat('ARENA-ABC01O'), false); // 0/O/1/I excluded
  assert.equal(isValidReferralCodeFormat('ARENA-SHORT'), false);
});

test('centralized bonus config matches advertised defaults', () => {
  assert.deepEqual(DEPOSIT_BONUS_TIERS, [
    { minAmount: 5000, bonusPercent: 15 },
    { minAmount: 2000, bonusPercent: 10 },
    { minAmount: 500, bonusPercent: 5 },
  ]);
  assert.equal(REFERRAL_RULES.refereeSignupBonus, 500);
  assert.equal(REFERRAL_RULES.referrerFirstTopupReward, 1000);
});
