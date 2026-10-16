// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Component: components/print/schedule-dialog.tsx
// Quadro de horários da ficha com preenchimento manual por dia da semana
// ==============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Printer,
  X,
  FileCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { formatTime } from '../../lib/utils/date-utils';
import type { ScheduleConfig } from '../../types/database';

export const WEEKDAYS = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo',
] as const;

export type WeekdayName = (typeof WEEKDAYS)[number];

export interface DaySchedule {
  inicio: string;
  fim: string;
}

export interface ScheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: ScheduleConfig) => void;
  initialConfig?: Partial<ScheduleConfig>;
  selectedStudentsCount?: number;
}

const DEFAULT_DAYS_STATE: Record<WeekdayName, DaySchedule> = {
  'Segunda-feira': { inicio: '', fim: '' },
  'Terça-feira': { inicio: '', fim: '' },
  'Quarta-feira': { inicio: '', fim: '' },
  'Quinta-feira': { inicio: '', fim: '' },
  'Sexta-feira': { inicio: '', fim: '' },
  'Sábado': { inicio: '', fim: '' },
  'Domingo': { inicio: '', fim: '' },
};

export function ScheduleDialog({
  isOpen,
  onClose,
  onConfirm,
  initialConfig,
  selectedStudentsCount,
}: ScheduleDialogProps) {
  const [diasHorarios, setDiasHorarios] = useState<Record<WeekdayName, DaySchedule>>(() => ({
    ...DEFAULT_DAYS_STATE,
    'Segunda-feira': { inicio: '14h00', fim: '16h00' },
    'Quarta-feira': { inicio: '14h00', fim: '16h00' },
  }));

  const [includeVerso, setIncludeVerso] = useState<boolean>(
    initialConfig?.includeVerso ?? true
  );

  // Sincroniza estado quando o modal abre com initialConfig
  useEffect(() => {
    if (!isOpen) return;

    if (initialConfig?.includeVerso !== undefined) {
      setIncludeVerso(initialConfig.includeVerso);
    }

    if (initialConfig?.diasConfig && Object.keys(initialConfig.diasConfig).length > 0) {
      const next: Record<WeekdayName, DaySchedule> = { ...DEFAULT_DAYS_STATE };
      for (const d of WEEKDAYS) {
        if (initialConfig.diasConfig[d]) {
          next[d] = {
            inicio: initialConfig.diasConfig[d].inicio || '',
            fim: initialConfig.diasConfig[d].fim || '',
          };
        }
      }
      setDiasHorarios(next);
    } else if (initialConfig?.diasSemana && initialConfig.diasSemana.length > 0) {
      const next: Record<WeekdayName, DaySchedule> = { ...DEFAULT_DAYS_STATE };
      const defaultInicio = initialConfig.horarioInicio || '14h00';
      const defaultFim = initialConfig.horarioFim || '16h00';
      for (const d of initialConfig.diasSemana) {
        if (d in next) {
          next[d as WeekdayName] = {
            inicio: defaultInicio,
            fim: defaultFim,
          };
        }
      }
      setDiasHorarios(next);
    }
  }, [isOpen, initialConfig]);

  if (!isOpen) return null;

  const handleTimeChange = (dia: WeekdayName, field: 'inicio' | 'fim', value: string) => {
    setDiasHorarios((prev) => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        [field]: value,
      },
    }));
  };

  const handleTimeBlur = (dia: WeekdayName, field: 'inicio' | 'fim') => {
    setDiasHorarios((prev) => {
      const current = prev[dia][field];
      return {
        ...prev,
        [dia]: {
          ...prev[dia],
          [field]: formatTime(current),
        },
      };
    });
  };

  const handleClearDay = (dia: WeekdayName) => {
    setDiasHorarios((prev) => ({
      ...prev,
      [dia]: { inicio: '', fim: '' },
    }));
  };

  const handleClearAll = () => {
    setDiasHorarios({ ...DEFAULT_DAYS_STATE });
  };

  const handleQuickFillSegQua = () => {
    setDiasHorarios((prev) => ({
      ...prev,
      'Segunda-feira': { inicio: '14h00', fim: '16h00' },
      'Quarta-feira': { inicio: '14h00', fim: '16h00' },
    }));
  };

  const handleConfirm = () => {
    const diasConfig: Record<string, { inicio: string; fim: string }> = {};
    const activeDays: string[] = [];

    for (const dia of WEEKDAYS) {
      const ini = formatTime(diasHorarios[dia].inicio);
      const fim = formatTime(diasHorarios[dia].fim);

      if (ini || fim) {
        diasConfig[dia] = { inicio: ini, fim: fim };
        activeDays.push(dia);
      }
    }

    const firstActiveDay = activeDays.length > 0 ? diasConfig[activeDays[0]] : null;
    const fallbackInicio = firstActiveDay ? firstActiveDay.inicio : '';
    const fallbackFim = firstActiveDay ? firstActiveDay.fim : '';

    const config: ScheduleConfig = {
      horarioInicio: fallbackInicio,
      horarioFim: fallbackFim,
      diasSemana: activeDays,
      includeVerso,
      diasConfig,
    };

    onConfirm(config);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-linear-to-r from-[#0f3b7d] to-[#1e54a4] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h2 className="text-base font-bold">Quadro de Horários da Ficha</h2>
              <p className="text-xs text-blue-200">
                {selectedStudentsCount !== undefined
                  ? `Preencha os horários para ${selectedStudentsCount} aluno(s) selecionado(s)`
                  : 'Preencha os horários para cada dia da semana (Ex: 14h00 às 16h00)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm text-slate-700">
          {/* Instruções e Ações Rápidas */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <p className="text-xs text-slate-500">
              Digite o horário de início e fim dos dias em que há aula:
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleQuickFillSegQua}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg text-[#0f3b7d] bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                title="Preencher Segunda e Quarta das 14h às 16h"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Seg/Qua 14h-16h</span>
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                title="Limpar todos os horários preenchidos"
              >
                <RotateCcw className="w-3 h-3 text-slate-500" />
                <span>Limpar Todos</span>
              </button>
            </div>
          </div>

          {/* Quadro de Horários (7 Dias) */}
          <div className="bg-slate-50/70 rounded-xl border border-slate-200/90 divide-y divide-slate-200/70 p-1 sm:p-2">
            {WEEKDAYS.map((dia) => {
              const current = diasHorarios[dia];
              const isFilled = Boolean(current.inicio || current.fim);
              const isWeekend = dia === 'Sábado' || dia === 'Domingo';

              return (
                <div
                  key={dia}
                  className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-2.5 rounded-lg transition-colors ${
                    isFilled ? 'bg-blue-50/50' : 'hover:bg-slate-100/50'
                  }`}
                >
                  {/* Nome do Dia */}
                  <div className="w-32 sm:w-36 shrink-0 flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isFilled ? 'bg-[#0f3b7d]' : 'bg-slate-300'
                      }`}
                    />
                    <span
                      className={`text-xs font-semibold ${
                        isFilled
                          ? 'text-[#0f3b7d]'
                          : isWeekend
                          ? 'text-slate-500'
                          : 'text-slate-800'
                      }`}
                    >
                      {dia}
                    </span>
                  </div>

                  {/* Campos de Horário */}
                  <div className="flex items-center gap-2 flex-1 max-w-sm">
                    <div className="relative flex-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={current.inicio}
                        onChange={(e) => handleTimeChange(dia, 'inicio', e.target.value)}
                        onBlur={() => handleTimeBlur(dia, 'inicio')}
                        placeholder="14h00"
                        className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] bg-white font-mono text-slate-900"
                      />
                    </div>

                    <span className="text-xs text-slate-400 font-medium px-1">às</span>

                    <div className="relative flex-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={current.fim}
                        onChange={(e) => handleTimeChange(dia, 'fim', e.target.value)}
                        onBlur={() => handleTimeBlur(dia, 'fim')}
                        placeholder="16h00"
                        className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] bg-white font-mono text-slate-900"
                      />
                    </div>

                    {/* Botão limpar dia individual */}
                    {isFilled ? (
                      <button
                        type="button"
                        onClick={() => handleClearDay(dia)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title={`Limpar horário de ${dia}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <div className="w-6.5" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-400">
            * Dias deixados em branco não terão horário impresso na ficha (ficam disponíveis para anotação manual).
          </p>

          {/* Opção Verso */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0f3b7d] flex items-center justify-center">
                <FileCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-800 block">
                  Incluir Verso da Ficha (Página 2)
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Tabela de desempenho, revisões/reposições e 12 linhas pautadas
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              id="includeVerso"
              checked={includeVerso}
              onChange={(e) => setIncludeVerso(e.target.checked)}
              className="w-4 h-4 text-[#0f3b7d] rounded-sm border-slate-300 focus:ring-[#0f3b7d] cursor-pointer"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-[#0f3b7d] hover:bg-[#0a2e68] transition-all shadow-xs"
          >
            <Printer className="w-4 h-4" />
            Confirmar e Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
