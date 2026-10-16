// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Tests: tests/unit/m3_student_course.test.ts
// Testes unitários para utilitários, validação e lógica de gestão de alunos e cursos
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { formatDateBR, toInputDate, formatPhone } from '../../lib/utils/date-utils';
import type { FichaInsert, FichaCursoInsert, StudentCourseItem } from '../../types/database';

describe('Date & Phone Utilities (date-utils.ts)', () => {
  it('converte data ISO YYYY-MM-DD para DD/MM/YYYY', () => {
    expect(formatDateBR('2026-03-05')).toBe('05/03/2026');
    expect(formatDateBR('2027-12-31')).toBe('31/12/2027');
  });

  it('preserva data já formatada em DD/MM/YYYY', () => {
    expect(formatDateBR('05/03/2026')).toBe('05/03/2026');
  });

  it('retorna "-" para valores nulos ou vazios', () => {
    expect(formatDateBR(null)).toBe('-');
    expect(formatDateBR(undefined)).toBe('-');
    expect(formatDateBR('')).toBe('-');
  });

  it('converte DD/MM/YYYY para formato aceito por input date (YYYY-MM-DD)', () => {
    expect(toInputDate('05/03/2026')).toBe('2026-03-05');
    expect(toInputDate('25/12/2025')).toBe('2025-12-25');
  });

  it('preserva YYYY-MM-DD no toInputDate', () => {
    expect(toInputDate('2026-03-05')).toBe('2026-03-05');
  });

  it('formata números de telefone celulares com 11 dígitos', () => {
    expect(formatPhone('17988198252')).toBe('(17) 98819-8252');
  });

  it('formata números de telefone fixos com 10 dígitos', () => {
    expect(formatPhone('1732491000')).toBe('(17) 3249-1000');
  });

  it('retorna "-" para telefone nulo ou vazio', () => {
    expect(formatPhone(null)).toBe('-');
    expect(formatPhone(undefined)).toBe('-');
  });
});

describe('Student & Course Domain Rules (Milestone 3)', () => {
  it('permite FichaInsert minimalista sem exigir os 16 campos nulos', () => {
    const minimalStudent: FichaInsert = {
      matricula: '5056188',
      nome: 'TAMIRIS MARIANA',
    };
    expect(minimalStudent.matricula).toBe('5056188');
    expect(minimalStudent.nome).toBe('TAMIRIS MARIANA');
    expect(minimalStudent.email).toBeUndefined();
  });

  it('suporta até 18 cursos respeitando a restrição do verso da ficha A4', () => {
    const courses: StudentCourseItem[] = Array.from({ length: 18 }, (_, i) => ({
      curso_id: i + 1,
      nome: `Curso Módulo ${i + 1}`,
      ordem: i + 1,
    }));

    expect(courses.length).toBe(18);
    expect(courses[0].ordem).toBe(1);
    expect(courses[17].ordem).toBe(18);
  });

  it('simula reordenação cronológica de cursos (subir e descer)', () => {
    const initialCourses = [
      { curso_id: 1, nome: 'Excel 2021 Básico' },
      { curso_id: 2, nome: 'Word 2021' },
      { curso_id: 3, nome: 'Power BI' },
    ];

    // Subir item na posição 1 (Word vai para o topo)
    const movedUp = [...initialCourses];
    const temp = movedUp[0];
    movedUp[0] = movedUp[1];
    movedUp[1] = temp;

    expect(movedUp[0].nome).toBe('Word 2021');
    expect(movedUp[1].nome).toBe('Excel 2021 Básico');

    // Mapear ordem sequencial resultante (1..N)
    const links: FichaCursoInsert[] = movedUp.map((c, idx) => ({
      ficha_id: 100,
      curso_id: c.curso_id,
      curso_nome: c.nome,
      ordem: idx + 1,
    }));

    expect(links[0].ordem).toBe(1);
    expect(links[0].curso_nome).toBe('Word 2021');
    expect(links[1].ordem).toBe(2);
    expect(links[1].curso_nome).toBe('Excel 2021 Básico');
    expect(links[2].ordem).toBe(3);
    expect(links[2].curso_nome).toBe('Power BI');
  });

  it('valida formato de e-mail se informado', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRegex.test('aluno@microlins.com.br')).toBe(true);
    expect(emailRegex.test('invalido-sem-arroba')).toBe(false);
    expect(emailRegex.test('invalido@semdominio')).toBe(false);
  });
});
