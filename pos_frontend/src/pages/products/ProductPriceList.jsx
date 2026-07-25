import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import SplitTable from '../../components/SplitTable';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import productService from '../../services/productService';
import productGroupService from '../../services/productGroupService';
import billingService from '../../services/billingService';
import { formatBackendImportError, getImportToast, isCanceledImport, isTimeoutImport } from '../../utils/excelImportFeedback';
import useResponsivePageSize from '../../hooks/useResponsivePageSize';

const BRAND = '#8A5125';
const PRICE_CODE_ORDERING = 'id';
const PRICE_CODE_PAGE_CACHE_LIMIT = 20;
const PRICE_CODE_PAGE_STORAGE_KEY = 'price-code-list-page';
const PRICE_CODE_CACHE_STORAGE_KEY = 'price-code-list-cache-v1';
import SharedSearchField from '../../components/SharedSearchField';
const UploadIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;

const Spin = () => (
  <span style={{display:'inline-block',width:13,height:13,
    border:'2px solid rgba(255,255,255,.35)',borderTopColor:'#fff',
    borderRadius:'50%',animation:'spin .6s linear infinite'}}/>
);
const ImportSpin = () => (
  <svg className="import-loading-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3h12M6 21h12M8 3c0 4 2.5 5.5 4 7 1.5-1.5 4-3 4-7M8 21c0-4 2.5-5.5 4-7 1.5 1.5 4 3 4 7"/>
  </svg>
);

