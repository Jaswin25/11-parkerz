import { useState } from 'react';
import { Search, UserCheck, DollarSign, X, Edit, Award, Download } from 'lucide-react';
import { Player, PlayerCategory, AttendanceWeek, AttendanceRecord, ExtraPayment, Match } from '../types';
import { calculatePlayerStats } from '../services/db';

interface PlayersProps {
  players: Player[];
  weeks: AttendanceWeek[];
  attendance: AttendanceRecord[];
  extraPayments: ExtraPayment[];
  matches: Match[];
  onUpdatePlayer: (id: string, name: string, category: PlayerCategory) => Promise<void>;
  onDeletePlayer: (id: string) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function Players({
  players,
  weeks,
  attendance,
  extraPayments,
  matches,
  onUpdatePlayer,
  onDeletePlayer,
  showToast
}: PlayersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'pending' | 'attendance' | 'paid'>('name');
  
  // Details Modal States
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'ledger' | 'attendance' | 'matches' | 'edit'>('ledger');

  // Edit fields
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<PlayerCategory>('Normal');
  const [isUpdating, setIsUpdating] = useState(false);

  // Compute all player stats once
  const playersWithStats = players.map(player => {
    const stats = calculatePlayerStats(player.id, weeks, attendance, extraPayments, matches);
    return {
      ...player,
      ...stats
    };
  });

  // Filter & Search
  const filteredPlayers = playersWithStats.filter(player => 
    player.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort
  filteredPlayers.sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    } else if (sortBy === 'pending') {
      return b.totalPending - a.totalPending;
    } else if (sortBy === 'attendance') {
      return b.attendancePercent - a.attendancePercent;
    } else if (sortBy === 'paid') {
      return b.totalPaid - a.totalPaid;
    }
    return 0;
  });

  const handleOpenDetails = (player: Player) => {
    setSelectedPlayer(player);
    setEditName(player.name);
    setEditCategory(player.category);
    setActiveModalTab('ledger');
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayer || !editName.trim()) return;
    setIsUpdating(true);
    try {
      await onUpdatePlayer(selectedPlayer.id, editName.trim(), editCategory);
      // Update selected player state so display updates
      setSelectedPlayer(prev => prev ? { ...prev, name: editName.trim(), category: editCategory } : null);
      showToast('Player profile updated successfully!');
    } catch (err: any) {
      showToast(err.message || 'Error updating player', 'error');
    }
    setIsUpdating(false);
  };

  const handleDeletePlayerClick = async () => {
    if (!selectedPlayer) return;
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete player "${selectedPlayer.name}"? This will delete all of their attendance records, payment records, and match history. This action CANNOT be undone!`
    );
    if (!confirmed) return;

    setIsUpdating(true);
    try {
      await onDeletePlayer(selectedPlayer.id);
      showToast(`Player "${selectedPlayer.name}" deleted successfully!`);
      setSelectedPlayer(null); // Close modal
    } catch (err: any) {
      showToast(err.message || 'Error deleting player', 'error');
    }
    setIsUpdating(false);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Extract ledger details for the selected player
  const getPlayerLedger = (playerId: string) => {
    const list: { type: 'Attendance' | 'Payment'; date: string; amount: number; mode: string; notes?: string }[] = [];
    
    // 1. Add attendance payments
    attendance
      .filter(a => a.player_id === playerId && a.paid_amount > 0)
      .forEach(rec => {
        const week = weeks.find(w => w.id === rec.week_id);
        list.push({
          type: 'Attendance',
          date: week ? week.date : 'Unknown Date',
          amount: rec.paid_amount,
          mode: rec.payment_mode === 'Both' ? `Both (C:${rec.cash_amount}/G:${rec.gpay_amount})` : rec.payment_mode
        });
      });

    // 2. Add extra direct payments
    extraPayments
      .filter(p => p.player_id === playerId)
      .forEach(p => {
        list.push({
          type: 'Payment',
          date: p.date,
          amount: p.amount,
          mode: p.payment_mode === 'Both' ? `Both (C:${p.cash_amount}/G:${p.gpay_amount})` : p.payment_mode,
          notes: p.notes
        });
      });

    // Sort by date descending
    return list.sort((a, b) => b.date.localeCompare(a.date));
  };

  // Get full attendance details for selected player
  const getPlayerAttendanceHistory = (playerId: string) => {
    const list: { date: string; status: 'Present' | 'Absent'; due: number; paid: number; pending: number }[] = [];
    
    attendance
      .filter(a => a.player_id === playerId)
      .forEach(rec => {
        const week = weeks.find(w => w.id === rec.week_id);
        if (week) {
          list.push({
            date: week.date,
            status: rec.status,
            due: rec.status === 'Present' ? rec.due_amount : 0,
            paid: rec.paid_amount,
            pending: rec.status === 'Present' ? rec.pending_amount : 0
          });
        }
      });

    return list.sort((a, b) => b.date.localeCompare(a.date));
  };

  // Get matches played by player
  const getPlayerMatches = (playerId: string) => {
    return matches.filter(m => m.who_played.includes(playerId));
  };

  // Download Player Standings as CSV
  const downloadCSV = () => {
    const headers = ['Name', 'Category', 'Total Paid (INR)', 'Total Pending (INR)', 'Attendance Rate (%)', 'Last Payment Date', 'Matches Played'];
    const rows = filteredPlayers.map(p => [
      p.name,
      p.category,
      p.totalPaid.toString(),
      p.totalPending.toString(),
      `${p.attendancePercent}%`,
      p.lastPaymentDate || 'N/A',
      p.matchesPlayedCount.toString()
    ]);

    const content = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `11_parkerz_player_ledger_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded players CSV report!');
  };

  return (
    <div className="fade-in" style={{ display: 'grid', gap: '20px' }}>
      
      {/* Controls: Search and Sort */}
      <div className="glass-panel" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
          <input 
            type="text" 
            placeholder="Search players by name..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
          <Search size={18} style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)'
          }} />
        </div>

        {/* Segmented Sorting Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '320px', flex: '1 1 auto' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600', whiteSpace: 'nowrap' }}>Sort:</span>
          <div className="segmented-control">
            {[
              { id: 'name', label: 'Name' },
              { id: 'pending', label: 'Dues' },
              { id: 'attendance', label: 'Attendance' },
              { id: 'paid', label: 'Paid' }
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

        {/* Download CSV button */}
        <button 
          onClick={downloadCSV} 
          className="btn btn-secondary" 
          style={{ 
            height: '42px', 
            padding: '10px 16px', 
            borderColor: 'var(--secondary)', 
            color: 'var(--secondary)',
            flex: '0 0 auto' 
          }}
          title="Download all players financial report as CSV"
        >
          <Download size={18} /> Export CSV
        </button>
      </div>

      {/* Grid of Players */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '16px'
      }}>
        {filteredPlayers.map(player => (
          <div 
            key={player.id} 
            className="glass-panel" 
            onClick={() => handleOpenDetails(player)}
            style={{
              cursor: 'pointer',
              display: 'grid',
              gap: '12px',
              transition: 'var(--transition-fast)',
              borderBottom: player.totalPending > 0 ? '2px solid var(--accent)' : '2px solid var(--primary)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--glass-shadow)';
            }}
          >
            {/* Header: Name and Category badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{player.name}</h3>
              <span className={`badge badge-${player.category.toLowerCase()}`}>
                {player.category}
              </span>
            </div>

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Paid</span>
                <p style={{ fontWeight: '600', color: 'var(--primary)' }}>{formatCurrency(player.totalPaid)}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pending</span>
                <p style={{ fontWeight: '600', color: player.totalPending > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {formatCurrency(player.totalPending)}
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Attendance</span>
                <p style={{ fontWeight: '600' }}>{player.attendancePercent}%</p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last Payment</span>
                <p style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{player.lastPaymentDate || 'None yet'}</p>
              </div>
            </div>
          </div>
        ))}

        {filteredPlayers.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            No players found matching "{searchTerm}"
          </div>
        )}
      </div>

      {/* --- PLAYER LEDGER DETAILS MODAL --- */}
      {selectedPlayer && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem' }}>{selectedPlayer.name}</h2>
                <span className={`badge badge-${selectedPlayer.category.toLowerCase()}`} style={{ marginTop: '4px' }}>
                  {selectedPlayer.category} (₹{selectedPlayer.category === 'Normal' ? 50 : 30}/week)
                </span>
              </div>
              <button onClick={() => setSelectedPlayer(null)} className="btn-icon">
                <X size={18} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div style={{
              display: 'flex',
              background: 'rgba(0,0,0,0.2)',
              borderBottom: '1px solid var(--border-color)'
            }}>
              {[
                { id: 'ledger', label: 'Payment Ledger', icon: DollarSign },
                { id: 'attendance', label: 'Attendance', icon: UserCheck },
                { id: 'matches', label: 'Matches', icon: Award },
                { id: 'edit', label: 'Edit Profile', icon: Edit }
              ].map(t => {
                const Icon = t.icon;
                const active = activeModalTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveModalTab(t.id as any)}
                    style={{
                      flex: 1,
                      padding: '12px 6px',
                      background: active ? 'rgba(255,255,255,0.03)' : 'transparent',
                      color: active ? 'var(--primary)' : 'var(--text-secondary)',
                      borderBottom: active ? '2px solid var(--primary)' : 'none',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontWeight: active ? '600' : '400'
                    }}
                  >
                    <Icon size={16} />
                    <span className="hide-mobile" style={{ display: 'inline' }}>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', maxHeight: '50vh', overflowY: 'auto' }}>
              
              {/* Tab 1: Payment Ledger */}
              {activeModalTab === 'ledger' && (
                <div style={{ display: 'grid', gap: '12px' }}>
                  <h4 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>All Received Payments</h4>
                  
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Method</th>
                          <th>Paid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getPlayerLedger(selectedPlayer.id).map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.date}</td>
                            <td>
                              <span className={`badge ${item.type === 'Attendance' ? 'badge-normal' : 'badge-school'}`}>
                                {item.type}
                              </span>
                            </td>
                            <td>{item.mode} {item.notes ? `(${item.notes})` : ''}</td>
                            <td style={{ fontWeight: '600', color: 'var(--primary)' }}>{formatCurrency(item.amount)}</td>
                          </tr>
                        ))}
                        {getPlayerLedger(selectedPlayer.id).length === 0 && (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                              No payments recorded yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 2: Attendance History */}
              {activeModalTab === 'attendance' && (
                <div style={{ display: 'grid', gap: '12px' }}>
                  <h4 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Session Register</h4>

                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Sunday Date</th>
                          <th>Status</th>
                          <th>Due</th>
                          <th>Paid</th>
                          <th>Pending</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getPlayerAttendanceHistory(selectedPlayer.id).map((week, idx) => (
                          <tr key={idx}>
                            <td>{week.date}</td>
                            <td>
                              <span className={`badge ${week.status === 'Present' ? 'badge-normal' : 'badge-loss'}`}>
                                {week.status}
                              </span>
                            </td>
                            <td>{formatCurrency(week.due)}</td>
                            <td>{formatCurrency(week.paid)}</td>
                            <td style={{ color: week.pending > 0 ? 'var(--accent)' : 'inherit', fontWeight: week.pending > 0 ? '600' : '400' }}>
                              {formatCurrency(week.pending)}
                            </td>
                          </tr>
                        ))}
                        {getPlayerAttendanceHistory(selectedPlayer.id).length === 0 && (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                              No attendance sessions marked yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: Match betting logs */}
              {activeModalTab === 'matches' && (
                <div style={{ display: 'grid', gap: '12px' }}>
                  <h4 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Matches Played</h4>

                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Opponent</th>
                          <th>Bet</th>
                          <th>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getPlayerMatches(selectedPlayer.id).map((match, idx) => (
                          <tr key={idx}>
                            <td>{match.date}</td>
                            <td>{match.opponent}</td>
                            <td>{formatCurrency(match.bet_amount)}</td>
                            <td>
                              <span className={`badge ${match.result === 'Win' ? 'badge-win' : 'badge-loss'}`}>
                                {match.result}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {getPlayerMatches(selectedPlayer.id).length === 0 && (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                              No matches played yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 4: Edit Details */}
              {activeModalTab === 'edit' && (
                <form onSubmit={handleUpdateSubmit} style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Name</label>
                    <input 
                      type="text" 
                      required 
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'grid', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Category</label>
                    <select value={editCategory} onChange={e => setEditCategory(e.target.value as PlayerCategory)}>
                      <option value="Normal">Normal (₹50)</option>
                      <option value="Bike">Bike (₹30)</option>
                      <option value="School">School (₹30)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isUpdating}>
                      {isUpdating ? 'Updating...' : 'Save Changes'}
                    </button>
                    <button 
                      type="button" 
                      onClick={handleDeletePlayerClick} 
                      className="btn btn-danger" 
                      style={{ 
                        background: 'var(--accent)', 
                        borderColor: 'transparent',
                        flex: '0 0 auto',
                        padding: '12px 18px',
                        fontWeight: '600'
                      }}
                      disabled={isUpdating}
                    >
                      Delete Player
                    </button>
                  </div>
                </form>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
