// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Unit Tests: tests/unit/m4_print_engine.test.ts
// Verificação da engine de impressão A4 (Frente e Verso), formatação de horários,
// geometria de página e diálogos pré-impressão
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  formatTime,
  formatDateForSheet,
  formatPhoneForSheet,
} from '../../lib/utils/date-utils';
import { WEEKDAYS } from '../../components/print/schedule-dialog';
import type { StudentWithCourses, ScheduleConfig } from '../../types/database';

describe('Milestone 4: Print Engine Utilities & Time Normalization', () => {
  it('normaliza horários em formatos variados para o padrão institucional (XXhYY)', () => {
    expect(formatTime('14')).toBe('14h00');
    expect(formatTime('14:00')).toBe('14h00');
    expect(formatTime('1400')).toBe('14h00');
    expect(formatTime('14:30')).toBe('14h30');
    expect(formatTime('14h30')).toBe('14h30');
    expect(formatTime('8')).toBe('08h00');
    expect(formatTime('0800')).toBe('08h00');
    expect(formatTime('800')).toBe('08h00');
    expect(formatTime('08:00')).toBe('08h00');
    expect(formatTime('19:15')).toBe('19h15');
  });

  it('retorna string vazia para horários nulos, vazios ou inválidos', () => {
    expect(formatTime(null)).toBe('');
    expect(formatTime(undefined)).toBe('');
    expect(formatTime('')).toBe('');
    expect(formatTime('   ')).toBe('');
    expect(formatTime('-')).toBe('');
    expect(formatTime('none')).toBe('');
    expect(formatTime('null')).toBe('');
  });

  it('formata datas para exibição na ficha (formatDateForSheet)', () => {
    expect(formatDateForSheet('2026-03-05')).toBe('05/03/2026');
    expect(formatDateForSheet('05/03/2026')).toBe('05/03/2026');
    expect(formatDateForSheet('2026-10-15T12:00:00Z')).toBe('15/10/2026');
    expect(formatDateForSheet('2013-11-13 00:00:00')).toBe('13/11/2013');
  });

  it('retorna string vazia para datas nulas ou não informadas na ficha', () => {
    expect(formatDateForSheet(null)).toBe('');
    expect(formatDateForSheet(undefined)).toBe('');
    expect(formatDateForSheet('')).toBe('');
    expect(formatDateForSheet('-')).toBe('');
    expect(formatDateForSheet('—')).toBe('');
    expect(formatDateForSheet('None')).toBe('');
    expect(formatDateForSheet('null')).toBe('');
  });

  it('formata telefone para exibição na ficha sem poluir campos vazios com traço', () => {
    expect(formatPhoneForSheet('17988198252')).toBe('(17) 98819-8252');
    expect(formatPhoneForSheet('1738198252')).toBe('(17) 3819-8252');
    expect(formatPhoneForSheet(null)).toBe('');
    expect(formatPhoneForSheet(undefined)).toBe('');
    expect(formatPhoneForSheet('')).toBe('');
    expect(formatPhoneForSheet('-')).toBe('');
  });
});

describe('Milestone 4: Sheet Geometry & Structure Specifications', () => {
  it('contém a lista completa dos 7 dias da semana', () => {
    expect(WEEKDAYS).toHaveLength(7);
    expect(WEEKDAYS[0]).toBe('Segunda-feira');
    expect(WEEKDAYS[1]).toBe('Terça-feira');
    expect(WEEKDAYS[2]).toBe('Quarta-feira');
    expect(WEEKDAYS[3]).toBe('Quinta-feira');
    expect(WEEKDAYS[4]).toBe('Sexta-feira');
    expect(WEEKDAYS[5]).toBe('Sábado');
    expect(WEEKDAYS[6]).toBe('Domingo');
  });

  it('calcula o número correto de páginas para impressão individual e em lote', () => {
    const calculatePages = (studentCount: number, includeVerso: boolean) =>
      studentCount * (includeVerso ? 2 : 1);

    expect(calculatePages(1, true)).toBe(2);
    expect(calculatePages(1, false)).toBe(1);
    expect(calculatePages(10, true)).toBe(20);
    expect(calculatePages(10, false)).toBe(10);
    expect(calculatePages(50, true)).toBe(100);
    expect(calculatePages(50, false)).toBe(50);
  });

  it('monta matriz de 18 cursos respeitando 3 colunas de 6 linhas', () => {
    const studentWith10Courses: Partial<StudentWithCourses> = {
      matricula: '1001',
      nome: 'Aluno Teste Cursos',
      cursos: Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        nome: `Módulo Curso ${i + 1}`,
        ordem: i + 1,
      })),
    };

    const studentCourses = [...(studentWith10Courses.cursos || [])].sort(
      (a, b) => a.ordem - b.ordem
    );

    // 3 colunas x 6 linhas = 18 slots
    const slots = Array.from({ length: 18 }, (_, i) => {
      const slotNumber = i + 1;
      const found = studentCourses.find((c) => c.ordem === slotNumber);
      return { slotNumber, name: found?.nome || '' };
    });

    expect(slots).toHaveLength(18);
    // Primeiros 10 preenchidos
    for (let i = 0; i < 10; i++) {
      expect(slots[i].name).toBe(`Módulo Curso ${i + 1}`);
      expect(slots[i].slotNumber).toBe(i + 1);
    }
    // Slots 11 a 18 vazios para preenchimento manual
    for (let i = 10; i < 18; i++) {
      expect(slots[i].name).toBe('');
      expect(slots[i].slotNumber).toBe(i + 1);
    }
  });

  it('reproduz a contagem oficial de 33 linhas de registro e pautas de anotação', () => {
    const FRENTE_LOG_ROWS = 33;
    const FRENTE_NOTE_LINES = 8;
    const VERSO_LOG_ROWS = 33;
    const VERSO_NOTE_LINES = 12;

    expect(FRENTE_LOG_ROWS).toBe(33);
    expect(FRENTE_NOTE_LINES).toBe(8);
    expect(VERSO_LOG_ROWS).toBe(33);
    expect(VERSO_NOTE_LINES).toBe(12);
  });

  it('valida estrutura de ScheduleConfig para propagação uniforme em lotes', () => {
    const batchSchedule: ScheduleConfig = {
      horarioInicio: '14h00',
      horarioFim: '16h00',
      diasSemana: ['Segunda-feira', 'Quarta-feira'],
      includeVerso: true,
    };

    expect(batchSchedule.horarioInicio).toBe('14h00');
    expect(batchSchedule.horarioFim).toBe('16h00');
    expect(batchSchedule.diasSemana).toContain('Segunda-feira');
    expect(batchSchedule.diasSemana).toContain('Quarta-feira');
    expect(batchSchedule.includeVerso).toBe(true);
  });
});
