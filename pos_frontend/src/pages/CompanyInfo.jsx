import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import companyService from '../services/companyService';
import { useAuth } from '../context/AuthContext';

const IcBuilding = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    <rect x="2" y="7" width="20" height="14" rx="2"/>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);
const IcSave = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
);
const Spin = () => (
  <span style={{ display:'inline-block',width:13,height:13,
    border:'2px solid rgba(255,255,255,.35)',borderTopColor:'#fff',
    borderRadius:'50%',animation:'spin .6s linear infinite' }} />
);

const GST_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const EMPTY = { CompanyName:'', IsGSTEnabled:false, GSTNo:'', PhoneNumber:'', EmailId:'', Address:'' };

const CompanyInfo = () => {
  const { isAdmin } = useAuth();
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [companyId,   setCompanyId]   = useState(null);
  const [form,        setForm]        = useState(EMPTY);
  const [errors,      setErrors]      = useState({});
  const [toast,       setToast]       = useState(null);
  const [createdInfo, setCreatedInfo] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await companyService.getCompanyInfo();
        const list = data.results ?? (Array.isArray(data) ? data : []);
        if (list.length > 0) {
          const c = list[0];
          setCompanyId(c.id);
          setForm({
            CompanyName:  c.CompanyName   || '',
            IsGSTEnabled: c.IsGSTEnabled  || false,
            GSTNo:        c.GSTNo         || '',
            PhoneNumber:  c.PhoneNumber   || '',
            EmailId:      c.EmailId       || '',
            Address:      c.Address       || '',
          });
          setCreatedInfo({ CreatedBy: c.CreatedByUsername || '', CreatedOn: c.CreatedOn });
        }
      } catch { /* no company yet */ }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : (name === 'GSTNo' ? value.toUpperCase() : value);
    setForm(p => ({ ...p, [name]: val }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: '' }));
  }, [errors]);

  const validate = () => {
    const e = {};
    if (!form.CompanyName.trim()) e.CompanyName = 'Company name is required.';
    if (!form.PhoneNumber.trim()) e.PhoneNumber = 'Phone number is required.';
    if (!form.EmailId.trim())     e.EmailId     = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.EmailId)) e.EmailId = 'Enter a valid email.';
    if (form.IsGSTEnabled) {
      if (!form.GSTNo.trim()) {
        e.GSTNo = 'GST Number is required when GST is enabled.';
      } else if (form.GSTNo.trim().length !== 15) {
        e.GSTNo = 'GST Number must be exactly 15 characters.';
      } else if (!form.GSTNo.trim().slice(0, 2).match(/^\d{2}$/)) {
        e.GSTNo = 'GST Number must start with a valid 2-digit state code.';
      }
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.IsGSTEnabled) payload.GSTNo = null;
      let result;
      if (companyId) {
        result = await companyService.updateCompanyInfo(companyId, payload);
      } else {
        result = await companyService.createCompanyInfo(payload);
        setCompanyId(result.id);
      }
      setCreatedInfo({ CreatedBy: result.CreatedByUsername || '', CreatedOn: result.CreatedOn });
      setToast({ type: 'success', msg: '✅ Company information saved successfully!' });
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const fe = {};
        Object.entries(data).forEach(([k, v]) => { fe[k] = Array.isArray(v) ? v[0] : String(v); });
        setErrors(fe);
      }
      setToast({ type: 'error', msg: '❌ Failed to save. Please fix the errors.' });
    } finally { setSaving(false); }
  };

  if (loading) return <Layout><LoadingSpinner message="Loading company information…" /></Layout>;

  return (
    <Layout>
      {toast && (
        <div style={{
          position:'fixed',bottom:'1.75rem',right:'1.75rem',zIndex:9999,
          padding:'.875rem 1.25rem',borderRadius:12,
          background:toast.type==='success'?'var(--success-light)':'var(--danger-light)',
          border:`1px solid ${toast.type==='success'?'rgba(46,125,50,.3)':'rgba(211,47,47,.3)'}`,
          color:toast.type==='success'?'var(--success-dark)':'var(--danger-dark)',
          boxShadow:'0 8px 32px rgba(0,0,0,.14)',fontSize:'.875rem',fontWeight:600,
          minWidth:280,display:'flex',alignItems:'center',justifyContent:'space-between',gap:'1rem',
        }} role="alert">
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1rem',lineHeight:1}}>✕</button>
        </div>
      )}

      <div className="page-header animate-in">
        <div>
          <h2 style={{ fontFamily:'var(--font-heading)',fontWeight:800 }}>Company Information</h2>
          <p className="page-header-sub">
            {companyId ? 'Update your company details' : 'Set up your company profile'}
            {!isAdmin && <span style={{ color:'var(--warning-dark)',fontWeight:600 }}> — View only (Admin required to edit)</span>}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* Basic Info */}
        <div className="card animate-in animate-in-1" style={{ marginBottom:'1.25rem' }}>
          <div className="card-body">
            <div className="section-subtitle"><IcBuilding /> Basic Information</div>
            <div className="form-group">
              <label className="form-label">Company Name <span style={{color:'var(--danger)'}}>*</span></label>
              <input name="CompanyName" type="text"
                className={`form-control${errors.CompanyName?' is-invalid':''}`}
                placeholder="e.g. Banu Stores" value={form.CompanyName}
                onChange={handleChange} disabled={!isAdmin} style={{maxWidth:480}}/>
              {errors.CompanyName && <div className="invalid-feedback">{errors.CompanyName}</div>}
            </div>
            <div className="row">
              <div className="col-6">
                <div className="form-group">
                  <label className="form-label">Phone Number <span style={{color:'var(--danger)'}}>*</span></label>
                  <input name="PhoneNumber" type="text"
                    className={`form-control${errors.PhoneNumber?' is-invalid':''}`}
                    placeholder="10-digit mobile" value={form.PhoneNumber}
                    onChange={handleChange} disabled={!isAdmin}/>
                  {errors.PhoneNumber && <div className="invalid-feedback">{errors.PhoneNumber}</div>}
                </div>
              </div>
              <div className="col-6">
                <div className="form-group">
                  <label className="form-label">Email <span style={{color:'var(--danger)'}}>*</span></label>
                  <input name="EmailId" type="email"
                    className={`form-control${errors.EmailId?' is-invalid':''}`}
                    placeholder="store@example.com" value={form.EmailId}
                    onChange={handleChange} disabled={!isAdmin}/>
                  {errors.EmailId && <div className="invalid-feedback">{errors.EmailId}</div>}
                </div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Address <span style={{color:'var(--text-muted)',fontWeight:400}}>(optional)</span></label>
              <textarea name="Address" className="form-control"
                placeholder="Street, City, State, PIN Code" value={form.Address}
                onChange={handleChange} disabled={!isAdmin} style={{minHeight:80}}/>
            </div>
          </div>
        </div>

        {/* GST Info */}
        <div className="card animate-in animate-in-2" style={{ marginBottom:'1.25rem' }}>
          <div className="card-body">
            <div className="section-subtitle">🧾 GST Information</div>
            <div className="form-group">
              <label className="form-label">GST Registration</label>
              <div style={{display:'flex',alignItems:'center',gap:'1rem',paddingTop:'.25rem'}}>
                <label style={{
                  display:'flex',alignItems:'center',gap:'.6rem',
                  padding:'.5rem 1.1rem',
                  border:`1.5px solid ${form.IsGSTEnabled?'var(--success-dark)':'var(--border-input)'}`,
                  borderRadius:'var(--radius)',
                  background:form.IsGSTEnabled?'#e8f5e9':'transparent',
                  cursor:isAdmin?'pointer':'default',
                  fontWeight:600,fontSize:'.875rem',
                  color:form.IsGSTEnabled?'var(--success-dark)':'var(--text-label)',
                  userSelect:'none',
                }}>
                  <input type="checkbox" name="IsGSTEnabled"
                    checked={form.IsGSTEnabled} onChange={handleChange} disabled={!isAdmin}
                    style={{width:16,height:16,accentColor:'var(--success-dark)',cursor:isAdmin?'pointer':'default'}}/>
                  {form.IsGSTEnabled ? '✓ GST Registered' : 'GST Registered'}
                </label>
                {form.IsGSTEnabled && (
                  <span style={{fontSize:'.8rem',color:'var(--success-dark)',fontWeight:500}}>
                    GST Number is required
                  </span>
                )}
              </div>
            </div>

            {form.IsGSTEnabled && (
              <div className="form-group" style={{maxWidth:380}}>
                <label className="form-label">
                  Company GST Number <span style={{color:'var(--danger)'}}>*</span>
                </label>
                <input name="GSTNo" type="text"
                  className={`form-control${errors.GSTNo?' is-invalid':''}`}
                  placeholder="33ABCDE1234F1Z5  (15-char GSTIN)"
                  value={form.GSTNo} onChange={handleChange} disabled={!isAdmin}
                  maxLength={15}
                  style={{fontFamily:'ui-monospace,monospace',letterSpacing:'.06em'}}/>
                {errors.GSTNo && <div className="invalid-feedback">{errors.GSTNo}</div>}
                {!errors.GSTNo && form.GSTNo.length === 2 && (
                  <div style={{fontSize:'.75rem',color:'var(--text-muted)',marginTop:'.25rem'}}>
                    State code: <strong>{form.GSTNo.slice(0,2)}</strong>
                  </div>
                )}
                {!errors.GSTNo && form.GSTNo.length >= 2 && form.GSTNo.slice(0,2).match(/^\d{2}$/) && (
                  <div style={{fontSize:'.75rem',color:'var(--success-dark)',marginTop:'.25rem'}}>
                    ✓ State code: <strong>{form.GSTNo.slice(0,2)}</strong>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {createdInfo && (
          <div style={{marginBottom:'1.25rem',padding:'.75rem 1rem',background:'var(--bg-soft)',
            borderRadius:'var(--radius)',fontSize:'.8rem',color:'var(--text-muted)',
            display:'flex',gap:'2rem',flexWrap:'wrap'}}>
            <span>Created by: <strong>{createdInfo.CreatedBy || '—'}</strong></span>
            <span>Created on: <strong>{createdInfo.CreatedOn ? new Date(createdInfo.CreatedOn).toLocaleString('en-IN') : '—'}</strong></span>
          </div>
        )}

        {isAdmin ? (
          <div className="form-actions-bar animate-in">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setForm(EMPTY)} disabled={saving}>Reset</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><Spin /> Saving…</> : <><IcSave /> {companyId ? 'Update Company Info' : 'Save Company Info'}</>}
            </button>
          </div>
        ) : (
          <div style={{padding:'.75rem 1rem',background:'#fff8e1',border:'1px solid #ffe082',
            borderRadius:'var(--radius)',fontSize:'.875rem',color:'#f57f17',fontWeight:500}}>
            ⚠ You need <strong>Admin</strong> role to edit company information.
          </div>
        )}
      </form>
    </Layout>
  );
};

export default CompanyInfo;
