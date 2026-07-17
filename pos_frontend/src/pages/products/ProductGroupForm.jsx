import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import LoadingSpinner from '../../components/LoadingSpinner';
import productGroupService from '../../services/productGroupService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

/* ─── Icons ─── */
const FolderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);
const SaveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
);
const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  </svg>
);

const Req = () => <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>;

const spinEl = (
  <span style={{
    display: 'inline-block', width: 14, height: 14,
    border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff',
    borderRadius: '50%', animation: 'spin .6s linear infinite', flexShrink: 0,
  }} />
);

const ProductGroupForm = () => {
  const navigate    = useNavigate();
  const { id }      = useParams();
  const { isAdmin } = useAuth();
  const toast       = useToast();
  const isEdit      = id !== undefined && id !== 'new';

  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [errors,      setErrors]      = useState({});
  const [apiError,    setApiError]    = useState('');
  const [groupName,   setGroupName]   = useState('');
  const [hsnCode,     setHsnCode]     = useState('');
  const [gstPercent,  setGstPercent]  = useState('');
  const [createdInfo, setCreatedInfo] = useState(null);

  /* Load existing group on edit */
  useEffect(() => {
    if (!isEdit) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await productGroupService.getGroup(id);
        setGroupName(data.GroupName || '');
        setHsnCode(data.HSNCode || '');
        setGstPercent(data.GSTPercent != null ? String(data.GSTPercent) : '');
        setCreatedInfo({
          CreatedBy: data.CreatedByUsername || data.CreatedBy || '',
          CreatedOn: data.CreatedOn,
        });
      } catch (err) {
        setApiError(err.response?.data?.detail || 'Failed to load group.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEdit]);

  const handleChange = useCallback((e) => {
    setGroupName(e.target.value);
    if (errors.GroupName) setErrors({});
    if (apiError)         setApiError('');
  }, [errors, apiError]);

  const clearFieldError = useCallback((field) => {
    if (errors[field]) setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
    if (apiError) setApiError('');
  }, [errors, apiError]);

  const validate = () => {
    const next = {};
    const gst = String(gstPercent).trim();
    if (!groupName.trim()) next.GroupName = 'Group name is required.';
    if (!hsnCode.trim()) next.HSNCode = 'HSN Code is required.';
    if (!gst) next.GSTPercent = 'GST % is required.';
    else if (!/^\d+$/.test(gst)) next.GSTPercent = 'GST % must be a valid number.';
    else if (Number(gst) < 0 || Number(gst) > 100) next.GSTPercent = 'GST % must be between 0 and 100.';
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    setApiError('');
    try {
      const payload = {
        GroupName: groupName.trim(),
        HSNCode: hsnCode.trim(),
        GSTPercent: Number(gstPercent),
      };
      if (isEdit) {
        await productGroupService.updateGroup(id, payload);
        toast.success('Updated Successfully', 'Group updated successfully.');
      } else {
        await productGroupService.createGroup(payload);
        toast.success('Saved Successfully', 'Group created successfully.');
      }
      setTimeout(() => navigate('/products/groups'), 1200);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const fieldErrors = {};
        Object.entries(data).forEach(([k, v]) => {
          fieldErrors[k] = Array.isArray(v) ? v[0] : v;
        });
        setErrors(fieldErrors);
        setApiError('Please fix the errors below.');
      } else {
        setApiError(data?.detail || 'Failed to save group. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout><LoadingSpinner message="Loading group…" /></Layout>;

  const isReadOnly = isEdit && !isAdmin;

  return (
    <Layout>
      {/* Page Header */}
      <div className="page-header animate-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-outline-secondary btn-sm"
            onClick={() => navigate('/products/groups')}>
            <BackIcon /> Groups
          </button>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
              {isEdit ? (isAdmin ? 'Edit Group' : 'View Group') : 'Add Product Group'}
            </h2>
            <p className="page-header-sub">
              {isEdit
                ? isAdmin ? 'Update group name' : 'Viewing group (read-only — Admin required to edit)'
                : 'Create a new product group / category'}
            </p>
          </div>
        </div>
      </div>

      {apiError && (
        <div className="alert alert-warning animate-in">
          <span>⚠️</span><span>{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="pf-card animate-in animate-in-1" style={{ maxWidth: 560 }}>
          <div className="pf-card-header">
            <span className="pf-card-header-icon"><FolderIcon /></span>
            <span className="pf-card-header-title">Group Information</span>
          </div>
          <div className="pf-card-body">

            {/* Group Name */}
            <div style={{ marginBottom: '1rem' }}>
              <label className="pf-label" htmlFor="pg-name">
                Group Name <Req />
              </label>
              <input
                id="pg-name"
                type="text"
                className={`pf-input${errors.GroupName ? ' pf-input--error' : ''}`}
                placeholder="e.g. Grains, Dairy, Beverages…"
                value={groupName}
                onChange={handleChange}
                disabled={isReadOnly}
                autoFocus={!isEdit}
                maxLength={200}
              />
              {errors.GroupName
                ? <div className="pf-field-error">{errors.GroupName}</div>
                : <div className="pf-field-hint">Max 200 characters</div>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem', marginBottom: '1rem' }}>
              <div>
                <label className="pf-label" htmlFor="pg-hsn">
                  HSN Code <Req />
                </label>
                <input
                  id="pg-hsn"
                  type="text"
                  className={`pf-input${errors.HSNCode ? ' pf-input--error' : ''}`}
                  placeholder="e.g. 1905"
                  value={hsnCode}
                  onChange={e => { setHsnCode(e.target.value); clearFieldError('HSNCode'); }}
                  disabled={isReadOnly}
                  maxLength={20}
                />
                {errors.HSNCode && <div className="pf-field-error">{errors.HSNCode}</div>}
              </div>
              <div>
                <label className="pf-label" htmlFor="pg-gst">
                  GST % <Req />
                </label>
                <input
                  id="pg-gst"
                  type="text"
                  inputMode="numeric"
                  className={`pf-input${errors.GSTPercent ? ' pf-input--error' : ''}`}
                  placeholder="0"
                  value={gstPercent}
                  onChange={e => { setGstPercent(e.target.value); clearFieldError('GSTPercent'); }}
                  disabled={isReadOnly}
                  maxLength={3}
                />
                {errors.GSTPercent && <div className="pf-field-error">{errors.GSTPercent}</div>}
              </div>
            </div>

            {/* Audit Info (edit mode) */}
            {isEdit && createdInfo && (
              <div style={{
                padding: '.65rem 1rem', background: 'var(--bg-soft)',
                borderRadius: 'var(--radius)', fontSize: '.8rem',
                color: 'var(--text-muted)', display: 'flex', gap: '2rem', flexWrap: 'wrap',
                marginBottom: '1rem',
              }}>
                <span>Created by: <strong>{createdInfo.CreatedBy}</strong></span>
                <span>Created on: <strong>
                  {createdInfo.CreatedOn
                    ? new Date(createdInfo.CreatedOn).toLocaleString('en-IN')
                    : '—'}
                </strong></span>
              </div>
            )}

          </div>
        </div>

        {/* Action Buttons */}
        {!isReadOnly ? (
          <div className="form-actions-bar animate-in animate-in-2" style={{ maxWidth: 560, margin: '1rem auto 0' }}>
            <button type="button" className="btn btn-outline-secondary"
              onClick={() => navigate('/products/groups')} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving
                ? <>{spinEl} Saving…</>
                : <><SaveIcon /> {isEdit ? 'Update Group' : 'Save Group'}</>
              }
            </button>
          </div>
        ) : (
          <div className="form-actions-bar animate-in animate-in-2" style={{ maxWidth: 560, margin: '1rem auto 0' }}>
            <button type="button" className="btn btn-outline-secondary"
              onClick={() => navigate('/products/groups')}>
              Back to Groups
            </button>
          </div>
        )}
      </form>
    </Layout>
  );
};

export default ProductGroupForm;
