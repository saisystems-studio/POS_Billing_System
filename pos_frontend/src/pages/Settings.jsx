/**
 * Settings page — Theme (Light/Dark) + Notifications + Reset Password
 * Dark mode is applied via document.documentElement.setAttribute('data-theme', ...)
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../services/api';
import authService from '../services/authService';
import { useAuth } from '../context/AuthContext';

const BRAND = '#8A5125';

const IcSun  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
const IcMoon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
const IcBell = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IcLock = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IcKey  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>;
const CloseIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

const DarkToggle = ({ value, onChange }) => (
  <div onClick={() => onChange(!value)} style={{
    position:'relative',width:44,height:22,borderRadius:11,
    background: value ? '#2c2c2c' : BRAND,
    transition:'background .2s',cursor:'pointer',flexShrink:0,
    border:`1.5px solid ${value ? '#555' : 'transparent'}`,
    display:'flex',alignItems:'center',
  }}>
    <div style={{
      position:'absolute',top:2,left: value ? 23:2,
      width:16,height:16,borderRadius:'50%',
      background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,.3)',
      transition:'left .2s',
      display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,
    }}>
      {value ? '🌙' : '☀️'}
    </div>
  </div>
);

const Spin = () => (
  <span style={{display:'inline-block',width:13,height:13,
    border:'2px solid rgba(255,255,255,.35)',borderTopColor:'#fff',
    borderRadius:'50%',animation:'spin .6s linear infinite'}}/>
);

const applyTheme = (t) => document.documentElement.setAttribute('data-theme', t);

const EMPTY_PW = { old_password: '', new_password: '', confirm_new_password: '' };

const DEFAULT_SHORTCUTS = [
  { purpose: 'Open Add Product',          key: 'F2' },
  { purpose: 'Open Add Customer',         key: 'F3' },
  { purpose: 'Open New Billing',          key: 'F4' },
  { purpose: 'Focus Customer Search',     key: 'F6' },
  { purpose: 'Focus Product Search',      key: 'F7' },
  { purpose: 'Add Product Group',         key: 'Ctrl+G' },
  { purpose: 'Add Billing Row',           key: 'Insert' },
  { purpose: 'Complete Row / Move Next',  key: 'Ctrl+Enter' },
  { purpose: 'Save Form or Bill',         key: 'Ctrl+S' },
  { purpose: 'Delete Selected Row',       key: 'Delete' },
  { purpose: 'Close Modal or Dropdown',   key: 'Escape' },
  { purpose: 'Open Admin Authentication', key: 'Ctrl+Shift+A' },
];

const Settings = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [loading,      setLoading]      = useState(true);
  const [theme,        setTheme]        = useState('light');
  const [notifOn,      setNotifOn]      = useState(true);
  const [savingPref,   setSavingPref]   = useState(false);
  const [kbEnabled,    setKbEnabled]    = useState(true);
  const [shortcuts,    setShortcuts]    = useState(DEFAULT_SHORTCUTS);
  const [kbDirty,      setKbDirty]     = useState(false);
  const [kbSaving,     setKbSaving]    = useState(false);
  const [kbConflict,   setKbConflict]  = useState('');
  const [kbSaved,      setKbSaved]     = useState(false);
  const [users,        setUsers]       = useState([]);
  const [userPerms,    setUserPerms]   = useState({});
  const [userSaving,   setUserSaving]  = useState({});

  // Reset Password state
  const [pwForm,       setPwForm]       = useState(EMPTY_PW);
  const [pwErrors,     setPwErrors]     = useState({});
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwMessage,    setPwMessage]    = useState(null); // {type:'success'|'error', text}
  const [showOld,      setShowOld]      = useState(false);
  const [showNew,      setShowNew]      = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get('/settings/');
        const s = res.data;
        const savedTheme = s.theme || 'light';
        setTheme(savedTheme);
        setNotifOn(s.notifications_enabled !== false);
        setKbEnabled(s.keyboard_shortcuts_enabled !== false);
        if (s.keyboard_shortcuts && Array.isArray(s.keyboard_shortcuts) && s.keyboard_shortcuts.length > 0) {
          setShortcuts(s.keyboard_shortcuts);
        }
        if (isAdmin) {
          const usersRes = await api.get('/auth/users/');
          setUsers(Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data.results || []));
          try { setUserPerms(JSON.parse(localStorage.getItem('user_access_permissions') || '{}')); } catch { setUserPerms({}); }
        }
        applyTheme(savedTheme);
      } catch { applyTheme('light'); }
      finally { setLoading(false); }
    };
    load();
  }, [isAdmin]);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  const savePreferences = async (newTheme, newNotif) => {
    setSavingPref(true);
    try {
      await api.patch('/settings/', { theme: newTheme, notifications_enabled: newNotif });
      applyTheme(newTheme);
    } catch { /* silent */ }
    finally { setSavingPref(false); }
  };

  const handleTheme = (t) => { setTheme(t); applyTheme(t); savePreferences(t, notifOn); };
  const handleNotif = (v) => { setNotifOn(v); savePreferences(theme, v); };

  const handleShortcutKey = (idx, val) => {
    setShortcuts(prev => prev.map((s,i) => i===idx ? {...s, key: val} : s));
    setKbDirty(true); setKbConflict(''); setKbSaved(false);
  };

  const detectConflict = (scs) => {
    const keys = scs.map(s => s.key.trim().toLowerCase()).filter(k => k);
    const seen = new Set();
    for (const k of keys) { if (seen.has(k)) return `Duplicate key: "${k}"`; seen.add(k); }
    return '';
  };

  const saveKbShortcuts = async () => {
    const conflict = detectConflict(shortcuts);
    if (conflict) { setKbConflict(conflict); return; }
    setKbSaving(true);
    try {
      await api.patch('/settings/', { keyboard_shortcuts_enabled: kbEnabled, keyboard_shortcuts: shortcuts });
      setKbDirty(false); setKbSaved(true); setKbConflict('');
      setTimeout(() => setKbSaved(false), 2500);
    } catch { setKbConflict('Failed to save.'); }
    finally { setKbSaving(false); }
  };

  const resetKbDefaults = () => {
    setShortcuts(DEFAULT_SHORTCUTS); setKbDirty(true); setKbConflict(''); setKbSaved(false);
  };

  const toggleUserPerm = (userId, key) => {
    if (!isAdmin) return;
    setUserPerms(prev => {
      const current = prev[userId] || { view:true, add:true, edit:false, delete:false };
      const next = { ...prev, [userId]: { ...current, [key]: !current[key] } };
      localStorage.setItem('user_access_permissions', JSON.stringify(next));
      return next;
    });
  };

  const updateUserRole = async (userId, role) => {
    if (!isAdmin) return;
    setUserSaving(prev => ({ ...prev, [userId]: true }));
    try {
      const res = await api.patch(`/auth/users/${userId}/`, { role });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...(res.data || {}), role } : u));
    } finally {
      setUserSaving(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handlePwChange = (e) => {
    const { name, value } = e.target;
    setPwForm(p => ({ ...p, [name]: value }));
    if (pwErrors[name]) setPwErrors(p => ({ ...p, [name]: '' }));
    if (pwMessage) setPwMessage(null);
  };

  const handlePwSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!pwForm.old_password.trim())  errs.old_password = 'Current password is required.';
    if (!pwForm.new_password.trim())  errs.new_password = 'New password is required.';
    else if (pwForm.new_password.length < 8) errs.new_password = 'Password must be at least 8 characters.';
    if (!pwForm.confirm_new_password.trim()) errs.confirm_new_password = 'Please confirm your new password.';
    else if (pwForm.new_password !== pwForm.confirm_new_password) errs.confirm_new_password = 'Passwords do not match.';
    if (Object.keys(errs).length) { setPwErrors(errs); return; }

    setPwSubmitting(true);
    try {
      await authService.changePassword(pwForm);
      setPwMessage({ type: 'success', text: 'Password changed successfully.' });
      setPwForm(EMPTY_PW);
      setPwErrors({});
    } catch (error) {
      const data = error.response?.data;
      if (data && typeof data === 'object') {
        const mapped = {};
        Object.entries(data).forEach(([key, val]) => { mapped[key] = Array.isArray(val) ? val[0] : val; });
        setPwErrors(mapped);
      }
      setPwMessage({ type: 'error', text: data?.detail || 'Unable to change password. Please check your current password.' });
    } finally { setPwSubmitting(false); }
  };

  if (loading) return <Layout><LoadingSpinner message="Loading settings…"/></Layout>;

  const pwInputStyle = { height: 34, padding: '.3rem .6rem', fontSize: '.82rem', paddingRight: '2.4rem' };
  const pwErrStyle   = { fontSize: '.68rem', color: 'var(--danger)', marginTop: '.18rem', fontWeight: 500 };
  const pwLabelStyle = { display: 'block', fontWeight: 700, fontSize: '.72rem', color: 'var(--text-label)', marginBottom: '.22rem' };

  const EyeIcon = ({ show }) => show
    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;

  const PwField = ({ label, name, value, show, onToggle, error, placeholder }) => (
    <div style={{ marginBottom: '.55rem' }}>
      <label style={pwLabelStyle}>{label} <span style={{color:'var(--danger)'}}>*</span></label>
      <div style={{ position: 'relative' }}>
        <input
          name={name} type={show ? 'text' : 'password'}
          className={`form-control${error ? ' is-invalid' : ''}`}
          placeholder={placeholder || ''}
          value={value} onChange={handlePwChange}
          style={{ ...pwInputStyle, borderColor: error ? 'var(--danger)' : undefined, width: '100%' }}
          autoComplete={name === 'old_password' ? 'current-password' : 'new-password'}
        />
        <button type="button" onClick={onToggle} tabIndex={-1}
          style={{ position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',
            background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:2,
            display:'flex',alignItems:'center',justifyContent:'center' }}>
          <EyeIcon show={show}/>
        </button>
      </div>
      {error && <div style={pwErrStyle}>{error}</div>}
    </div>
  );

  return (
    <Layout>
      <div style={{position:'fixed',inset:0,zIndex:1500,background:'rgba(0,0,0,.35)',backdropFilter:'blur(10px)',WebkitBackdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1.25rem'}}>
        <div style={{width:'min(580px,100%)',maxHeight:'calc(100vh - 3rem)',overflowY:'auto',background:'var(--card-bg)',borderRadius:18,boxShadow:'0 28px 80px rgba(0,0,0,.24)',border:'1px solid var(--border)'}}>

          {/* Header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'1.25rem 1.5rem',borderBottom:'1px solid var(--divider)'}}>
            <div>
              <h2 style={{fontFamily:'var(--font-heading)',fontWeight:800,margin:0}}>Settings</h2>
              <p className="page-header-sub" style={{marginTop:'.35rem'}}>Appearance, notifications and security</p>
            </div>
            <button className="btn btn-link" onClick={() => navigate(-1)} aria-label="Close"><CloseIcon/></button>
          </div>

          <div style={{padding:'1.25rem 1.5rem',display:'grid',gap:'1rem'}}>

            {/* Theme */}
            <div className="card" style={{boxShadow:'none',border:'1px solid var(--border)'}}>
              <div className="card-body" style={{padding:'1rem 1.25rem'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'.75rem',fontWeight:700,color:'var(--text-primary)'}}>
                    <IcSun/> <span>Theme</span>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'.75rem'}}>
                    <DarkToggle value={theme==='dark'} onChange={v => handleTheme(v?'dark':'light')} />
                    <span style={{fontSize:'.88rem',fontWeight:700,color:'var(--text-primary)'}}>{theme==='dark' ? 'Dark Mode' : 'Light Mode'}</span>
                  </div>
                </div>
                <p style={{marginTop:'.8rem',fontSize:'.82rem',color:'var(--text-muted)',lineHeight:1.5}}>Switch app appearance while keeping the existing color palette intact.</p>
              </div>
            </div>

            {/* Notifications */}
            <div className="card" style={{boxShadow:'none',border:'1px solid var(--border)'}}>
              <div className="card-body" style={{padding:'1rem 1.25rem'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'.75rem',fontWeight:700,color:'var(--text-primary)'}}>
                    <IcBell/> <span>Notifications</span>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'.75rem'}}>
                    <div onClick={() => handleNotif(!notifOn)} style={{position:'relative',width:40,height:20,borderRadius:12,background:notifOn?BRAND:'#bdbdbd',cursor:'pointer',transition:'background .2s'}}>
                      <div style={{position:'absolute',top:3,left:notifOn?22:3,width:14,height:14,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,.25)',transition:'left .2s'}} />
                    </div>
                    <span style={{fontSize:'.88rem',fontWeight:700,color:notifOn?'var(--text-primary)':'var(--text-muted)'}}>{notifOn ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
                <p style={{marginTop:'.8rem',fontSize:'.82rem',color:'var(--text-muted)',lineHeight:1.5}}>Enable or disable alerts for app activity and important updates.</p>
              </div>
            </div>

            {/* Reset Password */}
            <div className="card" style={{boxShadow:'none',border:'1px solid var(--border)'}}>
              <div className="card-body" style={{padding:'1rem 1.25rem'}}>
                <div style={{display:'flex',alignItems:'center',gap:'.75rem',fontWeight:700,color:'var(--text-primary)',marginBottom:'.75rem'}}>
                  <IcLock/> <span>Reset Password</span>
                </div>
                <p style={{fontSize:'.82rem',color:'var(--text-muted)',lineHeight:1.5,marginBottom:'1rem'}}>
                  Change your login password. You will need your current password to proceed.
                </p>

                {/* Status message */}
                {pwMessage && (
                  <div style={{
                    display:'flex',alignItems:'center',gap:'.5rem',
                    padding:'.5rem .75rem',borderRadius:8,marginBottom:'.75rem',
                    background: pwMessage.type==='success' ? '#E8F5E9' : '#FFEBEE',
                    border: `1px solid ${pwMessage.type==='success' ? 'rgba(46,125,50,.2)' : 'rgba(211,47,47,.2)'}`,
                    color: pwMessage.type==='success' ? '#1B5E20' : '#B71C1C',
                    fontSize:'.82rem', fontWeight:600,
                  }}>
                    {pwMessage.type==='success'
                      ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14,flexShrink:0}}><polyline points="20 6 9 17 4 12"/></svg>
                      : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14,flexShrink:0}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    }
                    {pwMessage.text}
                  </div>
                )}

                <form onSubmit={handlePwSubmit} noValidate>
                  <PwField
                    label="Current Password" name="old_password"
                    value={pwForm.old_password} show={showOld} onToggle={() => setShowOld(v => !v)}
                    error={pwErrors.old_password} placeholder="Enter your current password"
                  />
                  <PwField
                    label="New Password" name="new_password"
                    value={pwForm.new_password} show={showNew} onToggle={() => setShowNew(v => !v)}
                    error={pwErrors.new_password} placeholder="Minimum 8 characters"
                  />
                  <PwField
                    label="Confirm New Password" name="confirm_new_password"
                    value={pwForm.confirm_new_password} show={showConfirm} onToggle={() => setShowConfirm(v => !v)}
                    error={pwErrors.confirm_new_password} placeholder="Re-enter new password"
                  />
                  <div style={{display:'flex',justifyContent:'flex-end',marginTop:'.5rem'}}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={pwSubmitting}>
                      {pwSubmitting ? <><Spin/> Changing…</> : <><IcLock/> Change Password</>}
                    </button>
                  </div>
                </form>
              </div>
            </div>

