// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Component: components/print/schedule-dialog.tsx
// Quadro de horários da ficha com preenchimento ágil no visual escuro com azul (img1)
// ==============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import {
  Printer,
  X,
  FileCheck,
  RotateCcw,
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
  initialConfig?: Partial<ScheduleConfig> | null;
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
  }));

  const [includeVerso, setIncludeVerso] = useState<boolean>(
    initialConfig?.includeVerso ?? true
  );

  // Sincroniza estado quando o modal abre com initialConfig (carregamento automático do aluno)
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
            inicio: formatTime(initialConfig.diasConfig[d].inicio || ''),
            fim: formatTime(initialConfig.diasConfig[d].fim || ''),
          };
        }
      }
      setDiasHorarios(next);
    } else if (initialConfig?.diasSemana && initialConfig.diasSemana.length > 0) {
      const next: Record<WeekdayName, DaySchedule> = { ...DEFAULT_DAYS_STATE };
      const defaultInicio = formatTime(initialConfig.horarioInicio || '');
      const defaultFim = formatTime(initialConfig.horarioFim || '');
      for (const d of initialConfig.diasSemana) {
        if (d in next) {
          next[d as WeekdayName] = {
            inicio: defaultInicio,
            fim: defaultFim,
          };
        }
      }
      setDiasHorarios(next);
    } else {
      setDiasHorarios({ ...DEFAULT_DAYS_STATE });
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
      if (!current) return prev;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#242424] text-white rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md p-6 space-y-4 animate-in zoom-in-95">
        {/* Header do Diálogo (Estilo Imagem 1) */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#1f6aa5] flex items-center justify-center text-white text-[11px] font-bold shadow-xs">
              <Printer className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-sm font-bold text-white tracking-wide">
              Horários para Impressão
            </h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Subtítulo Instrutivo */}
        <div className="text-center space-y-0.5">
          <p className="text-xs font-bold text-slate-100">
            {selectedStudentsCount !== undefined
              ? `Preencha os horários para ${selectedStudentsCount} aluno(s) selecionado(s):`
              : 'Preencha os horários nos dias desejados:'}
          </p>
          <p className="text-[11px] text-slate-400">
            (Ex: 14h00 às 16h00)
          </p>
        </div>

        {/* Linhas dos 7 Dias da Semana (Estilo Exato da Imagem 1) */}
        <div className="space-y-2 py-1">
          {WEEKDAYS.map((dia) => {
            const current = diasHorarios[dia];
            const isFilled = Boolean(current.inicio || current.fim);

            return (
              <div key={dia} className="flex items-center justify-between gap-2 text-xs">
                <span className="w-28 text-slate-200 font-medium truncate">{dia}</span>
                <input
                  type="text"
                  value={current.inicio}
                  onChange={(e) => handleTimeChange(dia, 'inicio', e.target.value)}
                  onBlur={() => handleTimeBlur(dia, 'inicio')}
                  placeholder="14h00"
                  className="w-20 px-2 py-1 bg-[#333333] border border-slate-600 rounded-lg text-white text-center text-xs focus:outline-none focus:border-blue-400 font-mono"
                />
                <span className="text-slate-400 text-xs">às</span>
                <input
                  type="text"
                  value={current.fim}
                  onChange={(e) => handleTimeChange(dia, 'fim', e.target.value)}
                  onBlur={() => handleTimeBlur(dia, 'fim')}
                  placeholder="16h00"
                  className="w-20 px-2 py-1 bg-[#333333] border border-slate-600 rounded-lg text-white text-center text-xs focus:outline-none focus:border-blue-400 font-mono"
                />
                {isFilled ? (
                  <button
                    type="button"
                    onClick={() => handleClearDay(dia)}
                    className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                    title={`Limpar horário de ${dia}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <div className="w-5" />
                )}
              </div>
            );
          })}
        </div>

        {/* Opção de Impressão do Verso da Ficha */}
        <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between bg-[#2a2a2a] p-2.5 rounded-xl border border-slate-700">
          <label
            htmlFor="include-verso-checkbox"
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <FileCheck className="w-4 h-4 text-[#38bdf8] shrink-0" />
            <div>
              <span className="text-xs font-semibold text-slate-200 block">
                Incluir Verso da Ficha (Página 2)
              </span>
              <span className="text-[10px] text-slate-400 block">
                Tabela de desempenho, revisões e pautas
              </span>
            </div>
          </label>
          <input
            id="include-verso-checkbox"
            type="checkbox"
            checked={includeVerso}
            onChange={(e) => setIncludeVerso(e.target.checked)}
            className="w-4 h-4 text-[#1f6aa5] rounded border-slate-600 bg-[#333333] focus:ring-[#1f6aa5] accent-[#1f6aa5]"
          />
        </div>

        {/* Rodapé com Botões de Ação */}
        <div className="pt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleClearAll}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
            title="Limpar todos os horários preenchidos"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpar</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#1f6aa5] hover:bg-[#154f78] rounded-xl shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Confirmar e Imprimir</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
