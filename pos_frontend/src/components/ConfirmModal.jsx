import { useEffect } from 'react';

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const ConfirmModal = ({ show, title, message, onConfirm, onCancel, confirmVariant = 'danger', confirmText = 'Confirm', cancelText = 'Cancel' }) => {
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape' && show) onCancel(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [show, onCancel]);

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h5 className="modal-title" id="modal-title">{title}</h5>
          <button className="modal-close" onClick={onCancel} aria-label="Close"><XIcon /></button>
        </div>
        <div className="modal-body">{message}</div>
        <div className="modal-footer">
          <button className="btn btn-outline-secondary" onClick={onCancel}>{cancelText}</button>
          <button className={`btn btn-${confirmVariant}`} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
