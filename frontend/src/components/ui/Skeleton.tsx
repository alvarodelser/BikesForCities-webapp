import React from 'react';

interface SkeletonProps {
  width?: string;
  height?: string;
  rounded?: string;
  className?: string;
  variant?: 'light' | 'dark';
}

const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  rounded = 'rounded-lg',
  className = '',
  variant = 'light',
}) => {
  const bg = variant === 'dark' ? 'bg-white/10' : 'bg-[var(--blue-dark)]/8';
  return (
    <div
      className={`animate-pulse ${bg} ${rounded} ${className}`}
      style={{ width, height }}
      aria-hidden
    />
  );
};

export default Skeleton;
