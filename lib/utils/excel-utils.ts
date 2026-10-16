// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Utilities: lib/utils/excel-utils.ts
// Regras puras (sem I/O) de importação/exportação de planilhas:
//   - Layout oficial de 16 colunas (compatível com o modelo do sistema desktop)
//   - Reconhecimento flexível de cabeçalhos (acentos, maiúsculas, sinônimos)
//   - Normalização de datas (serial do Excel, DD/MM/AAAA, DD/MM/AA, ISO)
//   - Separação de cursos sensível ao catálogo (nomes que contêm vírgula)
// ==============================================================================

import type { FichaInsert, StudentWithCourses } from '../../types/database';
import { formatDateForSheet } from './date-utils';

/** Limite de cursos por ficha (restrição do banco: fichas_cursos.ordem 1..18). */
export const MAX_COURSES_PER_STUDENT = 18;

/** Campos de data da ficha, na ordem das colunas 7..15 do modelo. */
export const DATE_FIELDS = [
  'data_nascimento',
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

export type ImportField =
  | 'matricula'
  | 'nome'
  | 'email'
  | 'telefone'
  | 'instrutor'
  | (typeof DATE_FIELDS)[number]
  | 'cursos';

/** Colunas oficiais do modelo (mesma ordem do sistema desktop CriaFichas). */
export const TEMPLATE_COLUMNS: { field: ImportField; header: string; width: number }[] = [
  { field: 'matricula', header: 'Matrícula', width: 12 },
  { field: 'nome', header: 'Nome', width: 36 },
  { field: 'email', header: 'Email', width: 30 },
  { field: 'data_nascimento', header: 'Data Nascimento', width: 16 },
  { field: 'telefone', header: 'Telefone', width: 17 },
  { field: 'instrutor', header: 'Instrutor', width: 18 },
  { field: 'data_inicio_curso', header: 'Data Início Curso', width: 17 },
  { field: 'data_termino_curso', header: 'Data Término Curso', width: 18 },
  { field: 'data_linha_vida', header: 'Data Linha da Vida', width: 18 },
  { field: 'data_form1', header: 'Data Form1', width: 13 },
  { field: 'data_form2', header: 'Data Form2', width: 13 },
  { field: 'data_dreamday', header: 'Data Dreamday', width: 15 },
  { field: 'data_fechamento1', header: 'Data Fechamento 1', width: 18 },
  { field: 'data_fechamento2', header: 'Data Fechamento 2', width: 18 },
  { field: 'data_fechamento3', header: 'Data Fechamento 3', width: 18 },
  {
    field: 'cursos',
    header: 'Cursos Contratados (Separados por vírgula ou ponto e vírgula)',
    width: 70,
  },
];

export const TEMPLATE_HEADERS = TEMPLATE_COLUMNS.map((c) => c.header);

// ------------------------------------------------------------------------------
// Texto
// ------------------------------------------------------------------------------

/** Remove acentos, normaliza espaços e converte para minúsculas. */
export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Converte o valor bruto de uma célula em texto limpo ('' para vazio). */
export function cellToText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? '' : value.toISOString();
  }
  return String(value).replace(/\s+/g, ' ').trim();
}

// ------------------------------------------------------------------------------
// Datas
// ------------------------------------------------------------------------------

export type DateParseResult = { value: string | null; error?: string };

const pad2 = (n: number) => String(n).padStart(2, '0');

function buildIsoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null; // ex.: 31/02, 29/02 em ano não bissexto
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Serial de data do Excel (sistema 1900) -> AAAA-MM-DD. */
export function excelSerialToIso(serial: number): string | null {
  // 61 = 01/03/1900 (abaixo disso há o bug histórico do 29/02/1900 do Lotus/Excel)
  if (!Number.isFinite(serial) || serial < 61 || serial > 73050) return null;
  const ms = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000;
  const d = new Date(ms);
  return buildIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Expande ano de 2 dígitos usando janela deslizante (até ano atual + 10 => 20xx). */
export function expandTwoDigitYear(yy: number, referenceYear = new Date().getFullYear()): number {
  const pivot = (referenceYear % 100) + 10;
  return yy <= pivot ? 2000 + yy : 1900 + yy;
}

/**
 * Converte qualquer representação de data vinda do Excel para AAAA-MM-DD.
 * Aceita: serial numérico, Date, DD/MM/AAAA, D/M/AA, DD-MM-AAAA, DD.MM.AAAA,
 * AAAA-MM-DD (com ou sem horário).
 */
export function parseExcelDate(raw: unknown, referenceYear?: number): DateParseResult {
  if (raw === null || raw === undefined) return { value: null };

  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return { value: null, error: 'data inválida' };
    return { value: buildIsoDate(raw.getFullYear(), raw.getMonth() + 1, raw.getDate()) };
  }

  if (typeof raw === 'number') {
    const iso = excelSerialToIso(raw);
    return iso ? { value: iso } : { value: null, error: `número ${raw} não é uma data válida` };
  }

  const text = String(raw).trim();
  if (!text || ['-', '—', 'none', 'null', 'nan'].includes(text.toLowerCase())) {
    return { value: null };
  }

  // Serial do Excel armazenado como texto (ex.: "41591")
  if (/^\d{4,5}(\.\d+)?$/.test(text)) {
    const iso = excelSerialToIso(Number(text));
    if (iso) return { value: iso };
  }

  // AAAA-MM-DD (opcionalmente seguido de horário)
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if (m) {
    const iso = buildIsoDate(Number(m[1]), Number(m[2]), Number(m[3]));
    return iso ? { value: iso } : { value: null, error: `data inexistente "${text}"` };
  }

  // DD/MM/AAAA, DD/MM/AA, com separadores / - .
  m = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s.*)?$/);
  if (m) {
    let year = Number(m[3]);
    if (m[3].length === 2) year = expandTwoDigitYear(year, referenceYear);
    const iso = buildIsoDate(year, Number(m[2]), Number(m[1]));
    return iso ? { value: iso } : { value: null, error: `data inexistente "${text}"` };
  }

  return { value: null, error: `formato de data não reconhecido "${text}"` };
}

// ------------------------------------------------------------------------------
// Cursos
// ------------------------------------------------------------------------------

export type CourseParseResult = { courses: string[]; overflow: string[]; duplicates: string[] };

/**
 * Separa a célula de cursos em nomes individuais.
 * - Se houver ";" ou quebra de linha, esses são os separadores (vírgula é parte do nome).
 * - Caso contrário, separa por vírgula, mas reagrupa pedaços adjacentes quando a junção
 *   corresponde a um curso do catálogo (ex.: "Internet, Redes Sociais e Aplicativos").
 * - Nomes reconhecidos são substituídos pela grafia oficial do catálogo.
 */
export function parseCourseList(raw: unknown, catalogNames: string[] = []): CourseParseResult {
  const text = cellToText(raw);
  const result: CourseParseResult = { courses: [], overflow: [], duplicates: [] };
  if (!text) return result;

  const catalog = new Map<string, string>();
  for (const name of catalogNames) {
    const key = normalizeText(name);
    if (key && !catalog.has(key)) catalog.set(key, name.trim());
  }

  let pieces: string[];
  if (/[;\n\r]/.test(String(raw))) {
    pieces = String(raw).split(/[;\n\r]+/).map((p) => p.trim()).filter(Boolean);
  } else {
    const tokens = text.split(',').map((t) => t.trim()).filter(Boolean);
    pieces = [];
    let i = 0;
    while (i < tokens.length) {
      let matchedEnd = -1;
      for (let j = tokens.length; j > i + 1; j--) {
        if (catalog.has(normalizeText(tokens.slice(i, j).join(', ')))) {
          matchedEnd = j;
          break;
        }
      }
      if (matchedEnd > 0) {
        pieces.push(tokens.slice(i, matchedEnd).join(', '));
        i = matchedEnd;
      } else {
        pieces.push(tokens[i]);
        i += 1;
      }
    }
  }

  const seen = new Set<string>();
  for (const piece of pieces) {
    const key = normalizeText(piece);
    if (!key) continue;
    const canonical = catalog.get(key) ?? piece.replace(/\s+/g, ' ').trim();
    if (seen.has(key)) {
      result.duplicates.push(canonical);
      continue;
    }
    seen.add(key);
    if (result.courses.length < MAX_COURSES_PER_STUDENT) result.courses.push(canonical);
    else result.overflow.push(canonical);
  }
  return result;
}

