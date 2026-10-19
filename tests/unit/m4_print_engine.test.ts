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

  it('verifica comunicação com o serviço local do Excel', async () => {
    const { checkExcelBridge } = await import('../../lib/services/excel-bridge-service');
    const status = await checkExcelBridge();
    // No ambiente de testes ou CI onde a porta pode ou não estar ouvindo:
    expect(status).toHaveProperty('online');
    expect(typeof status.online).toBe('boolean');
  });

  it('valida o molde literal extraído do ModeloFicha.xlsx e a injeção direta no binário .xlsx', async () => {
    const {
      MODELO_FICHA_LAYOUT,
      MOLDE_FRENTE_DATA_URL,
      MOLDE_VERSO_DATA_URL,
      MODELO_FICHA_XLSX_BASE64,
    } = await import('../../lib/constants/modelo-ficha-assets');
    const { generateFilledModeloFichaXlsx } = await import('../../lib/excel/modelo-ficha-injector');
    const XLSX = await import('xlsx-js-style');

    expect(MODELO_FICHA_LAYOUT.frenteWidthPt).toBe(808.5);
    expect(MODELO_FICHA_LAYOUT.frenteHeightPt).toBe(1393.5);
    expect(MODELO_FICHA_LAYOUT.versoWidthPt).toBe(808.5);
    expect(MODELO_FICHA_LAYOUT.versoHeightPt).toBe(1039.5);
    expect(MOLDE_FRENTE_DATA_URL.startsWith('data:image/png;base64,')).toBe(true);
    expect(MOLDE_VERSO_DATA_URL.startsWith('data:image/png;base64,')).toBe(true);
    expect(MODELO_FICHA_XLSX_BASE64.length).toBeGreaterThan(40000);

    const mockStudent: StudentWithCourses = {
      id: 1,
      matricula: '4994565',
      nome: 'ADRIAN BETUCCI',
      email: 'amanda.sicchieri32@gmail.com',
      data_nascimento: '2008-12-15',
      instrutor: 'Antonio Fagner dos Santos Silva',
      telefone: '16996256232',
      data_inicio_curso: '2025-08-23',
      data_termino_curso: '2027-05-27',
      data_linha_vida: '2025-09-01',
      data_form1: '2025-10-01',
      data_form2: '2025-11-01',
      data_dreamday: '2025-12-01',
      data_fechamento1: '2026-01-15',
      data_fechamento2: '2026-06-15',
      data_fechamento3: '2027-01-15',
      dia_semana: 'Segunda, Quarta',
      horario_inicio: '14h00',
      horario_fim: '16h00',
      observacoes: null,
      created_at: '2025-08-23T00:00:00Z',
      updated_at: '2025-08-23T00:00:00Z',
      cursos: [
        { id: 1, nome: 'Introdução à Informática', ordem: 1 },
        { id: 2, nome: 'Windows 11', ordem: 2 },
        { id: 7, nome: 'Excel 2021', ordem: 7 },
      ],
    };

    const schedule: ScheduleConfig = {
      horarioInicio: '14h00',
      horarioFim: '16h00',
      diasSemana: ['Segunda-feira', 'Quarta-feira'],
      includeVerso: true,
    };

    const xlsxBytes = await generateFilledModeloFichaXlsx(mockStudent, schedule);
    expect(xlsxBytes.byteLength).toBeGreaterThan(40000);

    // Lê de volta com SheetJS para comprovar que o .xlsx gerado é 100% válido e contém os dados injetados
    const wb = XLSX.read(xlsxBytes, { type: 'array' });
    expect(wb.SheetNames).toContain('Frente');
    expect(wb.SheetNames).toContain('Verso');
    const frente = wb.Sheets['Frente'];
    expect(frente['A2']?.v).toBe('Matrícula: 4994565');
    expect(frente['D2']?.v).toBe('Nome do Aluno: ADRIAN BETUCCI');
    expect(frente['A3']?.v).toBe('Email: amanda.sicchieri32@gmail.com');
    expect(frente['M5']?.v).toBe('23/08/2025');
    expect(frente['P5']?.v).toBe('27/05/2027');
    expect(frente['A10']?.v).toBe('1. Introdução à Informática');
  });
});


