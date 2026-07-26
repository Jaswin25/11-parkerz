import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  Player, PlayerCategory, AttendanceWeek, AttendanceRecord, 
  Expense, Match, ExtraPayment, WalletBalances, SupabaseConfig 
} from '../types';

const CONFIG_KEY = 'cm_calcy_supabase_config';
const PLAYERS_KEY = 'cm_calcy_players';
const WEEKS_KEY = 'cm_calcy_weeks';
const ATTENDANCE_KEY = 'cm_calcy_attendance';
const EXPENSES_KEY = 'cm_calcy_expenses';
const MATCHES_KEY = 'cm_calcy_matches';
const EXTRA_PAYMENTS_KEY = 'cm_calcy_extra_payments';

const DEFAULT_PLAYERS_LIST = [
  "Sathish", "Hari", "Keerthi vasan", "Raja Pandi", "Basha", "Yuvan Bharathi",
  "Jeeva", "Jaswin", "Dharun", "Hari Dass", "Mugesh", "Dinesh",
  "Srithar", "Krishna", "Vajara", "Kishoore"
];

// Helper to generate IDs
const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Initialize Supabase if config is in localStorage or env variables
let supabase: SupabaseClient | null = null;

const getSavedConfig = (): SupabaseConfig | null => {
  const saved = localStorage.getItem(CONFIG_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }
  return null;
};

const initSupabase = (): SupabaseClient | null => {
  const saved = getSavedConfig();
  if (saved && saved.url && saved.anonKey) {
    try {
      return createClient(saved.url, saved.anonKey);
    } catch (e) {
      console.error('Failed to init Supabase client from localStorage', e);
    }
  }

  // Fallback to Vite environment variables
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (envUrl && envKey) {
    try {
      return createClient(envUrl, envKey);
    } catch (e) {
      console.error('Failed to init Supabase client from env variables', e);
    }
  }

  return null;
};

supabase = initSupabase();

