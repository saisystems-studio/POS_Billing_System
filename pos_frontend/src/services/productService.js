/**
 * Product service for Ba_db Business Management System
 */
import api from './api';

let unitsCache = null;
let unitsPromise = null;
const PRODUCT_IMPORT_TIMEOUT_MS = 120000;

const clearProductServiceCache = () => {
  unitsCache = null;
  unitsPromise = null;
};

const notifyProductsChanged = () => {
  window.dispatchEvent(new Event('pos-products-changed'));
};

window.addEventListener('pos-auth-cleared', clearProductServiceCache);
window.addEventListener('pos-auth-ready', clearProductServiceCache);

const productService = {
  /**
   * Get all units (for unit dropdown)
   */
  getUnits: async () => {
    if (unitsCache) return unitsCache;
    unitsPromise = unitsPromise || api.get('/units/');
    const response = await unitsPromise.finally(() => {
      unitsPromise = null;
    });
    const data = response.data;
    unitsCache = Array.isArray(data) ? data : (data?.results ?? []);
    return unitsCache;
  },

  /**
   * Create a new unit
   */
  createUnit: async (data) => {
    const response = await api.post('/units/', data);
    unitsCache = null;
    unitsPromise = null;
    window.dispatchEvent(new Event('pos-units-changed'));
    return response.data;
  },

  /**
   * Get the next auto-generated ProductCode preview (e.g. POD_042)
   */
  getNextCode: async () => {
    const response = await api.get('/products/next-code/');
    return response.data.next_code;
  },

  /**
   * Get paginated list of products
   * @param {Object} params - { page, page_size, search, ordering, is_active }
   */
  getProducts: async (params = {}) => {
    const response = await api.get('/products/', { params });
    return response.data;
  },

  downloadImportTemplate: async () => {
    const response = await api.get('/products/import-template/', { responseType: 'blob' });
    return response.data;
  },

  importProducts: async (file, options = {}) => {
    const form = new FormData();
    form.append('file', file);
    if (options.importedPage) form.append('imported_page', options.importedPage);
    if (options.createMissingGroups) form.append('create_missing_groups', 'true');
    if (options.updateExisting) form.append('update_existing', 'true');
    const response = await api.post('/products/import/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: PRODUCT_IMPORT_TIMEOUT_MS,
      signal: options.signal,
      dedupe: false,
      noAuthRetry: true,
    });
    notifyProductsChanged();
    return response.data;
  },

  /**
   * Get single product by ID (includes nested prices)
   */
  getProduct: async (id) => {
    const response = await api.get(`/products/${id}/`);
    return response.data;
  },

  /**
   * Create new product (without prices — basic endpoint)
   * Backend auto-fills CreatedBy and CreatedOn
   * @param {Object} data - { ProductName, Quantity, Units, Description, IsActive }
   */
  createProduct: async (data) => {
    const response = await api.post('/products/', data);
    notifyProductsChanged();
    return response.data;
  },

  /**
   * Create product WITH all 5 price tiers atomically (single request).
   * Backend wraps in transaction.atomic() — all or nothing.
   * @param {Object} data - {
   *   ProductName, Quantity, Units, Description, IsActive,
   *   prices: { A: 0, B: 0, C: 0, D: 0, Retail: 0 }
   * }
   */
  createProductWithPrices: async (data) => {
    const response = await api.post('/products/create-with-prices/', data);
    notifyProductsChanged();
    return response.data;
  },

  /**
   * Update product WITH all 5 price tiers atomically.
   */
  updateProductWithPrices: async (id, data) => {
    const response = await api.put(`/products/create-with-prices/${id}/`, data);
    notifyProductsChanged();
    return response.data;
  },

  /**
   * Update product (Admin only)
   */
  updateProduct: async (id, data) => {
    const response = await api.put(`/products/${id}/`, data);
    notifyProductsChanged();
    return response.data;
  },

  /**
   * Partial update product (Admin only)
   */
  patchProduct: async (id, data) => {
    const response = await api.patch(`/products/${id}/`, data);
    notifyProductsChanged();
    return response.data;
  },

  /**
   * Delete product (Admin only)
   */
  deleteProduct: async (id) => {
    const response = await api.delete(`/products/${id}/`);
    notifyProductsChanged();
    return response.data;
  },

  // ── Product Price endpoints ──────────────────────────────────

  /**
   * Get all price records
   * @param {Object} params - { product_id, page, ordering }
   */
  getPrices: async (params = {}) => {
    const response = await api.get('/product-price/', { params });
    return response.data;
  },

  /**
   * Get single price record
   */
  getPrice: async (id) => {
    const response = await api.get(`/product-price/${id}/`);
    return response.data;
  },

  /**
   * Create price record
   * Backend auto-fills CreatedBy and CreatedOn
   * @param {Object} data - { ProductId, ProductPrice }
   */
  createPrice: async (data) => {
    const response = await api.post('/product-price/', data);
    notifyProductsChanged();
    return response.data;
  },

  createProductWithFixedPrice: async (data) => {
    const response = await api.post('/products/create-with-fixed-price/', data);
    notifyProductsChanged();
    const result = response.data;
    if (!result?.product) return result;
    return {
      ...result.product,
      product_price: result.product_price || null,
      prices: Array.isArray(result.product.prices)
        ? result.product.prices
        : result.product_price ? [{
            PriceCodeID: result.product_price.PriceCodeID ?? result.product_price.price_code_id,
            PriceCodeName: result.product_price.PriceName ?? result.product_price.price_code_name,
            ProductPrice: result.product_price.ProductPrice ?? result.product_price.price,
          }]
          : [],
    };
  },

  /**
   * Update price record (Admin only)
   */
  updatePrice: async (id, data) => {
    const response = await api.put(`/product-price/${id}/`, data);
    notifyProductsChanged();
    return response.data;
  },

  /**
   * Delete price record (Admin only)
   */
  deletePrice: async (id) => {
    const response = await api.delete(`/product-price/${id}/`);
    notifyProductsChanged();
    return response.data;
  },
};

export default productService;
