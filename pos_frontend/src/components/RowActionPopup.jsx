import { useEffect, useRef } from 'react';
import { Eye, Pencil, Trash2, Printer } from 'lucide-react';

const iconMap = {
  view: Eye,
  edit: Pencil,
  delete: Trash2,
  print: Printer,
};

const RowActionPopup = ({ visible, actions = [], onDismiss }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!visible) return undefined;
    const onPointerDown = event => {
      if (ref.current && !ref.current.contains(event.target)) onDismiss?.();
    };
    const onKeyDown = event => {
      if (event.key === 'Escape') onDismiss?.();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [visible, onDismiss]);

  if (!visible || !actions.length) return null;

  return (
    <div ref={ref} className="row-action-popup" onClick={event => event.stopPropagation()}>
      {actions.filter(Boolean).map(action => {
        const Icon = action.icon || iconMap[action.type] || Eye;
        return (
          <button
            key={action.key || action.type || action.title}
            type="button"
            className={`row-action-popup-btn ${action.variant ? `is-${action.variant}` : ''}`}
            title={action.title}
            aria-label={action.title}
            disabled={action.disabled}
            onClick={event => {
              event.stopPropagation();
              action.onClick?.(event);
            }}
          >
            <Icon size={14} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
};

export default RowActionPopup;
