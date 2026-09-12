import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { config, COLORS, COLOR_PRIORITY } from './config';
import { User } from './models/User';
import { GameRound } from './models/GameRound';
import { Bet } from './models/Bet';
import { Counter } from './models/Counter';

dotenv.config();

async function seed() {
  await mongoose.connect(config.mongoUri);
  console.log('Connected to', config.mongoUri);

  // Clear existing demo data optionally? We'll keep idempotent.
  // Create sample users
  const demoUsers = [
    { name: 'Alice', email: 'alice@demo.com', password: 'demo1234' },
    { name: 'Bob', email: 'bob@demo.com', password: 'demo1234' },
    { name: 'Charlie', email: 'charlie@demo.com', password: 'demo1234' },
  ];

  for (const u of demoUsers) {
    const exists = await User.findOne({ email: u.email });
    if (!exists) {
      const hash = await bcrypt.hash(u.password, 10);
      await User.create({ name: u.name, email: u.email, passwordHash: hash, virtualBalance: 15000, role: 'user' });
      console.log(`Created ${u.email}`);
    } else {
      console.log(`Exists ${u.email}`);
    }
  }

  // Ensure admin
  const adminExists = await User.findOne({ email: config.adminEmail.toLowerCase() });
  if (!adminExists) {
    const hash = await bcrypt.hash(config.adminPassword, 10);
    await User.create({ name: 'Admin', email: config.adminEmail.toLowerCase(), passwordHash: hash, virtualBalance: 100000, role: 'admin' });
    console.log(`Created admin ${config.adminEmail}`);
  }

  // Create 15 historical rounds with results for demo history
  const count = await GameRound.countDocuments({ status: 'RESULT_REVEALED' });
  if (count < 5) {
    console.log('Seeding historical rounds...');
    let seqDoc = await Counter.findOne({ _id: 'roundNumber' });
    let nextSeq = seqDoc ? seqDoc.seq + 1 : 1;
    if (!seqDoc) {
      await Counter.create({ _id: 'roundNumber', seq: 0 });
      nextSeq = 1;
    }

    for (let i = 0; i < 12; i++) {
      const roundNumber = nextSeq + i;
      const start = new Date(Date.now() - (12 - i) * 70 * 1000);
      const close = new Date(start.getTime() + 60000);
      const resultTime = new Date(close.getTime() + 2000);

      const totals: any = {};
      let min = Infinity;
      COLORS.forEach((c) => {
        const v = Math.floor(Math.random() * 5000) + 500;
        totals[c] = v;
        if (v < min) min = v;
      });
      const candidates = COLORS.filter((c) => totals[c] === min);
      // tie break by priority
      const priority = [...COLOR_PRIORITY];
      let winner = candidates[0];
      let best = priority.indexOf(winner);
      candidates.forEach(c => {
        const idx = priority.indexOf(c);
        if (idx < best) { winner = c; best = idx; }
      });

      const reason = candidates.length > 1 ? `TIE_BREAK: ${candidates.join(',')} at ${min} -> ${winner}` : null;

      await GameRound.create({
        roundNumber,
        status: 'RESULT_REVEALED',
        startTime: start,
        bettingCloseTime: close,
        resultTime,
        winningColor: winner,
        colorTotals: totals,
        totalBetAmount: (Object.values(totals) as number[]).reduce((a:number,b:number)=>a+b,0),
        totalBetsCount: Math.floor(Math.random()*20)+5,
        tieBreakReason: reason,
      });
    }
    await Counter.updateOne({ _id: 'roundNumber' }, { $set: { seq: nextSeq + 12 - 1 } }, { upsert: true });
    console.log('Seeded 12 historical rounds');
  } else {
    console.log(`Already have ${count} historical rounds, skipping`);
  }

  await mongoose.disconnect();
  console.log('Seed done');
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
