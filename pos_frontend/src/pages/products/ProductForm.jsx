import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Layout from '../../components/Layout';
import LoadingSpinner from '../../components/LoadingSpinner';
import productService from '../../services/productService';
import productGroupService from '../../services/productGroupService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import useMobileDropdownPlacement from '../../hooks/useMobileDropdownPlacement';
import { clearPageCache } from '../../services/pageCache';

const BRAND = '#8A5125';
const Req   = () => <span style={{color:'var(--danger)',marginLeft:2}}>*</span>;
const Opt   = () => <span style={{color:'var(--text-muted)',fontWeight:400,marginLeft:4,fontSize:'.73rem'}}>(optional)</span>;
const Spin  = () => <span style={{display:'inline-block',width:14,height:14,border:'2px solid rgba(255,255,255,.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .6s linear infinite',flexShrink:0}}/>;
const CI    = { height:34, padding:'.3rem .65rem', fontSize:'.82rem' };
const errStyle   = { fontSize:'.67rem', color:'var(--danger)', marginTop:'.18rem', fontWeight:500 };
const labelStyle = { display:'block', fontWeight:700, fontSize:'.72rem', color:'var(--text-label)', marginBottom:'.22rem' };
const PRODUCT_DRAFT_KEY = 'product-form-draft:/products/new';
const rankSearch = (items, query, getLabel) => {
  const term = query.trim().toLowerCase();
  if (!term) return items;
  return items
    .filter(item => getLabel(item).toLowerCase().includes(term))
    .sort((a,b) => {
      const aa=getLabel(a).toLowerCase(), bb=getLabel(b).toLowerCase();
      const score = value => value === term ? 0 : value.startsWith(term) ? 1 : 2;
      return score(aa)-score(bb) || aa.localeCompare(bb);
    });
};

const firstApiError = (data, fallback) => {
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (data.detail) return Array.isArray(data.detail) ? data.detail[0] : String(data.detail);
  for (const value of Object.values(data)) {
    if (Array.isArray(value) && value.length) return String(value[0]);
    if (value) return String(value);
  }
  return fallback;
};

const Toggle = ({ value, onChange, disabled }) => (
  <div style={{display:'flex',alignItems:'center',gap:'.4rem'}}>
    <div onClick={()=>{if(!disabled)onChange(!value);}} style={{
      position:'relative',width:38,height:20,borderRadius:10,
      background:value?BRAND:'#bdbdbd',transition:'background .2s',
      cursor:disabled?'not-allowed':'pointer',flexShrink:0}}>
      <div style={{position:'absolute',top:3,left:value?21:3,width:14,height:14,borderRadius:'50%',
        background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,.25)',transition:'left .2s'}}/>
    </div>
    <span style={{fontSize:'.78rem',fontWeight:700,color:value?BRAND:'var(--text-muted)'}}>{value?'Active':'Inactive'}</span>
  </div>
);

/* ── Standard UQC list ── */
const UQC_LIST = [
  'BAG','BAL','BDL','BKL','BOU','BOX','BTL','BUN','CAN','CBM','CCM','CMS',
  'CTN','DOZ','DRM','GGK','GMS','GRS','GYD','KGS','KLR','KME','LTR','MLT',
  'MTR','MTS','NOS','OTH','PAC','PCE','PCS','PRS','QTL','ROL','SET','SQF',
  'SQM','SQY','TBS','TGM','THD','TON','TUB','UGS','UNT','YDS',
];

/* ── UQC searchable dropdown (inside Unit popup) ── */
const UQCDropdown = ({ units, value, onChange, error }) => {
  const [q, setQ] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const ref = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const { menuClassName, mobileMenuStyle } = useMobileDropdownPlacement(ref, open);
  const allUQC = [...new Set(units.map(u => String(u.UQC || '').trim().toUpperCase()).filter(Boolean))].sort();
  const filtered = q.trim() ? allUQC.filter(u => u.toLowerCase().includes(q.toLowerCase())) : allUQC;
  useEffect(() => {
    if (open && highlightedIndex >= 0) listRef.current?.children[highlightedIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [open, highlightedIndex, filtered.length]);

  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setQ(value || '');
  }, [value]);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return undefined;
    const clear = () => {
      setQ('');
      setOpen(false);
      onChange('');
      setTimeout(() => el.focus(), 0);
    };
    el.addEventListener('pos-escape-clear-field', clear);
    return () => el.removeEventListener('pos-escape-clear-field', clear);
  }, [onChange]);

  return (
    <div ref={ref} style={{position:'relative'}}>
      <input ref={inputRef} type="text" autoComplete="off" placeholder="Search UQC Code..." value={q}
        style={{...CI,width:'100%',paddingRight:'1.6rem',border:`1.5px solid ${error?'var(--danger)':BRAND}`,borderRadius:6}}
        onChange={e=>{setQ(e.target.value.toUpperCase());setOpen(true);setHighlightedIndex(-1);onChange('');}}
        onFocus={()=>setHighlightedIndex(-1)}
        onMouseDown={()=>{setOpen(true);setHighlightedIndex(-1);}}
        onKeyDown={e=>{
          if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); setHighlightedIndex(-1); return; }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault(); e.stopPropagation();
            if (!open) { setOpen(true); setHighlightedIndex(filtered.length ? (e.key === 'ArrowDown' ? 0 : filtered.length - 1) : -1); return; }
            setHighlightedIndex(i => filtered.length ? (e.key === 'ArrowDown' ? Math.min(i < 0 ? 0 : i + 1, filtered.length - 1) : Math.max(i < 0 ? filtered.length - 1 : i - 1, 0)) : -1);
            return;
          }
          if (e.key === 'Enter' && open) {
            const selected = filtered[highlightedIndex] || filtered.find(u => u.toLowerCase() === q.toLowerCase().trim());
            e.preventDefault(); e.stopPropagation();
            if (selected) { onChange(selected); setQ(selected); setOpen(false); setHighlightedIndex(-1); }
            else { setOpen(false); setHighlightedIndex(-1); }
          }
        }}
        onBlur={()=>setTimeout(()=>{ setOpen(false); if (!value) setQ(''); else setQ(value); }, 120)}/>
      <span style={{position:'absolute',right:'.5rem',top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:'var(--text-muted)',fontSize:'.6rem'}}>v</span>
      {open && filtered.length > 0 && (
        <ul ref={listRef} className={menuClassName} style={{...mobileMenuStyle,position:'absolute',top:'100%',left:0,right:0,zIndex:99999,
          background:'#fff',border:`1.5px solid ${BRAND}`,borderTop:'none',borderRadius:'0 0 6px 6px',
          boxShadow:'0 6px 20px rgba(0,0,0,.14)',maxHeight:160,overflowY:'auto',margin:0,padding:0,listStyle:'none'}}>
          {filtered.map((u, i) => (
            <li key={u} onMouseDown={()=>{onChange(u);setQ(u);setOpen(false);setHighlightedIndex(-1);}}
              style={{padding:'.3rem .65rem',fontSize:'.8rem',cursor:'pointer',
                background:highlightedIndex===i?'var(--primary-light)':value===u?'var(--primary-light)':'transparent',fontWeight:value===u?700:400}}
              onMouseEnter={e=>{if(value!==u)e.currentTarget.style.background='var(--scale-50)';}}
              onMouseLeave={e=>{if(value!==u)e.currentTarget.style.background='transparent';}}>{u}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
/* Unit popup modal */
const UnitPopup = ({ units, onClose, onSaved }) => {
  const [unitName, setUnitName] = useState('');
  const [uqc,      setUqc]      = useState('');
  const [decimal,  setDecimal]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');
  const unitNameRef = useRef(null);
  const decimalRef = useRef(null);
  const decimalEnterRef = useRef({ time: 0, timer: null });

  useEffect(() => () => {
    if (decimalEnterRef.current.timer) clearTimeout(decimalEnterRef.current.timer);
  }, []);

  const save = async () => {
    if (saving) return;
    const n = unitName.trim();
    const u = uqc.trim().toUpperCase();
    const d = decimal.trim();
    if (!n) { setErr('Unit name is required.'); return; }
    if (!u) { setErr('UQC Code is required.'); return; }
    if (!d) { setErr('Decimal is required.'); return; }
    const byCode = units.find(x => String(x.UQC || '').toUpperCase() === u);
    const byName = units.find(x => x.UnitName.toLowerCase() === n.toLowerCase());
    if (byCode) {
      setErr('This UQC Code already exists.');
      return;
    }
    if (byName) {
      setErr('This Unit Name already exists.');
      return;
    }
    setSaving(true); setErr('');
    try {
      const created = await productService.createUnit({ UnitName: n, UQC: u, Decimal: d });
      onSaved(created);
    } catch (e) {
      const d = e.response?.data;
      setErr(firstApiError(d, 'Failed to create unit.'));
    } finally { setSaving(false); }
  };

  return createPortal(
    <div data-unit-entry-popup="true" onClick={onClose} style={{position:'fixed',inset:0,zIndex:99500,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'var(--card-bg)',borderRadius:12,boxShadow:'0 16px 48px rgba(0,0,0,.28)',padding:'1.25rem 1.375rem',width:'min(400px,96vw)',border:`1.5px solid ${BRAND}`}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
          <span style={{fontWeight:800,fontSize:'.95rem',color:'var(--text-primary)',fontFamily:'var(--font-heading)'}}>Unit Entry</span>
          <button type="button" onClick={onClose} style={{background:'var(--scale-100)',border:'none',borderRadius:6,width:28,height:28,cursor:'pointer',color:'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
        </div>
        <div style={{marginBottom:'.65rem'}}>
          <label style={labelStyle}>UQC Code <span style={{color:'var(--danger)'}}>*</span></label>
          <input type="text" placeholder="e.g. PCS, KG, LTR" value={uqc}
            onChange={e=>{setUqc(e.target.value.toUpperCase());setErr('');}}
            onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();unitNameRef.current?.focus();}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}}}
            style={{...CI,width:'100%',border:`1.5px solid ${err?'var(--danger)':BRAND}`,borderRadius:6}}/>
          {err && <div style={errStyle}>{err}</div>}
        </div>
        <div style={{marginBottom:'.65rem'}}>
          <label style={labelStyle}>Unit Name <span style={{color:'var(--danger)'}}>*</span></label>
          <input ref={unitNameRef} type="text" placeholder="e.g. Kilograms, Pieces, Litres" value={unitName}
            onChange={e=>{setUnitName(e.target.value);setErr('');}}
            onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();decimalRef.current?.focus();}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}}}
            style={{...CI,width:'100%',border:`1.5px solid ${err?'var(--danger)':BRAND}`,borderRadius:6}}/>
        </div>
        <div style={{marginBottom:'.65rem'}}>
          <label style={labelStyle}>Decimal <span style={{color:'var(--danger)'}}>*</span></label>
          <input ref={decimalRef} type="text" name="decimal" placeholder="Enter decimal value" value={decimal}
            onChange={e=>{setDecimal(e.target.value);setErr('');}}
            onKeyDown={e=>{
              if(e.key==='Enter'){
                e.preventDefault(); e.stopPropagation();
                if(e.repeat) return;
                const now = Date.now();
                if(decimalEnterRef.current.timer && now - decimalEnterRef.current.time <= 350){
                  clearTimeout(decimalEnterRef.current.timer);
                  decimalEnterRef.current = { time: 0, timer: null };
                  save();
                  return;
                }
                const timer = setTimeout(()=>{ decimalEnterRef.current = { time: 0, timer: null }; }, 350);
                decimalEnterRef.current = { time: now, timer };
              }
              if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}
            }}
            style={{...CI,width:'100%',border:`1.5px solid ${err?'var(--danger)':BRAND}`,borderRadius:6}}/>
        </div>
        <div style={{display:'flex',gap:'.625rem',justifyContent:'flex-end',marginTop:'.875rem'}}>
          <button type="button" onClick={onClose} style={{padding:'.45rem 1rem',borderRadius:7,border:'1.5px solid var(--border-input)',background:'transparent',cursor:'pointer',fontSize:'.82rem',fontWeight:600}}>Cancel</button>
          <button type="button" onClick={save} disabled={saving}
            style={{padding:'.45rem 1.125rem',borderRadius:7,border:'none',background:BRAND,color:'#fff',fontWeight:700,cursor:saving?'not-allowed':'pointer',fontSize:'.82rem',display:'flex',alignItems:'center',gap:'.35rem',opacity:saving?.65:1}}>
            {saving?<Spin/>:'✓'} Save
          </button>
        </div>
      </div>
    </div>, document.body
  );
};