// ----------------------------------------------------
// LOCAL STORAGE DB SERVICES
// ----------------------------------------------------
const LocalDb = {
  getPlayers: (): Player[] => {
    const data = localStorage.getItem(PLAYERS_KEY);
    if (!data) {
      const initial: Player[] = DEFAULT_PLAYERS_LIST.map(name => ({
        id: uuidv4(),
        name,
        category: 'Normal',
        weekly_fee: 50,
        created_at: new Date().toISOString()
      }));
      localStorage.setItem(PLAYERS_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(data);
  },

  savePlayers: (players: Player[]) => {
    localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
  },

  addPlayer: (name: string, category: PlayerCategory, phone?: string): Player => {
    const players = LocalDb.getPlayers();
    const fee = category === 'Normal' ? 50 : 30;
    const newPlayer: Player = {
      id: uuidv4(),
      name,
      category,
      weekly_fee: fee,
      phone: phone || '',
      created_at: new Date().toISOString()
    };
    players.push(newPlayer);
    LocalDb.savePlayers(players);
    return newPlayer;
  },

  updatePlayer: (id: string, name: string, category: PlayerCategory, phone?: string): Player => {
    const players = LocalDb.getPlayers();
    const fee = category === 'Normal' ? 50 : 30;
    const index = players.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Player not found');
    players[index] = {
      ...players[index],
      name,
      category,
      weekly_fee: fee,
      phone: phone || ''
    };
    LocalDb.savePlayers(players);
    return players[index];
  },

  deletePlayer: (id: string): void => {
    const players = LocalDb.getPlayers();
    const filteredPlayers = players.filter(p => p.id !== id);
    LocalDb.savePlayers(filteredPlayers);

    const attendance = LocalDb.getAttendanceAll();
    const filteredAttendance = attendance.filter(a => a.player_id !== id);
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(filteredAttendance));

    const payments = LocalDb.getExtraPayments();
    const filteredPayments = payments.filter(p => p.player_id !== id);
    localStorage.setItem(EXTRA_PAYMENTS_KEY, JSON.stringify(filteredPayments));

    const matches = LocalDb.getMatches();
    const updatedMatches = matches.map(m => ({
      ...m,
      who_played: m.who_played.filter(pid => pid !== id)
    }));
    localStorage.setItem(MATCHES_KEY, JSON.stringify(updatedMatches));
  },

  getWeeks: (): AttendanceWeek[] => {
    const data = localStorage.getItem(WEEKS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveWeeks: (weeks: AttendanceWeek[]) => {
    localStorage.setItem(WEEKS_KEY, JSON.stringify(weeks));
  },

  addWeek: (date: string): AttendanceWeek => {
    const weeks = LocalDb.getWeeks();
    const newWeek: AttendanceWeek = {
      id: uuidv4(),
      date,
      created_at: new Date().toISOString()
    };
    weeks.push(newWeek);
    // Sort weeks by date descending
    weeks.sort((a, b) => b.date.localeCompare(a.date));
    LocalDb.saveWeeks(weeks);
    return newWeek;
  },

  deleteWeek: (weekId: string): void => {
    const weeks = LocalDb.getWeeks();
    const filteredWeeks = weeks.filter(w => w.id !== weekId);
    LocalDb.saveWeeks(filteredWeeks);

    const attendance = LocalDb.getAttendanceAll();
    const filteredAttendance = attendance.filter(a => a.week_id !== weekId);
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(filteredAttendance));
  },

  getAttendanceAll: (): AttendanceRecord[] => {
    const data = localStorage.getItem(ATTENDANCE_KEY);
    return data ? JSON.parse(data) : [];
  },

  getAttendance: (weekId: string): AttendanceRecord[] => {
    const attendance = LocalDb.getAttendanceAll();
    return attendance.filter(r => r.week_id === weekId);
  },

  saveAttendance: (weekId: string, records: Omit<AttendanceRecord, 'id' | 'week_id' | 'created_at'>[]): void => {
    const all = LocalDb.getAttendanceAll().filter(r => r.week_id !== weekId);
    const newRecords: AttendanceRecord[] = records.map(r => ({
      ...r,
      id: uuidv4(),
      week_id: weekId,
      created_at: new Date().toISOString()
    }));
    all.push(...newRecords);
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(all));
  },

  getExpenses: (): Expense[] => {
    const data = localStorage.getItem(EXPENSES_KEY);
    const expenses: Expense[] = data ? JSON.parse(data) : [];
    // Sort by date descending
    return expenses.sort((a, b) => b.date.localeCompare(a.date));
  },

  addExpense: (expense: Omit<Expense, 'id' | 'created_at'>): Expense => {
    const expenses = LocalDb.getExpenses();
    const newExpense: Expense = {
      ...expense,
      id: uuidv4(),
      created_at: new Date().toISOString()
    };
    expenses.push(newExpense);
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
    return newExpense;
  },

  deleteExpense: (id: string): void => {
    const expenses = LocalDb.getExpenses();
    const filtered = expenses.filter(e => e.id !== id);
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(filtered));
  },

  getMatches: (): Match[] => {
    const data = localStorage.getItem(MATCHES_KEY);
    const matches: Match[] = data ? JSON.parse(data) : [];
    return matches.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return (a.match_number || 'Match 1').localeCompare(b.match_number || 'Match 1');
    });
  },

  addMatch: (match: Omit<Match, 'id' | 'created_at'>): Match => {
    const matches = LocalDb.getMatches();
    const newMatch: Match = {
      ...match,
      id: uuidv4(),
      created_at: new Date().toISOString()
    };
    matches.push(newMatch);
    localStorage.setItem(MATCHES_KEY, JSON.stringify(matches));
    return newMatch;
  },

  deleteMatch: (id: string): void => {
    const matches = LocalDb.getMatches();
    const filtered = matches.filter(m => m.id !== id);
    localStorage.setItem(MATCHES_KEY, JSON.stringify(filtered));
  },

  getExtraPayments: (): ExtraPayment[] => {
    const data = localStorage.getItem(EXTRA_PAYMENTS_KEY);
    const payments: ExtraPayment[] = data ? JSON.parse(data) : [];
    return payments.sort((a, b) => b.date.localeCompare(a.date));
  },

  addExtraPayment: (payment: Omit<ExtraPayment, 'id' | 'created_at'>): ExtraPayment => {
    const payments = LocalDb.getExtraPayments();
    const newPayment: ExtraPayment = {
      ...payment,
      id: uuidv4(),
      created_at: new Date().toISOString()
    };
    payments.push(newPayment);
    localStorage.setItem(EXTRA_PAYMENTS_KEY, JSON.stringify(payments));
    return newPayment;
  },

  deleteExtraPayment: (id: string): void => {
    const payments = LocalDb.getExtraPayments();
    const filtered = payments.filter(p => p.id !== id);
    localStorage.setItem(EXTRA_PAYMENTS_KEY, JSON.stringify(filtered));
  },

  updateExpense: (id: string, expense: Omit<Expense, 'id' | 'created_at'>): Expense => {
    const expenses = LocalDb.getExpenses();
    const index = expenses.findIndex(e => e.id === id);
    if (index === -1) throw new Error('Expense not found');
    expenses[index] = {
      ...expenses[index],
      ...expense
    };
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
    return expenses[index];
  },

  updateMatch: (id: string, match: Omit<Match, 'id' | 'created_at'>): Match => {
    const matches = LocalDb.getMatches();
    const index = matches.findIndex(m => m.id === id);
    if (index === -1) throw new Error('Match not found');
    matches[index] = {
      ...matches[index],
      ...match
    };
    localStorage.setItem(MATCHES_KEY, JSON.stringify(matches));
    return matches[index];
  },

  updateExtraPayment: (id: string, payment: Omit<ExtraPayment, 'id' | 'created_at'>): ExtraPayment => {
    const payments = LocalDb.getExtraPayments();
    const index = payments.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Extra payment not found');
    payments[index] = {
      ...payments[index],
      ...payment
    };
    localStorage.setItem(EXTRA_PAYMENTS_KEY, JSON.stringify(payments));
    return payments[index];
  },

  updateWeek: (id: string, date: string): AttendanceWeek => {
    const weeks = LocalDb.getWeeks();
    const index = weeks.findIndex(w => w.id === id);
    if (index === -1) throw new Error('Week not found');
    weeks[index] = {
      ...weeks[index],
      date
    };
    weeks.sort((a, b) => b.date.localeCompare(a.date));
    LocalDb.saveWeeks(weeks);
    return weeks[index];
  },

  updateAttendanceRecord: (id: string, record: Omit<AttendanceRecord, 'id' | 'week_id' | 'player_id' | 'created_at'>): AttendanceRecord => {
    const all = LocalDb.getAttendanceAll();
    const index = all.findIndex(a => a.id === id);
    if (index === -1) throw new Error('Attendance record not found');
    all[index] = {
      ...all[index],
      ...record
    };
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(all));
    return all[index];
  }
};

