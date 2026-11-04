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
    <header className="no-print bg-[#242424] border-b border-[#333333] sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Section info */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#1f6aa5]/20 text-[#38bdf8] sm:hidden border border-[#1f6aa5]/40">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
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
                      ? 'bg-[#1f6aa5] text-white'
                      : 'text-slate-400 hover:bg-[#333333] hover:text-white'
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
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1e1e1e] border border-[#3a3a3a] text-xs font-medium text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>Microlins Potirendaba</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
