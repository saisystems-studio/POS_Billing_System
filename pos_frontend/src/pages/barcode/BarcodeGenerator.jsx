import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../../components/Layout';
import barcodeService from '../../services/barcodeService';
import { useToast } from '../../context/ToastContext';

const Req = () => <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>;

const SaveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
);

const ResetIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const spinEl = (
  <span style={{
    display: 'inline-block', width: 14, height: 14,
    border: '2px solid var(--primary-light)', borderTopColor: 'var(--card-bg)',
    borderRadius: '50%', animation: 'spin .6s linear infinite', flexShrink: 0,
  }} />
);

const decimalPattern = /^\d+(\.\d{0,2})?$/;
const normalizeNumericInput = rawValue => {
  let value = String(rawValue ?? '').replace(/[^\d.]/g, '');
  const parts = value.split('.');
  if (parts.length > 2) value = `${parts[0]}.${parts.slice(1).join('')}`;
  if (value.length > 1 && value.startsWith('0') && !value.startsWith('0.')) value = value.replace(/^0+/, '');
  return value;
};
const PRODUCT_OPTION_HEIGHT = 34;
const PRODUCT_MENU_HEIGHT = 220;

const SearchDropdown = ({
  id,
  label,
  required,
  placeholder,
  value,
  query,
  setQuery,
  options,
  onSelect,
  disabled,
  error,
  inputRef,
  getLabel,
  getMeta,
  onClear,
  emptyText,
  leftIcon,
  onSearch,
  loading,
  loadError,
  onNext,
  selectedId,
  selectedName,
}) => {
  const getProductName = opt => getLabel(opt) || opt?.label || '';
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const [scrollTop, setScrollTop] = useState(0);
  const wrapRef = useRef(null);
  const menuRef = useRef(null);
  const openRef = useRef(false);
  const hiRef = useRef(-1);
  const filteredRef = useRef([]);

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = term
      ? options.filter(opt => getProductName(opt).toLowerCase().includes(term))
      : options;
    return [...filtered].sort((a, b) => {
      const aName = getProductName(a).toLowerCase();
      const bName = getProductName(b).toLowerCase();
      const aExact = aName === term;
      const bExact = bName === term;
      if (aExact !== bExact) return aExact ? -1 : 1;
      const aStarts = aName.startsWith(term);
      const bStarts = bName.startsWith(term);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return aName.localeCompare(bName);
    });
  }, [getLabel, options, query]);
  hiRef.current = hi;
  filteredRef.current = filteredProducts;
  const visibleStart = Math.max(0, Math.floor(scrollTop / PRODUCT_OPTION_HEIGHT) - 3);
  const visibleEnd = Math.min(
    filteredProducts.length,
    visibleStart + Math.ceil(PRODUCT_MENU_HEIGHT / PRODUCT_OPTION_HEIGHT) + 6,
  );
  const visibleOptions = filteredProducts.slice(visibleStart, visibleEnd);

  const setDropdownOpen = next => {
    openRef.current = next;
    setOpen(next);
  };

  const setHighlightedIndex = next => {
    hiRef.current = next;
    setHi(next);
  };

  useEffect(() => {
    if (!open) return;
    const close = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setHi(current => {
      const next = Math.min(current, Math.max(filteredProducts.length - 1, 0));
      hiRef.current = next;
      return next;
    });
  }, [filteredProducts.length, open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      onSearch?.(query);
    }, 250);
    return () => clearTimeout(t);
  }, [open, query, onSearch]);

  useEffect(() => {
    if (!open || hi < 0 || !menuRef.current) return;
    const optionTop = hi * PRODUCT_OPTION_HEIGHT;
    const optionBottom = optionTop + PRODUCT_OPTION_HEIGHT;
    const currentTop = menuRef.current.scrollTop;
    const currentBottom = currentTop + PRODUCT_MENU_HEIGHT;
    const nextTop = optionTop < currentTop
      ? optionTop
      : optionBottom > currentBottom
        ? optionBottom - PRODUCT_MENU_HEIGHT
        : currentTop;
    if (nextTop !== currentTop) {
      menuRef.current.scrollTop = nextTop;
      setScrollTop(nextTop);
    }
  }, [hi, open]);

  useEffect(() => {
    setScrollTop(0);
    if (menuRef.current) menuRef.current.scrollTop = 0;
  }, [open, query]);

  useEffect(() => {
    const el = inputRef?.current;
    if (!el) return undefined;
    const clear = () => {
      if (disabled) return;
      setQuery('');
      onClear?.();
      setDropdownOpen(false);
      setHighlightedIndex(-1);
      setTimeout(() => el.focus(), 0);
    };
    el.addEventListener('pos-escape-clear-field', clear);
    return () => el.removeEventListener('pos-escape-clear-field', clear);
  }, [disabled, inputRef, onClear, setQuery]);

  const handleProductSelect = opt => {
    // Mouse and keyboard selection both use the same committed parent state.
    onSelect(opt);
    setDropdownOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !openRef.current) {
      e.preventDefault();
      e.stopPropagation();
      setDropdownOpen(true);
      setHighlightedIndex(filteredRef.current.length ? 0 : -1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setDropdownOpen(true);
      const lastIndex = filteredRef.current.length - 1;
      if (lastIndex >= 0) {
        setHighlightedIndex(hiRef.current < lastIndex ? hiRef.current + 1 : 0);
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setDropdownOpen(true);
      const lastIndex = filteredRef.current.length - 1;
      if (lastIndex >= 0) {
        setHighlightedIndex(hiRef.current > 0 ? hiRef.current - 1 : lastIndex);
      }
      return;
    }
    if (e.key === 'Enter') {
      const highlightedOption = openRef.current && hiRef.current >= 0
        ? filteredRef.current[hiRef.current]
        : null;
      if (highlightedOption) {
        e.preventDefault();
        e.stopPropagation();
        handleProductSelect(highlightedOption);
        return;
      }
      if (openRef.current) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (selectedId != null && selectedName) {
        e.preventDefault();
        e.stopPropagation();
        onNext?.();
        return;
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setDropdownOpen(false);
      setHighlightedIndex(-1);
      setQuery('');
      onClear?.();
      return;
    }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <label className="pf-label" htmlFor={id}>
        {label} {required && <Req />}
      </label>
      <div className="barcode-dropdown-field">
        {leftIcon && <span className="barcode-field-icon">{leftIcon}</span>}
        <input
          id={id}
          ref={inputRef}
          type="text"
          data-sales-dropdown="true"
          className={`pf-input barcode-input${leftIcon ? ' barcode-input-with-icon' : ''}${error ? ' pf-input--error' : ''}`}
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          autoComplete="off"
          onFocus={() => setHighlightedIndex(-1)}
          onMouseDown={() => { if (!disabled) { setDropdownOpen(true); setHighlightedIndex(-1); } }}
          onBlur={() => setTimeout(() => {
            if (wrapRef.current?.contains(document.activeElement)) return;
            setDropdownOpen(false);
            const selected = options.find(opt => String(opt.id) === String(selectedId));
            if (selected) setQuery(getProductName(selected));
            else if (query.trim()) setQuery('');
          }, 0)}
          onChange={e => {
            const next = e.target.value;
            setQuery(next);
            if (selectedId != null && next !== getProductName(options.find(opt => String(opt.id) === String(selectedId)))) onClear?.();
            setDropdownOpen(true);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />
        <span className="barcode-field-caret" aria-hidden="true">
          {open ? '\u25B2' : '\u25BC'}
        </span>
      </div>
      {open && !disabled && (
        <div
          ref={menuRef}
          data-sales-dropdown-open="true"
          onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
          className="shared-dropdown-menu" style={{
          position: 'absolute', zIndex: 40, top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--card-bg)', border: '1.5px solid var(--primary)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
          maxHeight: PRODUCT_MENU_HEIGHT, overflowY: 'auto',
        }}>
          {loading && filteredProducts.length === 0 ? (
            <div style={{ padding: '.55rem .7rem', fontSize: '.78rem', color: 'var(--text-muted)' }}>
              Loading products...
            </div>
          ) : loadError && filteredProducts.length === 0 ? (
            <div style={{ padding: '.55rem .7rem', fontSize: '.78rem', color: 'var(--danger)', fontWeight: 600 }}>
              {loadError}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div style={{ padding: '.55rem .7rem', fontSize: '.78rem', color: 'var(--text-muted)' }}>
              {emptyText}
            </div>
          ) : (
            <div
              style={{ position: 'relative', height: filteredProducts.length * PRODUCT_OPTION_HEIGHT }}
            >
              {visibleOptions.map((opt, offset) => {
                const idx = visibleStart + offset;
                const optionId = opt.id;
                const selected = selectedId != null && String(optionId) === String(selectedId);
                const focused = hi === idx;
                return (
                  <button
                    className="shared-dropdown-option"
                    key={opt.id}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); handleProductSelect(opt); }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    style={{
                      position: 'absolute', top: idx * PRODUCT_OPTION_HEIGHT, left: 0, right: 0,
                      height: PRODUCT_OPTION_HEIGHT, width: '100%', border: 0, textAlign: 'left',
                      padding: '.48rem .7rem', cursor: 'pointer', boxSizing: 'border-box',
                      background: selected ? 'var(--primary-light)' : focused ? 'var(--scale-100)' : 'transparent',
                      color: selected || focused ? 'var(--primary-dark)' : 'var(--text-primary)',
                      display: 'flex', flexDirection: 'column', gap: 2,
                    }}>
                    <span style={{ fontSize: '.84rem', fontWeight: 700 }}>{getProductName(opt)}</span>
                    {getMeta && <span style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>{getMeta(opt)}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {error && <div className="pf-field-error">{error}</div>}
    </div>
  );
};

const BarcodeGenerator = () => {
  const toast = useToast();
  const productRef = useRef(null);
  const productCodeRef = useRef(null);
  const priceRef = useRef(null);
  const sellingRef = useRef(null);
  const mrpRef = useRef(null);
  const saveRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [productsLoadError, setProductsLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [productQuery, setProductQuery] = useState('');
  const [productJustSelected, setProductJustSelected] = useState(false);
  const [productCode, setProductCode] = useState('');
  const [priceQuery, setPriceQuery] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  useEffect(() => {
    let mounted = true;
    let settled = false;
    const cached = barcodeService.getCachedProductOptions();
    if (cached) {
      setProducts(cached);
      setLoading(false);
    } else {
      const showLoadingTimer = setTimeout(() => {
        if (mounted && !settled) setLoading(true);
      }, 150);
      setLoading(false);
      barcodeService.getProductOptions()
        .then(rows => {
          if (mounted) {
            setProducts(rows);
            setProductsLoadError('');
          }
        })
        .catch(() => {
          if (mounted) setProductsLoadError('Unable to load products. Retry');
        })
        .finally(() => {
          settled = true;
          clearTimeout(showLoadingTimer);
          if (mounted) setLoading(false);
        });
    }

    // Cached options are displayed immediately while this shared request
    // refreshes the cache for the next visit without blocking the form.
    barcodeService.refreshProductOptions()
      .then(rows => { if (mounted) setProducts(rows); })
      .catch(() => { if (mounted && !cached) setProductsLoadError('Unable to load products. Retry'); });

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!loading) setTimeout(() => productRef.current?.focus(), 40);
  }, [loading]);

  const clearError = useCallback((field) => {
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    if (apiError) setApiError('');
  }, [apiError]);

  const resetForm = useCallback(() => {
    setProduct(null);
    setSelectedProductId(null);
    setProductQuery('');
    setProductJustSelected(false);
    setProductCode('');
    setPriceQuery('');
    setSellingPrice('');
    setMrp('');
    setErrors({});
    setApiError('');
    setTimeout(() => productRef.current?.focus(), 30);
  }, []);

  const validate = () => {
    const next = {};
    const sp = Number(sellingPrice);
    const mrpNum = Number(mrp);
    if (selectedProductId == null || !productQuery.trim()) next.ProductId = 'Product Name is required.';
    if (!priceQuery.trim()) next.Product_Price_Code_Id = 'Price Code is required.';
    if (!sellingPrice) next.SellingPrice = 'Selling Price is required.';
    else if (!decimalPattern.test(sellingPrice) || sp <= 0) next.SellingPrice = 'Enter a valid positive selling price.';
    if (!mrp) next.MRP = 'MRP is required.';
    else if (!decimalPattern.test(mrp) || mrpNum <= 0) next.MRP = 'Enter a valid positive MRP.';
    if (!next.SellingPrice && !next.MRP && mrpNum < sp) next.MRP = 'MRP must be greater than or equal to Selling Price.';
    return next;
  };

  const submit = async e => {
    e.preventDefault();
    if (saving) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setSaving(true);
    setApiError('');
    try {
      await barcodeService.create({
        ProductId: selectedProductId,
        Product_Price_Code_Id: priceQuery.trim(),
        SellingPrice: sellingPrice,
        MRP: mrp,
      });
      toast.success('Saved Successfully', 'Barcode Generator record saved successfully.');
      resetForm();
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const fieldErrors = {};
        Object.entries(data).forEach(([key, value]) => {
          fieldErrors[key] = Array.isArray(value) ? value[0] : String(value);
        });
        setErrors(fieldErrors);
        setApiError('Please fix the errors below.');
      } else {
        setApiError(data?.detail || 'Failed to save barcode record.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleFormKeyDown = e => {
    if (e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (!saving) submit(e);
      return;
    }

    if (e.defaultPrevented) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (e.target === productRef.current) {
        setSelectedProductId(null);
        setProductQuery('');
        setProductJustSelected(false);
        setProduct(null);
      }
      else if (e.target === productCodeRef.current) setProductCode('');
      else if (e.target === priceRef.current) setPriceQuery('');
      else if (e.target === sellingRef.current) setSellingPrice('');
      else if (e.target === mrpRef.current) setMrp('');
      e.target.focus();
      return;
    }

    if (e.key === 'Backspace' && e.target.value === '') {
      e.preventDefault();
      if (e.target === mrpRef.current) sellingRef.current?.focus();
      else if (e.target === sellingRef.current) priceRef.current?.focus();
      else if (e.target === priceRef.current) productCodeRef.current?.focus();
      else if (e.target === productCodeRef.current) productRef.current?.focus();
      return;
    }

    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (e.target === productRef.current) productCodeRef.current?.focus();
    else if (e.target === productCodeRef.current) priceRef.current?.focus();
    else if (e.target === priceRef.current) sellingRef.current?.focus();
    else if (e.target === sellingRef.current) mrpRef.current?.focus();
  };

  const selectProduct = productOption => {
    if (!productOption) return;
    setProduct(productOption);
    setSelectedProductId(productOption.id);
    setProductQuery(productOption.label);
    setProductJustSelected(true);
    clearError('ProductId');
  };

  return (
    <Layout>
      <div className="page-header barcode-page-header animate-in">
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800 }}>Barcode Generator</h2>
          <p className="page-header-sub">Create and manage barcode price records for products</p>
        </div>
      </div>

      {apiError && (
        <div className="alert alert-warning animate-in" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'.75rem'}}>
          <span>{apiError}</span>
        </div>
      )}

      <form className="barcode-generator-form professional-form-layout" onSubmit={submit} onKeyDown={handleFormKeyDown} noValidate>
        <div className="pf-card barcode-generator-card professional-form-container animate-in animate-in-1">
          <div className="pf-card-body professional-form-content">
            <div className="barcode-grid barcode-grid-product">
              <div>
                <SearchDropdown
                  id="barcode-product"
                  label="Product Name"
                  required
                  placeholder="Enter product name"
                  value={product}
                  query={productQuery}
                  setQuery={setProductQuery}
                  options={products}
                  onSelect={selectProduct}
                  onClear={() => {
                    setProduct(null);
                    setSelectedProductId(null);
                    setProductJustSelected(false);
                  }}
                  disabled={saving}
                  error={errors.ProductId}
                  inputRef={productRef}
                  getLabel={option => option?.label || ''}
                  emptyText="No products found"
                  loading={loading}
                  loadError={productsLoadError}
                  onNext={() => productCodeRef.current?.focus()}
                  selectedId={selectedProductId}
                  selectedName={productQuery}
                />
              </div>

              <div>
                <label className="pf-label" htmlFor="barcode-product-code">Product Code</label>
                <div>
                  <input
                    id="barcode-product-code"
                    ref={productCodeRef}
                    className={`pf-input barcode-input${errors.ProductCode ? ' pf-input--error' : ''}`}
                    value={productCode}
                    disabled={saving}
                    placeholder="Enter product code"
                    onChange={e => {
                      setProductCode(e.target.value);
                      clearError('ProductCode');
                    }}
                  />
                </div>
                {errors.ProductCode && <div className="pf-field-error">{errors.ProductCode}</div>}
              </div>
            </div>

            <div className="barcode-grid barcode-grid-price">
              <div>
                <label className="pf-label" htmlFor="barcode-price">
                  Price Code <Req />
                </label>
                <input
                  id="barcode-price"
                  ref={priceRef}
                  type="text"
                  className={`pf-input barcode-price-code-input${errors.Product_Price_Code_Id ? ' pf-input--error' : ''}`}
                  placeholder="Enter price code"
                  value={priceQuery}
                  disabled={saving}
                  onChange={e => {
                    setPriceQuery(e.target.value);
                    clearError('Product_Price_Code_Id');
                  }}
                />
                {errors.Product_Price_Code_Id && <div className="pf-field-error">{errors.Product_Price_Code_Id}</div>}
              </div>
              <div>
                <label className="pf-label" htmlFor="barcode-selling">
                  Selling Price <Req />
                </label>
                <div className="barcode-currency-field">
                  <span aria-hidden="true" style={{
                    position: 'absolute', left: '.75rem', top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--text-muted)',
                    fontWeight: 700, pointerEvents: 'none',
                  }}>₹</span>
                  <input
                    ref={sellingRef}
                    id="barcode-selling"
                    type="text"
                    inputMode="decimal"
                    className={`pf-input${errors.SellingPrice ? ' pf-input--error' : ''}`}
                    placeholder="0.00"
                    value={sellingPrice}
                    disabled={saving}
                    onChange={e => {
                      const val = normalizeNumericInput(e.target.value);
                      if (!val || decimalPattern.test(val)) setSellingPrice(val);
                      clearError('SellingPrice');
                    }}
                  />
                </div>
                {errors.SellingPrice && <div className="pf-field-error">{errors.SellingPrice}</div>}
              </div>

              <div>
                <label className="pf-label" htmlFor="barcode-mrp">
                  MRP <Req />
                </label>
                <div className="barcode-currency-field">
                  <span aria-hidden="true" style={{
                    position: 'absolute', left: '.75rem', top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--text-muted)',
                    fontWeight: 700, pointerEvents: 'none',
                  }}>₹</span>
                  <input
                    ref={mrpRef}
                    id="barcode-mrp"
                    type="text"
                    inputMode="decimal"
                    className={`pf-input${errors.MRP ? ' pf-input--error' : ''}`}
                    placeholder="0.00"
                    value={mrp}
                    disabled={saving}
                    onChange={e => {
                      const val = normalizeNumericInput(e.target.value);
                      if (!val || decimalPattern.test(val)) setMrp(val);
                      clearError('MRP');
                    }}
                  />
                </div>
                {errors.MRP && <div className="pf-field-error">{errors.MRP}</div>}
              </div>
            </div>
            <div className="barcode-info-box">
              <span className="barcode-info-icon" aria-hidden="true">i</span>
              <span>MRP must be greater than or equal to Selling Price.</span>
            </div>

            <div className="barcode-card-actions professional-form-action-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={resetForm} disabled={saving}>
                <ResetIcon /> Cancel
              </button>
              <button id="barcode-save" ref={saveRef} type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <>{spinEl} Saving...</> : <><SaveIcon /> Save &amp; Generate</>}
              </button>
            </div>
          </div>
        </div>
      </form>
    </Layout>
  );
};

export default BarcodeGenerator;
