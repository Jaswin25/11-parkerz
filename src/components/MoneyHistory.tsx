import { useState } from 'react';
import { Filter, Search, Trash2, Download, Edit, X } from 'lucide-react';
import { Player, AttendanceWeek, AttendanceRecord, Expense, Match, ExtraPayment, ExpenseCategory, MatchResult, SettlementMode } from '../types';

interface MoneyHistoryProps {
  players: Player[];
  weeks: AttendanceWeek[];
  attendance: AttendanceRecord[];
  expenses: Expense[];
  matches: Match[];
  extraPayments: ExtraPayment[];
  onDeleteExpense: (id: string) => Promise<void>;
  onDeleteMatch: (id: string) => Promise<void>;
  onDeleteExtraPayment: (id: string) => Promise<void>;
  onUpdateExpense: (id: string, expense: { date: string; item: string; category: ExpenseCategory; amount: number; paid_from: 'Cash' | 'GPay'; notes?: string }) => Promise<void>;
  onUpdateMatch: (id: string, match: { date: string; opponent: string; ground: string; bet_amount: number; result: MatchResult; amount_won_lost: number; settled_via: SettlementMode; cash_amount: number; gpay_amount: number; who_played: string[]; notes?: string; match_number?: string }) => Promise<void>;
  onUpdateExtraPayment: (id: string, payment: { player_id: string; date: string; amount: number; payment_mode: 'Cash' | 'GPay' | 'Both'; cash_amount: number; gpay_amount: number; notes?: string }) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function MoneyHistory({
  players,
  weeks,
  attendance,
  expenses,
  matches,
  extraPayments,
  onDeleteExpense,
  onDeleteMatch,
  onDeleteExtraPayment,
  onUpdateExpense,
  onUpdateMatch,
  onUpdateExtraPayment,
  showToast
}: MoneyHistoryProps) {
  const [walletFilter, setWalletFilter] = useState<'All' | 'Cash' | 'GPay'>('All');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Income' | 'Expense'>('All');
  const [playerFilter, setPlayerFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Editing state
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Expense-specific states
  const [expItem, setExpItem] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('Other');
  const [expPaidFrom, setExpPaidFrom] = useState<'Cash' | 'GPay'>('GPay');

  // Match-specific states
  const [matchOpponent, setMatchOpponent] = useState('');
  const [matchGround, setMatchGround] = useState('');
  const [matchResult, setMatchResult] = useState<MatchResult>('Win');
  const [matchSettledVia, setMatchSettledVia] = useState<SettlementMode>('GPay');
  const [matchCashSplit, setMatchCashSplit] = useState('');
  const [matchGpaySplit, setMatchGpaySplit] = useState('');
  const [matchWhoPlayed, setMatchWhoPlayed] = useState<string[]>([]);
  const [matchNumber, setMatchNumber] = useState('Match 1');

  // ExtraPayment-specific states
  const [paymentPlayerId, setPaymentPlayerId] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'GPay' | 'Both'>('GPay');
  const [paymentCashAmount, setPaymentCashAmount] = useState('');
  const [paymentGpayAmount, setPaymentGpayAmount] = useState('');

  const [saving, setSaving] = useState(false);

  const handleCheckboxChange = (playerId: string) => {
    setMatchWhoPlayed(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId) 
        : [...prev, playerId]
    );
  };

  const handleEditClick = (t: any) => {
    setEditingItem(t);
    setEditDate(t.date);
    setEditAmount(t.amount.toString());
    setEditNotes(t.notes || '');

    if (t.id.startsWith('exp-')) {
      const exp = expenses.find(e => e.id === t.dbId);
      if (exp) {
        setExpItem(exp.item);
        setExpCategory(exp.category);
        setExpPaidFrom(exp.paid_from);
      }
    } else if (t.id.startsWith('match-')) {
      const m = matches.find(match => match.id === t.dbId);
      if (m) {
        setMatchOpponent(m.opponent);
        setMatchGround(m.ground);
        setMatchResult(m.result);
        setMatchSettledVia(m.settled_via);
        setMatchWhoPlayed(m.who_played || []);
        setMatchNumber(m.match_number || 'Match 1');
        if (m.settled_via === 'Both') {
          setMatchCashSplit(Math.abs(m.cash_amount).toString());
          setMatchGpaySplit(Math.abs(m.gpay_amount).toString());
        } else {
          setMatchCashSplit('');
          setMatchGpaySplit('');
        }
      }
    } else if (t.id.startsWith('ext-')) {
      const ext = extraPayments.find(p => p.id === t.dbId);
      if (ext) {
        setPaymentPlayerId(ext.player_id);
        setPaymentMode(ext.payment_mode);
        if (ext.payment_mode === 'Both') {
          setPaymentCashAmount(ext.cash_amount.toString());
          setPaymentGpayAmount(ext.gpay_amount.toString());
        } else {
          setPaymentCashAmount('');
          setPaymentGpayAmount('');
        }
      }
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSaving(true);
    try {
      const amt = parseFloat(editAmount) || 0;

      if (editingItem.id.startsWith('exp-')) {
        await onUpdateExpense(editingItem.dbId, {
          date: editDate,
          item: expItem.trim(),
          category: expCategory,
          amount: amt,
          paid_from: expPaidFrom,
          notes: editNotes.trim()
        });
        showToast('Expense updated successfully!');
      } else if (editingItem.id.startsWith('match-')) {
        const winLossAmt = matchResult === 'Win' ? amt : -amt;
        let cashAmt = 0;
        let gpayAmt = 0;

        if (matchSettledVia === 'Cash') {
          cashAmt = winLossAmt;
        } else if (matchSettledVia === 'GPay') {
          gpayAmt = winLossAmt;
        } else {
          const cashS = parseFloat(matchCashSplit) || 0;
          const gpayS = parseFloat(matchGpaySplit) || 0;
          if (Math.abs(cashS + gpayS) !== amt) {
            showToast('Sum of Cash split and GPay split must equal the Bet Amount!', 'error');
            setSaving(false);
            return;
          }
          cashAmt = matchResult === 'Win' ? cashS : -cashS;
          gpayAmt = matchResult === 'Win' ? gpayS : -gpayS;
        }

        await onUpdateMatch(editingItem.dbId, {
          date: editDate,
          opponent: matchOpponent.trim(),
          ground: matchGround.trim() || 'Home Ground',
          bet_amount: amt,
          result: matchResult,
          amount_won_lost: winLossAmt,
          settled_via: matchSettledVia,
          cash_amount: cashAmt,
          gpay_amount: gpayAmt,
          who_played: matchWhoPlayed,
          notes: editNotes.trim(),
          match_number: matchNumber
        });
        showToast('Match details updated successfully!');
      } else if (editingItem.id.startsWith('ext-')) {
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
            showToast('Sum of Cash and GPay amounts must equal the total amount!', 'error');
            setSaving(false);
            return;
          }
        }

        await onUpdateExtraPayment(editingItem.dbId, {
          player_id: paymentPlayerId,
          date: editDate,
          amount: amt,
          payment_mode: paymentMode,
          cash_amount: cashAmt,
          gpay_amount: gpayAmt,
          notes: editNotes.trim()
        });
        showToast('Direct payment details updated successfully!');
      }
      setEditingItem(null);
    } catch (err: any) {
      showToast(err.message || 'Error updating transaction details', 'error');
    }
    setSaving(false);
  };

