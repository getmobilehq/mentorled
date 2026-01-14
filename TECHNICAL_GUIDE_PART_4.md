# MentorLed Platform - Technical Guide (Part 4/6)
## Frontend Components & State Management

**Last Updated**: December 26, 2025
**Version**: Phase 3 Complete
**Status**: Production-Ready

---

## Table of Contents (Part 4)

1. [Frontend Architecture Overview](#frontend-architecture-overview)
2. [Component Library](#component-library)
3. [Page Components](#page-components)
4. [State Management](#state-management)
5. [Data Fetching Patterns](#data-fetching-patterns)
6. [Client-Side Routing](#client-side-routing)
7. [Styling with Tailwind CSS](#styling-with-tailwind-css)

---

## 1. Frontend Architecture Overview

### 1.1 Next.js App Router Structure

MentorLed uses Next.js 14 with the **App Router** (not Pages Router):

```
frontend/app/
├── layout.tsx              # Root layout (applies to all pages)
├── page.tsx                # Dashboard (/)
├── login/
│   └── page.tsx            # Login page (/login)
├── applicants/
│   └── page.tsx            # Applicants page (/applicants)
├── fellows/
│   └── page.tsx            # Fellows page (/fellows)
├── screening/
│   └── page.tsx            # Screening page (/screening)
├── delivery/
│   └── page.tsx            # Delivery page (/delivery)
├── placement/
│   └── page.tsx            # Placement page (/placement)
└── settings/
    └── page.tsx            # Settings page (/settings)
```

**Routing Rules**:
- `app/page.tsx` → `/`
- `app/login/page.tsx` → `/login`
- `app/applicants/page.tsx` → `/applicants`
- Folders = route segments
- `page.tsx` = routable page
- `layout.tsx` = shared layout

### 1.2 Component Organization

```
frontend/components/
├── ui/                     # Reusable UI Components
│   ├── Button.tsx          # Button component
│   ├── Card.tsx            # Card component
│   ├── Badge.tsx           # Badge component
│   ├── Table.tsx           # Table components
│   ├── Modal.tsx           # Modal component
│   ├── Tabs.tsx            # Tabs component
│   ├── SearchInput.tsx     # Search input
│   ├── FilterDropdown.tsx  # Multi-select filter
│   ├── Pagination.tsx      # Pagination controls
│   └── Skeleton.tsx        # Loading skeletons
│
├── layout/                 # Layout Components
│   ├── Sidebar.tsx         # Navigation sidebar
│   ├── Header.tsx          # Top header with user menu
│   └── AppLayout.tsx       # Main protected layout
│
├── auth/                   # Authentication Components
│   └── ProtectedRoute.tsx  # Route protection wrapper
│
└── ErrorBoundary.tsx       # Error boundary
```

**Component Hierarchy**:
```
App
└── AuthProvider (contexts/AuthContext.tsx)
    └── RootLayout (app/layout.tsx)
        ├── Public Pages
        │   └── LoginPage (app/login/page.tsx)
        │
        └── Protected Pages
            └── AppLayout (components/layout/AppLayout.tsx)
                ├── Sidebar
                ├── Header
                └── Page Content
                    ├── DashboardPage (app/page.tsx)
                    ├── ApplicantsPage (app/applicants/page.tsx)
                    ├── FellowsPage (app/fellows/page.tsx)
                    └── ... other pages
```

### 1.3 State Flow Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   GLOBAL STATE                          │
│  AuthContext (contexts/AuthContext.tsx)                 │
│  - user: User | null                                    │
│  - isAuthenticated: boolean                             │
│  - login(), logout(), refreshToken()                    │
└─────────────────────────────────────────────────────────┘
                         │
                         │ Consumed by all components via useAuth()
                         ↓
┌─────────────────────────────────────────────────────────┐
│                   PAGE COMPONENTS                       │
│  - Local state (useState)                               │
│  - Data fetching (useEffect + API calls)                │
│  - Computed state (useMemo)                             │
│  - UI interactions                                      │
└─────────────────────────────────────────────────────────┘
                         │
                         │ Props down
                         ↓
┌─────────────────────────────────────────────────────────┐
│                   UI COMPONENTS                         │
│  - Receive data via props                               │
│  - Emit events via callbacks                            │
│  - No direct API calls                                  │
│  - Reusable and composable                              │
└─────────────────────────────────────────────────────────┘
```

**State Management Strategy**:
1. **Global State**: AuthContext for authentication (user, tokens)
2. **Local State**: useState in page components (data, loading, filters)
3. **Computed State**: useMemo for derived data (filtered, paginated)
4. **URL State**: Query parameters for shareable state (future enhancement)

---

## 2. Component Library

### 2.1 Button Component

**File**: `frontend/components/ui/Button.tsx`

```typescript
'use client';

import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  // Base styles
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  // Variant styles
  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
    outline: 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };

  // Size styles
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
      {!loading && icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
};
```

**Usage**:
```typescript
<Button variant="primary" onClick={handleSubmit}>
  Save Changes
</Button>

<Button variant="danger" size="sm" loading={isDeleting}>
  Delete
</Button>

<Button variant="outline" icon={<PlusIcon />}>
  Add Item
</Button>
```

**Features**:
- 4 variants: primary, secondary, outline, danger
- 3 sizes: sm, md, lg
- Loading state with spinner
- Icon support
- Disabled state
- Full TypeScript support
- Extends native button props

---

### 2.2 Card Component

**File**: `frontend/components/ui/Card.tsx`

```typescript
'use client';

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = true,
  onClick
}) => {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow-sm ${
        padding ? 'p-6' : ''
      } ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, className = '' }) => {
  return <div className={`mb-4 ${className}`}>{children}</div>;
};

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const CardTitle: React.FC<CardTitleProps> = ({ children, className = '' }) => {
  return <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>{children}</h3>;
};

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export const CardContent: React.FC<CardContentProps> = ({ children, className = '' }) => {
  return <div className={className}>{children}</div>;
};
```

**Usage**:
```typescript
<Card>
  <CardHeader>
    <CardTitle>User Profile</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Profile information goes here...</p>
  </CardContent>
</Card>

{/* Card without padding */}
<Card padding={false}>
  <CardHeader className="px-6 pt-6">
    <CardTitle>Table Data</CardTitle>
  </CardHeader>
  <CardContent>
    <Table>{/* table content */}</Table>
  </CardContent>
</Card>
```

---

### 2.3 Badge Component

**File**: `frontend/components/ui/Badge.tsx`

```typescript
'use client';

import React from 'react';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  children,
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
export function getStatusBadgeVariant(status: string): BadgeVariant {
  const statusMap: Record<string, BadgeVariant> = {
    // Applicant statuses
    applied: 'info',
    screening: 'warning',
    interview: 'warning',
    accepted: 'success',
    rejected: 'danger',
    waitlisted: 'default',

    // Fellow statuses
    active: 'success',
    completed: 'success',
    dropped: 'danger',
    paused: 'warning',

    // Delivery plan statuses
    draft: 'default',
    // active: 'info', (same as above)
    // completed: 'success', (same as above)
    cancelled: 'danger',

    // Opportunity statuses
    open: 'success',
    closed: 'default',
    filled: 'info',

    // Placement statuses
    matched: 'info',
    // applied: 'warning', (same as applicant)
    interviewing: 'warning',
    offered: 'success',
    // accepted: 'success', (same as above)
    // rejected: 'danger', (same as above)
    declined: 'default',
  };

  return statusMap[status.toLowerCase()] || 'default';
}
```

**Usage**:
```typescript
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="danger">Rejected</Badge>

{/* Dynamic badge based on status */}
<Badge variant={getStatusBadgeVariant(applicant.status)}>
  {applicant.status}
</Badge>
```

---

### 2.4 Table Components

**File**: `frontend/components/ui/Table.tsx`

```typescript
'use client';

import React from 'react';

export const Table: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        {children}
      </table>
    </div>
  );
};

export const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <thead className="bg-gray-50">{children}</thead>;
};

