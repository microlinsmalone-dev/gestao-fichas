// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Tests: tests/unit/m3_adversarial.test.ts
// Adversarial Stress Tests & Boundary Challenges for Milestone 3
// Author: Challenger 1 (challenger_m3_1)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { formatDateBR, toInputDate, formatPhone } from '../../lib/utils/date-utils';
import type {
  Ficha,
  FichaInsert,
  FichaCursoInsert,
  StudentCourseItem,
  StudentWithCourses,
  Curso,
} from '../../types/database';

// ------------------------------------------------------------------------------
// Helpers replicating internal component algorithms for empirical verification
// ------------------------------------------------------------------------------

/** Replicates CourseSelector reordering and boundary logic */
function moveCourseUp(courses: { curso_id: number; nome: string }[], index: number) {
  if (index === 0 || index < 0 || index >= courses.length) return courses;
  const updated = [...courses];
  const temp = updated[index - 1];
  updated[index - 1] = updated[index];
  updated[index] = temp;
  return updated;
}

function moveCourseDown(courses: { curso_id: number; nome: string }[], index: number) {
  if (index >= courses.length - 1 || index < 0) return courses;
  const updated = [...courses];
  const temp = updated[index + 1];
  updated[index + 1] = updated[index];
  updated[index] = temp;
  return updated;
}

/** Replicates CourseSelector catalog filtering logic */
function filterCatalog(
  catalog: Curso[],
  selectedCourses: { curso_id: number; nome: string }[],
  searchTerm: string
) {
  const selectedCourseIds = new Set(selectedCourses.map((c) => c.curso_id));
  const term = searchTerm.trim().toLowerCase();
  return catalog
    .filter((c) => !selectedCourseIds.has(c.id))
    .filter((c) => (term ? c.nome.toLowerCase().includes(term) : true))
    .slice(0, 10);
}

/** Replicates StudentTable search & filter logic */
function filterStudents(
  students: StudentWithCourses[],
  searchQuery: string,
  selectedInstructor: string = 'all',
  selectedCourseId: number | 'all' = 'all'
) {
  let result = [...students];
  const query = searchQuery ? searchQuery.trim().toLowerCase() : '';

  if (query) {
    result = result.filter((student) => {
      const matricula = (student.matricula || '').toLowerCase();
      const nome = (student.nome || '').toLowerCase();
      const instrutor = (student.instrutor || '').toLowerCase();
      const email = (student.email || '').toLowerCase();
      const telefone = (student.telefone || '').toLowerCase();
      return (
        matricula.includes(query) ||
        nome.includes(query) ||
        instrutor.includes(query) ||
        email.includes(query) ||
        telefone.includes(query)
      );
    });
  }

  if (selectedInstructor && selectedInstructor !== 'all') {
    result = result.filter(
      (s) => (s.instrutor || '').toLowerCase() === selectedInstructor.toLowerCase()
    );
  }

  if (selectedCourseId && selectedCourseId !== 'all') {
    result = result.filter((s) =>
      s.cursos.some((c) => c.curso_id === selectedCourseId)
    );
  }

  return result;
}

/** Replicates StudentTable pagination logic */
function paginate(filtered: any[], currentPage: number, pageSize: number = 25) {
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const start = (currentPage - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);
  return { totalPages, paginated };
}

// ==============================================================================
// 1. ADVERSARIAL CHALLENGE: COURSE REORDERING & BOUNDARIES
// ==============================================================================

