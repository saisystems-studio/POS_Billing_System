import { useEffect, useState } from 'react';

const LoadingSpinner = ({ message = 'Loading…' }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 180);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={`spinner-wrap${visible ? '' : ' spinner-wrap-pending'}`} aria-live="polite">
      {visible && <><div className="spinner" aria-hidden="true" /><span className="spinner-text">{message}</span></>}
    </div>
  );
};

export default LoadingSpinner;
