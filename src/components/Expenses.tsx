import { useState } from 'react';
import { Plus, Trash2, Calendar, Search, Download, Filter, DollarSign, Tag } from 'lucide-react';
import { Expense, ExpenseCategory } from '../types';

interface ExpensesProps {
  expenses: Expense[];
  onAddExpense: (expense: { date: string; item: string; category: ExpenseCategory; amount: number; paid_from: 'Cash' | 'GPay'; notes?: string }) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const CATEGORIES: ExpenseCategory[] = ['Bat', 'Ball', 'Tape', 'Stumps', 'Ground', 'Jersey', 'Food', 'Other'];

export default function Expenses({
  expenses,
  onAddExpense,
  onDeleteExpense,
  showToast
}: ExpensesProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [walletFilter, setWalletFilter] = useState<'All' | 'Cash' | 'GPay'>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // Form states
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [item, setItem] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Ball');
  const [amount, setAmount] = useState('');
  const [paidFrom, setPaidFrom] = useState<'Cash' | 'GPay'>('GPay');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item.trim() || !amount) return;

    setSubmitting(true);
    try {
      await onAddExpense({
        date,
        item: item.trim(),
        category,
        amount: parseFloat(amount),
        paid_from: paidFrom,
        notes: notes.trim()
      });
      showToast(`Expense of ₹${amount} for "${item.trim()}" recorded!`);
      // Reset form
      setItem('');
      setAmount('');
      setNotes('');
      setShowAddForm(false);
    } catch (err: any) {
      showToast(err.message || 'Error recording expense', 'error');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string, itemName: string, amt: number) => {
    if (!window.confirm(`Are you sure you want to delete the expense for "${itemName}" of ₹${amt}? This will restore the money in your wallet.`)) {
      return;
    }
    try {
      await onDeleteExpense(id);
      showToast('Expense deleted successfully!');
    } catch (err: any) {
      showToast(err.message || 'Error deleting expense', 'error');
    }
  };

  // Filter expenses
  let filtered = [...expenses];
  
  if (walletFilter !== 'All') {
    filtered = filtered.filter(e => e.paid_from === walletFilter);
  }

  if (categoryFilter !== 'All') {
    filtered = filtered.filter(e => e.category === categoryFilter);
  }

  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(e => 
      e.item.toLowerCase().includes(term) || 
      (e.notes && e.notes.toLowerCase().includes(term))
    );
  }

  // Sort descending chronological
  filtered.sort((a, b) => b.date.localeCompare(a.date));

  // Compute stats
  const totalSpent = filtered.reduce((sum, e) => sum + e.amount, 0);
  const cashSpent = filtered.filter(e => e.paid_from === 'Cash').reduce((sum, e) => sum + e.amount, 0);
  const gpaySpent = filtered.filter(e => e.paid_from === 'GPay').reduce((sum, e) => sum + e.amount, 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const downloadCSV = () => {
    const headers = ['Date', 'Item Name', 'Category', 'Amount (INR)', 'Paid From (Wallet)', 'Notes'];
    const rows = filtered.map(e => [
      e.date,
      e.item,
      e.category,
      e.amount.toString(),
      e.paid_from,
      e.notes || ''
    ]);

    const content = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `11_parkerz_expenses_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded expenses CSV report!');
  };

  return (
    <div className="fade-in" style={{ display: 'grid', gap: '20px' }}>
      
      {/* Header and Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={24} className="text-secondary" style={{ color: 'var(--secondary)' }} />
            Club Expenses Register
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Audited outflows matching filters: <strong>{formatCurrency(totalSpent)}</strong> (Cash: {formatCurrency(cashSpent)} | GPay: {formatCurrency(gpaySpent)})
          </p>
        </div>

        <button 
          onClick={() => setShowAddForm(!showAddForm)} 
          className="btn btn-primary"
        >
          {showAddForm ? 'Close Form' : <><Plus size={18} /> Record Expense</>}
        </button>
      </div>

      {/* Add Expense Form Panel */}
      {showAddForm && (
        <div className="glass-panel" style={{ animation: 'fadeIn 0.25s ease' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Tag size={18} style={{ color: 'var(--secondary)' }} />
            New Expense Payout Details
          </h3>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div style={{ display: 'grid', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Expense Date</label>
              <input type="date" required value={date} onChange={e => setDate(e.target.value)} />
            </div>

            <div style={{ display: 'grid', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Item Purchased</label>
              <input type="text" required placeholder="Tape, SG Bat, stumps, etc..." value={item} onChange={e => setItem(e.target.value)} />
            </div>

            <div style={{ display: 'grid', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Expense Category</label>
              <select value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)}>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Amount Spent (₹)</label>
              <input type="number" min="1" required placeholder="Amount in INR" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>

            <div style={{ display: 'grid', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Paid From Wallet</label>
              <div className="segmented-control" style={{ height: '45px' }}>
                <button 
                  type="button" 
                  className={`segmented-button ${paidFrom === 'GPay' ? 'active' : ''}`}
                  onClick={() => setPaidFrom('GPay')}
                >
                  GPay
                </button>
                <button 
                  type="button" 
                  className={`segmented-button ${paidFrom === 'Cash' ? 'active' : ''}`}
                  onClick={() => setPaidFrom('Cash')}
                >
                  Cash
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '6px', gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Purchase Notes (Optional)</label>
              <input type="text" placeholder="Wicket stamps for matches, team snacks, tapes for SG bat..." value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button type="submit" className="btn btn-primary" style={{ padding: '12px 28px' }} disabled={submitting}>
                {submitting ? 'Recording Payout...' : 'Save Expense Record'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters HUD */}
      <div className="glass-panel" style={{ display: 'grid', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={18} style={{ color: 'var(--secondary)' }} />
            Search & Filter Outflows
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
          >
            <Download size={16} /> Download CSV
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
              placeholder="Search items, notes..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>

          {/* Category Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="All">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Wallet Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div className="segmented-control">
              {[
                { id: 'All', label: 'All Wallets' },
                { id: 'Cash', label: 'Cash Only' },
                { id: 'GPay', label: 'GPay Only' }
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
        </div>
      </div>

      {/* Expense History Table */}
      <div className="glass-panel" style={{ padding: '0px', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Item Details</th>
                <th>Category</th>
                <th>Amount Spent</th>
                <th>Paid From</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(exp => (
                <tr key={exp.id}>
                  <td style={{ whiteSpace: 'nowrap' }}><span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} style={{ color: 'var(--text-muted)' }} /> {exp.date}</span></td>
                  <td>
                    <div style={{ fontWeight: '600' }}>{exp.item}</div>
                    {exp.notes && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{exp.notes}</div>}
                  </td>
                  <td>
                    <span className="badge badge-normal" style={{ fontSize: '0.7rem' }}>{exp.category}</span>
                  </td>
                  <td style={{ fontWeight: '700', color: 'var(--accent)' }}>{formatCurrency(exp.amount)}</td>
                  <td>
                    <span className={`badge ${exp.paid_from === 'GPay' ? 'badge-bike' : 'badge-school'}`} style={{ fontSize: '0.7rem' }}>
                      {exp.paid_from}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      onClick={() => handleDelete(exp.id, exp.item, exp.amount)}
                      className="btn-icon" 
                      style={{ color: 'var(--accent)', borderColor: 'rgba(225,29,72,0.1)' }}
                      title="Delete expense"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No expense records found matching filters.
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
