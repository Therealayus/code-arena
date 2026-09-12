import mongoose, { Document } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  virtualBalance: number;
  role: 'user' | 'admin';
  upiId?: string | null;
  isBanned?: boolean;
  banReason?: string | null;
  referralCode?: string | null;
  referredBy?: mongoose.Types.ObjectId | null;
  referralCount?: number;
  referralEarned?: number;
  // Set atomically when the referrer reward is paid (one reward per referred
  // friend, even under concurrent first-top-up approvals).
  referrerRewardPaid?: boolean;
  supportTelegram?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    virtualBalance: { type: Number, required: true, default: 0, min: 0 },
    role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
    upiId: { type: String, trim: true, lowercase: true, default: null, maxlength: 100 },
    isBanned: { type: Boolean, default: false, index: true },
    banReason: { type: String, default: null },
    referralCode: { type: String, unique: true, sparse: true, index: true, uppercase: true, trim: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    referralCount: { type: Number, default: 0, min: 0 },
    referralEarned: { type: Number, default: 0, min: 0 },
    referrerRewardPaid: { type: Boolean, default: false, index: true },
    // Platform support contact (used on the admin account): Telegram link/username
    // shown on the login page for password-reset help.
    supportTelegram: { type: String, trim: true, default: null, maxlength: 200 },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
