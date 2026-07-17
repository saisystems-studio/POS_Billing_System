import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import loginIllustration from '../assets/login.png';

/* ═══════════ ICONS ═══════════ */
const CartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
  </svg>
);
const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);
const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);
const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

/* ── Page background curves (same as Login) ── */
const PageCurves = () => (
  <svg className="lp-page-curves" viewBox="0 0 1440 900"
    preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    {[0,1,2,3,4,5].map(i => (
      <path key={i}
        d={`M${-180+i*40} ${560+i*28} Q${380+i*20} ${400+i*18},${760+i*14} ${500+i*22} T${1660+i*10} ${460+i*20}`}
        fill="none" stroke="#B49687" strokeWidth=".9"
        strokeOpacity={0.055 + i * 0.005} strokeLinecap="round"/>
    ))}
    {[0,1,2,3].map(i => (
      <path key={`r${i}`}
        d={`M${220+i*240} -80 Q${280+i*220} ${280+i*35},${170+i*220} ${580+i*22} T${260+i*220} 1000`}
        fill="none" stroke="#AF7763" strokeWidth=".7"
        strokeOpacity={0.045 + i * 0.005} strokeLinecap="round"/>
    ))}
    <circle cx="160"  cy="180" r="300" fill="none" stroke="#B49687" strokeWidth=".7" strokeOpacity=".05"/>
    <circle cx="1280" cy="720" r="250" fill="none" stroke="#946C61" strokeWidth=".7" strokeOpacity=".045"/>
  </svg>
);

/* ── Neon border trace (same as Login) ── */
const NeonBorderTrace = () => {
  const W = 860, H = 620, R = 24;
  const P = Math.round(2 * (W - 2*R) + 2 * (H - 2*R) + 2 * Math.PI * R);
  const beamLen = P - 700;
  const dur = '8s';
  const rectPath = `M ${R} 0 L ${W-R} 0 Q ${W} 0 ${W} ${R} L ${W} ${H-R} Q ${W} ${H} ${W-R} ${H} L ${R} ${H} Q 0 ${H} 0 ${H-R} L 0 ${R} Q 0 0 ${R} 0 Z`;

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:2 }}>
      <defs>
        <filter id="rp-neon-bloom" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="16" result="b2" in="SourceGraphic" />
          <feGaussianBlur stdDeviation="6"  result="b1" in="SourceGraphic" />
          <feMerge><feMergeNode in="b2"/><feMergeNode in="b1"/></feMerge>
        </filter>
        <filter id="rp-neon-mid" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="b1" in="SourceGraphic" />
          <feMerge><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path d={rectPath} fill="none" stroke="#B58270" strokeWidth="12" strokeOpacity="0.38"
        filter="url(#rp-neon-bloom)"
        strokeDasharray={`${beamLen} 700`} strokeDashoffset="0" strokeLinecap="butt">
        <animate attributeName="stroke-dashoffset" from="0" to={-P} dur={dur} repeatCount="indefinite" calcMode="linear" />
      </path>
      <path d={rectPath} fill="none" stroke="#C9906E" strokeWidth="5" strokeOpacity="0.60"
        filter="url(#rp-neon-mid)"
        strokeDasharray={`${beamLen} 700`} strokeDashoffset="0" strokeLinecap="butt">
        <animate attributeName="stroke-dashoffset" from="0" to={-P} dur={dur} repeatCount="indefinite" calcMode="linear" />
      </path>
      <path d={rectPath} fill="none" stroke="#F2E0D6" strokeWidth="1.5" strokeOpacity="0.95"
        strokeDasharray={`${beamLen} 700`} strokeDashoffset="0" strokeLinecap="butt">
        <animate attributeName="stroke-dashoffset" from="0" to={-P} dur={dur} repeatCount="indefinite" calcMode="linear" />
      </path>
    </svg>
  );
};

/* ═══════════════════════════════════════════
   REGISTER PAGE
   ═══════════════════════════════════════════ */
