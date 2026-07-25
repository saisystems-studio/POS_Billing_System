import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import companyService from '../services/companyService';
import { fetchCachedPage, getCachedPage, makePageKey } from '../services/pageCache';

/* Inline SVG stats icons */
const PackageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{width:24,height:24}}>
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);
const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{width:24,height:24}}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{width:24,height:24}}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ total_products: 0, total_customers: 0, total_price_records: 0, company_name: null });
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const fetchSummary = async () => {
      const cacheKey = makePageKey('dashboard', {});
      const cached = getCachedPage('dashboard', cacheKey);
      if (cached) {
        setSummary(cached);
        setLoading(false);
      }
      try {
        const { data } = await fetchCachedPage(
          'dashboard',
          cacheKey,
          () => companyService.getDashboardSummary(),
          { force: Boolean(cached), max: 3 },
        );
        if (!active) return;
        setSummary(data);
      } catch (err) {
        if (!active) return;
        setError('Failed to load dashboard data.');
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchSummary();
    return () => { active = false; };
  }, []);

  return (
    <Layout>
      {/* Header */}
      <div className="page-header dashboard-heading animate-in">
        <div>
          <h2>Dashboard</h2>
          <p className="page-header-sub">
            {summary.company_name ? `Welcome to ${summary.company_name}` : "Welcome back! Here's your overview."}
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>{error}</div>
      )}

      {/* Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card stat-card-products">
          <div className="stat-card-inner">
            <div className="stat-info">
              <div className="stat-label">Total Products</div>
              <div className="stat-num">{summary.total_products}</div>
              <div className="stat-trend up">Active catalog</div>
            </div>
            <div className="stat-icon"><PackageIcon /></div>
          </div>
        </div>

        <div className="stat-card stat-card-customers">
          <div className="stat-card-inner">
            <div className="stat-info">
              <div className="stat-label">Total Customers</div>
              <div className="stat-num">{summary.total_customers}</div>
              <div className="stat-trend up">Registered customers</div>
            </div>
            <div className="stat-icon"><UsersIcon /></div>
          </div>
        </div>

        <div className="stat-card stat-card-lowstock">
          <div className="stat-card-inner">
            <div className="stat-info">
              <div className="stat-label">Price Records</div>
              <div className="stat-num">{summary.total_price_records}</div>
              <div className="stat-trend">Price tiers configured</div>
            </div>
            <div className="stat-icon"><AlertIcon /></div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="card animate-in animate-in-2">
        <div className="card-body">
          <div style={{ marginBottom: '1.375rem' }}>
            <h5 className="card-title">Quick Actions</h5>
            <p className="card-subtitle">Frequently used features</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a href="/products/new" className="btn btn-outline-secondary btn-sm">➕ Add Product</a>
            <a href="/customers/new" className="btn btn-outline-secondary btn-sm">➕ Add Customer</a>
            <a href="/products/prices" className="btn btn-outline-secondary btn-sm">💲 Manage Prices</a>
            <a href="/settings" className="btn btn-outline-secondary btn-sm">⚙️ Settings</a>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
