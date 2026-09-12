import mongoose, { Document } from 'mongoose';

export type TxType = 'BET_PLACED' | 'WIN_PAYOUT' | 'PLATFORM_FEE' | 'ADMIN_ADJUST' | 'BONUS' | 'REFUND';

export interface ITransaction extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: TxType;
  amount: number; // positive for credit, negative for debit (but BET_PLACED negative)
  balanceBefore: number;
  balanceAfter: number;
  referenceId?: mongoose.Types.ObjectId;
  meta?: any;
  createdAt: Date;
}

const transactionSchema = new mongoose.Schema<ITransaction>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['BET_PLACED', 'WIN_PAYOUT', 'PLATFORM_FEE', 'ADMIN_ADJUST', 'BONUS', 'REFUND'], required: true },
    amount: { type: Number, required: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

transactionSchema.index({ userId: 1, createdAt: -1 });
// Money-safety: exactly one ledger entry per (reference, type, user).
// Enforces idempotent settlement/approval at the DB level, even under
// concurrent workers or crash retries. userId is part of the key because one
// payment legitimately writes two BONUS entries (friend deposit-bonus +
// referrer reward) for different users. Partial (not sparse): only docs with
// a real ObjectId reference are indexed, so ref-less entries (manual
// ADMIN_ADJUST, referral-signup BONUS) never collide.
transactionSchema.index(
  { referenceId: 1, type: 1, userId: 1 },
  { unique: true, partialFilterExpression: { referenceId: { $type: 'objectId' } } }
);

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
