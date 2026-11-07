import React, { useEffect } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';

interface NotificationProps {
  type: 'success' | 'error';
  message: string;
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({
  type,
  message,
  onClose,
}) => {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 4200);
    return () => window.clearTimeout(timer);
  }, [onClose, message]);

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-8 z-50 max-w-md bg-[#FDFBF7] border border-[#E2D9C5] text-[#2C2A29] px-4 py-3 rounded-xl shadow-md flex items-center gap-3">
      {type === 'success' ? (
        <CheckCircle2 className="w-4 h-4 text-[#2D5A3C] shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
      )}
      <span className="text-xs font-medium leading-snug flex-1">{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close notification"
        className="p-1 text-[#8C8377] hover:text-[#2C2A29]"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default Notification;
