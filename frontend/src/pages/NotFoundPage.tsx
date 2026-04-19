import React from 'react';
import ErrorState from '../components/ui/ErrorState';

const NotFoundPage: React.FC = () => {
  return (
    <div className="px-[var(--space-gutter)] pt-32 pb-[var(--space-section-y)] md:py-[var(--space-section-y)] min-h-screen flex items-center justify-center bg-[var(--blue-dark)]">
      <div className="text-center">
        <ErrorState
          title="Página No Encontrada"
          message="La página que buscas no existe o ha sido movida."
          showHome={true}
        />
      </div>
    </div>
  );
};

export default NotFoundPage;
