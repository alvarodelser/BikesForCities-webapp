import React from 'react';
import { RefreshCw, Home } from 'lucide-react';
import { useNavigate } from 'react-router';
import GlassCard from './GlassCard';
import ErrorSVG from './ErrorSVG';

export interface ErrorContainerProps {
  title?: string;
  message: string;
  showRetry?: boolean;
  onRetry?: () => void;
  showHome?: boolean;
  className?: string;
}

const ErrorContainer: React.FC<ErrorContainerProps> = ({
  title = 'Algo ha ido mal',
  message,
  showRetry = false,
  onRetry,
  showHome = false,
  className = ''
}) => {
  const navigate = useNavigate();

  return (
    <div className={`w-full h-full flex items-center justify-center p-4 ${className}`}>
      <div className="flex flex-col items-center text-center max-w-sm">
        <ErrorSVG className="w-16 h-16 text-[var(--red)] mb-4 opacity-80" />
        
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
