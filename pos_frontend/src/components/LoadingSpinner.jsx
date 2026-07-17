const LoadingSpinner = ({ message = 'Loading…' }) => (
  <div className="spinner-wrap">
    <div className="spinner" aria-hidden="true" />
    <span className="spinner-text">{message}</span>
  </div>
);

export default LoadingSpinner;
