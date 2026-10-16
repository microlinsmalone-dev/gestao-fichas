'use client';

// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Page: app/excel/page.tsx
// Integração com planilhas: modelo em branco, exportação e importação com
// pré-visualização/validação antes de gravar no Supabase.
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
    if (students.length === 0) {
      showToast('Não há alunos cadastrados para exportar.', 'warning', 'Exportação');
      return;
    }
    try {
      downloadWorkbook(buildExportWorkbook(students), datedFilename('Alunos - Fichas Microlins'));
      showToast(`${students.length} aluno(s) exportado(s).`, 'success', 'Exportação concluída');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao exportar.', 'error', 'Erro');
    }
  };

  const resetImport = () => {
    setParsed(null);
    setFileName('');
    setSheetName('');
    setResult(null);
    setProgress(null);
    setRowFilter('todas');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      showAlert('Selecione um arquivo do Excel (.xlsx ou .xls).', 'error', 'Arquivo inválido');
      return;
    }
    setReading(true);
    setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const { sheetName: sName, matrix } = readWorkbookMatrix(buffer);
      const sheet = parseSheetRows(matrix, catalogNames);
      if (sheet.rows.length === 0) {
        showAlert('A planilha não possui linhas de alunos abaixo do cabeçalho.', 'warning', 'Planilha vazia');
        resetImport();
        return;
      }
      setFileName(file.name);
      setSheetName(sName);
      setParsed(sheet);
      setRowFilter(sheet.rows.some((r) => r.errors.length > 0) ? 'problemas' : 'todas');
    } catch (err) {
      showAlert(
        `Não foi possível ler a planilha.\n${err instanceof Error ? err.message : ''}`,
        'error',
        'Erro de leitura'
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          title="Voltar"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Importação e Exportação Excel</h1>
          <p className="text-xs text-slate-500">
            Planilhas .xlsx processadas no navegador — layout de 16 colunas compatível com o sistema desktop
          </p>
        </div>
      </div>

      {/* Cartões de ação */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 text-sm">Modelo de Planilha</h3>
            <p className="text-xs text-slate-500 mt-1">
              Modelo em branco com as 16 colunas oficiais, aba de instruções e a lista dos{' '}
              {loadingCourses ? '…' : courses.length} cursos do catálogo.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={loadingCourses}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all"
          >
            <Download className="w-4 h-4" />
            Baixar Modelo
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#0f3b7d] flex items-center justify-center">
            <Download className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 text-sm">Exportar Alunos</h3>
            <p className="text-xs text-slate-500 mt-1">
              Exporta os {loadingStudents ? '…' : students.length} alunos cadastrados com datas e cursos na ordem
              definida. O arquivo pode ser editado e reimportado.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={loadingStudents}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#0f3b7d] hover:bg-[#0a2e68] disabled:opacity-50 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Exportar para Excel
          </button>
        </div>
      </div>

      {/* Importação */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#0f3b7d]" />
              Importar Alunos
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              A Matrícula identifica o aluno: existentes são atualizados, novos são cadastrados. Coluna de cursos vazia
              mantém os cursos atuais do aluno.
            </p>
          </div>
          {parsed && !importing && (
            <button
              type="button"
              onClick={resetImport}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50"
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
              dragOver ? 'border-[#0f3b7d] bg-blue-50/60' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            } ${busy ? 'opacity-60 pointer-events-none' : ''}`}
          >
            {reading || busy ? (
              <Loader2 className="w-8 h-8 text-[#0f3b7d] animate-spin" />
            ) : (
              <FileUp className="w-8 h-8 text-[#0f3b7d]" />
            )}
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-800">
                {busy ? 'Carregando dados do sistema…' : reading ? 'Lendo planilha…' : 'Clique ou arraste a planilha aqui'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Arquivos .xlsx ou .xls</p>
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
            <div className="text-xs text-slate-500">
              Arquivo <span className="font-semibold text-slate-700">{fileName}</span> • aba{' '}
              <span className="font-semibold text-slate-700">{sheetName}</span>
              {parsed.positional && (
                <span className="ml-2 text-amber-600 font-semibold">
                  (cabeçalhos não reconhecidos — usando a ordem padrão das 16 colunas)
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Linhas lidas', value: summary.total, cls: 'text-slate-900' },
                { label: 'Válidas', value: summary.valid, cls: 'text-emerald-600' },
                { label: 'Com erro', value: summary.invalid, cls: 'text-rose-600' },
                { label: 'Com avisos', value: summary.withWarnings, cls: 'text-amber-600' },
                { label: 'Novos alunos', value: summary.toInsert, cls: 'text-[#0f3b7d]' },
                { label: 'Atualizações', value: summary.toUpdate, cls: 'text-[#0f3b7d]' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
                  <div className={`text-lg font-bold ${s.cls}`}>{s.value}</div>
                  <div className="text-[11px] font-semibold text-slate-500">{s.label}</div>
                </div>
              ))}
            </div>

            {parsed.newCourses.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">
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
                      ? 'bg-[#0f3b7d] text-white border-[#0f3b7d]'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {f === 'todas' ? `Todas (${parsed.rows.length})` : `Com erros/avisos (${summary.invalid + summary.withWarnings})`}
                </button>
              ))}
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600 sticky top-0">
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
                  <tbody className="divide-y divide-slate-100">
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
                        <tr key={r.rowNumber} className={hasError ? 'bg-rose-50/50' : ''}>
                          <td className="px-3 py-2">
                            {hasError ? (
                              <XCircle className="w-4 h-4 text-rose-500" />
                            ) : r.warnings.length ? (
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{r.rowNumber}</td>
                          <td className="px-3 py-2 font-mono text-slate-700">{r.data.matricula || '—'}</td>
                          <td className="px-3 py-2 text-slate-800 font-medium">{r.data.nome || '—'}</td>
                          <td className="px-3 py-2">
                            {hasError ? (
                              <span className="text-rose-600 font-semibold">Ignorada</span>
                            ) : isUpdate ? (
                              <span className="text-[#0f3b7d] font-semibold">Atualizar</span>
                            ) : (
                              <span className="text-emerald-600 font-semibold">Cadastrar</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600" title={r.cursos.join('\n')}>
                            {r.cursosProvided ? r.cursos.length : <span className="text-slate-400">manter</span>}
                          </td>
                          <td className="px-3 py-2 text-[11px] leading-snug">
                            {r.errors.map((e) => (
                              <div key={e} className="text-rose-600">{e}</div>
                            ))}
                            {r.warnings.map((w) => (
                              <div key={w} className="text-amber-700">{w}</div>
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
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0f3b7d]" />
                    {progress ? PHASE_LABEL[progress.phase] : 'Preparando importação'}
                  </span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-[#0f3b7d] transition-all" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}

            {result && (
              <div
                className={`rounded-xl border p-4 text-xs space-y-2 ${
                  result.failures.length ? 'border-amber-200 bg-amber-50/70' : 'border-emerald-200 bg-emerald-50/70'
                }`}
              >
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#0f3b7d]" />
                  Resultado da importação
                </div>
                <ul className="text-slate-700 space-y-0.5">
                  <li>{result.inserted} aluno(s) cadastrado(s)</li>
                  <li>{result.updated} aluno(s) atualizado(s)</li>
                  <li>{result.studentsWithCoursesReplaced} aluno(s) com cursos atualizados</li>
                  {result.coursesCreated.length > 0 && (
                    <li>{result.coursesCreated.length} curso(s) adicionados ao catálogo</li>
                  )}
                </ul>
                {result.failures.length > 0 && (
                  <div className="pt-2 border-t border-amber-200">
                    <div className="font-semibold text-rose-700 mb-1">{result.failures.length} falha(s):</div>
                    {result.failures.map((f) => (
                      <div key={`${f.rowNumber}-${f.error}`} className="text-rose-700">
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#0f3b7d] hover:bg-[#0a2e68] disabled:opacity-50 transition-all"
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