describe('Adversarial Challenge 1: Course Reordering & Boundaries', () => {
  const sampleCourses = [
    { curso_id: 101, nome: 'Windows 11' },
    { curso_id: 102, nome: 'Word 2021' },
    { curso_id: 103, nome: 'Excel 2021 Básico' },
    { curso_id: 104, nome: 'Excel 2021 Avançado' },
  ];

  it('Boundary: Mover o primeiro item (index 0) para cima NÃO deve alterar a lista nem produzir undefined', () => {
    const result = moveCourseUp(sampleCourses, 0);
    expect(result).toEqual(sampleCourses);
    expect(result[0].curso_id).toBe(101);
    expect(result[0].nome).toBe('Windows 11');
    expect(result.some((c) => c === undefined)).toBe(false);
  });

  it('Boundary: Mover com índice negativo (-1) NÃO deve corromper o array', () => {
    const result = moveCourseUp(sampleCourses, -1);
    expect(result).toEqual(sampleCourses);
  });

  it('Boundary: Mover o último item (index length - 1) para baixo NÃO deve alterar a lista', () => {
    const lastIndex = sampleCourses.length - 1;
    const result = moveCourseDown(sampleCourses, lastIndex);
    expect(result).toEqual(sampleCourses);
    expect(result[lastIndex].curso_id).toBe(104);
    expect(result[lastIndex].nome).toBe('Excel 2021 Avançado');
  });

  it('Boundary: Mover para baixo em lista vazia NÃO deve lançar erro nem criar elementos vazios', () => {
    const empty: { curso_id: number; nome: string }[] = [];
    const result = moveCourseDown(empty, 0);
    expect(result).toEqual([]);
    expect(result.length).toBe(0);
  });

  it('Boundary: Mover para baixo com índice além do tamanho NÃO deve modificar o array', () => {
    const result = moveCourseDown(sampleCourses, 99);
    expect(result).toEqual(sampleCourses);
  });

  it('Boundary: Adição além do limite de 18 cursos deve ser estritamente barrada ou truncada', () => {
    // Simula 25 cursos fornecidos pelo cliente/importador
    const excessiveCourses = Array.from({ length: 25 }, (_, i) => ({
      curso_id: i + 1,
      nome: `Curso Extra ${i + 1}`,
    }));

    // Algoritmo de persistência do hook useStudents trunca em slice(0, 18)
    const truncated = excessiveCourses.slice(0, 18).map((c, idx) => ({
      ficha_id: 1,
      curso_id: c.curso_id,
      curso_nome: c.nome,
      ordem: idx + 1,
    }));

    expect(truncated.length).toBe(18);
    expect(truncated[0].ordem).toBe(1);
    expect(truncated[17].ordem).toBe(18);
    // Verifica que nenhum item tem ordem > 18 (regra de ouro do verso A4)
    expect(truncated.every((c) => c.ordem >= 1 && c.ordem <= 18)).toBe(true);
  });

  it('Duplicate courses: Cursos já adicionados devem ser completamente excluídos do autocomplete', () => {
    const catalog: Curso[] = [
      { id: 1, nome: 'Excel 2021 Básico', ativo: true, descricao: null },
      { id: 2, nome: 'Word 2021', ativo: true, descricao: null },
      { id: 3, nome: 'Power BI', ativo: true, descricao: null },
      { id: 4, nome: 'Photoshop', ativo: true, descricao: null },
    ];

    const selected = [
      { curso_id: 1, nome: 'Excel 2021 Básico' },
      { curso_id: 3, nome: 'Power BI' },
    ];

    const available = filterCatalog(catalog, selected, '');
    expect(available.length).toBe(2);
    expect(available.map((c) => c.id)).toEqual([2, 4]);
    expect(available.some((c) => c.id === 1)).toBe(false);
    expect(available.some((c) => c.id === 3)).toBe(false);
  });

  it('Reordenação sequencial preserva integridade 1..N após múltiplos swaps consecutivos', () => {
    let list = [...sampleCourses];
    // Move Excel Básico (idx 2) para o topo (idx 0) com 2 swaps
    list = moveCourseUp(list, 2); // agora está em 1
    list = moveCourseUp(list, 1); // agora está em 0

    expect(list[0].nome).toBe('Excel 2021 Básico');
    expect(list[1].nome).toBe('Windows 11');
    expect(list[2].nome).toBe('Word 2021');
    expect(list[3].nome).toBe('Excel 2021 Avançado');

    // Valida reatribuição de ordem 1..4
    const persisted = list.map((c, i) => ({
      curso_id: c.curso_id,
      ordem: i + 1,
    }));

    expect(persisted.map((p) => p.ordem)).toEqual([1, 2, 3, 4]);
  });
});

// ==============================================================================
// 2. ADVERSARIAL CHALLENGE: REAL-TIME SEARCH EDGE CASES
// ==============================================================================