// ------------------------------------------------------------------------------
// Cabeçalhos
// ------------------------------------------------------------------------------

const STOP_WORDS = new Set(['data', 'de', 'do', 'da', 'dos', 'das', 'e', 'o', 'a']);

const HEADER_ALIASES: Record<string, ImportField> = {
  matricula: 'matricula',
  mat: 'matricula',
  nome: 'nome',
  nomealuno: 'nome',
  aluno: 'nome',
  email: 'email',
  mail: 'email',
  nascimento: 'data_nascimento',
  telefone: 'telefone',
  celular: 'telefone',
  fone: 'telefone',
  whatsapp: 'telefone',
  instrutor: 'instrutor',
  educador: 'instrutor',
  iniciocurso: 'data_inicio_curso',
  inicio: 'data_inicio_curso',
  terminocurso: 'data_termino_curso',
  termino: 'data_termino_curso',
  linhavida: 'data_linha_vida',
  form1: 'data_form1',
  form2: 'data_form2',
  dreamday: 'data_dreamday',
  fechamento1: 'data_fechamento1',
  fechamento2: 'data_fechamento2',
  fechamento3: 'data_fechamento3',
};

/** Identifica a qual campo um cabeçalho de coluna corresponde (ou null). */
export function resolveHeader(header: unknown): ImportField | null {
  const words = normalizeText(header)
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP_WORDS.has(w));
  if (words.length === 0) return null;
  if (words[0] === 'cursos' || words[0] === 'curso' || words[0] === 'modulos') return 'cursos';
  const key = words.join('');
  return HEADER_ALIASES[key] ?? null;
}

/**
 * Mapeia índice de coluna -> campo. Se os cabeçalhos não identificarem Matrícula e Nome,
 * aplica a posição fixa do modelo oficial (planilhas antigas do sistema desktop).
 */
export function buildColumnMap(headerRow: unknown[]): {
  map: Map<number, ImportField>;
  positional: boolean;
} {
  const map = new Map<number, ImportField>();
  const used = new Set<ImportField>();
  headerRow.forEach((h, idx) => {
    const field = resolveHeader(h);
    if (field && !used.has(field)) {
      map.set(idx, field);
      used.add(field);
    }
  });
  if (used.has('matricula') && used.has('nome')) return { map, positional: false };

  const positionalMap = new Map<number, ImportField>();
  TEMPLATE_COLUMNS.forEach((col, idx) => positionalMap.set(idx, col.field));
  return { map: positionalMap, positional: true };
}

// ------------------------------------------------------------------------------
// Linhas
// ------------------------------------------------------------------------------

export type ParsedImportRow = {
  /** Número da linha na planilha (1 = cabeçalho). */
  rowNumber: number;
  data: FichaInsert;
  cursos: string[];
  /** true quando a célula de cursos tinha conteúdo (vazia = mantém cursos atuais). */
  cursosProvided: boolean;
  errors: string[];
  warnings: string[];
};

