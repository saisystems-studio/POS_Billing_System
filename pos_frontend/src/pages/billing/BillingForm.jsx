import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
// createPortal is still used for CustomerSearchDropdown portal dropdown
import Layout from '../../components/Layout';
import ConfirmModal from '../../components/ConfirmModal';
import billingService from '../../services/billingService';
import { clearPageCache } from '../../services/pageCache';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import useResponsivePageSize from '../../hooks/useResponsivePageSize';
import useMobileDropdownPlacement from '../../hooks/useMobileDropdownPlacement';
import AutoFitColumns from '../../components/AutoFitColumns';

const BRAND   = '#8A5125';
const BRAND_LIGHT = '#fdf3eb';
const ALT_ROW = 'rgba(138,81,37,.03)';
const HEADER_BG = '#8A5125';

/* ── Spinner ── */
const Spin = () => (
  <span style={{display:'inline-block',width:13,height:13,border:'2px solid rgba(255,255,255,.35)',
    borderTopColor:'#fff',borderRadius:'50%',animation:'spin .6s linear infinite'}}/>
);

/* ── Edit (pencil) icon ── */
const PencilIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" style={{width:11,height:11}}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/>
  </svg>
);

/* ── Lock icon ── */
const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" style={{width:11,height:11}}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

/* ── X / Remove icon ── */
const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" style={{width:11,height:11}}>
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

/* ── useDropdownPos: only used by CustomerSearchDropdown (portal) ── */
const useDropdownPos = (inputRef, open) => {
  const [pos, setPos] = useState({ top:0, bottom:'auto', left:0, width:0, maxHeight:240 });
  useEffect(() => {
    if (!open || !inputRef.current) return;
    const measure = () => {
      const r = inputRef.current.getBoundingClientRect();
      const mobile = window.matchMedia('(max-width: 768px)').matches;
      const below = Math.max(0, window.innerHeight - r.bottom - (mobile ? 110 : 0));
      const above = Math.max(0, r.top - 12);
      const openUp = mobile && below < 180 && above > below;
      setPos({
        top: openUp ? 'auto' : r.bottom + 3,
        bottom: openUp ? window.innerHeight - r.top + 3 : 'auto',
        left: r.left,
        width: r.width,
        maxHeight: mobile ? Math.max(120, Math.min(240, openUp ? above : below)) : 280,
      });
    };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    window.visualViewport?.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('scroll', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('scroll', measure);
    };
  }, [open, inputRef]);
  return pos;
};

/* ── CustomerSearchDropdown ── */
const CustomerSearchDropdown = ({ customers, value, onChange, disabled, onNavigateToAdd, inputRef: extRef, onNext, onPrev, onSearch, loading, error }) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const inputRef = extRef || useRef(null); // eslint-disable-line
  const listRef = useRef(null);
  const blurTimer = useRef(null);
  const pos = useDropdownPos(inputRef, open);

  const sel = customers.find(c => c.id === value);
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setQ(sel ? sel.CustomerName : '');
  }, [value, customers, inputRef, sel]); // eslint-disable-line

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      onSearch?.(q);
    }, 250);
    return () => clearTimeout(t);
  }, [open, q, onSearch]);

  useEffect(() => {
    if (!open) return;
    const h = e => {
      if (inputRef.current?.contains(e.target)) return;
      if (listRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]); // eslint-disable-line

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return undefined;
    const clear = () => {
      if (disabled) return;
      clearTimeout(blurTimer.current);
      setQ('');
      setOpen(false);
      setHi(-1);
      onChange(null);
      setTimeout(() => el.focus(), 0);
    };
    el.addEventListener('pos-escape-clear-field', clear);
    return () => el.removeEventListener('pos-escape-clear-field', clear);
  }, [disabled, inputRef, onChange]);

  const term = q.trim().toLowerCase();
  const filtered = !term ? customers : customers.filter(c =>
    c.CustomerName.toLowerCase().includes(term) ||
    (c.CustomerCode || '').toLowerCase().includes(term) ||
    (c.PhoneNumber || '').includes(term)
  );

  useEffect(() => {
    if (!open) return;
    setHi(h => {
      if (filtered.length === 0) return -1;
      return h < 0 ? 0 : Math.min(h, filtered.length - 1);
    });
  }, [filtered.length, open]);

  const pick = c => {
    onChange(c.id); setQ(c.CustomerName); setOpen(false); setHi(-1);
  };

  const handleKey = e => {
    if (e.key === 'Escape') { setOpen(false); setQ(sel ? sel.CustomerName : ''); return; }
    if (e.key === 'Backspace' && !q) { e.preventDefault(); setOpen(false); onPrev?.(); return; }
    if (!open) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (value) onNext?.();
        else setOpen(true);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (hi >= 0 && filtered[hi]) pick(filtered[hi]); }
  };

  useEffect(() => {
    if (hi >= 0 && listRef.current) {
      const el = listRef.current.children[hi];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [hi]);

  const dropList = open ? createPortal(
    <ul ref={listRef} className="shared-dropdown-menu shared-dropdown-menu-portal" data-sales-dropdown-open="true" style={{position:'fixed',top:pos.top,bottom:pos.bottom,left:pos.left,width:pos.width,maxWidth:pos.width,
      zIndex:99999,background:'#fff',border:`1.5px solid ${BRAND}`,borderTop:'none',
      borderRadius:'0 0 7px 7px',boxShadow:'0 8px 24px rgba(0,0,0,.18)',
      maxHeight:pos.maxHeight,overflowY:'auto',margin:0,padding:0,listStyle:'none','--mobile-dropdown-max-height':`${pos.maxHeight}px`}}>
      {error && filtered.length === 0
          ? <li style={{padding:'.5rem .75rem',color:'var(--danger)',fontSize:'.8rem',fontWeight:600}}>{error}</li>
          : filtered.length === 0
            ? <li style={{padding:'.5rem .75rem',color:'var(--text-muted)',fontSize:'.8rem',fontStyle:'italic'}}>No matching customers found</li>
        : filtered.map((c, i) => (
          <li key={c.id} onMouseDown={e => { e.preventDefault(); pick(c); }}
            style={{padding:'.4rem .75rem',fontSize:'.82rem',cursor:'pointer',
              borderBottom:'1px solid var(--divider)',
              background: value === c.id ? BRAND_LIGHT : hi === i ? '#f5f0eb' : 'transparent',
              fontWeight: value === c.id ? 700 : 400,
              display:'flex',justifyContent:'space-between',alignItems:'center',gap:'.5rem'}}>
            <div>
              <span style={{fontWeight:700,color:'var(--text-primary)'}}>{c.CustomerName}</span>
              {c.CustomerCode && <code style={{marginLeft:'.4rem',fontSize:'.68rem',color:'var(--text-muted)'}}>{c.CustomerCode}</code>}
            </div>
            <div style={{fontSize:'.7rem',color:'var(--text-muted)',flexShrink:0}}>
              {c.PhoneNumber && <span>{c.PhoneNumber}</span>}
            </div>
          </li>
        ))}
    </ul>, document.body
  ) : null;

  return (
    <div style={{display:'flex',alignItems:'center',gap:'.4rem'}}>
      <div style={{position:'relative',flex:'0 1 260px',minWidth:170,maxWidth:280}}>
        <input ref={inputRef} type="text" value={q} disabled={disabled} autoComplete="off"
          data-sales-dropdown="true"
          data-billing-field="true"
          placeholder="Search customer…"
          style={{width:'100%',height:32,padding:'.25rem .6rem',fontSize:'.82rem',
            border:`1.5px solid ${open ? BRAND : 'var(--border-input)'}`,borderRadius:6,
            outline:'none',background:'var(--card-bg)',color:'var(--text-primary)',
            paddingRight:'1.6rem',transition:'border-color .15s'}}
          onChange={e => { setQ(e.target.value); setOpen(true); setHi(0); if (!e.target.value) onChange(null); }}
          onFocus={() => { setOpen(true); setHi(-1); inputRef.current?.select?.(); }}
          onBlur={() => { blurTimer.current = setTimeout(() => { setOpen(false); if (!sel) setQ(''); else setQ(sel.CustomerName); }, 180); }}
          onKeyDown={handleKey}/>
        <span onMouseDown={e => { e.preventDefault(); clearTimeout(blurTimer.current); if (!disabled) { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 0); } }}
          style={{position:'absolute',right:'.45rem',top:'50%',transform:'translateY(-50%)',
            cursor:disabled?'not-allowed':'pointer',color:'var(--text-muted)',fontSize:'.6rem',
            userSelect:'none',lineHeight:1}}>▾</span>
        {dropList}
      </div>
      {!disabled && (
        <button type="button" title="Add new customer" tabIndex={-1} onClick={() => onNavigateToAdd?.()}
          style={{width:26,height:26,borderRadius:6,border:`1.5px solid ${BRAND}`,
            background:BRAND_LIGHT,color:BRAND,fontWeight:800,fontSize:'1rem',
            cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',
            justifyContent:'center',lineHeight:1}}>+</button>
      )}
    </div>
  );
};

/* ── PriceCodeDropdown (per-row, shown only for Random customers) ──
   Uses position:absolute inside its cell wrapper — never portals.
   Includes a sticky internal search input like the Customer dropdown. ── */
