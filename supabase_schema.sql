-- Supabase DB Schema for 11 ParkerZ - CM Calcy

-- 1. PLAYERS TABLE
CREATE TABLE IF NOT EXISTS public.players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN ('Bike', 'School', 'Normal')),
    weekly_fee NUMERIC NOT NULL DEFAULT 50,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Comment to explain weekly_fee defaults: Bike=30, School=30, Normal=50
COMMENT ON COLUMN public.players.category IS 'Bike (30), School (30), Normal (50)';

-- 2. ATTENDANCE WEEKS TABLE (Tracks Sundays/sessions)
CREATE TABLE IF NOT EXISTS public.attendance_weeks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ATTENDANCE RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_id UUID NOT NULL REFERENCES public.attendance_weeks(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent')),
    due_amount NUMERIC NOT NULL DEFAULT 0,
    paid_amount NUMERIC NOT NULL DEFAULT 0,
    pending_amount NUMERIC NOT NULL DEFAULT 0,
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('Cash', 'GPay', 'Both', 'None')),
    cash_amount NUMERIC NOT NULL DEFAULT 0,
    gpay_amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (week_id, player_id)
);

-- 4. EXPENSES TABLE
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    item TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Bat', 'Ball', 'Tape', 'Stumps', 'Ground', 'Jersey', 'Food', 'Other')),
    amount NUMERIC NOT NULL DEFAULT 0,
    paid_from TEXT NOT NULL CHECK (paid_from IN ('Cash', 'GPay')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. MATCHES TABLE
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    opponent TEXT NOT NULL,
    ground TEXT NOT NULL,
    bet_amount NUMERIC NOT NULL DEFAULT 0,
    result TEXT NOT NULL CHECK (result IN ('Win', 'Loss')),
    amount_won_lost NUMERIC NOT NULL DEFAULT 0, -- Positive for win, negative for loss
    settled_via TEXT NOT NULL CHECK (settled_via IN ('Cash', 'GPay', 'Both')),
    cash_amount NUMERIC NOT NULL DEFAULT 0,
    gpay_amount NUMERIC NOT NULL DEFAULT 0,
    notes TEXT,
    match_number TEXT DEFAULT 'Match 1',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. MATCH PLAYERS (Many-to-Many relationship between matches and players)
CREATE TABLE IF NOT EXISTS public.match_players (
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    PRIMARY KEY (match_id, player_id)
);

-- 7. EXTRA PAYMENTS TABLE (For recording payments that clear dues directly)
CREATE TABLE IF NOT EXISTS public.extra_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('Cash', 'GPay', 'Both')),
    cash_amount NUMERIC NOT NULL DEFAULT 0,
    gpay_amount NUMERIC NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extra_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent errors on re-running
DROP POLICY IF EXISTS "Allow anon select on players" ON public.players;
DROP POLICY IF EXISTS "Allow anon insert on players" ON public.players;
DROP POLICY IF EXISTS "Allow anon update on players" ON public.players;
DROP POLICY IF EXISTS "Allow anon delete on players" ON public.players;

DROP POLICY IF EXISTS "Allow anon select on attendance_weeks" ON public.attendance_weeks;
DROP POLICY IF EXISTS "Allow anon insert on attendance_weeks" ON public.attendance_weeks;
DROP POLICY IF EXISTS "Allow anon update on attendance_weeks" ON public.attendance_weeks;
DROP POLICY IF EXISTS "Allow anon delete on attendance_weeks" ON public.attendance_weeks;

DROP POLICY IF EXISTS "Allow anon select on attendance" ON public.attendance;
DROP POLICY IF EXISTS "Allow anon insert on attendance" ON public.attendance;
DROP POLICY IF EXISTS "Allow anon update on attendance" ON public.attendance;
DROP POLICY IF EXISTS "Allow anon delete on attendance" ON public.attendance;

DROP POLICY IF EXISTS "Allow anon select on expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow anon insert on expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow anon update on expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow anon delete on expenses" ON public.expenses;

DROP POLICY IF EXISTS "Allow anon select on matches" ON public.matches;
DROP POLICY IF EXISTS "Allow anon insert on matches" ON public.matches;
DROP POLICY IF EXISTS "Allow anon update on matches" ON public.matches;
DROP POLICY IF EXISTS "Allow anon delete on matches" ON public.matches;

DROP POLICY IF EXISTS "Allow anon select on match_players" ON public.match_players;
DROP POLICY IF EXISTS "Allow anon insert on match_players" ON public.match_players;
DROP POLICY IF EXISTS "Allow anon update on match_players" ON public.match_players;
DROP POLICY IF EXISTS "Allow anon delete on match_players" ON public.match_players;

DROP POLICY IF EXISTS "Allow anon select on extra_payments" ON public.extra_payments;
DROP POLICY IF EXISTS "Allow anon insert on extra_payments" ON public.extra_payments;
DROP POLICY IF EXISTS "Allow anon update on extra_payments" ON public.extra_payments;
DROP POLICY IF EXISTS "Allow anon delete on extra_payments" ON public.extra_payments;

-- Create Open RLS Policies for Anon Key (read and write allowed)
-- Note: In a production environment with sensitive team auth, restrict these policies
CREATE POLICY "Allow anon select on players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Allow anon insert on players" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update on players" ON public.players FOR UPDATE USING (true);
CREATE POLICY "Allow anon delete on players" ON public.players FOR DELETE USING (true);

CREATE POLICY "Allow anon select on attendance_weeks" ON public.attendance_weeks FOR SELECT USING (true);
CREATE POLICY "Allow anon insert on attendance_weeks" ON public.attendance_weeks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update on attendance_weeks" ON public.attendance_weeks FOR UPDATE USING (true);
CREATE POLICY "Allow anon delete on attendance_weeks" ON public.attendance_weeks FOR DELETE USING (true);

CREATE POLICY "Allow anon select on attendance" ON public.attendance FOR SELECT USING (true);
CREATE POLICY "Allow anon insert on attendance" ON public.attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update on attendance" ON public.attendance FOR UPDATE USING (true);
CREATE POLICY "Allow anon delete on attendance" ON public.attendance FOR DELETE USING (true);

CREATE POLICY "Allow anon select on expenses" ON public.expenses FOR SELECT USING (true);
CREATE POLICY "Allow anon insert on expenses" ON public.expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update on expenses" ON public.expenses FOR UPDATE USING (true);
CREATE POLICY "Allow anon delete on expenses" ON public.expenses FOR DELETE USING (true);

CREATE POLICY "Allow anon select on matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Allow anon insert on matches" ON public.matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update on matches" ON public.matches FOR UPDATE USING (true);
CREATE POLICY "Allow anon delete on matches" ON public.matches FOR DELETE USING (true);

CREATE POLICY "Allow anon select on match_players" ON public.match_players FOR SELECT USING (true);
CREATE POLICY "Allow anon insert on match_players" ON public.match_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update on match_players" ON public.match_players FOR UPDATE USING (true);
CREATE POLICY "Allow anon delete on match_players" ON public.match_players FOR DELETE USING (true);

CREATE POLICY "Allow anon select on extra_payments" ON public.extra_payments FOR SELECT USING (true);
CREATE POLICY "Allow anon insert on extra_payments" ON public.extra_payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update on extra_payments" ON public.extra_payments FOR UPDATE USING (true);
CREATE POLICY "Allow anon delete on extra_payments" ON public.extra_payments FOR DELETE USING (true);
