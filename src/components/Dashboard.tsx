import { useState } from 'react';
import { 
  DollarSign, TrendingUp, Users, Calendar, AlertCircle, PlusCircle, 
  ArrowRightCircle, PiggyBank, Plus, X, Award
} from 'lucide-react';
import { Player, PlayerCategory, ExpenseCategory, MatchResult, SettlementMode, WalletBalances } from '../types';

interface DashboardProps {
  balances: WalletBalances;
  players: Player[];
  latestWeekDate: string;
  latestWeekPresentCount: number;
  latestWeekCollected: number;
  onNavigate: (tab: string) => void;
  onAddPlayer: (name: string, category: PlayerCategory, phone?: string) => Promise<void>;
  onAddExpense: (expense: { date: string; item: string; category: ExpenseCategory; amount: number; paid_from: 'Cash' | 'GPay'; notes?: string }) => Promise<void>;
  onAddMatch: (match: { date: string; opponent: string; ground: string; bet_amount: number; result: MatchResult; amount_won_lost: number; settled_via: SettlementMode; cash_amount: number; gpay_amount: number; who_played: string[]; notes?: string; match_number?: string }) => Promise<void>;
  onAddExtraPayment: (payment: { player_id: string; date: string; amount: number; payment_mode: 'Cash' | 'GPay' | 'Both'; cash_amount: number; gpay_amount: number; notes?: string }) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function Dashboard({
  balances,
  players,
  latestWeekDate,
  latestWeekPresentCount,
  latestWeekCollected,
  onNavigate,
  onAddPlayer,
  onAddExpense,
  onAddMatch,
  onAddExtraPayment,
  showToast
}: DashboardProps) {
  // Modal states
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);