const PriceCodeDropdown = ({ priceCodes, value, onChange, disabled, productData, rowKey, inputRef: extRef, onNext, onPrev }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hi, setHi] = useState(0);
  const wrapRef  = useRef(null);
  const { menuClassName, mobileMenuStyle } = useMobileDropdownPlacement(wrapRef, open);
  const searchRef = useRef(null);
  const listRef  = useRef(null);
  const inputRef = extRef || useRef(null); // eslint-disable-line

  const sel = priceCodes.find(p => p.id === value);

  const label = pc => {
    if (!productData) return pc.DisplayLabel;
    const tier = (productData.prices || []).find(p => p.PriceCodeID === pc.id);
    return tier ? `${pc.DisplayLabel} — ₹${parseFloat(tier.ProductPrice).toFixed(2)}` : pc.DisplayLabel;
  };

  /* Reset display when row key changes (row reused) */
  useEffect(() => { setOpen(false); setSearch(''); }, [rowKey]); // eslint-disable-line

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const h = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false); setSearch('');
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  /* Focus search input when dropdown opens */
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30);
  }, [open]);

  const term = search.trim().toLowerCase();
  const filtered = !term ? priceCodes : priceCodes.filter(pc =>
    pc.PriceCodeName.toLowerCase().includes(term) ||
    pc.DisplayLabel.toLowerCase().includes(term)
  );

  const pick = pc => {
    onChange(pc.id);
    setOpen(false);
    setSearch('');
    setHi(0);
    setTimeout(() => onNext?.(pc.id), 60);
  };

  const openDrop = () => {
    if (disabled) return;
    setHi(sel ? Math.max(0, priceCodes.indexOf(sel)) : 0);
    setOpen(true);
  };

  /* Keyboard on the trigger input (the display span/button) */
  const handleTriggerKey = e => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'Backspace' && !value) { e.preventDefault(); setOpen(false); onPrev?.(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (value) {
        setOpen(false);
        onNext?.();
      } else {
        openDrop();
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === ' ') {
      e.preventDefault(); openDrop();
    }
  };

  /* Keyboard on the internal search input */
  const handleSearchKey = e => {
    if (e.key === 'Escape') { setOpen(false); setSearch(''); inputRef.current?.focus(); return; }
    if (e.key === 'Backspace' && !search) { e.preventDefault(); setOpen(false); onPrev?.(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[hi]) pick(filtered[hi]); }
  };

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return undefined;
    const clear = () => {
      if (disabled) return;
      setOpen(false);
      setSearch('');
      setHi(0);
      if (value) onChange(null);
      setTimeout(() => el.focus(), 0);
    };
    el.addEventListener('pos-escape-clear-field', clear);
    return () => el.removeEventListener('pos-escape-clear-field', clear);
  }, [disabled, inputRef, onChange, value]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const clear = event => {
      if (event.target === inputRef.current || disabled) return;
      setOpen(false);
      setSearch('');
      setHi(0);
      if (value) onChange(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    };
    el.addEventListener('pos-escape-clear-field', clear);
    return () => el.removeEventListener('pos-escape-clear-field', clear);
  }, [disabled, inputRef, onChange, value]);

  useEffect(() => {
    if (open && hi >= 0 && listRef.current) {
      const el = listRef.current.children[hi];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [hi, open]);

  const displayLabel = sel ? label(sel) : '';

  return (
    <div ref={wrapRef} style={{position:'relative', width:'100%', overflow:'visible'}}>
      {/* Trigger — shows selected label or placeholder */}
      <button
        ref={inputRef}
        type="button"
        data-sales-dropdown="true"
        data-escape-clear="true"
        data-billing-field="true"
        disabled={disabled}
        onClick={openDrop}
        onFocus={openDrop}
        onKeyDown={handleTriggerKey}
        style={{
          width:'100%', height:26, padding:'.18rem .45rem', fontSize:'.8rem',
          border:'none', borderBottom:`1.5px solid ${disabled ? 'var(--scale-200)' : open ? BRAND : 'var(--border-input)'}`,
          borderRadius:0, background:'transparent', textAlign:'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: displayLabel ? 'var(--text-primary)' : 'var(--text-muted)',
          outline:'none', display:'flex', alignItems:'center', justifyContent:'space-between',
          transition:'border-color .15s', paddingRight:'1.5rem',
          overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
        }}
        title={displayLabel || 'Select price code…'}
      >
        <span style={{overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', flex:1}}>
          {displayLabel || <span style={{color:'var(--text-muted)'}}>Select price code</span>}
        </span>
        <span style={{position:'absolute', right:'.35rem', top:'50%', transform:'translateY(-50%)',
          color:'var(--text-muted)', fontSize:'.6rem', userSelect:'none', lineHeight:1,
          transition:'transform .15s', ...(open ? {transform:'translateY(-50%) rotate(180deg)'} : {})}}>▾</span>
      </button>

      {/* Absolute dropdown — stays inside the cell */}
      {open && (
        <div className={menuClassName} data-sales-dropdown-open="true" style={{...mobileMenuStyle,
          position:'absolute', top:'calc(100% + 3px)', left:0, minWidth:'100%', width:'max-content', maxWidth:260,
          zIndex:99999, background:'#fff', border:`1.5px solid ${BRAND}`,
          borderRadius:'0 0 7px 7px', boxShadow:'0 8px 24px rgba(0,0,0,.18)',
          display:'flex', flexDirection:'column',
        }}>
          {/* Search input — always visible at top */}
          <div style={{padding:'.3rem .5rem', borderBottom:`1px solid ${BRAND}22`, background:'#fff', flexShrink:0}}>
            <input
              ref={searchRef}
              type="text"
              data-sales-dropdown="true"
              value={search}
              placeholder="Search price code…"
              autoComplete="off"
              onChange={e => { setSearch(e.target.value); setHi(0); }}
              onKeyDown={handleSearchKey}
              style={{
                width:'100%', height:24, padding:'.15rem .4rem', fontSize:'.76rem',
                border:`1px solid ${BRAND}66`, borderRadius:4,
                outline:'none', background:'#fff', color:'var(--text-primary)',
              }}
            />
          </div>
          {/* Options list — scrollable */}
          <ul ref={listRef} style={{margin:0, padding:0, listStyle:'none', maxHeight:190, overflowY:'auto', flex:1}}>
            <li onMouseDown={e => {
              e.preventDefault();
              onChange(null);
              setOpen(false);
              setSearch('');
              setHi(0);
              setTimeout(() => onNext?.(null), 60);
            }} style={{padding:'.38rem .65rem',color:'var(--text-muted)',fontSize:'.82rem',
              cursor:'pointer',borderBottom:'1px solid var(--divider)'}}>
              Select price code
            </li>
            {filtered.length === 0 ? (
              <li style={{padding:'.45rem .65rem', color:'var(--text-muted)', fontSize:'.78rem', fontStyle:'italic'}}>
                No price codes available for this product
              </li>
            ) : filtered.map((pc, i) => (
              <li key={pc.id}
                onMouseDown={e => { e.preventDefault(); pick(pc); }}
                onMouseEnter={() => setHi(i)}
                style={{
                  padding:'.38rem .65rem', fontSize:'.82rem', cursor:'pointer',
                  background: value === pc.id ? BRAND_LIGHT : hi === i ? '#f5f0eb' : 'transparent',
                  fontWeight: value === pc.id ? 700 : 400,
                  color: value === pc.id ? BRAND : 'var(--text-primary)',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--divider)' : 'none',
                  transition:'background .1s',
                }}>
                {label(pc)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/* ── ProductSearchDropdown ──
   Uses position:absolute inside its cell wrapper — no portal, no fixed.
   Includes a sticky internal search input. Opens directly below the cell. ── */
const PRODUCT_OPTION_HEIGHT = 34;
const PRODUCT_DROPDOWN_HEIGHT = 210;
const PRODUCT_VISIBLE_OVERSCAN = 4;

const ProductSearchDropdown = ({
  products, value, onChange, disabled, inputRef: extRef, onNext, onPrev,
  onSearch, onRetry, onLoadMore, loading, loadingMore, hasMore, error,
  moveToActionsOnEmptyEnter = false,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hi, setHi] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const wrapRef   = useRef(null);
  const { menuClassName, mobileMenuStyle } = useMobileDropdownPlacement(wrapRef, open);
  const searchRef = useRef(null);
  const listRef   = useRef(null);
  const inputRef  = extRef || useRef(null); // eslint-disable-line

  const sel = products.find(p => p.id === value);
  const displayText = sel ? sel.ProductName : '';

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const h = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  /* Focus search input when dropdown opens */
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      onSearch?.(search);
    }, 250);
    return () => clearTimeout(t);
  }, [open, search, onSearch]);

  const term = search.trim().toLowerCase();
  const filtered = !term ? products : products.filter(p =>
    (p.ProductName || '').toLowerCase().includes(term) ||
    (p.ProductCode || '').toLowerCase().includes(term) ||
    (p.Barcode || '').toLowerCase().includes(term) ||
    (p.Units || '').toLowerCase().includes(term)
  );
  const visibleCount = Math.ceil(PRODUCT_DROPDOWN_HEIGHT / PRODUCT_OPTION_HEIGHT) + PRODUCT_VISIBLE_OVERSCAN;
  const visibleStart = Math.max(0, Math.floor(scrollTop / PRODUCT_OPTION_HEIGHT) - PRODUCT_VISIBLE_OVERSCAN);
  const visibleItems = filtered.slice(visibleStart, visibleStart + visibleCount);
  const topPad = visibleStart * PRODUCT_OPTION_HEIGHT;
  const bottomPad = Math.max(0, (filtered.length - visibleStart - visibleItems.length) * PRODUCT_OPTION_HEIGHT);
  const listHeight = Math.min(
    PRODUCT_DROPDOWN_HEIGHT,
    Math.max(PRODUCT_OPTION_HEIGHT, (filtered.length + (loadingMore ? 1 : 0)) * PRODUCT_OPTION_HEIGHT)
  );

  const pick = p => {
    onChange(p.id);
    setOpen(false);
    setSearch('');
    setHi(0);
    setScrollTop(0);
    setTimeout(() => onNext?.(p.id), 60);
  };

  const openDrop = () => {
    if (disabled) return;
    setHi(sel ? Math.max(0, products.indexOf(sel)) : 0);
    setScrollTop(0);
    setOpen(true);
  };

  /* Keyboard on trigger (the display button) */
  const handleTriggerKey = e => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'Backspace' && !value) { e.preventDefault(); setOpen(false); onPrev?.(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (value) {
        setOpen(false);
        onNext?.();
      } else if (moveToActionsOnEmptyEnter && !search.trim()) {
        setOpen(false);
        onNext?.();
      } else {
        openDrop();
      }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); openDrop(); }
  };

  /* Keyboard on the internal search input */
  const handleSearchKey = e => {
    if (e.key === 'Escape') { setOpen(false); setSearch(''); inputRef.current?.focus(); return; }
    if (e.key === 'Backspace' && !search) { e.preventDefault(); setOpen(false); onPrev?.(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[hi]) pick(filtered[hi]);
      else if (moveToActionsOnEmptyEnter && !search.trim()) {
        setOpen(false);
        onNext?.();
      }
    }
  };

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return undefined;
    const clear = () => {
      if (disabled) return;
      setOpen(false);
      setSearch('');
      setHi(0);
      setScrollTop(0);
      if (value) onChange(null);
      setTimeout(() => el.focus(), 0);
    };
    el.addEventListener('pos-escape-clear-field', clear);
    return () => el.removeEventListener('pos-escape-clear-field', clear);
  }, [disabled, inputRef, onChange, value]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const clear = event => {
      if (event.target === inputRef.current || disabled) return;
      setOpen(false);
      setSearch('');
      setHi(0);
      setScrollTop(0);
      if (value) onChange(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    };
    el.addEventListener('pos-escape-clear-field', clear);
    return () => el.removeEventListener('pos-escape-clear-field', clear);
  }, [disabled, inputRef, onChange, value]);

  useEffect(() => {
    if (open && hi >= 0 && listRef.current) {
      const nextTop = hi * PRODUCT_OPTION_HEIGHT;
      const currentTop = listRef.current.scrollTop;
      const currentBottom = currentTop + PRODUCT_DROPDOWN_HEIGHT - PRODUCT_OPTION_HEIGHT;
      if (nextTop < currentTop) listRef.current.scrollTop = nextTop;
      else if (nextTop > currentBottom) listRef.current.scrollTop = nextTop - PRODUCT_DROPDOWN_HEIGHT + PRODUCT_OPTION_HEIGHT;
    }
  }, [hi, open]);

  const handleListScroll = e => {
    const el = e.currentTarget;
    setScrollTop(el.scrollTop);
    if (hasMore && !loading && !loadingMore && el.scrollHeight - el.scrollTop - el.clientHeight < PRODUCT_OPTION_HEIGHT * 3) {
      onLoadMore?.(search);
    }
  };

  return (
    <div style={{display:'flex',alignItems:'center',gap:'.25rem',width:'100%',minWidth:0}}>
    <div ref={wrapRef} style={{position:'relative', width:'100%', minWidth:0, overflow:'visible'}}>
      {/* Trigger button — shows selected product or placeholder */}
      <button
        ref={inputRef}
        type="button"
        data-sales-dropdown="true"
        data-escape-clear="true"
        data-billing-field="true"
        disabled={disabled}
        onClick={openDrop}
        onFocus={openDrop}
        onKeyDown={handleTriggerKey}
        style={{
          width:'100%', minWidth:0, maxWidth:'100%', height:26,
          padding:'.18rem .45rem', fontSize:'.8rem', boxSizing:'border-box',
          border:'none', borderBottom:`1.5px solid ${disabled ? 'var(--scale-200)' : open ? BRAND : 'var(--border-input)'}`,
          borderRadius:0, background:'transparent', textAlign:'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline:'none', display:'flex', alignItems:'center',
          transition:'border-color .15s', paddingRight:'1.4rem',
          overflow:'hidden', whiteSpace:'nowrap',
        }}
        title={displayText || 'Search product…'}
      >
        {displayText ? (
          <span style={{overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', flex:1,
            color:'var(--text-primary)', fontWeight:500}}>
            {displayText}
          </span>
        ) : (
          <span style={{color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', flex:1}}>
            Select particulars
          </span>
        )}
        <span style={{
          position:'absolute', right:'.35rem', top:'50%', transform:'translateY(-50%)',
          color:'var(--text-muted)', fontSize:'.55rem', userSelect:'none', lineHeight:1,
          transition:'transform .15s', ...(open ? {transform:'translateY(-50%) rotate(180deg)'} : {}),
        }}>▾</span>
      </button>

      {/* Absolute dropdown — anchored to this cell */}
      {open && (
        <div className={menuClassName} data-sales-dropdown-open="true" style={{...mobileMenuStyle,
          position:'absolute', top:'calc(100% + 3px)', left:0,
          width:'max-content', minWidth:'100%', maxWidth:380,
          zIndex:99999, background:'#fff', border:`1.5px solid ${BRAND}`,
          borderRadius:'0 0 7px 7px', boxShadow:'0 8px 24px rgba(0,0,0,.18)',
          display:'flex', flexDirection:'column',
        }}>
          {/* Search input — always visible at top */}
          <div style={{padding:'.35rem .5rem', borderBottom:`1px solid ${BRAND}22`, background:'#fff', flexShrink:0}}>
            <input
              ref={searchRef}
              type="text"
              data-sales-dropdown="true"
              value={search}
              placeholder="Search by name, code, barcode, unit…"
              autoComplete="off"
              onChange={e => { setSearch(e.target.value); setHi(0); setScrollTop(0); if (listRef.current) listRef.current.scrollTop = 0; }}
              onKeyDown={handleSearchKey}
              style={{
                width:'100%', height:26, padding:'.15rem .5rem', fontSize:'.78rem',
                border:`1px solid ${BRAND}66`, borderRadius:4,
                outline:'none', background:'#fff', color:'var(--text-primary)',
              }}
            />
          </div>
          {/* Options list — scrollable */}
          <ul ref={listRef} onScroll={handleListScroll} style={{margin:0, padding:0, listStyle:'none', height:listHeight, maxHeight:PRODUCT_DROPDOWN_HEIGHT, overflowY:filtered.length > 0 ? 'auto' : 'hidden', flex:'0 0 auto'}}>
            <li onMouseDown={e => {
              e.preventDefault();
              onChange(null);
              setOpen(false);
              setSearch('');
              setHi(0);
              setScrollTop(0);
              setTimeout(() => inputRef.current?.focus(), 0);
            }} style={{height:PRODUCT_OPTION_HEIGHT,boxSizing:'border-box',padding:'.38rem .65rem',
              display:'flex',alignItems:'center',color:'var(--text-muted)',fontSize:'.82rem',
              cursor:'pointer',borderBottom:'1px solid var(--divider)'}}>
              Select particulars
            </li>
            {error && filtered.length === 0 ? (
              <li style={{padding:'.45rem .65rem', color:'var(--danger)', fontSize:'.78rem', fontWeight:600}}>
                <span>{error}</span>
                <button
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRetry?.(search);
                  }}
                  style={{marginLeft:8,border:'none',background:'transparent',color:'var(--danger)',fontWeight:800,cursor:'pointer',padding:0,fontSize:'.78rem'}}>
                  Retry
                </button>
              </li>
            ) : filtered.length === 0 ? (
              <li style={{padding:'.45rem .65rem', color:'var(--text-muted)', fontSize:'.78rem', fontStyle:'italic'}}>
                No matching products
              </li>
            ) : (
              <>
                {topPad > 0 && <li aria-hidden="true" style={{height:topPad, boxSizing:'border-box'}} />}
                {visibleItems.map((p, visibleIdx) => {
                  const i = visibleStart + visibleIdx;
                  return (
              <li key={p.id}
                onMouseDown={e => { e.preventDefault(); pick(p); }}
                onMouseEnter={() => setHi(i)}
                style={{
                  height:PRODUCT_OPTION_HEIGHT,
                  boxSizing:'border-box',
                  padding:'.38rem .65rem', fontSize:'.82rem', cursor:'pointer',
                  background: value === p.id ? BRAND_LIGHT : hi === i ? '#f5f0eb' : 'transparent',
                  fontWeight: value === p.id ? 700 : 400,
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--divider)' : 'none',
                  transition:'background .1s',
                  display:'flex', alignItems:'center', gap:'.35rem', flexWrap:'nowrap',
                  overflow:'hidden',
                }}>
                <span style={{color:'var(--text-primary)', fontWeight:600, whiteSpace:'nowrap'}}>{p.ProductName}</span>
                {p.Units && (
                  <span style={{fontSize:'.72rem',color:'var(--text-muted)',whiteSpace:'nowrap',flexShrink:0}}>
                    {p.Units}
                  </span>
                )}
              </li>
                  );
                })}
                {bottomPad > 0 && <li aria-hidden="true" style={{height:bottomPad, boxSizing:'border-box'}} />}
                {loadingMore && (
                  <li style={{height:PRODUCT_OPTION_HEIGHT, boxSizing:'border-box', padding:'.45rem .65rem', color:'var(--text-muted)', fontSize:'.78rem', fontStyle:'italic'}}>
                    Loading more...
                  </li>
                )}
                {error && filtered.length > 0 && !loadingMore && (
                  <li style={{padding:'.45rem .65rem', color:'var(--danger)', fontSize:'.78rem', fontWeight:600}}>
                    <span>{error}</span>
                    <button
                      type="button"
                      onMouseDown={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRetry?.(search);
                      }}
                      style={{marginLeft:8,border:'none',background:'transparent',color:'var(--danger)',fontWeight:800,cursor:'pointer',padding:0,fontSize:'.78rem'}}>
                      Retry
                    </button>
                  </li>
                )}
              </>
            )}
          </ul>
        </div>
      )}
    </div>
    </div>
  );
};

