import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import ConfirmModal from '../../components/ConfirmModal';
import SplitTable from '../../components/SplitTable';
import RowActionPopup from '../../components/RowActionPopup';
import customerService from '../../services/customerService';
import { clearPageCache, fetchCachedPage, getCachedPage, makePageKey, prefetchCachedPage } from '../../services/pageCache';
import { useAuth } from '../../context/AuthContext';
import { Upload, FileDown, FileSpreadsheet, FileText } from 'lucide-react';

const TrashIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
const MoreIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>;
const CloseIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const SearchIcon= () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const PlusIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const ViewIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;

const PAGE_SIZE = 13;
const fmt = (str) => str ? new Date(str).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'}) : 'â€”';

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

/* â”€â”€ View More Modal â”€â”€ */
const ViewMoreModal = ({ customer, onClose }) => {
  if (!customer) return null;
  const addr = parseAddress(customer.Address);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{maxWidth:520}} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{customer.CustomerName}</span>
          <button className="modal-close" onClick={onClose}><CloseIcon/></button>
        </div>
        <div className="modal-body" style={{paddingBottom:'1.25rem'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.4rem .875rem',fontSize:'.82rem'}}>
            {[
              ['Code',       customer.CustomerCode],
              ['Phone',      customer.PhoneNumber],
              ['WhatsApp',   customer.WhatsappNumber||'â€”'],
              ['Email',      customer.EmailId||'â€”'],
              ['Address',    addr.address||'â€”'],
              ['District',   addr.district||'â€”'],
              ['State',      addr.state||'â€”'],
              ['Country',    addr.country||'â€”'],
              ['PIN Code',   addr.pin||'â€”'],
              ['GST Type',   addr.gstType||'â€”'],
              ['GST No',     addr.gstNo||'â€”'],
              ['Price Type', customer.PriceCodeType||'â€”'],
              ['Reward Points', `${parseFloat(customer.Customer_Redeem_Points||0).toFixed(0)} pts`],
              ['Status',     customer.IsActive!==false?'Active':'Inactive'],
              ['Created On', fmt(customer.CreatedOn)],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{color:'var(--text-muted)',fontSize:'.68rem',fontWeight:700,marginBottom:'.1rem',textTransform:'uppercase',letterSpacing:'.04em'}}>{label}</div>
                {label === 'Status' ? (
                  <span style={{
                    display:'inline-flex',alignItems:'center',gap:'.3rem',
                    fontSize:'.72rem',fontWeight:700,padding:'3px 10px',borderRadius:999,
                    background: customer.IsActive!==false ? 'var(--primary-light)' : 'var(--danger-light)',
                    color: customer.IsActive!==false ? 'var(--primary-dark)' : 'var(--danger)',
                    border: `1px solid ${customer.IsActive!==false ? 'var(--secondary)' : 'rgba(211,47,47,.25)'}`,
                  }}>
                    {customer.IsActive!==false
                      ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:11,height:11}}><polyline points="20 6 9 17 4 12"/></svg>
                      : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:11,height:11}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    }
                    {value}
                  </span>
                ) : (
                  <div style={{color:'var(--text-primary)',fontWeight:600}}>{value}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const CustomerList = () => {
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
  const [showDataMenu,setShowDataMenu]= useState(false);
  const dataMenuRef  = useRef(null);
  const exportBtnRef = useRef(null);
  const fileInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const fetchSeqRef = useRef(0);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });

  // Position portal dropdown under the Export button
  useLayoutEffect(() => {
    if (showDataMenu && exportBtnRef.current) {
      const r = exportBtnRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
  }, [showDataMenu]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const multiSelectActive = selected.size > 1;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const isInteractiveTarget = (target) => Boolean(target?.closest?.(
    'input, select, textarea, button, a, [role="button"], .pagination, .row-action-popup'
  ));

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
      if (isAdmin) navigate(`/customers/${active.id}`);
      else setViewMore(active);
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
    searchInputRef.current?.focus();
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
    const params = { page, page_size: PAGE_SIZE };
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
      const maxPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
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
  }, [page, deb]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const handleDelete = async () => {
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
      : deb ? `Search: "${deb}" â€” ${data.length} record${data.length !== 1 ? 's' : ''}` : `All Records â€” ${data.length} total`;
    const dateStr = new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

    const rowsHtml = data.map((c, idx) => {
      const addr = parseAddress(c.Address);
      const status = c.IsActive !== false ? 'Active' : 'Inactive';
      return `<tr>
        <td class="num">${idx+1}</td>
        <td class="mono">${c.CustomerCode||''}</td>
        <td class="bold">${c.CustomerName||''}</td>
        <td>${c.PhoneNumber||''}</td>
        <td>${c.WhatsappNumber||'â€”'}</td>
        <td>${addr.address||'â€”'}</td>
        <td>${addr.district||'â€”'}</td>
        <td>${addr.state||'â€”'}</td>
        <td class="num">${addr.pin||'â€”'}</td>
        <td>${addr.gstType&&addr.gstType!=='Unregistered'?`<span class="gst-badge">${addr.gstType}</span>`:'<span class="na">â€”</span>'}</td>
        <td class="mono small">${addr.gstNo||'â€”'}</td>
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
  /* â”€â”€ header â”€â”€ */
  .rpt-header { display: flex; justify-content: space-between; align-items: flex-end;
    border-bottom: 2.5px solid #8A5125; padding-bottom: 7px; margin-bottom: 10px; }
  .rpt-header-left h1 { font-size: 18px; font-weight: 800; color: #8A5125; letter-spacing: -.4px; line-height: 1.1; }
  .rpt-header-left p  { font-size: 9px; color: #7a6758; margin-top: 3px; }
  .rpt-header-right   { text-align: right; font-size: 9px; color: #7a6758; line-height: 1.7; }
  .rpt-header-right strong { color: #4a3426; }
  /* â”€â”€ table â”€â”€ */
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
  /* â”€â”€ footer â”€â”€ */
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
    <span>POS Billing System â€” Customer Report</span>
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
    if (loadedPage<=4) pages.push(1,2,3,4,5,'â€¦',totalPages);
    else if (loadedPage>=totalPages-3) pages.push(1,'â€¦',totalPages-4,totalPages-3,totalPages-2,totalPages-1,totalPages);
    else pages.push(1,'â€¦',loadedPage-1,loadedPage,loadedPage+1,'â€¦',totalPages);
    return pages;
  };

  return (
    <Layout>
      {viewMore && <ViewMoreModal customer={viewMore} onClose={() => setViewMore(null)}/>}

      <div className="page-header customer-list-header animate-in">
        <div>
          <h2 style={{fontFamily:'var(--font-heading)',fontWeight:800}}>Customers</h2>
          <p className="page-header-sub">
            {total>0?`${total} customer${total!==1?'s':''} registered`:'Manage and organise your customer records'}
          </p>
        </div>
        <div className="d-flex gap-2 align-center list-header-actions">
          <div className="input-group list-header-search">
            <span className="input-group-text"><SearchIcon/></span>
            <input ref={searchInputRef} type="text" className="form-control"
              placeholder="Search customers..."
              value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          {multiSelectActive && isAdmin && (
            <button className="btn btn-danger btn-sm" onClick={() => setShowDel(true)}>
              <TrashIcon/> Delete ({selected.size})
            </button>
          )}
          <button className="btn btn-outline-secondary btn-sm" onClick={() => { fileInputRef.current?.click(); }}>
            <Upload size={14}/> Import
          </button>
          <div style={{position:'relative'}}>
            <button ref={exportBtnRef} className="btn btn-outline-secondary btn-sm"
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setShowDataMenu(v => !v)}>
              <FileDown size={14}/> Export
            </button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/customers/new')}>
            <PlusIcon/> Add Customer
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{display:'none'}} onChange={handleImportFile}/>
        </div>

        {/* Export dropdown â€” portal renders at fixed screen position */}
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

      <div className="card animate-in animate-in-1">
        <div className="card-body">
          <div className="list-toolbar" style={{display:'none'}}>
            <div className="input-group">
              <span className="input-group-text"><SearchIcon/></span>
              <input type="text" className="form-control"
                placeholder="Search by name, code, phone, WhatsApp, email or stateâ€¦"
                value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
          </div>

              <div className="list-keyboard-zone" tabIndex={0} onKeyDown={handleListKeyDown}>
              <SplitTable
                className={`table table-compact customer-table compact-list-table data-table${multiSelectActive?' has-selection':''}`}
                tableProps={{ style: { tableLayout: 'fixed', width: '100%' } }}
                colgroup={(
                  <colgroup>
                    {isAdmin && <col style={{width:'4%'}} />}
                    <col style={{width:'7%'}} />
                    <col style={{width:isAdmin ? '12%' : '13%'}} />
                    <col style={{width:isAdmin ? '29%' : '31%'}} />
                    <col style={{width:'14%'}} />
                    <col style={{width:'14%'}} />
                    <col style={{width:'10%'}} />
                    <col style={{width:isAdmin ? '10%' : '11%'}} />
                  </colgroup>
                )}
                empty={customers.length===0}
                head={(
                    <tr style={{background:'#8A5125'}}>
                      {isAdmin && <th className="row-cb-cell" style={{background:'#8A5125',textAlign:'center',verticalAlign:'middle'}}>
                        <input type="checkbox"
                          checked={allOnPageSelected}
                          ref={el => { if (el) el.indeterminate = anyOnPageSelected && !allOnPageSelected; }}
                          onChange={toggleSelectAll}
                          title={allOnPageSelected ? 'Unselect all customers on this page' : 'Select all customers on this page'}
                          style={{width:15,height:15,cursor:'pointer',accentColor:'#8A5125',verticalAlign:'middle',display:'block',margin:'0 auto'}}/>
                      </th>}
                      <th style={{fontWeight:800,color:'#fff',background:'#8A5125'}}>S.No</th>
                      <th style={{fontWeight:800,color:'#fff',background:'#8A5125'}}>Code</th>
                      <th style={{fontWeight:800,color:'#fff',background:'#8A5125'}}>Customer Name</th>
                      <th style={{fontWeight:800,color:'#fff',background:'#8A5125'}}>Phone</th>
                      <th style={{fontWeight:800,color:'#fff',background:'#8A5125'}}>WhatsApp</th>
                      <th style={{fontWeight:800,color:'#fff',background:'#8A5125'}}>District</th>
                      <th style={{fontWeight:800,color:'#fff',background:'#8A5125'}}>State</th>
                    </tr>
                )}
              >
                    {customers.length === 0 ? (
                      <tr className="customer-empty-row">
                        <td colSpan={isAdmin?8:7} className="customer-empty-cell">
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
                      return (
                        <tr key={c.id}
                          className={`table-row-hover${selectedCustomerId === c.id ? ' row-keyboard-selected' : ''}`}
                          style={{cursor:'pointer',position:'relative'}}
                          onMouseEnter={(e) => { e.currentTarget.closest('.list-keyboard-zone')?.focus(); setHoveredCustomerId(c.id); setSelectedCustomerId(c.id); setDismissedActionCustomerId(null); }}
                          onMouseLeave={() => setHoveredCustomerId(prev => prev === c.id ? null : prev)}
                          onClick={(e) => {
                            if (isInteractiveTarget(e.target)) return;
                            selectCustomer(c.id);
                          }}
                          onDoubleClick={(e) => {
                            if (isInteractiveTarget(e.target)) return;
                            selectCustomer(c.id);
                            if (isAdmin) navigate(`/customers/${c.id}`);
                            else setViewMore(c);
                          }}>
                          {isAdmin && (
                            <td className="row-cb-cell" onClick={e=>{e.stopPropagation();toggleSelect(c.id);}}>
                              <input type="checkbox" className="row-cb"
                                checked={selected.has(c.id)}
                                onClick={e => e.stopPropagation()}
                                onChange={() => toggleSelect(c.id)}
                                style={{accentColor:'#8A5125',width:14,height:14}}/>
                            </td>
                          )}
                          <td className="customer-cell-sno" title={`${(loadedPage-1)*PAGE_SIZE+idx+1}`}>
                            {(loadedPage-1)*PAGE_SIZE+idx+1}
                          </td>
                          <td className="customer-cell-code" title={code || '--'}>
                            <code>{code || '--'}</code>
                          </td>
                          <td className="customer-cell-name" title={name || '--'}>
                            <span>{name || '--'}</span>
                          </td>
                          <td className="customer-cell-phone" title={phone || '--'}>{phone || <span style={{opacity:.4}}>--</span>}</td>
                          <td className="customer-cell-whatsapp" title={whatsapp || '--'}>{whatsapp || <span style={{opacity:.4}}>--</span>}</td>
                          <td className="customer-cell-district" title={district || '--'}>{district || <span style={{opacity:.4}}>--</span>}</td>
                          <td className="customer-cell-state row-action-anchor" title={state || '--'}>
                            {state || <span style={{opacity:.4}}>--</span>}
                            <RowActionPopup
                              visible={selected.size < 2 && hoveredCustomerId === c.id && dismissedActionCustomerId !== c.id}
                              onDismiss={() => { setDismissedActionCustomerId(hoveredCustomerId ?? selectedCustomerId); setHoveredCustomerId(null); }}
                              actions={[
                                { type:'view', title:'View More', onClick:() => setViewMore(c) },
                                isAdmin && { type:'delete', title:'Delete', variant:'danger', onClick:() => { selectCustomer(c.id); setDelTarget(c.id); setShowDel(true); } },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })}
              </SplitTable>
              </div>

              <div className="table-pagination-footer">
                <div className="product-record-info">
                  Showing {customers.length ? `${((loadedPage - 1) * PAGE_SIZE) + 1}-${Math.min(((loadedPage - 1) * PAGE_SIZE) + customers.length, total)}` : <>0&ndash;0</>} of {total} records
                </div>
                <div className="pagination" style={{marginTop:0}}>
                  <button className="pg-item" disabled={loadedPage===1 || total===0} onClick={() => setPage(Math.max(1,loadedPage-1))}>Previous</button>
                  {total > 0 && buildPages().map((n,i) =>
                    n==='...' || n==='â€¦'
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
        confirmText={deleting?'Deletingâ€¦':'Delete'}
        cancelText="Cancel"
      />
    </Layout>
  );
};

export default CustomerList;