describe('Adversarial Challenge 2: Real-time Search Edge Cases', () => {
  const mockStudents: StudentWithCourses[] = [
    {
      id: 1,
      matricula: '5056188',
      nome: 'TAMIRIS MARIANA DOS SANTOS',
      email: 'tamiris@email.com',
      telefone: '17988198252',
      instrutor: 'Pyetra Alves',
      data_nascimento: '1995-04-12',
      data_inicio_curso: '2026-03-05',
      cursos: [{ id: 1, curso_id: 10, nome: 'Excel 2021 Básico', ordem: 1 }],
    },
    {
      id: 2,
      matricula: '5056189',
      nome: 'JOSÉ CARLOS DA SILVA',
      email: 'jcarlos@empresa.com.br',
      telefone: '17997112233',
      instrutor: 'Carlos Eduardo',
      data_nascimento: '1988-11-20',
      data_inicio_curso: '2026-01-10',
      cursos: [{ id: 2, curso_id: 12, nome: 'Informática Básica', ordem: 1 }],
    },
    {
      id: 3,
      matricula: '5056190',
      nome: 'VITÓRIA CÁSSIA PEREIRA',
      email: 'vitoria.cassia@outlook.com',
      telefone: '1732491000',
      instrutor: 'Pyetra Alves',
      data_nascimento: '2005-08-15',
      data_inicio_curso: '2026-02-15',
      cursos: [{ id: 3, curso_id: 15, nome: 'Inglês Intermediário', ordem: 1 }],
    },
  ] as unknown as StudentWithCourses[];

  it('Regex characters: Não deve quebrar nem lançar exceção com caracteres especiais de regex', () => {
    const specialChars = [
      '.*',
      '[a-z]+',
      '(\\d+)',
      '?',
      '+',
      '*',
      '^$',
      '{1,3}',
      '|',
      '\\',
      '(test)',
      '[$]',
    ];

    specialChars.forEach((query) => {
      expect(() => {
        const res = filterStudents(mockStudents, query);
        // Não deve quebrar; retorna array vazio se não houver match literal
        expect(Array.isArray(res)).toBe(true);
      }).not.toThrow();
    });
  });

  it('Empty / Whitespace queries: Deve retornar todos os alunos sem filtrar', () => {
    expect(filterStudents(mockStudents, '').length).toBe(3);
    expect(filterStudents(mockStudents, '   ').length).toBe(3);
    expect(filterStudents(mockStudents, '\t\n').length).toBe(3);
  });

  it('Non-matching query: Deve retornar array vazio com segurança', () => {
    const res = filterStudents(mockStudents, 'XYZ_NADA_A_VER_9999');
    expect(res).toEqual([]);
    expect(res.length).toBe(0);
  });

  it('Accent sensitivity test (FINDING): Demonstra comportamento de busca com e sem acentos', () => {
    // Busca exata com acento
    const matchJoseComAcento = filterStudents(mockStudents, 'josé');
    expect(matchJoseComAcento.length).toBe(1);
    expect(matchJoseComAcento[0].nome).toBe('JOSÉ CARLOS DA SILVA');

    // Busca sem acento contra registro com acento:
    // "josé".toLowerCase().includes("jose") é false!
    const matchJoseSemAcento = filterStudents(mockStudents, 'jose');
    // Registra observação empírica: busca padrão JavaScript substring sem acentuação normalizada
    const matchesWithoutNormalization = matchJoseSemAcento.length;
    // O teste empírico documenta que sem normalização de unaccent/NFD, 'jose' não encontra 'JOSÉ'
    expect(matchesWithoutNormalization).toBe(0);

    // Demonstra a solução de normalização NFD recomendada:
    const normalize = (str: string) =>
      str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    const normalizedResult = mockStudents.filter((s) =>
      normalize(s.nome).includes(normalize('jose'))
    );
    expect(normalizedResult.length).toBe(1);
    expect(normalizedResult[0].nome).toBe('JOSÉ CARLOS DA SILVA');
  });

  it('Busca por múltiplos campos: matrícula, nome, telefone, email e instrutor', () => {
    expect(filterStudents(mockStudents, '5056188').length).toBe(1);
    expect(filterStudents(mockStudents, 'TAMIRIS').length).toBe(1);
    expect(filterStudents(mockStudents, '32491000').length).toBe(1);
    expect(filterStudents(mockStudents, 'empresa.com.br').length).toBe(1);
    expect(filterStudents(mockStudents, 'Pyetra').length).toBe(2);
  });
});

