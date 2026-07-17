import api from './api';

let priceCodesCache = null;
let priceCodesPromise = null;
const BILLING_PRODUCTS_TIMEOUT_MS = 30000;
const BILLING_PRODUCTS_CACHE_TTL_MS = 45000;
const BILLING_PRODUCTS_CACHE_MAX = 30;
const billingProductsCache = new Map();
const billingProductsRequests = new Map();

const stableKey = (params = {}) => JSON.stringify(
  Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {})
);

const clearCache = () => {
  priceCodesCache = null;
  priceCodesPromise = null;
  billingProductsCache.clear();
  billingProductsRequests.clear();
};

const notifyBillingsChanged = () => {
  window.dispatchEvent(new Event('pos-billings-changed'));
};

const getCachedBillingProducts = key => {
  const cached = billingProductsCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.time > BILLING_PRODUCTS_CACHE_TTL_MS) {
    billingProductsCache.delete(key);
    return null;
  }
  return cached.data;
};

const setCachedBillingProducts = (key, data) => {
  billingProductsCache.set(key, { time: Date.now(), data });
  while (billingProductsCache.size > BILLING_PRODUCTS_CACHE_MAX) {
    const oldestKey = billingProductsCache.keys().next().value;
    billingProductsCache.delete(oldestKey);
  }
};

window.addEventListener('pos-auth-cleared', clearCache);
window.addEventListener('pos-products-changed', clearCache);

const billingService = {
  getCustomersDropdown: async (search = '') => {
    const params = search ? { search, limit: 50 } : { limit: 50 };
    const res = await api.get('/billing/customers/', { params });
    // Handle both plain array and paginated {count, results} shape
    const data = res.data;
    return Array.isArray(data) ? data : (data?.results ?? []);
  },
  getProductsForBilling: async (search = '', options = {}) => {
    const limit = options.limit || 50;
    const cursor = options.cursor || null;
    const params = {
      ...(search ? { search } : {}),
      limit,
      ...(cursor ? { cursor } : {}),
    };
    const key = `sales-products|${stableKey(params)}`;
    const cached = !options.force ? getCachedBillingProducts(key) : null;
    if (cached) return cached;
    if (!options.force && billingProductsRequests.has(key)) return billingProductsRequests.get(key);

    const request = api.get('/products/for-billing/', {
      params,
      timeout: BILLING_PRODUCTS_TIMEOUT_MS,
      dedupe: false,
    }).then(res => {
      const data = res.data;
      const page = Array.isArray(data)
        ? { results: data, next_cursor: null, has_more: false }
        : {
            results: Array.isArray(data?.results) ? data.results : [],
            next_cursor: data?.next_cursor ?? null,
            has_more: Boolean(data?.has_more),
          };
      setCachedBillingProducts(key, page);
      return page;
    }).finally(() => {
      billingProductsRequests.delete(key);
    });

    billingProductsRequests.set(key, request);
    return request;
  },
  getPriceCodes: async () => {
    if (priceCodesCache) return priceCodesCache;
    priceCodesPromise = priceCodesPromise || api.get('/price-codes/');
    try {
      const res = await priceCodesPromise;
      const data = res.data;
      priceCodesCache = Array.isArray(data) ? data : (data?.results ?? []);
      return priceCodesCache;
    } finally {
      priceCodesPromise = null;
    }
  },
  getBillings: async (params = {}) => {
    const res = await api.get('/billing/', { params });
    return res.data;
  },
  getBilling: async (id) => {
    const res = await api.get(`/billing/${id}/`);
    return res.data;
  },
  createBill: async (data) => {
    const res = await api.post('/billing/create/', data);
    notifyBillingsChanged();
    return res.data;
  },
  updateBill: async (id, data) => {
    const res = await api.put(`/billing/${id}/edit/`, data);
    notifyBillingsChanged();
    return res.data;
  },
  deleteBilling: async (id) => {
    const res = await api.delete(`/billing/${id}/`);
    notifyBillingsChanged();
    return res.data;
  },
  getBillingConfig: async () => {
    const res = await api.get('/billing/config/');
    return res.data;
  },
  updateBillingConfig: async (data) => {
    const res = await api.patch('/billing/config/', data);
    return res.data;
  },
};

export default billingService;