// ----------------------------------------------------
// DB SERVICE ADAPTER (Supabase with LocalStorage Fallback)
// ----------------------------------------------------
export const DbService = {
  isUsingSupabase: (): boolean => {
    return supabase !== null;
  },

  getSupabaseConfig: (): SupabaseConfig | null => {
    return getSavedConfig();
  },

  saveSupabaseConfig: async (config: SupabaseConfig | null): Promise<boolean> => {
    if (!config || !config.url || !config.anonKey) {
      localStorage.removeItem(CONFIG_KEY);
      supabase = null;
      return true;
    }

    try {
      const client = createClient(config.url, config.anonKey);
      // Verify connection by testing a simple query
      const { error } = await client.from('players').select('count', { count: 'exact', head: true });
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
      supabase = client;
      return true;
    } catch (e) {
      console.error('Connection verification failed', e);
      return false;
    }
  },

  syncLocalToSupabase: async (): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: 'Supabase is not configured' };

    try {
      // 1. Sync Players
      const localPlayers = LocalDb.getPlayers();
      if (localPlayers.length > 0) {
        const { error: pErr } = await supabase.from('players').upsert(
          localPlayers.map(p => ({
            id: p.id,
            name: p.name,
            category: p.category,
            weekly_fee: p.weekly_fee,
            phone: p.phone || '',
            created_at: p.created_at
          }))
        );
        if (pErr) throw new Error('Players sync error: ' + pErr.message);
      }

      // 2. Sync Weeks
      const localWeeks = LocalDb.getWeeks();
      if (localWeeks.length > 0) {
        const { error: wErr } = await supabase.from('attendance_weeks').upsert(
          localWeeks.map(w => ({
            id: w.id,
            date: w.date,
            created_at: w.created_at
          }))
        );
        if (wErr) throw new Error('Weeks sync error: ' + wErr.message);
      }

      // 3. Sync Attendance
      const localAttendance = LocalDb.getAttendanceAll();
      if (localAttendance.length > 0) {
        const { error: aErr } = await supabase.from('attendance').upsert(
          localAttendance.map(a => ({
            id: a.id,
            week_id: a.week_id,
            player_id: a.player_id,
            status: a.status,
            due_amount: a.due_amount,
            paid_amount: a.paid_amount,
            pending_amount: a.pending_amount,
            payment_mode: a.payment_mode,
            cash_amount: a.cash_amount,
            gpay_amount: a.gpay_amount,
            created_at: a.created_at
          }))
        );
        if (aErr) throw new Error('Attendance sync error: ' + aErr.message);
      }

      // 4. Sync Expenses
      const localExpenses = LocalDb.getExpenses();
      if (localExpenses.length > 0) {
        const { error: eErr } = await supabase.from('expenses').upsert(
          localExpenses.map(e => ({
            id: e.id,
            date: e.date,
            item: e.item,
            category: e.category,
            amount: e.amount,
            paid_from: e.paid_from,
            notes: e.notes,
            created_at: e.created_at
          }))
        );
        if (eErr) throw new Error('Expenses sync error: ' + eErr.message);
      }

      // 5. Sync Matches
      const localMatches = LocalDb.getMatches();
      if (localMatches.length > 0) {
        // Upload matches
        const { error: mErr } = await supabase.from('matches').upsert(
          localMatches.map(m => ({
            id: m.id,
            date: m.date,
            opponent: m.opponent,
            ground: m.ground,
            bet_amount: m.bet_amount,
            result: m.result,
            amount_won_lost: m.amount_won_lost,
            settled_via: m.settled_via,
            cash_amount: m.cash_amount,
            gpay_amount: m.gpay_amount,
            notes: m.notes,
            match_number: m.match_number || 'Match 1',
            created_at: m.created_at
          }))
        );
        if (mErr) throw new Error('Matches sync error: ' + mErr.message);

        // Upload match players mapping
        const matchPlayersList: { match_id: string; player_id: string }[] = [];
        localMatches.forEach(m => {
          m.who_played.forEach(pId => {
            matchPlayersList.push({ match_id: m.id, player_id: pId });
          });
        });

        if (matchPlayersList.length > 0) {
          const { error: mpErr } = await supabase.from('match_players').upsert(matchPlayersList);
          if (mpErr) throw new Error('Match players sync error: ' + mpErr.message);
        }
      }

      // 6. Sync Extra Payments
      const localExtra = LocalDb.getExtraPayments();
      if (localExtra.length > 0) {
        const { error: exErr } = await supabase.from('extra_payments').upsert(
          localExtra.map(x => ({
            id: x.id,
            player_id: x.player_id,
            date: x.date,
            amount: x.amount,
            payment_mode: x.payment_mode,
            cash_amount: x.cash_amount,
            gpay_amount: x.gpay_amount,
            notes: x.notes,
            created_at: x.created_at
          }))
        );
        if (exErr) throw new Error('Extra payments sync error: ' + exErr.message);
      }

      return { success: true, message: 'All local data successfully synced to Supabase!' };
    } catch (e: any) {
      console.error('Sync failed', e);
      return { success: false, message: e.message || 'Sync failed due to an unknown error.' };
    }
  },

  // --- Players API ---
  getPlayers: async (): Promise<Player[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('players').select('*').order('name');
      if (error) {
        console.error('Supabase getPlayers error, falling back', error);
        return LocalDb.getPlayers();
      }
      
      // Seed default 16 players if the database players table is empty!
      if (data && data.length === 0) {
        const initial = DEFAULT_PLAYERS_LIST.map(name => ({
          name,
          category: 'Normal',
          weekly_fee: 50
        }));
        const { data: seeded, error: seedErr } = await supabase
          .from('players')
          .insert(initial)
          .select();
        
        if (seedErr) {
          console.error('Failed to seed players into Supabase', seedErr);
          return [];
        }
        return seeded || [];
      }
      
      return data || [];
    }
    return LocalDb.getPlayers();
  },

  addPlayer: async (name: string, category: PlayerCategory, phone?: string): Promise<Player> => {
    if (supabase) {
      const fee = category === 'Normal' ? 50 : 30;
      const { data, error } = await supabase
        .from('players')
        .insert([{ name, category, weekly_fee: fee, phone: phone || '' }])
        .select();
      if (error) {
        console.error('Supabase addPlayer error', error);
        throw error;
      }
      return data[0];
    }
    return LocalDb.addPlayer(name, category, phone);
  },

  updatePlayer: async (id: string, name: string, category: PlayerCategory, phone?: string): Promise<Player> => {
    if (supabase) {
      const fee = category === 'Normal' ? 50 : 30;
      const { data, error } = await supabase
        .from('players')
        .update({ name, category, weekly_fee: fee, phone: phone || '' })
        .eq('id', id)
        .select();
      if (error) {
        console.error('Supabase updatePlayer error', error);
        throw error;
      }
      return data[0];
    }
    return LocalDb.updatePlayer(id, name, category, phone);
  },

  deletePlayer: async (id: string): Promise<void> => {
    if (supabase) {
      const { error } = await supabase.from('players').delete().eq('id', id);
      if (error) {
        console.error('Supabase deletePlayer error', error);
        throw error;
      }
      return;
    }
    LocalDb.deletePlayer(id);
  },

  // --- Weeks API ---
  getWeeks: async (): Promise<AttendanceWeek[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('attendance_weeks').select('*').order('date', { ascending: false });
      if (error) {
        console.error('Supabase getWeeks error, falling back', error);
        return LocalDb.getWeeks();
      }
      return data || [];
    }
    return LocalDb.getWeeks();
  },

  addWeek: async (date: string): Promise<AttendanceWeek> => {
    if (supabase) {
      const { data, error } = await supabase
        .from('attendance_weeks')
        .insert([{ date }])
        .select();
      if (error) {
        console.error('Supabase addWeek error', error);
        throw error;
      }
      return data[0];
    }
    return LocalDb.addWeek(date);
  },

  deleteWeek: async (weekId: string): Promise<void> => {
    if (supabase) {
      const { error } = await supabase.from('attendance_weeks').delete().eq('id', weekId);
      if (error) {
        console.error('Supabase deleteWeek error', error);
        throw error;
      }
      return;
    }
    LocalDb.deleteWeek(weekId);
  },

  updateWeek: async (weekId: string, date: string): Promise<AttendanceWeek> => {
    if (supabase) {
      const { data, error } = await supabase
        .from('attendance_weeks')
        .update({ date })
        .eq('id', weekId)
        .select();
      if (error) {
        console.error('Supabase updateWeek error', error);
        throw error;
      }
      return data[0];
    }
    return LocalDb.updateWeek(weekId, date);
  },

  // --- Attendance API ---
  getAttendance: async (weekId: string): Promise<AttendanceRecord[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('attendance').select('*').eq('week_id', weekId);
      if (error) {
        console.error('Supabase getAttendance error, falling back', error);
        return LocalDb.getAttendance(weekId);
      }
      return data || [];
    }
    return LocalDb.getAttendance(weekId);
  },

  getAttendanceAll: async (): Promise<AttendanceRecord[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('attendance').select('*');
      if (error) {
        console.error('Supabase getAttendanceAll error, falling back', error);
        return LocalDb.getAttendanceAll();
      }
      return data || [];
    }
    return LocalDb.getAttendanceAll();
  },

  saveAttendance: async (weekId: string, records: Omit<AttendanceRecord, 'id' | 'week_id' | 'created_at'>[]): Promise<void> => {
    if (supabase) {
      // Supabase supports upserts. We'll delete existing entries and insert new ones to be sure, or just upsert if we have primary keys.
      // To keep it simple and robust, let's delete existing attendance for the week and insert new ones in a transaction-like way.
      const { error: delErr } = await supabase.from('attendance').delete().eq('week_id', weekId);
      if (delErr) {
        console.error('Supabase clear attendance error', delErr);
        throw delErr;
      }
      
      if (records.length === 0) return;

      const { error: insErr } = await supabase.from('attendance').insert(
        records.map(r => ({
          week_id: weekId,
          player_id: r.player_id,
          status: r.status,
          due_amount: r.due_amount,
          paid_amount: r.paid_amount,
          pending_amount: r.pending_amount,
          payment_mode: r.payment_mode,
          cash_amount: r.cash_amount,
          gpay_amount: r.gpay_amount
        }))
      );
      if (insErr) {
        console.error('Supabase insert attendance error', insErr);
        throw insErr;
      }
      return;
    }
    LocalDb.saveAttendance(weekId, records);
  },

  updateAttendanceRecord: async (id: string, record: Omit<AttendanceRecord, 'id' | 'week_id' | 'player_id' | 'created_at'>): Promise<AttendanceRecord> => {
    if (supabase) {
      const { data, error } = await supabase
        .from('attendance')
        .update(record)
        .eq('id', id)
        .select();
      if (error) {
        console.error('Supabase updateAttendanceRecord error', error);
        throw error;
      }
      return data[0];
    }
    return LocalDb.updateAttendanceRecord(id, record);
  },

  // --- Expenses API ---
  getExpenses: async (): Promise<Expense[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
      if (error) {
        console.error('Supabase getExpenses error, falling back', error);
        return LocalDb.getExpenses();
      }
      return data || [];
    }
    return LocalDb.getExpenses();
  },

  addExpense: async (expense: Omit<Expense, 'id' | 'created_at'>): Promise<Expense> => {
    if (supabase) {
      const { data, error } = await supabase
        .from('expenses')
        .insert([expense])
        .select();
      if (error) {
        console.error('Supabase addExpense error', error);
        throw error;
      }
      return data[0];
    }
    return LocalDb.addExpense(expense);
  },

  deleteExpense: async (id: string): Promise<void> => {
    if (supabase) {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) {
        console.error('Supabase deleteExpense error', error);
        throw error;
      }
      return;
    }
    LocalDb.deleteExpense(id);
  },

  updateExpense: async (id: string, expense: Omit<Expense, 'id' | 'created_at'>): Promise<Expense> => {
    if (supabase) {
      const { data, error } = await supabase
        .from('expenses')
        .update(expense)
        .eq('id', id)
        .select();
      if (error) {
        console.error('Supabase updateExpense error', error);
        throw error;
      }
      return data[0];
    }
    return LocalDb.updateExpense(id, expense);
  },

  // --- Matches API ---
  getMatches: async (): Promise<Match[]> => {
    if (supabase) {
      // Since who_played is in match_players table, we need to do a join
      const { data: mData, error: mErr } = await supabase.from('matches').select('*').order('date', { ascending: false });
      if (mErr) {
        console.error('Supabase getMatches error, falling back', mErr);
        return LocalDb.getMatches();
      }
      
      if (!mData || mData.length === 0) return [];

      const { data: mpData, error: mpErr } = await supabase.from('match_players').select('*');
      if (mpErr) {
        console.error('Supabase getMatchPlayers error, falling back', mpErr);
        return LocalDb.getMatches();
      }

      const formatted = mData.map(m => {
        const players = mpData
          .filter(mp => mp.match_id === m.id)
          .map(mp => mp.player_id);
        return {
          ...m,
          who_played: players
        };
      });

      return formatted.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return (a.match_number || 'Match 1').localeCompare(b.match_number || 'Match 1');
      });
    }
    return LocalDb.getMatches();
  },

  addMatch: async (match: Omit<Match, 'id' | 'created_at'>): Promise<Match> => {
    if (supabase) {
      const { data: mData, error: mErr } = await supabase
        .from('matches')
        .insert([{
          date: match.date,
          opponent: match.opponent,
          ground: match.ground,
          bet_amount: match.bet_amount,
          result: match.result,
          amount_won_lost: match.amount_won_lost,
          settled_via: match.settled_via,
          cash_amount: match.cash_amount,
          gpay_amount: match.gpay_amount,
          notes: match.notes,
          match_number: match.match_number || 'Match 1'
        }])
        .select();

      if (mErr) {
        console.error('Supabase addMatch error', mErr);
        throw mErr;
      }

      const newMatch = mData[0];

      // Add match players mapping
      if (match.who_played.length > 0) {
        const { error: mpErr } = await supabase.from('match_players').insert(
          match.who_played.map(player_id => ({
            match_id: newMatch.id,
            player_id
          }))
        );
        if (mpErr) {
          console.error('Supabase addMatchPlayers error', mpErr);
          throw mpErr;
        }
      }

      return {
        ...newMatch,
        who_played: match.who_played
      };
    }
    return LocalDb.addMatch(match);
  },

  deleteMatch: async (id: string): Promise<void> => {
    if (supabase) {
      const { error } = await supabase.from('matches').delete().eq('id', id);
      if (error) {
        console.error('Supabase deleteMatch error', error);
        throw error;
      }
      return;
    }
    LocalDb.deleteMatch(id);
  },

  updateMatch: async (id: string, match: Omit<Match, 'id' | 'created_at'>): Promise<Match> => {
    if (supabase) {
      const { data: mData, error: mErr } = await supabase
        .from('matches')
        .update({
          date: match.date,
          opponent: match.opponent,
          ground: match.ground,
          bet_amount: match.bet_amount,
          result: match.result,
          amount_won_lost: match.amount_won_lost,
          settled_via: match.settled_via,
          cash_amount: match.cash_amount,
          gpay_amount: match.gpay_amount,
          notes: match.notes,
          match_number: match.match_number || 'Match 1'
        })
        .eq('id', id)
        .select();
      if (mErr) {
        console.error('Supabase updateMatch error', mErr);
        throw mErr;
      }
      
      // Update match players mapping
      const { error: delErr } = await supabase.from('match_players').delete().eq('match_id', id);
      if (delErr) {
        console.error('Supabase delete match_players error', delErr);
        throw delErr;
      }
      if (match.who_played.length > 0) {
        const { error: insErr } = await supabase.from('match_players').insert(
          match.who_played.map(player_id => ({
            match_id: id,
            player_id
          }))
        );
        if (insErr) {
          console.error('Supabase insert match_players error', insErr);
          throw insErr;
        }
      }
      
      return {
        ...mData[0],
        who_played: match.who_played
      };
    }
    return LocalDb.updateMatch(id, match);
  },

  // --- Extra Payments API ---
  getExtraPayments: async (): Promise<ExtraPayment[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('extra_payments').select('*').order('date', { ascending: false });
      if (error) {
        console.error('Supabase getExtraPayments error, falling back', error);
        return LocalDb.getExtraPayments();
      }
      return data || [];
    }
    return LocalDb.getExtraPayments();
  },

  addExtraPayment: async (payment: Omit<ExtraPayment, 'id' | 'created_at'>): Promise<ExtraPayment> => {
    if (supabase) {
      const { data, error } = await supabase
        .from('extra_payments')
        .insert([payment])
        .select();
      if (error) {
        console.error('Supabase addExtraPayment error', error);
        throw error;
      }
      return data[0];
    }
    return LocalDb.addExtraPayment(payment);
  },

  deleteExtraPayment: async (id: string): Promise<void> => {
    if (supabase) {
      const { error } = await supabase.from('extra_payments').delete().eq('id', id);
      if (error) {
        console.error('Supabase deleteExtraPayment error', error);
        throw error;
      }
      return;
    }
    LocalDb.deleteExtraPayment(id);
  },

  updateExtraPayment: async (id: string, payment: Omit<ExtraPayment, 'id' | 'created_at'>): Promise<ExtraPayment> => {
    if (supabase) {
      const { data, error } = await supabase
        .from('extra_payments')
        .update(payment)
        .eq('id', id)
        .select();
      if (error) {
        console.error('Supabase updateExtraPayment error', error);
        throw error;
      }
      return data[0];
    }
    return LocalDb.updateExtraPayment(id, payment);
  }
};

