import React from 'react';

type BadgeType = 'success' | 'danger' | 'neutral' | 'primary' | 'warning' | 'info' | 'purple' | 'dark';

interface AppBadgeProps {
  children?: React.ReactNode;
  type?: BadgeType;
  className?: string;
}

const styles: Record<BadgeType, string> = {
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  primary: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  dark: 'bg-gray-800 text-white dark:bg-white/20 dark:text-white',
};

const AppBadge = ({ children, type = 'neutral', className = '' }: AppBadgeProps) => (
  <span className={`px-2 py-1 rounded-md text-micro-md font-bold ${styles[type]} ${className}`}>
    {children}
  </span>
);

export default AppBadge;
