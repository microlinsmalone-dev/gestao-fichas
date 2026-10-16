// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Page: app/imprimir/page.tsx
// Motor de visualização e emissão em massa de fichas A4 (Frente e Verso)
// ==============================================================================

'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Printer,
  Calendar,
  Clock,
  ArrowLeft,
  FileText,
  Settings2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useStudents } from '../../lib/hooks/use-students';
import { SheetFrente } from '../../components/print/sheet-frente';
import { SheetVerso } from '../../components/print/sheet-verso';
import { ScheduleDialog } from '../../components/print/schedule-dialog';
import type { StudentWithCourses, ScheduleConfig } from '../../types/database';

function ImprimirContent() {
  const searchParams = useSearchParams();
  const { students, loading } = useStudents();

  // IDs dos alunos vindos da URL (?ids=1,2,3)
  const targetIds = useMemo(() => {
    const rawIds = searchParams.get('ids');
    if (!rawIds) return [];
    return rawIds
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
  }, [searchParams]);

  // Alunos selecionados para impressão
  const selectedStudents = useMemo(() => {
    if (targetIds.length === 0) return [];
    const idSet = new Set(targetIds);
    return students.filter((s) => idSet.has(s.id));
  }, [students, targetIds]);

  // Configuração de horários
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    horarioInicio: '14h00',
    horarioFim: '16h00',
    diasSemana: ['Segunda-feira', 'Quarta-feira'],
    includeVerso: true,
  });

  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  // Calcula total de páginas do lote
  const includeVerso = scheduleConfig.includeVerso ?? true;
  const totalPages = selectedStudents.length * (includeVerso ? 2 : 1);

  // Manipulador de impressão nativa
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-[#0f3b7d]" />
          <p className="text-sm font-semibold">Carregando dados dos alunos...</p>
        </div>
      </div>
    );
  }

  if (selectedStudents.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Nenhum aluno selecionado
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Volte à página principal e selecione ao menos um aluno na listagem para emitir a ficha pedagógica.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#0f3b7d] hover:bg-[#0a2e68] transition-all shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Listagem de Alunos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white text-slate-900">
      {/* BARRA DE FERRAMENTAS SUPERIOR (Apenas em tela, oculta na impressão) */}
      <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Lado Esquerdo: Voltar e Título */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              title="Voltar para Alunos"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Impressão de Fichas Pedagógicas</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#0f3b7d] border border-blue-200/60">
                  {selectedStudents.length} aluno(s)
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {totalPages} pág. A4
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Dias:{' '}
                {scheduleConfig.diasSemana.length > 0
                  ? scheduleConfig.diasSemana.map((d) => d.replace('-feira', '')).join(', ')
                  : 'Nenhum (manual)'}{' '}
                | Horário: {scheduleConfig.horarioInicio || '—'} às{' '}
                {scheduleConfig.horarioFim || '—'}
              </p>
            </div>
          </div>

          {/* Lado Direito: Ações de Configuração e Disparo */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsScheduleOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all shadow-2xs"
            >
              <Settings2 className="w-4 h-4 text-[#0f3b7d]" />
              <span>Configurar Horários</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setScheduleConfig((prev) => ({
                  ...prev,
                  includeVerso: !prev.includeVerso,
                }))
              }
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shadow-2xs ${
                includeVerso
                  ? 'border-blue-200 bg-blue-50/70 text-[#0f3b7d]'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
              title="Ativar/desativar verso da folha"
            >
              <FileText className="w-4 h-4" />
              <span>{includeVerso ? 'Verso Ativo' : 'Apenas Frente'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#0f3b7d] hover:bg-[#0a2e68] transition-all shadow-sm active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Agora</span>
            </button>
          </div>
        </div>
      </header>

      {/* ÁREA DE RENDERIZAÇÃO DAS PÁGINAS A4 */}
      <main className="p-4 sm:p-6 lg:p-8 print:p-0">
        <div className="max-w-[215mm] mx-auto space-y-8 print:space-y-0 print:m-0 print:p-0">
          {selectedStudents.map((student, studentIdx) => {
            const isLastStudent = studentIdx === selectedStudents.length - 1;

            return (
              <React.Fragment key={student.id}>
                {/* PÁGINA 1: FRENTE */}
                <div
                  className={`a4-page-container ${
                    !includeVerso && isLastStudent ? 'a4-page-last' : 'a4-page-break'
                  }`}
                >
                  <div className="no-print mb-2 flex items-center justify-between text-[11px] font-semibold text-slate-500 px-1">
                    <span>
                      {student.nome} ({student.matricula}) — Página 1: Frente
                    </span>
                    <span className="text-slate-400">Folha A4 (210 x 297 mm)</span>
                  </div>

                  <div className="shadow-lg rounded-none print:shadow-none bg-white">
                    <SheetFrente student={student} schedule={scheduleConfig} />
                  </div>
                </div>

                {/* PÁGINA 2: VERSO (Opcional) */}
                {includeVerso && (
                  <div
                    className={`a4-page-container ${
                      isLastStudent ? 'a4-page-last' : 'a4-page-break'
                    }`}
                  >
                    <div className="no-print mt-6 mb-2 flex items-center justify-between text-[11px] font-semibold text-slate-500 px-1">
                      <span>
                        {student.nome} ({student.matricula}) — Página 2: Verso
                      </span>
                      <span className="text-slate-400">Folha A4 (210 x 297 mm)</span>
                    </div>

                    <div className="shadow-lg rounded-none print:shadow-none bg-white">
                      <SheetVerso student={student} />
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </main>

      {/* DIÁLOGO DE CONFIGURAÇÃO DE HORÁRIOS */}
      <ScheduleDialog
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        initialConfig={scheduleConfig}
        selectedStudentsCount={selectedStudents.length}
        onConfirm={(newConfig) => {
          setScheduleConfig(newConfig);
          setIsScheduleOpen(false);
        }}
      />
    </div>
  );
}

export default function ImprimirPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-[#0f3b7d]" />
            <p className="text-sm font-semibold">Carregando módulo de impressão...</p>
          </div>
        </div>
      }
    >
      <ImprimirContent />
    </Suspense>
  );
}
