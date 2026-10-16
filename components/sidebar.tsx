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
  BookOpen,
} from 'lucide-react';

export const navigationItems = [
  {
    label: 'Fichas Pedagógicas',
    href: '/',
    icon: FileText,
    description: 'Gestão cadastral e ciclo pedagógico',
  },
  {
    label: 'Impressão em Massa',
    href: '/imprimir',
    icon: Printer,
    description: 'Emissão A4 Frente e Verso em lote',
  },
  {
    label: 'Catálogo de Cursos',
    href: '/cursos',
    icon: BookOpen,
    description: '105 cursos e módulos pedagógicos',
  },
  {
    label: 'Importar / Exportar',
    href: '/excel',
    icon: FileSpreadsheet,
    description: 'Integração com planilhas Excel',
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="no-print w-64 bg-slate-900 text-slate-100 flex flex-col shrink-0 min-h-screen border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0f3b7d] flex items-center justify-center text-white font-bold shadow-md border border-[#1e54a4]">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-wide text-white">Microlins</h1>
            <p className="text-xs text-slate-400 font-medium">Fichas Pedagógicas</p>
          </div>
        </div>
        <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#d91a2a]/20 text-red-300 border border-red-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          Unidade Potirendaba
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1.5">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
          Módulos do Sistema
        </div>
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-start gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-[#0f3b7d] text-white shadow-md font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <Icon
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  isActive ? 'text-white' : 'text-slate-400'
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="leading-tight">{item.label}</div>
                <div
                  className={`text-[11px] mt-0.5 truncate ${
                    isActive ? 'text-blue-200' : 'text-slate-400'
                  }`}
                >
                  {item.description}
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-400 flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Supabase Online
          </span>
          <span className="text-slate-400">v1.0.0</span>
        </div>
        <div className="text-[10px] text-slate-400">
          Next.js 15 • Static SPA
        </div>
      </div>
    </aside>
  );
}