export type ParsedSheet = {
  rows: ParsedImportRow[];
  positional: boolean;
  /** Campos efetivamente presentes na planilha. */
  fields: ImportField[];
  /** Cursos citados que não existem no catálogo (serão criados na importação). */
  newCourses: string[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeMatricula(raw: unknown): string {
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(Math.trunc(raw));
  return cellToText(raw).replace(/\.0+$/, '');
}

/**
 * Converte a matriz bruta da planilha (primeira linha = cabeçalho) em linhas validadas.
 */
export function parseSheetRows(
  matrix: unknown[][],
  catalogNames: string[] = [],
  referenceYear?: number
): ParsedSheet {
  const [headerRow = [], ...body] = matrix;
  const { map, positional } = buildColumnMap(headerRow);
  const fields = Array.from(new Set(map.values()));
  const catalogKeys = new Set(catalogNames.map(normalizeText));
  const newCourses = new Map<string, string>();
  const rows: ParsedImportRow[] = [];
  const seenMatriculas = new Map<string, number>();

  body.forEach((cells, bodyIdx) => {
    const rowNumber = bodyIdx + 2;
    const get = (field: ImportField): unknown => {
      for (const [idx, f] of map) if (f === field) return cells?.[idx];
      return undefined;
    };

    // Ignora linhas totalmente vazias
    if (!cells || cells.every((c) => cellToText(c) === '')) return;

    const errors: string[] = [];
    const warnings: string[] = [];
    const data: FichaInsert = { matricula: normalizeMatricula(get('matricula')), nome: cellToText(get('nome')) };

    if (!data.matricula) errors.push('Matrícula não informada');
    if (!data.nome) errors.push('Nome não informado');

    if (fields.includes('email')) {
      const email = cellToText(get('email'));
      data.email = email || null;
      if (email && !EMAIL_RE.test(email)) warnings.push(`Email possivelmente inválido "${email}"`);
    }
    if (fields.includes('telefone')) data.telefone = cellToText(get('telefone')) || null;
    if (fields.includes('instrutor')) data.instrutor = cellToText(get('instrutor')) || null;

    for (const field of DATE_FIELDS) {
      if (!fields.includes(field)) continue;
      const parsed = parseExcelDate(get(field), referenceYear);
      data[field] = parsed.value;
      if (parsed.error) {
        const label = TEMPLATE_COLUMNS.find((c) => c.field === field)?.header ?? field;
        warnings.push(`${label}: ${parsed.error} (campo ficará vazio)`);
      }
    }

    let cursos: string[] = [];
    let cursosProvided = false;
    if (fields.includes('cursos')) {
      const parsed = parseCourseList(get('cursos'), catalogNames);
      cursos = parsed.courses;
      cursosProvided = cursos.length > 0;
      if (parsed.overflow.length > 0) {
        warnings.push(
          `Mais de ${MAX_COURSES_PER_STUDENT} cursos: ignorados ${parsed.overflow.join('; ')}`
        );
      }
      if (parsed.duplicates.length > 0) {
        warnings.push(`Cursos repetidos ignorados: ${parsed.duplicates.join('; ')}`);
      }
      for (const c of cursos) {
        const key = normalizeText(c);
        if (!catalogKeys.has(key) && !newCourses.has(key)) newCourses.set(key, c);
      }
    }

    if (data.matricula) {
      const previous = seenMatriculas.get(data.matricula);
      if (previous !== undefined) {
        const prevRow = rows[previous];
        prevRow.errors.push(`Matrícula repetida: substituída pela linha ${rowNumber}`);
        warnings.push(`Matrícula também aparece na linha ${prevRow.rowNumber} (esta linha prevalece)`);
      }
      seenMatriculas.set(data.matricula, rows.length);
    }

    rows.push({ rowNumber, data, cursos, cursosProvided, errors, warnings });
  });

  return { rows, positional, fields, newCourses: Array.from(newCourses.values()) };
}

// ------------------------------------------------------------------------------
// Exportação
// ------------------------------------------------------------------------------

/** Converte um aluno em uma linha de 16 colunas (mesmo layout do modelo de importação). */
export function studentToExportRow(student: StudentWithCourses): string[] {
  return TEMPLATE_COLUMNS.map((col) => {
    switch (col.field) {
      case 'cursos':
        return [...(student.cursos || [])]
          .sort((a, b) => a.ordem - b.ordem)
          .map((c) => c.nome)
          .join('; ');
      case 'matricula':
      case 'nome':
      case 'email':
      case 'telefone':
      case 'instrutor':
        return (student[col.field] ?? '').toString();
      default:
        return formatDateForSheet(student[col.field]);
    }
  });
}
