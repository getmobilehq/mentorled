'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
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
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Screening', href: '/screening', icon: ClipboardCheck },
  { name: 'Applicants', href: '/applicants', icon: Users },
  { name: 'Microship', href: '/microship', icon: Target },
  { name: 'Fellows', href: '/fellows', icon: TrendingUp },
  { name: 'Check-ins', href: '/check-ins', icon: Activity },
  { name: 'Risk Dashboard', href: '/risk', icon: AlertTriangle },
  { name: 'Delivery', href: '/delivery', icon: Shield },
  { name: 'Placement', href: '/placement', icon: Briefcase },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-screen w-64 flex-col bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-gray-200">
        <Image
          src="/Logo.svg"
          alt="MentorLed"
          width={140}
          height={24}
          priority
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navigation.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150
                ${
                  active
                    ? 'bg-green-50 text-green-700 shadow-sm'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              <item.icon
                className={`
                  mr-3 h-5 w-5 flex-shrink-0
                  ${active ? 'text-green-600' : 'text-gray-500 group-hover:text-gray-700'}
                `}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4">
        <div className="text-xs text-gray-500">
          <p className="font-medium">AI-Ops Platform v1.0</p>
          <p className="mt-1">Powered by Claude</p>
        </div>
      </div>
    </div>
  );
};
