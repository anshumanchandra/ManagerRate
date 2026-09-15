/* ========================================
   Toast — Notification component
   ======================================== */

import { useState, useEffect, useCallback } from 'react';

interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error' | 'info';
}

let toastId = 0;
const listeners: ((msg: ToastMessage) => void)[] = [];

export function showToast(text: string, type: 'success' | 'error' | 'info' = 'success') {
  const msg: ToastMessage = { id: ++toastId, text, type };
  listeners.forEach((fn) => fn(msg));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((msg: ToastMessage) => {
    setToasts((prev) => [...prev, msg]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== msg.id));
    }, 4000);
  }, []);

  useEffect(() => {
    listeners.push(addToast);
    return () => {
      const idx = listeners.indexOf(addToast);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, [addToast]);

  const icons = {
    success: 'fa-circle-check text-green-400',
    error: 'fa-circle-xmark text-red-400',
    info: 'fa-circle-info text-blue-400',
  };

  return (
    <div className="fixed bottom-5 right-5 z-[999] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-3 px-5 py-3 bg-gray-900 text-white rounded-xl shadow-2xl text-sm font-medium animate-slide-up"
        >
          <i className={`fa-solid ${icons[t.type]}`} />
          {t.text}
        </div>
      ))}
    </div>
  );
}
