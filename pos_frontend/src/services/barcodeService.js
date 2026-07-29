import api from './api';

const unwrap = data => Array.isArray(data) ? data : (data?.results ?? []);
const PRODUCT_TIMEOUT_MS = 30000;
const PRICE_TIMEOUT_MS = 15000;
const productCache = new Map();
const productRequests = new Map();
let productOptionsCache = null;
let productOptionsRequest = null;

const stableKey = (params = {}) => JSON.stringify(
  Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {})
);

const clearBarcodeCache = () => {
  productCache.clear();
  productRequests.clear();
  productOptionsCache = null;
  productOptionsRequest = null;
};

const fetchProductOptions = () => {
  if (productOptionsRequest) return productOptionsRequest;
  productOptionsRequest = api.get('/barcode-generator/products/', {
    timeout: PRODUCT_TIMEOUT_MS,
  }).then(response => {
    const rows = unwrap(response.data);
    const options = rows.map(product => ({
      id: product.id,
      label: product.ProductName,
    }));
    productOptionsCache = options;
    return options;
  }).finally(() => {
    productOptionsRequest = null;
  });
  return productOptionsRequest;
};

window.addEventListener('pos-auth-cleared', clearBarcodeCache);

const barcodeService = {
  getProducts: async (params = {}, options = {}) => {
    const queryParams = { limit: 50, ...params };
    const key = stableKey(queryParams);
    if (!options.force && productCache.has(key)) return productCache.get(key);
    if (!options.force && productRequests.has(key)) return productRequests.get(key);

    const request = api.get('/barcode-generator/products/', {
      params: queryParams,
      timeout: PRODUCT_TIMEOUT_MS,
    }).then(response => {
      const rows = unwrap(response.data);
      productCache.set(key, rows);
      return rows;
    }).finally(() => {
      productRequests.delete(key);
    });

    productRequests.set(key, request);
    return request;
  },

  getCachedProductOptions: () => productOptionsCache,

  getProductOptions: async ({ force = false } = {}) => {
    if (!force && productOptionsCache) return productOptionsCache;
    return fetchProductOptions();
  },

  refreshProductOptions: () => fetchProductOptions(),

  getPriceCodes: async (productId, params = {}) => {
    const response = await api.get(`/barcode-generator/products/${productId}/price-codes/`, {
      params,
      timeout: PRICE_TIMEOUT_MS,
    });
    return unwrap(response.data);
  },

  getPriceCodeMasters: async () => {
    const response = await api.get('/price-codes/', {
      timeout: PRICE_TIMEOUT_MS,
    });
    return unwrap(response.data);
  },

  create: async (data) => {
    const response = await api.post('/barcode-generator/', data);
    return response.data;
  },
};

export default barcodeService;
