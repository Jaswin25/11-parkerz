import { useState } from 'react';
import { Award, Plus, Trash2, Calendar, MapPin, Users, X, Edit } from 'lucide-react';
import { Player, PlayerCategory, Match, MatchResult, SettlementMode } from '../types';

interface MatchesProps {
  players: Player[];
  matches: Match[];
  onAddMatch: (match: { date: string; opponent: string; ground: string; bet_amount: number; result: MatchResult; amount_won_lost: number; settled_via: SettlementMode; cash_amount: number; gpay_amount: number; who_played: string[]; notes?: string; match_number?: string }) => Promise<void>;
  onDeleteMatch: (id: string) => Promise<void>;
  onUpdateMatch: (id: string, match: { date: string; opponent: string; ground: string; bet_amount: number; result: MatchResult; amount_won_lost: number; settled_via: SettlementMode; cash_amount: number; gpay_amount: number; who_played: string[]; notes?: string; match_number?: string }) => Promise<void>;
  onAddPlayer: (name: string, category: PlayerCategory, phone?: string) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function Matches({
  players,
  matches,
  onAddMatch,
  onDeleteMatch,
  onUpdateMatch,
  onAddPlayer,
  showToast
}: MatchesProps) {
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [opponent, setOpponent] = useState('');
  const [ground, setGround] = useState('');
  const [betAmount, setBetAmount] = useState('');
  const [result, setResult] = useState<MatchResult>('Win');
  const [settledVia, setSettledVia] = useState<SettlementMode>('GPay');
  const [cashSplit, setCashSplit] = useState('');
  const [gpaySplit, setGpaySplit] = useState('');
  const [whoPlayed, setWhoPlayed] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [matchNumber, setMatchNumber] = useState('Match 1');
  const [submitting, setSubmitting] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  const [quickPlayerName, setQuickPlayerName] = useState('');

  const handleQuickAddPlayer = async () => {
    if (!quickPlayerName.trim()) return;
    try {
      await onAddPlayer(quickPlayerName.trim(), 'Normal'); // Default to normal category
      showToast(`Player "${quickPlayerName.trim()}" added successfully!`);
      setQuickPlayerName('');
    } catch (err: any) {
      showToast(err.message || 'Error adding player', 'error');
    }
  };

  const handleCheckboxChange = (playerId: string) => {
    setWhoPlayed(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId) 
        : [...prev, playerId]
    );
  };

  const handleSelectAllPlayers = () => {
    if (whoPlayed.length === players.length) {
      setWhoPlayed([]);
    } else {
      setWhoPlayed(players.map(p => p.id));
    }
  };

  const handleEditClick = (match: Match) => {
    setEditingMatch(match);
    setDate(match.date);
    setOpponent(match.opponent);
    setGround(match.ground);
    setBetAmount(match.bet_amount.toString());
    setResult(match.result);
    setSettledVia(match.settled_via);
    setWhoPlayed(match.who_played || []);
    setNotes(match.notes || '');
    setMatchNumber(match.match_number || 'Match 1');

    if (match.settled_via === 'Both') {
      setCashSplit(Math.abs(match.cash_amount).toString());
      setGpaySplit(Math.abs(match.gpay_amount).toString());
    } else {
      setCashSplit('');
      setGpaySplit('');
    }
    setShowAddForm(true);
  };

  const handleCancelEdit = () => {
    setEditingMatch(null);
    setOpponent('');
    setGround('');
    setBetAmount('');
    setCashSplit('');
    setGpaySplit('');
    setWhoPlayed([]);
    setNotes('');
    setMatchNumber('Match 1');
    setDate(new Date().toISOString().split('T')[0]);
    setShowAddForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opponent.trim() || !betAmount) return;

    setSubmitting(true);
    const bet = parseFloat(betAmount);
    const winLossAmount = result === 'Win' ? bet : -bet;
    
    let cashAmt = 0;
    let gpayAmt = 0;

    if (settledVia === 'Cash') {
      cashAmt = winLossAmount;
    } else if (settledVia === 'GPay') {
      gpayAmt = winLossAmount;
    } else {
      const cashS = parseFloat(cashSplit) || 0;
      const gpayS = parseFloat(gpaySplit) || 0;
      if (Math.abs(cashS + gpayS) !== bet) {
        showToast('Sum of Cash split and GPay split must equal the Bet Amount!', 'error');
        setSubmitting(false);
        return;
      }
      cashAmt = result === 'Win' ? cashS : -cashS;
      gpayAmt = result === 'Win' ? gpayS : -gpayS;
    }

