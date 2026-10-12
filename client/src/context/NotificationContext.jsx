import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const NotificationContext = createContext(null);
const TOAST_MS = 4500;
const supportsBrowserNotifications = typeof window !== 'undefined' && 'Notification' in window;

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [permission, setPermission] = useState(supportsBrowserNotifications ? Notification.permission : 'denied');
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  /** In-app toast always; a system notification as well when the tab is in the background. */
  const notify = useCallback(
    ({ title, body, onClick }) => {
      const id = ++nextId.current;
      setToasts((list) => [...list.slice(-3), { id, title, body, onClick }]);
      setTimeout(() => dismiss(id), TOAST_MS);

      if (document.visibilityState === 'hidden' && supportsBrowserNotifications && Notification.permission === 'granted') {
        const notification = new Notification(title, { body, icon: '/favicon.svg', tag: title });
        notification.onclick = () => {
          window.focus();
          onClick?.();
          notification.close();
        };
      }
    },
    [dismiss]
  );

  const requestPermission = useCallback(async () => {
    if (!supportsBrowserNotifications) return;
    setPermission(await Notification.requestPermission());
  }, []);

  const value = useMemo(
    () => ({ toasts, notify, dismiss, permission, requestPermission, supported: supportsBrowserNotifications }),
    [toasts, notify, dismiss, permission, requestPermission]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export const useNotifications = () => useContext(NotificationContext);
