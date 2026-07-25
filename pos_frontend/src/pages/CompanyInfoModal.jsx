/** CompanyInfoModal — blurred-backdrop modal for viewing/editing CompanyInfo_tbl.*/

import { useState, useEffect, useCallback, useRef } from 'react';
import companyService from '../services/companyService';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';

const BRAND    = '#8A5125';
const PHONE_10 = /^[6-9]\d{9}$/;
const GST_RE   = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/* ── Icons ── */
const IcX      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcEdit   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IcTrash  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
const IcSave   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const IcBuild  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
const IcUpload = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>;
const IcHistory = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/><polyline points="12 7 12 12 15 14"/></svg>;

const Spin = () => (
  <span style={{display:'inline-block',width:13,height:13,
    border:'2px solid rgba(255,255,255,.35)',borderTopColor:'#fff',
    borderRadius:'50%',animation:'spin .6s linear infinite'}}/>
);

const EMPTY = {
  CompanyName: '', PhoneNumber: '', Email: '', Address: '',
  IsGSTRegistered: false, GSTNumber: '',
};

/* ── Field wrapper ── */
const FLD = ({ label, required, error, children }) => (
  <div style={{marginBottom:'.5rem'}}>
    <label style={{display:'block',fontWeight:700,fontSize:'.73rem',
      color:'var(--text-label)',marginBottom:'.22rem'}}>
      {label}{required && <span style={{color:'var(--danger)',marginLeft:2}}>*</span>}
    </label>
    {children}
    {error && <div style={{fontSize:'.68rem',color:'var(--danger)',
      marginTop:'.18rem',fontWeight:500}}>{error}</div>}
  </div>
);