// ----------------------------------------------------
// WALLET BALANCE CALCULATOR FUNCTION
// ----------------------------------------------------
export function calculateBalances(
  attendance: AttendanceRecord[],
  expenses: Expense[],
  matches: Match[],
  extraPayments: ExtraPayment[]
): WalletBalances {
  let cash = 0;
  let gpay = 0;
  let pending = 0;

  // 1. Dues from attendance (for weeks marked)
  // Each attendance record indicates present/absent and payments
  attendance.forEach(rec => {
    if (rec.payment_mode === 'Cash') {
      cash += rec.paid_amount;
    } else if (rec.payment_mode === 'GPay') {
      gpay += rec.paid_amount;
    } else if (rec.payment_mode === 'Both') {
      cash += rec.cash_amount;
      gpay += rec.gpay_amount;
    }

    if (rec.status === 'Present') {
      pending += rec.pending_amount;
    }
  });

  // 2. Extra payments reduces pending amount and increases cash/gpay
  extraPayments.forEach(rec => {
    if (rec.payment_mode === 'Cash') {
      cash += rec.amount;
    } else if (rec.payment_mode === 'GPay') {
      gpay += rec.amount;
    } else if (rec.payment_mode === 'Both') {
      cash += rec.cash_amount;
      gpay += rec.gpay_amount;
    }
    pending -= rec.amount;
  });

  // 3. Expenses deduction
  expenses.forEach(exp => {
    if (exp.paid_from === 'Cash') {
      cash -= exp.amount;
    } else if (exp.paid_from === 'GPay') {
      gpay -= exp.amount;
    }
  });

  // 4. Match betting settling
  matches.forEach(match => {
    if (match.settled_via === 'Cash') {
      cash += match.amount_won_lost; // Positive for Win, Negative for Loss
    } else if (match.settled_via === 'GPay') {
      gpay += match.amount_won_lost;
    } else if (match.settled_via === 'Both') {
      cash += match.cash_amount;
      gpay += match.gpay_amount;
    }
  });

  return {
    cash,
    gpay,
    total: cash + gpay,
    pending: Math.max(0, pending)
  };
}

