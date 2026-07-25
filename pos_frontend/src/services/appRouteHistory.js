const STORAGE_KEY = 'pos-useful-route-history-v1';

const USEFUL_ROUTES = new Set([
  '/dashboard',
  '/products',
  '/products/prices',
  '/products/groups',
  '/customers',
  '/billing',
  '/barcode-generator',
  '/settings',
]);

export const isUsefulRoute = pathname => USEFUL_ROUTES.has(pathname);

const readHistory = () => {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter(isUsefulRoute) : [];
  } catch {
    return [];
  }
};

const writeHistory = routes => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(routes.slice(-30)));
  } catch {}
};

export const recordUsefulRoute = pathname => {
  if (!isUsefulRoute(pathname)) return;
  const routes = readHistory();
  const existingIndex = routes.lastIndexOf(pathname);
  if (existingIndex >= 0) {
    writeHistory(routes.slice(0, existingIndex + 1));
    return;
  }
  writeHistory([...routes, pathname]);
};

export const getPreviousUsefulRoute = pathname => {
  if (pathname === '/dashboard') return null;
  const routes = readHistory();
  if (isUsefulRoute(pathname) && routes[routes.length - 1] === pathname) {
    routes.pop();
  }
  const previous = routes[routes.length - 1] || '/dashboard';
  writeHistory(routes.length ? routes : ['/dashboard']);
  return previous;
};