    try {
      if (editingMatch) {
        await onUpdateMatch(editingMatch.id, {
          date,
          opponent: opponent.trim(),
          ground: ground.trim() || 'Home Ground',
          bet_amount: bet,
          result,
          amount_won_lost: winLossAmount,
          settled_via: settledVia,
          cash_amount: cashAmt,
          gpay_amount: gpayAmt,
          who_played: whoPlayed,
          notes: notes.trim(),
          match_number: matchNumber
        });
        showToast(`Match vs ${opponent.trim()} updated successfully!`);
        setEditingMatch(null);
      } else {
        await onAddMatch({
          date,
          opponent: opponent.trim(),
          ground: ground.trim() || 'Home Ground',
          bet_amount: bet,
          result,
          amount_won_lost: winLossAmount,
          settled_via: settledVia,
          cash_amount: cashAmt,
          gpay_amount: gpayAmt,
          who_played: whoPlayed,
          notes: notes.trim(),
          match_number: matchNumber
        });
        showToast(`Match vs ${opponent.trim()} (${result}) recorded!`);
      }
      
      // Reset form
      setOpponent('');
      setGround('');
      setBetAmount('');
      setCashSplit('');
      setGpaySplit('');
      setWhoPlayed([]);
      setNotes('');
      setMatchNumber('Match 1');
      setShowAddForm(false);
    } catch (e: any) {
      showToast(e.message || `Error ${editingMatch ? 'updating' : 'recording'} match`, 'error');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string, opponentName: string, amt: number) => {
    if (!window.confirm(`Are you sure you want to delete the match entry vs "${opponentName}" for ₹${amt}? wallet balances will be updated.`)) {
      return;
    }
    try {
      await onDeleteMatch(id);
      showToast('Match deleted successfully!');
    } catch (e: any) {
      showToast(e.message || 'Error deleting match', 'error');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="fade-in" style={{ display: 'grid', gap: '20px' }}>
      
      {/* Header and Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Award size={24} className="text-secondary" style={{ color: 'var(--secondary)' }} />
          Matches Betting Books
        </h2>
        <button 
          onClick={() => {
            if (editingMatch) {
              handleCancelEdit();
            } else {
              setShowAddForm(!showAddForm);
            }
          }} 
          className="btn btn-primary"
        >
          {showAddForm ? (editingMatch ? 'Cancel Edit' : <><X size={18} /> Close Form</>) : <><Plus size={18} /> Record Match</>}
        </button>
      </div>

      {/* Add Match Collapsible Form */}
      {showAddForm && (
        <div className="glass-panel fade-in" style={{ border: '1px solid var(--secondary)' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>{editingMatch ? 'Edit Match Details' : 'Record New Match'}</h3>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Date</label>
                <input type="date" required value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Match Number</label>
                <select value={matchNumber} onChange={e => setMatchNumber(e.target.value)}>
                  <option value="Match 1">Match 1</option>
                  <option value="Match 2">Match 2</option>
                </select>
              </div>
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Opponent Name</label>
                <input type="text" required placeholder="e.g. Dynamic Strikers" value={opponent} onChange={e => setOpponent(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Ground / Venue</label>
                <input type="text" placeholder="e.g. Gymkhana Grounds" value={ground} onChange={e => setGround(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Bet Amount (₹)</label>
                <input type="number" required min="1" placeholder="e.g. 200" value={betAmount} onChange={e => setBetAmount(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Result</label>
                <select value={result} onChange={e => setResult(e.target.value as MatchResult)}>
                  <option value="Win">Win (Credits Wallet)</option>
                  <option value="Loss">Loss (Debits Wallet)</option>
                </select>
              </div>
              <div style={{ display: 'grid', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Settled Via Wallet</label>
                <select value={settledVia} onChange={e => setSettledVia(e.target.value as SettlementMode)}>
                  <option value="GPay">GPay Wallet</option>
                  <option value="Cash">Cash Wallet</option>
                  <option value="Both">Both (Split Details)</option>
                </select>
              </div>
            </div>

            {settledVia === 'Both' && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px dashed var(--border-color)'
              }}>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '0.80rem', color: 'var(--text-secondary)' }}>Cash Share (₹)</label>
                  <input type="number" required placeholder="Cash split" value={cashSplit} onChange={e => setCashSplit(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label style={{ fontSize: '0.80rem', color: 'var(--text-secondary)' }}>GPay Share (₹)</label>
                  <input type="number" required placeholder="GPay split" value={gpaySplit} onChange={e => setGpaySplit(e.target.value)} />
                </div>
              </div>
            )}

            {/* Who Played Selection */}
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Match Players Checklist ({whoPlayed.length} selected)</label>
                <button 
                  type="button" 
                  onClick={handleSelectAllPlayers} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--secondary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {whoPlayed.length === players.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
                gap: '8px', 
                maxHeight: '150px', 
                overflowY: 'auto',
                background: 'rgba(0, 0, 0, 0.25)',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)'
              }}>
                {players.map(p => (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={whoPlayed.includes(p.id)}
                      onChange={() => handleCheckboxChange(p.id)}
                    />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>

              {/* Quick Add Player on Matchbook Page */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <input 
                  type="text" 
                  placeholder="Quick add new player name..." 
                  value={quickPlayerName} 
                  onChange={e => setQuickPlayerName(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem' }}
                />
                <button 
                  type="button" 
                  onClick={handleQuickAddPlayer}
                  className="btn btn-secondary" 
                  style={{ padding: '8px 16px', fontSize: '0.85rem', flex: '0 0 auto', height: '42px' }}
                >
                  Quick Add Player
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Match Notes (Optional)</label>
              <input type="text" placeholder="Top scorer, wicket taker, match highlights..." value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              {editingMatch && (
                <button type="button" className="btn btn-secondary" style={{ padding: '12px 20px' }} onClick={handleCancelEdit}>
                  Cancel
                </button>
              )}
              <button type="submit" className="btn btn-primary" style={{ padding: '12px 28px' }} disabled={submitting}>
                {editingMatch ? (submitting ? 'Saving...' : 'Save Changes') : (submitting ? 'Recording Match...' : 'Save Match')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Match History Timeline */}
      <div style={{ display: 'grid', gap: '16px' }}>
        {matches.map(match => {
          const matchPlayersNames = match.who_played
            .map(id => players.find(p => p.id === id)?.name)
            .filter(Boolean);

          const isWin = match.result === 'Win';

          return (
            <div 
              key={match.id} 
              className="glass-panel" 
              style={{
                display: 'grid',
                gap: '14px',
                borderLeft: isWin ? '4px solid var(--primary)' : '4px solid var(--danger)'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    vs {match.opponent}
                    <span className={`badge ${isWin ? 'badge-win' : 'badge-loss'}`}>
                      {match.result}
                    </span>
                    <span className="badge badge-normal" style={{ fontSize: '0.7rem', background: 'rgba(56, 189, 248, 0.1)', borderColor: 'var(--secondary)', color: 'var(--secondary)' }}>
                      {match.match_number || 'Match 1'}
                    </span>
                  </h3>
                  <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> {match.date}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={14} /> {match.ground}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bet Result</span>
                    <h3 style={{ color: isWin ? 'var(--primary)' : 'var(--danger)', fontSize: '1.3rem' }}>
                      {isWin ? '+' : '-'}{formatCurrency(match.bet_amount)}
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>via {match.settled_via}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      onClick={() => handleEditClick(match)} 
                      className="btn-icon"
                      style={{ color: 'var(--text-secondary)', borderColor: 'rgba(56,189,248,0.1)' }}
                      title="Edit Match"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(match.id, match.opponent, match.bet_amount)} 
                      className="btn-icon"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {match.notes && (
                <p style={{ fontSize: '0.9rem', background: 'rgba(0,0,0,0.15)', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid var(--border-color)', color: 'var(--text-primary)' }}>
                  {match.notes}
                </p>
              )}

              {/* Played Checklist */}
              {matchPlayersNames.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <Users size={14} /> Squad ({matchPlayersNames.length} Played)
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {matchPlayersNames.map((name, i) => (
                      <span 
                        key={i} 
                        style={{
                          fontSize: '0.75rem',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-color)',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {matches.length === 0 && (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            No matches recorded yet. Use the button above to record your first game!
          </div>
        )}
      </div>

    </div>
  );
}
