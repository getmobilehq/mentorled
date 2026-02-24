'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  TrendingUp,
  Briefcase,
  Settings,
  Shield,
  Target,
  Activity,
  AlertTriangle,
  BarChart3,
  Layers,
  Flag,
  Calendar,
  Mail,
  Repeat,
  UserCheck,
  Home,
  CheckSquare,
  Clock,
  Bell,
  FileText,
  ScrollText,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const adminNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Cohorts', href: '/cohorts', icon: Calendar },
  { name: 'Screening', href: '/screening', icon: ClipboardCheck },
  { name: 'Applicants', href: '/applicants', icon: Users },
  { name: 'Challenges', href: '/challenges', icon: Flag },
  { name: 'Microship', href: '/microship', icon: Target },
  { name: 'Fellows', href: '/fellows', icon: TrendingUp },
  { name: 'Teams', href: '/teams', icon: UserCheck },
  { name: 'Sprint Board', href: '/sprints', icon: Repeat },
  { name: 'Check-ins', href: '/check-ins', icon: Activity },
  { name: 'Risk Dashboard', href: '/risk', icon: AlertTriangle },
  { name: 'Delivery', href: '/delivery', icon: Shield },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Bulk Operations', href: '/bulk-operations', icon: Layers },
  { name: 'Placement', href: '/placement', icon: Briefcase },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Audit Log', href: '/audit-log', icon: ScrollText },
  { name: 'Email Templates', href: '/email-templates', icon: Mail },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const portalNavigation: NavItem[] = [
  { name: 'My Portal', href: '/portal', icon: Home },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const mentorNavigation: NavItem[] = [
  { name: 'My Teams', href: '/mentor', icon: UserCheck },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onMobileClose }) => {
  const pathname = usePathname();
  const { user } = useAuth();

  const navigation = user?.role === 'viewer' ? portalNavigation : user?.role === 'reviewer' ? mentorNavigation : adminNavigation;

  const isActive = (href: string) => {
    if (href === '/' || href === '/portal') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <div className="flex h-full w-64 flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700">
        <Image
          src="/Logo.svg"
          alt="MentorLed"
          width={140}
          height={24}
          priority
        />
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto" aria-label="Main navigation">
        {navigation.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onMobileClose}
              className={`
                group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150
                ${
                  active
                    ? 'bg-green-50 text-green-700 shadow-sm dark:bg-green-900/30 dark:text-green-400'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                }
              `}
            >
              <item.icon
                className={`
                  mr-3 h-5 w-5 flex-shrink-0
                  ${active ? 'text-green-600 dark:text-green-400' : 'text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-200'}
                `}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <p className="font-medium">AI-Ops Platform v1.0</p>
          <p className="mt-1">Powered by Claude</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-screen flex-shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={onMobileClose} />
          <div className="fixed inset-y-0 left-0 z-50 flex">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