c            {/* Keyboard Shortcuts — Admin only */}
            {isAdmin && (
              <div className="card" style={{boxShadow:'none',border:'1px solid var(--border)'}}>
                <div className="card-body" style={{padding:'1rem 1.25rem'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'.75rem',fontWeight:700,color:'var(--text-primary)',marginBottom:'.75rem'}}>
                    <IcKey/> <span>Admin User Settings</span>
                  </div>
                  <div className="table-wrapper">
                    <table className="table table-compact">
                      <thead>
                        <tr>
                          <th>Username</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Access Permissions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => {
                          const perms = userPerms[u.id] || { view:true, add:true, edit:u.role === 'Admin', delete:u.role === 'Admin' };
                          return (
                            <tr key={u.id}>
                              <td>{u.username}</td>
                              <td>{u.email || '-'}</td>
                              <td>
                                <select className="form-select form-select-sm" value={u.role}
                                  disabled={!!userSaving[u.id]}
                                  onChange={e => updateUserRole(u.id, e.target.value)}
                                  style={{height:28,fontSize:'.76rem',minWidth:92}}>
                                  <option value="Admin">Admin</option>
                                  <option value="User">User</option>
                                </select>
                              </td>
                              <td>
                                {['view','add','edit','delete'].map(k => (
                                  <label key={k} style={{display:'inline-flex',alignItems:'center',gap:'.22rem',marginRight:'.55rem',fontSize:'.74rem',fontWeight:700,textTransform:'capitalize'}}>
                                    <input type="checkbox" checked={!!perms[k]} onChange={() => toggleUserPerm(u.id, k)} />
                                    {k}
                                  </label>
                                ))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="card" style={{boxShadow:'none',border:'1px solid var(--border)'}}>
                <div className="card-body" style={{padding:'1rem 1.25rem'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'1rem',marginBottom:'.75rem',flexWrap:'wrap'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'.75rem',fontWeight:700,color:'var(--text-primary)'}}>
                      <IcKey/> <span>Keyboard Shortcuts</span>
                      <span style={{fontSize:'.72rem',fontWeight:600,color:'var(--text-muted)',padding:'2px 7px',
                        background:'var(--bg-soft)',borderRadius:4,border:'1px solid var(--divider)'}}>Admin only</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:'.75rem'}}>
                      <div onClick={()=>{setKbEnabled(v=>{const n=!v;api.patch('/settings/',{keyboard_shortcuts_enabled:n}).catch(()=>{});return n;});}}
                        style={{position:'relative',width:40,height:20,borderRadius:12,
                          background:kbEnabled?BRAND:'#bdbdbd',cursor:'pointer',transition:'background .2s'}}>
                        <div style={{position:'absolute',top:3,left:kbEnabled?22:3,width:14,height:14,borderRadius:'50%',
                          background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,.25)',transition:'left .2s'}}/>
                      </div>
                      <span style={{fontSize:'.85rem',fontWeight:700,color:kbEnabled?'var(--text-primary)':'var(--text-muted)'}}>
                        {kbEnabled?'Enabled':'Disabled'}
                      </span>
                    </div>
                  </div>

                  {kbEnabled && (
                    <>
                      <div style={{overflowX:'auto',marginBottom:'.75rem'}}>
                        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.82rem'}}>
                          <thead>
                            <tr style={{background:'var(--bg-soft)'}}>
                              <th style={{padding:'.4rem .6rem',textAlign:'left',fontWeight:700,fontSize:'.72rem',color:'var(--text-label)',textTransform:'uppercase',letterSpacing:'.04em',borderBottom:'2px solid var(--divider)'}}>Purpose</th>
                              <th style={{padding:'.4rem .6rem',textAlign:'left',fontWeight:700,fontSize:'.72rem',color:'var(--text-label)',textTransform:'uppercase',letterSpacing:'.04em',borderBottom:'2px solid var(--divider)',minWidth:160}}>Key Combination</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shortcuts.map((sc, idx) => (
                              <tr key={idx} style={{borderBottom:'1px solid var(--divider)'}}>
                                <td style={{padding:'.35rem .6rem',color:'var(--text-primary)',fontWeight:500}}>{sc.purpose}</td>
                                <td style={{padding:'.28rem .5rem'}}>
                                  <input type="text" value={sc.key}
                                    onChange={e=>handleShortcutKey(idx, e.target.value)}
                                    style={{width:'100%',height:28,padding:'.2rem .5rem',
                                      fontFamily:'ui-monospace,monospace',fontSize:'.8rem',fontWeight:700,
                                      border:'1px solid var(--border-input)',borderRadius:4,color:BRAND}}/>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {kbConflict && <div style={{fontSize:'.78rem',color:'var(--danger)',marginBottom:'.5rem',fontWeight:600}}>⚠ {kbConflict}</div>}
                      {kbSaved && <div style={{fontSize:'.78rem',color:'var(--success-dark)',marginBottom:'.5rem',fontWeight:600}}>✓ Shortcuts saved.</div>}
                      <div style={{display:'flex',gap:'.5rem',justifyContent:'flex-end'}}>
                        <button className="btn btn-outline-secondary btn-sm" onClick={resetKbDefaults}>Reset to Default</button>
                        <button className="btn btn-primary btn-sm" onClick={saveKbShortcuts} disabled={kbSaving||!kbDirty}>
                          {kbSaving?<><Spin/> Saving…</>:'Save Changes'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div style={{display:'flex',justifyContent:'flex-end'}}>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
