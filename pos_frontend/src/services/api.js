/**
 * Axios instance with JWT authentication
 */
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 20000,
});

let refreshPromise = null;
const protectedControllers = new Set();
const inFlightGets = new Map();

const PUBLIC_PATHS = [
  '/auth/login/',
  '/auth/register/',
  '/auth/token/refresh/',
  '/company-info/public/',
  '/company/public/',
];

const isPublicRequest = (url = '') => {
  const path = String(url).replace(API_BASE_URL, '');
  return PUBLIC_PATHS.some(publicPath => path.includes(publicPath));
};

const stableStringify = (value) => {
  if (!value || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
};

const getAuthScope = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return user?.id || user?.username || 'anonymous';
  } catch {
    return 'anonymous';
  }
};

const isJwtExpired = (token) => {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    if (!payload.exp) return false;
    return payload.exp * 1000 <= Date.now() + 30000;
  } catch {
    return false;
  }
};

export const restoreAuthSession = async () => {
  const accessToken = localStorage.getItem('access_token');
  const refreshToken = localStorage.getItem('refresh_token');
  const storedUser = localStorage.getItem('user');

  if (!accessToken || !storedUser) return null;

  if (!isJwtExpired(accessToken)) {
    api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
    notifyAuthReady();
    return { token: accessToken, user: JSON.parse(storedUser) };
  }

  if (!refreshToken) {
    clearAuthStorage();
    return null;
  }

  try {
    refreshPromise = refreshPromise || axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
      refresh: refreshToken,
    }, { timeout: 20000 }).finally(() => {
      refreshPromise = null;
    });
    const response = await refreshPromise;
    const { access, refresh } = response.data;
    localStorage.setItem('access_token', access);
    if (refresh) localStorage.setItem('refresh_token', refresh);
    api.defaults.headers.common.Authorization = `Bearer ${access}`;
    notifyAuthReady();
    return { token: access, user: JSON.parse(storedUser) };
  } catch {
    clearAuthStorage();
    return null;
  }
};

export const cancelProtectedRequests = () => {
  protectedControllers.forEach(controller => controller.abort());
  protectedControllers.clear();
  inFlightGets.clear();
};

export const clearAuthStorage = () => {
  cancelProtectedRequests();
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  localStorage.removeItem('username');
  delete api.defaults.headers.common.Authorization;
  refreshPromise = null;
  window.dispatchEvent(new Event('pos-auth-cleared'));
};

export const notifyAuthReady = () => {
  inFlightGets.clear();
  window.dispatchEvent(new Event('pos-auth-ready'));
};

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    if (config.skipAuth || isPublicRequest(config.url)) {
      delete config.headers.Authorization;
      return config;
    }
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retrying, try to refresh token
    if (error.response?.status === 401 && !originalRequest?.skipAuth && !isPublicRequest(originalRequest?.url) && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          refreshPromise = refreshPromise || axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
            refresh: refreshToken,
          }, { timeout: 20000 }).finally(() => {
            refreshPromise = null;
          });
          const response = await refreshPromise;

          const { access, refresh } = response.data;
          localStorage.setItem('access_token', access);
          if (refresh) localStorage.setItem('refresh_token', refresh);
          api.defaults.headers.common.Authorization = `Bearer ${access}`;

          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        }
        clearAuthStorage();
        window.location.href = '/login';
      } catch (refreshError) {
        // Refresh failed - logout user
        clearAuthStorage();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

const rawGet = api.get.bind(api);

api.get = (url, config = {}) => {
  if (config.dedupe === false) {
    return rawGet(url, config);
  }

  const key = `${getAuthScope()}|GET|${url}|${stableStringify(config.params)}`;
  const existing = inFlightGets.get(key);
  if (existing) return existing.promise;

  const isPublic = config.skipAuth || isPublicRequest(url);
  const controller = config.signal ? null : new AbortController();
  const requestConfig = controller ? { ...config, signal: controller.signal } : config;

  if (controller && !isPublic) protectedControllers.add(controller);

  const promise = rawGet(url, requestConfig).finally(() => {
    inFlightGets.delete(key);
    if (controller) protectedControllers.delete(controller);
  });

  inFlightGets.set(key, { promise, controller });
  return promise;
};
