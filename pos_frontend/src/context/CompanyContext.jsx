/**
 * CompanyContext — global company configuration state.
 *
 * Fetches CompanyInfo_tbl on startup and after every save.
 * Exposes:
 *   companyInfo       — full company record (or null)
 *   isGSTRegistered   — boolean, derived from companyInfo.IsGSTRegistered
 *   loading           — true while fetching
 *   refreshCompanyInfo() — call after saving company info to update all consumers
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const CompanyContext = createContext(undefined);

export const useCompany = () => {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
};

export const CompanyProvider = ({ children }) => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [companyInfo,     setCompanyInfo]     = useState(null);
  const [isGSTRegistered, setIsGSTRegistered] = useState(false);
  const [loading,         setLoading]         = useState(true);

  const fetchCompany = useCallback(async () => {
    const applyCompany = (data) => {
      if (data && (data.id || data.CompanyName || data.IsGSTRegistered !== undefined)) {
        setCompanyInfo(data);
        setIsGSTRegistered(!!data.IsGSTRegistered);
      } else {
        setCompanyInfo(null);
        setIsGSTRegistered(false);
      }
    };

    try {
      if (isAuthenticated) {
        const res = await api.get('/company-info/');
        applyCompany(res.data);
        return;
      }

      const res = await api.get('/company-info/public/', { skipAuth: true });
      applyCompany(res.data);
    } catch {
      // Public fallback for legacy deployments.
      try {
        const res = await api.get('/company-info/public/', { skipAuth: true });
        const d = res.data;
        applyCompany(d);
      } catch {
        setCompanyInfo(null);
        setIsGSTRegistered(false);
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch on mount
  useEffect(() => {
    if (!authLoading) fetchCompany();
  }, [authLoading, fetchCompany]);

  const refreshCompanyInfo = useCallback(() => {
    setLoading(true);
    fetchCompany();
  }, [fetchCompany]);

  return (
    <CompanyContext.Provider value={{
      companyInfo,
      isGSTRegistered,
      loading,
      refreshCompanyInfo,
    }}>
      {children}
    </CompanyContext.Provider>
  );
};
