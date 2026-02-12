import React from 'react';

interface AppCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const AppCard = ({ children, className = '', onClick }: AppCardProps) => (
  <div
    onClick={onClick}
    className={`bg-card dark:bg-card rounded-3xl p-5 shadow-soft dark:shadow-none border border-transparent dark:border-border transition-all ${className} ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}`}
  >
    {children}
  </div>
);

export default AppCard;
