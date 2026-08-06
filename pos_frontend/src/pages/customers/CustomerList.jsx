import { Fragment, useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import ConfirmModal from '../../components/ConfirmModal';
import SplitTable from '../../components/SplitTable';
import customerService from '../../services/customerService';
import { clearPageCache, fetchCachedPage, getCachedPage, makePageKey, prefetchCachedPage } from '../../services/pageCache';
import { useAuth } from '../../context/AuthContext';
import { Upload, FileDown, FileSpreadsheet, FileText, Eye, Pencil, Trash2 } from 'lucide-react';
import useResponsivePageSize from '../../hooks/useResponsivePageSize';

const TrashIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
const MoreIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>;
const CloseIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
import SharedSearchField from '../../components/SharedSearchField';
import AutoFitColumns from '../../components/AutoFitColumns';
const PlusIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const ViewIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;

const fmt = (str) => str ? new Date(str).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'}) : '—';

const parseAddress = (addr) => {
  if (!addr) return {};
  const parts = addr.split('|').map(s => s.trim());
  // New format: address | district | state | country | pincode | gstType | gstNo
  // Old format (compat): state | country | pincode | gstType | gstNo
  if (parts.length >= 6) {
    const [address='',district='',state='',country='',pin='',gstType='',gstNo=''] = parts;
    return { address, district, state, country, pin, gstType, gstNo };
  }
  // fallback legacy
  const [state='',country='',pin='',gstType='',gstNo=''] = parts;
  return { address:'', district:'', state, country, pin, gstType, gstNo };
};

const customerCode = c => c.customer_code ?? c.CustomerCode ?? '';
const customerName = c => c.customer_name ?? c.CustomerName ?? '';
const customerPhone = c => c.phone_number ?? c.PhoneNumber ?? '';
const customerWhatsapp = c => c.whatsapp_number ?? c.WhatsappNumber ?? '';
const customerDistrict = c => c.district ?? c.District ?? parseAddress(c.Address).district ?? '';
const customerState = c => c.state ?? c.State ?? parseAddress(c.Address).state ?? '';
const customerPriceType = c => c.priceCodeType ?? c.PriceCodeType ?? c.price_type ?? '—';
const customerFixedPriceCode = c => c.fixedPriceCodeName ?? c.FixedPriceCodeName ?? c.FixedPriceCode ?? c.PriceCodeName ?? '';

/* ── View More Modal ── */
const ViewMoreModal = ({ customer, onClose }) => {
  useEffect(() => {
    const handleEscape = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);
  if (!customer) return null;
  const addr = parseAddress(customer.Address);
  const name = customerName(customer) || '—';
  const code = customerCode(customer) || '—';
  const phone = customerPhone(customer) || '—';
  const whatsapp = customerWhatsapp(customer) || '—';
  const email = customer.EmailId || customer.email || '—';
  const active = customer.IsActive !== false;
  const priceType = customerPriceType(customer) || '—';
  const fixedPriceCode = customerFixedPriceCode(customer) || '—';
  const detailValue = value => value == null || String(value).trim() === '' ? '—' : value;
  const Detail = ({ label, value, className = '' }) => (
    <div className={`detail-item ${className}`}>
      <span className="detail-label">{label}</span>
      <span className="detail-value">{detailValue(value)}</span>
    </div>
  );
  return (
    <div className="details-modal-overlay" onClick={onClose}>
      <section className="details-modal customer-details-modal" role="dialog" aria-modal="true" aria-label="Customer details" onClick={e => e.stopPropagation()}>
        <header className="details-modal-header">
          <h2>Customer Details</h2>
          <button className="details-modal-close" onClick={onClose} aria-label="Close details"><CloseIcon/></button>
        </header>
        <div className="details-modal-body">
          <div className="details-summary-card">
            <div className="details-summary-avatar"><span>{name.charAt(0).toUpperCase()}</span></div>
            <div className="details-summary-main">
              <h3>{name}</h3>
              <p>Code: {code}</p>
              <p>Phone: {phone}</p>
            </div>
            <span className={`summary-status ${active ? 'is-active' : 'is-inactive'}`}>{active ? 'Active' : 'Inactive'}</span>
          </div>
          <div className="details-section">
            <h3 className="details-section-title">Contact Information</h3>
            <div className="detail-grid">
              <Detail label="Customer Code" value={code} />
              <Detail label="Customer Name" value={name} />
              <Detail label="Phone" value={phone} />
              <Detail label="WhatsApp" value={whatsapp} />
              <Detail label="Email" value={email} />
              <Detail label="Status" value={active ? 'Active' : 'Inactive'} />
            </div>
          </div>
          <div className="details-section">
            <h3 className="details-section-title">Address Information</h3>
            <div className="detail-grid">
              <Detail label="Address" value={addr.address} className="customer-address-item" />
              <Detail label="District" value={customerDistrict(customer)} />
              <Detail label="State" value={customerState(customer)} />
              <Detail label="Country" value={addr.country} />
              <Detail label="Pincode" value={addr.pin} />
            </div>
          </div>
          <div className="details-section">
            <h3 className="details-section-title">Billing &amp; Customer Settings</h3>
            <div className="detail-grid">
              <Detail label="GST Type" value={addr.gstType} />
              <Detail label="GST Number" value={addr.gstNo} />
              <Detail label="Price Type" value={priceType} />
              {String(priceType).toLowerCase() === 'fixed' && <Detail label="Fixed Price Code" value={fixedPriceCode} />}
              <Detail label="Reward Points" value={`${parseFloat(customer.Customer_Redeem_Points || 0).toFixed(0)} pts`} />
              <Detail label="Created On" value={fmt(customer.CreatedOn)} />
            </div>
          </div>
        </div>
        <footer className="details-modal-footer"><button className="btn btn-outline-secondary" onClick={onClose}>Close</button></footer>
      </section>
    </div>
  );
};

const CustomerList = () => {
  const autoFitTableRef = useRef(null);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [loading,   setLoading]   = useState(true);
  const [customers, setCustomers] = useState([]);
  const [search,    setSearch]    = useState('');
  const [deb,       setDeb]       = useState('');
  const [page,      setPage]      = useState(1);
  const [loadedPage,setLoadedPage]= useState(1);
  const [total,     setTotal]     = useState(0);
  const [error,     setError]     = useState('');
  const [showDel,    setShowDel]    = useState(false);
  const [delTarget,  setDelTarget]  = useState(null);
  const [deleting,   setDeleting]   = useState(false);
  const [selected,   setSelected]   = useState(new Set());
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [hoveredCustomerId, setHoveredCustomerId] = useState(null);
  const [dismissedActionCustomerId, setDismissedActionCustomerId] = useState(null);
  const [viewMore,   setViewMore]   = useState(null);
  const [activeCustomerMenuId, setActiveCustomerMenuId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const toggleExpanded = (id) => setExpandedId(prev => prev === id ? null : id);
  const [showDataMenu,setShowDataMenu]= useState(false);
  const dataMenuRef  = useRef(null);
  const exportBtnRef = useRef(null);
  const fileInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const fetchSeqRef = useRef(0);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const { pageSize, containerRef, rowRef, bottomRef } = useResponsivePageSize({
    defaultRowHeight: 29,
    mobileRowHeight: 230,
  });
  const previousPageSizeRef = useRef(pageSize);
  const isTabletLayout = typeof window !== 'undefined'
    && window.matchMedia('(min-width: 768px) and (max-width: 1199px)').matches;

  // Position portal dropdown under the Export button
  useLayoutEffect(() => {
    if (showDataMenu && exportBtnRef.current) {
      const r = exportBtnRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
  }, [showDataMenu]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const multiSelectActive = selected.size > 1;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const isInteractiveTarget = (target) => Boolean(target?.closest?.(
    'input, select, textarea, button, a, [role="button"], .pagination, .row-action-popup'
  ));

  const openCustomerRowDetails = (event, customer) => {
    if (isInteractiveTarget(event.target)) return;
    event.preventDefault();
    selectCustomer(customer.id);
    if (isAdmin) navigate(`/customers/${customer.id}`);
    else setViewMore(customer);
  };

  // On mobile, tapping a customer card always opens the read-only View More modal.
  // Keep the existing desktop/admin row navigation unchanged.
  const openCustomerMobileDetails = (event, customer) => {
    if (isInteractiveTarget(event.target)) return;
    event.preventDefault();
    selectCustomer(customer.id);
    setActiveCustomerMenuId(null);
    setViewMore(customer);
  };

  const selectCustomer = (id) => {
    setSelectedCustomerId(id);
    setSelected(id ? new Set([id]) : new Set());
    setDismissedActionCustomerId(null);
  };

  const moveCustomerSelection = (delta) => {
    if (!customers.length) return;
    const currentIndex = Math.max(0, customers.findIndex(c => c.id === selectedCustomerId));
    const nextIndex = Math.min(customers.length - 1, Math.max(0, currentIndex + delta));
    selectCustomer(customers[nextIndex].id);
  };

  const handleListKeyDown = (e) => {
    if (isInteractiveTarget(e.target)) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveCustomerSelection(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveCustomerSelection(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const active = customers.find(c => c.id === selectedCustomerId);
      if (!active) return;
      setViewMore(active);
    } else if (e.key === 'Escape') {
      setDismissedActionCustomerId(hoveredCustomerId ?? selectedCustomerId);
      setHoveredCustomerId(null);
      setViewMore(null);
    }
  };

  useEffect(() => {
    if (!showDataMenu) return;
    const outside = (e) => {
      if (
        dataMenuRef.current && !dataMenuRef.current.contains(e.target) &&
        exportBtnRef.current && !exportBtnRef.current.contains(e.target)
      ) setShowDataMenu(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [showDataMenu]);

  useEffect(() => {
    const t = setTimeout(() => { setDeb(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    const previousSize = previousPageSizeRef.current;
    if (previousSize !== pageSize) {
      setPage(currentPage => Math.floor(((currentPage - 1) * previousSize) / pageSize) + 1);
      previousPageSizeRef.current = pageSize;
    }
  }, [pageSize]);

  useEffect(() => {
    if (!activeCustomerMenuId) return undefined;
    const closeMenu = event => {
      if (event.key === 'Escape' || !event.target.closest?.('.customer-mobile-actions')) {
        setActiveCustomerMenuId(null);
      }
    };
    document.addEventListener('keydown', closeMenu);
    document.addEventListener('pointerdown', closeMenu);
    return () => {
      document.removeEventListener('keydown', closeMenu);
      document.removeEventListener('pointerdown', closeMenu);
    };
  }, [activeCustomerMenuId]);

  useEffect(() => {
    // Skip on mobile: focusing on load pops the keyboard immediately and
    // can trigger an unwanted horizontal scroll of the page.
    if (window.matchMedia('(min-width: 769px)').matches) {
      searchInputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    const isTypingTarget = target => Boolean(target?.closest?.('input, select, textarea, [contenteditable="true"]'));
    const handler = e => {
      if ((e.ctrlKey && e.key.toLowerCase() === 'f') || (!isTypingTarget(e.target) && e.key === '/')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'Escape') {
        setSelected(new Set());
        setSelectedCustomerId(null);
        setHoveredCustomerId(null);
        setDismissedActionCustomerId(null);
        setViewMore(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const fetchCustomers = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    const params = { page, page_size: pageSize };
    if (deb) params.search = deb;
    const cacheKey = makePageKey('customers', params);
    const cached = getCachedPage('customers', cacheKey);
    if (cached) {
      const cachedRows = cached.results !== undefined ? cached.results : (Array.isArray(cached) ? cached : []);
      setCustomers(cachedRows);
      setTotal(cached.count ?? cachedRows.length);
      setLoadedPage(page);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const { data } = await fetchCachedPage('customers', cacheKey, () => customerService.getCustomers(params), { force: Boolean(cached) });
      if (seq !== fetchSeqRef.current) return;
      if (data.results !== undefined) { setCustomers(data.results); setTotal(data.count); }
      else { setCustomers(Array.isArray(data)?data:[]); setTotal(Array.isArray(data)?data.length:0); }
      setLoadedPage(page);
      const rows = data.results !== undefined ? data.results : (Array.isArray(data) ? data : []);
      const totalCount = data.count ?? rows.length;
      const maxPage = Math.max(1, Math.ceil(totalCount / pageSize));
      [page - 1, page + 1].filter(n => n >= 1 && n <= maxPage).forEach(n => {
        const nextParams = { ...params, page: n };
        prefetchCachedPage('customers', makePageKey('customers', nextParams), () => customerService.getCustomers(nextParams));
      });
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      setError(err.response?.data?.detail || 'Unable to retrieve data. Please retry.');
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [page, pageSize, deb]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const handleDelete = async () => {
    if (deleting) return;
    const ids = selected.size > 0 ? [...selected] : [delTarget];
    setDeleting(true);
    try {
      await Promise.all(ids.map(id => customerService.deleteCustomer(id)));
      clearPageCache('customers');
      setShowDel(false); setDelTarget(null); selectCustomer(null); fetchCustomers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete.'); setShowDel(false);
    } finally { setDeleting(false); }
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setSelectedCustomerId(next.has(id) ? id : (next.size === 1 ? [...next][0] : null));
    setDismissedActionCustomerId(null);
  };

  const allOnPageSelected = customers.length > 0 && customers.every(c => selected.has(c.id));
  const anyOnPageSelected = customers.some(c => selected.has(c.id));
  const toggleSelectAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        customers.forEach(c => next.delete(c.id));
      } else {
        customers.forEach(c => next.add(c.id));
      }
      return next;
    });
    setSelectedCustomerId(allOnPageSelected ? null : (customers[0]?.id ?? null));
    setDismissedActionCustomerId(null);
  };

  // Resolve which customer records to export:
  // - If rows are checked â†’ export only those
  // - Otherwise â†’ fetch ALL records from server (no pagination limit)
  const resolveExportData = async () => {
    if (selected.size > 0) {
      return customers.filter(c => selected.has(c.id));
    }
    try {
      const data = await customerService.getCustomers({ page_size: 99999, ...(deb ? { search: deb } : {}) });
      return data.results ?? (Array.isArray(data) ? data : customers);
    } catch {
      return customers;
    }
  };

  const handleExportCsv = async () => {
    setShowDataMenu(false);
    const data = await resolveExportData();
    if (!data.length) { setError('No customers to export.'); return; }

    const headers = ['S.No','Customer Code','Customer Name','Phone','WhatsApp','Address','District','State','Country','PIN','GST Registered','GST Type','GST No','Price Type','Status'];
    const rows = data.map((c, idx) => {
      const addr = parseAddress(c.Address);
      return [
        idx + 1,
        c.CustomerCode || '',
        c.CustomerName || '',
        c.PhoneNumber || '',
        c.WhatsappNumber || '',
        addr.address || '',
        addr.district || '',
        addr.state || '',
        addr.country || '',
        addr.pin || '',
        addr.gstType && addr.gstType !== 'Unregistered' ? 'Yes' : 'No',
        addr.gstType || '',
        addr.gstNo || '',
        c.PriceCodeType || '',
        c.IsActive !== false ? 'Active' : 'Inactive',
      ];
    });

    const BOM = '\uFEFF';
    const csv = BOM + [headers, ...rows]
      .map(r => r.map(String).map(v => `"${v.replace(/"/g,'""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    setShowDataMenu(false);
    const data = await resolveExportData();
    if (!data.length) { setError('No customers to export.'); return; }

    const isSelected = selected.size > 0;
    const subtitle = isSelected
      ? `${data.length} selected record${data.length !== 1 ? 's' : ''}`
      : deb ? `Search: "${deb}" — ${data.length} record${data.length !== 1 ? 's' : ''}` : `All Records — ${data.length} total`;
    const dateStr = new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

    const rowsHtml = data.map((c, idx) => {
      const addr = parseAddress(c.Address);
      const status = c.IsActive !== false ? 'Active' : 'Inactive';
      return `<tr>
        <td class="num">${idx+1}</td>
        <td class="mono">${c.CustomerCode||''}</td>
        <td class="bold">${c.CustomerName||''}</td>
        <td>${c.PhoneNumber||''}</td>
        <td>${c.WhatsappNumber||'—'}</td>
        <td>${addr.address||'—'}</td>
        <td>${addr.district||'—'}</td>
        <td>${addr.state||'—'}</td>
        <td class="num">${addr.pin||'—'}</td>
        <td>${addr.gstType&&addr.gstType!=='Unregistered'?`<span class="gst-badge">${addr.gstType}</span>`:'<span class="na">—</span>'}</td>
        <td class="mono small">${addr.gstNo||'—'}</td>
        <td class="tag ${status==='Active'?'active':'inactive'}">${status}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Customer Report</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm 10mm; }
  *  { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #1e1410; background: #fff; }
  /* ── header ── */
  .rpt-header { display: flex; justify-content: space-between; align-items: flex-end;
    border-bottom: 2.5px solid #8A5125; padding-bottom: 7px; margin-bottom: 10px; }
  .rpt-header-left h1 { font-size: 18px; font-weight: 800; color: #8A5125; letter-spacing: -.4px; line-height: 1.1; }
  .rpt-header-left p  { font-size: 9px; color: #7a6758; margin-top: 3px; }
  .rpt-header-right   { text-align: right; font-size: 9px; color: #7a6758; line-height: 1.7; }
  .rpt-header-right strong { color: #4a3426; }
  /* ── table ── */
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  col.c-sno   { width: 28px; }
  col.c-code  { width: 62px; }
  col.c-name  { width: 120px; }
  col.c-phone { width: 78px; }
  col.c-wp    { width: 78px; }
  col.c-addr  { width: 100px; }
  col.c-dist  { width: 72px; }
  col.c-state { width: 72px; }
  col.c-pin   { width: 48px; }
  col.c-gtype { width: 60px; }
  col.c-gno   { width: 90px; }
  col.c-stat  { width: 46px; }
  thead tr { background: #8A5125; color: #fff; }
  thead th { padding: 5.5px 5px; font-size: 8.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .04em; white-space: nowrap; text-align: left; overflow: hidden; }
  thead th.r { text-align: right; }
  thead th.c { text-align: center; }
  tbody tr { border-bottom: 1px solid #efe5da; }
  tbody tr:nth-child(even) { background: #faf6f2; }
  tbody tr:hover { background: #f3ece3; }
  td { padding: 5px 5px; vertical-align: middle; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap; font-size: 9.5px; }
  td.num   { text-align: center; color: #7a6758; }
  td.r     { text-align: right; }
  td.bold  { font-weight: 700; white-space: normal; }
  td.mono  { font-family: 'Courier New', monospace; font-size: 9px;
    background: #f3ece3; border-radius: 3px; padding: 2px 4px; }
  td.small { font-size: 8.5px; }
  td.na    { color: #bbb; }
  .gst-badge { background: #e8f5e9; color: #2e7d32; font-size: 8px; font-weight: 700;
    padding: 1px 4px; border-radius: 3px; border: 1px solid #a5d6a7; }
  .tag { font-weight: 700; text-align: center; font-size: 8.5px; }
  .tag.active   { color: #1b5e20; }
  .tag.inactive { color: #c62828; }
  /* ── footer ── */
  .rpt-footer { margin-top: 10px; display: flex; justify-content: space-between;
    font-size: 8.5px; color: #a09080; border-top: 1px solid #efe5da; padding-top: 5px; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    thead { display: table-header-group; }
    tbody tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="rpt-header">
    <div class="rpt-header-left">
      <h1>Customer Report</h1>
      <p>${subtitle}</p>
    </div>
    <div class="rpt-header-right">
      <div><strong>Exported:</strong> ${dateStr}</div>
      <div><strong>Total Records:</strong> ${data.length}</div>
    </div>
  </div>
  <table>
    <colgroup>
      <col class="c-sno"/><col class="c-code"/><col class="c-name"/>
      <col class="c-phone"/><col class="c-wp"/><col class="c-addr"/>
      <col class="c-dist"/><col class="c-state"/><col class="c-pin"/>
      <col class="c-gtype"/><col class="c-gno"/><col class="c-stat"/>
    </colgroup>
    <thead>
      <tr>
        <th class="c">S.No</th>
        <th>Code</th>
        <th>Customer Name</th>
        <th>Phone</th>
        <th>WhatsApp</th>
        <th>Address</th>
        <th>District</th>
        <th>State</th>
        <th class="c">PIN</th>
        <th>GST Type</th>
        <th>GST No</th>
        <th class="c">Status</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="rpt-footer">
    <span>POS Billing System — Customer Report</span>
    <span>Printed: ${dateStr}</span>
  </div>
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=1200,height=800');
    if (!w) { setError('Pop-up blocked. Please allow pop-ups to export PDF.'); return; }
    w.document.write(html);
    w.document.close();
  };

  const handleImportFile = (event) => {
    setShowDataMenu(false);
    const file = event.target.files?.[0];
    if (!file) return;
    setError('Import is not supported yet. Please contact support for bulk upload.');
    event.target.value = '';
  };

  const buildPages = () => {
    if (totalPages <= 7) return Array.from({length:totalPages},(_,i)=>i+1);
    const pages = [];
    if (loadedPage<=4) pages.push(1,2,3,4,5,'…',totalPages);
    else if (loadedPage>=totalPages-3) pages.push(1,'…',totalPages-4,totalPages-3,totalPages-2,totalPages-1,totalPages);
    else pages.push(1,'…',loadedPage-1,loadedPage,loadedPage+1,'…',totalPages);
    return pages;
  };

  return (
    <Layout>
      {viewMore && <ViewMoreModal customer={viewMore} onClose={() => setViewMore(null)}/>}

      <div className="page-header customer-list-header customer-list-header-card animate-in">
        <div className="customer-title-section">
          <h2 style={{fontFamily:'var(--font-heading)',fontWeight:800}}>Customers</h2>
          <p className="page-header-sub">
            {total>0?`${total} customer${total!==1?'s':''} registered`:'Manage and organise your customer records'}
          </p>
        </div>
        <div className="d-flex gap-2 align-center list-header-actions customer-mobile-toolbar customer-list-toolbar">
          <SharedSearchField
            ref={searchInputRef}
            className="list-header-search customer-search-field customer-search-wrapper"
            placeholder="Search by name, code, phone, WhatsApp..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="customer-toolbar-actions">
          {multiSelectActive && isAdmin && (
            <button className="btn btn-danger btn-sm" onClick={() => setShowDel(true)}>
              <TrashIcon/> Delete ({selected.size})
            </button>
          )}
            <button className="btn btn-outline-secondary btn-sm customer-import-button" onClick={() => { fileInputRef.current?.click(); }}>
            <Upload size={14}/> Import
          </button>
          <div style={{position:'relative'}}>
            <button ref={exportBtnRef} className="btn btn-outline-secondary btn-sm customer-export-button"
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setShowDataMenu(v => !v)}>
              <FileDown size={14}/> Export
            </button>
          </div>
          <button className="btn btn-primary btn-sm add-customer-button customer-add-button" onClick={() => navigate('/customers/new')}>
            <PlusIcon/> Add Customer
          </button>
          <AutoFitColumns tableRef={autoFitTableRef} className="customer-autofit-button"/>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{display:'none'}} onChange={handleImportFile}/>
        </div>

        {/* Export dropdown — portal renders at fixed screen position */}
        {showDataMenu && createPortal(
          <div ref={dataMenuRef} style={{
            position:'fixed', top: dropPos.top, right: dropPos.right,
            minWidth:190, background:'var(--card-bg)',
            border:'1.5px solid var(--primary)',
            borderRadius:10,
            boxShadow:'0 8px 28px rgba(0,0,0,.14)',
            zIndex:9999, overflow:'hidden',
            animation:'fadeIn .12s ease-out',
          }}>
            <button style={{display:'flex',alignItems:'center',gap:'.65rem',width:'100%',
              padding:'.75rem 1.1rem',background:'none',border:'none',cursor:'pointer',
              fontSize:'.88rem',fontWeight:700,color:'var(--text-primary)',textAlign:'left',
              transition:'background .12s'}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--scale-50)'}
              onMouseLeave={e=>e.currentTarget.style.background='none'}
              onClick={() => { handleExportCsv(); }}>
              <FileSpreadsheet size={16}/> Export Excel
            </button>
            <div style={{height:1,background:'var(--divider)',margin:'0 .75rem'}}/>
            <button style={{display:'flex',alignItems:'center',gap:'.65rem',width:'100%',
              padding:'.75rem 1.1rem',background:'none',border:'none',cursor:'pointer',
              fontSize:'.88rem',fontWeight:700,color:'var(--text-primary)',textAlign:'left',
              transition:'background .12s'}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--scale-50)'}
              onMouseLeave={e=>e.currentTarget.style.background='none'}
              onClick={() => { handleExportPDF(); }}>
              <FileText size={16}/> Export PDF
            </button>
          </div>,
          document.body
        )}
      </div>

      {error && (
        <div className="alert alert-warning animate-in" style={{marginBottom:'1rem',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'.75rem'}}>
          <span>{error}</span>
          <button className="btn btn-outline-secondary btn-sm" onClick={fetchCustomers}>Retry</button>
        </div>
      )}

      <div className="card animate-in animate-in-1 customer-desktop-table-card customer-table-container">
        <div className="card-body">
              <div ref={containerRef} className="list-keyboard-zone" tabIndex={0} onKeyDown={handleListKeyDown}>
              <div className="customer-table-tablet-view" role="table" aria-label="Customers">
                <div className="customer-table-header" role="row">
                  <div className="customer-checkbox-cell" role="columnheader" aria-label="Select">
                    {isAdmin ? <input type="checkbox" checked={allOnPageSelected}
                      ref={el => { if (el) el.indeterminate = anyOnPageSelected && !allOnPageSelected; }}
                      onChange={toggleSelectAll} aria-label="Select all visible customers" /> : <span aria-hidden="true">☐</span>}
                  </div>
                  <div className="customer-sno-cell" role="columnheader">S.No</div>
                  <div className="customer-code-cell" role="columnheader">Customer Code</div>
                  <div className="customer-name-cell" role="columnheader">Customer Name</div>
                  <div role="columnheader">Phone</div>
                  <div role="columnheader">WhatsApp</div>
                  <div role="columnheader">District</div>
                  <div role="columnheader">State</div>
                  <div role="columnheader">Status</div>
                </div>
                {customers.length === 0 ? (
                  <div className="customer-table-empty-row" role="row">
                    <div role="cell">{deb ? 'No matching records found' : 'No records found'}</div>
                  </div>
                ) : customers.map(c => {
                  const code = customerCode(c);
                  const name = customerName(c);
                  const phone = customerPhone(c);
                  const whatsapp = customerWhatsapp(c);
                  const district = customerDistrict(c);
                  const state = customerState(c);
                  return (
                    <div className="customer-table-row" role="row" key={`tablet-${c.id}`} tabIndex={0}
                      onClick={e => openCustomerRowDetails(e, c)}
                      onKeyDown={e => { if (e.key === 'Enter' && !isInteractiveTarget(e.target)) openCustomerRowDetails(e, c); }}>
                      <div className="customer-checkbox-cell" role="cell" onClick={e => e.stopPropagation()}>
                        {isAdmin && <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} aria-label={`Select ${name || 'customer'}`} />}
                      </div>
                      <div className="customer-sno-cell" role="cell">{(loadedPage - 1) * pageSize + customers.indexOf(c) + 1}</div>
                      <div className="customer-code-cell" role="cell" title={code || '--'}>{code || '—'}</div>
                      <div className="customer-name-cell" role="cell" title={name || '--'}>{name || '—'}</div>
                      <div className="customer-phone-cell" role="cell" title={phone || '--'}>{phone || '—'}</div>
                      <div className="customer-whatsapp-cell" role="cell" title={whatsapp || '--'}>{whatsapp || '—'}</div>
                      <div className="customer-district-cell" role="cell" title={district || '--'}>{district || '—'}</div>
                      <div className="customer-state-cell" role="cell" title={state || '--'}>{state || '—'}</div>
                      <div className="customer-status-cell" role="cell">
                        <span className="customer-status-value">{c.IsActive === false ? 'Inactive' : 'Active'}</span>
                        {isAdmin && <div className="customer-row-hover-actions">
                          <button type="button" aria-label={`View ${name || 'customer'}`} title="View"
                            onClick={e => { e.preventDefault(); e.stopPropagation(); setViewMore(c); }}><Eye size={16} /></button>
                          <button type="button" aria-label={`Delete ${name || 'customer'}`} title="Delete"
                            onClick={e => { e.preventDefault(); e.stopPropagation(); selectCustomer(c.id); setDelTarget(c.id); setShowDel(true); }}><Trash2 size={16} /></button>
                        </div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="desktop-table-view">
              <SplitTable
                tableRef={autoFitTableRef}
                className={`table table-compact customer-table customer-responsive-table compact-list-table data-table${isAdmin?' is-admin':''}${multiSelectActive?' has-selection':''}`}
                tableProps={{ style: { tableLayout: 'fixed', width: '100%' } }}
                colgroup={(
                  <colgroup>
                    {isAdmin && <col className="customer-col-select customer-hide-small-select" style={{width:'4%'}} />}
                    <col className="customer-col-sno" style={{width:'7%'}} />
                    <col className="customer-col-code customer-hide-mobile hide-below-xl" style={{width:isAdmin ? '12%' : '13%'}} />
                    <col className="customer-col-name" style={{width:isAdmin ? '27%' : '29%'}} />
                    <col className="customer-col-phone customer-hide-medium-mobile" style={{width:'14%'}} />
                    <col className="customer-col-whatsapp customer-hide-mobile hide-below-xl" style={{width:'14%'}} />
                    <col className="customer-col-district customer-hide-mobile hide-below-xl" style={{width:'10%'}} />
                    <col className="customer-col-state customer-hide-mobile hide-below-xl" style={{width:isAdmin ? '8%' : '9%'}} />
                    <col className="customer-row-actions-col" style={{width:'7%'}} />
                  </colgroup>
                )}
                empty={customers.length===0}
                head={(
                    <tr style={{background:'#8A5125'}}>
                      {isAdmin && <th className="row-cb-cell customer-col-select customer-hide-small-select" style={{background:'#8A5125',textAlign:'center',verticalAlign:'middle'}}>
                        <input type="checkbox"
                          checked={allOnPageSelected}
                          aria-label="Select all visible customers"
                          ref={el => { if (el) el.indeterminate = anyOnPageSelected && !allOnPageSelected; }}
                          onChange={toggleSelectAll}
                          title={allOnPageSelected ? 'Unselect all customers on this page' : 'Select all customers on this page'}
                          style={{width:15,height:15,cursor:'pointer',accentColor:'#8A5125',verticalAlign:'middle',display:'block',margin:'0 auto'}}/>
                      </th>}
                      <th className="customer-col-sno" style={{fontWeight:800,color:'#fff',background:'#8A5125'}}>S.No</th>
                      <th className="customer-col-code customer-hide-mobile hide-below-xl" style={{fontWeight:800,color:'#fff',background:'#8A5125'}}>Customer Code</th>
                      <th className="customer-col-name" style={{fontWeight:800,color:'#fff',background:'#8A5125'}}>
                        <span className="customer-desktop-label">Customer Name</span>
                        <span className="customer-mobile-label">Customer</span>
                      </th>
                      <th className="customer-col-phone customer-hide-medium-mobile" style={{fontWeight:800,color:'#fff',background:'#8A5125'}}>Phone</th>
                      <th className="customer-col-whatsapp customer-hide-mobile hide-below-xl" style={{fontWeight:800,color:'#fff',background:'#8A5125'}}>WhatsApp</th>
                      <th className="customer-col-district customer-hide-mobile hide-below-xl" style={{fontWeight:800,color:'#fff',background:'#8A5125'}}>District</th>
                      <th className="customer-col-state customer-hide-mobile hide-below-xl" style={{fontWeight:800,color:'#fff',background:'#8A5125'}}>State</th>
                      <th className="customer-row-actions-header" aria-label="Row actions" style={{fontWeight:800,color:'#fff',background:'#8A5125'}} />
                    </tr>
                )}
              >
                    {customers.length === 0 ? (
                      <tr className="customer-empty-row">
                        <td colSpan={isAdmin?9:8} className="customer-empty-cell">
                          {deb ? 'No matching records found' : 'No records found'}
                        </td>
                      </tr>
                    ) : customers.map((c, idx) => {
                      const code = customerCode(c);
                      const name = customerName(c);
                      const phone = customerPhone(c);
                      const whatsapp = customerWhatsapp(c);
                      const district = customerDistrict(c);
                      const state = customerState(c);
                      const address = parseAddress(c.Address);
                      const isExpanded = expandedId === c.id;
                      return (
                        <Fragment key={c.id}>
                        <tr ref={idx === 0 ? rowRef : undefined}
                          className={`table-row-hover customer-table-row${selectedCustomerId === c.id ? ' row-keyboard-selected' : ''}`}
                          style={{cursor:'pointer',position:'relative'}}
                          tabIndex={0}
                          aria-label={`View details for ${name || 'customer'}`}
                          onMouseEnter={(e) => { e.currentTarget.closest('.list-keyboard-zone')?.focus(); setHoveredCustomerId(c.id); setSelectedCustomerId(c.id); setDismissedActionCustomerId(null); }}
                          onMouseLeave={() => setHoveredCustomerId(prev => prev === c.id ? null : prev)}
                          onClick={(e) => {
                            openCustomerRowDetails(e, c);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !isInteractiveTarget(e.target)) openCustomerRowDetails(e, c);
                          }}
                          onDoubleClick={(e) => {
                            if (isInteractiveTarget(e.target)) return;
                            selectCustomer(c.id);
                            if (isAdmin) navigate(`/customers/${c.id}`);
                            else setViewMore(c);
                          }}>
                          {isAdmin && (
                            <td className="row-cb-cell customer-col-select customer-hide-small-select" onClick={e=>{e.stopPropagation();toggleSelect(c.id);}}>
                              <input type="checkbox" className="row-cb"
                                checked={selected.has(c.id)}
                                onClick={e => e.stopPropagation()}
                                onChange={() => toggleSelect(c.id)}
                                style={{accentColor:'#8A5125',width:14,height:14}}/>
                            </td>
                          )}
                          <td className="customer-cell-sno customer-col-sno" title={`${(loadedPage-1)*pageSize+idx+1}`}>
                            {(loadedPage-1)*pageSize+idx+1}
                          </td>
                          <td className="customer-cell-code customer-col-code customer-hide-mobile hide-below-xl" title={code || '--'}>
                            <code>{code || '--'}</code>
                          </td>
                          <td className="customer-cell-name customer-col-name" title={name || '--'}>
                            <div className="customer-table-customer-cell customer-main-cell">
                            <span className="customer-name-value customer-table-name customer-name">{name || '--'}</span>
                            </div>
                          </td>
                          <td className="customer-cell-phone customer-phone-cell customer-col-phone customer-hide-medium-mobile" title={phone || '--'}>{phone || <span style={{opacity:.4}}>--</span>}</td>
                          <td className="customer-cell-whatsapp customer-col-whatsapp customer-hide-mobile hide-below-xl" title={whatsapp || '--'}>{whatsapp || <span style={{opacity:.4}}>--</span>}</td>
                          <td className="customer-cell-district customer-col-district customer-hide-mobile hide-below-xl" title={district || '--'}>{district || <span style={{opacity:.4}}>--</span>}</td>
                          <td className="customer-cell-state customer-col-state customer-hide-mobile hide-below-xl" title={state || '--'}>
                            {state || <span style={{opacity:.4}}>--</span>}
                          </td>
                          <td className="customer-row-actions-cell customer-status-cell">
                            {isAdmin && <div className="customer-row-hover-actions">
                              <button type="button" aria-label={`View ${name || 'customer'}`} title="View"
                                onClick={e => { e.preventDefault(); e.stopPropagation(); setViewMore(c); }}><Eye size={16} /></button>
                              <button type="button" aria-label={`Delete ${name || 'customer'}`} title="Delete"
                                onClick={e => { e.preventDefault(); e.stopPropagation(); selectCustomer(c.id); setDelTarget(c.id); setShowDel(true); }}><Trash2 size={16} /></button>
                            </div>}
                          </td>
                        </tr>
                        {isExpanded && !isTabletLayout && (
                          <tr className="detail-row">
                            <td colSpan={isAdmin ? 9 : 8} className="detail-row-cell">
                              <div className="detail-grid">
                                <div><span>Code</span><strong>{code || '--'}</strong></div>
                                <div><span>Phone</span><strong>{phone || '--'}</strong></div>
                                <div><span>WhatsApp</span><strong>{whatsapp || '--'}</strong></div>
                                <div><span>District</span><strong>{district || '--'}</strong></div>
                                <div><span>State</span><strong>{state || '--'}</strong></div>
                                <div><span>GST Number</span><strong>{address.gstNo || '--'}</strong></div>
                                <div><span>Price Type</span><strong>{c.PriceCodeType || '--'}</strong></div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      );
                    })}
              </SplitTable>
              </div>
              </div>

              <div className="customer-details-section">
              <div className="customer-mobile-section-header">Customer Details</div>
              <div className="customer-mobile-record-list" aria-label="Customers">
                {customers.length === 0 ? (
                  <div className="customer-mobile-empty">{deb ? 'No matching records found' : 'No records found'}</div>
                ) : customers.map(c => {
                  const name = customerName(c) || '—';
                  const phone = customerPhone(c) || '—';
                  const priceType = customerPriceType(c);
                  const fixedCode = customerFixedPriceCode(c);
                  const meta = [phone, priceType, fixedCode].filter(Boolean).join(' · ');
                  const isOpen = activeCustomerMenuId === c.id;
                  return (
                    <article className={`customer-mobile-record-row${isOpen ? ' is-open' : ''}`} key={c.id}
                      tabIndex={0} aria-label={`View details for ${name}`}
                      onClick={e => openCustomerMobileDetails(e, c)}
                      onKeyDown={e => { if (e.key === 'Enter') openCustomerMobileDetails(e, c); }}>
                      <div className="customer-mobile-record-content">
                        <span className="customer-mobile-record-title">{name}</span>
                        <span className="customer-mobile-record-meta">{meta || '—'}</span>
                      </div>
                      <div className="customer-mobile-actions">
                        {isOpen ? (
                          <div className="customer-mobile-inline-actions">
                            <button type="button" aria-label="View customer" title="View" onClick={() => { setActiveCustomerMenuId(null); setViewMore(c); }}><Eye size={15}/></button>
                            {isAdmin && <button type="button" aria-label="Edit customer" title="Edit" onClick={() => { setActiveCustomerMenuId(null); navigate(`/customers/${c.id}`); }}><Pencil size={15}/></button>}
                            {isAdmin && <button type="button" className="danger" aria-label="Delete customer" title="Delete" onClick={() => { setActiveCustomerMenuId(null); selectCustomer(c.id); setDelTarget(c.id); setShowDel(true); }}><Trash2 size={15}/></button>}
                          </div>
                        ) : (
                          <button type="button" className="customer-mobile-menu-button" aria-label={`Actions for ${name}`} title="Customer actions" onClick={() => setActiveCustomerMenuId(c.id)}><MoreIcon/></button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
              </div>

              <div ref={bottomRef} className="table-pagination-footer">
                <div className="product-record-info">
                  Showing {customers.length ? `${((loadedPage - 1) * pageSize) + 1}-${Math.min(((loadedPage - 1) * pageSize) + customers.length, total)}` : <>0&ndash;0</>} of {total} records
                </div>
                <div className="pagination" style={{marginTop:0}}>
                  <button className="pg-item" disabled={loadedPage===1 || total===0} onClick={() => setPage(Math.max(1,loadedPage-1))}>Previous</button>
                  {total > 0 && buildPages().map((n,i) =>
                    n==='...' || n==='…'
                      ? <span key={`e${i}`} className="pg-item" style={{border:'none',cursor:'default',color:'var(--text-muted)'}}>...</span>
                      : <button key={n} className={`pg-item${loadedPage===n?' active':''}`} onClick={() => setPage(n)}>{n}</button>
                  )}
                  <button className="pg-item" disabled={loadedPage===totalPages || total===0} onClick={() => setPage(Math.min(totalPages,loadedPage+1))}>Next</button>
                </div>
              </div>
        </div>
      </div>

      <ConfirmModal
        show={showDel}
        title="Delete Customer"
        message={selected.size>1
          ?`Delete ${selected.size} selected customers? This cannot be undone.`
          :'Delete this customer? This action cannot be undone.'}
        onConfirm={handleDelete}
        onCancel={() => { setShowDel(false); setDelTarget(null); }}
        confirmVariant="danger"
        confirmText={deleting?'Deleting…':'Delete'}
        cancelText="Cancel"
      />
    </Layout>
  );
};

export default CustomerList;
