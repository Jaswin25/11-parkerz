import { useState, useEffect } from 'react';
import { Calendar, Save, Trash2, CheckSquare, Plus, AlertTriangle, Download, Edit } from 'lucide-react';
import { Player, AttendanceWeek, AttendanceRecord, PaymentMode } from '../types';

interface AttendanceProps {
  isViewer?: boolean;
  players: Player[];
  weeks: AttendanceWeek[];
  attendance: AttendanceRecord[];
  onAddWeek: (date: string) => Promise<AttendanceWeek>;
  onDeleteWeek: (weekId: string) => Promise<void>;
  onUpdateWeek: (weekId: string, date: string) => Promise<void>;
  onSaveAttendance: (weekId: string, records: Omit<AttendanceRecord, 'id' | 'week_id' | 'created_at'>[]) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function Attendance({
  isViewer = false,
  players,
  weeks,
  attendance,
  onAddWeek,
  onDeleteWeek,
  onUpdateWeek,
  onSaveAttendance,
  showToast
}: AttendanceProps) {
  const [selectedWeekId, setSelectedWeekId] = useState<string>('');
  const [newWeekDate, setNewWeekDate] = useState<string>('');
  const [showAddWeek, setShowAddWeek] = useState(false);
  const [saving, setSaving] = useState(false);

  // Core attendance editing state for the active week
  // Maps player_id -> editing details
  const [recordsState, setRecordsState] = useState<Record<string, {
    status: 'Present' | 'Absent';
    due_amount: number;
    paid_amount: number;
    payment_mode: PaymentMode;
    cash_amount: number;
    gpay_amount: number;
  }>>({});

  // 1. Handle week selection change
  useEffect(() => {
    if (weeks.length > 0 && !selectedWeekId) {
      setSelectedWeekId(weeks[0].id);
    }
  }, [weeks, selectedWeekId]);

  // 2. Load attendance records when selected week changes
  useEffect(() => {
    if (!selectedWeekId) {
      setRecordsState({});
      return;
    }

    // Filter existing database attendance records for this week
    const weekRecords = attendance.filter(a => a.week_id === selectedWeekId);
    const state: typeof recordsState = {};

    players.forEach(player => {
      const existing = weekRecords.find(r => r.player_id === player.id);
      if (existing) {
        state[player.id] = {
          status: existing.status,
          due_amount: existing.due_amount,
          paid_amount: existing.paid_amount,
          payment_mode: existing.payment_mode,
          cash_amount: existing.cash_amount,
          gpay_amount: existing.gpay_amount
        };
      } else {
        // Prefill default state
        const fee = player.category === 'Normal' ? 50 : 30;
        state[player.id] = {
          status: 'Absent',
          due_amount: fee,
          paid_amount: 0,
          payment_mode: 'None',
          cash_amount: 0,
          gpay_amount: 0
        };
      }
    });

    setRecordsState(state);
  }, [selectedWeekId, attendance, players]);

  // Handle toggling present/absent
  const handleStatusToggle = (playerId: string) => {
    setRecordsState(prev => {
      const current = prev[playerId];
      const player = players.find(p => p.id === playerId);
      const fee = player ? (player.category === 'Normal' ? 50 : 30) : 50;
      
      const newStatus = current.status === 'Present' ? 'Absent' : 'Present';
      
      if (newStatus === 'Present') {
        return {
          ...prev,
          [playerId]: {
            ...current,
            status: 'Present',
            due_amount: fee,
            paid_amount: fee, // Pre-fill with full payment as default time saver!
            payment_mode: 'GPay', // Pre-fill default payment mode
            cash_amount: 0,
            gpay_amount: fee
          }
        };
      } else {
        return {
          ...prev,
          [playerId]: {
            ...current,
            status: 'Absent',
            due_amount: fee,
            paid_amount: 0,
            payment_mode: 'None',
            cash_amount: 0,
            gpay_amount: 0
          }
        };
      }
    });
  };

  // Handle changes in due amount
  const handleDueChange = (playerId: string, val: string) => {
    const amt = parseFloat(val) || 0;
    setRecordsState(prev => {
      const current = prev[playerId];
      return {
        ...prev,
        [playerId]: {
          ...current,
          due_amount: amt,
          // Re-calculate payments if they were paying full
          paid_amount: current.paid_amount === current.due_amount ? amt : current.paid_amount
        }
      };
    });
  };

  // Handle changes in paid amount
  const handlePaidChange = (playerId: string, val: string) => {
    const amt = parseFloat(val) || 0;
    setRecordsState(prev => {
      const current = prev[playerId];
      let cash = current.cash_amount;
      let gpay = current.gpay_amount;

      if (current.payment_mode === 'Cash') {
        cash = amt;
        gpay = 0;
      } else if (current.payment_mode === 'GPay') {
        cash = 0;
        gpay = amt;
      } else if (current.payment_mode === 'Both') {
        // Keep cash split as is, adjust GPay
        gpay = Math.max(0, amt - cash);
      }

      return {
        ...prev,
        [playerId]: {
          ...current,
          paid_amount: amt,
          cash_amount: cash,
          gpay_amount: gpay
        }
      };
    });
  };

  // Handle changing payment mode
  const handleModeChange = (playerId: string, mode: PaymentMode) => {
    setRecordsState(prev => {
      const current = prev[playerId];
      let cash = 0;
      let gpay = 0;

      if (mode === 'Cash') {
        cash = current.paid_amount;
      } else if (mode === 'GPay') {
        gpay = current.paid_amount;
      } else if (mode === 'Both') {
        // Split half/half by default, or 0/total
        gpay = current.paid_amount;
      }

      return {
        ...prev,
        [playerId]: {
          ...current,
          payment_mode: mode,
          cash_amount: cash,
          gpay_amount: gpay
        }
      };
    });
  };

  // Handle manual splits
  const handleSplitChange = (playerId: string, wallet: 'cash' | 'gpay', val: string) => {
    const amt = parseFloat(val) || 0;
    setRecordsState(prev => {
      const current = prev[playerId];
      let cash = current.cash_amount;
      let gpay = current.gpay_amount;

      if (wallet === 'cash') {
        cash = amt;
        // Total paid amount remains, adjust GPay to keep total matching
        gpay = Math.max(0, current.paid_amount - cash);
      } else {
        gpay = amt;
        cash = Math.max(0, current.paid_amount - gpay);
      }

      return {
        ...prev,
        [playerId]: {
          ...current,
          cash_amount: cash,
          gpay_amount: gpay
        }
      };
    });
  };

  // Create new session week
  const handleAddWeekSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWeekDate) return;

