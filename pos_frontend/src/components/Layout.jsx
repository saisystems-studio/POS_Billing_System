import { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import BackButton from './BackButton';

/* ── SVG Icon kit ── */
const Ic = {
  Cart:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  Grid:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Package:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Users:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Settings:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  LogOut:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Bell:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  User:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  ChevDown:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  ChevRight: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  Menu:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  X:         () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Folder:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  Building:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  Back:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  Shield:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Calendar:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Lock:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Barcode:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7v10"/><path d="M7 7v10"/><path d="M11 7v10"/><path d="M15 7v10"/><path d="M17 7v10"/><path d="M20 7v10"/></svg>,
  Receipt:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  Layers:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  Transfer:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 5h18"/><polyline points="7 23 3 19 7 15"/><path d="M21 19H3"/></svg>,
  Chart:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
};

const useSidebarCollapsed = () => {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true'; } catch { return false; }
  });
  const toggle = () => setCollapsed(v => { const n = !v; try { localStorage.setItem('sidebar_collapsed', n); } catch {} return n; });
  return [collapsed, toggle];
};

const useMenuVisibilityCollapsed = () => {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_menu_collapsed') === 'true'; } catch { return false; }
  });
  const toggle = () => setCollapsed(v => {
    const n = !v;
    try { localStorage.setItem('sidebar_menu_collapsed', n); } catch {}
    return n;
  });
  return [collapsed, toggle];
};

const useMenu = (key, defaultOpen = false) => {
  const [open, setOpen] = useState(() => {
    try {
      const saved = sessionStorage.getItem(`menu_${key}`);
      return saved === null ? defaultOpen : saved === 'true';
    } catch { return defaultOpen; }
  });
  const toggle = useCallback(() => setOpen(v => {
    const n = !v;
    try { sessionStorage.setItem(`menu_${key}`, String(n)); } catch {}
    return n;
  }), [key]);
  const forceOpen = useCallback(() => {
    setOpen(true);
    try { sessionStorage.setItem(`menu_${key}`, 'true'); } catch {}
  }, [key]);
  return [open, toggle, forceOpen];
};

const SubMenu = ({ label, icon: Icon, isOpen, onToggle, children, collapsed, menuCollapsed }) => (
  <li>
    <button className={`submenu-btn${isOpen ? ' open' : ''}`} onClick={onToggle} aria-expanded={isOpen} data-tooltip={label} title={collapsed ? label : undefined}>
      <span className="submenu-left"><span className="ni"><Icon /></span>{!collapsed && label}</span>
      {!collapsed && <span className="submenu-right"><span className="submenu-triangle">▼</span></span>}
    </button>
    {collapsed && isOpen && (
      <div className="sidebar-submenu collapsed-icon-submenu">
        <ul className="sidebar-nav">{children}</ul>
      </div>
    )}
    {!collapsed && !menuCollapsed && (
      <div className="sidebar-submenu" style={{ maxHeight: isOpen ? '400px' : '0' }}>
        <ul className="sidebar-nav">{children}</ul>
      </div>
    )}
  </li>
);

import CompanyInfoModal from '../pages/CompanyInfoModal';