  // 1. Compile all income items
  const incomeList: any[] = [];
  
  // Weekly collection income
  attendance.forEach(rec => {
    if (rec.paid_amount > 0) {
      const player = players.find(p => p.id === rec.player_id);
      const week = weeks.find(w => w.id === rec.week_id);
      const date = week ? week.date : 'Unknown Date';
      
      incomeList.push({
        id: `att-${rec.id}`,
        dbId: rec.id,
        type: 'Income',
        source: 'Weekly Collection',
        title: `${player ? player.name : 'Unknown Player'} (Weekly Fee)`,
        date,
        amount: rec.paid_amount,
        wallet: rec.payment_mode,
        cash_amount: rec.cash_amount,
        gpay_amount: rec.gpay_amount,
        playerId: rec.player_id,
        canDelete: false
      });
    }
  });

  // Extra direct payment income
  extraPayments.forEach(p => {
    const player = players.find(pId => pId.id === p.player_id);
    incomeList.push({
      id: `ext-${p.id}`,
      dbId: p.id,
      type: 'Income',
      source: 'Direct Payment',
      title: `${player ? player.name : 'Unknown Player'} (Dues Cleared)`,
      date: p.date,
      amount: p.amount,
      wallet: p.payment_mode,
      cash_amount: p.cash_amount,
      gpay_amount: p.gpay_amount,
      playerId: p.player_id,
      notes: p.notes,
      canDelete: true,
      deleteAction: () => onDeleteExtraPayment(p.id)
    });
  });

