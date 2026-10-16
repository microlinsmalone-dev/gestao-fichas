// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Component: components/print/schedule-dialog.tsx
// Diálogo de configuração de horários e dias da semana pré-impressão
// ==============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Printer,
  X,
  FileCheck,
  Check,
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

interface SchedulePreset {
  label: string;
  days: WeekdayName[];
  inicio: string;
  fim: string;
}

const PRESETS: SchedulePreset[] = [
  {
    label: 'Tarde (14h às 16h) - Seg/Qua',
    days: ['Segunda-feira', 'Quarta-feira'],
    inicio: '14h00',
    fim: '16h00',
  },
  {
    label: 'Tarde (16h às 18h) - Seg/Qua',
    days: ['Segunda-feira', 'Quarta-feira'],
    inicio: '16h00',
    fim: '18h00',
  },
  {
    label: 'Manhã (08h às 10h) - Ter/Qui',
    days: ['Terça-feira', 'Quinta-feira'],
    inicio: '08h00',
    fim: '10h00',
  },
  {
    label: 'Manhã (10h às 12h) - Ter/Qui',
    days: ['Terça-feira', 'Quinta-feira'],
    inicio: '10h00',
    fim: '12h00',
  },
  {
    label: 'Noite (19h às 21h) - Ter/Qui',
    days: ['Terça-feira', 'Quinta-feira'],
    inicio: '19h00',
    fim: '21h00',
  },
  {
    label: 'Sábado Manhã (08h às 12h)',
    days: ['Sábado'],
    inicio: '08h00',
    fim: '12h00',
  },
  {
    label: 'Sábado Tarde (13h às 17h)',
    days: ['Sábado'],
    inicio: '13h00',
    fim: '17h00',
  },
];

export interface ScheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: ScheduleConfig) => void;
  initialConfig?: Partial<ScheduleConfig>;
  selectedStudentsCount?: number;
}

export function ScheduleDialog({
  isOpen,
  onClose,
  onConfirm,
  initialConfig,
  selectedStudentsCount,
}: ScheduleDialogProps) {
  const [selectedDays, setSelectedDays] = useState<string[]>(
    initialConfig?.diasSemana || ['Segunda-feira', 'Quarta-feira']
  );
  const [horarioInicio, setHorarioInicio] = useState<string>(
    initialConfig?.horarioInicio || '14h00'
  );
  const [horarioFim, setHorarioFim] = useState<string>(
    initialConfig?.horarioFim || '16h00'
  );
  const [includeVerso, setIncludeVerso] = useState<boolean>(
    initialConfig?.includeVerso ?? true
  );

  // Sincroniza quando reabrir com novas props
  useEffect(() => {
    if (isOpen) {
      if (initialConfig?.diasSemana !== undefined) {
        setSelectedDays(initialConfig.diasSemana);
      }
      if (initialConfig?.horarioInicio !== undefined) {
        setHorarioInicio(initialConfig.horarioInicio);
      }
      if (initialConfig?.horarioFim !== undefined) {
        setHorarioFim(initialConfig.horarioFim);
      }
      if (initialConfig?.includeVerso !== undefined) {
        setIncludeVerso(initialConfig.includeVerso);
      }
    }
  }, [isOpen, initialConfig]);

  if (!isOpen) return null;

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const applyPreset = (preset: SchedulePreset) => {
    setSelectedDays(preset.days);
    setHorarioInicio(preset.inicio);
    setHorarioFim(preset.fim);
  };

  const handleConfirm = () => {
    const formattedInicio = formatTime(horarioInicio);
    const formattedFim = formatTime(horarioFim);

    const config: ScheduleConfig = {
      horarioInicio: formattedInicio,
      horarioFim: formattedFim,
      diasSemana: selectedDays,
      includeVerso,
    };

    onConfirm(config);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-linear-to-r from-[#0f3b7d] to-[#1e54a4] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h2 className="text-base font-bold">Configuração de Horários da Ficha</h2>
              <p className="text-xs text-blue-200">
                {selectedStudentsCount !== undefined
                  ? `Aplicar para ${selectedStudentsCount} aluno(s) selecionado(s)`
                  : 'Defina os dias e horários para impressão'}
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
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
          {/* Presets Rápidos */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Preenchimento Rápido (Turmas Frequentes)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="text-left px-3 py-2 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/60 transition-all text-xs font-medium text-slate-700 flex items-center justify-between group"
                >
                  <span>{p.label}</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-[#0f3b7d]">
                    Usar
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Seleção de Dias da Semana */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Dias da Semana com Aula
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {WEEKDAYS.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#0f3b7d] text-white border-[#0f3b7d] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>{day.replace('-feira', '')}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                );
              })}
            </div>
            {selectedDays.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1.5">
                Nenhum dia selecionado. As linhas de horário na ficha ficarão em branco para preenchimento manual.
              </p>
            )}
          </div>

          {/* Horários */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label
                htmlFor="schedule-start-time"
                className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Horário Inicial
              </label>
              <input
                id="schedule-start-time"
                type="text"
                value={horarioInicio}
                onChange={(e) => setHorarioInicio(e.target.value)}
                onBlur={(e) => setHorarioInicio(formatTime(e.target.value))}
                placeholder="Ex: 14h00 ou 14:00"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] bg-white font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Formata automático: 14 vira 14h00
              </span>
            </div>

            <div>
              <label
                htmlFor="schedule-end-time"
                className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Horário Final
              </label>
              <input
                id="schedule-end-time"
                type="text"
                value={horarioFim}
                onChange={(e) => setHorarioFim(e.target.value)}
                onBlur={(e) => setHorarioFim(formatTime(e.target.value))}
                placeholder="Ex: 16h00 ou 16:00"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-[#0f3b7d] bg-white font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Formata automático: 16 vira 16h00
              </span>
            </div>
          </div>

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
