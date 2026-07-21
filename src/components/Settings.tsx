import React, { useState, useEffect } from 'react';
import { Database, Wifi, ShieldAlert, Sparkles, CheckCircle2, RotateCw } from 'lucide-react';
import { DbService } from '../services/db';
import { SupabaseConfig } from '../types';

interface SettingsProps {
  onRefreshAllData: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function Settings({ onRefreshAllData, showToast }: SettingsProps) {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [isSupabaseActive, setIsSupabaseActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const config = DbService.getSupabaseConfig();
    if (config) {
      setUrl(config.url);
      setAnonKey(config.anonKey);
    }
    setIsSupabaseActive(DbService.isUsingSupabase());
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!url.trim() && !anonKey.trim()) {
      // Disconnect and switch back to LocalStorage
      await DbService.saveSupabaseConfig(null);
      setIsSupabaseActive(false);
      showToast('Switched to LocalStorage Offline.', 'info');
      setMessage({ type: 'success', text: 'Disconnected from Supabase. Switched back to LocalStorage.' });
      onRefreshAllData();
      setLoading(false);
      return;
    }

    const config: SupabaseConfig = {
      url: url.trim(),
      anonKey: anonKey.trim()
    };

    const success = await DbService.saveSupabaseConfig(config);
    if (success) {
      setIsSupabaseActive(true);
      showToast('Connected to Supabase cloud!');
      setMessage({ type: 'success', text: 'Connected to Supabase successfully!' });
      onRefreshAllData();
    } else {
      showToast('Connection failed. Check details.', 'error');
      setMessage({ type: 'error', text: 'Failed to connect. Please verify your Supabase URL, Anon Key, and Table Schema.' });
    }
    setLoading(false);
  };

  const handleSync = async () => {
    if (!window.confirm('This will copy all your offline LocalStorage records (players, attendance, matches, expenses) directly into Supabase. Make sure the database schema matches supabase_schema.sql. Do you want to proceed?')) {
      return;
    }

    setSyncLoading(true);
    setMessage(null);
    try {
      const res = await DbService.syncLocalToSupabase();
      if (res.success) {
        showToast('All local data synced successfully!');
        setMessage({ type: 'success', text: res.message });
        onRefreshAllData();
      } else {
        showToast(res.message, 'error');
        setMessage({ type: 'error', text: res.message });
      }
    } catch (e: any) {
      showToast(e.message || 'Sync error occurs.', 'error');
      setMessage({ type: 'error', text: e.message || 'Error occurred during sync.' });
    }
    setSyncLoading(false);
  };

  return (
    <div className="fade-in" style={{ display: 'grid', gap: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Database size={28} className="text-secondary" style={{ color: 'var(--secondary)' }} />
        Database Settings
      </h2>

      {/* Database Connection Card */}
      <div className="glass-panel" style={{ display: 'grid', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Connection Status</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Select where your data is stored and sync your local wallet logs.
            </p>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: isSupabaseActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            padding: '8px 16px',
            borderRadius: '20px',
            border: isSupabaseActive ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)'
          }}>
            <Wifi size={18} style={{ color: isSupabaseActive ? 'var(--primary)' : 'var(--accent)' }} />
            <span style={{ fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase', color: isSupabaseActive ? 'var(--primary)' : 'var(--accent)' }}>
              {isSupabaseActive ? 'Supabase Active' : 'LocalStorage Offline'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: 'grid', gap: '16px' }}>
          <div style={{ display: 'grid', gap: '6px' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Supabase Project URL</label>
            <input 
              type="text" 
              placeholder="https://your-project-id.supabase.co" 
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gap: '6px' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Supabase API Anon Key</label>
            <input 
              type="text" 
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." 
              value={anonKey}
              onChange={e => setAnonKey(e.target.value)}
            />
          </div>

          {message && (
            <div style={{
              background: message.type === 'success' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              color: message.type === 'success' ? '#34d399' : '#f87171',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              {message.type === 'success' ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
              <span>{message.text}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? (
                <>
                  <RotateCw size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                  Verifying Connection...
                </>
              ) : (
                'Save Connection'
              )}
            </button>
            {(url || anonKey) && (
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => { setUrl(''); setAnonKey(''); }} 
                disabled={loading}
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Sync Local Storage Card */}
      {isSupabaseActive && (
        <div className="glass-panel" style={{ display: 'grid', gap: '16px', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(6, 182, 212, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Sparkles size={24} style={{ color: 'var(--secondary)' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>Sync Local Data to Supabase</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.4' }}>
                If you have been using the app offline in LocalStorage, click below to sync all offline players, attendance registers, expense entries, and matches to your Supabase tables.
              </p>
            </div>
          </div>
          
          <button 
            type="button" 
            className="btn btn-primary" 
            style={{ background: 'var(--secondary)', color: '#022c22' }} 
            onClick={handleSync}
            disabled={syncLoading}
          >
            {syncLoading ? (
              <>
                <RotateCw size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                Syncing Data...
              </>
            ) : (
              'Sync Database Now'
            )}
          </button>
        </div>
      )}

      {/* Database Schema Setup Help */}
      <div className="glass-panel" style={{ display: 'grid', gap: '12px' }}>
        <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={18} className="text-accent" style={{ color: 'var(--accent)' }} />
          Supabase Table Setup Instructions
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
          To connect this app to Supabase successfully, you must run the SQL commands from the <code style={{ color: 'var(--secondary)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>supabase_schema.sql</code> file located in the root of this project. Copy its content, go to your <strong>Supabase Dashboard → SQL Editor → New Query</strong>, paste the commands, and click <strong>Run</strong>.
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
