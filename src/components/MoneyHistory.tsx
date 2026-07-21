import { useState } from 'react';
import { Filter, Search, Trash2, Download } from 'lucide-react';
import { Player, AttendanceWeek, AttendanceRecord, Expense, Match, ExtraPayment } from '../types';

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
  showToast
}: MoneyHistoryProps) {
  const [walletFilter, setWalletFilter] = useState<'All' | 'Cash' | 'GPay'>('All');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Income' | 'Expense'>('All');
  const [playerFilter, setPlayerFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

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
                        <button 
                          onClick={() => handleDelete(t)} 
                          className="btn-icon" 
                          style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)' }}
                          title="Delete transaction entry"
                        >
                          <Trash2 size={16} />
                        </button>
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

    </div>
  );
}
