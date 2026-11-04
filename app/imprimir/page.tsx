// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Page: app/imprimir/page.tsx
// Motor de visualização e emissão em massa de fichas A4 (Frente e Verso)
// Suporte nativo ao motor do Excel (Excel.Application COM) via background service
// Estilo: Dark Moderno com Azul (#1f6aa5 / #242424), Impressão em Papel Branco
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
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { useStudents } from '../../lib/hooks/use-students';
import { SheetFrente } from '../../components/print/sheet-frente';
import { SheetVerso } from '../../components/print/sheet-verso';
import { ScheduleDialog } from '../../components/print/schedule-dialog';
import { checkExcelBridge, printViaExcel, type BridgeStatus } from '../../lib/services/excel-bridge-service';
import { downloadFilledModeloFichaXlsx } from '../../lib/excel/modelo-ficha-injector';
import { parseStudentSchedule } from '../../lib/utils/date-utils';
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
    horarioInicio: '',
    horarioFim: '',
    diasSemana: [],
    includeVerso: true,
  });

  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>({ online: false });
  const [isPrintingExcel, setIsPrintingExcel] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Recupera horários configurados vindos da página anterior
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('microlins_schedule_config');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setScheduleConfig((prev) => ({ ...prev, ...parsed }));
        } catch {
          // ignora json inválido
        }
      }
    }
  }, []);

  // Auto-sincroniza horários se houver apenas 1 aluno selecionado e a configuração ainda estiver vazia
  useEffect(() => {
    if (selectedStudents.length === 1) {
      const student = selectedStudents[0];
      const hasDiasConfig = scheduleConfig.diasConfig && Object.keys(scheduleConfig.diasConfig).length > 0;
      const hasDiasSemana = scheduleConfig.diasSemana && scheduleConfig.diasSemana.length > 0;
      if (!hasDiasConfig && !hasDiasSemana && (student.dia_semana || student.horario_inicio)) {
        const studentSchedule = parseStudentSchedule(student);
        setScheduleConfig((prev) => ({
          ...prev,
          ...studentSchedule,
          includeVerso: prev.includeVerso ?? true,
        }));
      }
    }
  }, [selectedStudents]);

  // Verifica status da Bridge do Excel automaticamente em background
  useEffect(() => {
    let isMounted = true;
    checkExcelBridge().then((status) => {
      if (isMounted) {
        setBridgeStatus(status);
      }
    });

    const interval = setInterval(() => {
      checkExcelBridge().then((status) => {
        if (isMounted) {
          setBridgeStatus(status);
        }
      });
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Calcula total de páginas do lote
  const includeVerso = scheduleConfig.includeVerso ?? true;
  const totalPages = selectedStudents.length * (includeVerso ? 2 : 1);

  // Manipulador de impressão nativa via navegador
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // Disparo direto pelo motor do Excel
  const handlePrintExcel = async () => {
    setIsPrintingExcel(true);
    setActionFeedback(null);

    try {
      const result = await printViaExcel(selectedStudents, scheduleConfig, includeVerso);
      setActionFeedback({
        type: 'success',
        message: result.message,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionFeedback({
        type: 'error',
        message: msg,
      });
    } finally {
      setIsPrintingExcel(false);
    }
  };

  // Gera e baixa o próprio ModeloFicha.xlsx original preenchido para cada aluno selecionado
  const handleDownloadXlsx = async () => {
    setActionFeedback(null);
    try {
      for (const student of selectedStudents) {
        await downloadFilledModeloFichaXlsx(student, scheduleConfig);
      }
      setActionFeedback({
        type: 'success',
        message: `${selectedStudents.length} planilha(s) ModeloFicha.xlsx gerada(s) com 100% da formatação original!`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionFeedback({
        type: 'error',
        message: `Erro ao gerar ModeloFicha.xlsx: ${msg}`,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#18181b]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#1f6aa5]" />
          <p className="text-sm font-semibold">Carregando dados dos alunos...</p>
        </div>
      </div>
    );
  }

  if (selectedStudents.length === 0) {
    return (
      <div className="min-h-screen bg-[#18181b] p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-[#242424] rounded-2xl shadow-md border border-[#333333] p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Nenhum aluno selecionado
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Volte à página principal e selecione ao menos um aluno na listagem para emitir a ficha pedagógica.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#1f6aa5] hover:bg-[#1a5c8e] border border-[#2b82c4] transition-all shadow-md"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Listagem de Alunos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#18181b] print:bg-white text-slate-100 print:text-black">
      {/* BARRA DE FERRAMENTAS SUPERIOR (Apenas em tela, oculta na impressão) */}
      <header className="no-print sticky top-0 z-40 bg-[#242424]/95 backdrop-blur-md border-b border-[#333333] shadow-md px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Lado Esquerdo: Voltar e Título */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl border border-[#444444] bg-[#2e2e2e] text-slate-300 hover:text-white hover:bg-[#333333] transition-colors"
              title="Voltar para Alunos"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-white">
                  Impressão de Fichas Pedagógicas
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#1f6aa5]/30 text-[#38bdf8] border border-[#1f6aa5]/50">
                  {selectedStudents.length} aluno(s)
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#333333] text-slate-300 border border-[#444444]">
                  {totalPages} pág. A4
                </span>
                {bridgeStatus.online && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-700/60" title="Assistente local do Excel ativo">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Motor Excel Ativo
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block mt-0.5">
                Dias:{' '}
                {scheduleConfig.diasSemana && scheduleConfig.diasSemana.length > 0
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
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-[#444444] bg-[#2e2e2e] hover:bg-[#383838] text-slate-200 transition-all shadow-xs"
            >
              <Settings2 className="w-4 h-4 text-[#38bdf8]" />
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
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shadow-xs ${
                includeVerso
                  ? 'border-[#1f6aa5] bg-[#1f6aa5]/30 text-[#38bdf8]'
                  : 'border-[#444444] bg-[#2e2e2e] text-slate-400 hover:bg-[#383838]'
              }`}
              title="Ativar/desativar verso da folha"
            >
              <FileText className="w-4 h-4" />
              <span>{includeVerso ? 'Verso Ativo' : 'Apenas Frente'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadXlsx}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-emerald-700/60 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 transition-all shadow-xs"
              title="Baixar o arquivo ModeloFicha.xlsx original preenchido com os dados do aluno"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Baixar .xlsx</span>
            </button>

            {/* BOTÃO NATIVO EXCEL (Quando o motor estiver ativo no computador) */}
            {bridgeStatus.online ? (
              <button
                type="button"
                onClick={handlePrintExcel}
                disabled={isPrintingExcel}
                className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-all shadow-md active:scale-95 disabled:opacity-60"
                title="Dispara a impressão diretamente no Microsoft Excel local via COM para a impressora padrão"
              >
                {isPrintingExcel ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4" />
                )}
                <span>Imprimir com Excel</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#1f6aa5] hover:bg-[#1a5c8e] border border-[#2b82c4] transition-all shadow-md active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Agora</span>
              </button>
            )}

            {bridgeStatus.online && (
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-[#444444] bg-[#2e2e2e] hover:bg-[#383838] text-slate-300 transition-all shadow-xs"
                title="Imprimir visualização pelo navegador (Chrome/Edge)"
              >
                <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                <span>Navegador</span>
              </button>
            )}
          </div>
        </div>

        {/* FEEDBACK DE DISPARO */}
        {actionFeedback && (
          <div
            className={`max-w-7xl mx-auto mt-2.5 p-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
              actionFeedback.type === 'success'
                ? 'bg-emerald-950/60 text-emerald-200 border border-emerald-800'
                : 'bg-rose-950/60 text-rose-200 border border-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{actionFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="text-slate-400 hover:text-white ml-4 font-bold text-sm"
            >
              ×
            </button>
          </div>
        )}
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
                  <div className="no-print mb-2 flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
                    <span>
                      {student.nome} ({student.matricula}) — Página 1: Frente
                    </span>
                    <span className="text-slate-500">Folha A4 (210 x 297 mm)</span>
                  </div>

                  <div className="shadow-2xl rounded-none print:shadow-none bg-white">
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
                    <div className="no-print mt-6 mb-2 flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
                      <span>
                        {student.nome} ({student.matricula}) — Página 2: Verso
                      </span>
                      <span className="text-slate-500">Folha A4 (210 x 297 mm)</span>
                    </div>

                    <div className="shadow-2xl rounded-none print:shadow-none bg-white">
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
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#18181b]">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-[#1f6aa5]" />
            <p className="text-sm font-semibold">Carregando módulo de impressão...</p>
          </div>
        </div>
      }
    >
      <ImprimirContent />
    </Suspense>
  );
}