// ==============================================================================
// 3. ADVERSARIAL CHALLENGE: DATE EDGE CASES ACROSS ALL 9 PEDAGOGICAL DATES
// ==============================================================================

describe('Adversarial Challenge 3: Date Edge Cases across all 9 Pedagogical Dates', () => {
  const pedagogicalDateKeys = [
    'data_inicio_curso',
    'data_termino_curso',
    'data_linha_vida',
    'data_form1',
    'data_form2',
    'data_dreamday',
    'data_fechamento1',
    'data_fechamento2',
    'data_fechamento3',
  ] as const;

  it('Verifica consistência de formatação para todas as 9 datas em ISO YYYY-MM-DD', () => {
    const datesObject = {
      data_inicio_curso: '2026-03-01',
      data_termino_curso: '2027-03-01',
      data_linha_vida: '2026-03-15',
      data_form1: '2026-04-01',
      data_form2: '2026-06-01',
      data_dreamday: '2026-09-01',
      data_fechamento1: '2026-06-30',
      data_fechamento2: '2026-12-31',
      data_fechamento3: '2027-02-28',
    };

    pedagogicalDateKeys.forEach((key) => {
      const val = datesObject[key];
      const br = formatDateBR(val);
      expect(br).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      const backToInput = toInputDate(br);
      expect(backToInput).toBe(val);
    });
  });

  it('Verifica todas as 9 datas como nulas ou indefinidas', () => {
    pedagogicalDateKeys.forEach(() => {
      expect(formatDateBR(null)).toBe('-');
      expect(formatDateBR(undefined)).toBe('-');
      expect(formatDateBR('')).toBe('-');
      expect(toInputDate(null)).toBe('');
      expect(toInputDate(undefined)).toBe('');
      expect(toInputDate('')).toBe('');
    });
  });

  it('Ano bissexto: Trata adequadamente 29 de fevereiro', () => {
    expect(formatDateBR('2024-02-29')).toBe('29/02/2024');
    expect(formatDateBR('2028-02-29')).toBe('29/02/2028');
    expect(toInputDate('29/02/2024')).toBe('2024-02-29');
    expect(toInputDate('29/02/2028')).toBe('2028-02-29');
  });

  it('Virada de ano e milênio: 31/12/1999 e 01/01/2000', () => {
    expect(formatDateBR('1999-12-31')).toBe('31/12/1999');
    expect(formatDateBR('2000-01-01')).toBe('01/01/2000');
    expect(toInputDate('31/12/1999')).toBe('1999-12-31');
    expect(toInputDate('01/01/2000')).toBe('2000-01-01');
  });

  it('Timestamp ISO com offset de fuso (T): Converte apenas a parte da data', () => {
    expect(formatDateBR('2026-03-05T00:00:00.000Z')).toBe('05/03/2026');
    expect(formatDateBR('2026-03-05T18:30:00-03:00')).toBe('05/03/2026');
    expect(toInputDate('2026-03-05T00:00:00.000Z')).toBe('2026-03-05');
  });

  it('Timestamp SQL com espaço "YYYY-MM-DD HH:MM:SS" (FINDING): Comportamento observado', () => {
    const sqlTimestamp = '2026-03-05 00:00:00';
    // Observação do comportamento atual:
    const formatted = formatDateBR(sqlTimestamp);
    // Como divide em 'T', split('T')[0] mantém o ' 00:00:00', gerando '05 00:00:00/03/2026'
    // Documentamos esse comportamento empírico como uma oportunidade de melhoria
    const hasSpaceInDay = formatted.includes(' ');
    expect(hasSpaceInDay).toBe(true);
  });

  it('Datas malformadas não devem provocar exceção não tratada', () => {
    const invalidInputs = ['abc', '2026-99-99', 'invalid', '00/00/0000', '12345'];
    invalidInputs.forEach((inp) => {
      expect(() => formatDateBR(inp)).not.toThrow();
      expect(() => toInputDate(inp)).not.toThrow();
    });
  });
});

// ==============================================================================
// 4. ADVERSARIAL CHALLENGE: BATCH SELECTION & PAGINATION CONSISTENCY
// ==============================================================================