const Layout = ({ children }) => {
  const { username, role, user, isAdmin, logout } = useAuth();
  const { companyInfo } = useCompany();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [sidebarCollapsed, toggleSidebarCollapsed] = useSidebarCollapsed();
  const [menuCollapsed, toggleMenuCollapsed] = useMenuVisibilityCollapsed();
  const [profileOpen,      setProfileOpen]      = useState(false);
  const [sidebarProfileOpen, setSidebarProfileOpen] = useState(false);
  const [companyModal,     setCompanyModal]     = useState(false);
  const [isMobileNav, setIsMobileNav] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1024;
  });
  const profileRef = useRef(null);
  const sidebarProfileRef = useRef(null);

  const [mastersOpen, toggleMasters, forceMasters] = useMenu('masters', false);
  const [transactionsOpen, toggleTransactions, forceTransactions] = useMenu('transactions', false);
  const [reportOpen, toggleReport, forceReport] = useMenu('report', false);

  useEffect(() => {
    if (['/products','/customers','/products/prices'].some(p => location.pathname.startsWith(p))) forceMasters();
    if (location.pathname.startsWith('/billing/new') || (location.pathname.startsWith('/billing/') && location.pathname !== '/billing')) forceTransactions();
    if (location.pathname === '/billing') forceReport();
  }, [location.pathname, forceMasters, forceTransactions, forceReport]);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);
  useEffect(() => {
    const syncMobileNav = () => setIsMobileNav(window.innerWidth < 1024);
    syncMobileNav();
    window.addEventListener('resize', syncMobileNav);
    return () => window.removeEventListener('resize', syncMobileNav);
  }, []);
  useEffect(() => {
    document.body.style.overflow = (sidebarOpen && window.innerWidth < 1024) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);
  useEffect(() => {
    const fn = e => {
      if (e.key !== 'Escape') return;
      if (sidebarOpen) {
        e.preventDefault();
        e.stopPropagation();
        setSidebarOpen(false);
        return;
      }
      setProfileOpen(false);
      setSidebarProfileOpen(false);
      setCompanyModal(false);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [sidebarOpen]);
  useEffect(() => {
    const fn = e => { if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  useEffect(() => {
    const fn = e => { if (sidebarProfileRef.current && !sidebarProfileRef.current.contains(e.target)) setSidebarProfileOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const handleLogout = useCallback(() => { logout(); navigate('/login', { replace: true }); }, [logout, navigate]);

  const initials = username ? username.slice(0, 2).toUpperCase() : 'AD';

  // Inactivity auto-logout (20 min)
  const inactivityTimerRef = useRef(null);
  useEffect(() => {
    const doLogout = () => { logout(); navigate('/login', { replace: true }); };
    const reset = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(doLogout, 20 * 60 * 1000);
    };
    const evts = ['mousemove','mousedown','click','keydown','scroll','wheel','touchstart','input'];
    evts.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { evts.forEach(e => window.removeEventListener(e, reset)); if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current); };
  }, [logout, navigate]);

  useEffect(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        logout();
        navigate('/login', { replace: true });
      }, 20 * 60 * 1000);
    }
  }, [location.pathname, logout, navigate]);

  const isDashboard = location.pathname === '/dashboard';
  const sidebarVisualCollapsed = sidebarCollapsed && !isMobileNav;

  /* Sidebar expand/collapse icon — two arrows pointing inward (collapse) or outward (expand) */
  const SidebarToggleIcon = ({ collapsed }) => collapsed ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:17,height:17,display:'block'}}>
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M9 3v18"/>
      <polyline points="14 9 17 12 14 15"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:17,height:17,display:'block'}}>
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M9 3v18"/>
      <polyline points="16 15 13 12 16 9"/>
    </svg>
  );

  const MenuVisibilityIcon = ({ collapsed }) => collapsed ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:17,height:17,display:'block'}}>
      <rect x="4" y="5" width="16" height="3" rx="1"/>
      <rect x="4" y="11" width="10" height="3" rx="1"/>
      <rect x="4" y="17" width="12" height="3" rx="1"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:17,height:17,display:'block'}}>
      <line x1="5" y1="6" x2="19" y2="6"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
      <line x1="5" y1="18" x2="19" y2="18"/>
      <polyline points="15 9 18 12 15 15"/>
    </svg>
  );

  return (
    <div className={`layout-container${sidebarVisualCollapsed ? ' sidebar-is-collapsed' : ''}${menuCollapsed ? ' sidebar-menu-is-collapsed' : ''}`}>
      <div className={`sidebar-overlay${sidebarOpen ? '' : ' hidden'}`} onClick={() => setSidebarOpen(false)} aria-hidden={!sidebarOpen}/>

      {companyModal && <CompanyInfoModal onClose={() => setCompanyModal(false)}/>}

      {/* ── Sidebar ── */}
      <aside id="app-sidebar" className={`sidebar${sidebarOpen ? ' open' : ''}${sidebarVisualCollapsed ? ' collapsed' : ''}`} aria-label="Navigation">
        {/* Brand + collapse toggle */}
        <div className="sidebar-brand-row">
          <button type="button" className="sidebar-brand"
            onClick={() => navigate('/dashboard')}
            style={{background:'none',border:'none',cursor:'pointer',flex:1,textAlign:'left',display:'flex',alignItems:'center',gap:'.625rem',overflow:'hidden'}}>
            {companyInfo?.CompanyLogo ? (
              <img src={companyInfo.CompanyLogo} alt="Logo"
                style={{width:32,height:32,borderRadius:6,objectFit:'contain',background:'#fff',flexShrink:0}}/>
            ) : (
              <div className="sidebar-brand-logo"><Ic.Cart/></div>
            )}
            {!sidebarVisualCollapsed && (
              <div style={{minWidth:0,flex:'1 1 auto'}}>
                <div className="sidebar-brand-name">POS Billing System</div>
                <div className="sidebar-brand-tag">Retail Management</div>
              </div>
            )}
          </button>
          <div className="sidebar-control-group">
            <button
              className="sidebar-collapse-btn sidebar-full-toggle"
              onClick={toggleSidebarCollapsed}
              aria-label={sidebarVisualCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarVisualCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <SidebarToggleIcon collapsed={sidebarVisualCollapsed}/>
            </button>
            {!sidebarVisualCollapsed && (
              <button
                className="sidebar-collapse-btn sidebar-menu-toggle"
                onClick={toggleMenuCollapsed}
                aria-label={menuCollapsed ? 'Show sidebar submenus' : 'Hide sidebar submenus'}
                title={menuCollapsed ? 'Show sidebar submenus' : 'Hide sidebar submenus'}>
                <MenuVisibilityIcon collapsed={menuCollapsed}/>
              </button>
            )}
          </div>
        </div>

        <nav>
          <ul className="sidebar-nav">
            {/* Dashboard */}
            <li className="nav-item">
              <NavLink to="/dashboard" className={({isActive}) => `nav-link${isActive?' active':''}`}
                data-tooltip="Dashboard" title={sidebarVisualCollapsed ? 'Dashboard' : undefined}>
                <span className="ni"><Ic.Grid/></span>{!sidebarVisualCollapsed && 'Dashboard'}
              </NavLink>
            </li>
            {/* Masters submenu */}
            <SubMenu label="Masters" icon={Ic.Layers} isOpen={mastersOpen} onToggle={toggleMasters} collapsed={sidebarVisualCollapsed} menuCollapsed={menuCollapsed}>
              <li className="nav-item">
                <NavLink to="/products" end className={({isActive}) => `nav-link${isActive?' active':''}`} data-tooltip="Product" title={sidebarVisualCollapsed ? 'Product' : undefined}>
                  <span className="ni"><Ic.Package/></span>{!sidebarVisualCollapsed && 'Product'}
                </NavLink>
              </li>
              {isAdmin && (
                <li className="nav-item">
                  <NavLink to="/products/prices" className={({isActive}) => `nav-link${isActive?' active':''}`} data-tooltip="Price Code List" title={sidebarVisualCollapsed ? 'Price Code List' : undefined}>
                    <span className="ni"><Ic.Lock/></span>{!sidebarVisualCollapsed && 'Price Code List'}
                  </NavLink>
                </li>
              )}
              <li className="nav-item">
                <NavLink to="/customers" className={({isActive}) => `nav-link${isActive?' active':''}`} data-tooltip="Customer" title={sidebarVisualCollapsed ? 'Customer' : undefined}>
                  <span className="ni"><Ic.Users/></span>{!sidebarVisualCollapsed && 'Customer'}
                </NavLink>
              </li>
            </SubMenu>

            {/* Transactions submenu */}
            <SubMenu label="Transactions" icon={Ic.Transfer} isOpen={transactionsOpen} onToggle={toggleTransactions} collapsed={sidebarVisualCollapsed} menuCollapsed={menuCollapsed}>
              <li className="nav-item">
                <NavLink to="/billing/new" className={({isActive}) => `nav-link${isActive?' active':''}`} data-tooltip="Sales" title={sidebarVisualCollapsed ? 'Sales' : undefined}>
                  <span className="ni"><Ic.Cart/></span>{!sidebarVisualCollapsed && 'Sales'}
                </NavLink>
              </li>
            </SubMenu>

            <li className="nav-item">
              <NavLink to="/barcode-generator" className={({isActive}) => `nav-link${isActive?' active':''}`} data-tooltip="Barcode Generator" title={sidebarVisualCollapsed ? 'Barcode Generator' : undefined}>
                <span className="ni"><Ic.Barcode/></span>{!sidebarVisualCollapsed && 'Barcode Generator'}
              </NavLink>
            </li>

            {/* Report submenu */}
            <SubMenu label="Report" icon={Ic.Chart} isOpen={reportOpen} onToggle={toggleReport} collapsed={sidebarVisualCollapsed} menuCollapsed={menuCollapsed}>
              <li className="nav-item">
                <NavLink to="/billing" end className={({isActive}) => `nav-link${isActive?' active':''}`} data-tooltip="Sales Report" title={sidebarVisualCollapsed ? 'Sales Report' : undefined}>
                  <span className="ni"><Ic.Receipt/></span>{!sidebarVisualCollapsed && 'Sales Report'}
                </NavLink>
              </li>
            </SubMenu>
          </ul>
        </nav>

        {/* Sidebar profile section */}
        <div className="sidebar-footer" ref={sidebarProfileRef} style={{padding:'.5rem .5rem',borderTop:'1px solid var(--sidebar-border)',position:'relative'}}>
          {/* Profile card */}
          {!sidebarVisualCollapsed ? (
            <div onClick={() => setSidebarProfileOpen(v => !v)} style={{
              display:'flex',alignItems:'center',gap:'.5rem',
              cursor:'pointer',
              padding:'.4rem .6rem',marginBottom:'.35rem',
              borderRadius:'var(--radius)',background:'rgba(0,0,0,.06)',
            }}>
              <div style={{
                width:30,height:30,borderRadius:'50%',flexShrink:0,
                background:'linear-gradient(135deg,var(--primary),var(--primary-dark))',
                color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:'.65rem',fontWeight:800,
              }}>{initials}</div>
              <div style={{minWidth:0,flex:1}}>
                <div style={{fontWeight:700,fontSize:'.76rem',color:'var(--sidebar-bright)',
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {user?.username || username || '—'}
                </div>
                <div style={{fontSize:'.64rem',color:'var(--sidebar-dim)',
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {user?.email || ''}{user?.email ? ' · ' : ''}{user?.role || role || 'User'}
                </div>
              </div>
              {isAdmin && (
                <button type="button" title="Company Info"
                  onClick={() => setCompanyModal(true)}
                  style={{background:'none',border:'none',cursor:'pointer',color:'var(--sidebar-dim)',
                    padding:2,borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}
                  onMouseEnter={e=>e.currentTarget.style.color='var(--primary-dark)'}
                  onMouseLeave={e=>e.currentTarget.style.color='var(--sidebar-dim)'}>
                  <Ic.Building/>
                </button>
              )}
            </div>
          ) : (
            <div style={{display:'flex',justifyContent:'center',marginBottom:'.35rem'}}>
              <div onClick={() => setSidebarProfileOpen(v => !v)} style={{
                width:30,height:30,borderRadius:'50%',
                background:'linear-gradient(135deg,var(--primary),var(--primary-dark))',
                color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:'.65rem',fontWeight:800,cursor:'default',
              }} title={`${user?.username || username} · ${user?.role || role}`}>{initials}</div>
            </div>
          )}

          {sidebarProfileOpen && (
            <div className="sidebar-profile-dropdown">
              <button className="topbar-dd-item" onClick={() => { setSidebarProfileOpen(false); navigate('/settings'); }}><Ic.User/> Profile</button>
              <button className="topbar-dd-item" onClick={() => { setSidebarProfileOpen(false); navigate('/settings'); }}><Ic.Settings/> User Settings</button>
              {isAdmin && <button className="topbar-dd-item" onClick={() => { setSidebarProfileOpen(false); setCompanyModal(true); }}><Ic.Building/> Company Info</button>}
              <div className="topbar-dd-divider"/>
              <button className="topbar-dd-item dd-danger" onClick={handleLogout}><Ic.LogOut/> Logout</button>
            </div>
          )}

          {/* Logout button */}
          <button className="sidebar-logout sidebar-logout-hidden" onClick={handleLogout}
            title={sidebarVisualCollapsed ? 'Logout' : undefined}>
            <span className="ni" style={{background:'none'}}><Ic.LogOut/></span>
            {!sidebarVisualCollapsed && 'Logout'}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="main-content">
        {/* Top bar — only on Dashboard; inner pages have no topbar (saves navbar-height space) */}
        {isDashboard ? (
          <header className="top-bar app-mobile-header dashboard-mobile-header">
            <div className="top-bar-left">
              <button type="button" className="hamburger dashboard-menu-button app-mobile-menu-button" onClick={() => setSidebarOpen(v => !v)}
                aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={sidebarOpen} aria-controls="app-sidebar">
                <Ic.Menu/>
              </button>
            </div>
            <div className="top-bar-right dashboard-header-actions">
              <button type="button" className="topbar-notif dashboard-header-icon-button" aria-label="Notifications">
                <Ic.Bell/><span className="notif-badge notification-indicator"/>
              </button>
              <div className="topbar-avatar-wrap" ref={profileRef}>
                <button type="button" className="topbar-avatar-btn dashboard-profile-button"
                  onClick={() => setProfileOpen(v => !v)}
                  aria-expanded={profileOpen} aria-haspopup="true">
                  <div className="topbar-avatar dashboard-avatar">{initials}</div>
                  <span className="topbar-uname">{username || 'User'}</span>
                  <span className="topbar-chevron" style={{transform:profileOpen?'rotate(180deg)':'none',transition:'.2s'}}>
                    <Ic.ChevDown/>
                  </span>
                </button>
                {profileOpen && (
                  <div className="topbar-dropdown" role="menu">
                    <div className="topbar-dd-header">
                      <div className="topbar-dd-name">{username || 'User'}</div>
                      <div className="topbar-dd-role">{role || 'User'}</div>
                    </div>
                    {isAdmin && (
                      <button className="topbar-dd-item" onClick={() => { setProfileOpen(false); setCompanyModal(true); }}>
                        <Ic.Building/> Company Info
                      </button>
                    )}
                    <button className="topbar-dd-item" onClick={() => { setProfileOpen(false); navigate('/settings'); }}>
                      <Ic.Settings/> Settings
                    </button>
                    <div className="topbar-dd-divider"/>
                    <button className="topbar-dd-item dd-danger" onClick={handleLogout}>
                      <Ic.LogOut/> Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
        ) : (
          /* Mobile only: minimal bar just for hamburger — hidden on desktop via CSS */
          <header className="top-bar top-bar-inner app-mobile-header" aria-hidden={undefined}>
            <div className="top-bar-left">
              <button type="button" className="hamburger app-mobile-menu-button" onClick={() => setSidebarOpen(v => !v)}
                aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={sidebarOpen} aria-controls="app-sidebar">
                <Ic.Menu/>
              </button>
            </div>
          </header>
        )}

        <main className={`content${isDashboard ? ' content-dashboard' : ' content-inner'}`}>
          {!isDashboard && <BackButton />}
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
 