  // Form states
  const [playerName, setPlayerName] = useState('');
  const [playerPhone, setPlayerPhone] = useState('');
  const [playerCategory, setPlayerCategory] = useState<PlayerCategory>('Normal');

  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseItem, setExpenseItem] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('Ball');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseWallet, setExpenseWallet] = useState<'Cash' | 'GPay'>('Cash');
  const [expenseNotes, setExpenseNotes] = useState('');

  const [matchDate, setMatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [matchOpponent, setMatchOpponent] = useState('');
  const [matchGround, setMatchGround] = useState('');
  const [matchBet, setMatchBet] = useState('');
  const [matchResult, setMatchResult] = useState<MatchResult>('Win');
  const [matchSettledVia, setMatchSettledVia] = useState<SettlementMode>('GPay');
  const [matchCashSplit, setMatchCashSplit] = useState('');
  const [matchGpaySplit, setMatchGpaySplit] = useState('');
  const [matchWhoPlayed, setMatchWhoPlayed] = useState<string[]>([]);
  const [matchNotes, setMatchNotes] = useState('');
  const [matchNumber, setMatchNumber] = useState('Match 1');

  const [paymentPlayerId, setPaymentPlayerId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'GPay' | 'Both'>('GPay');
  const [paymentCashAmount, setPaymentCashAmount] = useState('');
  const [paymentGpayAmount, setPaymentGpayAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Form Submission Handlers
  const handleAddPlayerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    try {
      await onAddPlayer(playerName.trim(), playerCategory, playerPhone.trim());
      showToast(`Player "${playerName.trim()}" added successfully!`);
      setPlayerName('');
      setPlayerPhone('');
      setShowAddPlayer(false);
    } catch (err: any) {
      showToast(err.message || 'Error adding player', 'error');
    }
  };

  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseItem.trim() || !expenseAmount) return;
    try {
      await onAddExpense({
        date: expenseDate,
        item: expenseItem.trim(),
        category: expenseCategory,
        amount: parseFloat(expenseAmount),
        paid_from: expenseWallet,
        notes: expenseNotes.trim()
      });
      showToast(`Expense of ₹${expenseAmount} for "${expenseItem.trim()}" added!`);
      setExpenseItem('');
      setExpenseAmount('');
      setExpenseNotes('');
      setShowAddExpense(false);
    } catch (err: any) {
      showToast(err.message || 'Error adding expense', 'error');
    }
  };

  const handleAddMatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchOpponent.trim() || !matchBet) return;
    
    const bet = parseFloat(matchBet);
    let winLossAmount = matchResult === 'Win' ? bet : -bet;
    
    let cashAmt = 0;
    let gpayAmt = 0;

    if (matchSettledVia === 'Cash') {
      cashAmt = winLossAmount;
    } else if (matchSettledVia === 'GPay') {
      gpayAmt = winLossAmount;
    } else {
      const cashS = parseFloat(matchCashSplit) || 0;
      const gpayS = parseFloat(matchGpaySplit) || 0;
      if (Math.abs(cashS + gpayS) !== bet) {
        showToast('Sum of Cash and GPay split must equal the Bet Amount!', 'error');
        return;
      }
      cashAmt = matchResult === 'Win' ? cashS : -cashS;
      gpayAmt = matchResult === 'Win' ? gpayS : -gpayS;
    }

    try {
      await onAddMatch({
        date: matchDate,
        opponent: matchOpponent.trim(),
        ground: matchGround.trim() || 'Home Ground',
        bet_amount: bet,
        result: matchResult,
        amount_won_lost: winLossAmount,
        settled_via: matchSettledVia,
        cash_amount: cashAmt,
        gpay_amount: gpayAmt,
        who_played: matchWhoPlayed,
        notes: matchNotes.trim(),
        match_number: matchNumber
      });
      showToast(`Recorded match vs ${matchOpponent.trim()} (${matchResult})!`);
      setMatchOpponent('');
      setMatchGround('');
      setMatchBet('');
      setMatchCashSplit('');
      setMatchGpaySplit('');
      setMatchWhoPlayed([]);
      setMatchNotes('');
      setMatchNumber('Match 1');
      setShowAddMatch(false);
    } catch (err: any) {
      showToast(err.message || 'Error adding match', 'error');
    }
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentPlayerId || !paymentAmount) return;

    const amt = parseFloat(paymentAmount);
    let cashAmt = 0;
    let gpayAmt = 0;

    if (paymentMode === 'Cash') {
      cashAmt = amt;
    } else if (paymentMode === 'GPay') {
      gpayAmt = amt;
    } else {
      cashAmt = parseFloat(paymentCashAmount) || 0;
      gpayAmt = parseFloat(paymentGpayAmount) || 0;
      if (cashAmt + gpayAmt !== amt) {
        showToast('Sum of Cash amount and GPay amount must equal total Paid amount!', 'error');
        return;
      }
    }

    try {
      const player = players.find(p => p.id === paymentPlayerId);
      await onAddExtraPayment({
        player_id: paymentPlayerId,
        date: paymentDate,
        amount: amt,
        payment_mode: paymentMode,
        cash_amount: cashAmt,
        gpay_amount: gpayAmt,
        notes: paymentNotes.trim()
      });
      showToast(`Recorded payment of ₹${amt} from ${player ? player.name : 'player'}!`);
      setPaymentAmount('');
      setPaymentCashAmount('');
      setPaymentGpayAmount('');
      setPaymentNotes('');
      setShowRecordPayment(false);
    } catch (err: any) {
      showToast(err.message || 'Error recording payment', 'error');
    }
  };

  const toggleMatchPlayer = (playerId: string) => {
    setMatchWhoPlayed(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId) 
        : [...prev, playerId]
    );
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="fade-in" style={{ display: 'grid', gap: '24px' }}>
      
      {/* Wallet Cards Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>
        
        {/* Wallet Cash */}
        <div className="glass-panel" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderLeft: '4px solid var(--primary)'
        }}>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 'bold' }}>
              💵 Cash in Hand
            </span>
            <h2 style={{ fontSize: '1.75rem', marginTop: '4px', fontFamily: 'var(--font-title)' }}>
              {formatCurrency(balances.cash)}
            </h2>
          </div>
          <div style={{
            background: 'var(--primary-glow)',
            color: 'var(--primary)',
            padding: '10px',
            borderRadius: '12px'
          }}>
            <PiggyBank size={24} />
          </div>
        </div>

        {/* Wallet GPay */}
        <div className="glass-panel" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderLeft: '4px solid var(--secondary)'
        }}>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 'bold' }}>
              📱 GPay Balance
            </span>
            <h2 style={{ fontSize: '1.75rem', marginTop: '4px', fontFamily: 'var(--font-title)' }}>
              {formatCurrency(balances.gpay)}
            </h2>
          </div>
          <div style={{
            background: 'var(--secondary-glow)',
            color: 'var(--secondary)',
            padding: '10px',
            borderRadius: '12px'
          }}>
            <DollarSign size={24} />
          </div>
        </div>

        {/* Wallet Total */}
        <div className="glass-panel" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderLeft: '4px solid #8b5cf6'
        }}>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 'bold' }}>
              💰 Total Balance
            </span>
            <h2 style={{ fontSize: '1.75rem', marginTop: '4px', fontFamily: 'var(--font-title)', color: '#a78bfa' }}>
              {formatCurrency(balances.total)}
            </h2>
          </div>
          <div style={{
            background: 'rgba(139, 92, 246, 0.15)',
            color: '#a78bfa',
            padding: '10px',
            borderRadius: '12px'
          }}>
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Total Pending Collection */}
        <div className="glass-panel" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderLeft: '4px solid var(--accent)'
        }}>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 'bold' }}>
              ⏳ Total Pending
            </span>
            <h2 style={{ fontSize: '1.75rem', marginTop: '4px', fontFamily: 'var(--font-title)', color: 'var(--accent)' }}>
              {formatCurrency(balances.pending)}
            </h2>
          </div>
          <div style={{
            background: 'var(--accent-glow)',
            color: 'var(--accent)',
            padding: '10px',
            borderRadius: '12px'
          }}>
            <AlertCircle size={24} />
          </div>
        </div>
      </div>

      {/* Week Collection Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px'
      }}>
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Users size={24} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Players Present (Latest Session)</span>
            <h3 style={{ fontSize: '1.25rem' }}>{latestWeekDate ? `${latestWeekPresentCount} Players` : 'N/A'}</h3>
            {latestWeekDate && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Session: {latestWeekDate}</span>}
          </div>
        </div>

        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Calendar size={24} style={{ color: 'var(--secondary)' }} />
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Latest Collection Received</span>
            <h3 style={{ fontSize: '1.25rem' }}>{formatCurrency(latestWeekCollected)}</h3>
            {latestWeekDate && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Session: {latestWeekDate}</span>}
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="glass-panel">
        <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PlusCircle size={20} className="text-secondary" style={{ color: 'var(--secondary)' }} />
          Quick Manager Actions
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px'
        }}>
          <button onClick={() => onNavigate('attendance')} className="btn btn-primary" style={{ height: '52px' }}>
            <Calendar size={18} /> Mark Attendance
          </button>
          
          <button onClick={() => setShowAddExpense(true)} className="btn btn-secondary" style={{ height: '52px' }}>
            <Plus size={18} /> Add Expense
          </button>
          
          <button onClick={() => setShowAddMatch(true)} className="btn btn-secondary" style={{ height: '52px' }}>
            <Award size={18} /> Add Match
          </button>
          
          <button onClick={() => setShowAddPlayer(true)} className="btn btn-secondary" style={{ height: '52px' }}>
            <Plus size={18} /> Add Player
          </button>
          
          <button onClick={() => setShowRecordPayment(true)} className="btn btn-secondary" style={{ height: '52px', borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-glow)' }}>
            <DollarSign size={18} /> Record Payment
          </button>

          <button onClick={() => onNavigate('pending')} className="btn btn-secondary" style={{ height: '52px', gridColumn: 'span 1' }}>
            View Pending <ArrowRightCircle size={18} />
          </button>
        </div>
      </div>

      {/* --- ADD PLAYER MODAL --- */}
      {showAddPlayer && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Add New Player</h3>
              <button onClick={() => setShowAddPlayer(false)} className="btn-icon"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddPlayerSubmit} style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Full Name</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Sathish Raj" 
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                />
              </div>
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Phone Number (for WhatsApp)</label>
                <input 
                  type="text" 
                  placeholder="e.g. 9876543210" 
                  value={playerPhone}
                  onChange={e => setPlayerPhone(e.target.value)}
                />
              </div>
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Weekly Category</label>
                <select value={playerCategory} onChange={e => setPlayerCategory(e.target.value as PlayerCategory)}>
                  <option value="Normal">Normal (₹50)</option>
                  <option value="Bike">Bike (₹30)</option>
                  <option value="School">School (₹30)</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>Add Player</button>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD EXPENSE MODAL --- */}
      {showAddExpense && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Add Expense</h3>
              <button onClick={() => setShowAddExpense(false)} className="btn-icon"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddExpenseSubmit} style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Date</label>
                  <input type="date" required value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Category</label>
                  <select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value as ExpenseCategory)}>
                    <option value="Bat">Bat</option>
                    <option value="Ball">Ball</option>
                    <option value="Tape">Tape</option>
                    <option value="Stumps">Stumps</option>
                    <option value="Ground">Ground Rent</option>
                    <option value="Jersey">Jersey</option>
                    <option value="Food">Food</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Item Description</label>
                <input type="text" required placeholder="e.g. Red SG Leather Ball" value={expenseItem} onChange={e => setExpenseItem(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Amount (₹)</label>
                  <input type="number" required min="1" placeholder="350" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Paid From Wallet</label>
                  <select value={expenseWallet} onChange={e => setExpenseWallet(e.target.value as 'Cash' | 'GPay')}>
                    <option value="Cash">Cash in Hand</option>
                    <option value="GPay">GPay Wallet</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Notes (Optional)</label>
                <input type="text" placeholder="Add additional details" value={expenseNotes} onChange={e => setExpenseNotes(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>Save Expense</button>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD MATCH MODAL --- */}
      {showAddMatch && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ padding: '24px', maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Record Match Bet</h3>
              <button onClick={() => setShowAddMatch(false)} className="btn-icon"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddMatchSubmit} style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Date</label>
                  <input type="date" required value={matchDate} onChange={e => setMatchDate(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Match Number</label>
                  <select value={matchNumber} onChange={e => setMatchNumber(e.target.value)}>
                    <option value="Match 1">Match 1</option>
                    <option value="Match 2">Match 2</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Opponent Team</label>
                  <input type="text" required placeholder="e.g. CC Club" value={matchOpponent} onChange={e => setMatchOpponent(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Ground</label>
                  <input type="text" placeholder="e.g. Turf Ground" value={matchGround} onChange={e => setMatchGround(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Bet Amount (₹)</label>
                  <input type="number" required min="1" placeholder="150" value={matchBet} onChange={e => setMatchBet(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Result</label>
                  <select value={matchResult} onChange={e => setMatchResult(e.target.value as MatchResult)}>
                    <option value="Win">Win (+Bet Amount)</option>
                    <option value="Loss">Loss (-Bet Amount)</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Wallet Settlement</label>
                  <select value={matchSettledVia} onChange={e => setMatchSettledVia(e.target.value as SettlementMode)}>
                    <option value="GPay">GPay</option>
                    <option value="Cash">Cash</option>
                    <option value="Both">Both (Split Entry)</option>
                  </select>
                </div>
              </div>
              
              {matchSettledVia === 'Both' && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px dashed var(--border-color)'
                }}>
                  <div style={{ display: 'grid', gap: '6px' }}>
                    <label style={{ fontSize: '0.80rem', color: 'var(--text-secondary)' }}>Cash Portion (₹)</label>
                    <input type="number" required placeholder="Cash share" value={matchCashSplit} onChange={e => setMatchCashSplit(e.target.value)} />
                  </div>
                  <div style={{ display: 'grid', gap: '6px' }}>
                    <label style={{ fontSize: '0.80rem', color: 'var(--text-secondary)' }}>GPay Portion (₹)</label>
                    <input type="number" required placeholder="GPay share" value={matchGpaySplit} onChange={e => setMatchGpaySplit(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Who Played Checklist */}
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Who Played (Check all that apply)</label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: '8px',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  background: 'rgba(0,0,0,0.2)',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)'
                }}>
                  {players.map(player => (
                    <label key={player.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={matchWhoPlayed.includes(player.id)}
                        onChange={() => toggleMatchPlayer(player.id)}
                      />
                      <span>{player.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Notes (Optional)</label>
                <input type="text" placeholder="Match details, top scorer, etc." value={matchNotes} onChange={e => setMatchNotes(e.target.value)} />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>Save Match</button>
            </form>
          </div>
        </div>
      )}

      {/* --- RECORD DIRECT PAYMENT MODAL --- */}
      {showRecordPayment && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Record Direct Payment</h3>
              <button onClick={() => setShowRecordPayment(false)} className="btn-icon"><X size={18} /></button>
            </div>
            <form onSubmit={handleRecordPaymentSubmit} style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Select Player</label>
                <select required value={paymentPlayerId} onChange={e => setPaymentPlayerId(e.target.value)}>
                  <option value="">-- Choose Player --</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Date</label>
                  <input type="date" required value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Payment Mode</label>
                  <select value={paymentMode} onChange={e => setPaymentMode(e.target.value as 'Cash' | 'GPay' | 'Both')}>
                    <option value="GPay">GPay</option>
                    <option value="Cash">Cash</option>
                    <option value="Both">Both (Split Entry)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Paid Amount (₹)</label>
                <input type="number" required min="1" placeholder="50" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
              </div>

              {paymentMode === 'Both' && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px dashed var(--border-color)'
                }}>
                  <div style={{ display: 'grid', gap: '6px' }}>
                    <label style={{ fontSize: '0.80rem', color: 'var(--text-secondary)' }}>Cash Amount (₹)</label>
                    <input type="number" required placeholder="Cash share" value={paymentCashAmount} onChange={e => setPaymentCashAmount(e.target.value)} />
                  </div>
                  <div style={{ display: 'grid', gap: '6px' }}>
                    <label style={{ fontSize: '0.80rem', color: 'var(--text-secondary)' }}>GPay Amount (₹)</label>
                    <input type="number" required placeholder="GPay share" value={paymentGpayAmount} onChange={e => setPaymentGpayAmount(e.target.value)} />
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Notes (Optional)</label>
                <input type="text" placeholder="e.g. Cleared dues for June week 2" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>Record Payment</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
