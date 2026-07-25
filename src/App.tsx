import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, CalendarCheck2, History, Award, AlertTriangle, 
  BarChart3, MoreHorizontal, RefreshCw, Receipt, LogOut, Lock, User, Eye, EyeOff
} from 'lucide-react';
import { DbService, calculateBalances } from './services/db';
import { 
  Player, PlayerCategory, AttendanceWeek, AttendanceRecord, 
  Expense, Match, ExtraPayment, WalletBalances
} from './types';

// Tab screens
import Dashboard from './components/Dashboard';
import Players from './components/Players';
import Attendance from './components/Attendance';
import MoneyHistory from './components/MoneyHistory';
import Matches from './components/Matches';
import Pending from './components/Pending';
import Reports from './components/Reports';
import Expenses from './components/Expenses';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [splashFade, setSplashFade] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('isLoggedIn_11parkerz') === 'true';
  });
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim().toLowerCase() === '11parkerz' && passwordInput === 'Parkerz@11') {
      localStorage.setItem('isLoggedIn_11parkerz', 'true');
      setIsLoggedIn(true);
      setLoginError('');
      showToast('Successfully logged in!', 'success');
    } else {
      setLoginError('Invalid Username or Password. Please try again.');
      showToast('Login failed', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn_11parkerz');
    setIsLoggedIn(false);
    setUsernameInput('');
    setPasswordInput('');
    showToast('Logged out successfully', 'info');
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setSplashFade(true);
    }, 2300);
    const removeTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2800);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);
  
  // App-wide collections
  const [players, setPlayers] = useState<Player[]>([]);
  const [weeks, setWeeks] = useState<AttendanceWeek[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [extraPayments, setExtraPayments] = useState<ExtraPayment[]>([]);
  
  const [loading, setLoading] = useState(true);

  // Load all records from database layer
  const loadData = async () => {
    try {
      const [p, w, a, e, m, ep] = await Promise.all([
        DbService.getPlayers(),
        DbService.getWeeks(),
        DbService.getAttendanceAll(),
        DbService.getExpenses(),
        DbService.getMatches(),
        DbService.getExtraPayments()
      ]);
      setPlayers(p);
      setWeeks(w);
      setAttendance(a);
      setExpenses(e);
      setMatches(m);
      setExtraPayments(ep);
    } catch (err) {
      console.error('Error loading application records', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute stats reactively
  const balances: WalletBalances = calculateBalances(attendance, expenses, matches, extraPayments);
  
  // Calculate latest week details for dashboard stats
  const latestWeek = weeks[0] || null;
  const latestWeekDate = latestWeek ? latestWeek.date : '';
  const latestWeekRecords = latestWeek ? attendance.filter(a => a.week_id === latestWeek.id) : [];
  const latestWeekPresentCount = latestWeekRecords.filter(a => a.status === 'Present').length;
  const latestWeekCollected = latestWeekRecords.reduce((sum, a) => sum + a.paid_amount, 0);

  // Wrappers to modify state and sync to DB
  const handleAddPlayer = async (name: string, category: PlayerCategory, phone?: string) => {
    await DbService.addPlayer(name, category, phone);
    await loadData();
  };

  const handleUpdatePlayer = async (id: string, name: string, category: PlayerCategory, phone?: string) => {
    await DbService.updatePlayer(id, name, category, phone);
    await loadData();
  };

  const handleDeletePlayer = async (id: string) => {
    await DbService.deletePlayer(id);
    await loadData();
  };

  const handleAddWeek = async (date: string) => {
    const res = await DbService.addWeek(date);
    await loadData();
    return res;
  };

  const handleDeleteWeek = async (weekId: string) => {
    await DbService.deleteWeek(weekId);
    await loadData();
  };

  const handleSaveAttendance = async (weekId: string, records: Omit<AttendanceRecord, 'id' | 'week_id' | 'created_at'>[]) => {
    await DbService.saveAttendance(weekId, records);
    await loadData();
  };

  const handleAddExpense = async (expense: Omit<Expense, 'id' | 'created_at'>) => {
    await DbService.addExpense(expense);
    await loadData();
  };

  const handleDeleteExpense = async (id: string) => {
    await DbService.deleteExpense(id);
    await loadData();
  };

  const handleAddMatch = async (match: Omit<Match, 'id' | 'created_at'>) => {
    await DbService.addMatch(match);
    await loadData();
  };

  const handleDeleteMatch = async (id: string) => {
    await DbService.deleteMatch(id);
    await loadData();
  };

  const handleAddExtraPayment = async (payment: Omit<ExtraPayment, 'id' | 'created_at'>) => {
    await DbService.addExtraPayment(payment);
    await loadData();
  };

  const handleDeleteExtraPayment = async (id: string) => {
    await DbService.deleteExtraPayment(id);
    await loadData();
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Nav list definitions
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'players', label: 'Players', icon: Users },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck2 },
    { id: 'money', label: 'Money Ledger', icon: History },
    { id: 'matches', label: 'Matches Book', icon: Award },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'pending', label: 'Dues & Pending', icon: AlertTriangle },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: '16px',
        color: 'var(--text-secondary)',
        background: '#040a14'
      }}>
        <RefreshCw size={40} className="animate-spin" style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
        <h3>Loading 11 Parkerz...</h3>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!showSplash && !isLoggedIn) {
    return (
      <div className="login-overlay">
        <div className="glass-panel login-card">
          <div className="login-header">
            <img src="/logo.jpeg" alt="11 Parkerz Logo" className="login-logo" />
            <h2 style={{ fontSize: '1.8rem', marginBottom: '6px' }}>11 Parkerz</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sign in to access control panel</p>
          </div>

          <form onSubmit={handleLoginSubmit}>
            {loginError && (
              <div className="login-error">
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{loginError}</span>
              </div>
            )}

            <div className="login-form-group">
              <label className="login-label" htmlFor="username">Username</label>
              <div className="login-input-wrapper">
                <User size={16} className="login-input-icon" />
                <input
                  type="text"
                  id="username"
                  className="login-input"
                  placeholder="Enter username"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="login-form-group">
              <label className="login-label" htmlFor="password">Password</label>
              <div className="login-input-wrapper">
                <Lock size={16} className="login-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  className="login-input"
                  placeholder="Enter password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="login-input-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '8px', padding: '14px' }}
            >
              Sign In
            </button>
          </form>
        </div>

        {/* Toast Notification HUD */}
        {toast && (
          <div className="toast-container">
            <div className={`toast toast-${toast.type}`} style={{
              borderLeft: `4px solid ${
                toast.type === 'success' ? 'var(--secondary)' : 
                toast.type === 'error' ? 'var(--accent)' : 'rgba(255,255,255,0.3)'
              }`
            }}>
              {toast.message}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
      
      {/* Splash Screen Opening Animation */}
      {showSplash && (
        <div className={`splash-screen ${splashFade ? 'fade-out' : ''}`}>
          <div className="splash-logo-container">
            <img src="/logo.jpeg" alt="11 Parkerz Logo" className="splash-logo" />
            <h1 className="splash-title">11 Parkerz</h1>
            <div className="splash-loader">
              <div className="splash-loader-bar"></div>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner / Navbar */}
      <header className="glass-panel" style={{
        margin: '16px 16px 0 16px',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        zIndex: 50
      }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo.jpeg" alt="Logo" style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--secondary)', boxShadow: '0 0 10px var(--secondary-glow)' }} />
            <span style={{ color: 'var(--text-primary)' }}>11 Parkerz</span>
          </h1>
        </div>

        {/* Small Horizontal Stats scroll box on mobile, row on desktop */}
        <div className="scroll-stats" style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          overflowX: 'auto',
          maxWidth: '100%',
          paddingBottom: '2px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>CASH:</span>
            <span style={{ fontWeight: '700', color: 'var(--primary)' }}>{formatCurrency(balances.cash)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>GPAY:</span>
            <span style={{ fontWeight: '700', color: 'var(--secondary)' }}>{formatCurrency(balances.gpay)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>TOTAL:</span>
            <span style={{ fontWeight: '700', color: '#a78bfa' }}>{formatCurrency(balances.total)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>PENDING:</span>
            <span style={{ fontWeight: '700', color: 'var(--accent)' }}>{formatCurrency(balances.pending)}</span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="btn btn-secondary"
          style={{
            padding: '8px 16px',
            fontSize: '0.85rem',
            gap: '6px',
            border: '1px solid rgba(225, 29, 72, 0.3)',
            color: '#fb7185',
            display: 'flex',
            alignItems: 'center',
            height: '38px',
            borderRadius: 'var(--border-radius-sm)'
          }}
          title="Sign Out"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </header>

      {/* Main Layout Area */}
      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        
        {/* SIDE BAR NAVIGATION - Desktop Only */}
        <aside className="sidebar-nav" style={{
          width: '260px',
          padding: '24px 16px',
          display: 'none', // Overridden in media queries
          flexDirection: 'column',
          gap: '8px'
        }}>
          {navItems.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button 
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  justifyContent: 'flex-start',
                  padding: '12px 16px',
                  width: '100%',
                  background: active ? 'var(--primary)' : 'transparent',
                  color: active ? 'white' : 'var(--text-secondary)',
                  border: active ? 'none' : '1px solid transparent'
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </aside>

        {/* SCREEN CONTENT PANEL */}
        <main style={{
          flex: 1,
          padding: '16px',
          paddingBottom: '80px', // spacing for mobile bottom navigation bar
          width: '100%',
          overflowX: 'hidden'
        }}>
          {activeTab === 'dashboard' && (
            <Dashboard 
              balances={balances}
              players={players}
              latestWeekDate={latestWeekDate}
              latestWeekPresentCount={latestWeekPresentCount}
              latestWeekCollected={latestWeekCollected}
              onNavigate={setActiveTab}
              onAddPlayer={handleAddPlayer}
              onAddExpense={handleAddExpense}
              onAddMatch={handleAddMatch}
              onAddExtraPayment={handleAddExtraPayment}
              showToast={showToast}
            />
          )}

          {activeTab === 'players' && (
            <Players 
              players={players}
              weeks={weeks}
              attendance={attendance}
              extraPayments={extraPayments}
              matches={matches}
              onUpdatePlayer={handleUpdatePlayer}
              onDeletePlayer={handleDeletePlayer}
              showToast={showToast}
            />
          )}

          {activeTab === 'attendance' && (
            <Attendance 
              players={players}
              weeks={weeks}
              attendance={attendance}
              onAddWeek={handleAddWeek}
              onDeleteWeek={handleDeleteWeek}
              onSaveAttendance={handleSaveAttendance}
              showToast={showToast}
            />
          )}

          {activeTab === 'money' && (
            <MoneyHistory 
              players={players}
              weeks={weeks}
              attendance={attendance}
              expenses={expenses}
              matches={matches}
              extraPayments={extraPayments}
              onDeleteExpense={handleDeleteExpense}
              onDeleteMatch={handleDeleteMatch}
              onDeleteExtraPayment={handleDeleteExtraPayment}
              showToast={showToast}
            />
          )}

          {activeTab === 'matches' && (
            <Matches 
              players={players}
              matches={matches}
              onAddMatch={handleAddMatch}
              onDeleteMatch={handleDeleteMatch}
              onAddPlayer={handleAddPlayer}
              showToast={showToast}
            />
          )}

          {activeTab === 'expenses' && (
            <Expenses 
              expenses={expenses}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
              showToast={showToast}
            />
          )}

          {activeTab === 'pending' && (
            <Pending 
              players={players}
              weeks={weeks}
              attendance={attendance}
              extraPayments={extraPayments}
              matches={matches}
              onAddExtraPayment={handleAddExtraPayment}
              showToast={showToast}
            />
          )}

          {activeTab === 'reports' && (
            <Reports 
              players={players}
              weeks={weeks}
              attendance={attendance}
              expenses={expenses}
              matches={matches}
              extraPayments={extraPayments}
            />
          )}


        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="mobile-bottom-nav" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: 'rgba(10, 15, 29, 0.95)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 900
      }}>
        {navItems.slice(0, 5).map(item => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: active ? 'var(--primary)' : 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                width: '60px',
                height: '100%',
                fontSize: '0.65rem'
              }}
            >
              <Icon size={20} />
              <span style={{ fontWeight: active ? '600' : '400' }}>
                {item.id === 'dashboard' ? 'Dash' : item.id === 'attendance' ? 'Att' : item.id === 'money' ? 'Ledger' : item.label.split(' ')[0]}
              </span>
            </button>
          );
        })}

        {/* More button to toggle others */}
        <button
          onClick={() => {
            // Cycle between expenses -> pending -> reports
            if (activeTab === 'expenses') setActiveTab('pending');
            else if (activeTab === 'pending') setActiveTab('reports');
            else setActiveTab('expenses');
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: ['expenses', 'pending', 'reports'].includes(activeTab) ? 'var(--primary)' : 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            width: '60px',
            height: '100%',
            fontSize: '0.65rem'
          }}
        >
          <MoreHorizontal size={20} />
          <span style={{ fontWeight: ['expenses', 'pending', 'reports'].includes(activeTab) ? '600' : '400' }}>
            {activeTab === 'expenses' ? 'Exp' : activeTab === 'pending' ? 'Dues' : activeTab === 'reports' ? 'Reports' : 'More'}
          </span>
        </button>
      </nav>

      {/* Media query styling in JS style block */}
      <style>{`
        @media (min-width: 900px) {
          .sidebar-nav {
            display: flex !important;
          }
          .mobile-bottom-nav {
            display: none !important;
          }
          main {
            padding-bottom: 24px !important;
          }
        }
      `}</style>

      {/* Toast Notification HUD */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`} style={{
            borderLeft: `4px solid ${
              toast.type === 'success' ? 'var(--secondary)' : 
              toast.type === 'error' ? 'var(--accent)' : 'rgba(255,255,255,0.3)'
            }`
          }}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
