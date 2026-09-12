# 🎨 Color Arena — Virtual Color Prediction Game

Modern full-stack **play-money** color prediction game. 3 colors, 60s rounds, winner = **lowest total bet** (deterministic tie-break). Built with MERN + Socket.IO.

> **Demo only — virtual coins, no real money.** No deposits/withdrawals/payment gateways.

## ✨ Features
- 🔐 JWT auth, bcrypt, rate-limit, validation
- 🎮 60s rounds, server-authoritative lifecycle: `WAITING → BETTING_OPEN → BETTING_CLOSED → RESULT_CALCULATED → RESULT_REVEALED → NEXT_ROUND`
- 📡 Real-time via Socket.IO: ticks, bet updates, closing, result, new round
- 💰 Virtual coins, 4.5x payout, atomic balance updates (transactions with fallback)
- 🪢 Deterministic tie-break: `RED > GREEN > BLUE` (lowest priority index wins), stored as `tieBreakReason`
- 📊 History, admin dashboard, transaction log
- 🎨 Dark theme, animations, mobile-first, Tailwind + Framer Motion

## Architecture

```
color-arena/
  client/  (Vite + React + TS + Tailwind + React Query + Socket.IO + Zustand)
  server/  (Express + TS + Mongoose + Socket.IO + JWT)
  ARCHITECTURE.md
```

See `ARCHITECTURE.md` for detailed design.

## Quick Start

### Prereqs
- Node 18+, MongoDB 6+ (replica set recommended for transactions; fallback works on standalone)

### 1. Clone & install
```bash
git clone <repo>
cd color-arena/server && npm install
cd ../client && npm install
```

### 2. Env
```bash
# server
cp server/.env.example server/.env
# edit MONGODB_URI, JWT_SECRET, etc.

# client (optional)
cp client/.env.example client/.env
```

**server/.env**
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/color-arena
JWT_SECRET=change_this_super_secret_jwt_key_min_32_chars
JWT_EXPIRES_IN=7d
BETTING_DURATION_MS=60000
RESULT_REVEAL_DURATION_MS=8000
PAYOUT_MULTIPLIER=4.5
INITIAL_BALANCE=0
ADMIN_EMAIL=admin@colorarena.demo
ADMIN_PASSWORD=Admin123!
CORS_ORIGIN=http://localhost:5173
```

### 3. Run
```bash
# terminal 1: server
cd server
npm run dev
# optional seed demo data (12 historical rounds + demo users)
npm run seed

# terminal 2: client
cd client
npm run dev
```

Visit `http://localhost:5173`

**Demo accounts** (after seed):
- `alice@demo.com / demo1234` (15k)
- `bob@demo.com / demo1234`
- `admin@colorarena.demo / Admin123!`

### Build
```bash
cd server && npm run build && npm start
cd client && npm run build && npm run preview
```

## API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | no | {name,email,password} |
| POST | /api/auth/login | no | {email,password} |
| GET | /api/user/profile | yes | Profile |
| GET | /api/user/balance | yes | Balance |
| GET | /api/user/transactions | yes | Tx history |
| GET | /api/game/current | no | Current round |
| GET | /api/game/history | no | ?limit&page |
| GET | /api/game/:roundId | no | Round detail |
| GET | /api/game/:roundId/result | no | Result |
| GET | /api/game/:roundId/bets | yes | Own bets (all if admin) + totals |
| POST | /api/game/:roundId/bet | yes | {color,amount} |
| GET | /api/admin/stats | admin | Stats |
| GET | /api/admin/users | admin | Users |
| POST | /api/admin/users/:id/balance | admin | {amount,reason} |
| GET | /api/admin/rounds | admin | Rounds |

## Socket.IO Events

**Server → Client**
- `round:new` {round}
- `round:tick` {roundNumber, remainingMs, status, bettingCloseTime}
- `round:betUpdate` {roundNumber, colorTotals, totalBetAmount}
- `round:closing` {roundNumber}
- `round:result` {roundNumber, winningColor, colorTotals, tieBreakReason}
- `balance:update` {balance}

**Client → Server**
- `join:round`

## Database Models

- **User**: name, email, passwordHash, virtualBalance, role, timestamps + indexes
- **GameRound**: roundNumber, status, startTime, bettingCloseTime, resultTime, winningColor, colorTotals Map, totalBetAmount, totalBetsCount, tieBreakReason
- **Bet**: userId, roundId, color, amount
- **Transaction**: userId, type, amount, balanceBefore/After, referenceId, meta
- **Counter**: seq for roundNumber

## Game Rules
- Colors: 🔴 RED, 🟢 GREEN, 🔵 BLUE (combos: RED+BLUE, GREEN+BLUE)
- Bet amount: 10–100,000, integer, ≤ balance, only when BETTING_OPEN
- Winner: `min(colorTotals)`; ties → earliest in `COLOR_PRIORITY`. If no bets → random, reason `NO_BETS_RANDOM`.
- Payout: `bet.amount * 4.5` floored, credited atomically.
- Server is source of truth for timer/winner/balance.

## Security
- Helmet, CORS, rate-limit, express-validator, JWT, bcrypt, server-side validations, atomic balance ops, indexes.

## Scripts

| Dir | Command | Description |
|-----|---------|-------------|
| server | npm run dev | ts-node-dev |
| server | npm run seed | Create demo users + history |
| server | npm run build | Compile TS |
| client | npm run dev | Vite dev |
| client | npm run build | Vite build |

## Troubleshooting
- **Mongo transaction errors**: App falls back to atomic `findOneAndUpdate` if not replica set.
- **Socket not connecting**: Check CORS_ORIGIN matches Vite port.
- **Balance mismatch**: Check Transaction collection for audit.

## License
MIT — Demo educational project. Not for real gambling.