/* ── Helpers ── */
const moneyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
});
const fmtMoney = v => {
  const amount = Number(v || 0);
  try {
    return moneyFormatter.format(amount);
  } catch {
    return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
};

const getRateForCode = (productData, pcID) => {
  if (!productData || !pcID) return '';
  const tier = (productData.prices || []).find(p => p.PriceCodeID === pcID);
  return tier ? String(tier.ProductPrice) : '';
};

const productOptionFromBillLine = line => ({
  id: line.ProductID,
  ProductCode: line.ProductCode || '',
  ProductName: line.ProductName || '',
  Units: line.Units || '',
  UnitName: line.Units || '',
  GSTPercent: line.GSTPercent ?? 0,
  prices: [],
});

const EMPTY_LINE = () => ({
  _key: Math.random().toString(36).slice(2),
  ProductID: null,
  productData: null,
  PriceCodeID: null,
  rate: '',          // OriginalRate from price code table
  changeableRate: '', // user-edited override — never touches price code table
  isRateEditable: false,
  Qty: '',
  IsDiscountApplied: false,
  DiscountPercent: '',
  IsGSTApplied: false,
  GSTPercent: '',
  _inactive: false,
});

/* Effective rate = changeableRate if set & valid, else rate */
const getEffectiveRate = row => {
  const cr = parseFloat(row.changeableRate);
  return (!isNaN(cr) && cr > 0) ? cr : (parseFloat(row.rate) || 0);
};

/* Is a row "completed" — has product, qty > 0, effective rate > 0 */
const isRowComplete = row => {
  const hasManualRate = row.changeableRate !== '' &&
    row.changeableRate != null &&
    Number.isFinite(Number(row.changeableRate)) &&
    Number(row.changeableRate) > 0;
  return row.ProductID &&
    (row.PriceCodeID || hasManualRate) &&
    parseFloat(row.Qty) > 0 &&
    getEffectiveRate(row) > 0;
};

const isBlankRow = row =>
  !row?.ProductID && !row?.Qty && !row?.changeableRate && !row?.rate;

/* Column key constants */
const COL_PRODUCT    = 'product';
const COL_QTY        = 'qty';
const COL_PRICE_CODE = 'priceCode';
const COL_RATE       = 'rate';
const COL_AMOUNT     = 'amount';

/* ═══════════════════════════════════════════════════════════
   BillingForm — main component
═══════════════════════════════════════════════════════════ */
const BillingForm = () => {
  const autoFitTableRef = useRef(null);
  const navigate    = useNavigate();
  const location    = useLocation();
  const { id }      = useParams();
  const { isAdmin } = useAuth();
  const { companyInfo } = useCompany();
  const toast       = useToast();
  const isEdit      = id !== undefined && id !== 'new';
  const mode        = new URLSearchParams(location.search).get('mode');
  const isViewMode  = isEdit && mode === 'view';
  const isReadOnly  = isViewMode;
  const restoredDraftRef = useRef(false);
  const editBillLoadedRef = useRef(false);

  /* ── state ── */
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [customers,  setCustomers]  = useState([]);
  const [products,   setProducts]   = useState([]);
  const [priceCodes, setPriceCodes] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsLoadingMore, setProductsLoadingMore] = useState(false);
  const [customersError, setCustomersError] = useState('');
  const [productsError, setProductsError] = useState('');
  const [productsHasMore, setProductsHasMore] = useState(false);
  const [productsCursor, setProductsCursor] = useState(null);
  const [customerID, setCustomerID] = useState(null);
  const [priceConfig,setPriceConfig]= useState(null);
  const [rows,       setRows]       = useState([EMPTY_LINE()]);
  const [savedBillNo,setSavedBillNo]= useState('');
  const [editBillNo, setEditBillNo] = useState('');
  const [apiError,   setApiError]   = useState('');
  const [rowErrors,  setRowErrors]  = useState({}); // { rowIdx: 'message' }
  const [showDel,    setShowDel]    = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [billingPage, setBillingPage] = useState(1);

  /* cell refs: cellRefs.current[rowIdx][colKey] = HTMLElement */
  const cellRefs   = useRef({});
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const rowCloseRefs = useRef([]);
  const pageRef = useRef(null);
  const cancelBtnRef = useRef(null);
  const saveBtnRef = useRef(null);
  const custRef    = useRef(null);
  /* track a pending new-row auto-add to avoid double-adding */
  const addRowTimer = useRef(null);
  const saveInFlightRef = useRef(false);
  const shortcutSavePendingRef = useRef(false);
  const initialCustomerFocusRef = useRef(false);
  const lastEnterRef = useRef({ time: 0, target: null });
  const customersReqRef = useRef(0);
  const productsReqRef = useRef(0);
  const productsCountRef = useRef(0);
  const lastProductSearchRef = useRef(null);
  const loadingMoreProductsRef = useRef(false);
  const failedProductPageRef = useRef(null);
  const { pageSize: billingRowsPerPage, containerRef: billingGridRef, rowRef: billingRowRef, bottomRef: billingActionsRef } = useResponsivePageSize({
    minRows: 3,
    maxRows: 20,
    defaultRowHeight: 36,
    mobileRowHeight: 238,
    reservedBottomSpace: 54,
    safeSpacing: 12,
  });

  /* ── derived ── */
  const isFixed   = priceConfig?.PriceCodeType === 'Fixed';
  const selCust   = customers.find(c => c.id === customerID);

  useEffect(() => {
    productsCountRef.current = products.length;
  }, [products.length]);

  /* Active navigable columns (product → qty → [priceCode if Random] → rate) */
  const activeCols = useCallback(() => {
    const cols = [COL_PRODUCT, COL_QTY];
    if (!isFixed) cols.push(COL_PRICE_CODE);
    cols.push(COL_RATE);
    return cols;
  }, [isFixed]);

  /* ── focus a cell ── */
  const focusCell = useCallback((rowIdx, col) => {
    setBillingPage(Math.floor(rowIdx / billingRowsPerPage) + 1);
    setTimeout(() => {
      const rowKey = rowsRef.current[rowIdx]?._key;
      const el = rowKey ? cellRefs.current[rowKey]?.[col] : null;
      if (el) { el.focus(); if (el.select) el.select(); }
    }, 60);
  }, [billingRowsPerPage]);

  const focusEl = useCallback((el) => {
    setTimeout(() => {
      if (el && !el.disabled) {
        el.focus();
        if (el.select) el.select();
      }
    }, 30);
  }, []);

  const focusRowClose = useCallback((rowIdx) => {
    setTimeout(() => {
      const el = rowCloseRefs.current[rowIdx];
      if (el && !el.disabled) el.focus();
    }, 30);
  }, []);

  const focusLastGridField = useCallback(() => {
    setTimeout(() => {
      for (let rowIdx = rows.length - 1; rowIdx >= 0; rowIdx -= 1) {
        const cols = activeCols();
        for (let colIdx = cols.length - 1; colIdx >= 0; colIdx -= 1) {
          const el = cellRefs.current[rows[rowIdx]?._key]?.[cols[colIdx]];
          if (el && !el.disabled && el.tabIndex !== -1) {
            el.focus();
            if (el.select) el.select();
            return;
          }
        }
      }
      custRef.current?.focus();
    }, 30);
  }, [activeCols, rows.length]);

  const focusLastRowClose = useCallback(() => {
    setTimeout(() => {
      for (let rowIdx = rows.length - 1; rowIdx >= 0; rowIdx -= 1) {
        if (isBlankRow(rows[rowIdx])) continue;
        const el = rowCloseRefs.current[rowIdx];
        if (el && !el.disabled) {
          el.focus();
          return;
        }
      }
      focusLastGridField();
    }, 30);
  }, [rows, focusLastGridField]);

  const focusFirstBlankProduct = useCallback(() => {
    setTimeout(() => {
      setRows(curr => {
        const blankIdx = curr.findIndex(isBlankRow);
        if (blankIdx >= 0) focusCell(blankIdx, COL_PRODUCT);
        return curr;
      });
    }, 30);
  }, [focusCell]);

  const makeReadyBlankRow = useCallback(() => {
    const blank = EMPTY_LINE();
    blank._inactive = isEdit;
    if (isFixed && priceConfig?.FixedPriceCodeID) blank.PriceCodeID = priceConfig.FixedPriceCodeID;
    return blank;
  }, [isEdit, isFixed, priceConfig]);

  const activateBlankRow = useCallback((rowIdx) => {
    setRows(prev => prev.map((row, idx) => (
      idx === rowIdx && row._inactive ? { ...row, _inactive: false } : row
    )));
    setTimeout(() => focusCell(rowIdx, COL_PRODUCT), 40);
  }, [focusCell]);

  const keepSingleReadyBlankRow = useCallback((list) => {
    const activeRows = list.filter(row => !isBlankRow(row));
    if (activeRows.length === 0) return [makeReadyBlankRow()];
    const last = activeRows[activeRows.length - 1];
    return isRowComplete(last) ? [...activeRows, makeReadyBlankRow()] : activeRows;
  }, [makeReadyBlankRow]);

  const focusLastCompletedAmount = useCallback(() => {
    setTimeout(() => {
      for (let rowIdx = rows.length - 1; rowIdx >= 0; rowIdx -= 1) {
        if (!isRowComplete(rows[rowIdx])) continue;
        const el = cellRefs.current[rows[rowIdx]?._key]?.[COL_AMOUNT];
        if (el && !el.disabled) {
          el.focus();
          return;
        }
      }
      focusLastGridField();
    }, 30);
  }, [focusLastGridField, rows]);

  const ensureBlankRowAndFocusProduct = useCallback(() => {
    setRows(prev => {
      if (prev.some(isBlankRow)) return prev;
      return [...prev, makeReadyBlankRow()];
    });
    setTimeout(() => focusFirstBlankProduct(), 60);
  }, [focusFirstBlankProduct, makeReadyBlankRow]);

  const completeRowAndFocusNextProduct = useCallback((rowIdx, currentPatch = null) => {
    const sourceRows = currentPatch
      ? rows.map((r, i) => (i === rowIdx ? { ...r, ...currentPatch } : r))
      : rows;
    const current = sourceRows[rowIdx];
    if (!isRowComplete(current)) {
      focusCell(rowIdx, COL_RATE);
      return;
    }
    setRows(prev => keepSingleReadyBlankRow(
      currentPatch ? prev.map((r, i) => (i === rowIdx ? { ...r, ...currentPatch } : r)) : prev
    ));
    setTimeout(() => focusFirstBlankProduct(), 60);
  }, [focusCell, focusFirstBlankProduct, keepSingleReadyBlankRow, rows]);

  const completeRowCreateNextAndFocusProduct = useCallback((rowIdx, currentPatch = null) => {
    const sourceRows = currentPatch
      ? rows.map((r, i) => (i === rowIdx ? { ...r, ...currentPatch } : r))
      : rows;
    const current = sourceRows[rowIdx];
    if (!isRowComplete(current)) {
      focusCell(rowIdx, COL_RATE);
      return;
    }
    setRows(prev => keepSingleReadyBlankRow(
      currentPatch ? prev.map((r, i) => (i === rowIdx ? { ...r, ...currentPatch } : r)) : prev
    ));
    setTimeout(() => focusFirstBlankProduct(), 60);
  }, [focusCell, focusFirstBlankProduct, keepSingleReadyBlankRow, rows]);

  /* ── navigate to next/prev cell ── */
  const navigateCell = useCallback((rowIdx, col, dir, currentPatch = null) => {
    const sourceRows = currentPatch
      ? rows.map((r, i) => (i === rowIdx ? { ...r, ...currentPatch } : r))
      : rows;
    const cols = activeCols();
    const colIdx = cols.indexOf(col);
    if (colIdx === -1) return;

    if (dir > 0 && col === COL_PRODUCT && !sourceRows[rowIdx]?.ProductID) {
      setRowErrors(prev => ({ ...prev, [rowIdx]: 'Select particulars.' }));
      focusCell(rowIdx, COL_PRODUCT);
      return;
    }

    if (dir > 0 && col === COL_QTY) {
      const current = sourceRows[rowIdx];
      const qty = Number.parseFloat(current?.Qty);
      if (!Number.isFinite(qty) || qty <= 0) {
        setRowErrors(prev => ({ ...prev, [rowIdx]: 'Enter a valid quantity greater than zero.' }));
        focusCell(rowIdx, COL_QTY);
        return;
      }
      if (isFixed) {
        if (!isRowComplete(current)) {
          setRowErrors(prev => ({ ...prev, [rowIdx]: 'A valid fixed price is required.' }));
          focusCell(rowIdx, COL_QTY);
          return;
        }
      }
    }

    if (dir > 0 && col === COL_PRICE_CODE) {
      const current = sourceRows[rowIdx];
      if (current?.PriceCodeID && getEffectiveRate(current) <= 0) {
        setRowErrors(prev => ({ ...prev, [rowIdx]: 'Select a valid price code.' }));
        focusCell(rowIdx, COL_PRICE_CODE);
        return;
      }
    }

    if (dir > 0 && col === COL_RATE) {
      completeRowCreateNextAndFocusProduct(rowIdx, currentPatch);
      return;
    }

    let nextCol = colIdx + dir;
    let nextRow = rowIdx;
    if (nextCol >= cols.length) { nextCol = 0; nextRow = rowIdx + 1; }
    else if (nextCol < 0) { nextCol = cols.length - 1; nextRow = rowIdx - 1; }
    if (nextRow >= sourceRows.length) {
      const current = sourceRows[rowIdx];
      if (isBlankRow(current)) {
        focusCell(rowIdx, COL_PRODUCT);
        return;
      }
      if (!isRowComplete(current)) {
        focusCell(rowIdx, col);
        return;
      }
      setRows(prev => keepSingleReadyBlankRow(
        currentPatch ? prev.map((r, i) => (i === rowIdx ? { ...r, ...currentPatch } : r)) : prev
      ));
      setTimeout(() => focusFirstBlankProduct(), 60);
      return;
    }
    if (nextRow < 0) { custRef.current?.focus(); return; }
    focusCell(nextRow, cols[nextCol]);
  }, [activeCols, rows, focusCell, focusFirstBlankProduct, keepSingleReadyBlankRow, isFixed, completeRowCreateNextAndFocusProduct]);

  /* ── register cell ref ── */
  const setCellRef = useCallback((rowKey, col, el) => {
    if (!cellRefs.current[rowKey]) cellRefs.current[rowKey] = {};
    if (el) cellRefs.current[rowKey][col] = el;
    else delete cellRefs.current[rowKey][col];
  }, []);

  /* ── Load master data ── */
  const loadCustomers = useCallback(async (search = '') => {
    const seq = ++customersReqRef.current;
    setCustomersLoading(true);
    setCustomersError('');
    try {
      const data = await billingService.getCustomersDropdown(search);
      if (seq !== customersReqRef.current) return;
      setCustomers(prev => {
        const rows = Array.isArray(data) ? data : [];
        if (!rows.length && prev.length && search) return prev;
        return rows;
      });
    } catch (err) {
      if (seq !== customersReqRef.current) return;
      setCustomersError(err.response?.data?.detail || 'Unable to load customers. Retry.');
    } finally {
      if (seq === customersReqRef.current) setCustomersLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async (search = '', options = {}) => {
    const term = (search || '').trim();
    const isMore = Boolean(options.cursor);
    const searchChanged = lastProductSearchRef.current !== term;
    if (!isMore && !options.force && !searchChanged && productsCountRef.current > 0) return;
    if (isMore && loadingMoreProductsRef.current) return;
    lastProductSearchRef.current = term;
    const seq = ++productsReqRef.current;
    if (isMore) {
      loadingMoreProductsRef.current = true;
      setProductsLoadingMore(true);
    } else {
      loadingMoreProductsRef.current = false;
      setProductsLoadingMore(false);
      setProductsLoading(true);
      setProductsCursor(null);
      setProductsHasMore(false);
    }
    setProductsError('');
    try {
      const data = await billingService.getProductsForBilling(term, options);
      if (seq !== productsReqRef.current) return;
      failedProductPageRef.current = null;
      setProducts(prev => {
        const rows = Array.isArray(data) ? data : (data?.results ?? []);
        if (isMore) {
          const seen = new Set(prev.map(p => p.id));
          return [...prev, ...rows.filter(row => row?.id && !seen.has(row.id))];
        }
        const selectedRows = prev.filter(p => rows.every(row => row.id !== p.id) && rows.some(Boolean));
        return [...selectedRows, ...rows];
      });
      setProductsCursor(data?.next_cursor ?? null);
      setProductsHasMore(Boolean(data?.has_more));
      setProductsError('');
    } catch (err) {
      if (seq !== productsReqRef.current) return;
      if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return;
      failedProductPageRef.current = { term, cursor: options.cursor || null };
      lastProductSearchRef.current = null;
      const status = err.response?.status;
      const message = status === 401
        ? 'Session expired. Please login again.'
        : status === 403
          ? 'You do not have permission to load products.'
          : err.code === 'ECONNABORTED'
            ? 'Product loading timed out. Retry.'
            : err.response?.data?.detail || 'Unable to load products. Retry.';
      setProductsError(message);
    } finally {
      if (isMore) {
        loadingMoreProductsRef.current = false;
        setProductsLoadingMore(false);
      } else if (seq === productsReqRef.current) {
        setProductsLoading(false);
      }
    }
  }, []);

  const loadMoreProducts = useCallback((search = '') => {
    if (!productsHasMore || !productsCursor || productsLoading || productsLoadingMore) return;
    loadProducts(search, { cursor: productsCursor });
  }, [loadProducts, productsCursor, productsHasMore, productsLoading, productsLoadingMore]);

  const retryProducts = useCallback((search = '') => {
    const term = (search || '').trim();
    const failed = failedProductPageRef.current;
    if (failed && failed.term === term && failed.cursor) {
      loadProducts(term, { cursor: failed.cursor, force: true });
      return;
    }
    loadProducts(term, { force: true });
  }, [loadProducts]);

  useEffect(() => {
    const load = async () => {
      try {
        const [pc] = await Promise.all([
          billingService.getPriceCodes(),
          loadCustomers(),
        ]);
        setPriceCodes(Array.isArray(pc) ? pc : []);
      } catch (err) {
        setApiError(err.response?.data?.detail || 'Failed to load form data. Please retry.');
      }
    };
    load();
  }, [loadCustomers, loadProducts]);

  /* Restore a sales draft after returning from quick customer/product creation */
  useEffect(() => {
    if (restoredDraftRef.current) return;
    const draft = location.state?.restoreSalesDraft;
    const selectedCustomer = location.state?.selectedCustomer;
    if (!draft && !selectedCustomer) return;

    restoredDraftRef.current = true;
    if (draft?.rows?.length) setRows(draft.rows);
    if (draft?.priceConfig) setPriceConfig(draft.priceConfig);
    if (draft?.savedBillNo) setSavedBillNo(draft.savedBillNo);
    if (selectedCustomer) {
      const newCust = {
        ...selectedCustomer,
        PriceConfig: selectedCustomer.PriceConfig || { PriceCodeType: 'Random', PriceConfigurationMissing: false },
      };
      setCustomers(prev => {
        const exists = prev.some(c => c.id === newCust.id);
        const next = exists ? prev.map(c => (c.id === newCust.id ? { ...c, ...newCust } : c)) : [...prev, newCust];
        return next.sort((a, b) => (a.CustomerName || '').localeCompare(b.CustomerName || ''));
      });
      setCustomerID(newCust.id);
      if (newCust.PriceConfig && !newCust.PriceConfig.PriceConfigurationMissing) setPriceConfig(newCust.PriceConfig);
    } else if (draft?.customerID) {
      setCustomerID(draft.customerID);
    }

    if (location.state?.productCreated) {
      loadProducts('', { force: true });
    }
    navigate(location.pathname, { replace: true });
  }, [loadProducts, location.pathname, location.state, navigate]);

  /* ── Load existing bill for edit mode ── */
  useEffect(() => {
    if (!isEdit) { setLoading(false); return; }
    if (restoredDraftRef.current) { setLoading(false); return; }
    if (editBillLoadedRef.current) return;
    editBillLoadedRef.current = true;
    const loadBill = async () => {
      try {
        const bill = await billingService.getBilling(id);
        setEditBillNo(bill.BillNo || `#${bill.id}`);
        setCustomers(prev => {
          if (!bill.CustomerID || prev.some(c => c.id === bill.CustomerID)) return prev;
          return [...prev, {
            id: bill.CustomerID,
            CustomerCode: bill.CustomerCode || '',
            CustomerName: bill.CustomerName || '',
            PriceConfig: {
              PriceCodeType: bill.PriceCodeType || 'Random',
              FixedPriceCodeID: bill.DefaultPriceCodeID || null,
              FixedLabel: bill.DefaultPriceCodeLabel || null,
              PriceConfigurationMissing: false,
            },
          }];
        });
        setCustomerID(bill.CustomerID);
        const savedProductOptions = (bill.line_items || [])
          .filter(line => line.ProductID)
          .map(productOptionFromBillLine);
        setProducts(prev => {
          const byId = new Map(prev.map(p => [p.id, p]));
          savedProductOptions.forEach(p => {
            byId.set(p.id, { ...(byId.get(p.id) || {}), ...p });
          });
          return [...byId.values()];
        });
        const billRows = (bill.line_items || []).map(line => ({
          _key: Math.random().toString(36).slice(2),
          ProductID: line.ProductID,
          productData: line.ProductID ? productOptionFromBillLine(line) : null,
          PriceCodeID: line.PriceCodeID,
          rate: String(line.Price),
          changeableRate: line.ChangeableRate != null ? String(line.ChangeableRate) : '',
          isRateEditable: false,
          Qty: String(line.Qty),
          IsDiscountApplied: line.IsDiscountApplied || false,
          DiscountPercent: line.DiscountPercent ? String(line.DiscountPercent) : '',
          IsGSTApplied: line.IsGSTApplied || false,
          GSTPercent: line.GSTPercent ? String(line.GSTPercent) : '',
        }));
        const placeholder = EMPTY_LINE();
        placeholder._inactive = true;
        if ((bill.PriceCodeType || 'Random') === 'Fixed' && bill.DefaultPriceCodeID) {
          placeholder.PriceCodeID = bill.DefaultPriceCodeID;
        }
        setRows(isViewMode ? billRows : (billRows.length > 0 ? [...billRows, placeholder] : [placeholder]));
        const cust = customers.find(c => c.id === bill.CustomerID);
        if (cust?.PriceConfig && !cust.PriceConfig.PriceConfigurationMissing) setPriceConfig(cust.PriceConfig);
        else setPriceConfig({
          PriceCodeType: bill.PriceCodeType || 'Random',
          FixedPriceCodeID: bill.DefaultPriceCodeID || null,
          FixedLabel: bill.DefaultPriceCodeLabel || null,
          PriceConfigurationMissing: false,
        });
      } catch {
        setApiError('Failed to load bill. Please go back and try again.');
      } finally { setLoading(false); }
    };
    loadBill();
  }, [id, isEdit, isViewMode]); // eslint-disable-line

  /* ── Fill productData after products load (edit mode) ── */
  useEffect(() => {
    if (!isEdit || products.length === 0) return;
    setRows(prev => prev.map(r => {
      if (!r.ProductID) return r;
      const prod = products.find(p => p.id === r.ProductID) || null;
      const rate = (!r.rate && prod && r.PriceCodeID) ? getRateForCode(prod, r.PriceCodeID) : r.rate;
      return { ...r, productData: prod, rate };
    }));
    setLoading(false);
  }, [products, isEdit]); // eslint-disable-line

  /* ── Auto-expand: add new empty row when last row is complete ── */
  useEffect(() => {
    if (isReadOnly) return;
    const last = rows[rows.length - 1];
    if (!last || !isRowComplete(last)) return;
    // Short debounce avoids duplicate additions while rate/price state settles.
    clearTimeout(addRowTimer.current);
    addRowTimer.current = setTimeout(() => {
      setRows(prev => keepSingleReadyBlankRow(prev));
    }, 120);
    return () => clearTimeout(addRowTimer.current);
  }, [rows.map(r => `${r.ProductID}|${r.Qty}|${r.PriceCodeID}|${r.rate}|${r.changeableRate}`).join(','), keepSingleReadyBlankRow, isReadOnly]); // eslint-disable-line

  /* ── Keep cellRefs array sized ── */
  useEffect(() => {
    const activeRowKeys = new Set(rows.map(row => row._key));
    Object.keys(cellRefs.current).forEach(rowKey => {
      if (!activeRowKeys.has(rowKey)) delete cellRefs.current[rowKey];
    });
    rowCloseRefs.current = rowCloseRefs.current.slice(0, rows.length);
  }, [rows]);

  useEffect(() => {
    if (isReadOnly) return;
    if (loading || initialCustomerFocusRef.current) return;
    initialCustomerFocusRef.current = true;
    setTimeout(() => {
      custRef.current?.focus();
      if (custRef.current?.select) custRef.current.select();
    }, 60);
  }, [loading, isReadOnly]);

  /* ── Customer selection ── */
  const handleCustomerChange = useCallback((cid) => {
    setCustomerID(cid);
    setApiError('');
    setRowErrors({});
    if (!cid) { setPriceConfig(null); return; }
    const c = customers.find(x => x.id === cid);
    const cfg = c?.PriceConfig;
    if (!cfg || cfg.PriceConfigurationMissing) { setPriceConfig(null); return; }
    setPriceConfig(cfg);
    if (cfg.PriceCodeType === 'Fixed' && cfg.FixedPriceCodeID) {
      setRows(prev => prev.map(r => ({
        ...r,
        PriceCodeID: cfg.FixedPriceCodeID,
        rate: r.productData ? getRateForCode(r.productData, cfg.FixedPriceCodeID) : '',
        changeableRate: '',
        isRateEditable: false,
      })));
    } else {
      setRows(prev => prev.map(r => ({ ...r, PriceCodeID: null, rate: '', changeableRate: '', isRateEditable: false })));
    }
    requestAnimationFrame(() => focusCell(0, COL_PRODUCT));
  }, [customers, focusCell]);

  const buildSalesDraft = useCallback(() => ({
    customerID,
    priceConfig,
    rows,
    savedBillNo,
  }), [customerID, priceConfig, rows, savedBillNo]);

  const goToAddCustomer = useCallback(() => {
    navigate('/customers/new', {
      state: {
        returnToSales: true,
        salesDraft: buildSalesDraft(),
      },
    });
  }, [buildSalesDraft, navigate]);

  const goToAddProduct = useCallback((event) => {
    event?.preventDefault();
    event?.stopPropagation();
    navigate('/products/new', {
      state: {
        returnToSales: true,
        salesDraft: buildSalesDraft(),
        returnPath: location.pathname,
      },
    });
  }, [buildSalesDraft, location.pathname, navigate]);

  /* ── Row mutations ── */
  const updateRow = useCallback((idx, patch) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
    // Clear row-level error when user makes changes
    setRowErrors(prev => { const n = { ...prev }; delete n[idx]; return n; });
  }, []);

  useEffect(() => {
    const form = pageRef.current;
    if (!form) return undefined;
    const unlockRate = event => {
      const target = event.target;
      if (target?.dataset?.salesRate !== 'true') return;
      const rowIdx = Number.parseInt(target.dataset.rowIndex, 10);
      if (!Number.isInteger(rowIdx)) return;
      updateRow(rowIdx, {
        rate: '',
        changeableRate: '',
        isRateEditable: true,
      });
      setTimeout(() => target.focus(), 0);
    };
    form.addEventListener('pos-escape-clear-field', unlockRate);
    return () => form.removeEventListener('pos-escape-clear-field', unlockRate);
  }, [updateRow, loading]);

  const focusNextEmptyProduct = useCallback(() => {
    setTimeout(() => {
      setRows(curr => {
        const blankIdx = curr.findIndex(isBlankRow);
        if (blankIdx >= 0) focusCell(blankIdx, COL_PRODUCT);
        return curr;
      });
    }, 60);
  }, [focusCell]);

  const mergeDuplicateProductQuantity = useCallback((idx, qtyValue = null) => {
    const current = rows[idx];
    if (!current?.ProductID) return false;

    const firstIdx = rows.findIndex(r => r.ProductID === current.ProductID);
    if (firstIdx < 0 || firstIdx === idx) return false;

    const addQty = parseFloat(qtyValue ?? current.Qty);
    if (isNaN(addQty) || addQty <= 0) return false;

    setRows(prev => {
      const liveCurrent = prev[idx];
      if (!liveCurrent?.ProductID) return prev;
      const liveFirstIdx = prev.findIndex(r => r.ProductID === liveCurrent.ProductID);
      if (liveFirstIdx < 0 || liveFirstIdx === idx) return prev;

      const existingQty = parseFloat(prev[liveFirstIdx].Qty) || 0;
      let next = prev.map((r, i) => (
        i === liveFirstIdx ? { ...r, Qty: String(existingQty + addQty) } : r
      ));
      next = next.filter((_, i) => i !== idx);
      if (!next.some(isBlankRow)) {
        const blank = EMPTY_LINE();
        if (isFixed && priceConfig?.FixedPriceCodeID) blank.PriceCodeID = priceConfig.FixedPriceCodeID;
        next = [...next, blank];
      }
      return next;
    });
    setRowErrors({});
    toast.success('Product merged', 'Quantity added to existing product');
    focusNextEmptyProduct();
    return true;
  }, [rows, focusNextEmptyProduct, isFixed, priceConfig, toast]);

  const handleProductChange = useCallback((idx, pid) => {
    const prod = products.find(p => p.id === pid) || null;
    const fixedPcID = (isFixed && priceConfig?.FixedPriceCodeID) ? priceConfig.FixedPriceCodeID : null;
    const pcID = prod ? (fixedPcID || rows[idx].PriceCodeID || null) : null;
    const rate = prod && pcID ? getRateForCode(prod, pcID) : '';
    const gstPct = prod?.GSTPercent > 0 ? String(prod.GSTPercent) : '';
    updateRow(idx, { ProductID: prod?.id || null, productData: prod, PriceCodeID: pcID, rate, changeableRate: '', isRateEditable: false, GSTPercent: gstPct });
    setTimeout(() => focusCell(idx, prod ? COL_QTY : COL_PRODUCT), 60);
  }, [products, isFixed, priceConfig, rows, updateRow, focusCell]);

  const handlePriceCodeChange = useCallback((idx, pcid) => {
    const row = rows[idx];
    if (!pcid) {
      updateRow(idx, {
        PriceCodeID: null,
        rate: '',
        changeableRate: '',
        isRateEditable: true,
      });
      return;
    }
    const rate = getRateForCode(row.productData, pcid);
    updateRow(idx, { PriceCodeID: pcid, rate, changeableRate: '', isRateEditable: false });
  }, [rows, updateRow]);

  const toggleRateEdit = useCallback((idx) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      if (!r.isRateEditable) {
        // Enter edit mode — pre-fill with current effective rate
        return { ...r, isRateEditable: true, changeableRate: r.changeableRate || r.rate };
      }
      // Exit edit mode — validate
      const typed = parseFloat(r.changeableRate);
      const hasValid = r.changeableRate && !isNaN(typed) && typed > 0;
      return { ...r, isRateEditable: false, changeableRate: hasValid ? r.changeableRate : '' };
    }));
  }, []);

  const removeRow = useCallback((idx) => {
    setRows(prev => {
      const next = prev.filter((_, i) => i !== idx);
      return keepSingleReadyBlankRow(next);
    });
    setRowErrors(prev => {
      const n = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = parseInt(k);
        if (ki < idx) n[ki] = v;
        else if (ki > idx) n[ki - 1] = v;
      });
      return n;
    });
  }, [keepSingleReadyBlankRow]);

  /* ── Totals (completed rows only) ── */
  const calcTotals = useCallback(() => {
    const completedRows = rows.filter(r => isRowComplete(r));
    let grandTotal = 0;
    for (const r of completedRows) {
      const qty  = parseFloat(r.Qty) || 0;
      const rate = getEffectiveRate(r);
      grandTotal += qty * rate;
    }
    return { grandTotal, rowCount: completedRows.length };
  }, [rows]);

  const totals = calcTotals();
  const billingPageCount = Math.max(1, Math.ceil(rows.length / billingRowsPerPage));
  const billingPageStart = (billingPage - 1) * billingRowsPerPage;
  const visibleBillingRows = rows
    .slice(billingPageStart, billingPageStart + billingRowsPerPage)
    .map((row, offset) => ({ row, idx: billingPageStart + offset }));

  useEffect(() => {
    if (billingPage > billingPageCount) setBillingPage(billingPageCount);
  }, [billingPage, billingPageCount]);

  useEffect(() => {
    setBillingPage(current => Math.min(current, Math.max(1, Math.ceil(rows.length / billingRowsPerPage))));
  }, [billingRowsPerPage, rows.length]);

  /* ── Stock check helper ── */
  const checkStock = useCallback((row, idx) => {
    const prod = row.productData;
    if (!prod) return null;
    const qty = parseFloat(row.Qty) || 0;
    if (prod.Quantity != null && qty > prod.Quantity) {
      return `Row ${idx + 1}: Quantity (${qty}) exceeds available stock (${prod.Quantity}).`;
    }
    return null;
  }, []);

  /* ── Validate and collect payload for save ── */
  const buildPayload = useCallback(() => {
    const errors = {};
    if (!customerID) return { errors: { _: 'Please select a customer.' }, payload: null };

    const cust = customers.find(c => c.id === customerID);
    if (cust?.PriceConfig?.PriceConfigurationMissing) {
      return { errors: { _: 'This customer has no price configuration. Please set it up first.' }, payload: null };
    }

    const completedRows = rows.filter(r => isRowComplete(r));
    if (completedRows.length === 0) {
      return { errors: { _: 'Add at least one product with a valid quantity.' }, payload: null };
    }

    rows.forEach((row, idx) => {
      if (!isBlankRow(row) && !isRowComplete(row)) {
        errors[idx] = 'Complete Product, Qty, Price Code and Rate, or clear this row.';
      }
    });

    completedRows.forEach((r, i) => {
      const origIdx = rows.indexOf(r);
      const manualRate = parseFloat(r.changeableRate);
      const hasManualRate = Number.isFinite(manualRate) && manualRate > 0;
      if (!r.PriceCodeID && !hasManualRate) {
        errors[origIdx] = 'Select a price code or enter a rate.';
      } else {
        const stockErr = checkStock(r, origIdx);
        if (stockErr) errors[origIdx] = stockErr;
        const er = parseFloat(r.changeableRate);
        const hasChangeable = !isNaN(er) && er > 0;
        if (!r.rate && !hasChangeable) {
          errors[origIdx] = 'Rate is missing. Select a price code.';
        }
      }
    });

    if (Object.keys(errors).length > 0) return { errors, payload: null };

    const payload = {
      CustomerID: customerID,
      lines: completedRows.map(r => {
        const cr = parseFloat(r.changeableRate);
        const hasChangeable = !isNaN(cr) && cr > 0;
        return {
          ProductID:         r.ProductID,
          PriceCodeID:       r.PriceCodeID || null,
          Qty:               r.Qty,
          IsDiscountApplied: r.IsDiscountApplied,
          DiscountPercent:   r.IsDiscountApplied ? (r.DiscountPercent || '0') : '0',
          IsGSTApplied:      r.IsGSTApplied,
          GSTPercent:        r.IsGSTApplied ? (r.GSTPercent || '0') : '0',
          ChangeableRate:    hasChangeable ? String(cr) : null,
        };
      }),
    };
    return { errors: {}, payload };
  }, [customerID, customers, rows, checkStock]);

  /* ── Save bill ── */
  const handleSave = useCallback(async () => {
    if (isReadOnly) return;
    if (saving || saveInFlightRef.current) return;
    setApiError('');
    setRowErrors({});
    const { errors, payload } = buildPayload();
    if (errors._) { setApiError(errors._); return; }
    if (Object.keys(errors).length > 0) {
      setRowErrors(errors);
      const firstErrIdx = Math.min(...Object.keys(errors).map(Number));
      setApiError(`Please fix the highlighted rows.`);
      focusCell(firstErrIdx, COL_PRODUCT);
      return;
    }

    saveInFlightRef.current = true;
    setSaving(true);
    try {
      let savedBill;
      if (isEdit) {
        savedBill = await billingService.updateBill(id, payload);
        clearPageCache('billings');
        toast.push({ type:'success', title:'Bill Updated', message:'Sales bill saved successfully.', hideProgress:true });
        navigate('/billing');
      } else {
        savedBill = await billingService.createBill(payload);
        clearPageCache('billings');
        setSavedBillNo(savedBill.BillNo || `#${savedBill.id}`);
        toast.push({ type:'success', title:'Bill Saved', message:'Sales bill saved successfully.', hideProgress:true });
        navigate('/billing', { state: { newBill: savedBill } });
      }
    } catch (e) {
      const d = e.response?.data;
      if (typeof d === 'string') setApiError(d);
      else if (d?.detail) setApiError(d.detail);
      else if (d?.lines) {
        const msgs = Object.entries(d.lines).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
        setApiError(msgs.join(' | '));
      } else if (d && typeof d === 'object') {
        const first = Object.values(d)[0];
        setApiError(Array.isArray(first) ? first[0] : String(first));
      } else {
        setApiError('Failed to save sale. Please try again.');
      }
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }

  }, [buildPayload, isEdit, id, navigate, toast, focusCell, saving, isReadOnly]);

  useEffect(() => {
    const handler = e => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || String(e.key).toLowerCase() !== 's') return;
      if (isReadOnly) return;
      const target = e.target;
      const insideBillingForm = pageRef.current?.contains(target)
        || target?.closest?.('[data-sales-dropdown-open="true"]')
        || target?.closest?.('[data-sales-dropdown="true"]');
      if (!insideBillingForm) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat || saving || saveInFlightRef.current || shortcutSavePendingRef.current) return;

      shortcutSavePendingRef.current = true;
      const active = document.activeElement;
      if (active && pageRef.current?.contains(active) && typeof active.blur === 'function') {
        active.blur();
      }

      setTimeout(() => {
        shortcutSavePendingRef.current = false;
        if (!saveInFlightRef.current) handleSave();
      }, 0);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, saving, isReadOnly]);

  const canSave = !saving && customerID && totals.rowCount > 0;

  const handleFormKeyDown = useCallback((e) => {
    if (isReadOnly) return;
    const target = e.target;
    const isBillingControl = target?.closest?.('[data-billing-field="true"]');
    const isCancel = cancelBtnRef.current && (cancelBtnRef.current === target || cancelBtnRef.current.contains?.(target));
    const isSave = saveBtnRef.current && (saveBtnRef.current === target || saveBtnRef.current.contains?.(target));
    const isDropdownOpen = () => Boolean(document.querySelector('[data-sales-dropdown-open="true"]'));

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') return;
    if (e.key === 'Tab') return;
    if (e.key !== 'Enter' && e.key !== 'Backspace') return;
    if (e.defaultPrevented || isDropdownOpen() || target?.closest?.('[role="listbox"], [role="option"]')) return;
    lastEnterRef.current = { time: Date.now(), target };

    if (isSave || isCancel) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (e.key === 'Enter' && isBillingControl && e.repeat) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx += 1) {
      const rowRef = cellRefs.current[rows[rowIdx]?._key] || {};
      const col = activeCols().find(colKey => {
        const el = rowRef[colKey];
        return el && (el === target || el.contains?.(target));
      });
      if (col) {
        if (e.key === 'Backspace') {
          const row = rows[rowIdx];
          const isEmpty =
            (col === COL_PRODUCT && !row?.ProductID) ||
            (col === COL_QTY && (row?.Qty === '' || row?.Qty == null)) ||
            (col === COL_PRICE_CODE && !row?.PriceCodeID) ||
            (col === COL_RATE &&
              (row?.changeableRate === '' || row?.changeableRate == null) &&
              (row?.rate === '' || row?.rate == null));
          if (!isEmpty) return;
          e.preventDefault();
          e.stopPropagation();
          navigateCell(rowIdx, col, -1);
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        navigateCell(rowIdx, col, 1);
        return;
      }
    }

    if (e.key === 'Enter' && isBillingControl) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [activeCols, navigateCell, isReadOnly, rows]);

  /* ── Delete bill (edit mode only) ── */
  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await billingService.deleteBilling(id);
      toast.success('Deleted', 'Sales record deleted.');
      navigate('/billing');
    } catch (e) {
      setApiError(e.response?.data?.detail || 'Failed to delete.');
      setShowDel(false);
    } finally { setDeleting(false); }
  }, [id, navigate, toast]);

  /* ── Loading state ── */
  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  return (
    <Layout>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes rowIn { from { opacity:0; transform:translateY(-3px); } to { opacity:1; transform:translateY(0); } }
        .bf-row { animation: rowIn .12s ease-out; transition: background .1s; }
        .bf-row:hover td { background: rgba(138,81,37,.04) !important; }
        .bf-input {
          width:100%; height:26px; padding:.18rem .4rem; font-size:.8rem;
          border:none; border-bottom:1.5px solid var(--border-input); border-radius:0;
          background:transparent; color:var(--text-primary); outline:none;
          transition:border-color .15s;
        }
        .bf-input:focus { border-bottom-color:${BRAND}; }
        .bf-input:disabled { color:var(--text-muted); cursor:not-allowed; border-bottom-color:var(--scale-200); }
        .bf-th {
          padding:.45rem .55rem; font-size:.67rem; font-weight:700; text-transform:uppercase;
          letter-spacing:.06em; color:#fff; text-align:left; white-space:nowrap;
          user-select:none; border-bottom:none;
        }
        .bf-td { padding:.25rem .55rem; vertical-align:middle; border-bottom:1px solid var(--divider); overflow:visible; }
        .bf-row-error td { background: rgba(211,47,47,.04) !important; }
        .rate-edit-btn {
          width:20px; height:20px; border-radius:4px; border:1px solid var(--border-input);
          background:transparent; cursor:pointer; color:var(--text-muted);
          display:inline-flex; align-items:center; justify-content:center;
          transition:border-color .15s, color .15s; flex-shrink:0; padding:0;
          margin-left:3px;
        }
        .rate-edit-btn:hover { border-color:${BRAND}; color:${BRAND}; }
        .rate-edit-btn.active { border-color:${BRAND}; color:${BRAND}; background:rgba(138,81,37,.10); }
        .remove-btn {
          width:22px; height:22px; border-radius:4px; border:1px solid transparent;
          background:transparent; cursor:pointer; color:var(--text-muted);
          display:inline-flex; align-items:center; justify-content:center;
          transition:all .15s; flex-shrink:0; padding:0;
        }
        .remove-btn:hover { border-color:#c62828; color:#c62828; background:rgba(211,47,47,.06); }
        .remove-btn:disabled { opacity:.35; cursor:not-allowed; pointer-events:none; }
      `}</style>

            <form ref={pageRef} className={`billing-form-page${isFixed ? ' is-fixed-pricing' : ''}`}
              onKeyDown={handleFormKeyDown}
              onSubmit={e => e.preventDefault()}
              style={{padding:'0'}}>

        <div className="sales-compact-topbar">
          <h1 className="sales-compact-title">
            {isViewMode ? `View Invoice ${editBillNo}` : isEdit ? `Edit Invoice ${editBillNo}` : 'Sales'}
          </h1>

          <div className="sales-compact-customer">
            <span className="sales-compact-label">
              Customer Name <span style={{color:'var(--danger)'}}>*</span>
            </span>
            <CustomerSearchDropdown
              customers={customers}
              value={customerID}
              onChange={handleCustomerChange}
              onNavigateToAdd={goToAddCustomer}
              disabled={saving || isReadOnly}
              inputRef={custRef}
              onNext={() => focusCell(0, activeCols()[0])}
              onPrev={focusLastGridField}
              onSearch={loadCustomers}
              loading={customersLoading}
              error={customersError}
            />
          </div>

          <div className="sales-compact-price">
            <span className="sales-compact-label">Price Code Type:</span>
            {priceConfig && !priceConfig.PriceConfigurationMissing ? (
              <span className="sales-compact-price-pill" style={{
                background: isFixed ? '#dbeafe' : '#ede9fe',
                color: isFixed ? '#1d4ed8' : '#6d28d9',
                border: `1px solid ${isFixed ? '#93c5fd' : '#a78bfa'}`}}>
                {isFixed ? 'Fixed' : 'Random'}
              </span>
            ) : customerID && selCust?.PriceConfig?.PriceConfigurationMissing ? (
              <span style={{fontSize:'.72rem',color:'var(--danger)',fontWeight:600}}>No price config</span>
            ) : (
              <span style={{fontSize:'.78rem',color:'var(--text-muted)'}}>--</span>
            )}
            {isFixed && priceConfig && !priceConfig.PriceConfigurationMissing &&
              (priceConfig.FixedLabel || priceConfig.FixedPriceCodeName) && (
              <span className="sales-compact-price-pill" style={{background:'#dcfce7',color:'#15803d',border:'1px solid #86efac'}}>
                {priceConfig.FixedLabel || priceConfig.FixedPriceCodeName}
              </span>
            )}
          </div>

          {customerID && (() => {
            const pts = selCust?.Customer_Redeem_Points;
            if (pts == null) return null;
            return <span className="sales-compact-points">{parseFloat(pts).toFixed(0)} pts</span>;
          })()}

          {savedBillNo && !isEdit && (
            <span className="sales-compact-saved">Last saved: {savedBillNo}</span>
          )}
        </div>

        
        {apiError && (
          <div style={{background:'#fff5f5',border:'1.5px solid #e57373',borderRadius:8,
            padding:'.45rem .875rem',marginBottom:'.75rem',fontSize:'.79rem',
            color:'#c62828',fontWeight:600,display:'flex',alignItems:'center',gap:'.4rem'}}>
            ⚠ {apiError}
            <button onClick={() => setApiError('')}
              style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:'#c62828',fontSize:'.8rem',padding:0}}>✕</button>
          </div>
        )}

        {/* ── Sales table ── */}
        <div ref={billingGridRef} data-billing-grid="true" className="sales-entry-grid" style={{border:`1.5px solid var(--border)`,borderRadius:10,overflow:'visible',
          boxShadow:'0 1px 6px rgba(0,0,0,.07)'}}>

          {/* Table wrapper — overflow must stay visible so absolute dropdowns aren't clipped */}
          <div className="auto-fit-columns-toolbar"><AutoFitColumns tableRef={autoFitTableRef}/></div>
          <div className="sales-entry-table-wrap" style={{width:'100%'}}>
            <table ref={autoFitTableRef} className="sales-entry-table" style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed'}}>
              <colgroup>
                <col className="sales-entry-col-sno" />
                <col className="sales-entry-col-particulars" />
                <col className="sales-entry-col-qty" />
                <col className="sales-entry-col-price-code" />
                <col className="sales-entry-col-rate" />
                <col className="sales-entry-col-amount" />
                <col className="sales-entry-col-remove" />
              </colgroup>
              <thead>
                <tr style={{background:HEADER_BG}}>
                  <th className="bf-th" style={{textAlign:'center'}}>S.no</th>
                  <th className="bf-th billing-particulars-header">
                    <div className="billing-particulars-header-content">
                      <span>PARTICULARS</span>
                      {!isReadOnly && (
                        <button type="button"
                          className="billing-product-add-icon"
                          onClick={goToAddProduct}
                          aria-label="Add new product"
                          title="Add Product"
                          tabIndex={-1}>
                          <Plus size={14}/>
                        </button>
                      )}
                    </div>
                  </th>
                  <th className="bf-th" style={{textAlign:'right'}}>QTY</th>
                  <th className="bf-th">PRICE CODE</th>
                  <th className="bf-th">RATE</th>
                  <th className="bf-th" style={{textAlign:'right'}}>AMOUNT</th>
                  <th className="bf-th" style={{textAlign:'center'}}></th>
                </tr>
              </thead>
              <tbody>
                {visibleBillingRows.map(({ row, idx }, visibleIdx) => {
                  const effectiveRate = getEffectiveRate(row);
                  const qty           = parseFloat(row.Qty) || 0;
                  const lineAmt       = qty * effectiveRate;
                  const hasChangeable = row.changeableRate && parseFloat(row.changeableRate) > 0;
                  const rowErr        = rowErrors[idx];
                  const isCompleted   = isRowComplete(row);
                  const isFinalBlankRow = idx === rows.length - 1 && isBlankRow(row);

                  return (
                    <tr key={row._key} ref={visibleIdx === 0 ? billingRowRef : undefined} className={`bf-row${rowErr ? ' bf-row-error' : ''}${row._inactive ? ' bf-row-inactive' : ''}`}
                      tabIndex={row._inactive ? 0 : undefined}
                      aria-label={row._inactive ? 'Empty billing row. Press Enter or click to add an item.' : undefined}
                      onClick={() => { if (row._inactive) activateBlankRow(idx); }}
                      onFocus={e => { if (row._inactive && e.target === e.currentTarget) activateBlankRow(idx); }}
                      onKeyDown={e => {
                        if (row._inactive && e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                          activateBlankRow(idx);
                        }
                      }}
                      style={{background: idx % 2 === 0 ? 'transparent' : ALT_ROW}}>

                      {/* # */}
                      <td className="bf-td" style={{textAlign:'center',fontSize:'.72rem',
                        color:'var(--text-muted)',fontWeight:700}}>
                        {idx + 1}
                      </td>

                      {/* Particulars (product search) */}
                      <td className="bf-td" style={{overflow:'visible',position:'relative'}}>
                        <ProductSearchDropdown
                          products={products}
                          value={row.ProductID}
                          onChange={pid => handleProductChange(idx, pid)}
                          disabled={saving || isReadOnly || row._inactive}
                          inputRef={el => setCellRef(row._key, COL_PRODUCT, el)}
                          onNext={(selectedProductId) => {
                            navigateCell(idx, COL_PRODUCT, 1, selectedProductId ? { ProductID: selectedProductId } : null);
                          }}
                          onPrev={() => {
                            navigateCell(idx, COL_PRODUCT, -1);
                          }}
                          onSearch={loadProducts}
                          onLoadMore={loadMoreProducts}
                          onRetry={retryProducts}
                          loading={productsLoading}
                          loadingMore={productsLoadingMore}
                          hasMore={productsHasMore}
                          error={productsError}
                        />
                        {rowErr && (
                          <div style={{fontSize:'.68rem',color:'var(--danger)',fontWeight:500,marginTop:2,paddingLeft:'.45rem'}}>
                            {rowErr}
                          </div>
                        )}
                      </td>

                      {/* Qty */}
                      <td className="bf-td">
                        <input
                          className="bf-input"
                          type="number" min="0.01" step="0.01"
                          data-billing-field="true"
                          value={row.Qty}
                          disabled={saving || isReadOnly || !row.ProductID}
                          placeholder="0"
                          ref={el => setCellRef(row._key, COL_QTY, el)}
                          onChange={e => updateRow(idx, { Qty: e.target.value })}
                          onBlur={e => {
                            if (e.currentTarget.dataset.skipDuplicateMerge === 'true') {
                              delete e.currentTarget.dataset.skipDuplicateMerge;
                              return;
                            }
                            mergeDuplicateProductQuantity(idx, e.currentTarget.value);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              updateRow(idx, { Qty: e.currentTarget.value });
                              if (mergeDuplicateProductQuantity(idx, e.currentTarget.value)) {
                                e.currentTarget.dataset.skipDuplicateMerge = 'true';
                              } else {
                                navigateCell(idx, COL_QTY, 1, { Qty: e.currentTarget.value });
                              }
                            } else if (e.key === 'Backspace' && !e.currentTarget.value) {
                              e.preventDefault();
                              navigateCell(idx, COL_QTY, -1);
                            }
                          }}
                          style={{textAlign:'right'}}
                        />
                      </td>

                      {/* Price Code — editable dropdown for Random, locked badge for Fixed */}
                      <td className="bf-td" style={{overflow:'visible',position:'relative'}}>
                        {isFixed ? (
                          /* Fixed: show a compact locked badge */
                          <span style={{display:'inline-flex',alignItems:'center',gap:4,
                            fontSize:'.75rem',fontWeight:700,color:BRAND,
                            background:BRAND_LIGHT,border:`1px solid ${BRAND}`,
                            borderRadius:12,padding:'2px 8px',whiteSpace:'nowrap'}}>
                            🔒 {priceConfig?.FixedLabel || priceConfig?.FixedPriceCodeName || 'Fixed'}
                          </span>
                        ) : (
                          <PriceCodeDropdown
                            priceCodes={priceCodes}
                            value={row.PriceCodeID}
                            onChange={pcid => handlePriceCodeChange(idx, pcid)}
                            disabled={saving || isReadOnly || !row.ProductID}
                            productData={row.productData}
                            rowKey={row._key}
                            inputRef={el => setCellRef(row._key, COL_PRICE_CODE, el)}
                            onNext={(selectedPriceCodeId) => {
                              const pcid = selectedPriceCodeId === undefined
                                ? row.PriceCodeID
                                : selectedPriceCodeId;
                              navigateCell(idx, COL_PRICE_CODE, 1, pcid ? {
                                PriceCodeID: pcid,
                                rate: getRateForCode(row.productData, pcid),
                                changeableRate: '',
                                isRateEditable: false,
                              } : {
                                PriceCodeID: null,
                                rate: '',
                                changeableRate: '',
                                isRateEditable: true,
                              });
                            }}
                            onPrev={() => navigateCell(idx, COL_PRICE_CODE, -1)}
                          />
                        )}
                      </td>

                      {/* Rate — always directly editable input */}
                      <td className="bf-td">
                        <input
                          className="bf-input"
                          type="number" min="0" step="0.01"
                          tabIndex={-1}
                          value={row.changeableRate || row.rate}
                          disabled={saving || isReadOnly || !row.ProductID}
                          readOnly={!row.isRateEditable}
                          placeholder="0.00"
                          ref={el => setCellRef(row._key, COL_RATE, el)}
                          data-sales-rate="true"
                          data-billing-field="true"
                          data-row-index={idx}
                          onChange={e => updateRow(idx, { changeableRate: e.target.value, isRateEditable: true })}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                              if (e.repeat) return;
                              const ratePatch = row.isRateEditable
                                ? { changeableRate: e.currentTarget.value, isRateEditable: true }
                                : null;
                              if (ratePatch) updateRow(idx, ratePatch);
                              completeRowCreateNextAndFocusProduct(idx, ratePatch);
                            } else if (e.key === 'Backspace' && !e.currentTarget.value) {
                              e.preventDefault();
                              updateRow(idx, { changeableRate: e.currentTarget.value });
                              focusCell(idx, isFixed ? COL_QTY : COL_PRICE_CODE);
                            }
                          }}
                          style={{
                            textAlign:'right',
                            color: hasChangeable ? '#0277bd' : 'var(--text-primary)',
                            fontWeight: effectiveRate > 0 ? 600 : 400,
                          }}
                          title={hasChangeable && row.rate ? `Price code rate: ₹${parseFloat(row.rate).toFixed(2)}` : undefined}
                        />
                      </td>

                      {/* Amount */}
                      <td
                        className="bf-td"
                        ref={el => setCellRef(row._key, COL_AMOUNT, el)}
                        tabIndex={-1}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            completeRowCreateNextAndFocusProduct(idx);
                          } else if (e.key === 'Backspace') {
                            e.preventDefault();
                            focusCell(idx, isFixed ? COL_QTY : COL_PRICE_CODE);
                          }
                        }}
                        style={{textAlign:'right',outline:'none'}}>
                        <span style={{fontSize:'.85rem',fontWeight:700,
                          fontVariantNumeric:'tabular-nums',
                          color: lineAmt > 0 ? `var(--primary-dark,${BRAND})` : 'var(--text-muted)'}}>
                          {isCompleted ? fmtMoney(lineAmt) : '—'}
                        </span>
                      </td>

                      {/* Remove */}
                      <td className="bf-td" style={{textAlign:'center',paddingLeft:0,paddingRight:4}}>
                        {!isReadOnly && !row._inactive && <button
                          ref={el => { rowCloseRefs.current[idx] = el; }}
                          type="button"
                          className="remove-btn"
                          tabIndex={-1}
                          title="Remove row"
                          disabled={saving || isReadOnly}
                          onClick={() => removeRow(idx)}>
                          <XIcon/>
                        </button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {billingPageCount > 1 && (
            <nav className="billing-page-navigation" aria-label="Billing row pages">
              <button type="button" tabIndex={-1} disabled={billingPage === 1}
                onClick={() => setBillingPage(page => Math.max(1, page - 1))}>Previous</button>
              <span>Billing Page {billingPage} of {billingPageCount}</span>
              <button type="button" tabIndex={-1} disabled={billingPage === billingPageCount}
                onClick={() => setBillingPage(page => Math.min(billingPageCount, page + 1))}>Next</button>
            </nav>
          )}

          {/* ── Table footer: row count + grand total ── */}
          <div className="sales-entry-summary" style={{borderTop:`2px solid ${BRAND}22`,display:'flex',
            justifyContent:'space-between',alignItems:'center',
            padding:'.55rem 1rem',background:'var(--card-bg)'}}>
            <span style={{fontSize:'.84rem',color:'var(--text-muted)',fontWeight:600}}>
              No. of Rows:{' '}
              <strong style={{color:'var(--text-primary)',fontVariantNumeric:'tabular-nums'}}>
                {totals.rowCount}
              </strong>
            </span>
            <span style={{fontSize:'.95rem',fontWeight:800,color:BRAND,fontVariantNumeric:'tabular-nums'}}>
              Grand Total: {fmtMoney(totals.grandTotal)}
            </span>
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div ref={billingActionsRef} className="form-actions-bar sales-entry-actions sales-mobile-actions" style={{display:'flex',justifyContent:'center',alignItems:'center',
          gap:'.625rem',marginTop:'1rem',flexWrap:'wrap'}}>
          {/* Delete button — only on edit mode, admin only */}
          {isEdit && isAdmin && !isReadOnly && (
            <button type="button"
              tabIndex={-1}
              onClick={() => setShowDel(true)}
              disabled={saving || deleting}
              style={{padding:'.5rem 1.125rem',borderRadius:8,marginRight:'auto',
                border:'1.5px solid var(--danger)',background:'transparent',
                cursor:(saving||deleting)?'not-allowed':'pointer',fontSize:'.84rem',fontWeight:600,
                color:'var(--danger)',transition:'all .15s',display:'flex',alignItems:'center',gap:'.4rem',
                opacity:(saving||deleting)?.6:1}}
              onMouseEnter={e=>{e.currentTarget.style.background='var(--danger-light)';}}
              onMouseLeave={e=>{e.currentTarget.style.background='transparent';}}>
              🗑 Delete
            </button>
          )}
          <button type="button"
            tabIndex={-1}
            ref={cancelBtnRef}
            onClick={() => navigate('/billing')}
            disabled={saving}
            style={{padding:'.5rem 1.25rem',borderRadius:8,
              border:'1.5px solid var(--border-input)',background:'transparent',
              cursor:saving?'not-allowed':'pointer',fontSize:'.84rem',fontWeight:600,
              color:'var(--text-muted)',transition:'all .15s',opacity:saving?.6:1}}>
            {isReadOnly ? 'Back' : 'Cancel'}
          </button>
          {!isReadOnly && <button
            ref={saveBtnRef}
            type="button"
            tabIndex={-1}
            onClick={handleSave}
            disabled={!canSave}
            style={{padding:'.5rem 1.5rem',borderRadius:8,
              border:'none',background: canSave ? BRAND : 'var(--scale-200)',
              color: canSave ? '#fff' : 'var(--text-muted)',
              fontWeight:700,cursor:canSave?'pointer':'not-allowed',
              fontSize:'.84rem',display:'flex',alignItems:'center',gap:'.4rem',
              transition:'all .15s',boxShadow: canSave ? `0 3px 12px ${BRAND}44` : 'none'}}>
            {saving ? 'Saving…' : '✓ Save Sales Bill'}
          </button>}
        </div>

        {/* Delete confirm modal */}
        <ConfirmModal
          show={showDel}
          title="Delete Sales Record"
          message="Delete this sales record? Earned reward points will be rolled back. This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setShowDel(false)}
          confirmVariant="danger"
          confirmText={deleting ? 'Deleting…' : 'Delete'}
          cancelText="Cancel"
        />

      </form>
    </Layout>
  );
};

export default BillingForm;