    // Check if week already exists
    const dateExists = weeks.some(w => w.date === newWeekDate);
    if (dateExists) {
      showToast('A session for this date already exists!', 'error');
      return;
    }

    try {
      const newWeek = await onAddWeek(newWeekDate);
      showToast(`Created new Sunday session for ${newWeekDate}!`);
      setSelectedWeekId(newWeek.id);
      setNewWeekDate('');
      setShowAddWeek(false);
    } catch (err: any) {
      showToast(err.message || 'Error adding week', 'error');
    }
  };

  // Edit current session week date
  const handleEditWeekDate = async () => {
    if (!selectedWeekId) return;
    const week = weeks.find(w => w.id === selectedWeekId);
    if (!week) return;

    const newDate = window.prompt(`Edit session date for ${week.date}:`, week.date);
    if (!newDate || newDate === week.date) return;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(newDate)) {
      showToast('Invalid date format! Please use YYYY-MM-DD.', 'error');
      return;
    }

    try {
      await onUpdateWeek(selectedWeekId, newDate);
      showToast(`Session date updated to ${newDate}!`);
    } catch (err: any) {
      showToast(err.message || 'Error updating week date', 'error');
    }
  };

  // Delete current session week
  const handleDeleteWeek = async () => {
    if (!selectedWeekId) return;
    const week = weeks.find(w => w.id === selectedWeekId);
    if (!week) return;

    if (!window.confirm(`Are you sure you want to delete the attendance register for ${week.date}? This will delete all attendance checks and payment logs for this week!`)) {
      return;
    }

    try {
      await onDeleteWeek(selectedWeekId);
      showToast(`Deleted session ${week.date}.`);
      setSelectedWeekId('');
    } catch (err: any) {
      showToast(err.message || 'Error deleting week', 'error');
    }
  };

  // Save changes to database
  const handleSaveAll = async () => {
    if (!selectedWeekId) return;
    setSaving(true);

    try {
      const recordsToSave = Object.entries(recordsState).map(([playerId, state]) => {
        const pending = state.status === 'Present' 
          ? Math.max(0, state.due_amount - state.paid_amount) 
          : 0;

        return {
          player_id: playerId,
          status: state.status,
          due_amount: state.status === 'Present' ? state.due_amount : 0,
          paid_amount: state.paid_amount,
          pending_amount: pending,
          payment_mode: state.status === 'Present' ? state.payment_mode : 'None',
          cash_amount: state.status === 'Present' ? state.cash_amount : 0,
          gpay_amount: state.status === 'Present' ? state.gpay_amount : 0
        };
      });

      await onSaveAttendance(selectedWeekId, recordsToSave);
      showToast('Attendance register saved successfully!');
    } catch (err: any) {
      showToast(err.message || 'Error saving attendance', 'error');
    }
    setSaving(false);
  };

  // Download weekly attendance details as CSV
  const downloadCSV = () => {
    const selectedWeek = weeks.find(w => w.id === selectedWeekId);
    const dateStr = selectedWeek ? selectedWeek.date : 'Unknown';
    const headers = ['Player Name', 'Category', 'Status', 'Due Amount (INR)', 'Paid Amount (INR)', 'Payment Mode', 'Cash Portion (INR)', 'GPay Portion (INR)', 'Pending Dues (INR)'];
    
    const rows = players.map(player => {
      const state = recordsState[player.id];
      if (!state) return [];
      const pending = state.status === 'Present' ? Math.max(0, state.due_amount - state.paid_amount) : 0;
      return [
        player.name,
        player.category,
        state.status,
        state.status === 'Present' ? state.due_amount.toString() : '0',
        state.status === 'Present' ? state.paid_amount.toString() : '0',
        state.status === 'Present' ? state.payment_mode : 'None',
        state.status === 'Present' ? state.cash_amount.toString() : '0',
        state.status === 'Present' ? state.gpay_amount.toString() : '0',
        pending.toString()
      ];
    }).filter(row => row.length > 0);

    const content = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `11_parkerz_attendance_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded attendance CSV!');
  };

  return (
    <div className="fade-in" style={{ display: 'grid', gap: '20px' }}>
      
      {/* Selector and Actions Panel */}
      <div className="glass-panel" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        
        {/* Week Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '240px', flex: '1 1 auto' }}>
          <Calendar size={18} style={{ color: 'var(--text-secondary)' }} />
          <select 
            value={selectedWeekId} 
            onChange={e => setSelectedWeekId(e.target.value)}
            disabled={showAddWeek}
          >
            <option value="">-- Select Session Date --</option>
            {weeks.map(w => (
              <option key={w.id} value={w.id}>{w.date} (Sunday)</option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {!isViewer && !showAddWeek && (
            <button onClick={() => setShowAddWeek(true)} className="btn btn-secondary">
              <Plus size={18} /> New Session
            </button>
          )}

          {!isViewer && showAddWeek && (
            <form onSubmit={handleAddWeekSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input 
                type="date" 
                required 
                value={newWeekDate} 
                onChange={e => setNewWeekDate(e.target.value)}
                style={{ width: '160px', padding: '6px 10px' }}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 12px' }}>Create</button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ padding: '8px 12px' }}
                onClick={() => setShowAddWeek(false)}
              >
                Cancel
              </button>
            </form>
          )}

          {!isViewer && selectedWeekId && (
            <>
              <button 
                onClick={handleEditWeekDate} 
                className="btn btn-secondary" 
                style={{ color: 'var(--secondary)', borderColor: 'rgba(56,189,248,0.2)' }}
                title="Edit Session Date"
              >
                <Edit size={18} />
              </button>
              <button 
                onClick={handleDeleteWeek} 
                className="btn btn-secondary" 
                style={{ color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }}
                title="Delete Session"
              >
                <Trash2 size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Attendance checklist sheet */}
      {selectedWeekId ? (
        <div className="glass-panel" style={{ display: 'grid', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckSquare size={20} className="text-secondary" style={{ color: 'var(--secondary)' }} />
              Weekly Register Sheets
            </h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="button"
                onClick={downloadCSV} 
                className="btn btn-secondary" 
                style={{ 
                  padding: '10px 16px', 
                  fontSize: '0.9rem', 
                  borderColor: 'var(--secondary)', 
                  color: 'var(--secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="Download selected Sunday attendance register as CSV"
              >
                <Download size={18} /> Export Attendance
              </button>
              {!isViewer && (
                <button onClick={handleSaveAll} className="btn btn-primary" disabled={saving}>
                  <Save size={18} /> {saving ? 'Saving...' : 'Save Attendance'}
                </button>
              )}
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th style={{ textAlign: 'center', width: '160px' }}>Status</th>
                  <th>Weekly Fee (₹)</th>
                  <th>Paid Amount (₹)</th>
                  <th>Mode</th>
                  <th>Pending Dues</th>
                </tr>
              </thead>
              <tbody>
                {players.map(player => {
                  const state = recordsState[player.id];
                  if (!state) return null;

                  const isPresent = state.status === 'Present';
                  const pending = isPresent ? Math.max(0, state.due_amount - state.paid_amount) : 0;

                  return (
                    <tr key={player.id} style={{ 
                      opacity: isPresent ? 1 : 0.6,
                      background: isPresent ? 'rgba(16, 185, 129, 0.02)' : 'transparent'
                    }}>
                      {/* Name */}
                      <td style={{ fontWeight: '600' }}>
                        <div>
                          {player.name}
                          <span className={`badge badge-${player.category.toLowerCase()}`} style={{ fontSize: '0.65rem', marginLeft: '6px', padding: '2px 6px' }}>
                            {player.category}
                          </span>
                        </div>
                      </td>

                      {/* Status Toggle buttons */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', background: 'rgba(0, 0, 0, 0.25)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)', gap: '4px' }}>
                          <button
                            type="button"
                            disabled={isViewer}
                            onClick={() => { if (!isPresent && !isViewer) handleStatusToggle(player.id); }}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              cursor: isViewer ? 'not-allowed' : 'pointer',
                              background: isPresent ? 'var(--primary)' : 'transparent',
                              color: isPresent ? '#fff' : 'var(--text-secondary)',
                              boxShadow: isPresent ? '0 2px 6px var(--primary-glow)' : 'none',
                              transition: 'var(--transition-fast)',
                              opacity: isViewer ? 0.7 : 1
                            }}
                          >
                            Present
                          </button>
                          <button
                            type="button"
                            disabled={isViewer}
                            onClick={() => { if (isPresent && !isViewer) handleStatusToggle(player.id); }}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              cursor: isViewer ? 'not-allowed' : 'pointer',
                              background: !isPresent ? 'var(--accent)' : 'transparent',
                              color: !isPresent ? '#fff' : 'var(--text-secondary)',
                              boxShadow: !isPresent ? '0 2px 6px var(--accent-glow)' : 'none',
                              transition: 'var(--transition-fast)',
                              opacity: isViewer ? 0.7 : 1
                            }}
                          >
                            Absent
                          </button>
                        </div>
                      </td>

                      {/* Due Amount input */}
                      <td>
                        {isPresent ? (
                          <input 
                            type="number" 
                            min="0"
                            disabled={isViewer}
                            value={state.due_amount} 
                            onChange={e => handleDueChange(player.id, e.target.value)}
                            style={{ width: '70px', padding: '4px 8px', cursor: isViewer ? 'not-allowed' : 'text' }}
                          />
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>

                      {/* Paid Amount input */}
                      <td>
                        {isPresent ? (
                          <input 
                            type="number" 
                            min="0"
                            disabled={isViewer}
                            value={state.paid_amount} 
                            onChange={e => handlePaidChange(player.id, e.target.value)}
                            style={{ width: '85px', padding: '4px 8px', border: pending > 0 ? '1px solid var(--accent)' : '1px solid var(--border-color)', cursor: isViewer ? 'not-allowed' : 'text' }}
                          />
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>

                      {/* Payment Mode Selector & split splits */}
                      <td>
                        {isPresent ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <select 
                              value={state.payment_mode} 
                              disabled={isViewer}
                              onChange={e => handleModeChange(player.id, e.target.value as PaymentMode)}
                              style={{ width: '90px', padding: '4px 6px', fontSize: '0.85rem', cursor: isViewer ? 'not-allowed' : 'pointer' }}
                            >
                              <option value="GPay">GPay</option>
                              <option value="Cash">Cash</option>
                              <option value="Both">Both</option>
                            </select>

                            {/* Split details if 'Both' */}
                            {state.payment_mode === 'Both' && (
                              <div style={{ display: 'flex', gap: '4px', fontSize: '0.75rem', marginTop: '2px' }}>
                                <input 
                                  type="number" 
                                  placeholder="Cash"
                                  disabled={isViewer}
                                  value={state.cash_amount}
                                  onChange={e => handleSplitChange(player.id, 'cash', e.target.value)}
                                  style={{ width: '45px', padding: '2px 4px', fontSize: '0.75rem', cursor: isViewer ? 'not-allowed' : 'text' }}
                                  title="Cash split amount"
                                />
                                <input 
                                  type="number" 
                                  placeholder="GPay"
                                  disabled={isViewer}
                                  value={state.gpay_amount}
                                  onChange={e => handleSplitChange(player.id, 'gpay', e.target.value)}
                                  style={{ width: '45px', padding: '2px 4px', fontSize: '0.75rem', cursor: isViewer ? 'not-allowed' : 'text' }}
                                  title="GPay split amount"
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>

                      {/* Auto remaining pending */}
                      <td>
                        {isPresent ? (
                          <span style={{ 
                            color: pending > 0 ? 'var(--accent)' : 'var(--primary)',
                            fontWeight: '600'
                          }}>
                            {pending > 0 ? `₹${pending}` : 'Paid'}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!isViewer && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button onClick={handleSaveAll} className="btn btn-primary" disabled={saving}>
                <Save size={18} /> {saving ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
          <AlertTriangle size={36} className="text-accent" style={{ color: 'var(--accent)', margin: '0 auto 12px' }} />
          <h4 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>No Register Loaded</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Please select an existing session date from the dropdown above, or click <strong>New Session</strong> to start a Sunday register.
          </p>
        </div>
      )}

    </div>
  );
}
