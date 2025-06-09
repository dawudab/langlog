
import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import { NotificationMessage } from '../types';

interface NotificationProps extends NotificationMessage {
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ type, message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000); // Auto close after 5 seconds
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-emerald-500/90' : 'bg-red-500/90';
  const Icon = type === 'success' ? CheckCircle : AlertTriangle;

  return (
    <div className={`fixed top-20 right-4 sm:right-6 md:right-8 max-w-sm w-full p-4 rounded-lg shadow-xl text-white ${bgColor} backdrop-blur-sm z-50 flex items-start space-x-3`}>
      <Icon className="h-6 w-6 flex-shrink-0 mt-0.5" />
      <div className="flex-grow">
        <p className="font-medium">{type === 'success' ? 'Success!' : 'Error'}</p>
        <p className="text-sm">{message}</p>
      </div>
      <button onClick={onClose} className="ml-auto -mx-1.5 -my-1.5 p-1.5 rounded-md hover:bg-white/20 transition-colors">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
};

export default Notification;
