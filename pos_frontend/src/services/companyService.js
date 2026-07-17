/**
 * Company Information service
 * Primary endpoints use /company-info/ (CompanyInfo_tbl)
 * Legacy /company/ endpoints kept for backward compatibility
 */
import api from './api';

let publicCompanyCache = null;
let publicCompanyPromise = null;

const clearCompanyCache = () => {
  publicCompanyCache = null;
  publicCompanyPromise = null;
};

window.addEventListener('pos-auth-cleared', clearCompanyCache);
window.addEventListener('pos-auth-ready', clearCompanyCache);

const companyService = {

  // ── New CompanyInfo_tbl endpoints ──────────────────────────────────────────

  /** Public — no auth. Used by Login page + ProductForm GST check. */
  getPublicCompanyInfo: async () => {
    if (publicCompanyCache) return publicCompanyCache;
    publicCompanyPromise = publicCompanyPromise || api.get('/company-info/public/', { skipAuth: true });
    const res = await publicCompanyPromise.finally(() => {
      publicCompanyPromise = null;
    });
    publicCompanyCache = res.data;
    return publicCompanyCache;
  },

  /** Authenticated — returns single company record or null */
  getCompanyConfig: async () => {
    const res = await api.get('/company-info/');
    return res.data;
  },

  /** Create (Admin only) — JSON */
  createCompanyConfig: async (data) => {
    const res = await api.post('/company-info/', data);
    return res.data;
  },

  /** Create with logo (Admin only) — FormData */
  createCompanyConfigForm: async (formData) => {
    const res = await api.post('/company-info/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  /** Update (Admin only) — JSON */
  updateCompanyConfig: async (id, data) => {
    const res = await api.put(`/company-info/${id}/`, data);
    return res.data;
  },

  /** Update with logo (Admin only) — FormData */
  updateCompanyConfigForm: async (id, formData) => {
    const res = await api.patch(`/company-info/${id}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  /** Delete (Admin only) */
  deleteCompanyConfig: async (id) => {
    const res = await api.delete(`/company-info/${id}/`);
    return res.data;
  },

  /** History — Admin only. Returns all snapshots, newest first. */
  getCompanyConfigHistory: async () => {
    const res = await api.get('/company-info/history/');
    return res.data;
  },

  /** Next code preview — Admin only. Returns the code the next record will get. */
  getNextCode: async () => {
    const res = await api.get('/company-info/next-code/');
    return res.data.next_code;
  },

  // ── Legacy /company/ endpoints (backward compat) ──────────────────────────

  getCompanyInfo: async () => {
    const res = await api.get('/company/');
    return res.data;
  },

  getCompanyInfoById: async (id) => {
    const res = await api.get(`/company/${id}/`);
    return res.data;
  },

  createCompanyInfo: async (data) => {
    const res = await api.post('/company/', data);
    return res.data;
  },

  createCompanyInfoForm: async (formData) => {
    const res = await api.post('/company/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  updateCompanyInfo: async (id, data) => {
    const res = await api.put(`/company/${id}/`, data);
    return res.data;
  },

  updateCompanyInfoForm: async (id, formData) => {
    const res = await api.patch(`/company/${id}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  patchCompanyInfo: async (id, data) => {
    const res = await api.patch(`/company/${id}/`, data);
    return res.data;
  },

  deleteCompanyInfo: async (id) => {
    const res = await api.delete(`/company/${id}/`);
    return res.data;
  },

  // ── Dashboard ──────────────────────────────────────────────────────────────

  getDashboardSummary: async () => {
    const res = await api.get('/dashboard/');
    return res.data;
  },
};

export default companyService;
