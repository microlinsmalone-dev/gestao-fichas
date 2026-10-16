// ==============================================================================
// Milestone 5 — Testes do módulo Excel (regras puras + round-trip real de .xlsx)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx-js-style';
import {
  TEMPLATE_HEADERS,
  MAX_COURSES_PER_STUDENT,
  buildColumnMap,
  excelSerialToIso,
  expandTwoDigitYear,
  parseCourseList,
  parseExcelDate,
  parseSheetRows,
  resolveHeader,
  studentToExportRow,
} from '../../lib/utils/excel-utils';
import {
  buildExportWorkbook,
  buildTemplateWorkbook,
  readWorkbookMatrix,
  workbookToArray,
  IMPORT_SHEET_NAME,
} from '../../lib/excel/workbook';
import type { StudentWithCourses } from '../../types/database';

const CATALOG = [
  'Internet, Redes Sociais e Aplicativos',
  'Negociação, Objeções e Influência',
  'Excel Avançado',
  'Pacote Office',
  'Inglês Básico',
];

function makeStudent(overrides: Partial<StudentWithCourses> = {}): StudentWithCourses {
  return {
    id: 1,
    matricula: '0050123',
    nome: 'Ana Souza',
    email: 'ana@exemplo.com',
    telefone: '17991234567',
    instrutor: 'Carlos',
    data_nascimento: '2010-05-09',
    data_inicio_curso: '2026-03-05',
    data_termino_curso: null,
    data_linha_vida: null,
    data_form1: '2026-04-01',
    data_form2: null,
    data_dreamday: null,
    data_fechamento1: null,
    data_fechamento2: null,
    data_fechamento3: null,
    dia_semana: null,
    horario_inicio: null,
    horario_fim: null,
    observacoes: null,
    cursos: [
      { nome: 'Pacote Office', ordem: 2 },
      { nome: 'Internet, Redes Sociais e Aplicativos', ordem: 1 },
    ],
    ...overrides,
  };
}

describe('parseExcelDate', () => {
  it('converte serial do Excel (número e texto)', () => {
    expect(excelSerialToIso(45658)).toBe('2025-01-01');
    expect(parseExcelDate(45658).value).toBe('2025-01-01');
    expect(parseExcelDate('41591').value).toBe('2013-11-13');
  });

  it('aceita DD/MM/AAAA, D/M/AAAA, separadores - e .', () => {
    expect(parseExcelDate('05/03/2026').value).toBe('2026-03-05');
    expect(parseExcelDate('5/3/2026').value).toBe('2026-03-05');
    expect(parseExcelDate('05-03-2026').value).toBe('2026-03-05');
    expect(parseExcelDate('05.03.2026').value).toBe('2026-03-05');
  });

  it('aceita ISO com e sem horário (formato legado do SQLite)', () => {
    expect(parseExcelDate('1987-09-29 00:00:00').value).toBe('1987-09-29');
    expect(parseExcelDate('2026-02-27').value).toBe('2026-02-27');
  });

  it('expande ano com 2 dígitos por janela deslizante', () => {
    expect(expandTwoDigitYear(27, 2026)).toBe(2027);
    expect(expandTwoDigitYear(87, 2026)).toBe(1987);
    expect(parseExcelDate('29/09/87', 2026).value).toBe('1987-09-29');
    expect(parseExcelDate('10/01/27', 2026).value).toBe('2027-01-10');
  });

  it('rejeita datas inexistentes e formatos inválidos com mensagem', () => {
    expect(parseExcelDate('31/02/2026')).toMatchObject({ value: null });
    expect(parseExcelDate('31/02/2026').error).toBeTruthy();
    expect(parseExcelDate('29/02/2025').error).toBeTruthy();
    expect(parseExcelDate('29/02/2024').value).toBe('2024-02-29');
    expect(parseExcelDate('amanhã').error).toMatch(/não reconhecido/);
  });

  it('trata vazio como nulo sem erro', () => {
    for (const v of [null, undefined, '', '  ', '-', 'None']) {
      expect(parseExcelDate(v)).toEqual({ value: null });
    }
  });
});

describe('parseCourseList', () => {
  it('não quebra nomes de curso que contêm vírgula (bug do importador legado)', () => {
    const r = parseCourseList('Internet, Redes Sociais e Aplicativos, Excel Avançado', CATALOG);
    expect(r.courses).toEqual(['Internet, Redes Sociais e Aplicativos', 'Excel Avançado']);
  });

  it('usa ; como separador quando presente', () => {
    const r = parseCourseList('Negociação, Objeções e Influência; Pacote Office', CATALOG);
    expect(r.courses).toEqual(['Negociação, Objeções e Influência', 'Pacote Office']);
  });

  it('corrige grafia para a do catálogo e remove duplicados', () => {
    const r = parseCourseList('excel avancado, EXCEL AVANÇADO, ingles basico', CATALOG);
    expect(r.courses).toEqual(['Excel Avançado', 'Inglês Básico']);
    expect(r.duplicates).toHaveLength(1);
  });

  it('mantém cursos desconhecidos e limita a 18', () => {
    const many = Array.from({ length: 20 }, (_, i) => `Curso ${i + 1}`).join('; ');
    const r = parseCourseList(many, CATALOG);
    expect(r.courses).toHaveLength(MAX_COURSES_PER_STUDENT);
    expect(r.overflow).toEqual(['Curso 19', 'Curso 20']);
  });
});