// ----------------------------------------------------
// PLAYER BALANCE CALCULATOR
// Returns total paid, total pending, attendance rate for a single player
// ----------------------------------------------------
export function calculatePlayerStats(
  playerId: string,
  weeks: AttendanceWeek[],
  attendance: AttendanceRecord[],
  extraPayments: ExtraPayment[],
  matches: Match[]
) {
  const playerAttendance = attendance.filter(a => a.player_id === playerId);
  const playerExtraPayments = extraPayments.filter(p => p.player_id === playerId);
  const matchesPlayed = matches.filter(m => m.who_played.includes(playerId));

  let totalDue = 0;
  let totalPaid = 0;
  let totalWeeksPresent = 0;
  let totalWeeksMarked = playerAttendance.length;

  playerAttendance.forEach(rec => {
    if (rec.status === 'Present') {
      totalDue += rec.due_amount;
      totalWeeksPresent++;
    }
    totalPaid += rec.paid_amount;
  });

  const totalExtraPaid = playerExtraPayments.reduce((sum, p) => sum + p.amount, 0);
  const netPaid = totalPaid + totalExtraPaid;
  const netPending = Math.max(0, totalDue - netPaid);

  const attendancePercent = totalWeeksMarked > 0 
    ? Math.round((totalWeeksPresent / totalWeeksMarked) * 100) 
    : 0;

  // Determine last payment date
  let lastPaymentDate = '';
  const paymentsDates: string[] = [];
  
  playerAttendance.forEach(rec => {
    if (rec.paid_amount > 0) {
      // Find week date
      const week = weeks.find(w => w.id === rec.week_id);
      if (week) paymentsDates.push(week.date);
    }
  });
  
  playerExtraPayments.forEach(p => {
    if (p.amount > 0) {
      paymentsDates.push(p.date);
    }
  });

  if (paymentsDates.length > 0) {
    paymentsDates.sort((a, b) => b.localeCompare(a));
    lastPaymentDate = paymentsDates[0];
  }

  return {
    totalPaid: netPaid,
    totalPending: netPending,
    attendancePercent,
    lastPaymentDate,
    matchesPlayedCount: matchesPlayed.length,
    weeksPresent: totalWeeksPresent,
    weeksMarked: totalWeeksMarked
  };
}
