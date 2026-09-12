import mongoose, { Document } from 'mongoose';
import { COLORS } from '../config';

export interface IBet extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  roundId: mongoose.Types.ObjectId;
  color: string;
  amount: number;
  createdAt: Date;
}

const betSchema = new mongoose.Schema<IBet>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roundId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameRound', required: true, index: true },
    color: { type: String, enum: COLORS, required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

betSchema.index({ roundId: 1, color: 1 });
betSchema.index({ userId: 1, roundId: 1 });
betSchema.index({ roundId: 1, createdAt: 1 });

export const Bet = mongoose.model<IBet>('Bet', betSchema);
