'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  Printer,
  FileSpreadsheet,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { navigationItems } from './sidebar';

export function Header() {
  const pathname = usePathname();

  const currentItem = navigationItems.find(
    (item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
  ) || navigationItems[0];

  return (
    <header className="no-print bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Section info */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-[#0f3b7d] sm:hidden">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                {currentItem.label}
              </h2>
            </div>
          </div>

          {/* Quick Nav for Mobile or Tablet */}
          <div className="flex items-center gap-2 sm:hidden">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`p-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[#0f3b7d] text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title={item.label}
                >
                  <Icon className="w-4 h-4" />
                </Link>
              );
            })}
          </div>

          {/* Institutional Badge */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
              <Sparkles className="w-3.5 h-3.5 text-[#0f3b7d]" />
              <span>Microlins Potirendaba</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
