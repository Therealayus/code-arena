/**
 * Unit tests for the fixed payout rules + platform fee.
 * Pure functions only — no DB required.
 * Run: npm test  (ts-node --transpile-only)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePayout,
  getMultiplier,
  getWinningColors,
  isValidResult,
  isWinningBet,
} from '../src/services/payout';
import { PAYOUT_RULES, config } from '../src/config';

// --- Spec examples: Rs 100 base -------------------------------------------

test('RED: 100 x 2.0 = 200 gross, 20 fee, 180 net', () => {
  assert.deepEqual(calculatePayout(100, 'RED', 10), {
    betAmount: 100,
    result: 'RED',
    multiplier: 2.0,
    grossPayout: 200,
    platformFee: 20,
    platformFeePercent: 10,
    netPayout: 180,
  });
});

test('GREEN: 100 x 2.0 = 200 gross, 20 fee, 180 net', () => {
  const p = calculatePayout(100, 'GREEN', 10);
  assert.equal(p.grossPayout, 200);
  assert.equal(p.platformFee, 20);
  assert.equal(p.netPayout, 180);
});

test('BLUE: 100 x 2.0 = 200 gross, 20 fee, 180 net', () => {
  const p = calculatePayout(100, 'BLUE', 10);
  assert.equal(p.grossPayout, 200);
  assert.equal(p.platformFee, 20);
  assert.equal(p.netPayout, 180);
});

test('RED_BLUE: 100 x 1.5 = 150 gross, 15 fee, 135 net', () => {
  const p = calculatePayout(100, 'RED_BLUE', 10);
  assert.equal(p.multiplier, 1.5);
  assert.equal(p.grossPayout, 150);
  assert.equal(p.platformFee, 15);
  assert.equal(p.netPayout, 135);
});

test('GREEN_BLUE: 100 x 1.5 = 150 gross, 15 fee, 135 net', () => {
  const p = calculatePayout(100, 'GREEN_BLUE', 10);
  assert.equal(p.multiplier, 1.5);
  assert.equal(p.grossPayout, 150);
  assert.equal(p.platformFee, 15);
  assert.equal(p.netPayout, 135);
});

// --- Different bet amounts --------------------------------------------------

test('different amounts scale linearly (1000 RED @10%)', () => {
  const p = calculatePayout(1000, 'RED', 10);
  assert.equal(p.grossPayout, 2000);
  assert.equal(p.platformFee, 200);
  assert.equal(p.netPayout, 1800);
});

test('minimum bet 10 RED @10% => 20 / 2 / 18', () => {
  const p = calculatePayout(10, 'RED', 10);
  assert.deepEqual([p.grossPayout, p.platformFee, p.netPayout], [20, 2, 18]);
});

test('uses configured fee percent by default', () => {
  const p = calculatePayout(100, 'RED');
  assert.equal(p.platformFeePercent, config.platformFeePercent);
  assert.equal(p.netPayout, p.grossPayout - p.platformFee);
});

// --- Money precision (integer coins; floor gross, floor fee) ----------------

test('decimal precision: 99 RED_BLUE => gross 148, fee 14, net 134', () => {
  const p = calculatePayout(99, 'RED_BLUE', 10);
  assert.equal(p.grossPayout, 148); // floor(148.5)
  assert.equal(p.platformFee, 14); // floor(14.8)
  assert.equal(p.netPayout, 134);
  assert.equal(p.grossPayout, p.platformFee + p.netPayout);
});

test('tiny payout 1 RED => gross 2, fee 0, net 2', () => {
  const p = calculatePayout(1, 'RED', 10);
  assert.deepEqual([p.grossPayout, p.platformFee, p.netPayout], [2, 0, 2]);
});

// --- Fee is identical across all result types -------------------------------

test('same fee percent for singles and combos', () => {
  for (const r of ['RED', 'GREEN', 'BLUE', 'RED_BLUE', 'GREEN_BLUE']) {
    const p = calculatePayout(1000, r, 10);
    assert.equal(p.platformFee, Math.floor(p.grossPayout / 10), r);
  }
});

// --- Invalid inputs ---------------------------------------------------------

test('invalid bet amounts throw (0, negative, fractional)', () => {
  assert.throws(() => calculatePayout(0, 'RED', 10));
  assert.throws(() => calculatePayout(-50, 'RED', 10));
  assert.throws(() => calculatePayout(10.5, 'RED', 10));
  assert.throws(() => calculatePayout(Number.NaN, 'RED', 10));
});

test('invalid results throw; RED_GREEN is NOT offered', () => {
  assert.throws(() => calculatePayout(100, 'ORANGE', 10));
  assert.throws(() => calculatePayout(100, 'RED_GREEN', 10));
  assert.throws(() => getMultiplier('RED_GREEN'));
  assert.equal(isValidResult('RED_GREEN'), false);
  assert.equal(isValidResult('RED_BLUE'), true);
});

test('invalid fee percent throws', () => {
  assert.throws(() => calculatePayout(100, 'RED', -1));
  assert.throws(() => calculatePayout(100, 'RED', 101));
});

// --- Winner matching --------------------------------------------------------

test('singles match only their own color', () => {
  assert.equal(isWinningBet('RED', 'RED'), true);
  assert.equal(isWinningBet('GREEN', 'RED'), false);
  assert.equal(isWinningBet('BLUE', 'BLUE'), true);
});

test('combos pay member colors only', () => {
  assert.equal(isWinningBet('RED', 'RED_BLUE'), true);
  assert.equal(isWinningBet('BLUE', 'RED_BLUE'), true);
  assert.equal(isWinningBet('GREEN', 'RED_BLUE'), false);
  assert.equal(isWinningBet('GREEN', 'GREEN_BLUE'), true);
  assert.equal(isWinningBet('BLUE', 'GREEN_BLUE'), true);
  assert.equal(isWinningBet('RED', 'GREEN_BLUE'), false);
});

test('getWinningColors', () => {
  assert.deepEqual(getWinningColors('RED'), ['RED']);
  assert.deepEqual(getWinningColors('RED_BLUE'), ['RED', 'BLUE']);
  assert.deepEqual(getWinningColors('GREEN_BLUE'), ['GREEN', 'BLUE']);
});

test('centralized config matches spec defaults (3 colors, no RED_GREEN)', () => {
  assert.deepEqual(Object.keys(PAYOUT_RULES).sort(), ['BLUE', 'GREEN', 'GREEN_BLUE', 'RED', 'RED_BLUE']);
  assert.deepEqual(
    { RED: PAYOUT_RULES.RED, GREEN: PAYOUT_RULES.GREEN, BLUE: PAYOUT_RULES.BLUE, RED_BLUE: PAYOUT_RULES.RED_BLUE, GREEN_BLUE: PAYOUT_RULES.GREEN_BLUE },
    { RED: 2.0, GREEN: 2.0, BLUE: 2.0, RED_BLUE: 1.5, GREEN_BLUE: 1.5 }
  );
});
