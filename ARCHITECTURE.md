# Color Arena - Architecture Plan

## Overview
Modern color prediction game: 3 colors, 60s rounds, winner = lowest total bet. Virtual coins only.

## Colors
RED, GREEN, BLUE (+ combination results RED_BLUE, GREEN_BLUE for payouts)

## Round Lifecycle
WAITING -> BETTING_OPEN -> BETTING_CLOSED -> RESULT_CALCULATED -> RESULT_REVEALED -> (loop)

Timings (configurable via env):
- BETTING_DURATION: 60s
- RESULT_REVEAL_DURATION: 8s
- WAITING: 2s gap between rounds

State machine enforced server-side only.

## Winner Determination
1. Aggregate SUM(amount) GROUP BY color for round
2. Find min total. If no bets => random? For demo, pick random color but mark reason: NO_BETS_RANDOM
3. If multiple colors tie at min => deterministic tie-break: canonical order priority
   Priority: RED (0) < GREEN (1) < BLUE (2) -> smallest index wins
   Documented in `roundEngine.ts` and stored in GameRound.tieBreakReason
4. Store winningColor, colorTotals Map, tieBreakReason, resultTime

## Payout
- PAYOUT_RULES (centralized, gross incl. stake): singles RED/GREEN/BLUE = 2.0x, combos RED_BLUE/GREEN_BLUE = 1.5x
- PLATFORM_FEE_PERCENT = 10 on every win: gross = floor(bet * mult), fee = floor(gross * 10%), net = gross - fee
- Winners credited net only; WIN_PAYOUT tx (net + breakdown) + separate PLATFORM_FEE tx per win
- Example: bet 100 on RED => 200 gross - 20 fee = 180 net. Stake already deducted at bet time.
- Settlement idempotent: one WIN_PAYOUT per bet (checked pre-write + in-tx); round claimed atomically.
- Uses MongoDB transactions (session) for atomic balance updates + Transaction log.
- Losers get nothing.
- All payouts happen in single bulk within transaction per winner batch.

## Concurrency Safety
- Bet placement uses MongoDB session transaction:
  1. Verify round status BETTING_OPEN and now < bettingCloseTime
  2. Verify user balance >= amount via atomic findOneAndUpdate with condition or transaction read + update
  3. Decrement virtualBalance
  4. Create Bet doc
  5. Create Transaction type=BET_PLACED
  6. Update GameRound.colorTotals.$color increment (optional denormalized)
- Duplicate bet protection: allow multiple bets per user per round (no unique constraint), but rate-limit 10 bets/sec.

## Models
- User: name, email unique, passwordHash, virtualBalance (default 0 — no free coins; play requires top-up), role (user/admin), indexes
- GameRound: roundNumber auto-increment (via Counter collection), status enum, startTime, bettingCloseTime, resultTime, winningColor enum|null, colorTotals Map, tieBreakReason, totalBetAmount, totalBetsCount
- Bet: userId ref, roundId ref, color enum, amount, createdAt, indexes on roundId+color, userId
- Transaction: userId, type enum (BET_PLACED, WIN_PAYOUT, ADMIN_ADJUST, BONUS), amount (+/-), balanceBefore/After, referenceId (betId/roundId), createdAt
- Counter: _id, seq

## APIs
POST /api/auth/register {name,email,password} -> {token,user}
POST /api/auth/login {email,password} -> {token,user}
GET /api/user/profile (auth)
GET /api/user/balance (auth)
GET /api/user/transactions (auth)
GET /api/game/current
GET /api/game/history?limit=20&page=1
GET /api/game/:roundId
POST /api/game/:roundId/bet {color,amount} (auth)
GET /api/game/:roundId/bets (auth, own bets or all if admin)
GET /api/game/:roundId/result
GET /api/admin/stats (admin)
GET /api/admin/users (admin)
POST /api/admin/users/:id/balance {amount,reason} (admin)
GET /api/admin/rounds (admin)

## Socket.IO Events
Server -> Client:
- round:new {round}
- round:tick {roundNumber, remainingMs, status}
- round:betUpdate {roundNumber, colorTotals, totalBetAmount}
- round:closing {roundNumber}
- round:result {roundNumber, winningColor, colorTotals, tieBreakReason}
- balance:update {balance}

Client -> Server:
- join:round
- place:bet (alternative via REST, socket just for realtime)

## Security
- bcrypt hashing, JWT 7d expiry
- helmet, cors, rateLimit (api 100/15m, auth 10/15m)
- express-validator
- Indexes, auth middleware, role middleware
- Server authoritative: never trust client balance/timer/winner

## Frontend Structure
- React Router: /login, /register, /game, /history, /admin
- Zustand or Context for auth, React Query for data
- Tailwind dark theme, Framer Motion for animations

## Deployment Notes
- MongoDB Atlas or local, uses transactions => requires replica set (fallback to non-transactional with atomic ops if standalone)