const Register = () => {
  const [form, setForm]       = useState({ username: '', email: '', password: '', confirm_password: '' });
  const [errors, setErrors]   = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showCPwd, setShowCPwd] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const change = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: '' }));
    if (apiError) setApiError('');
  };

  const COMMON_PASSWORDS = [
    'password', 'password123', 'admin123', '12345678', '123456789',
    'qwerty123', 'abc12345', 'letmein1', 'welcome1', 'iloveyou1',
    'monkey123', 'dragon123', 'master123', 'sunshine1', 'princess1',
  ];

  const validatePassword = (pwd) => {
    if (!pwd) return 'Password is required.';
    if (pwd.length < 8)  return 'Password must be at least 8 characters.';
    if (pwd.length > 64) return 'Password must be at most 64 characters.';
    if (/\s/.test(pwd))  return 'Password must not contain spaces.';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter (A–Z).';
    if (!/[a-z]/.test(pwd)) return 'Password must contain at least one lowercase letter (a–z).';
    if (!/[0-9]/.test(pwd)) return 'Password must contain at least one number (0–9).';
    if (!/[@#$%^&*!?_\-]/.test(pwd)) return 'Password must contain at least one special character (@ # $ % ^ & * ! ? _ -)';
    const lower = pwd.toLowerCase();
    if (COMMON_PASSWORDS.some(c => lower.includes(c))) return 'Password is too common. Please choose a stronger password.';
    return null;
  };

  const validate = () => {
    const e = {};
    if (!form.username.trim())        e.username = 'Username is required.';
    if (!form.email.trim())           e.email    = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email.';
    const pwdErr = validatePassword(form.password);
    if (pwdErr) e.password = pwdErr;
    if (!form.confirm_password)       e.confirm_password = 'Please confirm your password.';
    else if (form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await authService.register(form);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const fieldErrors = {};
        Object.entries(data).forEach(([k, v]) => {
          fieldErrors[k] = Array.isArray(v) ? v[0] : String(v);
        });
        setErrors(fieldErrors);
        setApiError('Please fix the errors below.');
      } else {
        setApiError(data?.detail || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp-page">
      <div className="lp-bg" aria-hidden="true">
        <div className="lp-bg-base" />
        <div className="lp-bg-radial" />
        <PageCurves />
      </div>

      {/* Card — taller than Login to fit the extra fields */}
      <div className="lp-card" style={{ height: 620 }} role="main">
        <NeonBorderTrace />

        {/* LEFT */}
        <div className="lp-left" aria-hidden="true">
          <img src={loginIllustration} alt="" className="lp-cover-img" draggable="false" />
        </div>

        {/* RIGHT */}
        <div className="lp-right">
          <div className="lp-form-wrap">

            {/* Brand */}
            <div className="lp-chip">
              <span className="lp-chip-dot"><CartIcon /></span>
              <span className="lp-chip-name">Banu Store_POS</span>
            </div>

            {/* Heading */}
            <div className="lp-heading">
              <h2 className="lp-title">Create Account</h2>
              <p className="lp-subtitle">Fill in the details below to register</p>
            </div>

            {/* Success message */}
            {success && (
              <div style={{
                background: '#e8f5e9', border: '1px solid #a5d6a7',
                borderRadius: 10, padding: '.75rem 1rem',
                color: '#2e7d32', fontSize: '.875rem', fontWeight: 600,
                marginBottom: '1rem', display: 'flex', gap: '.5rem', alignItems: 'center',
              }}>
                ✅ Account created successfully! Redirecting to login…
              </div>
            )}

            {/* API error */}
            {apiError && !success && (
              <div className="lp-error-box" role="alert">{apiError}</div>
            )}

            {!success && (
              <form onSubmit={handleSubmit} noValidate>

                {/* Username */}
                <div className="lp-field">
                  <label className="lp-label" htmlFor="rp-user">Username <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <div className="lp-inp-wrap">
                    <span className="lp-inp-icon"><UserIcon /></span>
                    <input id="rp-user" name="username" type="text"
                      className={`lp-input${errors.username ? ' lp-input--error' : ''}`}
                      placeholder="Choose a username"
                      value={form.username} onChange={change}
                      disabled={loading} autoFocus autoComplete="username"
                    />
                  </div>
                  {errors.username && <div className="lp-field-err">{errors.username}</div>}
                </div>

                {/* Email */}
                <div className="lp-field">
                  <label className="lp-label" htmlFor="rp-email">Email <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <div className="lp-inp-wrap">
                    <span className="lp-inp-icon"><MailIcon /></span>
                    <input id="rp-email" name="email" type="email"
                      className={`lp-input${errors.email ? ' lp-input--error' : ''}`}
                      placeholder="you@example.com"
                      value={form.email} onChange={change}
                      disabled={loading} autoComplete="email"
                    />
                  </div>
                  {errors.email && <div className="lp-field-err">{errors.email}</div>}
                </div>

                {/* Password */}
                <div className="lp-field">
                  <label className="lp-label" htmlFor="rp-pass">Password <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <div className="lp-inp-wrap">
                    <span className="lp-inp-icon"><LockIcon /></span>
                    <input id="rp-pass" name="password"
                      type={showPwd ? 'text' : 'password'}
                      className={`lp-input${errors.password ? ' lp-input--error' : ''}`}
                      placeholder="Min. 8 chars, uppercase, number, special char"
                      value={form.password} onChange={change}
                      disabled={loading} autoComplete="new-password"
                      style={{ paddingRight: '2.75rem' }}
                    />
                    <button type="button" className="lp-eye"
                      onClick={() => setShowPwd(v => !v)}
                      aria-label={showPwd ? 'Hide password' : 'Show password'}>
                      {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {errors.password && <div className="lp-field-err">{errors.password}</div>}
                  {/* Password strength hints */}
                  {!errors.password && form.password && (
                    <div style={{ fontSize: '.65rem', color: 'var(--text-muted)', marginTop: '.25rem', lineHeight: 1.6 }}>
                      {[
                        { ok: form.password.length >= 8 && form.password.length <= 64, label: '8–64 characters' },
                        { ok: /[A-Z]/.test(form.password), label: 'Uppercase letter' },
                        { ok: /[a-z]/.test(form.password), label: 'Lowercase letter' },
                        { ok: /[0-9]/.test(form.password), label: 'Number' },
                        { ok: /[@#$%^&*!?_\-]/.test(form.password), label: 'Special character' },
                      ].map(({ ok, label }) => (
                        <span key={label} style={{ marginRight: '.6rem', color: ok ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                          {ok ? '✓' : '✗'} {label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="lp-field">
                  <label className="lp-label" htmlFor="rp-cpass">Confirm Password <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <div className="lp-inp-wrap">
                    <span className="lp-inp-icon"><LockIcon /></span>
                    <input id="rp-cpass" name="confirm_password"
                      type={showCPwd ? 'text' : 'password'}
                      className={`lp-input${errors.confirm_password ? ' lp-input--error' : ''}`}
                      placeholder="Re-enter your password"
                      value={form.confirm_password} onChange={change}
                      disabled={loading} autoComplete="new-password"
                      style={{ paddingRight: '2.75rem' }}
                    />
                    <button type="button" className="lp-eye"
                      onClick={() => setShowCPwd(v => !v)}
                      aria-label={showCPwd ? 'Hide' : 'Show'}>
                      {showCPwd ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {errors.confirm_password && <div className="lp-field-err">{errors.confirm_password}</div>}
                </div>

                {/* Submit */}
                <button type="submit" className="lp-submit" disabled={loading}>
                  {loading
                    ? <><span className="lp-spinner" aria-hidden="true" /> Creating account…</>
                    : <>Create Account <ArrowIcon /></>
                  }
                </button>
              </form>
            )}

            {/* Back to login */}
            <p className="lp-register-row">
              Already have an account?{' '}
              <button type="button" className="lp-register-link"
                onClick={() => navigate('/login')}>
                Sign In
              </button>
            </p>

            <p className="lp-footer">© 2026 Banu Store_POS. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
