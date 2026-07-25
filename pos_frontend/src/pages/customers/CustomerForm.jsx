import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Layout from '../../components/Layout';
import LoadingSpinner from '../../components/LoadingSpinner';
import customerService from '../../services/customerService';
import billingService from '../../services/billingService';
import api from '../../services/api';
import useMobileDropdownPlacement from '../../hooks/useMobileDropdownPlacement';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { INDIA_DISTRICTS, INDIA_STATES, getStateAndCountryByDistrict } from '../../data/indiaData';

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
    strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const BRAND    = '#8A5125';
const PHONE_10 = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GST_RE   = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const ALL_DISTRICT_NAMES = [...new Set(INDIA_DISTRICTS.map(d => d.district))].sort();

const EMPTY = {
  CustomerName:'', PhoneNumber:'', whatsapp_same:false, WhatsappNumber:'',
  EmailId:'', IsActive:true,
  Address:'', District:'', State:'', Country:'India', PinCode:'',
  IsGSTCustomer:false, GSTNo:'',
  PriceCodeType:'Random', FixedPriceCodeID:'',
};

// Fields that are always optional (address/location)
// Only CustomerName and PriceCodeType are always required.
// GSTNo is required when IsGSTCustomer=true.
// FixedPriceCodeID is required when PriceCodeType='Fixed'.

