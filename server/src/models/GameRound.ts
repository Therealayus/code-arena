import mongoose, { Document } from 'mongoose';
import { COLORS, COMBO_RESULTS, ResultType } from '../config';

export type RoundStatus = 'WAITING' | 'BETTING_OPEN' | 'BETTING_CLOSED' | 'RESULT_CALCULATED' | 'RESULT_REVEALED';

export interface IGameRound extends Document {
  _id: mongoose.Types.ObjectId;
  roundNumber: number;
  status: RoundStatus;
  startTime: Date;
  bettingCloseTime: Date;
  resultTime?: Date;
  // Single color (existing engine) or combination result (payout module).
  winningColor?: ResultType | null;
  colorTotals: Map<string, number> | Record<string, number>;
  totalBetAmount: number;
  totalBetsCount: number;
  tieBreakReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const gameRoundSchema = new mongoose.Schema<IGameRound>(
  {
    roundNumber: { type: Number, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['WAITING', 'BETTING_OPEN', 'BETTING_CLOSED', 'RESULT_CALCULATED', 'RESULT_REVEALED'],
      default: 'BETTING_OPEN',
      index: true,
    },
    startTime: { type: Date, required: true },
    bettingCloseTime: { type: Date, required: true, index: true },
    resultTime: { type: Date },
    winningColor: { type: String, enum: [...COLORS, ...COMBO_RESULTS, null], default: null },
    colorTotals: {
      type: Map,
      of: Number,
      default: () => new Map(COLORS.map((c) => [c, 0])),
    },
    totalBetAmount: { type: Number, default: 0 },
    totalBetsCount: { type: Number, default: 0 },
    tieBreakReason: { type: String, default: null },
  },
  { timestamps: true }
);

gameRoundSchema.index({ status: 1, bettingCloseTime: 1 });
gameRoundSchema.index({ roundNumber: -1 });

export const GameRound = mongoose.model<IGameRound>('GameRound', gameRoundSchema);