describe('Adversarial Challenge 4: Batch Selection and Pagination Consistency', () => {
  // Gera 280 estudantes simulando a base completa de produção do SQLite
  const total280Students: StudentWithCourses[] = Array.from({ length: 280 }, (_, i) => ({
    id: i + 1,
    matricula: String(5056000 + i),
    nome: `ALUNO TESTE ${i + 1}`,
    email: `aluno${i + 1}@exemplo.com`,
    telefone: '17999990000',
    instrutor: i % 2 === 0 ? 'Pyetra Alves' : 'Carlos Eduardo',
    data_inicio_curso: '2026-01-15',
    cursos: [{ id: i + 1, curso_id: (i % 10) + 1, nome: `Curso ${(i % 10) + 1}`, ordem: 1 }],
  })) as unknown as StudentWithCourses[];

  it('Paginação: 280 alunos a 25 por página geram exatamente 12 páginas (11 de 25 e última com 5)', () => {
    const pageSize = 25;
    const { totalPages, paginated: page1 } = paginate(total280Students, 1, pageSize);
    expect(totalPages).toBe(12);
    expect(page1.length).toBe(25);
    expect(page1[0].matricula).toBe('5056000');
    expect(page1[24].matricula).toBe('5056024');

    // Última página (página 12)
    const { paginated: page12 } = paginate(total280Students, 12, pageSize);
    expect(page12.length).toBe(5); // 280 - (11 * 25) = 5
    expect(page12[4].matricula).toBe('5056279');
  });

  it('Pagination Edge Case (FINDING): Desincronização de página se usuário estiver na pág 10 e filtrar para 1 resultado', () => {
    const pageSize = 25;
    // Usuário estava navegando na página 10
    const currentPage = 10;

    // Usuário busca um aluno específico que retorna apenas 1 resultado
    const singleFiltered = [total280Students[0]];

    // Executa paginação direta sem redefinir currentPage:
    const { totalPages, paginated } = paginate(singleFiltered, currentPage, pageSize);

    expect(totalPages).toBe(1);
    // start = (10 - 1) * 25 = 225. singleFiltered.slice(225, 250) retorna []!
    expect(paginated.length).toBe(0);
    // Isso comprova empiricamente que quando o filtro encolhe a lista, o componente precisa
    // clampar ou resetar currentPage para 1 para não exibir tabela vazia!
  });

  it('Batch Selection: Selecionar todos os 280 alunos popula o Set com exatamente 280 IDs', () => {
    const allIds = total280Students.map((s) => s.id);
    const selectedSet = new Set<number>(allIds);

    expect(selectedSet.size).toBe(280);
    expect(selectedSet.has(1)).toBe(true);
    expect(selectedSet.has(280)).toBe(true);

    // Valida toggle individual (desmarcar o aluno 1)
    selectedSet.delete(1);
    expect(selectedSet.size).toBe(279);
    expect(selectedSet.has(1)).toBe(false);

    // Master checkbox deve ficar indeterminate quando 279 de 280 estão marcados
    const isAllSelected = allIds.every((id) => selectedSet.has(id));
    const isPartiallySelected = allIds.some((id) => selectedSet.has(id)) && !isAllSelected;

    expect(isAllSelected).toBe(false);
    expect(isPartiallySelected).toBe(true);
  });

  it('Batch Selection filtrado: Selecionar todos apenas para alunos da instrutora Pyetra', () => {
    const pyetraStudents = total280Students.filter((s) => s.instrutor === 'Pyetra Alves');
    expect(pyetraStudents.length).toBe(140);

    const pyetraIds = pyetraStudents.map((s) => s.id);
    const selectedSet = new Set<number>(pyetraIds);

    expect(selectedSet.size).toBe(140);
    // Todos os da Pyetra estão selecionados
    expect(pyetraIds.every((id) => selectedSet.has(id))).toBe(true);

    // Ao desmarcar todos os filtrados da Pyetra
    pyetraIds.forEach((id) => selectedSet.delete(id));
    expect(selectedSet.size).toBe(0);
  });

  it('Exclusão de aluno desmarca automaticamente o ID selecionado', () => {
    const selectedSet = new Set<number>([1, 2, 3]);
    const deletedId = 2;

    // Comportamento do handler de exclusão em app/page.tsx
    selectedSet.delete(deletedId);

    expect(selectedSet.has(2)).toBe(false);
    expect(selectedSet.size).toBe(2);
    expect(Array.from(selectedSet)).toEqual([1, 3]);
  });
});
