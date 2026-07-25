import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { recordUsefulRoute } from '../services/appRouteHistory';

const AppRouteHistory = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    recordUsefulRoute(pathname);
  }, [pathname]);

  return null;
};

export default AppRouteHistory;
