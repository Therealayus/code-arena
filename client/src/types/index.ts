export type Color = 'RED' | 'GREEN' | 'BLUE';
export type ResultType = Color | 'RED_BLUE' | 'GREEN_BLUE';
export const COLORS: Color[] = ['RED','GREEN','BLUE'];
export const COLOR_META: Record<Color, {emoji:string, bg:string, hex:string, gradient:string}> = {
  RED: { emoji:'🔴', bg:'bg-red-500', hex:'#ef4444', gradient:'from-red-500 to-rose-600' },
  GREEN: { emoji:'🟢', bg:'bg-green-500', hex:'#22c55e', gradient:'from-emerald-500 to-green-600' },
  BLUE: { emoji:'🔵', bg:'bg-blue-500', hex:'#3b82f6', gradient:'from-blue-500 to-sky-600' },
};

export interface GameRound {
  _id: string;
  roundNumber: number;
  status: 'WAITING'|'BETTING_OPEN'|'BETTING_CLOSED'|'RESULT_CALCULATED'|'RESULT_REVEALED';
  startTime: string;
  bettingCloseTime: string;
  resultTime?: string;
  winningColor?: ResultType | null;
  colorTotals: Record<Color, number> | Map<string, number>;
  totalBetAmount: number;
  totalBetsCount: number;
  tieBreakReason?: string | null;
}

export interface User { id:string; name:string; email:string; virtualBalance:number; role:string; }
export interface Bet { _id:string; userId:string; roundId:string; color:Color; amount:number; createdAt:string; }
