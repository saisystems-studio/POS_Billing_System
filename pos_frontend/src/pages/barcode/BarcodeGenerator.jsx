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

const BarcodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <path d="M4 7v10"/><path d="M7 7v10"/><path d="M11 7v10"/>
    <path d="M15 7v10"/><path d="M20 7v10"/><path d="M17 7v10"/>
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
}) => {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrapRef = useRef(null);
  const optionRefs = useRef([]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter(opt => {
      const labelText = getLabel(opt).toLowerCase();
      const metaText = (getMeta?.(opt) || '').toLowerCase();
      return labelText.includes(term) || metaText.includes(term);
    });
  }, [getLabel, getMeta, options, query]);

  useEffect(() => {
    if (!open) return;
    const close = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setHi(h => Math.min(h, Math.max(filtered.length - 1, 0)));
  }, [filtered.length, open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      onSearch?.(query);
    }, 250);
    return () => clearTimeout(t);
  }, [open, query, onSearch]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[hi]?.scrollIntoView({ block: 'nearest' });
  }, [hi, open]);

  useEffect(() => {
    const el = inputRef?.current;
    if (!el) return undefined;
    const clear = () => {
      if (disabled) return;
      setQuery('');
      onClear?.();
      setOpen(false);
      setHi(0);
      setTimeout(() => el.focus(), 0);
    };
    el.addEventListener('pos-escape-clear-field', clear);
    return () => el.removeEventListener('pos-escape-clear-field', clear);
  }, [disabled, inputRef, onClear, setQuery]);

  const pick = opt => {
    onSelect(opt);
    setQuery(getLabel(opt));
    setOpen(false);
    setHi(0);
  };

  const handleKeyDown = e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHi(h => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setHi(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (filtered[hi]) pick(filtered[hi]);
    } else if (e.key === 'Escape') {
      setOpen(false);
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
          className={`pf-input barcode-input${leftIcon ? ' barcode-input-with-icon' : ''}${error ? ' pf-input--error' : ''}`}
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={e => {
            const next = e.target.value;
            setQuery(next);
            if (value && next !== getLabel(value)) onClear?.();
            setOpen(true);
            setHi(0);
          }}
          onKeyDown={handleKeyDown}
        />
        <span className="barcode-field-caret" aria-hidden="true">
          {open ? '\u25B2' : '\u25BC'}
        </span>
      </div>
      {open && !disabled && (
        <div className="shared-dropdown-menu" style={{
          position: 'absolute', zIndex: 40, top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--card-bg)', border: '1.5px solid var(--primary)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {loadError && filtered.length === 0 ? (
            <div style={{ padding: '.55rem .7rem', fontSize: '.78rem', color: 'var(--danger)', fontWeight: 600 }}>
              {loadError}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '.55rem .7rem', fontSize: '.78rem', color: 'var(--text-muted)' }}>
              {emptyText}
            </div>
          ) : filtered.map((opt, idx) => {
            const selected = value && opt.id === value.id;
            const focused = hi === idx;
            return (
              <button
                className="shared-dropdown-option"
                key={opt.id}
                ref={el => { optionRefs.current[idx] = el; }}
                type="button"
                onMouseDown={e => { e.preventDefault(); pick(opt); }}
                onMouseEnter={() => setHi(idx)}
                style={{
                  width: '100%', border: 0, textAlign: 'left',
                  padding: '.48rem .7rem', cursor: 'pointer',
                  background: selected ? 'var(--primary-light)' : focused ? 'var(--scale-100)' : 'transparent',
                  color: selected || focused ? 'var(--primary-dark)' : 'var(--text-primary)',
                  display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                <span style={{ fontSize: '.84rem', fontWeight: 700 }}>{getLabel(opt)}</span>
                {getMeta && <span style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>{getMeta(opt)}</span>}
              </button>
            );
          })}
        </div>
      )}
      {error && <div className="pf-field-error">{error}</div>}
    </div>
  );
};

const BarcodeGenerator = () => {
  const toast = useToast();
  const productRef = useRef(null);
  const priceRef = useRef(null);
  const sellingRef = useRef(null);
  const saveRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [productLoading, setProductLoading] = useState(false);
  const [productLoadError, setProductLoadError] = useState('');
  const [products, setProducts] = useState([]);
  const [priceOptions, setPriceOptions] = useState([]);
  const [priceCodeMasters, setPriceCodeMasters] = useState([]);
  const [product, setProduct] = useState(null);
  const [priceRow, setPriceRow] = useState(null);
  const [productQuery, setProductQuery] = useState('');
  const [productCode, setProductCode] = useState('');
  const [priceQuery, setPriceQuery] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const productReqRef = useRef(0);
  const lastProductSearchRef = useRef(null);

  const loadProducts = useCallback(async (search = '', initial = false, options = {}) => {
    const term = (search || '').trim();
    if (!options.force && lastProductSearchRef.current === term && products.length > 0) return;
    lastProductSearchRef.current = term;
    const seq = ++productReqRef.current;
    if (initial) setLoading(true);
    setProductLoading(true);
    setProductLoadError('');
    try {
      const rows = await barcodeService.getProducts(term ? { search: term } : {}, options);
      if (seq !== productReqRef.current) return;
      setProducts(prev => {
        if (!rows.length && prev.length && term) return prev;
        return rows;
      });
      setProductLoadError('');
      setApiError('');
    } catch (err) {
      if (seq !== productReqRef.current) return;
      if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return;
      lastProductSearchRef.current = null;
      const status = err.response?.status;
      const message = status === 401
        ? 'Session expired. Please login again.'
        : status === 403
          ? 'You do not have permission to load products.'
          : err.code === 'ECONNABORTED'
            ? 'Product loading timed out. Retry.'
            : err.response?.data?.detail || 'Unable to load products. Retry.';
      setProductLoadError(message);
      setApiError(message);
    } finally {
      if (seq === productReqRef.current) {
        setProductLoading(false);
        if (initial) setLoading(false);
      }
    }
  }, [products.length]);

  useEffect(() => {
    setLoading(false);
  }, []);

  useEffect(() => {
    barcodeService.getPriceCodeMasters()
      .then(rows => setPriceCodeMasters(rows))
      .catch(() => setApiError('Unable to load price codes. Retry.'));
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
    setPriceRow(null);
    setPriceOptions([]);
    setProductQuery('');
    setProductCode('');
    setPriceQuery('');
    setSellingPrice('');
    setMrp('');
    setErrors({});
    setApiError('');
    setTimeout(() => productRef.current?.focus(), 30);
  }, []);

  const selectProduct = async opt => {
    setProduct(opt);
    setProductCode(opt.ProductCode || '');
    setPriceRow(null);
    setPriceOptions([]);
    clearError('ProductId');
    setPriceLoading(true);
    try {
      const prices = await barcodeService.getPriceCodes(opt.id);
      setPriceOptions(prices);
      const current = findProductPriceRow(priceQuery, prices);
      setPriceRow(current);
      if (current?.ProductPrice != null && !sellingPrice) setSellingPrice(String(current.ProductPrice));
      setTimeout(() => priceRef.current?.focus(), 30);
    } catch (err) {
      setApiError(err.response?.data?.detail || 'Failed to load price codes for this product.');
    } finally {
      setPriceLoading(false);
    }
  };

  const normalizePriceCode = value => String(value || '')
    .trim()
    .replace(/^price\s+/i, '')
    .toLowerCase();

  const findPriceCodeMaster = useCallback((value) => {
    const normalized = value.trim().toLowerCase();
    return priceCodeMasters.find(opt => {
      const names = [
        opt.PriceCodeName,
        opt.DisplayLabel,
        opt.DisplayLabel?.replace(/^price\s+/i, ''),
      ].filter(Boolean).map(v => String(v).trim().toLowerCase());
      return names.includes(normalized);
    }) || null;
  }, [priceCodeMasters]);

  const findProductPriceRow = useCallback((value, rows = priceOptions) => {
    const master = findPriceCodeMaster(value);
    const normalized = normalizePriceCode(value);
    return rows.find(opt => {
      if (master?.id && opt.PriceCodeID === master.id) return true;
      const names = [
        opt.PriceCodeName,
        opt.PriceName,
        opt.DisplayLabel,
        opt.DisplayLabel?.replace(/^price\s+/i, ''),
      ].filter(Boolean).map(normalizePriceCode);
      return names.includes(normalized);
    }) || null;
  }, [findPriceCodeMaster, priceOptions]);

  const validateManualPriceCode = useCallback((moveNext = false) => {
    const typed = priceQuery.trim();
    if (!typed) {
      setPriceRow(null);
      setErrors(prev => ({ ...prev, Product_Price_Code_Id: 'Price Code is required.' }));
      return false;
    }
    const master = findPriceCodeMaster(typed);
    const productPrice = findProductPriceRow(typed);
    if (!master) {
      setPriceRow(null);
      setErrors(prev => ({ ...prev, Product_Price_Code_Id: 'Price Code does not exist.' }));
      return false;
    }
    setPriceRow(productPrice);
    setPriceQuery(master.PriceCodeName || master.DisplayLabel || typed);
    if (productPrice?.ProductPrice != null && !sellingPrice) setSellingPrice(String(productPrice.ProductPrice));
    clearError('Product_Price_Code_Id');
    if (moveNext) setTimeout(() => sellingRef.current?.focus(), 20);
    return true;
  }, [clearError, findPriceCodeMaster, findProductPriceRow, priceQuery, sellingPrice]);

  const validate = () => {
    const next = {};
    const sp = Number(sellingPrice);
    const mrpNum = Number(mrp);
    if (!product) next.ProductId = 'Product Name is required.';
    if (!priceQuery.trim()) next.Product_Price_Code_Id = 'Price Code is required.';
    else if (!findPriceCodeMaster(priceQuery)) next.Product_Price_Code_Id = 'Price Code does not exist.';
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
    let matchedPriceRow = priceRow || findProductPriceRow(priceQuery);
    if (!matchedPriceRow && product) {
      try {
        const rows = priceOptions.length ? priceOptions : await barcodeService.getPriceCodes(product.id);
        setPriceOptions(rows);
        matchedPriceRow = findProductPriceRow(priceQuery, rows);
      } catch {
        setApiError('Unable to validate price code for this product. Retry.');
        return;
      }
    }
    if (!matchedPriceRow) {
      setErrors({ Product_Price_Code_Id: 'Price Code is not available for this product.' });
      return;
    }
    setSaving(true);
    setApiError('');
    try {
      await barcodeService.create({
        ProductId: product.id,
        Product_Price_Code_Id: matchedPriceRow.id,
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
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      submit(e);
      return;
    }
    if (e.defaultPrevented || e.key !== 'Enter') return;
    if (e.target === saveRef.current) return;
    if (e.target === priceRef.current) {
      e.preventDefault();
      validateManualPriceCode(true);
      return;
    }
    e.preventDefault();
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
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => loadProducts(productQuery, false, { force: true })}>Retry</button>
        </div>
      )}

      <form className="barcode-generator-form" onSubmit={submit} onKeyDown={handleFormKeyDown} noValidate>
        <div className="pf-card barcode-generator-card animate-in animate-in-1">
          <div className="pf-card-header">
            <span className="pf-card-header-icon"><BarcodeIcon /></span>
            <div>
              <span className="pf-card-header-title">Barcode Details</span>
              <div className="pf-card-header-sub barcode-card-sub">
                Select a product and configure its barcode pricing
              </div>
            </div>
          </div>
          <div className="pf-card-body">
            <div className="barcode-grid barcode-grid-product">
              <SearchDropdown
                id="barcode-product"
                label="Product Name"
                required
                placeholder="Search or type product..."
                value={product}
                query={productQuery}
                setQuery={setProductQuery}
                options={products}
                onSelect={selectProduct}
                disabled={saving}
                error={errors.ProductId}
                inputRef={productRef}
                leftIcon={<SearchIcon />}
                getLabel={opt => opt.ProductName || ''}
                getMeta={opt => [opt.ProductCode, opt.Units].filter(Boolean).join(' | ')}
                onClear={() => {
                  setProduct(null);
                  setPriceRow(null);
                  setPriceOptions([]);
                  setProductCode('');
                  setPriceQuery('');
                  setSellingPrice('');
                  setMrp('');
                }}
                emptyText="No products found"
                onSearch={loadProducts}
                loading={productLoading}
                loadError={productLoadError}
              />

              <div>
                <label className="pf-label" htmlFor="barcode-product-code">Product Code</label>
                <div>
                  <input
                    id="barcode-product-code"
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
                    const next = e.target.value;
                    setPriceQuery(next);
                    const match = findProductPriceRow(next);
                    setPriceRow(match);
                    if (match?.ProductPrice != null) setSellingPrice(String(match.ProductPrice));
                    clearError('Product_Price_Code_Id');
                  }}
                  onBlur={() => {
                    if (priceQuery.trim()) validateManualPriceCode(false);
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
                      const val = e.target.value;
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
                    id="barcode-mrp"
                    type="text"
                    inputMode="decimal"
                    className={`pf-input${errors.MRP ? ' pf-input--error' : ''}`}
                    placeholder="0.00"
                    value={mrp}
                    disabled={saving}
                    onChange={e => {
                      const val = e.target.value;
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

            <div className="barcode-card-actions">
              <button type="button" className="btn btn-outline-secondary" onClick={resetForm} disabled={saving}>
                <ResetIcon /> Reset
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
