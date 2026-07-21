import { useState } from 'react';
import { AlertCircle, Send, Copy, DollarSign, Check, X } from 'lucide-react';
import { Player, AttendanceWeek, AttendanceRecord, ExtraPayment, Match } from '../types';
import { calculatePlayerStats } from '../services/db';

interface PendingProps {
  players: Player[];
  weeks: AttendanceWeek[];
  attendance: AttendanceRecord[];
  extraPayments: ExtraPayment[];
  matches: Match[];
  onAddExtraPayment: (payment: { player_id: string; date: string; amount: number; payment_mode: 'Cash' | 'GPay' | 'Both'; cash_amount: number; gpay_amount: number; notes?: string }) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function Pending({
  players,
  weeks,
  attendance,
  extraPayments,
  matches,
  onAddExtraPayment,
  showToast
}: PendingProps) {
  const [sortBy, setSortBy] = useState<'pending' | 'oldest' | 'name'>('pending');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Record Payment Modal State
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState<'Cash' | 'GPay' | 'Both'>('GPay');
  const [payCashAmount, setPayCashAmount] = useState('');
  const [payGpayAmount, setPayGpayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('Dues Clearance');
  const [saving, setSaving] = useState(false);

  // Compute stats for all players and filter those with dues
  const playersWithDues = players
    .map(player => {
      const stats = calculatePlayerStats(player.id, weeks, attendance, extraPayments, matches);
      
      // Calculate how many weeks have pending dues
      const playerAttendance = attendance.filter(a => a.player_id === player.id);
      const unpaidWeeksCount = playerAttendance.filter(a => a.status === 'Present' && a.pending_amount > 0).length;

      // Find the oldest pending week date
      let oldestPendingDate = '';
      const pendingDates = playerAttendance
        .filter(a => a.status === 'Present' && a.pending_amount > 0)
        .map(a => weeks.find(w => w.id === a.week_id)?.date || '')
        .filter(Boolean);
      
      if (pendingDates.length > 0) {
        pendingDates.sort((a, b) => a.localeCompare(b)); // Sort chronological ascending
        oldestPendingDate = pendingDates[0];
      }

      return {
        ...player,
        ...stats,
        weeksPending: unpaidWeeksCount || (stats.totalPending > 0 ? 1 : 0),
        oldestPendingDate
      };
    })
    .filter(p => p.totalPending > 0);

  // Sorting
  playersWithDues.sort((a, b) => {
    if (sortBy === 'pending') {
      return b.totalPending - a.totalPending;
    } else if (sortBy === 'oldest') {
      // Players with oldest dates go first
      if (!a.oldestPendingDate) return 1;
      if (!b.oldestPendingDate) return -1;
      return a.oldestPendingDate.localeCompare(b.oldestPendingDate);
    } else if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  const getReminderText = (p: any) => {
    const lastPaidMsg = p.lastPaymentDate ? ` (Last paid on ${p.lastPaymentDate})` : '';
    return `🏏 *11 ParkerZ - CM Calcy Reminder* \nHey *${p.name}*,\n\nYou have pending dues of *₹${p.totalPending}* for our cricket weekly sessions${lastPaidMsg}.\n\nPlease clear the balance via GPay or Cash as soon as possible. \n\nThank you! 👍`;
  };

  const handleCopyReminder = (p: any) => {
    const text = getReminderText(p);
    navigator.clipboard.writeText(text);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatPhoneForWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/[^\d]/g, ''); // keep only digits
    if (cleaned.length === 10) {
      return `91${cleaned}`;
    }
    return cleaned;
  };

  const handleSendWhatsApp = (p: any) => {
    const text = encodeURIComponent(getReminderText(p));
    const phone = p.phone ? formatPhoneForWhatsApp(p.phone) : '';
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
    } else {
      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    }
  };

  const handleRecordPaymentClick = (player: Player, defaultAmt: number) => {
    setSelectedPlayer(player);
    setPayAmount(defaultAmt.toString());
    setPayCashAmount('');
    setPayGpayAmount('');
    setPayNotes(`Cleared pending dues of ₹${defaultAmt}`);
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayer || !payAmount) return;

    setSaving(true);
    const amt = parseFloat(payAmount);
    let cashAmt = 0;
    let gpayAmt = 0;

    if (payMode === 'Cash') {
      cashAmt = amt;
    } else if (payMode === 'GPay') {
      gpayAmt = amt;
    }
    if (payMode === 'Both') {
      cashAmt = parseFloat(payCashAmount) || 0;
      gpayAmt = parseFloat(payGpayAmount) || 0;
      if (cashAmt + gpayAmt !== amt) {
        showToast('Sum of Cash and GPay amounts must equal total paid amount!', 'error');
        setSaving(false);
        return;
      }
    }

    try {
      await onAddExtraPayment({
        player_id: selectedPlayer.id,
        date: payDate,
        amount: amt,
        payment_mode: payMode,
        cash_amount: cashAmt,
        gpay_amount: gpayAmt,
        notes: payNotes.trim()
      });
      showToast(`Dues payment of ₹${amt} recorded successfully for ${selectedPlayer.name}`);
      setSelectedPlayer(null);
    } catch (err: any) {
      showToast(err.message || 'Error recording payment', 'error');
    }
    setSaving(false);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const totalDuesSum = playersWithDues.reduce((sum, p) => sum + p.totalPending, 0);

  return (
    <div className="fade-in" style={{ display: 'grid', gap: '20px' }}>
      
      {/* Header Summary and Sorting */}
      <div className="glass-panel" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        borderLeft: '4px solid var(--accent)'
      }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={24} className="text-accent" style={{ color: 'var(--accent)' }} />
            Pending Dues Register
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Total pending collections from {playersWithDues.length} players: <strong>{formatCurrency(totalDuesSum)}</strong>
          </p>
        </div>

        {/* Segmented Sorting Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '320px', flex: '1 1 auto' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600', whiteSpace: 'nowrap' }}>Sort:</span>
          <div className="segmented-control">
            {[
              { id: 'pending', label: 'Highest Dues' },
              { id: 'oldest', label: 'Oldest Due' },
              { id: 'name', label: 'Name (A-Z)' }
            ].map(item => (
              <button
                key={item.id}
                type="button"
                className={`segmented-button ${sortBy === item.id ? 'active' : ''}`}
                onClick={() => setSortBy(item.id as any)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dues List */}
      <div style={{ display: 'grid', gap: '16px' }}>
        {playersWithDues.map(p => (
          <div 
            key={p.id} 
            className="glass-panel" 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              flexWrap: 'wrap',
              gap: '16px',
              borderLeft: '4px solid var(--accent)'
            }}
          >
            {/* Player details */}
            <div style={{ display: 'grid', gap: '4px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                {p.name}
                <span className={`badge badge-${p.category.toLowerCase()}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                  {p.category}
                </span>
                {p.phone && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '400' }}>
                    📱 {p.phone}
                  </span>
                )}
              </h3>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>Weeks Pending: <strong style={{ color: 'var(--accent)' }}>{p.weeksPending} Weeks</strong></span>
                {p.oldestPendingDate && <span>Oldest Due: <strong>{p.oldestPendingDate}</strong></span>}
                {p.lastPaymentDate && <span>Last Paid: <strong>{p.lastPaymentDate}</strong></span>}
              </div>
            </div>

            {/* Financial and Reminder Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'right', minWidth: '100px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Amount Pending</span>
                <h3 style={{ color: 'var(--accent)', fontSize: '1.4rem' }}>{formatCurrency(p.totalPending)}</h3>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                {/* Clear Payment */}
                <button 
                  onClick={() => handleRecordPaymentClick(p, p.totalPending)} 
                  className="btn btn-secondary"
                  style={{ display: 'flex', gap: '4px', fontSize: '0.85rem', padding: '8px 12px', background: 'var(--accent-glow)', borderColor: 'rgba(245,158,11,0.2)', color: 'var(--accent)' }}
                  title="Settle Dues"
                >
                  <DollarSign size={16} /> Collect
                </button>

                {/* Send WhatsApp */}
                <button 
                  onClick={() => handleSendWhatsApp(p)} 
                  className="btn btn-secondary"
                  style={{ 
                    display: 'flex', 
                    gap: '4px', 
                    fontSize: '0.85rem', 
                    padding: '8px 12px', 
                    background: 'rgba(34, 197, 94, 0.1)', 
                    borderColor: 'rgba(34, 197, 94, 0.2)', 
                    color: '#22c55e' 
                  }}
                  title={p.phone ? `Send directly to ${p.phone} via WhatsApp` : "Open WhatsApp Send screen"}
                >
                  <Send size={16} /> Send
                </button>

                {/* Copy Text */}
                <button 
                  onClick={() => handleCopyReminder(p)} 
                  className="btn btn-secondary"
                  style={{ display: 'flex', gap: '4px', fontSize: '0.85rem', padding: '8px 12px' }}
                  title="Copy Reminder Text"
                >
                  {copiedId === p.id ? <Check size={16} style={{ color: 'var(--primary)' }} /> : <Copy size={16} />}
                  {copiedId === p.id ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        ))}

        {playersWithDues.length === 0 && (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '40px', color: 'var(--primary)' }}>
            🎉 Great job! There are no pending dues. All player balances are clear!
          </div>
        )}
      </div>

      {/* --- RECORD DIRECT PAYMENT MODAL --- */}
      {selectedPlayer && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Record Dues Clearance</h3>
              <button onClick={() => setSelectedPlayer(null)} className="btn-icon"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleRecordPaymentSubmit} style={{ display: 'grid', gap: '16px' }}>
              <div style={{ background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--accent)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Receiving money from</span>
                <h4 style={{ fontSize: '1.1rem' }}>{selectedPlayer.name}</h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Payment Date</label>
                  <input type="date" required value={payDate} onChange={e => setPayDate(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Payment Mode</label>
                  <select value={payMode} onChange={e => setPayMode(e.target.value as 'Cash' | 'GPay' | 'Both')}>
                    <option value="GPay">GPay</option>
                    <option value="Cash">Cash</option>
                    <option value="Both">Both (Split Entry)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Paid Amount (₹)</label>
                <input 
                  type="number" 
                  required 
                  min="1" 
                  value={payAmount} 
                  onChange={e => setPayAmount(e.target.value)} 
                />
              </div>

              {payMode === 'Both' && (
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
                    <label style={{ fontSize: '0.80rem', color: 'var(--text-secondary)' }}>Cash Share (₹)</label>
                    <input type="number" required placeholder="Cash share" value={payCashAmount} onChange={e => setPayCashAmount(e.target.value)} />
                  </div>
                  <div style={{ display: 'grid', gap: '6px' }}>
                    <label style={{ fontSize: '0.80rem', color: 'var(--text-secondary)' }}>GPay Share (₹)</label>
                    <input type="number" required placeholder="GPay share" value={payGpayAmount} onChange={e => setPayGpayAmount(e.target.value)} />
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Notes</label>
                <input type="text" placeholder="e.g. Settle dues" value={payNotes} onChange={e => setPayNotes(e.target.value)} />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }} disabled={saving}>
                {saving ? 'Saving...' : 'Confirm Clearance'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
