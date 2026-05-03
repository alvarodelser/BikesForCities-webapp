import React from 'react';

export interface ServiceNamePillProps {
  serviceName: string;
}

const ServiceNamePill: React.FC<ServiceNamePillProps> = ({ serviceName }) => {
  return (
    <div className="inline-flex items-center gap-2 rounded-2xl border border-black/5 bg-white/90 backdrop-blur-md px-4 py-2.5 shadow-sm">
      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
      <span className="text-xs font-black text-gray-600 uppercase tracking-[0.2em]">
        {serviceName}
      </span>
    </div>
  );
};

export default ServiceNamePill;
