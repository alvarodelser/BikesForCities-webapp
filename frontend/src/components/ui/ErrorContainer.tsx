import React from 'react';
import { RefreshCw, Home } from 'lucide-react';
import { useNavigate } from 'react-router';
import ErrorSVG from './ErrorSVG';

export interface ErrorContainerProps {
  title?: string;
  message: string;
  showRetry?: boolean;
  onRetry?: () => void;
  showHome?: boolean;
  className?: string;
  variant?: 'full' | 'inline';
}

const ErrorContainer: React.FC<ErrorContainerProps> = ({
  title = 'Algo ha ido mal',
  message,
  showRetry = false,
  onRetry,
  showHome = false,
  className = '',
  variant = 'full'
}) => {
  const navigate = useNavigate();

  if (variant === 'inline') {
    return (
      <div className={`flex items-start gap-3 p-4 rounded-xl bg-[var(--red)]/5 border border-[var(--red)]/10 max-w-xl ${className}`}>
        <div className="p-2 rounded-lg bg-[var(--red)]/10 text-[var(--red)] shrink-0">
          <ErrorSVG className="w-8 h-8" />
        </div>
        <div className="flex flex-col">
          {title && (
            <h3 className="text-sm font-bold text-gray-800 mb-0.5 font-heading">
              {title}
            </h3>
          )}
          <p className="text-xs text-gray-500 font-light leading-normal">
            {message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full flex items-center justify-center p-4 ${className}`}>
      <div className="flex flex-col items-center text-center max-w-sm">
        <ErrorSVG className="w-28 h-28 text-[var(--red)] mb-6 opacity-90" />
        
        <h3 className="text-xl font-bold text-white mb-2 font-heading">
          {title}
        </h3>
        
        <p className="text-white/70 mb-6 font-light text-sm">
          {message}
        </p>

        <div className="flex items-center justify-center gap-3">
          {showRetry && (
            <button
              onClick={onRetry || (() => window.location.reload())}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors text-sm font-medium border border-white/10"
            >
              <RefreshCw size={16} />
              Reintentar
            </button>
          )}
          
          {showHome && (
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--green)]/20 hover:bg-[var(--green)]/30 text-[var(--green)] rounded-lg transition-colors text-sm font-medium border border-[var(--green)]/30"
            >
              <Home size={16} />
              Inicio
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorContainer;
