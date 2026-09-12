import mongoose, { Document } from 'mongoose';

export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface IPaymentRequest extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  amount: number;
  upiId: string;
  screenshotPath: string;
  screenshotOriginalName?: string;
  status: PaymentStatus;
  adminNote?: string | null;
  reviewedBy?: mongoose.Types.ObjectId | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const paymentRequestSchema = new mongoose.Schema<IPaymentRequest>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 10, max: 100000 },
    upiId: { type: String, required: true, trim: true },
    screenshotPath: { type: String, required: true },
    screenshotOriginalName: { type: String },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
    adminNote: { type: String, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

paymentRequestSchema.index({ userId: 1, createdAt: -1 });
paymentRequestSchema.index({ status: 1, createdAt: -1 });

export const PaymentRequest = mongoose.model<IPaymentRequest>('PaymentRequest', paymentRequestSchema);
