import React from 'react';
import ErrorState from '../components/ui/ErrorState';

const NotFoundPage: React.FC = () => {
  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center bg-[var(--blue-dark)]">
      <ErrorState 
        title="Page Not Found" 
        message="The page you are looking for does not exist or has been moved." 
        showHome={true} 
      />
    </div>
  );
};

export default NotFoundPage;
