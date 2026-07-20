const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX = 40;
const STORAGE_PREFIX = 'pos-page-cache:';

const caches = new Map();
const requests = new Map();

const storageKey = namespace => `${STORAGE_PREFIX}${namespace}`;

const persistCache = (namespace, cache) => {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(storageKey(namespace), JSON.stringify([...cache.entries()]));
  } catch {
    // Ignore storage quota/private-mode failures; memory cache still works.
  }
};

const hydrateCache = namespace => {
  if (typeof sessionStorage === 'undefined') return new Map();
  try {
    const raw = sessionStorage.getItem(storageKey(namespace));
    const entries = raw ? JSON.parse(raw) : [];
    return new Map(Array.isArray(entries) ? entries : []);
  } catch {
    return new Map();
  }
};

const stableKey = (value = {}) => JSON.stringify(
  Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = value[key];
      return acc;
    }, {})
);

const cacheFor = namespace => {
  if (!caches.has(namespace)) caches.set(namespace, hydrateCache(namespace));
  return caches.get(namespace);
};

const requestFor = namespace => {
  if (!requests.has(namespace)) requests.set(namespace, new Map());
  return requests.get(namespace);
};

const trimCache = (cache, max) => {
  while (cache.size > max) {
    cache.delete(cache.keys().next().value);
  }
};

const currentAuthScope = () => {
  if (typeof localStorage === 'undefined') return 'anonymous';
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return String(user?.id || user?.username || 'anonymous');
  } catch {
    return 'anonymous';
  }
};

export const makePageKey = (namespace, params = {}, scope = currentAuthScope()) =>
  `${scope}|${namespace}|${stableKey(params)}`;

export const clearPageCache = namespace => {
  if (namespace) {
    caches.get(namespace)?.clear();
    requests.get(namespace)?.clear();
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(storageKey(namespace));
    return;
  }
  caches.forEach(cache => cache.clear());
  requests.forEach(requestMap => requestMap.clear());
  if (typeof sessionStorage !== 'undefined') {
    Object.keys(sessionStorage)
      .filter(key => key.startsWith(STORAGE_PREFIX))
      .forEach(key => sessionStorage.removeItem(key));
  }
};

export const getCachedPage = (namespace, key, ttlMs = DEFAULT_TTL_MS) => {
  const cached = cacheFor(namespace).get(key);
  if (!cached) return null;
  if (Date.now() - cached.time > ttlMs) {
    cacheFor(namespace).delete(key);
    persistCache(namespace, cacheFor(namespace));
    return null;
  }
  return cached.data;
};

export const fetchCachedPage = async (namespace, key, loader, options = {}) => {
  const {
    force = false,
    ttlMs = DEFAULT_TTL_MS,
    max = DEFAULT_MAX,
  } = options;
  const cache = cacheFor(namespace);
  const requestMap = requestFor(namespace);
  const existing = requestMap.get(key);
  if (existing) return existing;

  if (!force) {
    const cached = getCachedPage(namespace, key, ttlMs);
    if (cached) return { data: cached, cached: true };
  }

  const request = Promise.resolve()
    .then(loader)
    .then(data => {
      cache.set(key, { time: Date.now(), data });
      trimCache(cache, max);
      persistCache(namespace, cache);
      return { data, cached: false };
    })
    .finally(() => {
      if (requestMap.get(key) === request) requestMap.delete(key);
    });

  requestMap.set(key, request);
  return request;
};

export const prefetchCachedPage = (namespace, key, loader, options = {}) => {
  if (getCachedPage(namespace, key, options.ttlMs)) return;
  fetchCachedPage(namespace, key, loader, options).catch(() => {});
};

if (typeof window !== 'undefined') {
  window.addEventListener('pos-auth-cleared', () => clearPageCache());
  window.addEventListener('pos-products-changed', () => {
    clearPageCache('products');
    clearPageCache('price-code-list');
    clearPageCache('dashboard');
  });
  window.addEventListener('pos-product-groups-changed', () => clearPageCache('product-groups'));
  window.addEventListener('pos-customers-changed', () => {
    clearPageCache('customers');
    clearPageCache('dashboard');
  });
  window.addEventListener('pos-billings-changed', () => {
    clearPageCache('billings');
    clearPageCache('dashboard');
  });
}
