// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Utilities: lib/utils/date-utils.ts
// Formatação e conversão de datas para padrão brasileiro (DD/MM/YYYY) e ISO (YYYY-MM-DD)
// ==============================================================================

import type React from 'react';

export const BRAZILIAN_WEEKDAYS = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo',
] as const;

export type BrazilianWeekday = (typeof BRAZILIAN_WEEKDAYS)[number];

/**
 * Converte data ISO (YYYY-MM-DD) para formato de exibição brasileiro (DD/MM/YYYY).
 */
export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const clean = dateStr.trim();
  if (!clean) return '-';

  // Se já estiver em DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    return clean;
  }

  // Se for YYYY-MM-DD
  const parts = clean.split('T')[0].split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }

  return clean;
}

/**
 * Converte qualquer formato de data para o padrão aceito por <input type="date"> (YYYY-MM-DD).
 */
export function toInputDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (!clean) return '';

  // Se já for YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // Se for DD/MM/YYYY
  const parts = clean.split('/');
  if (parts.length === 3 && parts[2].length === 4) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Se tiver timestamp ISO
  if (clean.includes('T')) {
    return clean.split('T')[0];
  }

  return clean;
}

/**
 * Formata número de telefone brasileiro: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '-';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '-';
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/**
 * Formata telefone para exibição em ficha impressa (retorna vazio se nulo ou traço)
 */
export function formatPhoneForSheet(phone: string | null | undefined): string {
  if (!phone) return '';
  const formatted = formatPhone(phone);
  return formatted === '-' ? '' : formatted;
}

/**
 * Normaliza horário para formato institucional (ex: '19' -> '19h00', '19:30' -> '19h30', '19h30' -> '19h30', '1930' -> '19h30', '8' -> '08h00')
 */
export function formatTime(t: string | null | undefined): string {
  if (!t) return '';
  const clean = String(t).trim().toLowerCase().replace(/[:.,]/g, 'h');
  if (!clean || clean === 'none' || clean === 'null' || clean === '-' || clean === '—' || clean === 'h') return '';
  if (/^\d+$/.test(clean)) {
    if (clean.length <= 2) {
      return `${clean.padStart(2, '0')}h00`;
    }
    if (clean.length === 4) {
      return `${clean.slice(0, 2)}h${clean.slice(2)}`;
    }
    if (clean.length === 3) {
      return `0${clean.slice(0, 1)}h${clean.slice(1)}`;
    }
  }
  if (clean.includes('h')) {
    const parts = clean.split('h');
    const h = parts[0].trim();
    const m = parts[1].trim() || '00';
    if (/^\d+$/.test(h)) {
      const hPad = h.padStart(2, '0');
      const mPad = /^\d+$/.test(m) ? m.padEnd(2, '0').slice(0, 2) : '00';
      return `${hPad}h${mPad}`;
    }
  }
  return clean;
}

/**
 * Analisa e converte qualquer formato de data colada ou digitada (ex: '02/11/26', '02/11/2026', '02-11-26', '021126')
 * para o formato aceito por campos date/banco (YYYY-MM-DD).
 */
export function parseFlexibleDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const clean = raw.trim();
  if (!clean || clean === '-' || clean === '—') return null;

  // Se já for YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // Se for DD/MM/YYYY ou DD/MM/YY (com barra, hífen ou ponto)
  const parts = clean.split(/[/.-]/).map((p) => p.trim());
  if (parts.length === 3) {
    let [d, m, y] = parts;
    if (d.length === 1) d = '0' + d;
    if (m.length === 1) m = '0' + m;

    // Se o ano tiver 2 dígitos (ex: '26' -> '2026', '99' -> '1999')
    if (y.length === 2 && /^\d{2}$/.test(y)) {
      const numY = parseInt(y, 10);
      y = numY >= 50 ? `19${y}` : `20${y}`;
    }

    if (y.length === 4 && /^\d{4}$/.test(y) && /^\d{2}$/.test(d) && /^\d{2}$/.test(m)) {
      const dayNum = parseInt(d, 10);
      const monthNum = parseInt(m, 10);
      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12) {
        return `${y}-${m}-${d}`;
      }
    }
  }

  // Se forem dígitos corridos: DDMMYY (6 dígitos) ou DDMMYYYY (8 dígitos)
  const digits = clean.replace(/\D/g, '');
  if (digits.length === 6) {
    const d = digits.slice(0, 2);
    const m = digits.slice(2, 4);
    const yNum = parseInt(digits.slice(4, 6), 10);
    const y = yNum >= 50 ? `19${digits.slice(4, 6)}` : `20${digits.slice(4, 6)}`;
    return `${y}-${m}-${d}`;
  }
  if (digits.length === 8) {
    const d = digits.slice(0, 2);
    const m = digits.slice(2, 4);
    const y = digits.slice(4, 8);
    return `${y}-${m}-${d}`;
  }

  return null;
}

