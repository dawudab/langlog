
import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 8, className = '' }) => {
  return (
    <Loader2 className={`h-${size} w-${size} animate-spin text-sky-400 ${className}`} />
  );
};

export default LoadingSpinner;
