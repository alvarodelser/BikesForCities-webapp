import React from 'react';
import { RefreshCw, Home } from 'lucide-react';
import { useNavigate } from 'react-router';
import GlassCard from './GlassCard';
import B4CError from './B4CError';

export interface ErrorStateProps {
  title?: string;
  message: string;
  showRetry?: boolean;
  onRetry?: () => void;
  showHome?: boolean;
  className?: string;
}

const ErrorState: React.FC<ErrorStateProps> = ({
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
      <GlassCard
        surface="glass"
        tint="rgba(175, 71, 73, 0.3)" // Uses var(--red) aesthetic
        className="max-w-md p-8 text-center"
      >
        <div className="flex justify-center mb-6 text-[var(--red)]">
          <B4CError className="w-24 h-24" />
        </div>
        
        <h3 className="text-2xl font-bold text-white mb-3 font-heading">
          {title}
        </h3>
        
        <p className="text-white/80 mb-8 font-light">
          {message}
        </p>

        <div className="flex items-center justify-center gap-4">
          {showRetry && (
            <button
              onClick={onRetry || (() => window.location.reload())}
              className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-medium border border-white/10"
            >
              <RefreshCw size={18} />
              Reintentar
            </button>
          )}
          
          {showHome && (
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-6 py-3 bg-[var(--green)] hover:bg-[var(--green-dark)] text-white rounded-lg transition-colors font-medium shadow-lg"
            >
              <Home size={18} />
              Ir al Inicio
            </button>
          )}
        </div>
      </GlassCard>
    </div>
  );
};

export default ErrorState;