  // Match wins income
  matches.forEach(m => {
    if (m.result === 'Win') {
      incomeList.push({
        id: `match-${m.id}`,
        dbId: m.id,
        type: 'Income',
        source: 'Match Win',
        title: `Won match vs ${m.opponent}`,
        date: m.date,
        amount: m.amount_won_lost,
        wallet: m.settled_via,
        cash_amount: m.cash_amount,
        gpay_amount: m.gpay_amount,
        notes: m.notes,
        canDelete: true,
        deleteAction: () => onDeleteMatch(m.id)
      });
    }
  });

  // 2. Compile all expense items
  const expenseList: any[] = [];

  // Direct expenses
  expenses.forEach(e => {
    expenseList.push({
      id: `exp-${e.id}`,
      dbId: e.id,
      type: 'Expense',
      source: 'Equipment/Ground',
      title: `${e.item} (${e.category})`,
      date: e.date,
      amount: e.amount,
      wallet: e.paid_from,
      notes: e.notes,
      canDelete: true,
      deleteAction: () => onDeleteExpense(e.id)
    });
  });

  // Match losses expense
  matches.forEach(m => {
    if (m.result === 'Loss') {
      expenseList.push({
        id: `match-${m.id}`,
        dbId: m.id,
        type: 'Expense',
        source: 'Match Loss',
        title: `Lost match vs ${m.opponent}`,
        date: m.date,
        amount: Math.abs(m.amount_won_lost),
        wallet: m.settled_via,
        cash_amount: Math.abs(m.cash_amount),
        gpay_amount: Math.abs(m.gpay_amount),
        notes: m.notes,
        canDelete: true,
        deleteAction: () => onDeleteMatch(m.id)
      });
    }
  });

  // Merge lists
  let allTransactions = [...incomeList, ...expenseList];

  // Apply filters
  if (walletFilter !== 'All') {
    allTransactions = allTransactions.filter(t => {
      if (t.wallet === 'Both') {
        // Transactions split as 'Both' belong to both cash and gpay filters!
        return true;
      }
      return t.wallet === walletFilter;
    });
  }

  if (typeFilter !== 'All') {
    allTransactions = allTransactions.filter(t => t.type === typeFilter);
  }

