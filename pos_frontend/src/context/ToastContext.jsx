import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(undefined);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

let _id = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const push = useCallback(({ type = 'success', title, message, duration = 2800, ...rest }) => {
    const id = ++_id;
    setToasts(prev => [...prev, { id, type, title, message, duration, ...rest }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Convenience helpers
  const success = useCallback((title, message) => push({ type: 'success', title, message }), [push]);
  const error   = useCallback((title, message) => push({ type: 'error',   title, message }), [push]);
  const warning = useCallback((title, message) => push({ type: 'warning', title, message }), [push]);
  const info    = useCallback((title, message) => push({ type: 'info',    title, message }), [push]);

  return (
    <ToastContext.Provider value={{ push, dismiss, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

/* ─── Progress bar component ─── */
const ProgressBar = ({ type, duration = 2800 }) => {
  const barColor = {
    success: '#8A5125',
    error:   '#c62828',
    warning: '#e65100',
    info:    '#0277bd',
  }[type] || '#8A5125';

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: 3, borderRadius: '0 0 14px 14px',
      background: 'rgba(0,0,0,.08)', overflow: 'hidden',
    }}>
      <div style={{
        height: '100%',
        background: barColor,
        borderRadius: '0 0 14px 14px',
        animation: `toastProgress ${duration}ms linear forwards`,
      }}/>
    </div>
  );
};

/* ─── Single Toast ─── */
const Toast = ({ id, type, title, message, details, detailsLabel = 'View Details', duration = 2800, hideProgress = false, onDismiss }) => {
  const isSuccess = type === 'success';
  const isError   = type === 'error';
  const [showDetails, setShowDetails] = useState(false);

  // Thumb emoji icon
  const ThumbIcon = () => (
    <span style={{ fontSize: '1.35rem', lineHeight: 1, userSelect: 'none' }}>
      {isSuccess ? '👍' : isError ? '👎' : type === 'warning' ? '⚠️' : 'ℹ️'}
    </span>
  );

  // Color scheme
  const scheme = {
    success: {
      bg:      'linear-gradient(135deg, #fff8f3 0%, #fef0e6 100%)',
      border:  '#d4956a',
      accent:  '#8A5125',
      titleC:  '#5a2d0c',
      msgC:    '#7a5232',
      iconBg:  'linear-gradient(135deg, #8A5125 0%, #6b3d18 100%)',
      iconC:   '#fff',
      closeC:  '#8A5125',
    },
    error: {
      bg:      'linear-gradient(135deg, #fff5f5 0%, #fee8e8 100%)',
      border:  '#e57373',
      accent:  '#c62828',
      titleC:  '#7f0000',
      msgC:    '#8d3030',
      iconBg:  'linear-gradient(135deg, #c62828 0%, #9b1b1b 100%)',
      iconC:   '#fff',
      closeC:  '#c62828',
    },
    warning: {
      bg:      'linear-gradient(135deg, #fffbf0 0%, #fff3cd 100%)',
      border:  '#ffb74d',
      accent:  '#e65100',
      titleC:  '#4e2700',
      msgC:    '#7a4a00',
      iconBg:  'linear-gradient(135deg, #ef6c00 0%, #bf360c 100%)',
      iconC:   '#fff',
      closeC:  '#e65100',
    },
    info: {
      bg:      'linear-gradient(135deg, #f0f7ff 0%, #e3f2fd 100%)',
      border:  '#64b5f6',
      accent:  '#0277bd',
      titleC:  '#01579b',
      msgC:    '#0d47a1',
      iconBg:  'linear-gradient(135deg, #0288d1 0%, #01579b 100%)',
      iconC:   '#fff',
      closeC:  '#0277bd',
    },
  }[type] || {};

  return (
    <div
      role="alert"
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'flex-start', gap: '.75rem',
        padding: '.85rem 1.1rem 1rem',
        borderRadius: 14,
        background: scheme.bg,
        border: `1.5px solid ${scheme.border}`,
        boxShadow: `0 8px 32px rgba(0,0,0,.13), 0 2px 8px rgba(0,0,0,.07),
                    inset 0 1px 0 rgba(255,255,255,.7)`,
        minWidth: 0, width: 'min(380px, 100%)', maxWidth: 'calc(100vw - 1.5rem)',
        pointerEvents: 'all',
        overflow: 'hidden',
        animation: 'toastSlideIn .28s cubic-bezier(.22,1,.36,1) both',
      }}
    >
      {/* Left accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 4, borderRadius: '14px 0 0 14px',
        background: scheme.accent,
      }}/>

      {/* Icon circle */}
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: scheme.iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 2px 8px ${scheme.accent}44`,
        marginLeft: 4,
      }}>
        <ThumbIcon />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: '.1rem' }}>
        {title && (
          <div style={{
            fontWeight: 800, fontSize: '.875rem',
            color: scheme.titleC, marginBottom: message ? '.18rem' : 0,
            fontFamily: 'var(--font-heading)',
            letterSpacing: '-.01em',
          }}>
            {title}
          </div>
        )}
        {message && (
          <div style={{
            fontSize: '.78rem', color: scheme.msgC,
            fontWeight: 500, lineHeight: 1.4, whiteSpace: 'pre-line',
            maxHeight: showDetails ? 220 : 150,
            overflowY: 'auto',
            paddingRight: 2,
          }}>
            {message}
          </div>
        )}
        {details && (
          <>
            <button
              type="button"
              onClick={() => setShowDetails(v => !v)}
              style={{
                marginTop: '.45rem',
                border: `1px solid ${scheme.border}`,
                background: 'rgba(255,255,255,.55)',
                color: scheme.closeC,
                borderRadius: 6,
                padding: '.22rem .5rem',
                fontSize: '.72rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {showDetails ? 'Hide Details' : detailsLabel}
            </button>
            {showDetails && (
              <div style={{
                marginTop: '.4rem',
                maxHeight: 180,
                overflowY: 'auto',
                whiteSpace: 'pre-line',
                fontSize: '.74rem',
                color: scheme.msgC,
                background: 'rgba(255,255,255,.45)',
                border: `1px solid ${scheme.border}`,
                borderRadius: 8,
                padding: '.45rem .5rem',
              }}>
                {details}
              </div>
            )}
          </>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={() => onDismiss(id)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: scheme.closeC, opacity: .55,
          display: 'flex', alignItems: 'center',
          padding: '.15rem', borderRadius: 6, flexShrink: 0,
          transition: 'opacity .15s',
          marginTop: '.05rem',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = 1; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '.55'; }}
        aria-label="Dismiss"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      {/* Progress bar */}
      {!hideProgress && <ProgressBar type={type} duration={duration} />}
    </div>
  );
};

/* ─── Container ─── */
const ToastContainer = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: 'fixed', top: 'max(.75rem, env(safe-area-inset-top))', right: '.75rem', left: '.75rem', zIndex: 99999,
      display: 'flex', flexDirection: 'column', gap: '.55rem',
      pointerEvents: 'none',
      alignItems: 'flex-end',
    }}>
      {toasts.map(t => (
        <Toast key={t.id} {...t} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