const ProductPriceList = () => {
  const navigate = useNavigate();
  const { isAdmin, user, username } = useAuth();
  const toast = useToast();

  const [loading,    setLoading]    = useState(true);
  const [products,   setProducts]   = useState([]);
  const [priceCodes, setPriceCodes] = useState([]);
  const [search,     setSearch]     = useState('');
  const [debSearch,  setDebSearch]  = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [groups, setGroups] = useState([]);
  const [page,       setPage]       = useState(() => {
    const saved = Number(sessionStorage.getItem(PRICE_CODE_PAGE_STORAGE_KEY) || 1);
    return Number.isFinite(saved) && saved > 0 ? saved : 1;
  });
  const [loadedPage, setLoadedPage] = useState(page);
  const [total,      setTotal]      = useState(0);
  const [rows,       setRows]       = useState({});   // { productId: { pcId: value, ... } }
  const [dirty,      setDirty]      = useState({});   // { productId: bool }
  const [saving,     setSaving]     = useState({});   // { productId: bool }
  const [savingAll,  setSavingAll]  = useState(false);
  const [importing,  setImporting]  = useState(false);
  const [error,      setError]      = useState('');
  const [lastLoadFailed, setLastLoadFailed] = useState(false);
  const [activeRowId, setActiveRowId] = useState(null);
  const fileInputRef = useRef(null);
  const fetchSeqRef = useRef(0);
  const importAbortRef = useRef(null);
  const dirtyRef = useRef({});
  const navigationLockRef = useRef(false);
  const pageCacheRef = useRef(new Map());
  const pageRequestsRef = useRef(new Map());
  const { pageSize, containerRef, rowRef, bottomRef } = useResponsivePageSize({
    defaultRowHeight: 36,
    mobileRowHeight: 36,
    reservedBottomSpace: 52,
  });

  const persistPageCache = useCallback(() => {
    try {
      sessionStorage.setItem(PRICE_CODE_CACHE_STORAGE_KEY, JSON.stringify([...pageCacheRef.current.entries()]));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(PRICE_CODE_CACHE_STORAGE_KEY) || '[]');
      if (Array.isArray(cached)) pageCacheRef.current = new Map(cached);
    } catch {
      pageCacheRef.current = new Map();
    }
  }, []);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [groupFilter]);
  useEffect(() => {
    setPage(1);
    setProducts([]);
    setActiveRowId(null);
  }, [pageSize]);

  useEffect(() => {
    productGroupService.getGroupsDropdown()
      .then(data => setGroups(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Redirect non-admins immediately
  useEffect(() => {
    if (!isAdmin) { navigate('/dashboard', { replace: true }); }
  }, [isAdmin, navigate]);

  const applyPageData = useCallback((prods, pcs, count) => {
    setProducts(prods);
    setTotal(count ?? prods.length);
    setPriceCodes(pcs);
    const init = {};
    prods.forEach(p => {
      init[p.id] = {};
      pcs.forEach(pc => {
        const tier = (p.prices || []).find(t => t.PriceCodeID === pc.id);
        init[p.id][pc.id] = tier ? String(tier.ProductPrice) : '';
      });
    });
    setRows(prev => {
      const next = { ...prev };
      prods.forEach(p => {
        if (!dirtyRef.current[p.id]) next[p.id] = init[p.id];
      });
      return next;
    });
  }, []);

  const loadData = useCallback(async (options = {}) => {
    const seq = ++fetchSeqRef.current;
    setError(''); setLastLoadFailed(false);
    const searchTerm = debSearch;
    const authScope = user?.id || user?.username || username || 'anonymous';
    const cacheKey = `${authScope}|price-code-list|page=${page}|page_size=${pageSize}|search=${searchTerm}|group=${groupFilter}|status=active|ordering=${PRICE_CODE_ORDERING}`;
    const cached = !options.force ? pageCacheRef.current.get(cacheKey) : null;
    if (cached) {
      applyPageData(cached.products, cached.priceCodes, cached.total);
      setLoadedPage(page);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const params = {
        page,
        page_size: pageSize,
        ordering: PRICE_CODE_ORDERING,
        ...(searchTerm ? { search: searchTerm } : {}),
        ...(groupFilter ? { group: groupFilter } : {}),
      };
      let request = pageRequestsRef.current.get(cacheKey);
      if (!request || options.force) {
        request = Promise.all([
          api.get('/products/for-price-page/', { params, dedupe: false, timeout: 30000 }),
          billingService.getPriceCodes(),
        ]).finally(() => {
          if (pageRequestsRef.current.get(cacheKey) === request) {
            pageRequestsRef.current.delete(cacheKey);
          }
        });
        pageRequestsRef.current.set(cacheKey, request);
      }
      const [prodsRes, pcs] = await request;
      if (seq !== fetchSeqRef.current) return;
      const prods = Array.isArray(prodsRes.data) ? prodsRes.data : (prodsRes.data.results || []);
      const totalCount = prodsRes.data.count ?? prods.length;
      pageCacheRef.current.set(cacheKey, { products: prods, priceCodes: pcs, total: totalCount });
      while (pageCacheRef.current.size > PRICE_CODE_PAGE_CACHE_LIMIT) {
        const oldestKey = pageCacheRef.current.keys().next().value;
        pageCacheRef.current.delete(oldestKey);
      }
      persistPageCache();
      applyPageData(prods, pcs, totalCount);
      setLoadedPage(page);
      const maxPage = Math.max(1, Math.ceil(totalCount / pageSize));
      [page - 1, page + 1].filter(n => n >= 1 && n <= maxPage).forEach(n => {
        const nextParams = { ...params, page: n };
        const nextKey = `${authScope}|price-code-list|page=${n}|page_size=${pageSize}|search=${searchTerm}|group=${groupFilter}|status=active|ordering=${PRICE_CODE_ORDERING}`;
        if (pageCacheRef.current.has(nextKey) || pageRequestsRef.current.has(nextKey)) return;
        const prefetch = Promise.all([
          api.get('/products/for-price-page/', { params: nextParams, dedupe: false, timeout: 30000 }),
          billingService.getPriceCodes(),
        ]).then(([nextRes, nextPcs]) => {
          const nextProducts = Array.isArray(nextRes.data) ? nextRes.data : (nextRes.data.results || []);
          pageCacheRef.current.set(nextKey, {
            products: nextProducts,
            priceCodes: nextPcs,
            total: nextRes.data.count ?? nextProducts.length,
          });
          while (pageCacheRef.current.size > PRICE_CODE_PAGE_CACHE_LIMIT) {
            const oldestKey = pageCacheRef.current.keys().next().value;
            pageCacheRef.current.delete(oldestKey);
          }
          persistPageCache();
        }).catch(() => {}).finally(() => {
          if (pageRequestsRef.current.get(nextKey) === prefetch) {
            pageRequestsRef.current.delete(nextKey);
          }
        });
        pageRequestsRef.current.set(nextKey, prefetch);
      });
      setLastLoadFailed(false);
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      pageCacheRef.current.delete(cacheKey);
      pageRequestsRef.current.delete(cacheKey);
      setLastLoadFailed(true);
      setError(err.response?.data?.detail || 'Unable to retrieve data. Retry.');
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [applyPageData, debSearch, groupFilter, page, pageSize, persistPageCache, products.length, user, username]);

  useEffect(() => {
    const clearPriceCodeCache = () => {
      pageCacheRef.current.clear();
      pageRequestsRef.current.clear();
      sessionStorage.removeItem(PRICE_CODE_CACHE_STORAGE_KEY);
    };
    window.addEventListener('pos-auth-cleared', clearPriceCodeCache);
    window.addEventListener('pos-products-changed', clearPriceCodeCache);
    return () => {
      window.removeEventListener('pos-auth-cleared', clearPriceCodeCache);
      window.removeEventListener('pos-products-changed', clearPriceCodeCache);
    };
  }, []);

  useEffect(() => { if (isAdmin) loadData(); }, [isAdmin, loadData]);

  useEffect(() => {
    sessionStorage.setItem(PRICE_CODE_PAGE_STORAGE_KEY, String(page));
  }, [page]);

  const handleChange = (productId, pcId, value) => {
    setRows(prev => ({
      ...prev,
      [productId]: { ...prev[productId], [pcId]: value },
    }));
    setDirty(prev => ({ ...prev, [productId]: true }));
  };

  const validateRow = (productId) => {
    const vals = rows[productId] || {};
    for (const pc of priceCodes) {
      const v = vals[pc.id];
      if (v === '' || v === undefined || v === null) continue;
      const n = parseFloat(v);
      if (isNaN(n) || n < 0) return `${pc.DisplayLabel} must be ≥ 0.`;
    }
    return null;
  };

  const saveRow = async (productId) => {
    const err = validateRow(productId);
    if (err) { toast.error('Validation Error', err); return; }
    setSaving(prev => ({ ...prev, [productId]: true }));
    try {
      const prices = {};
      priceCodes.forEach(pc => {
        const value = rows[productId][pc.id];
        if (value !== '' && value !== undefined && value !== null) prices[pc.id] = parseFloat(value);
      });
      await api.post('/product-price-save/', { ProductId: productId, prices });
      window.dispatchEvent(new Event('pos-products-changed'));
      setDirty(prev => ({ ...prev, [productId]: false }));
      toast.success('Saved', 'Rates updated.');
    } catch (err) {
      toast.error('Save Failed', err.response?.data?.detail || 'Could not save rates.');
    } finally {
      setSaving(prev => ({ ...prev, [productId]: false }));
    }
  };

  const saveAll = async () => {
    const dirtyIds = Object.entries(dirty).filter(([,v]) => v).map(([k]) => parseInt(k));
    if (!dirtyIds.length) { toast.error('Nothing to save', 'No unsaved changes.'); return; }
    setSavingAll(true);
    let failed = 0;
    for (const pid of dirtyIds) {
      const err = validateRow(pid);
      if (err) { failed++; toast.error('Validation', err); continue; }
      try {
        const prices = {};
        priceCodes.forEach(pc => {
          const value = rows[pid][pc.id];
          if (value !== '' && value !== undefined && value !== null) prices[pc.id] = parseFloat(value);
        });
        await api.post('/product-price-save/', { ProductId: pid, prices });
        window.dispatchEvent(new Event('pos-products-changed'));
        setDirty(prev => ({ ...prev, [pid]: false }));
      } catch { failed++; }
    }
    setSavingAll(false);
    if (!failed) toast.success('Saved All', 'All rates updated.');
    else toast.error('Partial Save', `${failed} row(s) failed.`);
  };

  const csvEscape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const handleExportCsv = () => {
    const headers = ['ProductCode', 'ProductName', ...priceCodes.map(pc => pc.DisplayLabel)];
    const data = products.map(p => [
      p.ProductCode || '',
      p.ProductName || '',
      ...priceCodes.map(pc => rows[p.id]?.[pc.id] ?? ''),
    ]);
    const csv = [headers, ...data].map(r => r.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `price_codes_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadImportTemplate = async () => {
    try {
      const blob = await productService.downloadImportTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Product_Price_Import_Template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download Failed', 'Could not download import template.');
    }
  };

  const downloadErrorExcel = (data) => {
    if (!data?.error_file_base64) return;
    const bytes = Uint8Array.from(atob(data.error_file_base64), ch => ch.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.error_file_name || 'Product_Import_Errors.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatImportSummary = (summary = {}) => {
    const imported = summary.imported_rows ?? summary.products_created ?? 0;
    const duplicates = summary.duplicate_rows ?? summary.products_skipped_as_duplicates ?? summary.rows_skipped ?? 0;
    const rejected = summary.invalid_rows_rejected ?? summary.rejected_rows ?? summary.rows_failed ?? 0;
    const notImported = summary.not_imported ?? (duplicates + rejected);
    return `Successfully Imported: ${imported}\nNot Imported: ${notImported}\nDuplicates Skipped: ${duplicates}\nRejected Rows: ${rejected}`;
  };

  const formatImportDetails = (data = {}) => {
    const rows = [
      ...(data.skipped_rows || []),
      ...(data.rejected_rows || data.errors || []),
    ];
    return rows.slice(0, 6).map(e => {
      const context = [e.group, e.product].filter(Boolean).join(' / ');
      return `Row ${e.row}${context ? ` - ${context}` : ''} - ${e.reason || e.error}`;
    }).join(' | ');
  };

  const formatImportRejection = (data = {}) => {
    const summary = data.summary || {};
    const rows = data.rejected_rows || data.errors || [];
    const counts = formatImportSummary(summary);
    const reasons = rows.slice(0, 5).map(e => {
      const context = [e.group, e.product].filter(Boolean).join(' / ');
      return `Row ${e.row}${context ? ` - ${context}` : ''} - ${e.reason || e.error}`;
    }).join(' | ');
    return `${counts}${reasons ? ` ${reasons}` : ' The file could not be processed.'}`;
  };

  const showImportToast = (result = {}) => {
    toast.push(getImportToast(result));
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || importing) return;
    const controller = new AbortController();
    importAbortRef.current = controller;
    setImporting(true);
    try {
      const result = await productService.importProducts(file, { importedPage: 'price-code-list', signal: controller.signal });
      sessionStorage.setItem(PRICE_CODE_PAGE_STORAGE_KEY, '1');
      if (page === 1) {
        await loadData({ force: true });
      } else {
        setPage(1);
      }
      showImportToast(result);
    } catch (err) {
      if (isCanceledImport(err)) {
        const msg = 'Price Code import request was canceled before the server responded.';
        toast.push({ type: 'warning', title: 'Import Canceled', message: msg, duration: 10000 });
        return;
      }
      if (isTimeoutImport(err)) {
        const msg = 'Request timed out. The upload is taking longer than expected.';
        toast.push({ type: 'error', title: 'Request timed out', message: msg, duration: 10000 });
        return;
      }
      const data = err.response?.data || {};
      if (data?.errors || data?.rejected_rows || data?.summary) {
        downloadErrorExcel(data);
        showImportToast(data);
      } else {
        toast.push({ type: 'error', title: 'Excel Import Rejected', message: formatBackendImportError(err), duration: 10000 });
      }
    } finally {
      if (importAbortRef.current?.signal) importAbortRef.current = null;
      setImporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = products;
  const showingStart = pageRows.length ? ((loadedPage - 1) * pageSize) + 1 : 0;
  const showingEnd = pageRows.length ? Math.min(((loadedPage - 1) * pageSize) + pageRows.length, total) : 0;
  useEffect(() => {
    if (total > 0 && page > totalPages) setPage(totalPages);
  }, [page, total, totalPages]);
  const isInteractiveTarget = (target) => Boolean(target?.closest?.(
    'input, select, textarea, button, a, [role="button"], .pagination'
  ));
  const openProductPage = useCallback((product) => {
    if (!product?.id || navigationLockRef.current) return;
    navigationLockRef.current = true;
    navigate(`/products/${product.id}`);
    setTimeout(() => {
      navigationLockRef.current = false;
    }, 600);
  }, [navigate]);
  const moveActiveRow = (delta) => {
    if (!pageRows.length) return;
    const currentIndex = pageRows.findIndex(p => p.id === activeRowId);
    const fallbackIndex = delta > 0 ? -1 : pageRows.length;
    const nextIndex = Math.min(pageRows.length - 1, Math.max(0, (currentIndex >= 0 ? currentIndex : fallbackIndex) + delta));
    setActiveRowId(pageRows[nextIndex].id);
  };
  const selectRow = (event, productId) => {
    if (isInteractiveTarget(event.target)) return;
    event.currentTarget.closest('.list-keyboard-zone')?.focus();
    setActiveRowId(productId);
  };
  const openRow = (event, product) => {
    if (isInteractiveTarget(event.target)) return;
    event.preventDefault();
    event.currentTarget.closest('.list-keyboard-zone')?.focus();
    setActiveRowId(product.id);
    openProductPage(product);
  };
  const handleListKeyDown = (event) => {
    if (isInteractiveTarget(event.target)) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActiveRow(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActiveRow(-1);
    } else if (event.key === 'Enter') {
      const active = pageRows.find(p => p.id === activeRowId);
      if (!active) return;
      event.preventDefault();
      openProductPage(active);
    }
  };
  const buildPages = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (loadedPage <= 4) return [1, 2, 3, 4, 5, '...', totalPages];
    if (loadedPage >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '...', loadedPage - 1, loadedPage, loadedPage + 1, '...', totalPages];
  };

  if (!isAdmin) return null;

  const thS = { padding:'.28rem .32rem', fontSize:'.66rem', fontWeight:800, textTransform:'uppercase',
    letterSpacing:'.05em', color:'#fff', background:BRAND, whiteSpace:'nowrap', textAlign:'center' };

  return (
    <Layout>
      <div className="price-code-list-page">
      <div className="page-header price-code-list-header animate-in" style={{marginBottom:'1rem'}}>
        <div>
          <h2 className="price-code-list-title" style={{fontFamily:'var(--font-heading)',fontWeight:800}}>Price Code List</h2>
          <p className="page-header-sub">Admin · Set five rates per product</p>
        </div>
        <div className="d-flex gap-2 align-center list-header-actions price-code-toolbar price-code-list-toolbar">
          <SharedSearchField
            className="list-header-search price-code-search"
            placeholder="Search product name or code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="form-select form-select-sm price-code-group-filter"
            value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
            <option value="">All Groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.GroupName}</option>)}
          </select>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => { if (!importing) fileInputRef.current?.click(); }} disabled={importing}>
            {importing ? <ImportSpin/> : <UploadIcon/>}{importing ? 'Importing...' : 'Import'}
          </button>
          <button className="btn btn-outline-secondary btn-sm" onClick={downloadImportTemplate}>Download Template</button>
          <button className="btn btn-outline-secondary btn-sm" onClick={handleExportCsv}>Export</button>
          <input ref={fileInputRef} type="file" accept=".xlsx" style={{display:'none'}} onChange={handleImportFile}/>
        </div>
      </div>

      {error && (
        <div className="alert alert-warning" style={{marginBottom:'1rem',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'.75rem'}}>
          <span>{error}</span>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => loadData({ force: true })}>Retry</button>
        </div>
      )}

      <div className="card animate-in animate-in-1 price-code-list-card">
        <div className="card-body">
          <div ref={containerRef} className="price-code-table-section price-code-table-area list-keyboard-zone" tabIndex={0} onKeyDown={handleListKeyDown}>
          <p className="price-scroll-hint">Swipe left or right to view Price A, B, C, D and Retail.</p>
          <div className="price-code-table-scroll">
          <SplitTable
            className="table table-compact price-code-table"
            tableProps={{ style: { borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%' } }}
            empty={products.length===0}
            disableSplit
            bare
            head={(
                <tr style={{borderBottom:`2px solid ${BRAND}`}}>
                  <th className="pc-col-sno" style={{...thS,textAlign:'center'}}>S.No</th>
                  <th className="pc-col-product" style={{...thS,textAlign:'left'}}>Product</th>
                  {priceCodes.map(pc => (
                    <th key={pc.id} className="pc-col-price" style={thS}>{pc.DisplayLabel}</th>
                  ))}
                </tr>
            )}
          >
                {lastLoadFailed && products.length === 0 ? (
                  <tr>
                    <td colSpan={priceCodes.length + 2} style={{padding:'3rem',textAlign:'center',color:'var(--danger)',fontWeight:700}}>
                      Unable to retrieve data. Retry.
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={priceCodes.length + 2} style={{padding:'3rem',textAlign:'center',color:'var(--text-muted)'}}>
                      {search ? `No products matching "${search}"` : 'No active products.'}
                    </td>
                  </tr>
                ) : pageRows.map((p, idx) => {
                  const isDirtyRow = !!dirty[p.id];
                  const rowBg = isDirtyRow
                    ? '#fffde7'
                    : idx % 2 === 0
                      ? '#ffffff'           /* pure white */
                      : '#faf4ee';          /* warm mocha tint */
                  return (
                    <tr key={p.id} ref={idx === 0 ? rowRef : undefined}
                      className={activeRowId === p.id ? 'row-keyboard-selected' : ''}
                      style={{
                        background: rowBg,
                        borderLeft: isDirtyRow ? `3px solid ${BRAND}` : '3px solid transparent',
                        borderBottom: '1px solid #ede3d9',
                        transition: 'background .12s',
                      }}
                      onClick={e => selectRow(e, p.id)}
                      onDoubleClick={e => openRow(e, p)}
                      onMouseEnter={e => {
                        e.currentTarget.closest('.list-keyboard-zone')?.focus();
                        setActiveRowId(p.id);
                        if (!isDirtyRow && activeRowId !== p.id) e.currentTarget.style.background = '#f5ece0';
                      }}
                      onMouseLeave={e => { if (!isDirtyRow && activeRowId !== p.id) e.currentTarget.style.background = rowBg; }}>
                      <td className="pc-cell-sno" style={{fontVariantNumeric:'tabular-nums'}}>{(loadedPage - 1) * pageSize + idx + 1}</td>
                      <td className="pc-cell-product">
                        <div className="pc-product-name">{p.ProductName}</div>
                      </td>
                      {priceCodes.map(pc => (
                        <td key={pc.id} className="pc-cell-price">
                          <div className="pc-price-wrap">
                            <span style={{position:'absolute',left:8,fontSize:'.76rem',color:'#a07850',pointerEvents:'none',fontWeight:600}}>₹</span>
                            <input
                              className="pc-price-input"
                              type="number" min="0" step="0.01"
                              value={rows[p.id]?.[pc.id] ?? ''}
                              onChange={e => handleChange(p.id, pc.id, e.target.value)}
                              style={{
                                width:'100%', height:30, paddingLeft:20, paddingRight:6,
                                fontSize:'.82rem', fontWeight:700,
                                border: `1.5px solid ${isDirtyRow ? '#d4a96a' : '#e8d9c8'}`,
                                borderRadius:5, outline:'none',
                                background: isDirtyRow ? '#fff9e6' : '#ffffff',
                                color: BRAND, textAlign:'right',
                                transition:'border-color .15s',
                              }}
                              onFocus={e => { e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.boxShadow = `0 0 0 2.5px rgba(138,81,37,.12)`; }}
                              onBlur={e => { e.currentTarget.style.borderColor = isDirtyRow ? '#d4a96a' : '#e8d9c8'; e.currentTarget.style.boxShadow = 'none'; }}
                            />
                          </div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </SplitTable>
          </div>
          </div>
          <div ref={bottomRef} className="table-pagination-footer">
            <div className="product-record-info">
              {pageRows.length
                ? `Showing ${showingStart}-${showingEnd} of ${total} records`
                : `Showing 0 of ${total} records`}
            </div>
            <div className="pagination" style={{ marginTop: 0 }}>
              <button className="pg-item" disabled={loadedPage === 1} onClick={() => setPage(Math.max(1, loadedPage - 1))}>Previous</button>
              {total > 0 && buildPages().map((n, i) =>
                n === '...'
                  ? <span key={`e${i}`} className="pg-item" style={{ border: 'none', cursor: 'default', color: 'var(--text-muted)' }}>...</span>
                  : <button key={n} className={`pg-item${loadedPage === n ? ' active' : ''}`} onClick={() => setPage(n)}>{n}</button>
              )}
              <button className="pg-item" disabled={loadedPage === totalPages || total === 0} onClick={() => setPage(Math.min(totalPages, loadedPage + 1))}>Next</button>
            </div>
          </div>
        </div>
      </div>
      <div className="form-actions-bar animate-in">
        <button onClick={saveAll} disabled={savingAll} className="btn btn-primary">
          {savingAll?<><Spin/> Saving...</>:'Save All'}
        </button>
      </div>
      </div>
    </Layout>
  );
};

export default ProductPriceList;