export const TableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>;
};

export const TableRow: React.FC<{ children: React.ReactNode; onClick?: () => void }> = ({
  children,
  onClick,
}) => {
  return (
    <tr
      className={onClick ? 'hover:bg-gray-50 cursor-pointer' : ''}
      onClick={onClick}
    >
      {children}
    </tr>
  );
};

export const TableHead: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return (
    <th
      scope="col"
      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`}
    >
      {children}
    </th>
  );
};

export const TableCell: React.FC<{
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}> = ({ children, className = '', colSpan }) => {
  return (
    <td className={`px-6 py-4 whitespace-nowrap text-sm ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
};
```

**Usage**:
```typescript
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Email</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {applicants.map((applicant) => (
      <TableRow key={applicant.id}>
        <TableCell className="font-medium">{applicant.name}</TableCell>
        <TableCell>{applicant.email}</TableCell>
        <TableCell>
          <Badge variant={getStatusBadgeVariant(applicant.status)}>
            {applicant.status}
          </Badge>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

---

### 2.5 SearchInput Component

**File**: `frontend/components/ui/SearchInput.tsx` (Phase 3)

```typescript
'use client';

import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
}) => {
  return (
    <div className={`relative ${className}`}>
      {/* Search icon */}
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <Search className="h-5 w-5 text-gray-400" />
      </div>

      {/* Input field */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        placeholder={placeholder}
      />

      {/* Clear button */}
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};
```

**Usage**:
```typescript
const [searchQuery, setSearchQuery] = useState('');

<SearchInput
  value={searchQuery}
  onChange={setSearchQuery}
  placeholder="Search by name or email..."
  className="flex-1"
/>
```

**Features**:
- Search icon on left
- Clear button (X) on right (only when value exists)
- Smooth transitions
- Keyboard accessible
- Focus states

---

### 2.6 FilterDropdown Component

**File**: `frontend/components/ui/FilterDropdown.tsx` (Phase 3)

```typescript
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Filter, Check, X } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  label,
  options,
  selected,
  onChange,
  placeholder = 'All',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const clearAll = () => {
    onChange([]);
  };

  const selectedLabels = selected
    .map((val) => options.find((opt) => opt.value === val)?.label)
    .filter(Boolean)
    .join(', ');

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Filter className="h-4 w-4 text-gray-500 mr-2" />
        <span className="text-sm font-medium text-gray-700">{label}:</span>
        <span className="ml-1 text-sm text-gray-600">
          {selected.length > 0 ? selectedLabels : placeholder}
        </span>
        {selected.length > 0 && (
          <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
            {selected.length}
          </span>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">Filter by {label}</span>
            {selected.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Options */}
          <div className="max-h-60 overflow-y-auto">
            {options.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => toggleOption(option.value)}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${
                    isSelected ? 'bg-blue-50' : ''
                  }`}
                >
                  <span className={isSelected ? 'text-blue-600 font-medium' : 'text-gray-700'}>
                    {option.label}
                  </span>
                  {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
```

**Usage**:
```typescript
const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

const statusOptions = [
  { value: 'applied', label: 'Applied' },
  { value: 'screening', label: 'Screening' },
  { value: 'accepted', label: 'Accepted' },
];

<FilterDropdown
  label="Status"
  options={statusOptions}
  selected={selectedStatuses}
  onChange={setSelectedStatuses}
/>
```

**Features**:
- Multi-select functionality
- Visual checkmarks for selected items
- "Clear all" button
- Badge showing count of selected items
- Click-outside-to-close
- Keyboard accessible
- Highlighted selected items

---

### 2.7 Pagination Component

**File**: `frontend/components/ui/Pagination.tsx` (Phase 3)

```typescript
'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show subset with ellipsis
      if (currentPage <= 4) {
        // Near start: 1 2 3 4 5 ... 10
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        // Near end: 1 ... 6 7 8 9 10
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        // Middle: 1 ... 4 5 6 ... 10
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 sm:px-6">
      {/* Results summary */}
      <div className="flex flex-1 items-center space-x-4">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{startItem}</span> to{' '}
          <span className="font-medium">{endItem}</span> of{' '}
          <span className="font-medium">{totalItems}</span> results
        </div>

        {/* Items per page selector */}
        {onItemsPerPageChange && (
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
        )}
      </div>

      {/* Page navigation */}
      <div className="flex items-center space-x-2">
        {/* Previous button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Page numbers */}
        {getPageNumbers().map((page, index) => {
          if (page === '...') {
            return (
              <span key={`ellipsis-${index}`} className="px-3 py-2 text-sm text-gray-700">
                ...
              </span>
            );
          }

          return (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              className={`px-3 py-2 text-sm font-medium rounded-md ${
                currentPage === page
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {page}
            </button>
          );
        })}

        {/* Next button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
```

**Usage**:
```typescript
const [currentPage, setCurrentPage] = useState(1);
const [itemsPerPage, setItemsPerPage] = useState(10);
const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

<Pagination
  currentPage={currentPage}
  totalPages={totalPages}
  totalItems={filteredItems.length}
  itemsPerPage={itemsPerPage}
  onPageChange={setCurrentPage}
  onItemsPerPageChange={setItemsPerPage}
/>
```

**Features**:
- Previous/Next buttons
- Page number buttons
- Smart ellipsis for many pages
- Items per page selector
- Results summary
- Disabled state for first/last page
- Responsive design

---

### 2.8 Skeleton Loading Components

**File**: `frontend/components/ui/Skeleton.tsx` (Phase 3)

```typescript
'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 6,
}) => {
  return (
    <div className="space-y-3 p-6">
      {/* Header row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-8" />
        ))}
      </div>

      {/* Data rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} className="h-12" />
          ))}
        </div>
      ))}
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex space-x-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
};

export const StatCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center">
        <Skeleton className="h-12 w-12 rounded-lg" />
        <div className="ml-4 flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
    </div>
  );
};
```

**Usage**:
```typescript
if (loading) {
  return <TableSkeleton rows={10} columns={7} />;
}

if (loading) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
  );
}
```

**Features**:
- Smooth pulse animation
- Multiple variants (table, card, stat card)
- Customizable rows/columns
- Prevents layout shift
- Better UX than spinners

---

## 3. Page Components

### 3.1 Dashboard Page

**File**: `frontend/app/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Users, UserCheck, Calendar, TrendingUp } from 'lucide-react';

interface Stats {
  totalApplicants: number;
  acceptedApplicants: number;
  activeFellows: number;
  activePlacements: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalApplicants: 0,
    acceptedApplicants: 0,
    activeFellows: 0,
    activePlacements: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // Fetch stats from API
      // const response = await applicantsAPI.stats();
      // setStats(response.data);

      // Mock data for now
      setStats({
        totalApplicants: 127,
        acceptedApplicants: 34,
        activeFellows: 28,
        activePlacements: 15,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Applicants',
      value: stats.totalApplicants,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Accepted',
      value: stats.acceptedApplicants,
      icon: UserCheck,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Active Fellows',
      value: stats.activeFellows,
      icon: Calendar,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Placements',
      value: stats.activePlacements,
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Welcome to MentorLed AI-Ops Platform
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <div className="flex items-center">
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {loading ? '...' : stat.value}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Recent activity */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Recent Activity
          </h2>
          <p className="text-gray-600">
            Recent activities will be displayed here...
          </p>
        </Card>
      </div>
    </AppLayout>
  );
}
```

**Key Patterns**:
1. **Wrapped in AppLayout**: Provides sidebar, header, auth protection
2. **Local state**: Stats, loading state
3. **useEffect**: Fetch data on mount
4. **Grid layout**: Responsive stats cards
5. **Icon integration**: Lucide React icons

---

### 3.2 Applicants Page (With Search, Filters, Pagination)

**File**: `frontend/app/applicants/page.tsx` (Phase 3 - Complete implementation)

**Component Structure**:
```typescript
ApplicantsPage
└── ErrorBoundary
    └── ApplicantsPageContent
        └── AppLayout
            ├── Page Header
            ├── Search & Filters Row
            │   ├── SearchInput
            │   ├── FilterDropdown (Status)
            │   └── FilterDropdown (Role)
            ├── Stats Cards (4 cards)
            └── Applicants Table Card
                ├── Table
                │   ├── TableHeader
                │   └── TableBody (paginatedApplicants)
                └── Pagination
```

**State Management**:
```typescript
// Data state
const [applicants, setApplicants] = useState<Applicant[]>([]);
const [loading, setLoading] = useState(true);

// Filter state
const [searchQuery, setSearchQuery] = useState('');
const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

// Pagination state
const [currentPage, setCurrentPage] = useState(1);
const [itemsPerPage, setItemsPerPage] = useState(10);
```

**Computed State** (useMemo):
```typescript
// Filtered applicants (search + filters)
const filteredApplicants = useMemo(() => {
  let filtered = [...applicants];

  // Search filter
  if (searchQuery) {
    filtered = filtered.filter(
      (app) =>
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Status filter
  if (selectedStatuses.length > 0) {
    filtered = filtered.filter((app) => selectedStatuses.includes(app.status));
  }

  // Role filter
  if (selectedRoles.length > 0) {
    filtered = filtered.filter((app) => selectedRoles.includes(app.role));
  }

  return filtered;
}, [applicants, searchQuery, selectedStatuses, selectedRoles]);

// Paginated applicants (slice filtered results)
const totalPages = Math.ceil(filteredApplicants.length / itemsPerPage);
const paginatedApplicants = useMemo(() => {
  const startIndex = (currentPage - 1) * itemsPerPage;
  return filteredApplicants.slice(startIndex, startIndex + itemsPerPage);
}, [filteredApplicants, currentPage, itemsPerPage]);
```

**Auto-reset Pagination**:
```typescript
// Reset to page 1 when filters change
useEffect(() => {
  setCurrentPage(1);
}, [searchQuery, selectedStatuses, selectedRoles, itemsPerPage]);
```

**Why useMemo?**
- Prevents re-filtering on every render
- Only recalculates when dependencies change
- Performance optimization for large datasets

---

## 4. State Management

### 4.1 Global State (AuthContext)

**File**: `frontend/contexts/AuthContext.tsx`

**Provided Values**:
```typescript
interface AuthContextType {
  user: User | null;              // Current user object
  loading: boolean;               // Initial auth check loading
  login: (email, password) => Promise<void>;
  signup: (email, password, fullName, role?) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
  isAuthenticated: boolean;       // Computed: !!user
}
```

**Usage in Components**:
```typescript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <div>Please log in</div>;
  }

  return (
    <div>
      <p>Welcome, {user.full_name}!</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

**State Initialization** (on app load):
```typescript
useEffect(() => {
  const initializeAuth = async () => {
    const token = getAccessToken();
    if (token) {
      try {
        const response = await axios.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(response.data);
      } catch (error) {
        await refreshAccessToken();
      }
    }
    setLoading(false);
  };

  initializeAuth();
}, []);
```

### 4.2 Local State Patterns

#### Pattern 1: Data Fetching
```typescript
const [data, setData] = useState<T[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await api.getData();
      setData(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, []);
```

#### Pattern 2: Form State
```typescript
const [formData, setFormData] = useState({
  name: '',
  email: '',
  role: 'fellow',
});

const handleChange = (field: string, value: any) => {
  setFormData((prev) => ({
    ...prev,
    [field]: value,
  }));
};

const handleSubmit = async () => {
  await api.create(formData);
};
```

#### Pattern 3: Modal State
```typescript
const [isOpen, setIsOpen] = useState(false);
const [selectedItem, setSelectedItem] = useState<T | null>(null);

const openModal = (item: T) => {
  setSelectedItem(item);
  setIsOpen(true);
};

const closeModal = () => {
  setIsOpen(false);
  setSelectedItem(null);
};
```

#### Pattern 4: Filter/Search State
```typescript
const [filters, setFilters] = useState({
  search: '',
  status: [],
  role: [],
});

const updateFilter = (key: string, value: any) => {
  setFilters((prev) => ({
    ...prev,
    [key]: value,
  }));
};
```

### 4.3 Computed State (useMemo)

**When to use useMemo?**
- Expensive calculations (filtering large arrays)
- Derived data that depends on other state
- Prevent unnecessary re-renders

**Example**:
```typescript
const filteredAndSortedItems = useMemo(() => {
  let result = [...items];

  // Filter
  if (searchQuery) {
    result = result.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Sort
  result.sort((a, b) => a.name.localeCompare(b.name));

  return result;
}, [items, searchQuery]);
```

**Dependencies**:
- Only recalculates when `items` or `searchQuery` change
- Not on every render

### 4.4 Side Effects (useEffect)

**Pattern 1: Fetch on Mount**
```typescript
useEffect(() => {
  fetchData();
}, []); // Empty deps = run once on mount
```

**Pattern 2: Fetch on Prop/State Change**
```typescript
useEffect(() => {
  fetchUser(userId);
}, [userId]); // Re-fetch when userId changes
```

**Pattern 3: Cleanup**
```typescript
useEffect(() => {
  const timer = setInterval(() => {
    fetchLatestData();
  }, 5000);

  // Cleanup on unmount
  return () => clearInterval(timer);
}, []);
```

**Pattern 4: Click Outside Handler**
```typescript
useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (ref.current && !ref.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  }

  if (isOpen) {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }
}, [isOpen]);
```

---

## 5. Data Fetching Patterns

### 5.1 API Client Setup

**File**: `frontend/lib/api.ts`

```typescript
import axios from 'axios';
import { getAccessToken } from '@/contexts/AuthContext';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Request interceptor: Add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// API methods
export const applicantsAPI = {
  list: () => apiClient.get('/api/applicants'),
  get: (id: string) => apiClient.get(`/api/applicants/${id}`),
  create: (data: any) => apiClient.post('/api/applicants', data),
  update: (id: string, data: any) => apiClient.put(`/api/applicants/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/applicants/${id}`),
};

export const fellowsAPI = {
  list: () => apiClient.get('/api/fellows'),
  get: (id: string) => apiClient.get(`/api/fellows/${id}`),
  create: (data: any) => apiClient.post('/api/fellows', data),
  update: (id: string, data: any) => apiClient.put(`/api/fellows/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/fellows/${id}`),
};

export const screeningAPI = {
  screen: (applicantId: string) =>
    apiClient.post(`/api/screening/screen/${applicantId}`),
  results: () => apiClient.get('/api/screening/results'),
};
```

### 5.2 Fetch Pattern in Components

```typescript
const [data, setData] = useState<Applicant[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  fetchApplicants();
}, []);

const fetchApplicants = async () => {
  try {
    setLoading(true);
    setError(null);
    const response = await applicantsAPI.list();
    setData(response.data);
  } catch (err: any) {
    console.error('Error fetching applicants:', err);
    setError(err.response?.data?.detail || 'Failed to fetch applicants');
  } finally {
    setLoading(false);
  }
};
```

### 5.3 Loading States

```typescript
if (loading) {
  return <TableSkeleton rows={10} columns={7} />;
}

if (error) {
  return (
    <div className="text-center py-8 text-red-600">
      Error: {error}
    </div>
  );
}

return <Table>{/* render data */}</Table>;
```

---

## Summary (Part 4)

This part covered **frontend components and state management**:

✅ Frontend architecture (Next.js App Router, component organization)
✅ Complete component library (15+ reusable components)
✅ Page components (Dashboard, Applicants with full features)
✅ State management (AuthContext, local state, useMemo, useEffect)
✅ Data fetching patterns (API client, loading states)
✅ Client-side routing (Next.js conventions)
✅ Tailwind CSS styling patterns

**Next in Part 5**: AI Agents & Workflows
- AI agent architecture
- Screening agent implementation
- Delivery agent implementation
- Placement agent implementation
- Anthropic Claude API integration
- Structured output generation

---

**Navigation**:
- Part 1 - System Overview & Architecture ✓
- Part 2 - Authentication Flow Deep Dive ✓
- Part 3 - Backend APIs & Database ✓
- **Current**: Part 4 - Frontend Components & State Management ✓
- **Next**: Part 5 - AI Agents & Workflows
- Part 6 - Deployment & Production Readiness
