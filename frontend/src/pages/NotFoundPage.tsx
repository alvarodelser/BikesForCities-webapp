import React from 'react';
import ErrorState from '../components/ui/ErrorState';

const NotFoundPage: React.FC = () => {
  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center bg-[var(--blue-dark)]">
      <ErrorState 
        title="Página No Encontrada" 
        message="La página que buscas no existe o ha sido movida." 
        showHome={true} 
      />
    </div>
  );
};

export default NotFoundPage;
