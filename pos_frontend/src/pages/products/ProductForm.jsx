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
  const ref = useRef(null);
  const inputRef = useRef(null);
  const { menuClassName, mobileMenuStyle } = useMobileDropdownPlacement(ref, open);
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
        <ul className={menuClassName} style={{...mobileMenuStyle,position:'absolute',top:'100%',left:0,right:0,zIndex:99999,
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
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');

  const save = async () => {
    if (saving) return;
    const n = unitName.trim();
    const u = uqc.trim().toUpperCase();
    if (!n) { setErr('Unit name is required.'); return; }
    if (!u) { setErr('UQC Code is required.'); return; }
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
      const created = await productService.createUnit({ UnitName: n, UQC: u, Decimal: false });
      onSaved(created);
    } catch (e) {
      const d = e.response?.data;
      setErr(firstApiError(d, 'Failed to create unit.'));
    } finally { setSaving(false); }
  };

  return createPortal(
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:99500,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'var(--card-bg)',borderRadius:12,boxShadow:'0 16px 48px rgba(0,0,0,.28)',padding:'1.25rem 1.375rem',width:'min(400px,96vw)',border:`1.5px solid ${BRAND}`}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
          <span style={{fontWeight:800,fontSize:'.95rem',color:'var(--text-primary)',fontFamily:'var(--font-heading)'}}>Unit Entry</span>
          <button type="button" onClick={onClose} style={{background:'var(--scale-100)',border:'none',borderRadius:6,width:28,height:28,cursor:'pointer',color:'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
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
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:99500,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'var(--card-bg)',borderRadius:12,boxShadow:'0 16px 48px rgba(0,0,0,.28)',padding:'1.25rem 1.375rem',width:'min(420px,96vw)',border:`1.5px solid ${BRAND}`}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
          <span style={{fontWeight:800,fontSize:'.95rem',color:'var(--text-primary)',fontFamily:'var(--font-heading)'}}>Add Product Group</span>
          <button type="button" onClick={onClose} style={{background:'var(--scale-100)',border:'none',borderRadius:6,width:28,height:28,cursor:'pointer',color:'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
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

  const filtered = q.trim() ? groups.filter(g => g.GroupName.toLowerCase().includes(q.toLowerCase())) : groups;

  const pick = (g) => {
    onChange(g.id);
    setQ(g.GroupName);
    setOpen(false);
    onGroupSelected && onGroupSelected(g);
  };

  return (
    <div ref={ref}>
      <div className="product-lookup-with-add" style={{display:'flex',alignItems:'center',gap:'.4rem'}}>
        <div ref={anchorRef} className="app-dropdown" style={{position:'relative',flex:1}}>
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
      <div className="product-lookup-with-add" style={{display:'flex',alignItems:'center',gap:'.4rem'}}>
        <div ref={anchorRef} className="app-dropdown" style={{position:'relative',flex:1}}>
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
            <ul className={menuClassName} style={{...mobileMenuStyle,position:'absolute',top:'100%',left:0,right:0,zIndex:9999,
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
  const quickSalesReturn = location.state?.returnToSales && location.state?.salesDraft;
  const returnToSalesForm = useCallback((productCreated = false, createdProduct = null) => {
    navigate(location.state?.returnPath || '/billing/new', {
      state: {
        restoreSalesDraft: location.state?.salesDraft,
        productCreated,
        createdProduct,
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
  const saveInFlightRef = useRef(false);
  const taxValueSourceRef = useRef({ HSNCode: 'empty', GSTPercent: 'empty' });

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
    const { name, value } = e.target;
    if (name === 'HSNCode' || name === 'GSTPercent') {
      taxValueSourceRef.current[name] = String(value).trim() === '' ? 'empty' : 'manual';
    }
    setForm(p => ({...p, [name]: value}));
    if (errors[name]) setErrors(p => ({...p, [name]: ''}));
    if (apiError) setApiError('');
  }, [errors, apiError]);

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
    if (!form.HSNCode.trim()) e.HSNCode = 'HSN Code is required.';
    else if (form.HSNCode.trim().length > HSN_MAX)
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formElement = e.currentTarget;
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
        const createdProduct = await productService.createProductWithPrices(payload);
        toast.success('Saved', 'Product saved successfully.');
        if (quickSalesReturn) {
          setTimeout(() => returnToSalesForm(true, createdProduct), 600);
          return;
        }
        const retainedGroup = groups.find(group => String(group.id) === String(form.GroupId));
        const retainedHsn = retainedGroup?.HSNCode != null ? String(retainedGroup.HSNCode).trim() : '';
        const retainedGst = retainedGroup?.GSTPercent != null && String(retainedGroup.GSTPercent).trim() !== ''
          ? String(retainedGroup.GSTPercent) : '';
        taxValueSourceRef.current = {
          HSNCode: retainedHsn ? 'auto' : 'empty',
          GSTPercent: retainedGst ? 'auto' : 'empty',
        };
        setForm({
          ...EMPTY_FORM,
          GroupId: form.GroupId,
          HSNCode: retainedHsn,
          GSTPercent: retainedGst,
        });
        setErrors({});
        setApiError('');
        fetchNextCode();
      }
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const fe = {};
        const nonField = [];
        Object.entries(data).forEach(([key, value]) => {
          const field = API_FIELD_MAP[key];
          if (field) fe[field] = friendlyProductError(field, value);
          else nonField.push(friendlyProductError(key, value));
        });
        setErrors(fe);
        setApiError(nonField[0] || (Object.keys(fe).length ? 'Please correct the highlighted field.' : 'The product could not be updated. Please try again.'));
        requestAnimationFrame(() => {
          const first = document.querySelector('form [aria-invalid="true"], form .is-invalid');
          first?.focus();
        });
      } else { setApiError(data?.detail || 'Failed to save.'); }
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  };

  if (loading) return <Layout><LoadingSpinner message="Loading product…"/></Layout>;
  const isReadOnly = isEdit && !isAdmin;

  return (
    <Layout>
      <div className="page-header product-page-header professional-form-title-card animate-in">
        <div>
          <h2 style={{fontFamily:'var(--font-heading)',fontWeight:800}}>
            {isEdit ? (isAdmin ? 'Edit Product Details' : 'View Product Details') : 'Add Product Details'}
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

      <form className="professional-form-layout product-professional-form" onSubmit={handleSubmit} noValidate>
        <div className="card animate-in animate-in-1 professional-form-container product-form-container" style={{marginBottom:'1rem'}}>
          <div className="card-body professional-form-content" style={{padding:'.875rem 1.25rem'}}>
            <div className="professional-section-title product-section-information">Product Information</div>

            {/* Row 1: Product Name | Product Code */}
            <div className="product-form-row product-form-name-code" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem',marginBottom:'.65rem'}}>
              <div className="product-field product-field-name">
                <label style={labelStyle}>Product Name (Eng) <Req/></label>
                <input name="ProductName" type="text"
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
                <input name="ProductNameTamil" type="text" className={`form-control${errors.ProductNameTamil?' is-invalid':''}`}
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
                      prev.some(item => item.id === u.id)
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
                <input name="Quantity" type="number" min="0" step="1"
                  className={`form-control${errors.Quantity?' is-invalid':''}`}
                  placeholder="0"
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
                  <input name="HSNCode" type="text" className={`form-control${errors.HSNCode?' is-invalid':''}`}
                    aria-invalid={Boolean(errors.HSNCode)}
                    placeholder="e.g. 1905"
                    value={form.HSNCode} onChange={handleChange} disabled={isReadOnly}
                    style={{...CI, width:'100%'}}/>
                  {errors.HSNCode && <div style={errStyle}>{errors.HSNCode}</div>}
                </div>
                <div className="product-field product-field-gst">
                  <label style={labelStyle}>GST Percentage <Req/></label>
                  <input name="GSTPercent" type="number" min="0" max="100" step="1"
                    className={`form-control${errors.GSTPercent?' is-invalid':''}`}
                    aria-invalid={Boolean(errors.GSTPercent)}
                    placeholder="0"
                    value={form.GSTPercent} onChange={handleChange} disabled={isReadOnly}
                    style={{...CI, width:'100%'}}/>
                  {errors.GSTPercent && <div style={errStyle}>{errors.GSTPercent}</div>}
                </div>
              </div>

            <div className="professional-section-title product-section-additional">Additional Information</div>

            <div className="product-field product-field-description">
              <label style={labelStyle}>Description <Opt/></label>
              <textarea name="Description" className="form-control"
                placeholder="Brief product description"
                value={form.Description} onChange={handleChange} disabled={isReadOnly}
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
