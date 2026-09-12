import jwt from 'jsonwebtoken';
import { config } from '../config';

export function signToken(payload: object): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as any);
}
