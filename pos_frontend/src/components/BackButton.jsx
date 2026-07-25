import { useLocation, useNavigate } from 'react-router-dom';
import { getPreviousUsefulRoute } from '../services/appRouteHistory';

const ArrowLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </svg>
);

const BackButton = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (pathname === '/dashboard' || pathname === '/settings') return null;

  const goBack = () => {
    const previous = getPreviousUsefulRoute(pathname);
    if (previous) navigate(previous);
  };

  return (
    <div className="page-back-row">
      <button type="button" className="page-back-button" onClick={goBack}>
        <ArrowLeft />
        <span>Back</span>
      </button>
    </div>
  );
};

export default BackButton;
