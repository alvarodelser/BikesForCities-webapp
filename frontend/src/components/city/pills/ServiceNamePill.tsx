import React from 'react';

export interface ServiceNamePillProps {
  serviceName: string;
}

const ServiceNamePill: React.FC<ServiceNamePillProps> = ({ serviceName }) => {
  return (
    <span className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-2 text-sm font-semibold text-white uppercase tracking-wider">
      {serviceName}
    </span>
  );
};

export default ServiceNamePill;