/* ── Toast ── */
const Toast = ({ result, onClose }) => {
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(onClose, 2000);
    return () => clearTimeout(t);
  }, [result, onClose]);

  if (!result) return null;
  const ok = result.type === 'success';
  return (
    <div style={{
      position:'fixed',top:'1.25rem',right:'1.75rem',zIndex:9999,
      display:'flex',alignItems:'center',gap:'.75rem',
      padding:'.875rem 1.25rem',borderRadius:12,
      background: ok ? '#E8F5E9' : '#FFEBEE',
      border:`1px solid ${ok?'rgba(46,125,50,.22)':'rgba(211,47,47,.22)'}`,
      color: ok ? '#1B5E20' : '#B71C1C',
      boxShadow:'0 8px 32px rgba(0,0,0,.12)',
      minWidth:260,fontSize:'.875rem',fontWeight:600,
      animation:'fadeInUp .2s ease-out',
    }}>
      <span style={{width:28,height:28,borderRadius:'50%',background:'rgba(255,255,255,.6)',
        display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        {ok
          ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><polyline points="20 6 9 17 4 12"/></svg>
          : <IcX/>
        }
      </span>
      <div>
        <div style={{fontWeight:700,marginBottom:'.1rem'}}>
          {ok ? (result.action==='update'?'Updated Successfully':'Saved Successfully')
              : (result.action==='update'?'Update Failed':'Save Failed')}
        </div>
        <div style={{fontSize:'.8rem',opacity:.85}}>{result.msg}</div>
      </div>
    </div>
  );
};

const CompanyInfoModal = ({ onClose }) => {
  const { isAdmin }             = useAuth();
  const { refreshCompanyInfo }  = useCompany();

  const [loading,      setLoading]     = useState(true);
  const [saving,       setSaving]      = useState(false);
  const [deleting,     setDeleting]    = useState(false);
  const [editing,      setEditing]     = useState(false);
  const [companyId,    setCompanyId]   = useState(null);
  const [companyCode,  setCompanyCode] = useState('');
  const [form,         setForm]        = useState(EMPTY);
  const [errors,       setErrors]      = useState({});
  const [toast,        setToast]       = useState(null);
  const [logoFile,     setLogoFile]    = useState(null);
  const [logoPreview,  setLogoPreview] = useState(null);
  const [existingLogo, setExistingLogo]= useState(null);
  const [confirmDel,   setConfirmDel]  = useState(false);
  const [historyOpen,  setHistoryOpen] = useState(false);
  const [history,      setHistory]     = useState([]);
  const [historyLoad,  setHistoryLoad] = useState(false);
  const fileRef = useRef(null);

  const ci = { height:32, padding:'.28rem .6rem', fontSize:'.81rem' };

  /* ── Load company data from CompanyInfo_tbl ── */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await companyService.getCompanyConfig();
        if (data && data.id) {
          setCompanyId(data.id);
          setCompanyCode(data.CompanyCode || `COM_${String(data.id).padStart(3,'0')}`);
          setForm({
            CompanyName:     data.CompanyName     || '',
            PhoneNumber:     data.PhoneNumber     || '',
            Email:           data.Email           || '',
            Address:         data.Address         || '',
            IsGSTRegistered: data.IsGSTRegistered || false,
            GSTNumber:       data.GSTNumber       || '',
          });
          setExistingLogo(data.CompanyLogo || null);
        } else {
          // No record yet — fetch the next code preview
          if (isAdmin) {
            companyService.getNextCode()
              .then(c => setCompanyCode(c))
              .catch(() => setCompanyCode('COM_001'));
            setEditing(true);
          }
        }
      } catch {
        if (isAdmin) {
          companyService.getNextCode()
            .then(c => setCompanyCode(c))
            .catch(() => setCompanyCode('COM_001'));
          setEditing(true);
        }
      }
      finally { setLoading(false); }
    };
    load();
  }, [isAdmin]);

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    let val = type === 'checkbox' ? checked : value;
    if (name === 'PhoneNumber') val = value.replace(/\D/g,'').slice(0,10);
    if (name === 'GSTNumber')   val = value.toUpperCase().slice(0,15);
    setForm(p => ({...p, [name]: val}));
    if (errors[name]) setErrors(p => ({...p, [name]:''}));
  }, [errors]);

  const validatePhoneBlur = () => {
    const d = form.PhoneNumber.replace(/\D/g,'');
    if (form.PhoneNumber && !PHONE_10.test(d))
      setErrors(p => ({...p, PhoneNumber:'Enter a valid 10-digit mobile number.'}));
  };

  const validate = () => {
    const e = {};
    if (!form.CompanyName.trim()) e.CompanyName = 'Company name is required.';
    if (!form.PhoneNumber.trim()) {
      e.PhoneNumber = 'Phone number is required.';
    } else if (!PHONE_10.test(form.PhoneNumber.replace(/\D/g,''))) {
      e.PhoneNumber = 'Enter a valid 10-digit mobile number.';
    }
    // Email is optional — only validate format when provided
    if (form.Email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.Email.trim())) {
      e.Email = 'Enter a valid email address.';
    }
    if (!form.Address.trim()) e.Address = 'Address is required.';
    if (form.IsGSTRegistered) {
      if (!form.GSTNumber.trim()) {
        e.GSTNumber = 'GST Number is required.';
      } else if (!GST_RE.test(form.GSTNumber.trim().toUpperCase())) {
        e.GSTNumber = 'Invalid GST Number format (e.g. 33AAACC9092M1ZC).';
      }
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    const isUpdate = Boolean(companyId);
    try {
      const fd = new FormData();
      fd.append('CompanyName',     form.CompanyName.trim());
      fd.append('PhoneNumber',     form.PhoneNumber.replace(/\D/g,''));
      fd.append('Email',           form.Email.trim());   // empty string → backend stores NULL
      fd.append('Address',         form.Address.trim());
      fd.append('IsGSTRegistered', form.IsGSTRegistered);
      fd.append('GSTNumber',       form.IsGSTRegistered ? form.GSTNumber.trim().toUpperCase() : '');
      if (logoFile) fd.append('CompanyLogo', logoFile);

      let result;
      if (companyId) {
        result = await companyService.updateCompanyConfigForm(companyId, fd);
      } else {
        result = await companyService.createCompanyConfigForm(fd);
        setCompanyId(result.id);
      }

      // Update local state with backend response
      setForm({
        CompanyName:     result.CompanyName     || '',
        PhoneNumber:     result.PhoneNumber     || '',
        Email:           result.Email           || '',
        Address:         result.Address         || '',
        IsGSTRegistered: result.IsGSTRegistered || false,
        GSTNumber:       result.GSTNumber       || '',
      });
      setExistingLogo(result.CompanyLogo || null);
      setLogoFile(null); setLogoPreview(null); setEditing(false);

      // ── Notify all pages that company config changed ──
      refreshCompanyInfo();

      setToast({
        type:'success',
        action: isUpdate ? 'update' : 'save',
        msg: isUpdate ? 'Company information updated.' : 'Company information saved.',
      });
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const fe = {};
        Object.entries(data).forEach(([k,v]) => { fe[k] = Array.isArray(v)?v[0]:String(v); });
        setErrors(fe);
      }
      setToast({
        type:'error',
        action: isUpdate ? 'update' : 'save',
        msg:'Please fix the errors and try again.',
      });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!companyId) return;
    setDeleting(true);
    try {
      await companyService.deleteCompanyConfig(companyId);
      setCompanyId(null); setForm(EMPTY); setExistingLogo(null);
      setConfirmDel(false); setEditing(false);
      refreshCompanyInfo();
      setToast({type:'success',action:'save',msg:'Company info deleted.'});
    } catch {
      setToast({type:'error',action:'update',msg:'Failed to delete.'});
      setConfirmDel(false);
    } finally { setDeleting(false); }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const openHistory = async () => {
    setHistoryOpen(true);
    setHistoryLoad(true);
    try {
      const data = await companyService.getCompanyConfigHistory();
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoad(false);
    }
  };

  const fmtDt = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
      day:'2-digit', month:'short', year:'numeric',
      hour:'2-digit', minute:'2-digit',
    });
  };

  return (
    <>
      <Toast result={toast} onClose={() => setToast(null)}/>
      <div style={{
        position:'fixed',inset:0,zIndex:2000,
        background:'rgba(0,0,0,.35)',
        backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)',
        display:'flex',alignItems:'center',justifyContent:'center',
        padding:'1rem',animation:'fadeIn .15s ease-out',
      }} onClick={onClose}>
        <div style={{
          background:'var(--card-bg)',borderRadius:12,
          boxShadow:'0 20px 60px rgba(0,0,0,.18)',
          width:'100%',maxWidth:520,
          border:'1px solid var(--border)',
          animation:'slideUp .2s ease-out',
          maxHeight:'90vh',overflowY:'auto',
          position:'relative',
        }} onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div style={{padding:'.875rem 1.25rem',borderBottom:'1px solid var(--divider)',
            display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:'.5rem'}}>
              <span style={{color:BRAND}}><IcBuild/></span>
              <span style={{fontWeight:800,fontSize:'.9375rem',color:'var(--text-primary)',fontFamily:'var(--font-heading)'}}>
                Company Information
              </span>
              {!isAdmin && (
                <span style={{fontSize:'.68rem',color:'var(--text-muted)',fontWeight:400,marginLeft:'.5rem'}}>
                  (View only)
                </span>
              )}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'.35rem'}}>
              {isAdmin && !editing && companyId && (
                <>
                  <button title="History" onClick={openHistory} style={{
                    background:'var(--scale-100)',border:'none',borderRadius:6,
                    width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',
                    cursor:'pointer',color:'var(--text-muted)'}}>
                    <IcHistory/>
                  </button>
                  <button title="Edit" onClick={() => setEditing(true)} style={{
                    background:'var(--scale-100)',border:'none',borderRadius:6,
                    width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',
                    cursor:'pointer',color:'var(--primary)'}}>
                    <IcEdit/>
                  </button>
                  <button title="Delete" onClick={() => setConfirmDel(true)} style={{
                    background:'var(--danger-light)',border:'none',borderRadius:6,
                    width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',
                    cursor:'pointer',color:'var(--danger)'}}>
                    <IcTrash/>
                  </button>
                </>
              )}
              <button title="Close" onClick={onClose} style={{
                background:'var(--scale-100)',border:'none',borderRadius:6,
                width:32,height:32,display:'inline-flex',alignItems:'center',justifyContent:'center',
                cursor:'pointer',color:'var(--text-muted)'}}>
                <IcX/>
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{padding:'1rem 1.25rem 1.25rem'}}>
            {loading ? (
              <div style={{textAlign:'center',padding:'2rem',color:'var(--text-muted)'}}>Loading…</div>

            ) : !editing ? (
              companyId ? (
                <div>
                  {existingLogo && (
                    <div style={{textAlign:'center',marginBottom:'.875rem'}}>
                      <img src={existingLogo} alt="Company Logo"
                        style={{maxHeight:72,maxWidth:'100%',borderRadius:8,objectFit:'contain'}}/>
                    </div>
                  )}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.5rem .875rem',marginBottom:'.75rem'}}>
                    {[
                      {label:'Company Code', value: companyCode || '—'},
                      {label:'Company Name', value: form.CompanyName},
                      {label:'Phone Number', value: form.PhoneNumber},
                      {label:'Email',        value: form.Email    || '—'},
                      {label:'Address',      value: form.Address  || '—'},
                    ].map(({label,value}) => (
                      <div key={label} style={{fontSize:'.82rem'}}>
                        <div style={{color:'var(--text-muted)',fontSize:'.7rem',fontWeight:600,marginBottom:'.15rem'}}>{label}</div>
                        <div style={{
                          color:'var(--text-primary)',fontWeight:600,
                          ...(label==='Company Code' ? {fontFamily:'ui-monospace,monospace',color:'var(--primary-dark)'} : {}),
                        }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:'.82rem',display:'flex',alignItems:'center',gap:'.5rem'}}>
                    <input type="checkbox" checked={form.IsGSTRegistered} readOnly
                      style={{accentColor:BRAND,width:14,height:14,pointerEvents:'none'}}/>
                    <span style={{fontWeight:600,color:form.IsGSTRegistered?'var(--success-dark)':'var(--text-muted)'}}>
                      {form.IsGSTRegistered
                        ? `GST Registered  ·  ${form.GSTNumber}`
                        : 'Not GST Registered'}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{textAlign:'center',padding:'2rem',color:'var(--text-muted)',fontSize:'.85rem'}}>
                  {isAdmin
                    ? <><div style={{marginBottom:'.75rem'}}>No company information set up yet.</div>
                        <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>Set Up Now</button></>
                    : 'No company information has been configured yet.'}
                </div>
              )

            ) : (
              /* ── Edit / Create form ── */
              <form onSubmit={handleSubmit} noValidate>

                {/* Company Code — read-only, auto-generated */}
                <div style={{marginBottom:'.65rem'}}>
                  <label style={{display:'block',fontWeight:700,fontSize:'.73rem',
                    color:'var(--text-label)',marginBottom:'.22rem'}}>
                    Company Code
                  </label>
                  <input
                    type="text" readOnly tabIndex={-1}
                    value={companyCode || '…'}
                    style={{
                      ...ci, width:'100%',
                      fontFamily:'ui-monospace,monospace',fontSize:'.81rem',
                      background:'var(--bg-soft)',color:'var(--text-muted)',
                      cursor:'not-allowed',border:'1px solid var(--border)',borderRadius:'var(--radius)',
                    }}
                  />
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem'}}>
                  <FLD label="Company Name" required error={errors.CompanyName}>
                    <input name="CompanyName" type="text"
                      className={`form-control${errors.CompanyName?' is-invalid':''}`}
                      placeholder="e.g. Banu Stores"
                      value={form.CompanyName} onChange={handleChange} style={ci}/>
                  </FLD>
                  <FLD label="Phone Number (10 digits)" required error={errors.PhoneNumber}>
                    <input name="PhoneNumber" type="tel" inputMode="numeric" maxLength={10}
                      className={`form-control${errors.PhoneNumber?' is-invalid':''}`}
                      placeholder="10-digit mobile"
                      value={form.PhoneNumber} onChange={handleChange}
                      onKeyDown={e => {
                        if (!/^[0-9]$/.test(e.key) &&
                          !['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Enter'].includes(e.key))
                          e.preventDefault();
                      }}
                      onBlur={validatePhoneBlur}
                      style={{...ci, borderColor:errors.PhoneNumber?'var(--danger)':undefined}}/>
                  </FLD>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem'}}>
                  <FLD label="Email (optional)" error={errors.Email}>
                    <input name="Email" type="email"
                      className={`form-control${errors.Email?' is-invalid':''}`}
                      placeholder="store@example.com (optional)"
                      value={form.Email} onChange={handleChange} style={ci}/>
                  </FLD>
                  <FLD label="Address" required error={errors.Address}>
                    <input name="Address" type="text"
                      className={`form-control${errors.Address?' is-invalid':''}`}
                      placeholder="Street, City"
                      value={form.Address} onChange={handleChange} style={ci}/>
                  </FLD>
                </div>

                {/* GST toggle */}
                <div style={{marginBottom:'.5rem'}}>
                  <label style={{display:'flex',alignItems:'center',gap:'.45rem',cursor:'pointer',
                    fontSize:'.82rem',fontWeight:600,
                    color:form.IsGSTRegistered?BRAND:'var(--text-label)',userSelect:'none'}}>
                    <input type="checkbox" name="IsGSTRegistered"
                      checked={form.IsGSTRegistered} onChange={handleChange}
                      style={{width:14,height:14,accentColor:BRAND,cursor:'pointer'}}/>
                    GST Registered
                  </label>
                </div>

                {form.IsGSTRegistered && (
                  <FLD label="GST Number" required error={errors.GSTNumber}>
                    <input name="GSTNumber" type="text"
                      className={`form-control${errors.GSTNumber?' is-invalid':''}`}
                      placeholder="e.g. 33AAACC9092M1ZC"
                      value={form.GSTNumber} onChange={handleChange}
                      style={{...ci,fontFamily:'ui-monospace,monospace',textTransform:'uppercase'}}
                      maxLength={15}/>
                    <div style={{fontSize:'.67rem',color:'var(--text-muted)',marginTop:'.15rem'}}>
                      Format: 2-digit state code + PAN + entity number + Z + check digit
                    </div>
                  </FLD>
                )}

                {/* Logo upload */}
                <div style={{marginBottom:'.75rem'}}>
                  <label style={{display:'block',fontWeight:700,fontSize:'.73rem',
                    color:'var(--text-label)',marginBottom:'.3rem'}}>
                    Company Logo <span style={{color:'var(--text-muted)',fontWeight:400}}>(optional)</span>
                  </label>
                  <div style={{display:'flex',alignItems:'center',gap:'.75rem'}}>
                    {(logoPreview || existingLogo) && (
                      <img src={logoPreview||existingLogo} alt="Logo preview"
                        style={{width:48,height:48,borderRadius:8,objectFit:'contain',
                          border:'1px solid var(--border)'}}/>
                    )}
                    <button type="button" onClick={() => fileRef.current?.click()} style={{
                      display:'flex',alignItems:'center',gap:'.4rem',
                      padding:'.28rem .7rem',borderRadius:6,
                      border:'1.5px dashed var(--border-input)',
                      background:'var(--scale-50)',color:'var(--text-muted)',
                      cursor:'pointer',fontSize:'.76rem',fontWeight:600}}>
                      <IcUpload/> {logoPreview||existingLogo?'Change':'Upload'} Logo
                    </button>
                    <input ref={fileRef} type="file" accept="image/*"
                      style={{display:'none'}} onChange={handleLogoChange}/>
                  </div>
                </div>

                {/* Actions */}
                <div style={{display:'flex',justifyContent:'center',gap:'.65rem',
                  paddingTop:'.5rem',borderTop:'1px solid var(--divider)',marginTop:'.5rem'}}>
                  <button type="button" className="btn btn-outline-secondary btn-sm"
                    onClick={() => { setEditing(false); setErrors({}); setLogoFile(null); setLogoPreview(null); }}
                    disabled={saving}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                    {saving ? <><Spin/> Saving…</> : <><IcSave/> {companyId?'Update':'Save'}</>}
                  </button>
                </div>
              </form>
            )}

            {/* Delete confirmation overlay */}
            {confirmDel && (
              <div style={{position:'absolute',inset:0,zIndex:10,
                background:'rgba(255,255,255,.92)',borderRadius:12,
                display:'flex',alignItems:'center',justifyContent:'center'}}>
                <div style={{textAlign:'center',padding:'2rem'}}>
                  <div style={{fontSize:'2rem',marginBottom:'.5rem'}}>⚠️</div>
                  <div style={{fontWeight:700,fontSize:'.9rem',marginBottom:'.4rem'}}>Delete Company Info?</div>
                  <div style={{fontSize:'.82rem',color:'var(--text-muted)',marginBottom:'1.25rem'}}>
                    This action cannot be undone.
                  </div>
                  <div style={{display:'flex',gap:'.65rem',justifyContent:'center'}}>
                    <button className="btn btn-outline-secondary btn-sm"
                      onClick={() => setConfirmDel(false)}>Cancel</button>
                    <button className="btn btn-danger btn-sm"
                      onClick={handleDelete} disabled={deleting}>
                      {deleting?'Deleting…':'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── History Popup ── */}
      {historyOpen && (
        <div style={{
          position:'fixed',inset:0,zIndex:3000,
          background:'rgba(0,0,0,.45)',
          backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)',
          display:'flex',alignItems:'center',justifyContent:'center',
          padding:'1rem',animation:'fadeIn .15s ease-out',
        }} onClick={() => setHistoryOpen(false)}>
          <div style={{
            background:'var(--card-bg)',borderRadius:12,
            boxShadow:'0 20px 60px rgba(0,0,0,.22)',
            width:'100%',maxWidth:600,
            border:'1px solid var(--border)',
            animation:'slideUp .2s ease-out',
            maxHeight:'82vh',display:'flex',flexDirection:'column',
          }} onClick={e => e.stopPropagation()}>

            {/* History Header */}
            <div style={{padding:'.875rem 1.25rem',borderBottom:'1px solid var(--divider)',
              display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:'.5rem'}}>
                <span style={{color:BRAND}}><IcHistory/></span>
                <span style={{fontWeight:800,fontSize:'.9375rem',color:'var(--text-primary)',
                  fontFamily:'var(--font-heading)'}}>Change History</span>
                {history.length > 0 && (
                  <span style={{
                    background:'var(--primary-light)',color:'var(--primary-dark)',
                    borderRadius:99,padding:'.1rem .55rem',
                    fontSize:'.68rem',fontWeight:700,marginLeft:'.25rem',
                  }}>{history.length}</span>
                )}
              </div>
              <button title="Close" onClick={() => setHistoryOpen(false)} style={{
                background:'var(--scale-100)',border:'none',borderRadius:6,
                width:32,height:32,display:'inline-flex',alignItems:'center',justifyContent:'center',
                cursor:'pointer',color:'var(--text-muted)'}}>
                <IcX/>
              </button>
            </div>

            {/* History Body */}
            <div style={{overflowY:'auto',flex:1,padding:'1rem 1.25rem'}}>
              {historyLoad ? (
                <div style={{textAlign:'center',padding:'2.5rem',color:'var(--text-muted)'}}>
                  Loading history…
                </div>
              ) : history.length === 0 ? (
                <div style={{textAlign:'center',padding:'2.5rem',color:'var(--text-muted)',fontSize:'.85rem'}}>
                  No change history yet. History is recorded on every update.
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:'.75rem'}}>
                  {history.map((h, idx) => (
                    <div key={h.id} style={{
                      border:'1px solid var(--border)',borderRadius:8,
                      padding:'.75rem 1rem',
                      background: idx === 0 ? 'var(--primary-light)' : 'var(--scale-50)',
                      borderLeft: `3px solid ${idx === 0 ? 'var(--primary)' : 'var(--border)'}`,
                    }}>
                      {/* Row: date + changed-by badge */}
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.5rem'}}>
                        <div style={{fontSize:'.75rem',fontWeight:700,
                          color: idx === 0 ? 'var(--primary-dark)' : 'var(--text-muted)'}}>
                          {fmtDt(h.ChangedOn)}
                          {idx === 0 && (
                            <span style={{marginLeft:'.4rem',background:'var(--primary)',color:'#fff',
                              borderRadius:99,padding:'.05rem .45rem',fontSize:'.62rem',fontWeight:800}}>
                              Latest
                            </span>
                          )}
                        </div>
                        <div style={{
                          display:'flex',alignItems:'center',gap:'.3rem',
                          background:'var(--card-bg)',border:'1px solid var(--border)',
                          borderRadius:99,padding:'.15rem .6rem',
                          fontSize:'.68rem',fontWeight:700,color:'var(--text-primary)',
                        }}>
                          <span style={{width:16,height:16,borderRadius:'50%',
                            background:'linear-gradient(135deg,var(--primary),var(--primary-dark))',
                            color:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center',
                            fontSize:'.55rem',fontWeight:800,flexShrink:0}}>
                            {(h.ChangedByUsername||'?').slice(0,2).toUpperCase()}
                          </span>
                          {h.ChangedByUsername || '—'}
                        </div>
                      </div>

                      {/* Fields grid */}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.3rem .875rem',marginBottom:'.4rem'}}>
                        {[
                          {label:'Company Name', value: h.CompanyName},
                          {label:'Phone',        value: h.PhoneNumber},
                          {label:'Email',        value: h.Email    || '—'},
                          {label:'Address',      value: h.Address  || '—'},
                        ].map(({label,value}) => (
                          <div key={label} style={{fontSize:'.79rem'}}>
                            <span style={{color:'var(--text-muted)',fontSize:'.68rem',fontWeight:600}}>{label}: </span>
                            <span style={{color:'var(--text-primary)',fontWeight:600}}>{value}</span>
                          </div>
                        ))}
                      </div>

                      {/* GST + logo row */}
                      <div style={{display:'flex',alignItems:'center',gap:'.4rem',flexWrap:'wrap'}}>
                        <span style={{
                          display:'inline-flex',alignItems:'center',gap:'.3rem',
                          padding:'.1rem .55rem',borderRadius:99,fontSize:'.68rem',fontWeight:700,
                          background: h.IsGSTRegistered ? 'rgba(46,125,50,.1)' : 'var(--scale-100)',
                          color:       h.IsGSTRegistered ? '#1B5E20'            : 'var(--text-muted)',
                          border:`1px solid ${h.IsGSTRegistered ? 'rgba(46,125,50,.2)' : 'var(--border)'}`,
                        }}>
                          {h.IsGSTRegistered ? '✓ GST' : 'No GST'}
                        </span>
                        {h.IsGSTRegistered && h.GSTNumber && (
                          <span style={{fontFamily:'ui-monospace,monospace',fontSize:'.75rem',
                            color:'var(--text-primary)',fontWeight:600}}>
                            {h.GSTNumber}
                          </span>
                        )}
                        {h.CompanyLogo && (
                          <img src={h.CompanyLogo} alt="" style={{
                            width:22,height:22,borderRadius:4,objectFit:'contain',
                            border:'1px solid var(--border)',marginLeft:'auto',
                          }}/>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CompanyInfoModal;
