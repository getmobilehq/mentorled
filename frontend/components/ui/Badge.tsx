import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  className = '',
}) => {
  const variantStyles = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

// Helper function to get badge variant based on status
export const getStatusBadgeVariant = (status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' => {
  const statusMap: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
    applied: 'info',
    screening: 'warning',
    microship_pending: 'warning',
    microship_completed: 'info',
    accepted: 'success',
    rejected: 'danger',
    withdrawn: 'default',
    // Cohort statuses
    planning: 'default',
    applications_open: 'success',
    microship: 'warning',
    active: 'success',
    completed: 'default',
    // Eligibility
    eligible: 'success',
    borderline: 'warning',
    ineligible: 'danger',
    // Outcomes
    progress: 'success',
    retry: 'warning',
    fail: 'danger',
  };

  return statusMap[status] || 'default';
};
