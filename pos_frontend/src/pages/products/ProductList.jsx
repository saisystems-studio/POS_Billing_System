import { Fragment, useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import ConfirmModal from '../../components/ConfirmModal';
import RowActionPopup from '../../components/RowActionPopup';
import productService from '../../services/productService';
import productGroupService from '../../services/productGroupService';
import { clearPageCache, fetchCachedPage, getCachedPage, makePageKey, prefetchCachedPage } from '../../services/pageCache';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Upload, Download, FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import {
  formatBackendImportError as formatImportErrorMessage,
  getImportToast,
  isCanceledImport,
  isTimeoutImport,
} from '../../utils/excelImportFeedback';
import useResponsivePageSize from '../../hooks/useResponsivePageSize';
import AutoFitColumns from '../../components/AutoFitColumns';

const TrashIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
const ViewIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const SearchIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const PlusIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const CloseIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const ImportSpin = () => (
  <svg className="import-loading-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3h12M6 21h12M8 3c0 4 2.5 5.5 4 7 1.5-1.5 4-3 4-7M8 21c0-4 2.5-5.5 4-7 1.5 1.5 4 3 4 7"/>
  </svg>
);

const BLANK = '\u2014';
const PRICE_CODE_PAGE_STORAGE_KEY = 'price-code-list-page';
const PRICE_CODE_CACHE_STORAGE_KEY = 'price-code-list-cache-v1';
const retailPrice = (p) => {
  if (p.RetailPrice != null && p.RetailPrice !== '') return Number(p.RetailPrice);
  const tier = (p.prices || []).find(x => x.PriceName === 'Retail' || x.PriceCodeName === 'Retail');
  return tier ? Number(tier.ProductPrice) : null;
};
const formatDate = (str) => str ? new Date(str).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '--';

const priceByName = (product, name) => {
  const price = (product?.prices || []).find(p =>
    p.PriceName === name || p.PriceCodeName === name || p.PriceCodeID?.PriceCodeName === name
  );
  return price?.ProductPrice != null ? Number(price.ProductPrice).toFixed(2) : '--';
};

const productGroup = p => p.group_name ?? p.group?.group_name ?? p.product_group?.group_name ?? p.GroupName ?? p.ProductGroupName ?? p.group?.name ?? '';
const productName = p => p.product_name ?? p.ProductName ?? '';
const productQty = p => p.quantity ?? p.qty ?? p.Quantity;
const productUnit = p => {
  if (p.unit_name) return p.unit_name;
  if (p.unit?.unit_name) return p.unit.unit_name;
  if (p.unit?.name) return p.unit.name;
  if (typeof p.unit === 'string' && p.unit) return p.unit;
  return p.UnitCode || p.UnitName || p.Units || '';
};
const productGst = p => p.gst_percent ?? p.GSTPercent ?? p.gst ?? 0;
const productIsActive = p => {
  if (p.is_active !== undefined) return Boolean(p.is_active);
  if (p.IsActive !== undefined) return p.IsActive !== false;
  if (p.status !== undefined) return String(p.status).toLowerCase() !== 'inactive';
  return true;
};

const DetailRow = ({ label, value }) => (
  <div className="product-drawer-row">
    <span>{label}</span>
    <strong>{value ?? '--'}</strong>
  </div>
);

const ProductDetailsDrawer = ({ product, onClose }) => {
  if (!product) return null;
  return (
    <aside className="product-details-drawer" aria-label="Product details">
      <div className="product-drawer-titlebar">
        <span>View More</span>
        <button className="product-drawer-x" onClick={onClose} aria-label="Close details"><CloseIcon/></button>
      </div>
      <div className="product-drawer-header">
        <div className="product-drawer-summary">
          <div className="product-drawer-image">
            {product.Image || product.ProductImage
              ? <img src={product.Image || product.ProductImage} alt={product.ProductName || 'Product'} />
              : <span>{(product.ProductName || 'P').charAt(0).toUpperCase()}</span>}
          </div>
          <div>
            <h3>{product.ProductName || '--'}</h3>
            <p>Group: {product.GroupName || '--'}</p>
            <p>Qty in Hand: {product.Quantity ?? '--'}</p>
          </div>
        </div>
      </div>
      <div className="product-drawer-body">
        <div className="product-drawer-section-title">Product Details</div>
        <DetailRow label="Product Name" value={product.ProductName || '--'} />
        <DetailRow label="Product Group" value={product.GroupName || '--'} />
        <DetailRow label="Quantity in Hand" value={product.Quantity ?? '--'} />
        <DetailRow label="Unit" value={product.UnitCode && product.UnitName ? `${product.UnitCode} - ${product.UnitName}` : (product.UnitCode || product.UnitName || product.Units || '--')} />
        <DetailRow label="GST %" value={product.GSTPercent ?? '--'} />
        <DetailRow label="Status" value={product.IsActive !== false ? 'Active' : 'Inactive'} />
        <DetailRow label="HSN Code" value={product.HSNCode || '--'} />
        <DetailRow label="Price A" value={priceByName(product, 'A')} />
        <DetailRow label="Price B" value={priceByName(product, 'B')} />
        <DetailRow label="Price C" value={priceByName(product, 'C')} />
        <DetailRow label="Price D" value={priceByName(product, 'D')} />
        <DetailRow label="Retail Price" value={priceByName(product, 'Retail')} />
        <DetailRow label="Minimum Stock" value={product.MinimumStock ?? product.MinStock ?? '--'} />
        <DetailRow label="Reorder Level" value={product.ReorderLevel ?? '--'} />
        <DetailRow label="Barcode" value={product.Barcode || '--'} />
        <DetailRow label="Brand" value={product.Brand || '--'} />
        <DetailRow label="Shelf Life" value={product.ShelfLife || '--'} />
        <DetailRow label="Created On" value={formatDate(product.CreatedOn)} />
        <DetailRow label="Last Updated" value={formatDate(product.UpdatedOn || product.ModifiedOn || product.LastUpdated)} />
        {product.Description && <DetailRow label="Description" value={product.Description} />}
      </div>
      <div className="product-drawer-footer">
        <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>Close</button>
      </div>
    </aside>
  );
};
const ProductList = () => {
  const autoFitTableRef = useRef(null);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [loading,     setLoading]    = useState(true);
  const [products,    setProducts]   = useState([]);
  const [search,      setSearch]     = useState('');
  const [debSearch,   setDebSearch]  = useState('');
  const [groupFilter, setGroupFilter]= useState('');
  const [statusFilter,setStatusFilter]= useState('');
  const [groups,      setGroups]     = useState([]);
  const [page,        setPage]       = useState(1);
  const [loadedPage,  setLoadedPage] = useState(1);
  const [total,       setTotal]      = useState(0);
  const [error,       setError]      = useState('');
  const [showDel,     setShowDel]    = useState(false);
  const [delTarget,   setDelTarget]  = useState(null);
  const [deleting,    setDeleting]   = useState(false);
  const [selected,    setSelected]   = useState(new Set());
  const [viewMore,    setViewMore]   = useState(null);
  const [expandedId,  setExpandedId] = useState(null);
  const toggleExpanded = (id) => setExpandedId(prev => prev === id ? null : id);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [hoveredProductId, setHoveredProductId] = useState(null);
  const [dismissedActionProductId, setDismissedActionProductId] = useState(null);
  const [showDataMenu, setShowDataMenu] = useState(false);
  const [importing, setImporting] = useState(false);
  const exportBtnRef  = useRef(null);
  const dropMenuRef   = useRef(null);
  const fileInputRef  = useRef(null);
  const searchInputRef = useRef(null);
  const fetchSeqRef = useRef(0);
  const importAbortRef = useRef(null);
  const navigationLockRef = useRef(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const { pageSize, containerRef, rowRef, bottomRef } = useResponsivePageSize({
    defaultRowHeight: 29,
    mobileRowHeight: 246,
  });

  // Position portal dropdown under the Export button
  useLayoutEffect(() => {
    if (showDataMenu && exportBtnRef.current) {
      const r = exportBtnRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
  }, [showDataMenu]);

  const multiSelectActive = selected.size > 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageStartIndex = (loadedPage - 1) * pageSize;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    const t = setTimeout(() => { setDebSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    // Skip on mobile: focusing the input pops the on-screen keyboard
    // immediately on page load and can trigger an unwanted horizontal
    // scroll of the page (the focused-element-into-view behavior finds
    // the off-canvas sidebar's true layout box even though it's
    // transformed out of sight, and shifts everything left to reach it).
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
        setSelectedProductId(null);
        setHoveredProductId(null);
        setDismissedActionProductId(null);
        setViewMore(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!showDataMenu) return;
    const outside = (e) => {
      if (
        dropMenuRef.current  && !dropMenuRef.current.contains(e.target) &&
        exportBtnRef.current && !exportBtnRef.current.contains(e.target)
      ) setShowDataMenu(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [showDataMenu]);

  useEffect(() => {
    productGroupService.getGroupsDropdown()
      .then(data => setGroups(Array.isArray(data)?data:[]))
      .catch(() => {});
  }, []);

  useEffect(() => { setPage(1); }, [groupFilter, statusFilter]);
  useEffect(() => {
    setPage(1);
    setProducts([]);
    setSelectedProductId(null);
  }, [pageSize]);

  const fetchProducts = useCallback(async (options = {}) => {
    const seq = ++fetchSeqRef.current;
    const requestedPage = options.page ?? page;
    const params = { page: requestedPage, page_size: pageSize, ordering: 'id' };
    if (debSearch)   params.search   = debSearch;
    if (groupFilter) params.group = groupFilter;
    if (statusFilter) params.status = statusFilter;
    const cacheKey = makePageKey('products', params);
    const cached = options.force ? null : getCachedPage('products', cacheKey);
    if (cached) {
      const cachedRows = cached.results !== undefined ? cached.results : (Array.isArray(cached) ? cached : []);
      setProducts(cachedRows);
      setTotal(cached.count ?? cachedRows.length);
      setLoadedPage(requestedPage);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const { data } = await fetchCachedPage('products', cacheKey, () => productService.getProducts(params), { force: options.force || Boolean(cached) });
      if (seq !== fetchSeqRef.current) return;
      const rows = data.results !== undefined ? data.results : (Array.isArray(data) ? data : []);
      setProducts(rows);
      setTotal(data.count ?? rows.length);
      setLoadedPage(requestedPage);
      const totalCount = data.count ?? rows.length;
      const maxPage = Math.max(1, Math.ceil(totalCount / pageSize));
      [requestedPage - 1, requestedPage + 1].filter(n => n >= 1 && n <= maxPage).forEach(n => {
        const nextParams = { ...params, page: n };
        prefetchCachedPage('products', makePageKey('products', nextParams), () => productService.getProducts(nextParams));
      });
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      setError(err.response?.data?.detail || 'Unable to retrieve data. Please retry.');
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [page, pageSize, debSearch, groupFilter, statusFilter]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    if (!products.length) {
      setSelectedProductId(null);
      setViewMore(null);
      return;
    }
    if (!selectedProductId || !products.some(p => p.id === selectedProductId)) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  const openProductDetails = async (product) => {
    if (!product) return;
    setSelectedProductId(product.id);
    try {
      const full = await productService.getProduct(product.id);
      setViewMore(full);
    } catch {
      setViewMore(product);
    }
  };

  const isInteractiveTarget = (target) => Boolean(target?.closest?.(
    'input, select, textarea, button, a, [role="button"], .pagination, .row-action-popup'
  ));

  const openProductEditPage = useCallback((product) => {
    if (!product?.id || navigationLockRef.current) return;
    navigationLockRef.current = true;
    navigate(`/products/${product.id}`);
    setTimeout(() => {
      navigationLockRef.current = false;
    }, 600);
  }, [navigate]);

  const selectProduct = (id) => {
    setSelectedProductId(id);
    setSelected(id ? new Set([id]) : new Set());
    setDismissedActionProductId(null);
  };

  const moveRowSelection = (delta) => {
    if (!products.length) return;
    const currentIndex = products.findIndex(p => p.id === selectedProductId);
    const fallbackIndex = delta > 0 ? -1 : products.length;
    const nextIndex = Math.min(products.length - 1, Math.max(0, (currentIndex >= 0 ? currentIndex : fallbackIndex) + delta));
    const next = products[nextIndex];
    selectProduct(next.id);
  };

  const handleTableFocus = (event) => {
    if (event.target !== event.currentTarget) return;
    if (!products.length || selectedProductId) return;
    selectProduct(products[0].id);
  };

  const handleRowClick = (event, productId) => {
    if (isInteractiveTarget(event.target)) return;
    event.currentTarget.closest('.product-table-zone')?.focus();
    selectProduct(productId);
  };

  const handleRowDoubleClick = (event, product) => {
    if (isInteractiveTarget(event.target)) return;
    event.preventDefault();
    event.currentTarget.closest('.product-table-zone')?.focus();
    selectProduct(product.id);
    openProductEditPage(product);
  };

  const handleListKeyDown = (e) => {
    if (isInteractiveTarget(e.target)) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveRowSelection(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveRowSelection(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const active = products.find(p => p.id === selectedProductId) || products[0];
      if (!active) return;
      openProductEditPage(active);
    } else if (e.key === 'Escape') {
      setDismissedActionProductId(hoveredProductId ?? selectedProductId);
      setHoveredProductId(null);
      setViewMore(null);
    }
  };

  const handleDelete = async () => {
    const ids = selected.size > 0 ? [...selected] : [delTarget];
    setDeleting(true);
    try {
      await Promise.all(ids.map(id => productService.deleteProduct(id)));
      setShowDel(false); setDelTarget(null); setSelected(new Set()); setSelectedProductId(null); fetchProducts();
    } catch (err) {
      setError(err.response?.data?.detail||err.response?.data?.message||'Failed to delete.');
      setShowDel(false);
    } finally { setDeleting(false); }
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setSelectedProductId(next.has(id) ? id : (next.size === 1 ? [...next][0] : null));
    setDismissedActionProductId(null);
  };

  const allVisibleSelected = products.length > 0 && products.every(p => selected.has(p.id));
  const anyVisibleSelected = products.some(p => selected.has(p.id));
  const toggleSelectAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        products.forEach(p => next.delete(p.id));
      } else {
        products.forEach(p => next.add(p.id));
      }
      return next;
    });
    setSelectedProductId(allVisibleSelected ? null : (products[0]?.id ?? null));
    setDismissedActionProductId(null);
  };

  // Resolve which product records to export:
  // - If rows are checked, export only those
  // - Otherwise, fetch all records from server without the visible page limit
  const resolveExportData = async () => {
    if (selected.size > 0) {
      return products.filter(p => selected.has(p.id));
    }
    try {
      const params = { all: 'true', ordering: 'id' };
      if (debSearch) params.search = debSearch;
      if (groupFilter) params.group = groupFilter;
      if (statusFilter) params.status = statusFilter;
      const data = await productService.getProducts(params);
      return data.results ?? (Array.isArray(data) ? data : products);
    } catch {
      return products;
    }
  };

  const handleExportCsv = async () => {
    setShowDataMenu(false);
    const data = await resolveExportData();
    if (!data.length) { setError('No products to export.'); return; }

    const headers = ['S.No','Group','Product Code','Product Name (Eng)','Product Name (Tamil)','Qty','Unit','GST %','Description','Status'];
    const rows = data.map((p, idx) => [
      idx + 1,
      p.GroupName || '',
      p.ProductCode || '',
      p.ProductName || '',
      p.ProductNameTamil || '',
      p.Quantity != null ? p.Quantity : '',
      p.Units || '',
      p.GSTPercent != null ? p.GSTPercent : '',
      p.Description || '',
      p.IsActive !== false ? 'Active' : 'Inactive',
    ]);

    const BOM = '\uFEFF';
    const csv = BOM + [headers, ...rows]
      .map(r => r.map(String).map(v => `"${v.replace(/"/g,'""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    setShowDataMenu(false);
    const data = await resolveExportData();
    if (!data.length) { setError('No products to export.'); return; }

    const isSelected = selected.size > 0;
    const subtitle = isSelected
      ? `${data.length} selected record${data.length !== 1 ? 's' : ''}`
      : (debSearch || groupFilter)
        ? `Filtered — ${data.length} record${data.length !== 1 ? 's' : ''}`
        : `All Records — ${data.length} total`;
    const dateStr = new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

    const rowsHtml = data.map((p, idx) => {
      const status = p.IsActive !== false ? 'Active' : 'Inactive';
      return `<tr>
        <td class="num">${idx+1}</td>
        <td>${p.GroupName ? `<span class="badge">${p.GroupName}</span>` : '<span class="na">—</span>'}</td>
        <td class="bold">${p.ProductName||''}</td>
        <td class="tamil">${p.ProductNameTamil||'—'}</td>
        <td class="num">${p.Quantity??'—'}</td>
        <td class="c">${p.Units||''}</td>
        <td class="desc">${p.Description||'—'}</td>
        <td class="tag ${status==='Active'?'active':'inactive'}">${status}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Product Report</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #1e1410; background: #fff; }
  .rpt-header { display: flex; justify-content: space-between; align-items: flex-end;
    border-bottom: 2.5px solid #8A5125; padding-bottom: 7px; margin-bottom: 10px; }
  .rpt-header-left h1 { font-size: 18px; font-weight: 800; color: #8A5125; letter-spacing: -.4px; line-height: 1.1; }
  .rpt-header-left p  { font-size: 9px; color: #7a6758; margin-top: 3px; }
  .rpt-header-right   { text-align: right; font-size: 9px; color: #7a6758; line-height: 1.7; }
  .rpt-header-right strong { color: #4a3426; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  col.c-sno   { width: 28px; }
  col.c-group { width: 80px; }
  col.c-name  { width: 170px; }
  col.c-tamil { width: 130px; }
  col.c-qty   { width: 38px; }
  col.c-unit  { width: 42px; }
  col.c-desc  { width: auto; }
  col.c-stat  { width: 46px; }
  thead tr { background: #8A5125; color: #fff; }
  thead th { padding: 5.5px 5px; font-size: 8.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .04em; white-space: nowrap; text-align: left; overflow: hidden; }
  thead th.c { text-align: center; }
  tbody tr { border-bottom: 1px solid #efe5da; }
  tbody tr:nth-child(even) { background: #faf6f2; }
  td { padding: 5px 5px; vertical-align: middle; font-size: 9.5px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  td.num  { text-align: center; color: #7a6758; }
  td.c    { text-align: center; }
  td.bold { font-weight: 700; white-space: normal; }
  td.tamil { font-family: 'Latha','Noto Sans Tamil',Arial,sans-serif; white-space: normal; }
  td.desc  { font-size: 9px; color: #5a4a40; white-space: normal; word-break: break-word; }
  td.na    { color: #bbb; }
  .badge { background: #f3ece3; color: #7a5232; font-size: 8.5px; font-weight: 700;
    padding: 1px 5px; border-radius: 3px; white-space: nowrap; }
  .tag { font-weight: 700; text-align: center; font-size: 8.5px; }
  .tag.active   { color: #1b5e20; }
  .tag.inactive { color: #c62828; }
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
      <h1>Product Catalog</h1>
      <p>${subtitle}</p>
    </div>
    <div class="rpt-header-right">
      <div><strong>Exported:</strong> ${dateStr}</div>
      <div><strong>Total Records:</strong> ${data.length}</div>
    </div>
  </div>
  <table>
    <colgroup>
      <col class="c-sno"/><col class="c-group"/><col class="c-name"/>
      <col class="c-tamil"/><col class="c-qty"/><col class="c-unit"/>
      <col class="c-desc"/><col class="c-stat"/>
    </colgroup>
    <thead>
      <tr>
        <th class="c">S.No</th>
        <th>Group</th>
        <th>Product Name (Eng)</th>
        <th>Product Name (Tamil)</th>
        <th class="c">Qty</th>
        <th class="c">Unit</th>
        <th>Description</th>
        <th class="c">Status</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="rpt-footer">
    <span>POS Billing System — Product Report</span>
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

  const handleDownloadTemplate = async () => {
    try {
      const blob = await productService.downloadImportTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Product_Import_Template.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download product import template.');
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
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const showImportToast = (result = {}) => {
    const toastData = getImportToast(result);
    toast.push(toastData);
  };

  const handleImportFile = async (event) => {
    setShowDataMenu(false);
    const file = event.target.files?.[0];
    if (!file || importing) {
      event.target.value = '';
      return;
    }
    setError('');
    const submit = async () => {
      const controller = new AbortController();
      importAbortRef.current = controller;
      const result = await productService.importProducts(file, { importedPage: 'product-list', signal: controller.signal });
      showImportToast(result);
      clearPageCache('products');
      clearPageCache('price-code-list');
      sessionStorage.removeItem(PRICE_CODE_CACHE_STORAGE_KEY);
      sessionStorage.setItem(PRICE_CODE_PAGE_STORAGE_KEY, '1');
      if (page === 1) {
        try {
          await fetchProducts({ page: 1, force: true });
        } catch {
          // The import already succeeded; keep the backend response visible.
        }
      } else {
        setPage(1);
      }
    };
    setImporting(true);
    try {
      await submit();
    } catch (err) {
      if (isCanceledImport(err)) {
        const msg = 'Product import request was canceled before the server responded.';
        toast.push({ type: 'warning', title: 'Import Canceled', message: msg, duration: 10000 });
        return;
      }
      if (isTimeoutImport(err)) {
        const msg = 'Request timed out. The upload is taking longer than expected.';
        toast.push({ type: 'error', title: 'Request timed out', message: msg, duration: 10000 });
        return;
      }
      const data = err.response?.data;
      if (data?.errors || data?.rejected_rows || data?.summary) {
        downloadErrorExcel(data);
        showImportToast(data);
      } else {
        const msg = formatImportErrorMessage(err);
        toast.push({ type: 'error', title: 'Excel Import Rejected', message: msg, duration: 10000 });
      }
    } finally {
      if (importAbortRef.current?.signal) importAbortRef.current = null;
      setImporting(false);
      event.target.value = '';
    }
  };

  const buildPages = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (loadedPage <= 4) return [1, 2, 3, 4, 5, '...', totalPages];
    if (loadedPage >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '...', loadedPage - 1, loadedPage, loadedPage + 1, '...', totalPages];
  };

  return (
    <Layout>
      <div className="page-header product-list-header animate-in">
        <div>
          <h2 style={{fontFamily:'var(--font-heading)',fontWeight:800}}>Product List</h2>
          <p className="page-header-sub">
            {total>0?`${total} product${total!==1?'s':''} in catalog`:'Manage and organise your product catalog'}
          </p>
        </div>
        <div className="d-flex gap-2 align-center list-header-actions">
          <div className="input-group list-header-search">
            <span className="input-group-text"><SearchIcon/></span>
            <input ref={searchInputRef} type="text" className="form-control"
              placeholder="Search products..."
              value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <select className="form-select form-select-sm" style={{width:'auto',minWidth:130}}
            value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
            <option value="">All Groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.GroupName}</option>)}
          </select>
          <select className="form-select form-select-sm" style={{width:'auto',minWidth:112}}
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          {multiSelectActive && isAdmin && (
            <button className="btn btn-danger btn-sm" onClick={() => setShowDel(true)}>
              <TrashIcon/> Delete ({selected.size})
            </button>
          )}
          <button className="btn btn-outline-secondary btn-sm" onClick={() => { if (!importing) fileInputRef.current?.click(); }} disabled={importing}>
            {importing ? <ImportSpin/> : <Upload size={14}/>} {importing ? 'Importing...' : 'Import'}
          </button>
          <button className="btn btn-outline-secondary btn-sm" onClick={handleDownloadTemplate}>
            <Download size={14}/> Download Template
          </button>
          <div style={{position:'relative'}}>
            <button ref={exportBtnRef} className="btn btn-outline-secondary btn-sm"
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setShowDataMenu(v => !v)}>
              <FileDown size={14}/> Export
            </button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/products/new')}>
            <PlusIcon/> Add Product
          </button>
          <AutoFitColumns tableRef={autoFitTableRef}/>
          <input ref={fileInputRef} type="file" accept=".xlsx" style={{display:'none'}} onChange={handleImportFile}/>
        </div>

        {/* Export dropdown — portal renders at fixed screen position */}
        {showDataMenu && createPortal(
          <div ref={dropMenuRef} style={{
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
              onClick={() => { handleExportCsv(); setShowDataMenu(false); }}>
              <FileSpreadsheet size={16}/> Export Excel
            </button>
            <div style={{height:1,background:'var(--divider)',margin:'0 .75rem'}}/>
            <button style={{display:'flex',alignItems:'center',gap:'.65rem',width:'100%',
              padding:'.75rem 1.1rem',background:'none',border:'none',cursor:'pointer',
              fontSize:'.88rem',fontWeight:700,color:'var(--text-primary)',textAlign:'left',
              transition:'background .12s'}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--scale-50)'}
              onMouseLeave={e=>e.currentTarget.style.background='none'}
              onClick={() => { handleExportPDF(); setShowDataMenu(false); }}>
              <FileText size={16}/> Export PDF
            </button>
          </div>,
          document.body
        )}
      </div>

      {error && (
        <div className="alert alert-warning animate-in" style={{marginBottom:'1rem',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'.75rem'}}>
          <span>{error}</span>
          <button className="btn btn-outline-secondary btn-sm" onClick={fetchProducts}>Retry</button>
        </div>
      )}

      <div className={`product-list-workspace${viewMore ? ' drawer-open' : ''}`}>
        <div className="card animate-in animate-in-1 product-list-card">
          <div className="card-body">
                <div ref={containerRef} className="product-table-zone" tabIndex={0} onKeyDown={handleListKeyDown} onFocus={handleTableFocus}>
                  <div className={`desktop-table-view table-wrapper table-wrapper-scroll${!loading && products.length===0 ? ' is-empty' : ''}`}>
                    <table ref={autoFitTableRef} className="product-list-table">
                      <colgroup>
                        <col className="col-checkbox" />
                        <col className="col-sno" />
                        <col className="col-group hide-below-xl" />
                        <col className="col-product" />
                        <col className="col-qty hide-below-sm" />
                        <col className="col-unit hide-below-md" />
                        <col className="col-gst hide-below-xl" />
                        <col className="col-status" />
                        <col className="col-more responsive-more-col" />
                      </colgroup>

                      <thead>
                        <tr>
                          <th className="row-cb-cell">
                            <input type="checkbox"
                              checked={allVisibleSelected}
                              disabled={!isAdmin}
                              ref={el => { if (el) el.indeterminate = anyVisibleSelected && !allVisibleSelected; }}
                              onChange={isAdmin ? toggleSelectAll : () => {}}
                              title={allVisibleSelected ? 'Unselect all visible products' : 'Select all visible products'}/>
                          </th>
                          <th className="product-col-sno">S.No</th>
                          <th className="product-col-group hide-below-xl">Group</th>
                          <th className="product-col-name">Product Name</th>
                          <th className="product-col-qty hide-below-sm">Qty</th>
                          <th className="product-col-unit hide-below-md">Unit</th>
                          <th className="product-col-gst hide-below-xl">GST</th>
                          <th className="product-col-status">Status</th>
                          <th className="responsive-more-cell">More</th>
                        </tr>
                      </thead>

                      <tbody>
                    {products.length===0 ? (
                      <tr className="product-empty-row">
                        <td colSpan={9} className="product-empty-cell">
                          {debSearch || groupFilter || statusFilter ? 'No matching records found' : 'No records found'}
                        </td>
                      </tr>
                    ) : products.map((p,idx) => {
                      const isActive = selectedProductId === p.id;
                      const group = productGroup(p);
                      const name = productName(p);
                      const qty = productQty(p);
                      const unit = productUnit(p);
                      const gst = productGst(p);
                      const active = productIsActive(p);
                      const isExpanded = expandedId === p.id;
                      return (
                        <Fragment key={p.id}>
                        <tr ref={idx === 0 ? rowRef : undefined}
                          className={`table-row-hover product-list-row${isActive ? ' row-keyboard-selected' : ''}`}
                          title={name || 'Product'}
                          tabIndex={-1}
                          onMouseEnter={(e) => {
                            e.currentTarget.closest('.product-table-zone')?.focus();
                            setHoveredProductId(p.id);
                            setSelectedProductId(p.id);
                            setDismissedActionProductId(null);
                          }}
                          onMouseLeave={() => setHoveredProductId(prev => prev === p.id ? null : prev)}
                          onFocus={() => setHoveredProductId(p.id)}
                          onClick={e => handleRowClick(e, p.id)}
                          onDoubleClick={e => handleRowDoubleClick(e, p)}>
                          <td className="row-cb-cell" onClick={e => { e.stopPropagation(); if (isAdmin) toggleSelect(p.id); }}>
                            <input type="checkbox" className="row-cb"
                              checked={selected.has(p.id)}
                              disabled={!isAdmin}
                              onClick={e => e.stopPropagation()}
                              onChange={isAdmin ? () => toggleSelect(p.id) : () => {}}
                              title="Select product"/>
                          </td>
                          <td className="product-cell-sno">{pageStartIndex+idx+1}</td>
                          <td className="product-cell-group hide-below-xl" title={group || BLANK}>{group || BLANK}</td>
                          <td className="product-cell-name" title={name || BLANK}>{name || BLANK}</td>
                          <td className="product-cell-qty hide-below-sm" title={qty ?? BLANK}>{qty ?? BLANK}</td>
                          <td className="product-cell-unit hide-below-md" title={unit || BLANK}>{unit || BLANK}</td>
                          <td className="product-cell-gst hide-below-xl" title={`${gst ?? 0}%`}>{gst ?? 0}%</td>
                          <td className="product-cell-status row-action-anchor">
                            <span className={`${active ? 'status-active' : 'status-inactive'} list-status-pill ${active ? 'active' : 'inactive'}`}>
                              {active ? 'Active' : 'Inactive'}
                            </span>
                            <RowActionPopup
                              visible={selected.size < 2 && hoveredProductId === p.id && dismissedActionProductId !== p.id}
                              onDismiss={() => { setDismissedActionProductId(hoveredProductId ?? selectedProductId); setHoveredProductId(null); }}
                              actions={[
                                { type:'view', title:'View More', onClick:() => openProductDetails(p) },
                                isAdmin && { type:'delete', title:'Delete', variant:'danger', onClick:() => { selectProduct(p.id); setDelTarget(p.id); setShowDel(true); } },
                              ]}
                            />
                          </td>
                          <td className="responsive-more-cell">
                            <button type="button" className="table-more-button"
                              onClick={e => { e.stopPropagation(); toggleExpanded(p.id); }}
                              aria-expanded={isExpanded}>
                              {isExpanded ? 'Less' : 'More'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="detail-row">
                            <td colSpan={9} className="detail-row-cell">
                              <div className="detail-grid">
                                <div><span>Group</span><strong>{group || BLANK}</strong></div>
                                <div><span>Qty</span><strong>{qty ?? BLANK}</strong></div>
                                <div><span>Unit</span><strong>{unit || BLANK}</strong></div>
                                <div><span>GST</span><strong>{gst ?? 0}%</strong></div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      );
                    })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div ref={bottomRef} className="product-list-footer">
                  <div className="product-record-info">
                    Showing {products.length ? `${pageStartIndex + 1}-${Math.min(pageStartIndex + products.length, total)}` : <>0&ndash;0</>} of {total} records
                  </div>
                  <div className="product-pagination-controls">
                    <div className="pagination" style={{marginTop:0}}>
                      <button className="pg-item" disabled={loadedPage===1 || total===0} onClick={() => setPage(Math.max(1,loadedPage-1))}>Previous</button>
                      {total > 0 && buildPages().map((n,i) =>
                        n==='...'
                          ? <span key={`e${i}`} className="pg-item" style={{border:'none',cursor:'default',color:'var(--text-muted)'}}>...</span>
                          : <button key={n} className={`pg-item${loadedPage===n?' active':''}`} onClick={() => setPage(n)}>{n}</button>
                      )}
                      <button className="pg-item" disabled={loadedPage===totalPages || total===0} onClick={() => setPage(Math.min(totalPages,loadedPage+1))}>Next</button>
                    </div>
                  </div>
                </div>
          </div>
        </div>
        {viewMore && <ProductDetailsDrawer product={viewMore} onClose={() => setViewMore(null)}/>}
      </div>
      <ConfirmModal
        show={showDel}
        title="Delete Product"
        message={selected.size>1
          ?`Delete ${selected.size} selected products? This cannot be undone.`
          :'Delete this product? This action cannot be undone.'}
        onConfirm={handleDelete}
        onCancel={() => { setShowDel(false); setDelTarget(null); }}
        confirmVariant="danger"
        confirmText={deleting?'Deleting...':'Delete'}
        cancelText="Cancel"
      />
    </Layout>
  );
};

export default ProductList;
