// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Excel: lib/excel/workbook.ts
// Geração (modelo em branco / exportação de alunos) e leitura de arquivos .xlsx
// inteiramente no navegador, via xlsx-js-style (SheetJS com suporte a estilos).
// ==============================================================================

import * as XLSX from 'xlsx-js-style';
import type { StudentWithCourses } from '../../types/database';
import { TEMPLATE_COLUMNS, TEMPLATE_HEADERS, studentToExportRow } from '../utils/excel-utils';

export const IMPORT_SHEET_NAME = 'Importar Alunos';
export const EXPORT_SHEET_NAME = 'Alunos';

const thinBorder = {
  top: { style: 'thin', color: { rgb: 'B7C3D7' } },
  bottom: { style: 'thin', color: { rgb: 'B7C3D7' } },
  left: { style: 'thin', color: { rgb: 'B7C3D7' } },
  right: { style: 'thin', color: { rgb: 'B7C3D7' } },
};

const headerStyle = {
  font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { patternType: 'solid', fgColor: { rgb: '0F3B7D' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: thinBorder,
};

const cellStyle = {
  font: { name: 'Calibri', sz: 11 },
  alignment: { vertical: 'center' },
  border: thinBorder,
};

const zebraStyle = {
  ...cellStyle,
  fill: { patternType: 'solid', fgColor: { rgb: 'F3F6FB' } },
};

/** Monta a aba principal com cabeçalho estilizado, larguras, filtro e painel congelado. */
function buildStudentSheet(rows: string[][]): XLSX.WorkSheet {
  // Todas as células como texto: preserva zeros à esquerda em matrícula/telefone
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...rows]);
  const lastCol = XLSX.utils.encode_col(TEMPLATE_HEADERS.length - 1);
  const lastRow = rows.length + 1;

  for (let c = 0; c < TEMPLATE_HEADERS.length; c++) {
    const headerRef = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[headerRef]) ws[headerRef].s = headerStyle;
    for (let r = 1; r <= rows.length; r++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) ws[ref] = { t: 's', v: '' };
      ws[ref].t = 's';
      ws[ref].z = '@';
      ws[ref].s = r % 2 === 0 ? zebraStyle : cellStyle;
    }
  }

  ws['!cols'] = TEMPLATE_COLUMNS.map((c) => ({ wch: c.width }));
  ws['!rows'] = [{ hpt: 32 }];
  ws['!autofilter'] = { ref: `A1:${lastCol}${lastRow}` };
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  return ws;
}

/** Planilha modelo em branco + abas de instruções e catálogo de cursos. */
export function buildTemplateWorkbook(catalogNames: string[] = []): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildStudentSheet([]), IMPORT_SHEET_NAME);

  const instructions = [
    ['Instruções de preenchimento'],
    [''],
    ['1. Preencha uma linha por aluno a partir da linha 2 da aba "Importar Alunos". Não altere a linha de cabeçalho.'],
    ['2. Matrícula e Nome são obrigatórios. A Matrícula identifica o aluno: se já existir, o cadastro é ATUALIZADO; se não existir, é CRIADO.'],
    ['3. Datas: use DD/MM/AAAA (ex.: 05/03/2026). Também são aceitas datas formatadas do próprio Excel.'],
    ['4. Cursos: separe por ponto e vírgula (;) ou vírgula (,), na ordem desejada. Máximo de 18 cursos por aluno.'],
    ['5. Use os nomes exatamente como na aba "Cursos". Cursos que não existirem no catálogo serão criados automaticamente.'],
    ['6. Deixar a coluna de cursos vazia MANTÉM os cursos já cadastrados do aluno.'],
    ['7. Colunas de dados vazias limpam o campo correspondente no cadastro do aluno.'],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(instructions);
  wsInfo['!cols'] = [{ wch: 130 }];
  if (wsInfo.A1) wsInfo.A1.s = { font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: '0F3B7D' } } };
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Instruções');

  if (catalogNames.length > 0) {
    const sorted = [...catalogNames].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const wsCursos = XLSX.utils.aoa_to_sheet([['Cursos'], ...sorted.map((n) => [n])]);
    wsCursos['!cols'] = [{ wch: 70 }];
    if (wsCursos.A1) wsCursos.A1.s = headerStyle;
    XLSX.utils.book_append_sheet(wb, wsCursos, 'Cursos');
  }
  return wb;
}

/** Exporta a listagem de alunos no mesmo layout de 16 colunas (reimportável). */
export function buildExportWorkbook(students: StudentWithCourses[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const sorted = [...students].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  XLSX.utils.book_append_sheet(wb, buildStudentSheet(sorted.map(studentToExportRow)), EXPORT_SHEET_NAME);
  return wb;
}

/** Serializa o workbook para bytes .xlsx. */
export function workbookToArray(wb: XLSX.WorkBook): ArrayBuffer {
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

/** Dispara o download do arquivo no navegador. */
export function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
  const blob = new Blob([workbookToArray(wb)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Lê um arquivo .xlsx/.xls e devolve a matriz de células da aba de alunos
 * (prioriza "Importar Alunos" / "Alunos"; senão usa a primeira aba).
 */
export function readWorkbookMatrix(data: ArrayBuffer): { sheetName: string; matrix: unknown[][] } {
  const wb = XLSX.read(data, { type: 'array', cellDates: false });
  if (!wb.SheetNames.length) throw new Error('A planilha não contém nenhuma aba.');
  const preferred = wb.SheetNames.find((n) => n === IMPORT_SHEET_NAME || n === EXPORT_SHEET_NAME);
  const sheetName = preferred ?? wb.SheetNames[0];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
  return { sheetName, matrix };
}

/** Nome de arquivo com data local (ex.: "Alunos - Fichas Microlins - 15-10-2026.xlsx"). */
export function datedFilename(prefix: string, date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${prefix} - ${dd}-${mm}-${date.getFullYear()}.xlsx`;
}
