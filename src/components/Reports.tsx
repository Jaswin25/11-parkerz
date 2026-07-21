import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Player, AttendanceWeek, AttendanceRecord, Expense, Match, ExtraPayment } from '../types';
import { calculatePlayerStats } from '../services/db';

interface ReportsProps {
  players: Player[];
  weeks: AttendanceWeek[];
  attendance: AttendanceRecord[];
  expenses: Expense[];
  matches: Match[];
  extraPayments: ExtraPayment[];
}

export default function Reports({
  players,
  weeks,
  attendance,
  expenses,
  matches,
  extraPayments
}: ReportsProps) {
  const [activeReportTab, setActiveReportTab] = useState<'weekly' | 'monthly' | 'player'>('weekly');
  
  // Weekly report state
  const [selectedWeekId, setSelectedWeekId] = useState<string>(weeks[0]?.id || '');
  
  // Monthly report state
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Player report state
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(players[0]?.id || '');

  // Helper date conversions
  const getStartAndEndOfWeek = (sundayDateStr: string) => {
    const sun = new Date(sundayDateStr);
    const mon = new Date(sun);
    mon.setDate(sun.getDate() - 6); // Monday of that week
    return {
      start: mon.toISOString().split('T')[0],
      end: sundayDateStr
    };
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // ==========================================
  // WEEKLY REPORT CALCULATIONS
  // ==========================================
  const getWeeklyReport = () => {
    if (!selectedWeekId) return null;
    const week = weeks.find(w => w.id === selectedWeekId);
    if (!week) return null;

    const { start, end } = getStartAndEndOfWeek(week.date);
    
    // 1. Weekly collection
    const weekAttendance = attendance.filter(a => a.week_id === selectedWeekId);
    const collectionPaid = weekAttendance.reduce((sum, a) => sum + a.paid_amount, 0);
    const collectionPending = weekAttendance.reduce((sum, a) => sum + (a.status === 'Present' ? a.pending_amount : 0), 0);
    const presentCount = weekAttendance.filter(a => a.status === 'Present').length;

    // 2. Same-week expenses
    const weekExpenses = expenses.filter(e => e.date >= start && e.date <= end);
    const expensesTotal = weekExpenses.reduce((sum, e) => sum + e.amount, 0);

    // 3. Same-week matches
    const weekMatches = matches.filter(m => m.date >= start && m.date <= end);
    const matchesPnL = weekMatches.reduce((sum, m) => sum + m.amount_won_lost, 0);
    const matchesWon = weekMatches.filter(m => m.result === 'Win').length;
    const matchesLost = weekMatches.filter(m => m.result === 'Loss').length;

    return {
      date: week.date,
      start,
      end,
      presentCount,
      collectionPaid,
      collectionPending,
      expensesTotal,
      expensesList: weekExpenses,
      matchesPnL,
      matchesWon,
      matchesLost,
      netProfitLoss: collectionPaid - expensesTotal + matchesPnL
    };
  };

  // ==========================================
  // MONTHLY REPORT CALCULATIONS
  // ==========================================
  const getMonthlyReport = () => {
    const [year, month] = selectedMonth.split('-');
    
    // Attendance weeks in this month
    const monthWeeks = weeks.filter(w => w.date.startsWith(selectedMonth));
    const monthWeekIds = monthWeeks.map(w => w.id);

    // 1. Weekly collections paid in this month
    const collectionsPaid = attendance
      .filter(a => monthWeekIds.includes(a.week_id))
      .reduce((sum, a) => sum + a.paid_amount, 0);

    // 2. Extra direct payments made in this month
    const directPaid = extraPayments
      .filter(p => p.date.startsWith(selectedMonth))
      .reduce((sum, p) => sum + p.amount, 0);

    const totalCollection = collectionsPaid + directPaid;

    // 3. Expenses in this month
    const monthExpenses = expenses.filter(e => e.date.startsWith(selectedMonth));
    const totalExpenses = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

    // 4. Matches PnL in this month
    const monthMatches = matches.filter(m => m.date.startsWith(selectedMonth));
    const matchesPnL = monthMatches.reduce((sum, m) => sum + m.amount_won_lost, 0);

    // Top pending players overall (not just this month, for action list)
    const topPending = players
      .map(p => {
        const stats = calculatePlayerStats(p.id, weeks, attendance, extraPayments, matches);
        return {
          name: p.name,
          pending: stats.totalPending,
          category: p.category
        };
      })
      .filter(p => p.pending > 0)
      .sort((a, b) => b.pending - a.pending)
      .slice(0, 5);

    const totalAttendanceDays = monthWeeks.length;
    let averageAttendanceRate = 0;
    if (totalAttendanceDays > 0) {
      const totalPresents = attendance
        .filter(a => monthWeekIds.includes(a.week_id) && a.status === 'Present')
        .length;
      averageAttendanceRate = Math.round((totalPresents / (players.length * totalAttendanceDays)) * 100);
    }

    return {
      monthName: new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'long', year: 'numeric' }),
      totalCollection,
      totalExpenses,
      matchesPnL,
      averageAttendanceRate,
      topPending,
      netBalanceChange: totalCollection - totalExpenses + matchesPnL
    };
  };

  // ==========================================
  // PLAYER LIFETIME STATS
  // ==========================================
  const getPlayerReport = () => {
    if (!selectedPlayerId) return null;
    const player = players.find(p => p.id === selectedPlayerId);
    if (!player) return null;

    const stats = calculatePlayerStats(selectedPlayerId, weeks, attendance, extraPayments, matches);
    
    // Find player match details
    const playerMatches = matches
      .filter(m => m.who_played.includes(selectedPlayerId))
      .map(m => ({
        opponent: m.opponent,
        date: m.date,
        result: m.result
      }));

    return {
      name: player.name,
      category: player.category,
      ...stats,
      playerMatches
    };
  };

  const weekReport = getWeeklyReport();
  const monthReport = getMonthlyReport();
  const playerReport = getPlayerReport();

  return (
    <div className="fade-in" style={{ display: 'grid', gap: '20px' }}>
      
      {/* Tab Selector */}
      <div className="glass-panel" style={{ display: 'flex', padding: '10px', gap: '8px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActiveReportTab('weekly')} 
          className="btn" 
          style={{
            flex: 1, 
            background: activeReportTab === 'weekly' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
            color: activeReportTab === 'weekly' ? '#052e16' : 'var(--text-primary)'
          }}
        >
          Weekly Report
        </button>
        <button 
          onClick={() => setActiveReportTab('monthly')} 
          className="btn"
          style={{
            flex: 1, 
            background: activeReportTab === 'monthly' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
            color: activeReportTab === 'monthly' ? '#052e16' : 'var(--text-primary)'
          }}
        >
          Monthly Report
        </button>
        <button 
          onClick={() => setActiveReportTab('player')} 
          className="btn"
          style={{
            flex: 1, 
            background: activeReportTab === 'player' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
            color: activeReportTab === 'player' ? '#052e16' : 'var(--text-primary)'
          }}
        >
          Player Ledger Stats
        </button>
      </div>

      {/* ==========================================
          WEEKLY REPORT DISPLAY
          ========================================== */}
      {activeReportTab === 'weekly' && (
        <div style={{ display: 'grid', gap: '20px' }}>
          
          {/* Week Selector */}
          <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Select Weekly Cycle Sunday:</span>
            <select value={selectedWeekId} onChange={e => setSelectedWeekId(e.target.value)} style={{ width: '200px' }}>
              {weeks.map(w => (
                <option key={w.id} value={w.id}>{w.date}</option>
              ))}
            </select>
          </div>

          {weekReport ? (
            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Stat Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                
                <div className="glass-panel" style={{ borderLeft: '4px solid var(--primary)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>SESSION COLLECTION</span>
                  <h3 style={{ fontSize: '1.5rem', marginTop: '4px', color: 'var(--primary)' }}>{formatCurrency(weekReport.collectionPaid)}</h3>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>From {weekReport.presentCount} present players</span>
                </div>

                <div className="glass-panel" style={{ borderLeft: '4px solid var(--danger)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>WEEKLY EXPENSES</span>
                  <h3 style={{ fontSize: '1.5rem', marginTop: '4px', color: 'var(--danger)' }}>{formatCurrency(weekReport.expensesTotal)}</h3>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Gear/stumps/ground</span>
                </div>

                <div className="glass-panel" style={{ borderLeft: '4px solid var(--secondary)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>MATCH BETTING P&L</span>
                  <h3 style={{ fontSize: '1.5rem', marginTop: '4px', color: weekReport.matchesPnL >= 0 ? 'var(--secondary)' : 'var(--danger)' }}>
                    {weekReport.matchesPnL >= 0 ? '+' : ''}{formatCurrency(weekReport.matchesPnL)}
                  </h3>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{weekReport.matchesWon} Won / {weekReport.matchesLost} Lost</span>
                </div>

                <div className="glass-panel" style={{ borderLeft: '4px solid var(--accent)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>PENDING DUES</span>
                  <h3 style={{ fontSize: '1.5rem', marginTop: '4px', color: 'var(--accent)' }}>{formatCurrency(weekReport.collectionPending)}</h3>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Owed by absent/partial players</span>
                </div>
              </div>

              {/* Net P&L Alert */}
              <div className="glass-panel" style={{
                background: weekReport.netProfitLoss >= 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                border: `1px solid ${weekReport.netProfitLoss >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <h4 style={{ fontSize: '1.1rem' }}>Net Cash Flow (This Week)</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Calculated as Weekly Paid Collections - Expenses + Matches Won/Lost</p>
                </div>
                <h3 style={{ color: weekReport.netProfitLoss >= 0 ? 'var(--primary)' : 'var(--danger)', fontSize: '1.6rem' }}>
                  {weekReport.netProfitLoss >= 0 ? '+' : ''}{formatCurrency(weekReport.netProfitLoss)}
                </h3>
              </div>

              {/* Expense Ledger for that week */}
              <div className="glass-panel">
                <h4 style={{ fontSize: '1rem', marginBottom: '12px' }}>Expenses Incurred This Week</h4>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Item</th>
                        <th>Wallet</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weekReport.expensesList.map(e => (
                        <tr key={e.id}>
                          <td>{e.date}</td>
                          <td>{e.item} ({e.category})</td>
                          <td><span className={`badge badge-${e.paid_from.toLowerCase()}`}>{e.paid_from}</span></td>
                          <td style={{ color: 'var(--danger)', fontWeight: 'bold' }}>-{formatCurrency(e.amount)}</td>
                        </tr>
                      ))}
                      {weekReport.expensesList.length === 0 && (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No expenses recorded this week.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '30px' }}>
              Please select or create a Sunday week session to inspect records.
            </div>
          )}

        </div>
      )}

      {/* ==========================================
          MONTHLY REPORT DISPLAY
          ========================================== */}
      {activeReportTab === 'monthly' && (
        <div style={{ display: 'grid', gap: '20px' }}>
          
          {/* Month selector */}
          <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Select Month:</span>
            <input 
              type="month" 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(e.target.value)}
              style={{ width: '180px', padding: '6px 10px' }}
            />
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            
            <div className="glass-panel" style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>MONTHLY INCOME COLLECTED</span>
              <h3 style={{ fontSize: '1.6rem', color: 'var(--primary)' }}>{formatCurrency(monthReport.totalCollection)}</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Register fees + dues cleared</p>
            </div>

            <div className="glass-panel" style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>MONTHLY EXPENSES OUTFLOW</span>
              <h3 style={{ fontSize: '1.6rem', color: 'var(--danger)' }}>{formatCurrency(monthReport.totalExpenses)}</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Equipment & rent purchases</p>
            </div>

            <div className="glass-panel" style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>BETTING PROFIT / LOSS</span>
              <h3 style={{ fontSize: '1.6rem', color: monthReport.matchesPnL >= 0 ? 'var(--secondary)' : 'var(--danger)' }}>
                {monthReport.matchesPnL >= 0 ? '+' : ''}{formatCurrency(monthReport.matchesPnL)}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Direct wallet balance change</p>
            </div>

            <div className="glass-panel" style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>AVG ATTENDANCE RATE</span>
              <h3 style={{ fontSize: '1.6rem' }}>{monthReport.averageAttendanceRate}%</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Of total team presence</p>
            </div>
          </div>

          {/* Month Cash Change summary */}
          <div className="glass-panel" style={{
            background: monthReport.netBalanceChange >= 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
            border: `1px solid ${monthReport.netBalanceChange >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <h4 style={{ fontSize: '1.1rem' }}>Net Wallet Balance Change for {monthReport.monthName}</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Income - Expenses + Betting P&L</p>
            </div>
            <h3 style={{ color: monthReport.netBalanceChange >= 0 ? 'var(--primary)' : 'var(--danger)', fontSize: '1.6rem' }}>
              {monthReport.netBalanceChange >= 0 ? '+' : ''}{formatCurrency(monthReport.netBalanceChange)}
            </h3>
          </div>

          {/* Top pending list */}
          <div className="glass-panel">
            <h4 style={{ fontSize: '1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} style={{ color: 'var(--accent)' }} />
              Top Pending Players (Current Action List)
            </h4>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Player Name</th>
                    <th>Category</th>
                    <th>Total Pending Dues</th>
                  </tr>
                </thead>
                <tbody>
                  {monthReport.topPending.map((p, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: '600' }}>{p.name}</td>
                      <td><span className={`badge badge-${p.category.toLowerCase()}`}>{p.category}</span></td>
                      <td style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{formatCurrency(p.pending)}</td>
                    </tr>
                  ))}
                  {monthReport.topPending.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', color: 'var(--primary)' }}>All players clear of dues!</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ==========================================
          PLAYER LIFE STATS DISPLAY
          ========================================== */}
      {activeReportTab === 'player' && (
        <div style={{ display: 'grid', gap: '20px' }}>
          
          {/* Player Selector */}
          <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Select Player Profile:</span>
            <select value={selectedPlayerId} onChange={e => setSelectedPlayerId(e.target.value)} style={{ width: '220px' }}>
              {players.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {playerReport ? (
            <div style={{ display: 'grid', gap: '20px' }}>
              
              {/* Summary Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div className="glass-panel">
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>LIFETIME PAID</span>
                  <h3 style={{ fontSize: '1.5rem', color: 'var(--primary)', marginTop: '4px' }}>{formatCurrency(playerReport.totalPaid)}</h3>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cash and GPay collections</span>
                </div>

                <div className="glass-panel">
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CURRENT PENDING DUES</span>
                  <h3 style={{ fontSize: '1.5rem', color: playerReport.totalPending > 0 ? 'var(--accent)' : 'var(--primary)', marginTop: '4px' }}>
                    {formatCurrency(playerReport.totalPending)}
                  </h3>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{playerReport.totalPending > 0 ? 'Needs collection reminder' : 'Clear balance'}</span>
                </div>

                <div className="glass-panel">
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ATTENDANCE RATE</span>
                  <h3 style={{ fontSize: '1.5rem', marginTop: '4px' }}>{playerReport.attendancePercent}%</h3>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Present {playerReport.weeksPresent} / {playerReport.weeksMarked} sessions</span>
                </div>

                <div className="glass-panel">
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>SQUAD MATCHES</span>
                  <h3 style={{ fontSize: '1.5rem', marginTop: '4px' }}>{playerReport.matchesPlayedCount} Games</h3>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Participated squad match bets</span>
                </div>
              </div>

              {/* Match Participation Details */}
              <div className="glass-panel">
                <h4 style={{ fontSize: '1rem', marginBottom: '12px' }}>Matches Played Ledger</h4>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Opponent</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerReport.playerMatches.map((m, idx) => (
                        <tr key={idx}>
                          <td>{m.date}</td>
                          <td>{m.opponent}</td>
                          <td>
                            <span className={`badge ${m.result === 'Win' ? 'badge-win' : 'badge-loss'}`}>{m.result}</span>
                          </td>
                        </tr>
                      ))}
                      {playerReport.playerMatches.length === 0 && (
                        <tr>
                          <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Player has not participated in matches.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '30px' }}>
              No player profile selected.
            </div>
          )}

        </div>
      )}

    </div>
  );
}
