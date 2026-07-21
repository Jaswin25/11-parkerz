// TypeScript definitions for 11 ParkerZ - CM Calcy

export type PlayerCategory = 'Bike' | 'School' | 'Normal';
export type PaymentMode = 'Cash' | 'GPay' | 'Both' | 'None';
export type ExpenseCategory = 'Bat' | 'Ball' | 'Tape' | 'Stumps' | 'Ground' | 'Jersey' | 'Food' | 'Other';
export type MatchResult = 'Win' | 'Loss';
export type SettlementMode = 'Cash' | 'GPay' | 'Both';

export interface Player {
  id: string;
  name: string;
  category: PlayerCategory;
  weekly_fee: number;
  phone?: string;
  created_at: string;
}

export interface AttendanceWeek {
  id: string;
  date: string; // YYYY-MM-DD
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  week_id: string;
  player_id: string;
  status: 'Present' | 'Absent';
  due_amount: number;
  paid_amount: number;
  pending_amount: number;
  payment_mode: PaymentMode;
  cash_amount: number;
  gpay_amount: number;
  created_at: string;
}

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  item: string;
  category: ExpenseCategory;
  amount: number;
  paid_from: 'Cash' | 'GPay';
  notes?: string;
  created_at: string;
}

export interface Match {
  id: string;
  date: string; // YYYY-MM-DD
  opponent: string;
  ground: string;
  bet_amount: number;
  result: MatchResult;
  amount_won_lost: number;
  settled_via: SettlementMode;
  cash_amount: number;
  gpay_amount: number;
  notes?: string;
  who_played: string[]; // array of player UUIDs
  match_number?: string; // e.g. 'Match 1', 'Match 2'
  created_at: string;
}

export interface ExtraPayment {
  id: string;
  player_id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  payment_mode: 'Cash' | 'GPay' | 'Both';
  cash_amount: number;
  gpay_amount: number;
  notes?: string;
  created_at: string;
}

export interface WalletBalances {
  cash: number;
  gpay: number;
  total: number;
  pending: number;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}