const Toggle = ({ value, onChange, disabled }) => (
  <div className="customer-status-switch" style={{display:'flex',alignItems:'center',gap:'.4rem'}}>
    <div className="customer-status-track" onClick={()=>{if(!disabled)onChange(!value);}} style={{
      position:'relative',width:36,height:20,borderRadius:10,
      background:value?BRAND:'#bdbdbd',transition:'background .2s',
      cursor:disabled?'not-allowed':'pointer',flexShrink:0,
    }}>
      <div style={{position:'absolute',top:3,left:value?19:3,width:14,height:14,
        borderRadius:'50%',background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,.25)',transition:'left .2s'}}/>
    </div>
    <span style={{fontSize:'.76rem',fontWeight:700,color:value?BRAND:'var(--text-muted)'}}>{value?'Active':'Inactive'}</span>
  </div>
);
const CBx = ({ checked, onChange, disabled, label }) => (
  <label className="form-check customer-checkbox-row" style={{display:'flex',alignItems:'center',gap:'.3rem',cursor:disabled?'default':'pointer',
    fontSize:'.74rem',fontWeight:500,color:'var(--text-label)',userSelect:'none'}}>
    <input type="checkbox" className="form-check-input" checked={checked} onChange={onChange} disabled={disabled}
      style={{width:13,height:13,accentColor:BRAND,cursor:disabled?'not-allowed':'pointer'}}/>
    <span className="form-check-label">{label}</span>
  </label>
);
const Spin = () => (
  <span style={{display:'inline-block',width:13,height:13,
    border:'2px solid rgba(255,255,255,.35)',borderTopColor:'#fff',
    borderRadius:'50%',animation:'spin .6s linear infinite'}}/>
);
const CI = { height:32, padding:'.28rem .6rem', fontSize:'.81rem', width:'100%' };
const FErr = ({ msg }) => msg
  ? <div style={{fontSize:'.67rem',color:'var(--danger)',marginTop:'.18rem',fontWeight:500,lineHeight:1.3}}>{msg}</div>
  : null;
const F = ({ label, required, opt, error, children, style }) => (
  <div className="customer-form-field" style={{minWidth:0,...style}}>
    <label className="field-label" style={{display:'block',fontWeight:700,fontSize:'.72rem',color:'var(--text-label)',marginBottom:'.2rem',whiteSpace:'nowrap'}}>
      {label}{required && <span style={{color:'var(--danger)',marginLeft:2}}>*</span>}
      {opt && <span style={{color:'var(--text-muted)',fontWeight:400,marginLeft:3,fontSize:'.70rem'}}> (optional)</span>}
    </label>
    {children}<FErr msg={error}/>
  </div>
);

const SearchableDropdown = ({ value, onChange, options, placeholder, disabled, error }) => {
  const [query, setQuery] = useState(value || '');
  const [open,  setOpen]  = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);
  const { menuClassName, mobileMenuStyle } = useMobileDropdownPlacement(ref, open);
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setQuery(value || '');
  }, [value]);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return undefined;
    const clear = () => {
      if (disabled) return;
      setQuery('');
      setOpen(false);
      onChange('');
      setTimeout(() => el.focus(), 0);
    };
    el.addEventListener('pos-escape-clear-field', clear);
    return () => el.removeEventListener('pos-escape-clear-field', clear);
  }, [disabled, onChange]);
  const filtered = query.trim() ? options.filter(o => o.toLowerCase().includes(query.toLowerCase().trim())) : options;
  const sorted = [...filtered].sort((a,b) => {
    const q=query.toLowerCase().trim(),aL=a.toLowerCase(),bL=b.toLowerCase();
    if(aL===q)return -1; if(bL===q)return 1;
    if(aL.startsWith(q)&&!bL.startsWith(q))return -1;
    if(!aL.startsWith(q)&&bL.startsWith(q))return 1;
    return a.localeCompare(b);
  });
  return (
    <div ref={ref} className="app-dropdown" style={{position:'relative'}}>
      <input ref={inputRef} type="text" className={`form-control${error?' is-invalid':''}`}
        placeholder={placeholder} value={query} disabled={disabled} autoComplete="off"
        style={{...CI,paddingRight:'2rem',borderColor:error?'var(--danger)':undefined}}
        onChange={e=>{setQuery(e.target.value);setOpen(true);if(!e.target.value.trim())onChange('');}}
        onFocus={()=>setOpen(true)}
        onBlur={()=>setTimeout(()=>{
          setOpen(false);
          const ex=options.find(o=>o.toLowerCase()===query.toLowerCase().trim());
          if(ex){setQuery(ex);onChange(ex);}else if(!options.includes(query)){setQuery(value||'');}
        },160)}/>
      <span style={{position:'absolute',right:'.55rem',top:'50%',transform:'translateY(-50%)',
        pointerEvents:'none',color:'var(--text-muted)',fontSize:'.6rem'}}>▾</span>
      {open&&sorted.length>0&&(
        <ul className={menuClassName} style={{...mobileMenuStyle,position:'absolute',top:'100%',left:0,right:0,zIndex:9999,
          background:'var(--card-bg)',border:'1.5px solid var(--primary)',
          borderTop:'none',borderRadius:'0 0 var(--radius) var(--radius)',
          boxShadow:'0 6px 20px rgba(0,0,0,.12)',maxHeight:200,overflowY:'auto',margin:0,padding:0,listStyle:'none'}}>
          {sorted.map(opt=>(
            <li key={opt} onMouseDown={()=>{setQuery(opt);setOpen(false);onChange(opt);}}
              style={{padding:'.42rem .75rem',fontSize:'.81rem',cursor:'pointer',
                color:value===opt?'var(--primary-dark)':'var(--text-primary)',
                background:value===opt?'var(--primary-light)':'transparent',fontWeight:value===opt?700:400}}
              onMouseEnter={e=>{if(value!==opt)e.currentTarget.style.background='var(--scale-50)';}}
              onMouseLeave={e=>{if(value!==opt)e.currentTarget.style.background='transparent';}}>{opt}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ── Price Code Reference Panel ── */
const PriceRefPanel = ({ priceCodes, onClose }) => {
  const [products, setProducts]   = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [search,   setSearch]     = useState('');

  useEffect(() => {
    api.get('/products/for-price-page/').then(r => {
      setProducts(Array.isArray(r.data) ? r.data : (r.data?.results || []));
    }).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const filtered = search.trim()
    ? products.filter(p => p.ProductName.toLowerCase().includes(search.toLowerCase()))
    : products;

  return createPortal(
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:8500,background:'rgba(0,0,0,.4)',backdropFilter:'blur(3px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'var(--card-bg)',borderRadius:12,boxShadow:'0 20px 60px rgba(0,0,0,.25)',width:'min(860px,96vw)',maxHeight:'88vh',display:'flex',flexDirection:'column',overflow:'hidden',border:'1px solid var(--border)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'.875rem 1.25rem',borderBottom:'1px solid var(--divider)',background:'var(--bg-soft)',flexShrink:0}}>
          <div>
            <span style={{fontWeight:800,fontSize:'.95rem',fontFamily:'var(--font-heading)',color:'var(--text-primary)'}}>Price Code Reference</span>
            <p style={{fontSize:'.72rem',color:'var(--text-muted)',marginTop:'.1rem'}}>All products with their 5 price tiers</p>
          </div>
          <button onClick={onClose} style={{background:'var(--scale-100)',border:'none',borderRadius:6,width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--text-muted)',fontSize:'.85rem'}}>✕</button>
        </div>
        <div style={{padding:'.625rem 1rem',borderBottom:'1px solid var(--divider)',flexShrink:0}}>
          <input type="text" placeholder="Search product…" value={search} onChange={e=>setSearch(e.target.value)}
            style={{width:'100%',height:32,padding:'.3rem .75rem',fontSize:'.82rem',border:'1.5px solid var(--border-input)',borderRadius:6,outline:'none'}}/>
        </div>
        <div style={{flex:1,overflowY:'auto'}}>
          {loading ? (
            <div style={{padding:'2rem',textAlign:'center',color:'var(--text-muted)',fontSize:'.82rem'}}>Loading…</div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.79rem'}}>
              <thead style={{position:'sticky',top:0}}>
                <tr style={{background:'#8A5125'}}>
                  <th style={{padding:'.45rem .75rem',color:'#fff',fontWeight:700,fontSize:'.68rem',textAlign:'left',textTransform:'uppercase',letterSpacing:'.04em'}}>Product</th>
                  {priceCodes.map(pc=>(
                    <th key={pc.id} style={{padding:'.45rem .75rem',color:'#fff',fontWeight:700,fontSize:'.68rem',textAlign:'right',textTransform:'uppercase',letterSpacing:'.04em',whiteSpace:'nowrap'}}>{pc.DisplayLabel}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length===0 ? (
                  <tr><td colSpan={priceCodes.length+1} style={{padding:'2rem',textAlign:'center',color:'var(--text-muted)'}}>No products found.</td></tr>
                ) : filtered.map((p,i)=>(
                  <tr key={p.id} style={{borderBottom:'1px solid var(--divider)',background:i%2===0?'transparent':'var(--bg-soft)'}}>
                    <td style={{padding:'.38rem .75rem',fontWeight:600,color:'var(--text-primary)'}}>
                      {p.ProductName}
                      {p.Units&&<span style={{fontSize:'.68rem',color:'var(--text-muted)',marginLeft:'.35rem'}}>({p.Units})</span>}
                    </td>
                    {priceCodes.map(pc=>{
                      const tier=(p.prices||[]).find(t=>t.PriceCodeID===pc.id||t.DisplayLabel===pc.DisplayLabel);
                      return (
                        <td key={pc.id} style={{padding:'.38rem .75rem',textAlign:'right',fontVariantNumeric:'tabular-nums',color:tier?'var(--primary-dark)':'var(--text-muted)',fontWeight:tier?700:400}}>
                          {tier?`₹${parseFloat(tier.ProductPrice).toFixed(2)}`:'—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>, document.body
  );
};

const CustomerForm = () => {
  const navigate    = useNavigate();
  const location    = useLocation();
  const { id }      = useParams();
  const { isAdmin } = useAuth();
  const { isGSTRegistered: companyGST } = useCompany();  // live from CompanyContext
  const isEdit      = id !== undefined && id !== 'new';
  const toast       = useToast();

  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [errors,       setErrors]       = useState({});
  const [apiError,     setApiError]     = useState('');
  const [form,         setForm]         = useState(EMPTY);
  const [custCode,     setCustCode]     = useState('');
  const [createdInfo,  setCreatedInfo]  = useState(null);
  const [priceCodes,   setPriceCodes]   = useState([]);
  const [showPriceRef, setShowPriceRef] = useState(false);
  const returnToSales = Boolean(location.state?.returnToSales);
  const salesDraft = location.state?.salesDraft || null;

  const goBackAfterCustomerEntry = useCallback((selectedCustomer = null) => {
    if (returnToSales) {
      navigate('/billing/new', {
        state: {
          restoreSalesDraft: salesDraft,
          ...(selectedCustomer ? { selectedCustomer } : {}),
        },
      });
      return;
    }
    navigate('/customers');
  }, [navigate, returnToSales, salesDraft]);

  // Load price codes (company GST now comes from CompanyContext)
  useEffect(() => {
    billingService.getPriceCodes()
      .then(d => setPriceCodes(Array.isArray(d) ? d : []))
      .catch(() => setPriceCodes([]));
  }, []);

  useEffect(() => {
    if (isEdit) return;
    customerService.getNextCode().then(c => setCustCode(c)).catch(() => setCustCode('CUS_???'));
  }, [isEdit]);

  useEffect(() => {
    if (!isEdit) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await customerService.getCustomer(id);
        setCustCode(data.CustomerCode || '');
        const parts = (data.Address || '').split('|').map(s => s.trim());
        const cfg = data.PriceConfig;
        setForm({
          CustomerName:    data.CustomerName || '',
          PhoneNumber:     data.PhoneNumber || '',
          whatsapp_same:   data.IsWhatsappSameAsPhone || false,
          WhatsappNumber:  data.WhatsappNumber || '',
          EmailId:         data.EmailId || '',
          IsActive:        data.IsActive !== undefined ? data.IsActive : true,
          Address:         parts[0] || '',
          District:        parts[1] || '',
          State:           parts[2] || '',
          Country:         parts[3] || 'India',
          PinCode:         parts[4] || '',
          IsGSTCustomer:   data.IsGSTCustomer || false,
          GSTNo:           data.GSTNo || '',
          PriceCodeType:   cfg ? cfg.PriceCodeType : (data.PriceCodeType || 'Fixed'),
          FixedPriceCodeID: cfg ? (cfg.FixedPriceCodeID || '') : '',
        });
        setCreatedInfo({ CreatedBy: data.CreatedByUsername || '', CreatedOn: data.CreatedOn });
      } catch (err) {
        setApiError(err.response?.data?.detail || 'Failed to load customer.');
      } finally { setLoading(false); }
    };
    load();
  }, [id, isEdit]);

  const change = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    let val = type === 'checkbox' ? checked : value;
    if ((name==='PhoneNumber'||name==='WhatsappNumber') && type!=='checkbox') {
      val = value.replace(/\D/g,'').slice(0,10);
    }
    if (name === 'GSTNo') {
      val = value.replace(/\s/g, '').toUpperCase().slice(0, 15);
    }
    setForm(p => {
      const n = { ...p, [name]: val };
      if (name==='whatsapp_same') { n.WhatsappNumber = checked ? p.PhoneNumber : ''; }
      if (name==='PhoneNumber' && p.whatsapp_same) n.WhatsappNumber = val;
      if (name==='IsGSTCustomer' && !checked) n.GSTNo = '';
      if (name==='PriceCodeType' && val==='Random') { n.FixedPriceCodeID = ''; }
      return n;
    });
    if (name==='PriceCodeType' && value==='Random') {
      // nothing extra needed
    }
    if (errors[name]) setErrors(p => ({ ...p, [name]: '' }));
    if (apiError) setApiError('');
  }, [errors, apiError]);

  const handleDistrictChange = useCallback((v) => {
    setForm(p => {
      const m = getStateAndCountryByDistrict(v);
      return { ...p, District:v, State:m?m.state:p.State, Country:m?m.country:p.Country };
    });
    if (errors.District) setErrors(p => ({ ...p, District: '' }));
  }, [errors]);

  const handleStateChange = useCallback((v) => {
    setForm(p => ({ ...p, State:v, Country:v?'India':p.Country }));
    if (errors.State) setErrors(p => ({ ...p, State: '' }));
  }, [errors]);

  const validate = () => {
    const e = {};
    if (!form.CustomerName.trim()) e.CustomerName = 'Customer name is required.';
    if (form.PhoneNumber && !PHONE_10.test(form.PhoneNumber.replace(/\D/g,'')))
      e.PhoneNumber = 'Enter a valid 10-digit mobile number.';
    if (!form.whatsapp_same && form.WhatsappNumber.trim() && !PHONE_10.test(form.WhatsappNumber.replace(/\D/g,'')))
      e.WhatsappNumber = 'Enter a valid 10-digit WhatsApp number.';
    if (form.EmailId.trim() && !EMAIL_RE.test(form.EmailId)) e.EmailId = 'Enter a valid email.';
    // Address/District/State/PinCode are optional
    if (form.PinCode && form.PinCode.trim() && !/^\d{6}$/.test(form.PinCode))
      e.PinCode = 'PIN must be 6 digits.';
    if (form.IsGSTCustomer) {
      const gst = form.GSTNo.replace(/\s/g, '').toUpperCase();
      if (!gst) {
        e.GSTNo = 'GST Number is required.';
      } else if (gst.length !== 15) {
        e.GSTNo = 'GST Number must be exactly 15 characters.';
      } else if (!GST_RE.test(gst)) {
        e.GSTNo = 'Invalid GSTIN format (e.g. 33ABCDE1234F1Z5).';
      }
    }
    if (!form.PriceCodeType) e.PriceCodeType = 'Price type is required.';
    if (form.PriceCodeType==='Fixed' && !form.FixedPriceCodeID) e.FixedPriceCodeID = 'Default price code is required for Fixed type.';
    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true); setApiError('');
    const addrParts = [form.Address.trim(), form.District.trim(), form.State.trim(), form.Country.trim(), form.PinCode.trim()];
    const Address = addrParts.join(' | ');
    const digits  = form.PhoneNumber.replace(/\D/g,'') || null;
    const wDigits = form.whatsapp_same ? digits : (form.WhatsappNumber ? form.WhatsappNumber.replace(/\D/g,'') : null);
    try {
      let savedCustomer = null;
      const payload = {
        CustomerName: form.CustomerName.trim(),
        PhoneNumber: digits,
        IsWhatsappSameAsPhone: form.whatsapp_same,
        WhatsappNumber: wDigits || null,
        EmailId: form.EmailId.trim() || null,
        IsActive: form.IsActive,
        Address,
        IsGSTCustomer: form.IsGSTCustomer,
        GSTNo: form.IsGSTCustomer ? form.GSTNo.trim().toUpperCase() : null,
        PriceCodeType: form.PriceCodeType,
        FixedPriceCodeID: form.PriceCodeType==='Fixed' ? parseInt(form.FixedPriceCodeID,10) : null,
      };
      if (isEdit) {
        savedCustomer = await customerService.updateCustomer(id, payload);
        toast.success('Updated Successfully', 'Customer updated successfully.');
      } else {
        savedCustomer = await customerService.createCustomer(payload);
        toast.success('Saved Successfully', 'Customer saved successfully.');
      }
      if (returnToSales) {
        goBackAfterCustomerEntry(savedCustomer);
      } else {
        setTimeout(() => navigate('/customers'), 2000);
      }
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const fe = {};
        Object.entries(data).forEach(([k,v]) => { fe[k] = Array.isArray(v) ? v[0] : v; });
        setErrors(fe); setApiError('Please fix the errors below.');
      } else { setApiError(data?.detail || 'Failed to save. Please try again.'); }
      toast.error(isEdit ? 'Update Failed' : 'Save Failed', err.response?.data?.detail || 'Please check and try again.');
    } finally { setSaving(false); }
  };

  if (loading) return <Layout><LoadingSpinner message="Loading customer…"/></Layout>;
  const isReadOnly = isEdit && !isAdmin;
  const inp = (name) => ({ ...CI, borderColor: errors[name] ? 'var(--danger)' : undefined });

  return (
    <Layout>
      {showPriceRef && <PriceRefPanel priceCodes={priceCodes} onClose={()=>setShowPriceRef(false)}/>}
      <div className="page-header animate-in">
        <div>
          <h2 style={{fontFamily:'var(--font-heading)',fontWeight:800}}>
            {isEdit?(isAdmin?'Edit Customer':'View Customer'):'Add Customer'}
          </h2>
          <p className="page-header-sub">
            {isEdit?(isAdmin?'Update customer details':'Viewing customer (read-only)'):'Register a new customer'}
          </p>
        </div>
      </div>
      {apiError && <div className="alert alert-warning animate-in"><span>⚠️</span><span>{apiError}</span></div>}
      <form className="customer-form-page" onSubmit={submit} noValidate>
        <div className="card animate-in animate-in-1" style={{width:'100%',maxWidth:1120,margin:'0 auto 1.25rem'}}>
          <div className="card-body" style={{padding:'1.125rem 1.5rem'}}>
            {/* Header */}
            <div className="customer-section-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between',
              marginBottom:'1rem',paddingBottom:'.75rem',borderBottom:'1px solid var(--divider)'}}>
              <div className="customer-status-control" style={{display:'flex',alignItems:'center',gap:'.5rem'}}>
                <UserIcon/>
                <span style={{fontWeight:800,fontSize:'.9rem',color:'var(--text-primary)',fontFamily:'var(--font-heading)'}}>Customer Details</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'.5rem'}}>
                <span style={{fontSize:'.7rem',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.04em'}}>Status</span>
                <Toggle value={form.IsActive} onChange={v => setForm(p=>({...p,IsActive:v}))} disabled={isReadOnly}/>
              </div>
            </div>

            {/* Basic Info */}
            <div style={{marginBottom:'.5rem',fontSize:'.62rem',fontWeight:800,textTransform:'uppercase',
              letterSpacing:'.09em',color:'var(--primary)',paddingBottom:'.3rem',borderBottom:'1px solid var(--divider)'}}>
              Basic Information
            </div>

            <div className="customer-form-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.75rem',marginBottom:'.65rem',marginTop:'.65rem'}}>
              <F label="Customer Code">
                <input type="text" className="form-control" value={custCode||'…'} readOnly tabIndex={-1}
                  style={{...CI,fontFamily:'ui-monospace,monospace',fontSize:'.75rem',background:'var(--bg-soft)',color:'var(--text-muted)',cursor:'not-allowed'}}/>
              </F>
              <F label="Customer Name" required error={errors.CustomerName}>
                <input name="CustomerName" type="text"
                  className={`form-control${errors.CustomerName?' is-invalid':''}`}
                  placeholder="Enter full customer name"
                  value={form.CustomerName} onChange={change} disabled={isReadOnly} style={inp('CustomerName')}/>
              </F>
            </div>

            <div className="customer-form-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.75rem',marginBottom:'.65rem'}}>
              <F label="Email" opt error={errors.EmailId}>
                <input name="EmailId" type="email"
                  className={`form-control${errors.EmailId?' is-invalid':''}`}
                  placeholder="customer@example.com"
                  value={form.EmailId} onChange={change} disabled={isReadOnly} style={inp('EmailId')}/>
              </F>
              <F label="Phone Number" opt error={errors.PhoneNumber}>
                <input name="PhoneNumber" type="tel" inputMode="numeric" maxLength={10}
                  className={`form-control${errors.PhoneNumber?' is-invalid':''}`}
                  placeholder="10-digit mobile (optional)"
                  value={form.PhoneNumber} onChange={change} disabled={isReadOnly}
                  onKeyDown={e => { if (!/^[0-9]$/.test(e.key) && !['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Enter'].includes(e.key)) e.preventDefault(); }}
                  style={inp('PhoneNumber')}/>
              </F>
            </div>

            <div className="customer-form-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.75rem',marginBottom:'.65rem'}}>
              <div className="customer-form-field whatsapp-section">
                <label className="field-label" style={{display:'flex',alignItems:'center',
                  fontWeight:700,fontSize:'.72rem',color:'var(--text-label)',marginBottom:'.2rem'}}>
                  <span>WhatsApp <span style={{color:'var(--text-muted)',fontWeight:400,fontSize:'.70rem'}}>(optional)</span></span>
                </label>
                {!isReadOnly && <CBx checked={form.whatsapp_same} onChange={e=>change({target:{name:'whatsapp_same',type:'checkbox',checked:e.target.checked}})} disabled={isReadOnly} label="Same as Phone"/>}
                <input name="WhatsappNumber" type="tel" inputMode="numeric" maxLength={10}
                  className={`form-control${errors.WhatsappNumber?' is-invalid':''}`}
                  placeholder="10-digit mobile"
                  value={form.WhatsappNumber} onChange={change} disabled={isReadOnly||form.whatsapp_same}
                  onKeyDown={e => { if (!/^[0-9]$/.test(e.key) && !['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Enter'].includes(e.key)) e.preventDefault(); }}
                  style={{...inp('WhatsappNumber')}}/>
                <FErr msg={errors.WhatsappNumber}/>
              </div>
              <F label="Address" opt error={errors.Address}>
                <input name="Address" type="text"
                  className={`form-control${errors.Address?' is-invalid':''}`}
                  placeholder="Door No. / Street / Area (optional)"
                  value={form.Address} onChange={change} disabled={isReadOnly} style={inp('Address')}/>
              </F>
            </div>

            {/* Location */}
            <div style={{marginBottom:'.5rem',marginTop:'.75rem',fontSize:'.62rem',fontWeight:800,
              textTransform:'uppercase',letterSpacing:'.09em',color:'var(--primary)',
              paddingBottom:'.3rem',borderBottom:'1px solid var(--divider)'}}>Location</div>
            <div className="customer-form-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.75rem',marginBottom:'.65rem',marginTop:'.65rem'}}>
              <F label="District" opt error={errors.District}>
                <SearchableDropdown value={form.District} onChange={handleDistrictChange}
                  options={ALL_DISTRICT_NAMES} placeholder="Search district…" disabled={isReadOnly} error={errors.District}/>
              </F>
              <F label="State" opt error={errors.State}>
                <SearchableDropdown value={form.State} onChange={handleStateChange}
                  options={INDIA_STATES} placeholder="Search state…" disabled={isReadOnly} error={errors.State}/>
              </F>
            </div>
            <div className="customer-form-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.75rem',marginBottom:'.65rem'}}>
              <F label="Country" opt>
                <input name="Country" type="text" className="form-control" value={form.Country} readOnly tabIndex={-1}
                  style={{...CI,background:'var(--bg-soft)',color:'var(--text-primary)',cursor:'not-allowed',fontWeight:600}}/>
              </F>
              <F label="Pincode" opt error={errors.PinCode}>
                <input name="PinCode" type="text" inputMode="numeric" maxLength={6}
                  className={`form-control${errors.PinCode?' is-invalid':''}`}
                  placeholder="6-digit pincode (optional)"
                  value={form.PinCode} onChange={change} disabled={isReadOnly}
                  onKeyDown={e => { if (!/^[0-9]$/.test(e.key) && !['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Enter'].includes(e.key)) e.preventDefault(); }}
                  style={inp('PinCode')}/>
              </F>
            </div>

            {/* GST & Pricing */}
            <div style={{marginBottom:'.5rem',marginTop:'.75rem',fontSize:'.62rem',fontWeight:800,
              textTransform:'uppercase',letterSpacing:'.09em',color:'var(--primary)',
              paddingBottom:'.3rem',borderBottom:'1px solid var(--divider)'}}>GST & Pricing</div>

            <div className="customer-form-grid customer-gst-pricing-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.75rem',marginTop:'.65rem',marginBottom:'.65rem',alignItems:'start'}}>

              {/* LEFT: GST Customer checkbox — always visible, independent of company GST */}
              <div className="gst-customer-control-wrap">
                <label className="form-check customer-checkbox-row gst-customer-control" style={{display:'inline-flex',alignItems:'center',gap:'.5rem',
                  cursor:isReadOnly?'default':'pointer',padding:'.3rem .7rem',marginBottom:'.45rem',
                  border:`1.5px solid ${form.IsGSTCustomer?'var(--primary)':'var(--border-input)'}`,
                  borderRadius:'var(--radius)',background:form.IsGSTCustomer?'var(--primary-light)':'transparent',
                  transition:'all .15s',userSelect:'none'}}>
                  <input type="checkbox" className="form-check-input" name="IsGSTCustomer" checked={form.IsGSTCustomer} onChange={change} disabled={isReadOnly}
                    style={{width:14,height:14,accentColor:BRAND,cursor:isReadOnly?'not-allowed':'pointer'}}/>
                  <span className="form-check-label" style={{fontSize:'.8rem',fontWeight:700,color:form.IsGSTCustomer?'var(--primary-dark)':'var(--text-muted)'}}>
                    GST Customer
                  </span>
                </label>
                {form.IsGSTCustomer && (
                  <div style={{padding:'.55rem .75rem',background:'var(--bg-soft)',borderRadius:'var(--radius)',border:'1px solid var(--divider)'}}>
                    <div style={{fontSize:'.67rem',fontWeight:700,color:'var(--text-label)',marginBottom:'.22rem',textTransform:'uppercase',letterSpacing:'.03em'}}>
                      GST Number <span style={{color:'var(--danger)'}}>*</span>
                    </div>
                    <input name="GSTNo" type="text"
                      className={`form-control${errors.GSTNo?' is-invalid':''}`}
                      placeholder="Enter 15-character GSTIN" value={form.GSTNo} onChange={change}
                      disabled={isReadOnly} maxLength={15}
                      style={{...inp('GSTNo'),height:30,padding:'.18rem .55rem',fontFamily:'ui-monospace,monospace',fontSize:'.78rem',textTransform:'uppercase'}}/>
                    <FErr msg={errors.GSTNo}/>
                  </div>
                )}
              </div>

              {/* RIGHT: Price Type + Default Price Code */}
              <div>
                <F label="Price Code" required error={errors.PriceCodeType}>
                  <div className="price-code-options price-code-type-options" role="radiogroup" aria-label="Price code type" style={{display:'flex',gap:'.5rem',marginTop:'.1rem'}}>
                    {['Random','Fixed'].map(pt => (
                      <label key={pt} className={`price-code-option${form.PriceCodeType===pt?' selected':''}`} style={{display:'flex',alignItems:'center',gap:'.35rem',
                        cursor:isReadOnly?'default':'pointer',padding:'.3rem .75rem',
                        border:`1.5px solid ${form.PriceCodeType===pt?'var(--primary)':'var(--border-input)'}`,
                        borderRadius:'var(--radius)',background:form.PriceCodeType===pt?'var(--primary-light)':'transparent',
                        fontSize:'.8rem',fontWeight:700,color:form.PriceCodeType===pt?'var(--primary-dark)':'var(--text-muted)',
                        userSelect:'none',transition:'all .15s'}}>
                        <input type="radio" name="PriceCodeType" value={pt}
                          checked={form.PriceCodeType===pt} onChange={change} disabled={isReadOnly}
                          style={{accentColor:BRAND}}/>
                        <span>{pt}</span>
                      </label>
                    ))}
                  </div>
                  <FErr msg={errors.PriceCodeType}/>
                </F>

                {form.PriceCodeType==='Fixed' && (
                  <div style={{marginTop:'.6rem'}}>
                    <F label="Default Price Code" required error={errors.FixedPriceCodeID}>
                      <div className="default-price-code-options" role="radiogroup" aria-label="Default price code" style={{display:'flex',gap:'.4rem',flexWrap:'wrap',marginTop:'.2rem'}}>
                        {priceCodes.map(pc => (
                          <label key={pc.id} className={`default-price-code-option${String(form.FixedPriceCodeID)===String(pc.id)?' selected':''}`} style={{display:'flex',alignItems:'center',gap:'.3rem',
                            cursor:isReadOnly?'default':'pointer',padding:'.28rem .65rem',
                            border:`1.5px solid ${String(form.FixedPriceCodeID)===String(pc.id)?'var(--primary)':'var(--border-input)'}`,
                            borderRadius:'var(--radius)',
                            background:String(form.FixedPriceCodeID)===String(pc.id)?'var(--primary-light)':'transparent',
                            fontSize:'.78rem',fontWeight:700,
                            color:String(form.FixedPriceCodeID)===String(pc.id)?'var(--primary-dark)':'var(--text-muted)',
                            userSelect:'none',transition:'all .15s'}}>
                            <input type="radio" name="FixedPriceCodeID" value={pc.id}
                              checked={String(form.FixedPriceCodeID)===String(pc.id)}
                              onChange={change} disabled={isReadOnly}
                              style={{accentColor:BRAND}}/>
                            <span>{pc.DisplayLabel}</span>
                          </label>
                        ))}
                        <button type="button" onClick={()=>setShowPriceRef(true)}
                          style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',fontSize:'.72rem',fontWeight:700,padding:'.28rem .4rem',textDecoration:'underline',textUnderlineOffset:2,alignSelf:'center',whiteSpace:'nowrap'}}>
                          📊 View Price Codes
                        </button>
                      </div>
                      <FErr msg={errors.FixedPriceCodeID}/>
                    </F>
                  </div>
                )}
              </div>
            </div>

            {/* Audit Info */}
            {isEdit && createdInfo && (
              <div style={{marginTop:'.65rem',padding:'.45rem .75rem',background:'var(--bg-soft)',
                borderRadius:'var(--radius)',fontSize:'.73rem',color:'var(--text-muted)',display:'flex',gap:'2rem',flexWrap:'wrap'}}>
                <span>Created by: <strong>{createdInfo.CreatedBy}</strong></span>
                <span>Created on: <strong>{createdInfo.CreatedOn?new Date(createdInfo.CreatedOn).toLocaleString('en-IN'):'—'}</strong></span>
              </div>
            )}
          </div>
        </div>

        <div className="form-actions-bar customer-form-actions animate-in">
          <button type="button" className="btn btn-outline-secondary" onClick={() => goBackAfterCustomerEntry()} disabled={saving}>Cancel</button>
          {!isReadOnly && (
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving?<><Spin/> Saving…</>:(isEdit?'Update Customer':'Save Customer')}
            </button>
          )}
        </div>
      </form>
    </Layout>
  );
};

export default CustomerForm;
