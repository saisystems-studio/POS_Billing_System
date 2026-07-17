import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import companyService from '../services/companyService';
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

/* ── Page-level background curves ── */
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
    <circle cx="740"  cy="440" r="190" fill="none" stroke="#AF7763" strokeWidth=".6" strokeOpacity=".055"/>
  </svg>
);

/* ── Neon border trace — travels around lp-card edges ── */
const NeonBorderTrace = () => {
  const W = 860, H = 560, R = 24;
  // Perimeter of rounded-rect ≈ 2775
  const P = Math.round(2 * (W - 2*R) + 2 * (H - 2*R) + 2 * Math.PI * R);

  // Line covers ~75% of the border — visible dark gap on the trailing end
  const beamLen = P - 700;   // ~2075 of 2775 = roughly ¾ of perimeter
  const gap     = 700;

  const dur = '8s'; // slow

  const rectPath = `M ${R} 0 L ${W-R} 0 Q ${W} 0 ${W} ${R} L ${W} ${H-R} Q ${W} ${H} ${W-R} ${H} L ${R} ${H} Q 0 ${H} 0 ${H-R} L 0 ${R} Q 0 0 ${R} 0 Z`;

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:2 }}>
      <defs>
        <filter id="lp-neon-bloom" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="16" result="b2" in="SourceGraphic" />
          <feGaussianBlur stdDeviation="6"  result="b1" in="SourceGraphic" />
          <feMerge><feMergeNode in="b2"/><feMergeNode in="b1"/></feMerge>
        </filter>
        <filter id="lp-neon-mid" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="b1" in="SourceGraphic" />
          <feMerge><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Bloom layer — wide soft glow around full border */}
      <path d={rectPath} fill="none" stroke="#B58270" strokeWidth="12" strokeOpacity="0.38"
        filter="url(#lp-neon-bloom)"
        strokeDasharray={`${beamLen} ${gap}`} strokeDashoffset="0" strokeLinecap="butt">
        <animate attributeName="stroke-dashoffset" from="0" to={-P} dur={dur} repeatCount="indefinite" calcMode="linear" />
      </path>

      {/* Mid glow */}
      <path d={rectPath} fill="none" stroke="#C9906E" strokeWidth="5" strokeOpacity="0.60"
        filter="url(#lp-neon-mid)"
        strokeDasharray={`${beamLen} ${gap}`} strokeDashoffset="0" strokeLinecap="butt">
        <animate attributeName="stroke-dashoffset" from="0" to={-P} dur={dur} repeatCount="indefinite" calcMode="linear" />
      </path>

      {/* Bright core — crisp thin line */}
      <path d={rectPath} fill="none" stroke="#F2E0D6" strokeWidth="1.5" strokeOpacity="0.95"
        strokeDasharray={`${beamLen} ${gap}`} strokeDashoffset="0" strokeLinecap="butt">
        <animate attributeName="stroke-dashoffset" from="0" to={-P} dur={dur} repeatCount="indefinite" calcMode="linear" />
      </path>
    </svg>
  );
};

/* ═══════════════════════════════════════════
   LOGIN PAGE
   ═══════════════════════════════════════════ */
const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);
  const [remember, setRemember] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState(null);
  const { login }  = useAuth();
  const navigate   = useNavigate();

  useEffect(() => {
    companyService.getPublicCompanyInfo()
      .then((data) => {
        setCompanyName(data.CompanyName || '');
        setCompanyLogo(data.Logo || null);
      })
      .catch(() => {
        // leave empty — no fallback
      });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Please enter your username and password.');
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Invalid credentials. Please check your username and password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp-page">

      {/* Page background */}
      <div className="lp-bg" aria-hidden="true">
        <div className="lp-bg-base" />
        <div className="lp-bg-radial" />
        <PageCurves />
      </div>

      {/* ── Main card (smaller) ── */}
      <div className="lp-card" role="main">

        {/* Neon border trace animation */}
        <NeonBorderTrace />

        {/* LEFT — full-cover image */}
        <div className="lp-left" aria-hidden="true">
          <img
            src={loginIllustration}
            alt=""
            className="lp-cover-img"
            draggable="false"
          />
        </div>

        {/* RIGHT — sign-in form */}
        <div className="lp-right">
          <div className="lp-form-wrap">

            {/* Brand chip — only shown if company name is loaded */}
            {companyName && (
              <div className="lp-chip">
                <span className="lp-chip-dot">
                  {companyLogo ? (
                    <img src={companyLogo} alt={companyName} style={{width:18,height:18,objectFit:'contain',borderRadius:4}} />
                  ) : (
                    <CartIcon />
                  )}
                </span>
                <span className="lp-chip-name">{companyName}</span>
              </div>
            )}

            {/* Heading */}
            <div className="lp-heading">
              <h2 className="lp-title">
                {companyName ? `Welcome Back to ! 👋` : 'Welcome Back! 👋'}
              </h2>
              <p className="lp-subtitle">Sign in to continue to your workspace</p>
            </div>

            {error && (
              <div className="lp-error-box" role="alert">{error}</div>
            )}

            <form onSubmit={handleSubmit} noValidate>

              {/* Username */}
              <div className="lp-field">
                <label className="lp-label" htmlFor="lp-user">Email / Username</label>
                <div className="lp-inp-wrap">
                  <span className="lp-inp-icon"><UserIcon /></span>
                  <input
                    id="lp-user" type="text"
                    className="lp-input"
                    placeholder="Enter your username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    disabled={loading}
                    autoFocus
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="lp-field">
                <div className="lp-label-row">
                  <label className="lp-label" htmlFor="lp-pass">Password</label>
                  <button type="button" className="lp-forgot">Forgot password?</button>
                </div>
                <div className="lp-inp-wrap">
                  <span className="lp-inp-icon"><LockIcon /></span>
                  <input
                    id="lp-pass"
                    type={showPwd ? 'text' : 'password'}
                    className="lp-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="current-password"
                    style={{ paddingRight: '2.75rem' }}
                  />
                  <button type="button" className="lp-eye"
                    onClick={() => setShowPwd(v => !v)}
                    aria-label={showPwd ? 'Hide password' : 'Show password'}>
                    {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="lp-field" style={{ marginBottom: '.5rem' }}>
                <label className="lp-remember">
                  <input type="checkbox" checked={remember}
                    onChange={e => setRemember(e.target.checked)} />
                  <span>Remember me</span>
                </label>
              </div>

              {/* Sign In button */}
              <button type="submit" className="lp-submit" disabled={loading}>
                {loading
                  ? <><span className="lp-spinner" aria-hidden="true" /> Signing in…</>
                  : <>Sign In <ArrowIcon /></>
                }
              </button>

            </form>

            {/* Create account row */}
            <p className="lp-register-row">
              Don't have an account?{' '}
              <button type="button" className="lp-register-link"
                onClick={() => navigate('/register')}>Register</button>
            </p>

            <p className="lp-footer">© {new Date().getFullYear()} {companyName || 'POS System'}. All rights reserved.</p>

          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