/**
 * Handler de evento de colagem (onPaste) para campos de data, permitindo
 * colar diretamente strings como '02/11/26' sem digitar campo a campo.
 */
export function handleDatePaste(
  e: React.ClipboardEvent<HTMLInputElement>,
  onParsedDate: (isoDate: string) => void
): void {
  const text = e.clipboardData?.getData('text');
  if (!text) return;
  const parsed = parseFlexibleDate(text);
  if (parsed) {
    e.preventDefault();
    onParsedDate(parsed);
  }
}

/**
 * Converte data para exibição em ficha impressa (retorna string vazia para nulo/indefinido)
 */
export function formatDateForSheet(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const clean = String(dateStr).trim();
  if (!clean || clean.toLowerCase() === 'none' || clean.toLowerCase() === 'null' || clean === '-' || clean === '—') {
    return '';
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    return clean;
  }
  const parts = clean.split('T')[0].split(' ')[0].split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  return clean;
}

/**
 * Extrai a configuração de horários (ScheduleConfig) a partir dos dados cadastrados de um aluno,
 * interpretando formato JSON do Agendamento Múltiplo ou texto convencional com horários.
 */
export function parseStudentSchedule(student: {
  dia_semana?: string | null;
  horario_inicio?: string | null;
  horario_fim?: string | null;
}): {
  horarioInicio: string;
  horarioFim: string;
  diasSemana: string[];
  diasConfig: Record<string, { inicio: string; fim: string }>;
  includeVerso: boolean;
} {
  const diasConfig: Record<string, { inicio: string; fim: string }> = {};
  const diasSemana: string[] = [];
  let horarioInicio = formatTime(student.horario_inicio || '') || '';
  let horarioFim = formatTime(student.horario_fim || '') || '';

  if (student.dia_semana && student.dia_semana.startsWith('{')) {
    try {
      const obj = JSON.parse(student.dia_semana);
      for (const d of BRAZILIAN_WEEKDAYS) {
        if (obj[d] && (obj[d].inicio || obj[d].fim)) {
          const ini = formatTime(obj[d].inicio || '');
          const fim = formatTime(obj[d].fim || '');
          if (ini || fim) {
            diasConfig[d] = { inicio: ini, fim: fim };
            diasSemana.push(d);
            if (!horarioInicio && ini) horarioInicio = ini;
            if (!horarioFim && fim) horarioFim = fim;
          }
        }
      }
    } catch {
      // Ignora erro de JSON
    }
  } else if (student.dia_semana) {
    const raw = student.dia_semana;
    // Extrai horários embutidos no texto (ex: "08h00 às 10h00" ou "14:00 - 16:00")
    const match = raw.match(/(\d{1,2}(?:[:h]\d{2})?)\s*(?:às|as|-|a)\s*(\d{1,2}(?:[:h]\d{2})?)/i);
    if (match) {
      if (!horarioInicio) horarioInicio = formatTime(match[1]);
      if (!horarioFim) horarioFim = formatTime(match[2]);
    }

    const lower = raw.toLowerCase();
    const dayMatchers: [RegExp, string][] = [
      [/seg/i, 'Segunda-feira'],
      [/ter/i, 'Terça-feira'],
      [/qua/i, 'Quarta-feira'],
      [/qui/i, 'Quinta-feira'],
      [/sex/i, 'Sexta-feira'],
      [/s[áa]b/i, 'Sábado'],
      [/dom/i, 'Domingo'],
    ];

    for (const [pattern, dayName] of dayMatchers) {
      if (pattern.test(lower)) {
        diasSemana.push(dayName);
        diasConfig[dayName] = {
          inicio: horarioInicio,
          fim: horarioFim,
        };
      }
    }
  }

  return {
    horarioInicio,
    horarioFim,
    diasSemana,
    diasConfig,
    includeVerso: true,
  };
}
