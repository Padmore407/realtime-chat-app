import { useNotifications } from '../context/NotificationContext';
import { CloseIcon } from './Icons';

export default function Toasts() {
  const { toasts, dismiss } = useNotifications();

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          <button
            type="button"
            className="toast-body"
            onClick={() => {
              toast.onClick?.();
              dismiss(toast.id);
            }}
          >
            <strong>{toast.title}</strong>
            <span>{toast.body}</span>
          </button>
          <button type="button" className="icon-button small" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
            <CloseIcon size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
