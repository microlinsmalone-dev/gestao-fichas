// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Excel: lib/excel/import-service.ts
// Gravação no Supabase das linhas validadas de uma planilha:
//   1. Cria no catálogo os cursos ainda inexistentes
//   2. Upsert das fichas pela Matrícula (cria novas / atualiza existentes)
//   3. Substitui os cursos dos alunos cuja célula de cursos foi preenchida
// Falhas em um lote são isoladas linha a linha para não perder o restante.
// ==============================================================================

import { supabase } from '../supabase/client';
import type { FichaCursoInsert, FichaInsert } from '../../types/database';
import { normalizeText, type ParsedImportRow } from '../utils/excel-utils';

const CHUNK_SIZE = 200;

export type ImportPhase = 'cursos' | 'fichas' | 'vinculos' | 'concluido';

export type ImportProgress = { phase: ImportPhase; done: number; total: number };

export type ImportFailure = { rowNumber: number; matricula: string; nome: string; error: string };

export type ImportResult = {
  inserted: number;
  updated: number;
  coursesCreated: string[];
  studentsWithCoursesReplaced: number;
  failures: ImportFailure[];
};

function chunk<T>(items: T[], size = CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchCatalog(): Promise<Map<string, { id: number; nome: string }>> {
  const { data, error } = await supabase.from('cursos').select('id, nome');
  if (error) throw new Error(`Falha ao carregar catálogo de cursos: ${error.message}`);
  const map = new Map<string, { id: number; nome: string }>();
  (data || []).forEach((c) => map.set(normalizeText(c.nome), { id: c.id, nome: c.nome }));
  return map;
}

async function fetchExistingMatriculas(matriculas: string[]): Promise<Set<string>> {
  const existing = new Set<string>();
  for (const part of chunk(matriculas)) {
    const { data, error } = await supabase.from('fichas').select('matricula').in('matricula', part);
    if (error) throw new Error(`Falha ao consultar matrículas existentes: ${error.message}`);
    (data || []).forEach((r) => existing.add(r.matricula));
  }
  return existing;
}

/**
 * Importa as linhas válidas (sem erros) para o Supabase.
 */
export async function importRowsToSupabase(
  parsedRows: ParsedImportRow[],
  onProgress?: (p: ImportProgress) => void
): Promise<ImportResult> {
  const rows = parsedRows.filter((r) => r.errors.length === 0);
  const result: ImportResult = {
    inserted: 0,
    updated: 0,
    coursesCreated: [],
    studentsWithCoursesReplaced: 0,
    failures: [],
  };
  if (rows.length === 0) return result;

  // ---------------------------------------------------------------- 1. Cursos
  onProgress?.({ phase: 'cursos', done: 0, total: 1 });
  let catalog = await fetchCatalog();
  const missing = new Map<string, string>();
  rows.forEach((r) =>
    r.cursos.forEach((c) => {
      const key = normalizeText(c);
      if (!catalog.has(key) && !missing.has(key)) missing.set(key, c);
    })
  );
  if (missing.size > 0) {
    const { error } = await supabase
      .from('cursos')
      .upsert(
        Array.from(missing.values()).map((nome) => ({ nome, ativo: true })),
        { onConflict: 'nome', ignoreDuplicates: true }
      );
    if (error) throw new Error(`Falha ao cadastrar novos cursos: ${error.message}`);
    result.coursesCreated = Array.from(missing.values());
    catalog = await fetchCatalog();
  }
  onProgress?.({ phase: 'cursos', done: 1, total: 1 });

  // ---------------------------------------------------------------- 2. Fichas
  const existing = await fetchExistingMatriculas(rows.map((r) => r.data.matricula));
  const idByMatricula = new Map<string, number>();
  const okRows: ParsedImportRow[] = [];
  let done = 0;

  const upsert = async (payload: FichaInsert[]) =>
    supabase.from('fichas').upsert(payload, { onConflict: 'matricula' }).select('id, matricula');

  for (const part of chunk(rows)) {
    const { data, error } = await upsert(part.map((r) => r.data));
    if (!error && data) {
      data.forEach((d) => idByMatricula.set(d.matricula, d.id));
      okRows.push(...part);
    } else {
      // Isola a(s) linha(s) problemática(s) do lote
      for (const row of part) {
        const single = await upsert([row.data]);
        if (single.error || !single.data?.length) {
          result.failures.push({
            rowNumber: row.rowNumber,
            matricula: row.data.matricula,
            nome: row.data.nome,
            error: single.error?.message || 'Registro não retornado pelo banco',
          });
        } else {
          idByMatricula.set(single.data[0].matricula, single.data[0].id);
          okRows.push(row);
        }
      }
    }
    done += part.length;
    onProgress?.({ phase: 'fichas', done, total: rows.length });
  }

  okRows.forEach((r) => {
    if (existing.has(r.data.matricula)) result.updated += 1;
    else result.inserted += 1;
  });

  // ---------------------------------------------------------------- 3. Vínculos
  const withCourses = okRows.filter((r) => r.cursosProvided && idByMatricula.has(r.data.matricula));
  let linksDone = 0;
  for (const part of chunk(withCourses, 100)) {
    const fichaIds = part.map((r) => idByMatricula.get(r.data.matricula)!);
    const links: FichaCursoInsert[] = [];
    part.forEach((r) => {
      const fichaId = idByMatricula.get(r.data.matricula)!;
      r.cursos.forEach((nome, idx) => {
        const curso = catalog.get(normalizeText(nome));
        if (curso) links.push({ ficha_id: fichaId, curso_id: curso.id, curso_nome: curso.nome, ordem: idx + 1 });
      });
    });

    const { error: delErr } = await supabase.from('fichas_cursos').delete().in('ficha_id', fichaIds);
    if (delErr) {
      part.forEach((r) =>
        result.failures.push({
          rowNumber: r.rowNumber,
          matricula: r.data.matricula,
          nome: r.data.nome,
          error: `Dados salvos, mas cursos não atualizados: ${delErr.message}`,
        })
      );
    } else if (links.length > 0) {
      const { error: insErr } = await supabase.from('fichas_cursos').insert(links);
      if (insErr) {
        part.forEach((r) =>
          result.failures.push({
            rowNumber: r.rowNumber,
            matricula: r.data.matricula,
            nome: r.data.nome,
            error: `Dados salvos, mas falha ao gravar cursos: ${insErr.message}`,
          })
        );
      } else {
        result.studentsWithCoursesReplaced += part.length;
      }
    }
    linksDone += part.length;
    onProgress?.({ phase: 'vinculos', done: linksDone, total: withCourses.length });
  }

  onProgress?.({ phase: 'concluido', done: 1, total: 1 });
  return result;
}