/* ── Group popup modal (centered, with HSN + GST) ── */
const GroupPopup = ({ groups, onClose, onSaved }) => {
  const [groupName, setGroupName] = useState('');
  const [hsn,       setHsn]       = useState('');
  const [gst,       setGst]       = useState('');
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState('');
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  const save = async () => {
    if (saving) return;
    const n = groupName.trim();
    if (!n) { setErr('Group name is required.'); return; }
    if (groups.some(group => group.GroupName.trim().toLowerCase() === n.toLowerCase())) {
      setErr('This product group already exists.');
      return;
    }
    if (!hsn.trim()) { setErr('HSN Code is required.'); return; }
    if (!String(gst).trim()) { setErr('GST % is required.'); return; }
    if (!/^\d+$/.test(String(gst).trim()) || Number(gst) < 0 || Number(gst) > 100) {
      setErr('GST % must be a valid number between 0 and 100.');
      return;
    }
    setSaving(true); setErr('');
    try {
      const created = await productGroupService.createGroup({
        GroupName: n,
        HSNCode: hsn.trim(),
        GSTPercent: Number(gst),
      });
      onSaved(created);
    } catch (e) {
      const d = e.response?.data;
      setErr(firstApiError(d, 'Failed to save group.'));
    } finally { setSaving(false); }
  };

  return createPortal(
    <div data-product-group-entry-popup="true" onClick={onClose} style={{position:'fixed',inset:0,zIndex:99500,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'var(--card-bg)',borderRadius:12,boxShadow:'0 16px 48px rgba(0,0,0,.28)',padding:'1.25rem 1.375rem',width:'min(420px,96vw)',border:`1.5px solid ${BRAND}`}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
          <span style={{fontWeight:800,fontSize:'.95rem',color:'var(--text-primary)',fontFamily:'var(--font-heading)'}}>Add Product Group</span>
          <button type="button" onClick={onClose} style={{background:'var(--scale-100)',border:'none',borderRadius:6,width:28,height:28,cursor:'pointer',color:'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
        </div>
        <div style={{marginBottom:'.65rem'}}>
          <label style={labelStyle}>Group Name <span style={{color:'var(--danger)'}}>*</span></label>
          <input ref={inputRef} type="text" placeholder="e.g. Beverages, Dairy…" value={groupName}
            onChange={e=>{setGroupName(e.target.value);setErr('');}}
            onKeyDown={e=>{if(e.key==='Enter')e.preventDefault();if(e.key==='Escape')onClose();}}
            style={{...CI,width:'100%',border:`1.5px solid ${err?'var(--danger)':BRAND}`,borderRadius:6}}/>
          {err && <div style={errStyle}>{err}</div>}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem',marginBottom:'.875rem'}}>
          <div>
            <label style={labelStyle}>HSN Code <span style={{color:'var(--danger)'}}>*</span></label>
            <input type="text" placeholder="e.g. 1905" value={hsn} onChange={e=>{setHsn(e.target.value);setErr('');}}
              style={{...CI,width:'100%',border:'1.5px solid var(--border-input)',borderRadius:6}}/>
          </div>
          <div>
            <label style={labelStyle}>GST % <span style={{color:'var(--danger)'}}>*</span></label>
            <input type="text" inputMode="numeric" placeholder="0" value={gst} onChange={e=>{setGst(e.target.value);setErr('');}}
              style={{...CI,width:'100%',border:'1.5px solid var(--border-input)',borderRadius:6}}/>
          </div>
        </div>
        <div style={{display:'flex',gap:'.625rem',justifyContent:'flex-end'}}>
          <button type="button" onClick={onClose} style={{padding:'.45rem 1rem',borderRadius:7,border:'1.5px solid var(--border-input)',background:'transparent',cursor:'pointer',fontSize:'.82rem',fontWeight:600}}>Cancel</button>
          <button type="button" onClick={save} disabled={saving}
            style={{padding:'.45rem 1.125rem',borderRadius:7,border:'none',background:BRAND,color:'#fff',fontWeight:700,cursor:saving?'not-allowed':'pointer',fontSize:'.82rem',display:'flex',alignItems:'center',gap:'.35rem',opacity:saving?.65:1}}>
            {saving?<Spin/>:'✓'} Save
          </button>
        </div>
      </div>
    </div>, document.body
  );
};

/* ── Searchable group dropdown (shows popup on + click) ── */
const GroupDropdown = ({ groups, value, onChange, onGroupAdded, onGroupSelected, disabled, error }) => {
  const [q,        setQ]        = useState('');
  const [open,     setOpen]     = useState(false);
  const [hi,       setHi]       = useState(-1);
  const [showPopup,setShowPopup]= useState(false);
  const ref = useRef(null);
  const anchorRef = useRef(null);
  const inputRef = useRef(null);
  const { menuClassName, mobileMenuStyle } = useMobileDropdownPlacement(anchorRef, open);

  const sel = groups.find(g => g.id === value);
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setQ(sel ? sel.GroupName : '');
  }, [value, groups, sel]);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return undefined;
    const clear = () => {
      if (disabled) return;
      setQ('');
      setOpen(false);
      onChange(null);
      onGroupSelected && onGroupSelected(null);
      setTimeout(() => el.focus(), 0);
    };
    el.addEventListener('pos-escape-clear-field', clear);
    return () => el.removeEventListener('pos-escape-clear-field', clear);
  }, [disabled, onChange, onGroupSelected]);

  const filtered = rankSearch(groups, q, g => g.GroupName || '');

  const pick = (g) => {
    onChange(g.id);
    setQ(g.GroupName);
    setOpen(false);
    setHi(-1);
    onGroupSelected && onGroupSelected(g);
  };

  return (
    <div ref={ref}>
      <div className="product-lookup-with-add" style={{display:'flex',alignItems:'center',gap:'.4rem'}}>
        <div ref={anchorRef} className="app-dropdown" style={{position:'relative',flex:1}}>
          <input ref={inputRef} data-nav-order="2" type="text" autoComplete="off"
            className={`form-control${error?' is-invalid':''}`}
            placeholder="Search or select group…"
            value={q} disabled={disabled}
            style={{...CI,width:'100%',paddingRight:'1.6rem'}}
            onChange={e=>{setQ(e.target.value);setOpen(true);if(!e.target.value){onChange(null);onGroupSelected&&onGroupSelected(null);}}}
            onFocus={()=>{}}
            onMouseDown={()=>setOpen(true)}
            onKeyDown={e=>{
              if(e.key==='Enter'){
                e.preventDefault();
                if(!open){setOpen(true);setHi(filtered.length ? 0 : -1);}
                else if(filtered[hi]) pick(filtered[hi]);
              } else if(e.key==='ArrowDown' || e.key==='ArrowUp'){
                e.preventDefault(); setOpen(true);
                setHi(i=>filtered.length ? (e.key==='ArrowDown' ? Math.min(i<0?0:i+1,filtered.length-1) : Math.max(i<0?filtered.length-1:i-1,0)) : -1);
              } else if(e.key==='Escape' && open){e.preventDefault();setOpen(false);setHi(-1);}
            }}
            onBlur={()=>setTimeout(()=>{
              setOpen(false);
              const ex=groups.find(g=>g.GroupName.toLowerCase()===q.toLowerCase());
              if(ex){setQ(ex.GroupName);onChange(ex.id);onGroupSelected&&onGroupSelected(ex);}
              else if(!sel)setQ('');
            },160)}/>
          <span style={{position:'absolute',right:'.5rem',top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:'var(--text-muted)',fontSize:'.6rem'}}>▾</span>
          {open && filtered.length > 0 && (
            <ul className={menuClassName} style={{...mobileMenuStyle,position:'absolute',top:'100%',left:0,right:0,zIndex:9999,
              background:'var(--card-bg)',border:'1.5px solid var(--primary)',borderTop:'none',
              borderRadius:'0 0 6px 6px',boxShadow:'0 6px 20px rgba(0,0,0,.12)',
              maxHeight:200,overflowY:'auto',margin:0,padding:0,listStyle:'none'}}>
              {filtered.map(g => (
                <li key={g.id} onMouseDown={()=>pick(g)}
                  style={{padding:'.38rem .65rem',fontSize:'.81rem',cursor:'pointer',
                    background:value===g.id?'var(--primary-light)':'transparent',fontWeight:value===g.id?700:400}}
                  onMouseEnter={e=>{if(value!==g.id)e.currentTarget.style.background='var(--scale-50)';}}
                  onMouseLeave={e=>{if(value!==g.id)e.currentTarget.style.background='transparent';}}>
                  <span style={{fontWeight:hi===filtered.indexOf(g)?700:600}}>{g.GroupName}</span>
                  {(g.HSNCode||g.GSTPercent>0)&&<span style={{marginLeft:'.5rem',fontSize:'.68rem',color:'var(--text-muted)'}}>
                    {g.HSNCode&&`HSN:${g.HSNCode}`}{g.HSNCode&&g.GSTPercent>0&&' · '}{g.GSTPercent>0&&`GST:${g.GSTPercent}%`}
                  </span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        {!disabled && (
          <button type="button" className="product-lookup-add-button" title="Add new group" onClick={()=>setShowPopup(true)}
            style={{width:28,height:28,borderRadius:6,background:'var(--primary-light)',
              border:`1px solid ${BRAND}`,color:BRAND,fontWeight:800,fontSize:'1rem',
              cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
        )}
      </div>
      {showPopup && (
        <GroupPopup
          groups={groups}
          onClose={()=>setShowPopup(false)}
          onSaved={g=>{
            onGroupAdded(g);
            pick(g);
            setShowPopup(false);
          }}/>
      )}
    </div>
  );
};

/* ── Unit searchable dropdown (picks from saved units) ── */
const UnitDropdown = ({ units, value, onChange, onUnitAdded, onUnitsChanged, disabled, error }) => {
  const selected = units.find(u => String(u.id) === String(value));
  const [q,        setQ]        = useState('');
  const [open,     setOpen]     = useState(false);
  const [hi,       setHi]       = useState(-1);
  const [showPopup,setShowPopup]= useState(false);
  const ref = useRef(null);
  const anchorRef = useRef(null);
  const inputRef = useRef(null);
  const { menuClassName, mobileMenuStyle } = useMobileDropdownPlacement(anchorRef, open);

  const unitLabel = (u) => u ? `${u.UQC || '--'} - ${u.UnitName}` : '';
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setQ(unitLabel(selected));
  }, [selected]);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return undefined;
    const clear = () => {
      if (disabled) return;
      setQ('');
      setOpen(false);
      onChange(null);
      setTimeout(() => el.focus(), 0);
    };
    el.addEventListener('pos-escape-clear-field', clear);
    return () => el.removeEventListener('pos-escape-clear-field', clear);
  }, [disabled, onChange]);

  const filtered = rankSearch(units, q, u => `${u.UnitName || ''} ${u.UQC || ''} ${unitLabel(u)}`);
  const pick = (u) => {
    onChange(u);
    setQ(unitLabel(u));
    setOpen(false);
    setHi(-1);
  };

  return (
    <div ref={ref}>
      <div className="product-lookup-with-add" style={{display:'flex',alignItems:'center',gap:'.4rem'}}>
        <div ref={anchorRef} className="app-dropdown" style={{position:'relative',flex:1}}>
          <input ref={inputRef} data-nav-order="3" type="text" autoComplete="off"
            className={`form-control${error?' is-invalid':''}`}
            placeholder="pcs  kg  litre  dozen…"
            value={q} disabled={disabled}
            style={{...CI,width:'100%',paddingRight:'1.6rem'}}
            onChange={e=>{setQ(e.target.value);setOpen(true);onChange(null);}}
            onFocus={()=>{}}
            onMouseDown={()=>setOpen(true)}
            onKeyDown={e=>{
              if(e.key==='Enter'){
                e.preventDefault();
                if(!open){setOpen(true);setHi(filtered.length ? 0 : -1);}
                else if(filtered[hi]) pick(filtered[hi]);
              } else if(e.key==='ArrowDown' || e.key==='ArrowUp'){
                e.preventDefault(); setOpen(true);
                setHi(i=>filtered.length ? (e.key==='ArrowDown' ? Math.min(i<0?0:i+1,filtered.length-1) : Math.max(i<0?filtered.length-1:i-1,0)) : -1);
              } else if(e.key==='Escape' && open){e.preventDefault();setOpen(false);setHi(-1);}
            }}
            onBlur={()=>setTimeout(()=>{
              setOpen(false);
              const ex=units.find(u =>
                u.UnitName.toLowerCase()===q.toLowerCase() ||
                String(u.UQC || '').toLowerCase()===q.toLowerCase() ||
                unitLabel(u).toLowerCase()===q.toLowerCase());
              if(ex) pick(ex);
              else setQ(unitLabel(selected));
            },160)}/>
          <span style={{position:'absolute',right:'.5rem',top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:'var(--text-muted)',fontSize:'.6rem'}}>▾</span>
          {open && filtered.length > 0 && (
            <ul className={menuClassName} style={{...mobileMenuStyle,position:'absolute',top:'100%',left:0,right:0,zIndex:9999,
              background:'var(--card-bg)',border:'1.5px solid var(--primary)',borderTop:'none',
              borderRadius:'0 0 6px 6px',boxShadow:'0 6px 20px rgba(0,0,0,.12)',
              maxHeight:200,overflowY:'auto',margin:0,padding:0,listStyle:'none'}}>
              {filtered.map(u => (
                <li key={u.id} onMouseDown={e=>{e.preventDefault();pick(u);}}
                  style={{padding:'.35rem .65rem',fontSize:'.81rem',cursor:'pointer',
                    background:String(value)===String(u.id)?'var(--primary-light)':'transparent',fontWeight:String(value)===String(u.id)?700:400,
                    display:'flex',justifyContent:'space-between',alignItems:'center'}}
                  onMouseEnter={e=>{if(String(value)!==String(u.id))e.currentTarget.style.background='var(--scale-50)';}}
                  onMouseLeave={e=>{if(String(value)!==String(u.id))e.currentTarget.style.background='transparent';}}>
                  <span style={{fontWeight:600}}>{unitLabel(u)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {!disabled && (
          <button type="button" className="product-lookup-add-button" title="Add new unit" onClick={()=>setShowPopup(true)}
            style={{width:28,height:28,borderRadius:6,background:'var(--primary-light)',
              border:`1px solid ${BRAND}`,color:BRAND,fontWeight:800,fontSize:'1rem',
              cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
        )}
      </div>
      {showPopup && (
        <UnitPopup
          units={units}
          onClose={()=>setShowPopup(false)}
          onSaved={u=>{
            onUnitAdded(u);
            onChange(u);
            setQ(unitLabel(u));
            setShowPopup(false);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}/>
      )}
    </div>
  );
};

const EMPTY_FORM = {
  GroupId:'', ProductName:'', ProductNameTamil:'',
  HSNCode:'', GSTPercent:'',
  Quantity:'', Units:'', UnitId:'', Description:'', IsActive:true,
};

const PRODUCT_NAME_MAX = 200;
const TAMIL_NAME_MAX = 200;
const HSN_MAX = 20;
const UNIT_MAX = 100;
const normalizeNumericInput = rawValue => {
  let value = String(rawValue ?? '').replace(/[^\d.]/g, '');
  const parts = value.split('.');
  if (parts.length > 2) value = `${parts[0]}.${parts.slice(1).join('')}`;
  if (value.length > 1 && value.startsWith('0') && !value.startsWith('0.')) value = value.replace(/^0+/, '');
  return value;
};
const API_FIELD_MAP = {
  ProductName: 'ProductName',
  product_name: 'ProductName',
  ProductNameTamil: 'ProductNameTamil',
  product_name_tamil: 'ProductNameTamil',
  GroupId: 'GroupId',
  group: 'GroupId',
  UnitId: 'Units',
  unit: 'Units',
  Units: 'Units',
  Quantity: 'Quantity',
  Description: 'Description',
  HSNCode: 'HSNCode',
  GSTPercent: 'GSTPercent',
  IsActive: 'IsActive',
};

const friendlyProductError = (field, raw) => {
  const message = Array.isArray(raw) ? raw[0] : raw;
  const text = typeof message === 'object'
    ? Object.values(message || {}).flat().join(' ')
    : String(message || '');
  if (/no more than 200 characters|max_length.*200/i.test(text)) {
    return field === 'ProductNameTamil'
      ? `Tamil product name must not exceed ${TAMIL_NAME_MAX} characters.`
      : `Product name must not exceed ${PRODUCT_NAME_MAX} characters.`;
  }
  if (/does not exist|invalid pk|incorrect type/i.test(text)) {
    if (field === 'GroupId') return 'Please select a valid product group.';
    if (field === 'Units') return 'The selected unit is no longer available. Please choose another unit.';
  }
  return text || 'This value is invalid.';
};

const ProductForm = () => {
  const navigate    = useNavigate();
  const location    = useLocation();
  const { id }      = useParams();
  const { isAdmin } = useAuth();
  const toast       = useToast();
  const isEdit      = id !== undefined && id !== 'new';
  const isNewProductRoute = location.pathname === '/products/new' && !isEdit;
  const salesBillingSource = location.state?.source === 'sales-billing';
  const quickSalesReturn = salesBillingSource && location.state?.salesDraft;
  const quickFixedPriceContext = Boolean(
    salesBillingSource && location.state?.salesDraft?.priceConfig?.PriceCodeType === 'Fixed'
  );
  const returnToSalesForm = useCallback((productCreated = false, createdProduct = null) => {
    navigate(location.state?.returnPath || '/billing/new', {
      state: {
        source: productCreated && quickSalesReturn ? 'product-created-from-billing' : undefined,
        originatingRowId: location.state?.salesDraft?.productTargetRowKey || null,
        restoreSalesDraft: location.state?.salesDraft,
        productCreated,
        createdProduct,
        createdProductPrice: createdProduct?.product_price || null,
      },
    });
  }, [location.state, navigate]);

  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [errors,      setErrors]      = useState({});
  const [apiError,    setApiError]    = useState('');
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [productCode, setProductCode] = useState('');
  const [createdInfo, setCreatedInfo] = useState(null);
  const [groups,      setGroups]      = useState([]);
  const [units,       setUnits]       = useState([]);
  const [groupTaxHint, setGroupTaxHint] = useState('');
  const [priceEntryOpen, setPriceEntryOpen] = useState(false);
  const [newProductPrice, setNewProductPrice] = useState('');
  const [priceCodes, setPriceCodes] = useState([]);
  const [selectedPriceCodeID, setSelectedPriceCodeID] = useState('');
  const [priceEntryError, setPriceEntryError] = useState('');
  const [pricingTaxInformationOpen, setPricingTaxInformationOpen] = useState(false);
  const [isDraftRestored, setIsDraftRestored] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  ));
  const priceEntryRef = useRef(null);
  const priceCodeEntryRef = useRef(null);
  const priceEntrySaveRef = useRef(false);
  const createdQuickProductRef = useRef(null);
  const productNameRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const taxValueSourceRef = useRef({ HSNCode: 'empty', GSTPercent: 'empty' });
  const draftHasProductCodeRef = useRef(false);
  const suppressEmptyDraftRef = useRef(false);

  useEffect(() => {
    if (!isNewProductRoute) {
      setIsDraftRestored(true);
      return;
    }
    let draft = null;
    try {
      const saved = sessionStorage.getItem(PRODUCT_DRAFT_KEY);
      draft = saved ? JSON.parse(saved) : null;
    } catch { draft = null; }
    if (draft && typeof draft === 'object') {
      setForm(current => ({ ...current, ...EMPTY_FORM, ...(draft.form || {}) }));
      if (draft.ProductCode) {
        setProductCode(String(draft.ProductCode));
        draftHasProductCodeRef.current = true;
      }
      setPricingTaxInformationOpen(Boolean(draft.pricingTaxInformationOpen));
      taxValueSourceRef.current = {
        HSNCode: draft.form?.HSNCode ? 'manual' : 'empty',
        GSTPercent: draft.form?.GSTPercent ? 'manual' : 'empty',
      };
    }
    setIsDraftRestored(true);
  }, [isNewProductRoute]);

  useEffect(() => {
    if (!isNewProductRoute || !isDraftRestored) return;
    const hasFormValues = Object.entries(form).some(([key, value]) => (
      key !== 'IsActive' && String(value ?? '').trim() !== ''
    ));
    if (suppressEmptyDraftRef.current && !hasFormValues && !pricingTaxInformationOpen) return;
    if (hasFormValues || pricingTaxInformationOpen) suppressEmptyDraftRef.current = false;
    try {
      const selectedGroup = groups.find(group => String(group.id) === String(form.GroupId));
      const selectedUnit = units.find(unit => String(unit.id) === String(form.UnitId));
      sessionStorage.setItem(PRODUCT_DRAFT_KEY, JSON.stringify({
        form,
        ProductCode: productCode,
        selectedGroup: selectedGroup || null,
        selectedUnit: selectedUnit || null,
        pricingTaxInformationOpen,
      }));
    } catch { /* sessionStorage may be unavailable; form use continues normally. */ }
  }, [form, productCode, groups, units, pricingTaxInformationOpen, isDraftRestored, isNewProductRoute]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (priceEntryOpen) requestAnimationFrame(() => {
      if (quickFixedPriceContext) priceEntryRef.current?.focus();
      else priceCodeEntryRef.current?.focus();
    });
  }, [priceEntryOpen]);

  useEffect(() => {
    if (!quickSalesReturn) return undefined;
    api.get('/price-codes/').then(response => {
      const list = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      setPriceCodes(list.filter(code => code?.id != null));
    }).catch(() => setPriceCodes([]));
    return undefined;
  }, [quickSalesReturn]);

  useEffect(() => {
    if (!quickSalesReturn) return;
    const fixedId = location.state?.salesDraft?.priceConfig?.FixedPriceCodeID;
    setSelectedPriceCodeID(fixedId || '');
  }, [quickSalesReturn, location.state]);

  const handleNewProductPriceChange = e => {
    let value = e.target.value.replace(/[^\d.]/g, '');
    const parts = value.split('.');
    if (parts.length > 2) value = `${parts[0]}.${parts.slice(1).join('')}`;
    if (value.length > 1 && value.startsWith('0') && !value.startsWith('0.')) {
      value = value.replace(/^0+/, '') || '0';
    }
    setNewProductPrice(value);
    setPriceEntryError('');
  };

  /* ── fetch groups + units once ── */
  useEffect(() => {
    api.get('/product-groups/dropdown/')
      .then(r => setGroups(Array.isArray(r.data) ? r.data : (r.data.results || [])))
      .catch(() => {});
    productService.getUnits()
      .then(d => setUnits(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  /* ── fetch next code on Add mode ── */
  const fetchNextCode = useCallback(() => {
    productService.getNextCode()
      .then(c => setProductCode(c))
      .catch(() => setProductCode('POD_???'));
  }, []);

  useEffect(() => {
    if (!isEdit && !draftHasProductCodeRef.current) fetchNextCode();
  }, [isEdit, fetchNextCode]);

  /* ── load existing product in Edit mode ── */
  useEffect(() => {
    if (!isEdit) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await productService.getProduct(id);
        setProductCode(data.ProductCode || '');
        setForm({
          GroupId:          data.GroupId != null ? data.GroupId : '',
          ProductName:      data.ProductName || '',
          ProductNameTamil: data.ProductNameTamil || '',
          HSNCode:          String(data.HSNCode || '').trim() === '0000' ? '' : (data.HSNCode || ''),
          GSTPercent:       data.GSTPercent != null ? String(data.GSTPercent) : '',
          Quantity:         data.Quantity != null ? String(data.Quantity) : '',
          Units:            data.UnitName || data.Units || '',
          UnitId:           data.UnitId || '',
          Description:      data.Description || '',
          IsActive:         data.IsActive !== undefined ? data.IsActive : true,
        });
        taxValueSourceRef.current = {
          HSNCode: data.HSNCode != null && String(data.HSNCode).trim() ? 'manual' : 'empty',
          GSTPercent: data.GSTPercent != null && String(data.GSTPercent).trim() !== '' ? 'manual' : 'empty',
        };
        setCreatedInfo({ CreatedBy: data.CreatedByUsername || '', CreatedOn: data.CreatedOn });
      } catch (err) {
        setApiError(err.response?.data?.detail || 'Failed to load product.');
      } finally { setLoading(false); }
    };
    load();
  }, [id, isEdit]);

  const handleChange = useCallback((e) => {
    const { name } = e.target;
    const value = name === 'HSNCode'
      ? e.target.value.replace(/\D/g, '')
      : name === 'GSTPercent' || name === 'Quantity'
        ? normalizeNumericInput(e.target.value)
      : e.target.value;
    if (name === 'HSNCode' || name === 'GSTPercent') {
      taxValueSourceRef.current[name] = String(value).trim() === '' ? 'empty' : 'manual';
    }
    setForm(p => ({...p, [name]: value}));
    if (errors[name]) setErrors(p => ({...p, [name]: ''}));
    if (apiError) setApiError('');
  }, [errors, apiError]);

  const hasEnteredProductDetails = Object.entries(form).some(([key, value]) => (
    key !== 'IsActive' && String(value ?? '').trim() !== ''
  ));

  const performReset = useCallback(() => {
    suppressEmptyDraftRef.current = true;
    setForm({ ...EMPTY_FORM, IsActive: true });
    setErrors({});
    setApiError('');
    setGroupTaxHint('');
    setPricingTaxInformationOpen(false);
    setResetConfirmOpen(false);
    taxValueSourceRef.current = { HSNCode: 'empty', GSTPercent: 'empty' };
    if (isNewProductRoute) {
      try { sessionStorage.removeItem(PRODUCT_DRAFT_KEY); } catch { /* ignore storage failures */ }
    }
    requestAnimationFrame(() => productNameRef.current?.focus());
  }, [isNewProductRoute]);

  const requestReset = () => {
    if (hasEnteredProductDetails) setResetConfirmOpen(true);
    else performReset();
  };

  const clearProductDraft = useCallback(() => {
    if (!isNewProductRoute) return;
    try { sessionStorage.removeItem(PRODUCT_DRAFT_KEY); } catch { /* ignore storage failures */ }
  }, [isNewProductRoute]);

  /* Apply group suggestions without replacing manually entered tax values. */
  const handleGroupSelected = useCallback((g) => {
    const hsnDefault = g?.HSNCode != null ? String(g.HSNCode).trim() : '';
    const gstDefault = g?.GSTPercent != null && String(g.GSTPercent).trim() !== '' ? String(g.GSTPercent) : '';
    setGroupTaxHint(g && !hsnDefault && !gstDefault
      ? 'The selected Product Group has no default HSN/GST values. Enter them manually to continue.'
      : '');
    setForm(current => {
      const next = { ...current };
      ['HSNCode', 'GSTPercent'].forEach(field => {
        const suggestion = field === 'HSNCode' ? hsnDefault : gstDefault;
        if (taxValueSourceRef.current[field] === 'auto' || taxValueSourceRef.current[field] === 'empty') {
          next[field] = suggestion;
          taxValueSourceRef.current[field] = suggestion ? 'auto' : 'empty';
        }
      });
      return next;
    });
    setErrors(current => ({ ...current, HSNCode: '', GSTPercent: '' }));
  }, []);

  const validate = () => {
    const e = {};
    if (!form.ProductName.trim()) e.ProductName = 'Product name is required.';
    else if (form.ProductName.trim().length > PRODUCT_NAME_MAX)
      e.ProductName = `Product name must not exceed ${PRODUCT_NAME_MAX} characters.`;
    if (form.ProductNameTamil.trim().length > TAMIL_NAME_MAX)
      e.ProductNameTamil = `Tamil product name must not exceed ${TAMIL_NAME_MAX} characters.`;
    if (!form.UnitId) e.Units = 'Select a Unit/UQC from the list.';
    else if (form.Units.trim().length > UNIT_MAX) e.Units = `Unit must not exceed ${UNIT_MAX} characters.`;
    const normalizedHSN = String(form.HSNCode || '').trim();
    if (!normalizedHSN) e.HSNCode = 'HSN is required. Please enter a valid HSN code.';
    else if (/^0+$/.test(normalizedHSN)) e.HSNCode = 'HSN cannot be 0000. Please enter a proper HSN code.';
    else if (normalizedHSN.length > HSN_MAX)
      e.HSNCode = `HSN Code must not exceed ${HSN_MAX} characters.`;
    if (form.Quantity !== '' && (isNaN(parseInt(form.Quantity, 10)) || parseInt(form.Quantity, 10) < 0))
      e.Quantity = 'Enter a valid non-negative number.';
    if (String(form.GSTPercent).trim() === '') e.GSTPercent = 'GST Percentage is required.';
    else {
      const gp = Number(form.GSTPercent);
      if (!Number.isFinite(gp) || !Number.isInteger(gp) || gp > 100)
        e.GSTPercent = 'Please enter a valid GST percentage.';
      else if (gp < 0) e.GSTPercent = 'GST Percentage cannot be negative.';
    }
    return e;
  };

  const handleDescriptionKeyDown = e => {
    if (e.key !== 'Enter' || e.repeat || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!salesBillingSource) return;
    e.preventDefault();
    e.stopPropagation();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      requestAnimationFrame(() => {
        document.querySelector('form [aria-invalid="true"], form .is-invalid')?.focus();
      });
      return;
    }
    if (quickFixedPriceContext && !priceEntryOpen) {
      setPriceEntryOpen(true);
      return;
    }
    if (quickSalesReturn) handleSubmit(e);
  };

  const saveQuickProductWithPrice = async () => {
    if (priceEntrySaveRef.current || saving) return;
    const errs = validate();
    const price = Number(newProductPrice);
    const fixedPriceCodeID = location.state?.salesDraft?.priceConfig?.FixedPriceCodeID;
    const priceCodeID = quickFixedPriceContext ? fixedPriceCodeID : selectedPriceCodeID;
    if (!Number.isFinite(price) || price <= 0) {
      setPriceEntryError('Enter a valid positive price.');
      return;
    }
    if (!priceCodeID) {
      setPriceEntryError('Select a price code.');
      return;
    }
    if (Object.keys(errs).length) {
      setErrors(errs);
      setPriceEntryError('Please complete the required Product fields first.');
      setPriceEntryOpen(false);
      return;
    }
    priceEntrySaveRef.current = true;
    setSaving(true); setPriceEntryError('');
    const payload = {
      ProductName: form.ProductName.trim(), ProductNameTamil: form.ProductNameTamil.trim() || null,
      Units: form.Units.trim(), UnitId: form.UnitId ? parseInt(form.UnitId, 10) : null,
      Description: form.Description.trim() || null, IsActive: form.IsActive,
      GroupId: form.GroupId ? parseInt(form.GroupId, 10) : null,
      HSNCode: form.HSNCode.trim(), GSTPercent: Number(form.GSTPercent),
      ...(form.Quantity !== '' ? { Quantity: parseInt(form.Quantity, 10) } : {}),
    };
    try {
      let createdProduct = createdQuickProductRef.current;
      let createdProductPrice;
      if (!createdProduct) {
        if (quickFixedPriceContext) {
          createdProduct = await productService.createProductWithFixedPrice({
            ...payload, FixedPriceCodeID: priceCodeID, ProductPrice: newProductPrice.trim(),
          });
          createdProductPrice = createdProduct?.product_price || null;
        } else {
          createdProduct = await productService.createProduct(payload);
          createdQuickProductRef.current = createdProduct;
        }
      }
      if (!quickFixedPriceContext) {
        const code = priceCodes.find(item => String(item.id) === String(priceCodeID));
        createdProductPrice = await productService.createPrice({
          ProductId: createdProduct.id,
          PriceCodeID: priceCodeID,
          PriceName: code?.PriceCodeName || code?.DisplayLabel || 'Price',
          ProductPrice: newProductPrice.trim(),
        });
        createdProduct = await productService.getProduct(createdProduct.id);
      }
      clearProductDraft();
      toast.success('Saved', 'Product and price saved successfully.');
      setPriceEntryOpen(false);
      returnToSalesForm(true, { ...createdProduct, product_price: createdProductPrice });
    } catch (err) {
      const data = err.response?.data;
      setPriceEntryError(data?.ProductPrice?.[0] || data?.detail || 'Failed to save product price.');
    } finally {
      priceEntrySaveRef.current = false;
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formElement = e.currentTarget?.closest?.('form') || e.currentTarget;
    if (saveInFlightRef.current || saving) return;
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      setApiError('Please correct the highlighted field.');
      requestAnimationFrame(() => {
        const first = formElement?.querySelector('[aria-invalid="true"], .is-invalid');
        first?.focus();
        first?.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      });
      return;
    }
    if (quickFixedPriceContext && !priceEntryOpen) {
      setPriceEntryError('');
      setPriceEntryOpen(true);
      return;
    }
    saveInFlightRef.current = true;
    setSaving(true); setApiError('');
    const payload = {
      ProductName:      form.ProductName.trim(),
      ProductNameTamil: form.ProductNameTamil.trim() || null,
      Units:            form.Units.trim(),
      UnitId:           form.UnitId ? parseInt(form.UnitId, 10) : null,
      Description:      form.Description.trim() || null,
      IsActive:         form.IsActive,
      GroupId:          form.GroupId ? parseInt(form.GroupId, 10) : null,
      HSNCode:          form.HSNCode.trim(),
      GSTPercent:       Number(form.GSTPercent),
    };
    if (form.Quantity !== '') payload.Quantity = parseInt(form.Quantity, 10);
    try {
      if (isEdit) {
        const updated = await productService.updateProductWithPrices(id, payload);
        setProductCode(updated.ProductCode || productCode);
        setForm(current => ({
          ...current,
          GroupId: updated.GroupId ?? '',
          ProductName: updated.ProductName ?? current.ProductName,
          ProductNameTamil: updated.ProductNameTamil ?? '',
          HSNCode: updated.HSNCode ?? '',
          GSTPercent: String(updated.GSTPercent ?? 0),
          Quantity: updated.Quantity == null ? '' : String(updated.Quantity),
          Units: updated.UnitName || updated.Units || current.Units,
          UnitId: updated.UnitId ?? current.UnitId,
          Description: updated.Description ?? '',
          IsActive: updated.IsActive ?? current.IsActive,
        }));
        clearPageCache('products');
        toast.success('Updated', 'Product updated successfully.');
        setTimeout(() => navigate('/products'), 1500);
      } else {
        const createdProduct = quickSalesReturn
          ? await productService.createProduct(payload)
          : await productService.createProductWithPrices(payload);
        suppressEmptyDraftRef.current = true;
        clearProductDraft();
        toast.success('Saved', 'Product saved successfully.');
        if (quickSalesReturn) {
          setTimeout(() => returnToSalesForm(true, createdProduct), 600);
          return;
        }
        taxValueSourceRef.current = {
          HSNCode: retainedHsn ? 'auto' : 'empty',
          GSTPercent: retainedGst ? 'auto' : 'empty',
        };
        setForm({ ...EMPTY_FORM });
        taxValueSourceRef.current = { HSNCode: 'empty', GSTPercent: 'empty' };
        setGroupTaxHint('');
        setErrors({});
        setApiError('');
        setPricingTaxInformationOpen(false);
        fetchNextCode();
        requestAnimationFrame(() => productNameRef.current?.focus());
      }
    } catch (err) {
      const data = err.response?.data;
      if (import.meta.env.DEV) {
        console.error('Product save failed', {
          url: err.config?.url || '/products/create-with-prices/',
          method: err.config?.method?.toUpperCase() || (isEdit ? 'PUT' : 'POST'),
          payload,
          status: err.response?.status,
          responseData: data,
        });
      }
      if (data && typeof data === 'object') {
        const fe = {};
        const nonField = [];
        Object.entries(data).forEach(([key, value]) => {
          const field = API_FIELD_MAP[key];
          const message = friendlyProductError(field || key, value);
          if (field) fe[field] = message;
          else if (key === 'detail' || key === 'message' || key === 'non_field_errors') nonField.push(message);
          else nonField.push(`${key}: ${message}`);
        });
        setErrors(fe);
        setApiError(nonField[0] || (Object.keys(fe).length ? 'Please correct the highlighted field.' : 'Unable to save the product. Check the highlighted fields.'));
        requestAnimationFrame(() => {
          const first = document.querySelector('form [aria-invalid="true"], form .is-invalid');
          first?.focus();
        });
      } else {
        setApiError(err.message || 'Unable to save the product. Please try again.');
      }
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  };

  if (loading) return <Layout><LoadingSpinner message="Loading product…"/></Layout>;
  const isReadOnly = isEdit && !isAdmin;

  const mobileForm = (
    <form className="product-mobile-form" onSubmit={e => e.preventDefault()} noValidate>
      <section className="product-mobile-section">
        <h3>Product Information</h3>
        <div className="product-mobile-field">
          <label style={labelStyle}>Product Name (English) <Req/></label>
          <input ref={productNameRef} name="ProductName" data-nav-order="1" type="text" className={`form-control${errors.ProductName?' is-invalid':''}`} aria-invalid={Boolean(errors.ProductName)} placeholder="Enter English name" value={form.ProductName} onChange={handleChange} disabled={isReadOnly} style={{...CI,width:'100%'}}/>
          {errors.ProductName && <div style={errStyle}>{errors.ProductName}</div>}
          <div style={{fontSize:'.65rem',color:form.ProductName.length>PRODUCT_NAME_MAX?'var(--danger)':'var(--text-muted)',textAlign:'right'}}>{form.ProductName.length}/{PRODUCT_NAME_MAX}</div>
        </div>
        <div className="product-mobile-inline-row">
        <div className="product-mobile-field">
          <label style={labelStyle}>Product Code</label>
          <input type="text" readOnly tabIndex={-1} value={productCode || 'â€¦'} style={{...CI,width:'100%',fontFamily:'ui-monospace,monospace',background:'var(--bg-soft)',color:'var(--text-muted)',cursor:'not-allowed',border:'1px solid var(--border)',borderRadius:'var(--radius)'}}/>
        </div>
        <div className="product-mobile-field product-mobile-quantity-field">
          <label style={labelStyle}>Quantity <Opt/></label>
          <input name="Quantity" data-nav-order="5" type="number" min="0" step="1" className={`form-control${errors.Quantity?' is-invalid':''}`} placeholder="Enter quantity" value={form.Quantity} onChange={handleChange} disabled={isReadOnly} style={{...CI,width:'100%'}}/>
          {errors.Quantity && <div style={errStyle}>{errors.Quantity}</div>}
        </div>
        </div>
        <div className="product-mobile-field">
          <label style={labelStyle}>Product Group <Opt/></label>
          <GroupDropdown groups={groups} value={form.GroupId ? parseInt(form.GroupId, 10) : null} onChange={v => setForm(p => ({...p, GroupId: v || ''}))} onGroupAdded={g => { setGroups(prev => prev.some(item => item.id === g.id) ? prev : [...prev, g].sort((a,b)=>a.GroupName.localeCompare(b.GroupName))); toast.success('Added', 'Product Group added successfully.'); }} onGroupSelected={handleGroupSelected} disabled={isReadOnly} error={errors.GroupId}/>
          {errors.GroupId && <div style={errStyle}>{errors.GroupId}</div>}
          {groupTaxHint && <div style={{fontSize:'.72rem',color:'var(--text-muted)',marginTop:'.3rem'}}>{groupTaxHint}</div>}
        </div>
        <div className="product-mobile-field">
          <label style={labelStyle}>Unit <Req/></label>
          <UnitDropdown units={units} value={form.UnitId} onChange={u => { setForm(p=>({...p,UnitId:u?.id || '',Units:u?.UnitName || ''})); if(errors.Units)setErrors(p=>({...p,Units:''})); }} onUnitAdded={u => { setUnits(prev => prev.some(item => item.id === u.id || (u.UQC && item.UQC && String(item.UQC).toLowerCase() === String(u.UQC).toLowerCase())) ? prev : [...prev, u].sort((a,b)=>a.UnitName.localeCompare(b.UnitName))); toast.success('Added', 'Unit added successfully.'); }} onUnitsChanged={list => setUnits(list)} disabled={isReadOnly} error={errors.Units}/>
          {errors.Units && <div style={errStyle}>{errors.Units}</div>}
        </div>
        <div className="product-mobile-field">
          <label style={labelStyle}>Product Name (Tamil) <Opt/></label>
          <input name="ProductNameTamil" data-nav-order="4" type="text" className={`form-control${errors.ProductNameTamil?' is-invalid':''}`} aria-invalid={Boolean(errors.ProductNameTamil)} placeholder="Tamil product name" value={form.ProductNameTamil} onChange={handleChange} disabled={isReadOnly} lang="ta" style={{...CI,width:'100%'}}/>
          {errors.ProductNameTamil && <div style={errStyle}>{errors.ProductNameTamil}</div>}
        </div>
        <div className="product-mobile-field">
          <label style={labelStyle}>Description <Opt/></label>
          <textarea name="Description" data-nav-order="8" className="form-control" placeholder="Brief product description" value={form.Description} onChange={handleChange} onKeyDown={handleDescriptionKeyDown} disabled={isReadOnly} style={{width:'100%',fontSize:'.82rem',resize:'vertical',minHeight:64,padding:'.5rem .65rem'}}/>
          {errors.Description && <div style={errStyle}>{errors.Description}</div>}
        </div>
      </section>

      <section className="product-mobile-section product-mobile-accordion-section">
        <div className="product-mobile-section-header">
          <h3>Pricing &amp; Tax Information</h3>
          <button
            type="button"
            className="product-mobile-section-toggle"
            aria-label={`${pricingTaxInformationOpen ? 'Collapse' : 'Expand'} Pricing and Tax Information`}
            aria-expanded={pricingTaxInformationOpen}
            onClick={() => setPricingTaxInformationOpen(open => !open)}
          >
            {pricingTaxInformationOpen ? '\u2212' : '+'}
          </button>
        </div>
        {pricingTaxInformationOpen && <div className="product-mobile-section-body">
        <div className="product-mobile-inline-row product-mobile-tax-row">
        <div className="product-mobile-field">
          <label style={labelStyle}>HSN Code <Req/></label>
          <input name="HSNCode" data-nav-order="6" type="text" className={`form-control${errors.HSNCode?' is-invalid':''}`} aria-invalid={Boolean(errors.HSNCode)} placeholder="Enter HSN code" value={form.HSNCode} onChange={handleChange} disabled={isReadOnly} style={{...CI,width:'100%'}}/>
          {errors.HSNCode && <div style={errStyle}>{errors.HSNCode}</div>}
        </div>
        <div className="product-mobile-field">
          <label style={labelStyle}>GST Percentage <Req/></label>
          <input name="GSTPercent" data-nav-order="7" type="number" min="0" max="100" step="1" className={`form-control${errors.GSTPercent?' is-invalid':''}`} aria-invalid={Boolean(errors.GSTPercent)} placeholder="Enter GST percentage" value={form.GSTPercent} onChange={handleChange} disabled={isReadOnly} style={{...CI,width:'100%'}}/>
          {errors.GSTPercent && <div style={errStyle}>{errors.GSTPercent}</div>}
        </div>
        </div>
        </div>}
      </section>

      <div className="product-form-actions">
        <div className="secondary-action-row">
        {!isEdit && <button type="button" className="btn btn-outline-secondary reset-button" onClick={requestReset} disabled={saving}>Reset</button>}
        <button type="button" className="btn btn-outline-secondary cancel-button" onClick={() => quickSalesReturn ? returnToSalesForm() : navigate('/products')} disabled={saving}>Cancel</button>
        </div>
        <div className="primary-action-row">
        {!isReadOnly && <button type="button" data-save-action="true" className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? <><Spin/> Savingâ€¦</> : (isEdit ? 'Update Product' : 'Save Product')}</button>}
      </div>
      </div>
    </form>
  );

  return (
    <Layout>
      {resetConfirmOpen && isNewProductRoute && (
        <div data-product-reset-confirm="true" style={{position:'fixed',inset:0,zIndex:99600,background:'rgba(0,0,0,.4)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
          <div role="dialog" aria-modal="true" aria-labelledby="product-reset-title" style={{width:'min(360px,94vw)',padding:'1rem',background:'var(--card-bg)',borderRadius:10,boxShadow:'0 12px 36px rgba(0,0,0,.22)'}}>
            <div id="product-reset-title" style={{fontWeight:800,color:'var(--text-primary)',fontSize:'.9rem',marginBottom:'.8rem'}}>Clear all entered product details?</div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:'.5rem'}}>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setResetConfirmOpen(false)}>No</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={performReset}>Yes, Reset</button>
            </div>
          </div>
        </div>
      )}
      {priceEntryOpen && quickFixedPriceContext && (
        <div data-price-entry-popup="true" onClick={()=>{if(!saving)setPriceEntryOpen(false);}}
          style={{position:'fixed',inset:0,zIndex:99600,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'var(--card-bg)',borderRadius:12,boxShadow:'0 16px 48px rgba(0,0,0,.28)',padding:'1.25rem 1.375rem',width:'min(420px,96vw)',border:`1.5px solid ${BRAND}`}}>
            <h3 style={{margin:'0 0 1rem',fontSize:'.95rem',fontFamily:'var(--font-heading)',color:'var(--text-primary)'}}>Set Price for New Product</h3>
            <div style={{marginBottom:'.65rem'}}>
              <label style={labelStyle}>Product Name</label>
              <input type="text" value={form.ProductName} readOnly style={{...CI,width:'100%',background:'var(--bg-soft)',border:'1.5px solid var(--border-input)',borderRadius:6}}/>
            </div>
            <div style={{marginBottom:'.65rem'}}>
              <label style={labelStyle}>Price Code</label>
              {quickFixedPriceContext ? (
                <input type="text" value={location.state?.salesDraft?.priceConfig?.FixedLabel || location.state?.salesDraft?.priceConfig?.FixedPriceCodeName || 'Fixed'} readOnly style={{...CI,width:'100%',background:'var(--bg-soft)',border:'1.5px solid var(--border-input)',borderRadius:6}}/>
              ) : (
                <select ref={priceCodeEntryRef} value={selectedPriceCodeID} onChange={e=>setSelectedPriceCodeID(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();priceEntryRef.current?.focus();}}}
                  style={{...CI,width:'100%',background:'var(--card-bg)',border:'1.5px solid var(--border-input)',borderRadius:6}}>
                  <option value="">Select Price Code</option>
                  {priceCodes.filter(code => code.PriceCodeName !== 'Select').map(code => (
                    <option key={code.id} value={code.id}>{code.PriceCodeName === 'Retail' ? 'Retail' : `Price ${code.PriceCodeName}`}</option>
                  ))}
                </select>
              )}
            </div>
            <div style={{marginBottom:'.65rem'}}>
              <label style={labelStyle}>Price <Req/></label>
              <input ref={priceEntryRef} type="text" inputMode="decimal" value={newProductPrice}
                placeholder="0.00" onChange={handleNewProductPriceChange}
                onFocus={() => { if (/^0+$/.test(newProductPrice)) setNewProductPrice(''); }}
                onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();saveQuickProductWithPrice();}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!saving)setPriceEntryOpen(false);}if(e.altKey&&!e.ctrlKey&&!e.metaKey&&e.key.toLowerCase()==='s'){e.preventDefault();e.stopPropagation();if(!e.repeat)saveQuickProductWithPrice();}}}
                style={{...CI,width:'100%',border:`1.5px solid ${priceEntryError?'var(--danger)':'var(--border-input)'}`,borderRadius:6}}/>
              {priceEntryError && <div style={errStyle}>{priceEntryError}</div>}
            </div>
            <div style={{display:'flex',gap:'.625rem',justifyContent:'flex-end',marginTop:'.875rem'}}>
              <button type="button" onClick={()=>setPriceEntryOpen(false)} disabled={saving} style={{padding:'.45rem 1rem',borderRadius:7,border:'1.5px solid var(--border-input)',background:'transparent',cursor:'pointer',fontSize:'.82rem',fontWeight:600}}>Cancel</button>
              <button type="button" data-save-action="true" onClick={saveQuickProductWithPrice} disabled={saving}
                style={{padding:'.45rem 1.125rem',borderRadius:7,border:'none',background:BRAND,color:'#fff',fontWeight:700,cursor:saving?'not-allowed':'pointer',fontSize:'.82rem'}}>
                {saving?'Saving…':'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {isMobile ? (
        <div className="product-mobile-title-row">
          <h2>{isEdit ? (isAdmin ? 'Edit Product Details' : 'View Product Details') : 'Add Product Details'}</h2>
          <div className="product-mobile-title-status">
            <span>STATUS</span>
            <Toggle value={form.IsActive} onChange={v => setForm(p => ({...p, IsActive:v}))} disabled={isReadOnly}/>
          </div>
        </div>
      ) : (
        <div className="page-header product-page-header professional-form-title-card animate-in">
          <div>
            <h2 style={{fontFamily:'var(--font-heading)',fontWeight:800}}>
              {isEdit ? (isAdmin ? 'Edit Product Details' : 'View Product Details') : 'Add Product Details'}
            </h2>
            <p className="page-header-sub">
              {isEdit ? (isAdmin ? 'Update product details' : 'Viewing product (read-only)') : 'Add a new product'}
            </p>
          </div>
          <div className="product-header-status" style={{display:'flex',alignItems:'center',gap:'.5rem'}}>
            <span style={{fontSize:'.72rem',fontWeight:700,color:'var(--text-muted)'}}>Status</span>
            <Toggle value={form.IsActive} onChange={v => setForm(p => ({...p, IsActive:v}))} disabled={isReadOnly}/>
          </div>
        </div>
      )}

      {apiError && <div className="alert alert-warning animate-in"><span>⚠️</span><span>{apiError}</span></div>}

      {isMobile ? mobileForm : (
        <form className="professional-form-layout product-professional-form" onSubmit={e => e.preventDefault()} noValidate>
        <div className="card animate-in animate-in-1 professional-form-container product-form-container" style={{marginBottom:'1rem'}}>
          <div className="card-body professional-form-content" style={{padding:'.875rem 1.25rem'}}>
            <div className="professional-section-title product-section-information">Product Information</div>

            {/* Row 1: Product Name | Product Code */}
            <div className="product-form-row product-form-name-code" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem',marginBottom:'.65rem'}}>
              <div className="product-field product-field-name">
                <label style={labelStyle}>Product Name (Eng) <Req/></label>
                <input ref={productNameRef} name="ProductName" data-nav-order="1" type="text"
                  className={`form-control${errors.ProductName?' is-invalid':''}`}
                  aria-invalid={Boolean(errors.ProductName)}
                  placeholder="Enter English name"
                  value={form.ProductName} onChange={handleChange} disabled={isReadOnly}
                  style={{...CI, width:'100%'}}/>
                {errors.ProductName && <div style={errStyle}>{errors.ProductName}</div>}
                <div style={{fontSize:'.65rem',color:form.ProductName.length>PRODUCT_NAME_MAX?'var(--danger)':'var(--text-muted)',textAlign:'right'}}>
                  {form.ProductName.length}/{PRODUCT_NAME_MAX}
                </div>
              </div>
              <div className="product-field product-field-code">
                <label style={labelStyle}>Product Code</label>
                <input type="text" readOnly tabIndex={-1} value={productCode || '…'}
                  style={{...CI,width:'100%',fontFamily:'ui-monospace,monospace',background:'var(--bg-soft)',color:'var(--text-muted)',cursor:'not-allowed',border:'1px solid var(--border)',borderRadius:'var(--radius)'}}/>
              </div>
            </div>

            {/* Row 2: Product Group + (+) */}
            <div className="product-field product-field-group" style={{marginBottom:'.65rem'}}>
              <label style={labelStyle}>Product Group <Opt/></label>
              <GroupDropdown
                groups={groups}
                value={form.GroupId ? parseInt(form.GroupId, 10) : null}
                onChange={v => setForm(p => ({...p, GroupId: v || ''}))}
                onGroupAdded={g => {
                  setGroups(prev => (
                    prev.some(item => item.id === g.id)
                      ? prev
                      : [...prev, g].sort((a,b) => a.GroupName.localeCompare(b.GroupName))
                  ));
                  toast.success('Added', 'Product Group added successfully.');
                }}
                onGroupSelected={handleGroupSelected}
                disabled={isReadOnly}
                error={errors.GroupId}/>
              {errors.GroupId && <div style={errStyle}>{errors.GroupId}</div>}
              {groupTaxHint && <div style={{fontSize:'.72rem',color:'var(--text-muted)',marginTop:'.3rem'}}>{groupTaxHint}</div>}
            </div>

            {/* Row 3: Tamil Name | Unit (+) */}
            <div className="product-form-row product-form-tamil-unit" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem',marginBottom:'.65rem'}}>
              <div className="product-field product-field-tamil">
                <label style={labelStyle}>Product Name (Tamil) <Opt/></label>
                <input name="ProductNameTamil" data-nav-order="4" type="text" className={`form-control${errors.ProductNameTamil?' is-invalid':''}`}
                  aria-invalid={Boolean(errors.ProductNameTamil)}
                  placeholder="தமிழில் பொருளின் பெயர்"
                  value={form.ProductNameTamil} onChange={handleChange} disabled={isReadOnly}
                  lang="ta" style={{...CI, width:'100%'}}/>
                {errors.ProductNameTamil && <div style={errStyle}>{errors.ProductNameTamil}</div>}
              </div>
              <div className="product-field product-field-unit">
                <label style={labelStyle}>Unit <Req/></label>
                <UnitDropdown
                  units={units}
                  value={form.UnitId}
                  onChange={u => {
                    setForm(p=>({...p,UnitId:u?.id || '',Units:u?.UnitName || ''}));
                    if(errors.Units)setErrors(p=>({...p,Units:''}));
                  }}
          onUnitAdded={u => {
            setUnits(prev => (
              prev.some(item => item.id === u.id
                || (u.UQC && item.UQC && String(item.UQC).toLowerCase() === String(u.UQC).toLowerCase()))
                ? prev
                : [...prev, u].sort((a,b)=>a.UnitName.localeCompare(b.UnitName))
                    ));
                    toast.success('Added', 'Unit added successfully.');
                  }}
                  onUnitsChanged={list => setUnits(list)}
                  disabled={isReadOnly}
                  error={errors.Units}/>
                {errors.Units && <div style={errStyle}>{errors.Units}</div>}
              </div>
            </div>

            {/* Row 4: Quantity */}
            <div className="product-form-row product-form-quantity-description" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem',marginBottom:'.65rem'}}>
              <div className="product-field product-field-quantity">
                <label style={labelStyle}>Quantity <Opt/></label>
                <input name="Quantity" data-nav-order="5" type="number" min="0" step="1"
                  className={`form-control${errors.Quantity?' is-invalid':''}`}
                  placeholder="Enter quantity"
                  value={form.Quantity} onChange={handleChange} disabled={isReadOnly}
                  style={{...CI, width:'100%'}}/>
                {errors.Quantity && <div style={errStyle}>{errors.Quantity}</div>}
              </div>
              {false && (<div className="product-field product-field-description">
                <label style={labelStyle}>Description <Opt/></label>
                <textarea name="Description" className="form-control"
                  placeholder="Brief product description…"
                  value={form.Description} onChange={handleChange} disabled={isReadOnly}
                  style={{width:'100%',fontSize:'.82rem',resize:'none',height:34,padding:'.3rem .65rem'}}/>
                {errors.Description && <div style={errStyle}>{errors.Description}</div>}
              </div>)}
            </div>

            <div className="professional-section-title product-section-tax">Pricing &amp; Tax Information</div>
            {/* Row 5: HSN | GST % */}
              <div className="product-form-row product-form-tax" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem',marginBottom:'.65rem'}}>
                <div className="product-field product-field-hsn">
                  <label style={labelStyle}>HSN <Req/></label>
                  <input name="HSNCode" data-nav-order="6" type="text" className={`form-control${errors.HSNCode?' is-invalid':''}`}
                    aria-invalid={Boolean(errors.HSNCode)}
                    placeholder="Enter HSN code"
                    value={form.HSNCode} onChange={handleChange} disabled={isReadOnly}
                    style={{...CI, width:'100%'}}/>
                  {errors.HSNCode && <div style={errStyle}>{errors.HSNCode}</div>}
                </div>
                <div className="product-field product-field-gst">
                  <label style={labelStyle}>GST Percentage <Req/></label>
                  <input name="GSTPercent" data-nav-order="7" type="number" min="0" max="100" step="1"
                    className={`form-control${errors.GSTPercent?' is-invalid':''}`}
                    aria-invalid={Boolean(errors.GSTPercent)}
                    placeholder="Enter GST percentage"
                    value={form.GSTPercent} onChange={handleChange} disabled={isReadOnly}
                    style={{...CI, width:'100%'}}/>
                  {errors.GSTPercent && <div style={errStyle}>{errors.GSTPercent}</div>}
                </div>
              </div>

            <div className="professional-section-title product-section-additional">Additional Information</div>

            <div className="product-field product-field-description">
              <label style={labelStyle}>Description <Opt/></label>
              <textarea name="Description" data-nav-order="8" className="form-control"
                placeholder="Brief product description"
                value={form.Description} onChange={handleChange} onKeyDown={handleDescriptionKeyDown} disabled={isReadOnly}
                style={{width:'100%',fontSize:'.82rem',resize:'vertical',minHeight:64,padding:'.5rem .65rem'}}/>
              {errors.Description && <div style={errStyle}>{errors.Description}</div>}
            </div>

            {/* Pricing hint */}
            {isEdit && isAdmin && (
              <div style={{padding:'.5rem .75rem',background:'#e3f2fd',borderRadius:6,fontSize:'.78rem',color:'#1565c0',fontWeight:600,marginTop:'.4rem'}}>
                💡 To set product rates, go to <strong>Masters → Price Code List</strong>.
              </div>
            )}

            {/* Audit trail */}
            {isEdit && createdInfo && (
              <div style={{marginTop:'.65rem',padding:'.45rem .75rem',background:'var(--bg-soft)',
                borderRadius:'var(--radius)',fontSize:'.73rem',color:'var(--text-muted)',display:'flex',gap:'2rem',flexWrap:'wrap'}}>
                <span>Created by: <strong>{createdInfo.CreatedBy}</strong></span>
                <span>Created on: <strong>{createdInfo.CreatedOn ? new Date(createdInfo.CreatedOn).toLocaleString('en-IN') : '—'}</strong></span>
              </div>
            )}
          </div>
        </div>

        <div className="form-actions-bar professional-form-action-footer animate-in">
          {!isEdit && <button type="button" className="btn btn-outline-secondary" onClick={requestReset} disabled={saving}>
            Reset
          </button>}
          <button type="button" className="btn btn-outline-secondary"
            onClick={() => quickSalesReturn ? returnToSalesForm() : navigate('/products')} disabled={saving}>
            Cancel
          </button>
          {!isReadOnly && (
            <button type="button" data-save-action="true" className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? <><Spin/> Saving…</> : (isEdit ? 'Update Product' : 'Save Product')}
            </button>
          )}
        </div>
        </form>
      )}
    </Layout>
  );
};

export default ProductForm;