  if (playerFilter) {
    allTransactions = allTransactions.filter(t => t.playerId === playerFilter);
  }

  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    allTransactions = allTransactions.filter(t => 
      t.title.toLowerCase().includes(term) || 
      t.source.toLowerCase().includes(term) ||
      (t.notes && t.notes.toLowerCase().includes(term))
    );
  }

  // Sort by date descending, then by source/id
  allTransactions.sort((a, b) => b.date.localeCompare(a.date));

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const handleDelete = async (t: any) => {
    if (!window.confirm(`Are you sure you want to delete this transaction: "${t.title}" for ₹${t.amount}? This will update the wallet balances.`)) {
      return;
    }
    try {
      await t.deleteAction();
      showToast('Transaction deleted successfully!');
    } catch (e: any) {
      showToast(e.message || 'Error deleting transaction', 'error');
    }
  };

  // Download all ledger entries matching current filters as CSV
  const downloadCSV = () => {
    const headers = ['Date', 'Title', 'Source (Type)', 'Total Amount (INR)', 'Type', 'Wallet', 'Cash Component (INR)', 'GPay Component (INR)', 'Notes'];
    const rows = allTransactions.map(t => [
      t.date,
      t.title,
      t.source,
      t.amount.toString(),
      t.type,
      t.wallet,
      t.cash_amount.toString(),
      t.gpay_amount.toString(),
      t.notes || ''
    ]);

    const content = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `11_parkerz_financial_ledger_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded transactions CSV ledger!');
  };

  return (
    <div className="fade-in" style={{ display: 'grid', gap: '20px' }}>
      
      {/* Filters Panel */}
      <div className="glass-panel" style={{ display: 'grid', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '1.10rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={18} className="text-secondary" style={{ color: 'var(--secondary)' }} />
            Filter Ledger Logs
          </h3>
          <button 
            onClick={downloadCSV} 
            className="btn btn-secondary" 
            style={{ 
              padding: '8px 16px', 
              fontSize: '0.85rem', 
              height: '38px', 
              borderColor: 'var(--secondary)', 
              color: 'var(--secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Export filtered transactions to CSV"
          >
            <Download size={16} /> Download CSV Ledger
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px'
        }}>
          {/* Text Search */}
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              placeholder="Search items, notes, teams..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>

          {/* Type Segmented Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Transaction Type:</span>
            <div className="segmented-control">
              {[
                { id: 'All', label: 'All' },
                { id: 'Income', label: 'Income' },
                { id: 'Expense', label: 'Expenses' }
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={`segmented-button ${typeFilter === item.id ? 'active' : ''}`}
                  onClick={() => setTypeFilter(item.id as any)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Wallet Segmented Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Wallet:</span>
            <div className="segmented-control">
              {[
                { id: 'All', label: 'All' },
                { id: 'Cash', label: 'Cash' },
                { id: 'GPay', label: 'GPay' }
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={`segmented-button ${walletFilter === item.id ? 'active' : ''}`}
                  onClick={() => setWalletFilter(item.id as any)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Player filter (for collections) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Filter Player:</span>
            <select value={playerFilter} onChange={e => setPlayerFilter(e.target.value)}>
              <option value="">All Players</option>
              {players.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="glass-panel" style={{ display: 'grid', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.2rem' }}>Transaction Ledger</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Showing {allTransactions.length} logs
          </span>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Wallet</th>
                <th>Amount</th>
                <th style={{ width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {allTransactions.map(t => {
                const isIncome = t.type === 'Income';
                
                return (
                  <tr key={t.id}>
                    {/* Date */}
                    <td>{t.date}</td>

                    {/* Description */}
                    <td>
                      <div style={{ fontWeight: '600' }}>{t.title}</div>
                      {t.notes && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.notes}</div>}
                    </td>

                    {/* Category */}
                    <td>
                      <span className={`badge ${isIncome ? 'badge-normal' : 'badge-loss'}`} style={{ fontSize: '0.7rem' }}>
                        {t.source}
                      </span>
                    </td>

                    {/* Wallet */}
                    <td>
                      {t.wallet === 'Both' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.75rem' }}>
                          <span className="badge badge-bike" style={{ fontSize: '0.65rem' }}>Split Both</span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            C:₹{t.cash_amount} / G:₹{t.gpay_amount}
                          </span>
                        </div>
                      ) : (
                        <span className={`badge badge-${t.wallet.toLowerCase()}`} style={{ fontSize: '0.7rem' }}>
                          {t.wallet}
                        </span>
                      )}
                    </td>

                    {/* Amount */}
                    <td style={{ 
                      fontWeight: 'bold', 
                      color: isIncome ? 'var(--primary)' : 'var(--danger)'
                    }}>
                      {isIncome ? '+' : '-'}{formatCurrency(t.amount)}
                    </td>

                    {/* Action */}
                    <td>
                      {t.canDelete ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            onClick={() => handleEditClick(t)} 
                            className="btn-icon" 
                            style={{ border: 'none', background: 'transparent', color: 'var(--secondary)' }}
                            title="Edit transaction entry"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(t)} 
                            className="btn-icon" 
                            style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)' }}
                            title="Delete transaction entry"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} title="Attendance collections must be edited from the Attendance Tab">
                          Fixed
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {allTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No matching transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- TRANSACTION EDIT MODAL --- */}
      {editingItem && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ padding: '24px', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem' }}>
                Edit {editingItem.id.startsWith('exp-') ? 'Expense Details' : editingItem.id.startsWith('match-') ? 'Match Record' : 'Direct Payment'}
              </h3>
              <button onClick={() => setEditingItem(null)} className="btn-icon"><X size={18} /></button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: 'grid', gap: '16px' }}>
              {/* Common Fields: Date & Amount (except matches which uses bet amount) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Date</label>
                  <input type="date" required value={editDate} onChange={e => setEditDate(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {editingItem.id.startsWith('match-') ? 'Bet Amount (₹)' : 'Amount (₹)'}
                  </label>
                  <input type="number" required min="1" placeholder="Amount" value={editAmount} onChange={e => setEditAmount(e.target.value)} />
                </div>
              </div>

              {/* Expense Specific Fields */}
              {editingItem.id.startsWith('exp-') && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Item Purchased</label>
                      <input type="text" required value={expItem} onChange={e => setExpItem(e.target.value)} />
                    </div>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Category</label>
                      <select value={expCategory} onChange={e => setExpCategory(e.target.value as ExpenseCategory)}>
                        {['Bat', 'Ball', 'Tape', 'Stumps', 'Ground', 'Jersey', 'Food', 'Other'].map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Paid From Wallet</label>
                    <select value={expPaidFrom} onChange={e => setExpPaidFrom(e.target.value as 'Cash' | 'GPay')}>
                      <option value="GPay">GPay Wallet</option>
                      <option value="Cash">Cash Wallet</option>
                    </select>
                  </div>
                </>
              )}

              {/* Match Specific Fields */}
              {editingItem.id.startsWith('match-') && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Opponent Name</label>
                      <input type="text" required value={matchOpponent} onChange={e => setMatchOpponent(e.target.value)} />
                    </div>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Ground / Venue</label>
                      <input type="text" required value={matchGround} onChange={e => setMatchGround(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Result</label>
                      <select value={matchResult} onChange={e => setMatchResult(e.target.value as MatchResult)}>
                        <option value="Win">Win</option>
                        <option value="Loss">Loss</option>
                      </select>
                    </div>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Settled Via Wallet</label>
                      <select value={matchSettledVia} onChange={e => setMatchSettledVia(e.target.value as SettlementMode)}>
                        <option value="GPay">GPay</option>
                        <option value="Cash">Cash</option>
                        <option value="Both">Both (Split)</option>
                      </select>
                    </div>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Match Number</label>
                      <select value={matchNumber} onChange={e => setMatchNumber(e.target.value)}>
                        <option value="Match 1">Match 1</option>
                        <option value="Match 2">Match 2</option>
                      </select>
                    </div>
                  </div>

                  {matchSettledVia === 'Both' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ display: 'grid', gap: '6px' }}>
                        <label style={{ fontSize: '0.80rem', color: 'var(--text-secondary)' }}>Cash Share (₹)</label>
                        <input type="number" required value={matchCashSplit} onChange={e => setMatchCashSplit(e.target.value)} />
                      </div>
                      <div style={{ display: 'grid', gap: '6px' }}>
                        <label style={{ fontSize: '0.80rem', color: 'var(--text-secondary)' }}>GPay Share (₹)</label>
                        <input type="number" required value={matchGpaySplit} onChange={e => setMatchGpaySplit(e.target.value)} />
                      </div>
                    </div>
                  )}

                  {/* squad players checklist */}
                  <div style={{ display: 'grid', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Match Players squad ({matchWhoPlayed.length} selected)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', maxHeight: '120px', overflowY: 'auto', background: 'rgba(0, 0, 0, 0.25)', padding: '10px', borderRadius: '6px' }}>
                      {players.map(p => (
                        <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={matchWhoPlayed.includes(p.id)} onChange={() => handleCheckboxChange(p.id)} />
                          <span>{p.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Extra Payment Specific Fields */}
              {editingItem.id.startsWith('ext-') && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Player</label>
                      <select value={paymentPlayerId} onChange={e => setPaymentPlayerId(e.target.value)}>
                        {players.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Payment Mode</label>
                      <select value={paymentMode} onChange={e => setPaymentMode(e.target.value as 'Cash' | 'GPay' | 'Both')}>
                        <option value="GPay">GPay</option>
                        <option value="Cash">Cash</option>
                        <option value="Both">Both (Split)</option>
                      </select>
                    </div>
                  </div>

                  {paymentMode === 'Both' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ display: 'grid', gap: '6px' }}>
                        <label style={{ fontSize: '0.80rem', color: 'var(--text-secondary)' }}>Cash Share (₹)</label>
                        <input type="number" required value={paymentCashAmount} onChange={e => setPaymentCashAmount(e.target.value)} />
                      </div>
                      <div style={{ display: 'grid', gap: '6px' }}>
                        <label style={{ fontSize: '0.80rem', color: 'var(--text-secondary)' }}>GPay Share (₹)</label>
                        <input type="number" required value={paymentGpayAmount} onChange={e => setPaymentGpayAmount(e.target.value)} />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Notes (Optional) */}
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Notes (Optional)</label>
                <input type="text" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setEditingItem(null)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
