'use client';

// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Page: app/excel/page.tsx
// Integração com planilhas: modelo em branco, exportação e importação com
// pré-visualização/validação antes de gravar no Supabase.
// Estilo: Dark Moderno com Azul (#1f6aa5 / #242424)
// ==============================================================================

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  FileUp,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useStudents } from '../../lib/hooks/use-students';
import { useCourses } from '../../lib/hooks/use-courses';
import { useDialog } from '../../components/ui/dialog';
import {
  buildExportWorkbook,
  buildTemplateWorkbook,
  datedFilename,
  downloadWorkbook,
  readWorkbookMatrix,
} from '../../lib/excel/workbook';
import { parseSheetRows, type ParsedSheet } from '../../lib/utils/excel-utils';
import {
  importRowsToSupabase,
  type ImportProgress,
  type ImportResult,
} from '../../lib/excel/import-service';

const PHASE_LABEL: Record<ImportProgress['phase'], string> = {
  cursos: 'Verificando catálogo de cursos',
  fichas: 'Gravando fichas dos alunos',
  vinculos: 'Atualizando cursos dos alunos',
  concluido: 'Concluído',
};

type RowFilter = 'todas' | 'problemas';

export default function ExcelPage() {
  const { students, loading: loadingStudents, refresh } = useStudents();
  const { courses, loading: loadingCourses, refresh: refreshCourses } = useCourses();
  const { showToast, showConfirm, showAlert } = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string>('');
  const [sheetName, setSheetName] = useState<string>('');
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [rowFilter, setRowFilter] = useState<RowFilter>('todas');
  const [dragOver, setDragOver] = useState(false);

  const catalogNames = useMemo(() => courses.map((c) => c.nome), [courses]);
  const existingMatriculas = useMemo(() => new Set(students.map((s) => s.matricula)), [students]);

  const summary = useMemo(() => {
    if (!parsed) return null;
    const valid = parsed.rows.filter((r) => r.errors.length === 0);
    return {
      total: parsed.rows.length,
      valid: valid.length,
      invalid: parsed.rows.length - valid.length,
      withWarnings: valid.filter((r) => r.warnings.length > 0).length,
      toInsert: valid.filter((r) => !existingMatriculas.has(r.data.matricula)).length,
      toUpdate: valid.filter((r) => existingMatriculas.has(r.data.matricula)).length,
    };
  }, [parsed, existingMatriculas]);

  const visibleRows = useMemo(() => {
    if (!parsed) return [];
    return rowFilter === 'problemas'
      ? parsed.rows.filter((r) => r.errors.length > 0 || r.warnings.length > 0)
      : parsed.rows;
  }, [parsed, rowFilter]);

  // ------------------------------------------------------------------ Ações
  const handleDownloadTemplate = () => {
    try {
      downloadWorkbook(buildTemplateWorkbook(catalogNames), 'Modelo de Importação.xlsx');
      showToast('Planilha modelo gerada com sucesso.', 'success', 'Modelo baixado');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao gerar o modelo.', 'error', 'Erro');
    }
  };

  const handleExport = () => {
    try {
      const wb = buildExportWorkbook(students);
      const name = datedFilename('Alunos Microlins');
      downloadWorkbook(wb, name);
      showToast(
        `${students.length} alunos exportados para "${name}".`,
        'success',
        'Exportação concluída'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao exportar os alunos.', 'error', 'Erro');
    }
  };

  const resetImport = () => {
    setParsed(null);
    setFileName('');
    setSheetName('');
    setProgress(null);
    setResult(null);
    setRowFilter('todas');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setReading(true);
    setResult(null);
    setProgress(null);
    try {
      const buf = await file.arrayBuffer();
      const { matrix, sheetName: sName } = await readWorkbookMatrix(buf);
      const parsedSheet = parseSheetRows(matrix, catalogNames);
      setFileName(file.name);
      setSheetName(sName);
      setParsed(parsedSheet);
      setRowFilter('todas');
    } catch (err) {
      showAlert(
        err instanceof Error ? err.message : 'Falha ao ler o arquivo Excel.',
        'error',
        'Arquivo inválido'
      );
      resetImport();
    } finally {
      setReading(false);
    }
  };

  const runImport = async () => {
    if (!parsed) return;
    setImporting(true);
    setProgress(null);
    try {
      const res = await importRowsToSupabase(parsed.rows, setProgress);
      setResult(res);
      await Promise.all([refresh(), refreshCourses()]);
      showToast(
        `${res.inserted} criado(s), ${res.updated} atualizado(s).`,
        res.failures.length ? 'warning' : 'success',
        'Importação concluída'
      );
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'Falha inesperada na importação.', 'error', 'Erro de importação');
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = () => {
    if (!parsed || !summary || summary.valid === 0) return;
    const lines = [
      `${summary.toInsert} novo(s) aluno(s) serão cadastrados.`,
      `${summary.toUpdate} aluno(s) existentes serão atualizados pela Matrícula.`,
    ];
    if (parsed.newCourses.length) lines.push(`${parsed.newCourses.length} curso(s) novo(s) serão adicionados ao catálogo.`);
    if (summary.invalid) lines.push(`${summary.invalid} linha(s) com erro serão ignoradas.`);
    showConfirm({
      title: 'Confirmar importação',
      message: lines.join('\n'),
      type: 'info',
      confirmText: `Importar ${summary.valid} aluno(s)`,
      onConfirm: runImport,
    });
  };

  const busy = loadingStudents || loadingCourses;
  const progressPct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  // ------------------------------------------------------------------ Render
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 text-slate-100">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="p-2 rounded-xl bg-[#2e2e2e] border border-[#444444] text-slate-300 hover:text-white hover:bg-[#383838] transition-colors shadow-xs"
          title="Voltar"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Importação e Exportação Excel</h1>
          <p className="text-xs text-slate-400">
            Planilhas .xlsx processadas no navegador — layout de 16 colunas compatível com o sistema desktop
          </p>
        </div>
      </div>

      {/* Cartões de ação */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#242424] rounded-2xl border border-[#333333] p-6 flex flex-col gap-4 shadow-md">
          <div className="w-12 h-12 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-white text-sm">Modelo de Planilha</h3>
            <p className="text-xs text-slate-400 mt-1">
              Modelo em branco com as 16 colunas oficiais, aba de instruções e a lista dos{' '}
              {loadingCourses ? '…' : courses.length} cursos do catálogo.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={loadingCourses}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 transition-all shadow-md"
          >
            <Download className="w-4 h-4" />
            Baixar Modelo
          </button>
        </div>

        <div className="bg-[#242424] rounded-2xl border border-[#333333] p-6 flex flex-col gap-4 shadow-md">
          <div className="w-12 h-12 rounded-xl bg-[#1f6aa5]/20 text-[#38bdf8] border border-[#1f6aa5]/40 flex items-center justify-center">
            <Download className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-white text-sm">Exportar Alunos</h3>
            <p className="text-xs text-slate-400 mt-1">
              Exporta os {loadingStudents ? '…' : students.length} alunos cadastrados com datas e cursos na ordem
              definida. O arquivo pode ser editado e reimportado.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={loadingStudents}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#1f6aa5] hover:bg-[#1a5c8e] border border-[#2b82c4] disabled:opacity-50 transition-all shadow-md"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Exportar para Excel
          </button>
        </div>
      </div>

      {/* Importação */}
      <div className="bg-[#242424] rounded-2xl border border-[#333333] p-6 space-y-5 shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#38bdf8]" />
              Importar Alunos
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              A Matrícula identifica o aluno: existentes são atualizados, novos são cadastrados. Coluna de cursos vazia
              mantém os cursos atuais do aluno.
            </p>
          </div>
          {parsed && !importing && (
            <button
              type="button"
              onClick={resetImport}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-[#444444] bg-[#2e2e2e] text-slate-300 hover:text-white hover:bg-[#383838]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Escolher outro arquivo
            </button>
          )}
        </div>

        {!parsed && (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!busy) handleFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-colors ${
              dragOver ? 'border-[#1f6aa5] bg-[#1f6aa5]/20' : 'border-[#444444] hover:border-[#1f6aa5] bg-[#2e2e2e]/40'
            } ${busy ? 'opacity-60 pointer-events-none' : ''}`}
          >
            {reading || busy ? (
              <Loader2 className="w-8 h-8 text-[#38bdf8] animate-spin" />
            ) : (
              <FileUp className="w-8 h-8 text-[#38bdf8]" />
            )}
            <div className="text-center">
              <p className="text-sm font-semibold text-white">
                {busy ? 'Carregando dados do sistema…' : reading ? 'Lendo planilha…' : 'Clique ou arraste a planilha aqui'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Arquivos .xlsx ou .xls</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={busy || reading}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
        )}

        {parsed && summary && (
          <div className="space-y-4">
            <div className="text-xs text-slate-400">
              Arquivo <span className="font-semibold text-white">{fileName}</span> • aba{' '}
              <span className="font-semibold text-white">{sheetName}</span>
              {parsed.positional && (
                <span className="ml-2 text-amber-400 font-semibold">
                  (cabeçalhos não reconhecidos — usando a ordem padrão das 16 colunas)
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Linhas lidas', value: summary.total, cls: 'text-white' },
                { label: 'Válidas', value: summary.valid, cls: 'text-emerald-400' },
                { label: 'Com erro', value: summary.invalid, cls: 'text-rose-400' },
                { label: 'Com avisos', value: summary.withWarnings, cls: 'text-amber-400' },
                { label: 'Novos alunos', value: summary.toInsert, cls: 'text-[#38bdf8]' },
                { label: 'Atualizações', value: summary.toUpdate, cls: 'text-[#38bdf8]' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-[#333333] bg-[#2e2e2e] p-3">
                  <div className={`text-lg font-bold ${s.cls}`}>{s.value}</div>
                  <div className="text-[11px] font-semibold text-slate-400">{s.label}</div>
                </div>
              ))}
            </div>

            {parsed.newCourses.length > 0 && (
              <div className="rounded-xl border border-amber-800/80 bg-amber-950/60 p-3 text-xs text-amber-200">
                <span className="font-bold">Cursos novos ({parsed.newCourses.length})</span> — não existem no catálogo e
                serão criados: {parsed.newCourses.join('; ')}
              </div>
            )}

            <div className="flex items-center gap-2 text-xs">
              {(['todas', 'problemas'] as RowFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setRowFilter(f)}
                  className={`px-3 py-1.5 rounded-lg font-semibold border ${
                    rowFilter === f
                      ? 'bg-[#1f6aa5] text-white border-[#2b82c4]'
                      : 'bg-[#2e2e2e] text-slate-300 border-[#444444] hover:bg-[#383838]'
                  }`}
                >
                  {f === 'todas' ? `Todas (${parsed.rows.length})` : `Com erros/avisos (${summary.invalid + summary.withWarnings})`}
                </button>
              ))}
            </div>

            <div className="border border-[#333333] rounded-xl overflow-hidden bg-[#1e1e1e]">
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#242424] text-slate-300 sticky top-0 border-b border-[#333333]">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold w-10"></th>
                      <th className="text-left px-3 py-2 font-semibold w-14">Linha</th>
                      <th className="text-left px-3 py-2 font-semibold">Matrícula</th>
                      <th className="text-left px-3 py-2 font-semibold">Nome</th>
                      <th className="text-left px-3 py-2 font-semibold">Ação</th>
                      <th className="text-left px-3 py-2 font-semibold">Cursos</th>
                      <th className="text-left px-3 py-2 font-semibold">Observações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2e2e2e]">
                    {visibleRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                          Nenhuma linha com problemas.
                        </td>
                      </tr>
                    )}
                    {visibleRows.map((r) => {
                      const hasError = r.errors.length > 0;
                      const isUpdate = existingMatriculas.has(r.data.matricula);
                      return (
                        <tr key={r.rowNumber} className={hasError ? 'bg-rose-950/40' : 'hover:bg-[#252525]'}>
                          <td className="px-3 py-2">
                            {hasError ? (
                              <XCircle className="w-4 h-4 text-rose-400" />
                            ) : r.warnings.length ? (
                              <AlertTriangle className="w-4 h-4 text-amber-400" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-400">{r.rowNumber}</td>
                          <td className="px-3 py-2 font-mono text-slate-200">{r.data.matricula || '—'}</td>
                          <td className="px-3 py-2 text-white font-medium">{r.data.nome || '—'}</td>
                          <td className="px-3 py-2">
                            {hasError ? (
                              <span className="text-rose-400 font-semibold">Ignorada</span>
                            ) : isUpdate ? (
                              <span className="text-[#38bdf8] font-semibold">Atualizar</span>
                            ) : (
                              <span className="text-emerald-400 font-semibold">Cadastrar</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-300" title={r.cursos.join('\n')}>
                            {r.cursosProvided ? r.cursos.length : <span className="text-slate-500">manter</span>}
                          </td>
                          <td className="px-3 py-2 text-[11px] leading-snug">
                            {r.errors.map((e) => (
                              <div key={e} className="text-rose-400">{e}</div>
                            ))}
                            {r.warnings.map((w) => (
                              <div key={w} className="text-amber-400">{w}</div>
                            ))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {importing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#38bdf8]" />
                    {progress ? PHASE_LABEL[progress.phase] : 'Preparando importação'}
                  </span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#2e2e2e] overflow-hidden">
                  <div className="h-full bg-[#1f6aa5] transition-all" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}

            {result && (
              <div
                className={`rounded-xl border p-4 text-xs space-y-2 ${
                  result.failures.length ? 'border-amber-800/80 bg-amber-950/60' : 'border-emerald-800/80 bg-emerald-950/60'
                }`}
              >
                <div className="font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#38bdf8]" />
                  Resultado da importação
                </div>
                <ul className="text-slate-200 space-y-0.5">
                  <li>{result.inserted} aluno(s) cadastrado(s)</li>
                  <li>{result.updated} aluno(s) atualizado(s)</li>
                  <li>{result.studentsWithCoursesReplaced} aluno(s) com cursos atualizados</li>
                  {result.coursesCreated.length > 0 && (
                    <li>{result.coursesCreated.length} curso(s) adicionados ao catálogo</li>
                  )}
                </ul>
                {result.failures.length > 0 && (
                  <div className="pt-2 border-t border-amber-800/80">
                    <div className="font-semibold text-rose-400 mb-1">{result.failures.length} falha(s):</div>
                    {result.failures.map((f) => (
                      <div key={`${f.rowNumber}-${f.error}`} className="text-rose-400">
                        Linha {f.rowNumber} ({f.matricula} – {f.nome}): {f.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!result && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={confirmImport}
                  disabled={importing || summary.valid === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#1f6aa5] hover:bg-[#1a5c8e] border border-[#2b82c4] disabled:opacity-50 transition-all shadow-md"
                >
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Importar {summary.valid} aluno(s)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
