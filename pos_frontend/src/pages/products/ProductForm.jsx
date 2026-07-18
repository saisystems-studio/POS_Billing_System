import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Layout from '../../components/Layout';
import LoadingSpinner from '../../components/LoadingSpinner';
import productService from '../../services/productService';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';

const BRAND = '#8A5125';
const Req   = () => <span style={{color:'var(--danger)',marginLeft:2}}>*</span>;
const Opt   = () => <span style={{color:'var(--text-muted)',fontWeight:400,marginLeft:4,fontSize:'.73rem'}}>(optional)</span>;
const Spin  = () => <span style={{display:'inline-block',width:14,height:14,border:'2px solid rgba(255,255,255,.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .6s linear infinite',flexShrink:0}}/>;
const CI    = { height:34, padding:'.3rem .65rem', fontSize:'.82rem' };
const errStyle   = { fontSize:'.67rem', color:'var(--danger)', marginTop:'.18rem', fontWeight:500 };
const labelStyle = { display:'block', fontWeight:700, fontSize:'.72rem', color:'var(--text-label)', marginBottom:'.22rem' };

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
  const ref = useRef(null);
  const inputRef = useRef(null);
  const allUQC = [...new Set(units.map(u => String(u.UQC || '').trim().toUpperCase()).filter(Boolean))].sort();
  const filtered = q.trim() ? allUQC.filter(u => u.toLowerCase().includes(q.toLowerCase())) : allUQC;

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
        onChange={e=>{setQ(e.target.value.toUpperCase());setOpen(true);onChange('');}}
        onFocus={()=>setOpen(true)}
        onBlur={()=>setTimeout(()=>{ setOpen(false); if (!value) setQ(''); else setQ(value); }, 120)}/>
      <span style={{position:'absolute',right:'.5rem',top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:'var(--text-muted)',fontSize:'.6rem'}}>v</span>
      {open && filtered.length > 0 && (
        <ul style={{position:'absolute',top:'100%',left:0,right:0,zIndex:99999,
          background:'#fff',border:`1.5px solid ${BRAND}`,borderTop:'none',borderRadius:'0 0 6px 6px',
          boxShadow:'0 6px 20px rgba(0,0,0,.14)',maxHeight:160,overflowY:'auto',margin:0,padding:0,listStyle:'none'}}>
          {filtered.map(u => (
            <li key={u} onMouseDown={()=>{onChange(u);setQ(u);setOpen(false);}}
              style={{padding:'.3rem .65rem',fontSize:'.8rem',cursor:'pointer',
                background:value===u?'var(--primary-light)':'transparent',fontWeight:value===u?700:400}}
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
  const [decimal,  setDecimal]  = useState('0');
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');

  const save = async () => {
    const n = unitName.trim();
    const u = uqc.trim().toUpperCase();
    if (!n) { setErr('Unit name is required.'); return; }
    if (!u) { setErr('UQC Code is required.'); return; }
    if (decimal === '') { setErr('Decimal is required.'); return; }
    if (isNaN(parseFloat(decimal))) { setErr('Decimal must be a valid number.'); return; }
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
      const created = await productService.createUnit({ UnitName: n, UQC: u, Decimal: parseFloat(decimal || '0') > 0 });
      onSaved(created);
    } catch (e) {
      const d = e.response?.data;
      setErr(d?.UnitName?.[0] || d?.UQC?.[0] || d?.Decimal?.[0] || d?.detail || 'Failed to create unit.');
    } finally { setSaving(false); }
  };

  return createPortal(
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:99500,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'var(--card-bg)',borderRadius:12,boxShadow:'0 16px 48px rgba(0,0,0,.28)',padding:'1.25rem 1.375rem',width:'min(400px,96vw)',border:`1.5px solid ${BRAND}`}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
          <span style={{fontWeight:800,fontSize:'.95rem',color:'var(--text-primary)',fontFamily:'var(--font-heading)'}}>Unit Entry</span>
          <button onClick={onClose} style={{background:'var(--scale-100)',border:'none',borderRadius:6,width:28,height:28,cursor:'pointer',color:'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
        </div>
        <div style={{marginBottom:'.65rem'}}>
          <label style={labelStyle}>UQC Code <span style={{color:'var(--danger)'}}>*</span></label>
          <input type="text" placeholder="e.g. PCS, KG, LTR" value={uqc}
            onChange={e=>{setUqc(e.target.value.toUpperCase());setErr('');}}
            onKeyDown={e=>{if(e.key==='Enter')save();if(e.key==='Escape')onClose();}}
            style={{...CI,width:'100%',border:`1.5px solid ${err?'var(--danger)':BRAND}`,borderRadius:6}}/>
          {err && <div style={errStyle}>{err}</div>}
        </div>
        <div style={{marginBottom:'.65rem'}}>
          <label style={labelStyle}>Unit Name <span style={{color:'var(--danger)'}}>*</span></label>
          <input type="text" placeholder="e.g. Kilograms, Pieces, Litres" value={unitName}
            onChange={e=>{setUnitName(e.target.value);setErr('');}}
            onKeyDown={e=>{if(e.key==='Enter')save();if(e.key==='Escape')onClose();}}
            style={{...CI,width:'100%',border:`1.5px solid ${err?'var(--danger)':BRAND}`,borderRadius:6}}/>
        </div>
        <div style={{marginBottom:'.875rem'}}>
          <label style={labelStyle}>Decimal <span style={{color:'var(--danger)'}}>*</span></label>
          <input type="text" inputMode="decimal" placeholder="0" value={decimal}
            onChange={e=>{setDecimal(e.target.value.replace(/[^0-9.]/g,'').replace(/(\..*)\./g,'$1'));setErr('');}}
            onKeyDown={e=>{if(e.key==='Enter')save();if(e.key==='Escape')onClose();}}
            style={{...CI,width:'100%',border:'1.5px solid var(--border-input)',borderRadius:6}}/>
        </div>        <div style={{display:'flex',gap:'.625rem',justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'.45rem 1rem',borderRadius:7,border:'1.5px solid var(--border-input)',background:'transparent',cursor:'pointer',fontSize:'.82rem',fontWeight:600}}>Cancel</button>
          <button onClick={save} disabled={saving}
            style={{padding:'.45rem 1.125rem',borderRadius:7,border:'none',background:BRAND,color:'#fff',fontWeight:700,cursor:saving?'not-allowed':'pointer',fontSize:'.82rem',display:'flex',alignItems:'center',gap:'.35rem',opacity:saving?.65:1}}>
            {saving?<Spin/>:'✓'} Save
          </button>
        </div>
      </div>
    </div>, document.body
  );
};

/* ── Group popup modal (centered, with HSN + GST) ── */
const GroupPopup = ({ onClose, onSaved }) => {
  const [groupName, setGroupName] = useState('');
  const [hsn,       setHsn]       = useState('');
  const [gst,       setGst]       = useState('');
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState('');
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  const save = async () => {
    const n = groupName.trim();
    if (!n) { setErr('Group name is required.'); return; }
    if (!hsn.trim()) { setErr('HSN Code is required.'); return; }
    if (!String(gst).trim()) { setErr('GST % is required.'); return; }
    if (!/^\d+$/.test(String(gst).trim()) || Number(gst) < 0 || Number(gst) > 100) {
      setErr('GST % must be a valid number between 0 and 100.');
      return;
    }
    setSaving(true); setErr('');
    try {
      const res = await api.post('/product-groups/', {
        GroupName: n,
        HSNCode: hsn.trim(),
        GSTPercent: Number(gst),
      });
      onSaved(res.data);
    } catch (e) {
      const d = e.response?.data;
      setErr(d?.GroupName?.[0] || d?.detail || 'Failed to save group.');
    } finally { setSaving(false); }
  };

  return createPortal(
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:99500,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'var(--card-bg)',borderRadius:12,boxShadow:'0 16px 48px rgba(0,0,0,.28)',padding:'1.25rem 1.375rem',width:'min(420px,96vw)',border:`1.5px solid ${BRAND}`}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
          <span style={{fontWeight:800,fontSize:'.95rem',color:'var(--text-primary)',fontFamily:'var(--font-heading)'}}>Add Product Group</span>
          <button onClick={onClose} style={{background:'var(--scale-100)',border:'none',borderRadius:6,width:28,height:28,cursor:'pointer',color:'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
        </div>
        <div style={{marginBottom:'.65rem'}}>
          <label style={labelStyle}>Group Name <span style={{color:'var(--danger)'}}>*</span></label>
          <input ref={inputRef} type="text" placeholder="e.g. Beverages, Dairy…" value={groupName}
            onChange={e=>{setGroupName(e.target.value);setErr('');}}
            onKeyDown={e=>{if(e.key==='Enter')save();if(e.key==='Escape')onClose();}}
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
          <button onClick={onClose} style={{padding:'.45rem 1rem',borderRadius:7,border:'1.5px solid var(--border-input)',background:'transparent',cursor:'pointer',fontSize:'.82rem',fontWeight:600}}>Cancel</button>
          <button onClick={save} disabled={saving}
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
  const [showPopup,setShowPopup]= useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

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

  const filtered = q.trim() ? groups.filter(g => g.GroupName.toLowerCase().includes(q.toLowerCase())) : groups;

  const pick = (g) => {
    onChange(g.id);
    setQ(g.GroupName);
    setOpen(false);
    onGroupSelected && onGroupSelected(g);
  };

  return (
    <div ref={ref}>
      <div style={{display:'flex',alignItems:'center',gap:'.4rem'}}>
        <div style={{position:'relative',flex:1}}>
          <input ref={inputRef} type="text" autoComplete="off"
            className={`form-control${error?' is-invalid':''}`}
            placeholder="Search or select group…"
            value={q} disabled={disabled}
            style={{...CI,width:'100%',paddingRight:'1.6rem'}}
            onChange={e=>{setQ(e.target.value);setOpen(true);if(!e.target.value){onChange(null);onGroupSelected&&onGroupSelected(null);}}}
            onFocus={()=>setOpen(true)}
            onBlur={()=>setTimeout(()=>{
              setOpen(false);
              const ex=groups.find(g=>g.GroupName.toLowerCase()===q.toLowerCase());
              if(ex){setQ(ex.GroupName);onChange(ex.id);onGroupSelected&&onGroupSelected(ex);}
              else if(!sel)setQ('');
            },160)}/>
          <span style={{position:'absolute',right:'.5rem',top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:'var(--text-muted)',fontSize:'.6rem'}}>▾</span>
          {open && filtered.length > 0 && (
            <ul style={{position:'absolute',top:'100%',left:0,right:0,zIndex:9999,
              background:'var(--card-bg)',border:'1.5px solid var(--primary)',borderTop:'none',
              borderRadius:'0 0 6px 6px',boxShadow:'0 6px 20px rgba(0,0,0,.12)',
              maxHeight:200,overflowY:'auto',margin:0,padding:0,listStyle:'none'}}>
              {filtered.map(g => (
                <li key={g.id} onMouseDown={()=>pick(g)}
                  style={{padding:'.38rem .65rem',fontSize:'.81rem',cursor:'pointer',
                    background:value===g.id?'var(--primary-light)':'transparent',fontWeight:value===g.id?700:400}}
                  onMouseEnter={e=>{if(value!==g.id)e.currentTarget.style.background='var(--scale-50)';}}
                  onMouseLeave={e=>{if(value!==g.id)e.currentTarget.style.background='transparent';}}>
                  <span>{g.GroupName}</span>
                  {(g.HSNCode||g.GSTPercent>0)&&<span style={{marginLeft:'.5rem',fontSize:'.68rem',color:'var(--text-muted)'}}>
                    {g.HSNCode&&`HSN:${g.HSNCode}`}{g.HSNCode&&g.GSTPercent>0&&' · '}{g.GSTPercent>0&&`GST:${g.GSTPercent}%`}
                  </span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        {!disabled && (
          <button type="button" title="Add new group" onClick={()=>setShowPopup(true)}
            style={{width:28,height:28,borderRadius:6,background:'var(--primary-light)',
              border:`1px solid ${BRAND}`,color:BRAND,fontWeight:800,fontSize:'1rem',
              cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
        )}
      </div>
      {showPopup && (
        <GroupPopup
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
  const [showPopup,setShowPopup]= useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

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

  const filtered = q.trim()
    ? units.filter(u =>
        u.UnitName.toLowerCase().includes(q.toLowerCase()) ||
        String(u.UQC || '').toLowerCase().includes(q.toLowerCase()) ||
        unitLabel(u).toLowerCase().includes(q.toLowerCase()))
    : units;
  const pick = (u) => {
    onChange(u);
    setQ(unitLabel(u));
    setOpen(false);
  };

  return (
    <div ref={ref}>
      <div style={{display:'flex',alignItems:'center',gap:'.4rem'}}>
        <div style={{position:'relative',flex:1}}>
          <input ref={inputRef} type="text" autoComplete="off"
            className={`form-control${error?' is-invalid':''}`}
            placeholder="pcs  kg  litre  dozen…"
            value={q} disabled={disabled}
            style={{...CI,width:'100%',paddingRight:'1.6rem'}}
            onChange={e=>{setQ(e.target.value);setOpen(true);onChange(null);}}
            onFocus={()=>setOpen(true)}
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
            <ul style={{position:'absolute',top:'100%',left:0,right:0,zIndex:9999,
              background:'var(--card-bg)',border:'1.5px solid var(--primary)',borderTop:'none',
              borderRadius:'0 0 6px 6px',boxShadow:'0 6px 20px rgba(0,0,0,.12)',
              maxHeight:200,overflowY:'auto',margin:0,padding:0,listStyle:'none'}}>
              {filtered.map(u => (
                <li key={u.id} onMouseDown={()=>pick(u)}
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
          <button type="button" title="Add new unit" onClick={()=>setShowPopup(true)}
            style={{width:28,height:28,borderRadius:6,background:'var(--primary-light)',
              border:`1px solid ${BRAND}`,color:BRAND,fontWeight:800,fontSize:'1rem',
              cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
        )}
      </div>
      {showPopup && (
        <UnitPopup
          units={units}
          onClose={()=>setShowPopup(false)}
          onSaved={async u=>{
            let picked = u;
            try {
              const latest = await productService.getUnits();
              const sorted = (Array.isArray(latest) ? latest : []).sort((a,b)=>a.UnitName.localeCompare(b.UnitName));
              picked = sorted.find(x => x.id === u.id) || u;
              onUnitAdded(picked);
              if (typeof onUnitsChanged === 'function') onUnitsChanged(sorted);
            } catch {
              onUnitAdded(u);
            }
            onChange(picked);
            setQ(unitLabel(picked));
            setShowPopup(false);
          }}/>
      )}
    </div>
  );
};

const EMPTY_FORM = {
  GroupId:'', ProductName:'', ProductNameTamil:'',
  HSNCode:'', GSTPercent:'0',
  Quantity:'', Units:'', UnitId:'', Description:'', IsActive:true,
};

const ProductForm = () => {
  const navigate    = useNavigate();
  const location    = useLocation();
  const { id }      = useParams();
  const { isAdmin } = useAuth();
  const { isGSTRegistered } = useCompany();
  const toast       = useToast();
  const isEdit      = id !== undefined && id !== 'new';
  const quickSalesReturn = location.state?.returnToSales && location.state?.salesDraft;
  const returnToSalesForm = useCallback(() => {
    navigate(location.state?.returnPath || '/billing/new', {
      state: { restoreSalesDraft: location.state?.salesDraft },
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

  useEffect(() => { if (!isEdit) fetchNextCode(); }, [isEdit, fetchNextCode]);

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
          HSNCode:          data.HSNCode || '',
          GSTPercent:       data.GSTPercent != null ? String(data.GSTPercent) : '0',
          Quantity:         data.Quantity != null ? String(data.Quantity) : '',
          Units:            data.UnitName || data.Units || '',
          UnitId:           data.UnitId || '',
          Description:      data.Description || '',
          IsActive:         data.IsActive !== undefined ? data.IsActive : true,
        });
        setCreatedInfo({ CreatedBy: data.CreatedByUsername || '', CreatedOn: data.CreatedOn });
      } catch (err) {
        setApiError(err.response?.data?.detail || 'Failed to load product.');
      } finally { setLoading(false); }
    };
    load();
  }, [id, isEdit]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm(p => ({...p, [name]: value}));
    if (errors[name]) setErrors(p => ({...p, [name]: ''}));
    if (apiError) setApiError('');
  }, [errors, apiError]);

  /* When a group is selected, auto-fill HSN and GST if the group has them */
  const handleGroupSelected = useCallback((g) => {
    if (!g) return;
    setForm(p => ({
      ...p,
      HSNCode:    g.HSNCode  || p.HSNCode,
      GSTPercent: g.GSTPercent != null && g.GSTPercent > 0 ? String(g.GSTPercent) : p.GSTPercent,
    }));
  }, []);

  const validate = () => {
    const e = {};
    if (!form.ProductName.trim()) e.ProductName = 'Product name is required.';
    if (!form.UnitId) e.Units = 'Select a Unit/UQC from the list.';
    if (isGSTRegistered && !form.HSNCode.trim()) e.HSNCode = 'HSN Code is required.';
    if (form.Quantity !== '' && (isNaN(parseInt(form.Quantity, 10)) || parseInt(form.Quantity, 10) < 0))
      e.Quantity = 'Enter a valid non-negative number.';
    if (isGSTRegistered) {
      const gp = parseInt(form.GSTPercent, 10);
      if (isNaN(gp) || gp < 0 || gp > 100) e.GSTPercent = 'GST % must be 0–100.';
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true); setApiError('');
    const payload = {
      ProductName:      form.ProductName.trim(),
      ProductNameTamil: form.ProductNameTamil.trim() || null,
      Units:            form.Units.trim(),
      UnitId:           form.UnitId ? parseInt(form.UnitId, 10) : null,
      Description:      form.Description.trim() || null,
      IsActive:         form.IsActive,
      GroupId:          form.GroupId ? parseInt(form.GroupId, 10) : null,
      HSNCode:          isGSTRegistered ? form.HSNCode.trim() : null,
      GSTPercent:       isGSTRegistered ? (parseInt(form.GSTPercent, 10) || 0) : 0,
    };
    if (form.Quantity !== '') payload.Quantity = parseInt(form.Quantity, 10);
    try {
      if (isEdit) {
        await productService.updateProductWithPrices(id, payload);
        toast.success('Updated', 'Product updated successfully.');
        setTimeout(() => navigate('/products'), 1500);
      } else {
        await productService.createProductWithPrices(payload);
        toast.success('Saved', 'Product saved successfully.');
        if (quickSalesReturn) {
          setTimeout(returnToSalesForm, 600);
          return;
        }
        setForm({ ...EMPTY_FORM, GroupId: form.GroupId });
        setErrors({});
        setApiError('');
        fetchNextCode();
      }
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const fe = {};
        Object.entries(data).forEach(([k, v]) => { fe[k] = Array.isArray(v) ? v[0] : v; });
        setErrors(fe); setApiError('Please fix the errors below.');
      } else { setApiError(data?.detail || 'Failed to save.'); }
    } finally { setSaving(false); }
  };

  if (loading) return <Layout><LoadingSpinner message="Loading product…"/></Layout>;
  const isReadOnly = isEdit && !isAdmin;

  return (
    <Layout>
      <div className="page-header animate-in">
        <div>
          <h2 style={{fontFamily:'var(--font-heading)',fontWeight:800}}>
            {isEdit ? (isAdmin ? 'Edit Product' : 'View Product') : 'Add Product'}
          </h2>
          <p className="page-header-sub">
            {isEdit ? (isAdmin ? 'Update product details' : 'Viewing product (read-only)') : 'Add a new product'}
          </p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'.5rem'}}>
          <span style={{fontSize:'.72rem',fontWeight:700,color:'var(--text-muted)'}}>Status</span>
          <Toggle value={form.IsActive} onChange={v => setForm(p => ({...p, IsActive:v}))} disabled={isReadOnly}/>
        </div>
      </div>

      {apiError && <div className="alert alert-warning animate-in"><span>⚠️</span><span>{apiError}</span></div>}

      <form onSubmit={handleSubmit} noValidate>
        <div className="card animate-in animate-in-1" style={{marginBottom:'1rem'}}>
          <div className="card-body" style={{padding:'.875rem 1.25rem'}}>

            {/* Row 1: Product Name | Product Code */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem',marginBottom:'.65rem'}}>
              <div>
                <label style={labelStyle}>Product Name (Eng) <Req/></label>
                <input name="ProductName" type="text"
                  className={`form-control${errors.ProductName?' is-invalid':''}`}
                  placeholder="Enter English name"
                  value={form.ProductName} onChange={handleChange} disabled={isReadOnly}
                  style={{...CI, width:'100%'}}/>
                {errors.ProductName && <div style={errStyle}>{errors.ProductName}</div>}
              </div>
              <div>
                <label style={labelStyle}>Product Code</label>
                <input type="text" readOnly tabIndex={-1} value={productCode || '…'}
                  style={{...CI,width:'100%',fontFamily:'ui-monospace,monospace',background:'var(--bg-soft)',color:'var(--text-muted)',cursor:'not-allowed',border:'1px solid var(--border)',borderRadius:'var(--radius)'}}/>
              </div>
            </div>

            {/* Row 2: Product Group + (+) */}
            <div style={{marginBottom:'.65rem'}}>
              <label style={labelStyle}>Product Group <Opt/></label>
              <GroupDropdown
                groups={groups}
                value={form.GroupId ? parseInt(form.GroupId, 10) : null}
                onChange={v => setForm(p => ({...p, GroupId: v || ''}))}
                onGroupAdded={g => setGroups(prev => [...prev, g].sort((a,b) => a.GroupName.localeCompare(b.GroupName)))}
                onGroupSelected={handleGroupSelected}
                disabled={isReadOnly}
                error={errors.GroupId}/>
              {errors.GroupId && <div style={errStyle}>{errors.GroupId}</div>}
            </div>

            {/* Row 3: Tamil Name | Unit (+) */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem',marginBottom:'.65rem'}}>
              <div>
                <label style={labelStyle}>Product Name (Tamil) <Opt/></label>
                <input name="ProductNameTamil" type="text" className="form-control"
                  placeholder="தமிழில் பொருளின் பெயர்"
                  value={form.ProductNameTamil} onChange={handleChange} disabled={isReadOnly}
                  lang="ta" style={{...CI, width:'100%'}}/>
              </div>
              <div>
                <label style={labelStyle}>Unit <Req/></label>
                <UnitDropdown
                  units={units}
                  value={form.UnitId}
                  onChange={u => {
                    setForm(p=>({...p,UnitId:u?.id || '',Units:u?.UnitName || ''}));
                    if(errors.Units)setErrors(p=>({...p,Units:''}));
                  }}
                  onUnitAdded={u => setUnits(prev => [...prev, u].sort((a,b)=>a.UnitName.localeCompare(b.UnitName)))}
                  onUnitsChanged={list => setUnits(list)}
                  disabled={isReadOnly}
                  error={errors.Units}/>
                {errors.Units && <div style={errStyle}>{errors.Units}</div>}
              </div>
            </div>

            {/* Row 4: Quantity | Description */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem',marginBottom:'.65rem'}}>
              <div>
                <label style={labelStyle}>Quantity <Opt/></label>
                <input name="Quantity" type="number" min="0" step="1"
                  className={`form-control${errors.Quantity?' is-invalid':''}`}
                  placeholder="0"
                  value={form.Quantity} onChange={handleChange} disabled={isReadOnly}
                  style={{...CI, width:'100%'}}/>
                {errors.Quantity && <div style={errStyle}>{errors.Quantity}</div>}
              </div>
              <div>
                <label style={labelStyle}>Description <Opt/></label>
                <textarea name="Description" className="form-control"
                  placeholder="Brief product description…"
                  value={form.Description} onChange={handleChange} disabled={isReadOnly}
                  style={{width:'100%',fontSize:'.82rem',resize:'none',height:34,padding:'.3rem .65rem'}}/>
              </div>
            </div>

            {/* Row 5: HSN | GST % — only when company GST enabled */}
            {isGSTRegistered && (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem',marginBottom:'.65rem'}}>
                <div>
                  <label style={labelStyle}>HSN <Req/></label>
                  <input name="HSNCode" type="text" className={`form-control${errors.HSNCode?' is-invalid':''}`}
                    placeholder="e.g. 1905"
                    value={form.HSNCode} onChange={handleChange} disabled={isReadOnly}
                    style={{...CI, width:'100%'}}/>
                  {errors.HSNCode && <div style={errStyle}>{errors.HSNCode}</div>}
                </div>
                <div>
                  <label style={labelStyle}>GST Percentage <Req/></label>
                  <input name="GSTPercent" type="number" min="0" max="100" step="1"
                    className={`form-control${errors.GSTPercent?' is-invalid':''}`}
                    placeholder="0"
                    value={form.GSTPercent} onChange={handleChange} disabled={isReadOnly}
                    style={{...CI, width:'100%'}}/>
                  {errors.GSTPercent && <div style={errStyle}>{errors.GSTPercent}</div>}
                </div>
              </div>
            )}

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

        <div className="form-actions-bar animate-in">
          <button type="button" className="btn btn-outline-secondary"
            onClick={() => quickSalesReturn ? returnToSalesForm() : navigate('/products')} disabled={saving}>
            Cancel
          </button>
          {!isReadOnly && (
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><Spin/> Saving…</> : (isEdit ? 'Update Product' : 'Save Product')}
            </button>
          )}
        </div>
      </form>
    </Layout>
  );
};

export default ProductForm;