describe('cabeçalhos', () => {
  it('reconhece cabeçalhos do modelo oficial e variações', () => {
    expect(TEMPLATE_HEADERS.map(resolveHeader)).toEqual([
      'matricula', 'nome', 'email', 'data_nascimento', 'telefone', 'instrutor',
      'data_inicio_curso', 'data_termino_curso', 'data_linha_vida', 'data_form1', 'data_form2',
      'data_dreamday', 'data_fechamento1', 'data_fechamento2', 'data_fechamento3', 'cursos',
    ]);
    expect(resolveHeader('MATRICULA')).toBe('matricula');
    expect(resolveHeader('E-mail')).toBe('email');
    expect(resolveHeader('Cursos Contratados (Separados por vírgula)')).toBe('cursos');
    expect(resolveHeader('Data de Nascimento')).toBe('data_nascimento');
    expect(resolveHeader('Coluna X')).toBeNull();
  });

  it('usa posição fixa quando não há cabeçalho reconhecível', () => {
    const { map, positional } = buildColumnMap(['a', 'b', 'c']);
    expect(positional).toBe(true);
    expect(map.get(0)).toBe('matricula');
    expect(map.get(15)).toBe('cursos');
  });
});

describe('parseSheetRows', () => {
  it('valida obrigatórios, ignora linhas vazias e detecta matrícula repetida', () => {
    const matrix: unknown[][] = [
      ['Matrícula', 'Nome', 'Data Nascimento', 'Cursos Contratados'],
      [5056188, 'João', '29/09/2010', 'Pacote Office, Curso Inédito'],
      [null, null, null, null],
      ['', 'Sem matrícula', null, null],
      ['5056188', 'João Atualizado', '31/02/2010', ''],
    ];
    const sheet = parseSheetRows(matrix, CATALOG, 2026);
    expect(sheet.positional).toBe(false);
    expect(sheet.rows).toHaveLength(3);

    const [first, noMat, dup] = sheet.rows;
    expect(first.data.matricula).toBe('5056188');
    expect(first.errors[0]).toMatch(/repetida/);
    expect(noMat.errors).toContain('Matrícula não informada');
    expect(dup.errors).toHaveLength(0);
    expect(dup.data.nome).toBe('João Atualizado');
    expect(dup.data.data_nascimento).toBeNull();
    expect(dup.warnings.some((w) => w.includes('Data Nascimento'))).toBe(true);
    expect(dup.cursosProvided).toBe(false);
    expect(sheet.newCourses).toEqual(['Curso Inédito']);
  });

  it('não inclui no payload colunas ausentes da planilha', () => {
    const sheet = parseSheetRows([['Matrícula', 'Nome'], ['1', 'Ana']], CATALOG);
    expect(Object.keys(sheet.rows[0].data).sort()).toEqual(['matricula', 'nome']);
  });
});

describe('round-trip real de arquivos .xlsx', () => {
  it('modelo em branco tem as 16 colunas e as abas de apoio', () => {
    const buf = workbookToArray(buildTemplateWorkbook(CATALOG));
    const wb = XLSX.read(buf, { type: 'array' });
    expect(wb.SheetNames).toEqual([IMPORT_SHEET_NAME, 'Instruções', 'Cursos']);
    const { matrix } = readWorkbookMatrix(buf);
    expect(matrix[0]).toEqual(TEMPLATE_HEADERS);
    expect(matrix).toHaveLength(1);
  });

  it('exportação reimportada preserva dados, zeros à esquerda e ordem dos cursos', () => {
    const students = [makeStudent(), makeStudent({ id: 2, matricula: '777', nome: 'Bruno', cursos: [] })];
    const exportRow = studentToExportRow(students[0]);
    expect(exportRow[15]).toBe('Internet, Redes Sociais e Aplicativos; Pacote Office');
    expect(exportRow[3]).toBe('09/05/2010');

    const { matrix } = readWorkbookMatrix(workbookToArray(buildExportWorkbook(students)));
    const sheet = parseSheetRows(matrix, CATALOG);
    expect(sheet.rows).toHaveLength(2);
    const ana = sheet.rows.find((r) => r.data.nome === 'Ana Souza')!;
    expect(ana.errors).toEqual([]);
    expect(ana.data.matricula).toBe('0050123');
    expect(ana.data.telefone).toBe('17991234567');
    expect(ana.data.data_nascimento).toBe('2010-05-09');
    expect(ana.data.data_form1).toBe('2026-04-01');
    expect(ana.data.data_termino_curso).toBeNull();
    expect(ana.cursos).toEqual(['Internet, Redes Sociais e Aplicativos', 'Pacote Office']);
    const bruno = sheet.rows.find((r) => r.data.nome === 'Bruno')!;
    expect(bruno.cursosProvided).toBe(false);
  });

  it('lê planilha legada do desktop (cursos separados só por vírgula, datas como serial)', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS.slice(0, 15).concat('Cursos Contratados (Separados por vírgula)'),
      [5053983, 'Maria', '', 40869, '', 'Ju', 46080, '', '', '', '', '', '', '', '',
        'Internet, Redes Sociais e Aplicativos, Pacote Office'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plan1');
    const { sheetName, matrix } = readWorkbookMatrix(workbookToArray(wb));
    expect(sheetName).toBe('Plan1');
    const row = parseSheetRows(matrix, CATALOG).rows[0];
    expect(row.data.matricula).toBe('5053983');
    expect(row.data.data_nascimento).toBe(excelSerialToIso(40869));
    expect(row.data.data_inicio_curso).toBe('2026-02-27');
    expect(row.cursos).toEqual(['Internet, Redes Sociais e Aplicativos', 'Pacote Office']);
  });
});
