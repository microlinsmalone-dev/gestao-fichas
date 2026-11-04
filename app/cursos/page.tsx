'use client';

// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Page: app/cursos/page.tsx
// Consulta e gestão do catálogo de cursos institucionais Microlins
// ==============================================================================

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ArrowLeft,
  Search,
  CheckCircle2,
  Plus,
  Loader2,
  Sparkles,
  Pencil,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { useCourses } from '../../lib/hooks/use-courses';
import { useDialog } from '../../components/ui/dialog';
import { supabase } from '../../lib/supabase/client';
import { normalizeText } from '../../lib/utils/excel-utils';
import type { Curso } from '../../types/database';

export default function CursosPage() {
  const { courses, loading, refresh: refreshCourses } = useCourses();
  const { showToast, showAlert, showConfirm } = useDialog();

  const [searchTerm, setSearchTerm] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Estados de edição inline
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [editingCourseName, setEditingCourseName] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Filtra cursos pela busca
  const filteredCourses = useMemo(() => {
    if (!searchTerm.trim()) return courses;
    const term = normalizeText(searchTerm);
    return courses.filter((c) => normalizeText(c.nome).includes(term));
  }, [courses, searchTerm]);

  // Cadastro de novo curso
  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCourseName.trim();
    if (!name) return;

    const exists = courses.some((c) => normalizeText(c.nome) === normalizeText(name));
    if (exists) {
      showAlert('Já existe um curso com esse nome no catálogo.', 'warning', 'Curso Existente');
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase.from('cursos').insert([{ nome: name, ativo: true }]);
      if (error) throw new Error(error.message);

      setNewCourseName('');
      setIsAdding(false);
      await refreshCourses();
      showToast(`Curso "${name}" cadastrado com sucesso!`, 'success', 'Catálogo Atualizado');
    } catch (err) {
      showAlert(
        err instanceof Error ? err.message : 'Falha ao cadastrar o curso no catálogo.',
        'error',
        'Erro ao Salvar'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Iniciar edição de nome de um curso
  const startEditCourse = (curso: Curso) => {
    setEditingCourseId(curso.id);
    setEditingCourseName(curso.nome);
  };

  const cancelEditCourse = () => {
    setEditingCourseId(null);
    setEditingCourseName('');
  };

  // Salvar alteração de nome do curso
  const handleSaveEditCourse = async (cursoId: number) => {
    const cleanName = editingCourseName.trim();
    if (!cleanName) {
      showAlert('O nome do módulo não pode ficar vazio.', 'warning');
      return;
    }

    const duplicate = courses.some(
      (c) => c.id !== cursoId && normalizeText(c.nome) === normalizeText(cleanName)
    );
    if (duplicate) {
      showAlert('Já existe outro módulo com esse nome no catálogo.', 'warning', 'Nome Duplicado');
      return;
    }

    try {
      setIsSavingEdit(true);

      // Atualiza tabela cursos
      const { error: cErr } = await supabase
        .from('cursos')
        .update({ nome: cleanName, updated_at: new Date().toISOString() })
        .eq('id', cursoId);
      if (cErr) throw new Error(cErr.message);

      // Sincroniza em fichas_cursos para manter a integridade visual das fichas existentes
      await supabase
        .from('fichas_cursos')
        .update({ curso_nome: cleanName })
        .eq('curso_id', cursoId);

      await refreshCourses();
      showToast(`Módulo atualizado para "${cleanName}"!`, 'success');
      cancelEditCourse();
    } catch (err) {
      showAlert(
        err instanceof Error ? err.message : 'Falha ao atualizar o módulo.',
        'error',
        'Erro ao Salvar'
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Excluir módulo (com desvinculação automática de alunos se confirmado)
  const handleDeleteCourse = async (curso: Curso) => {
    try {
      // Verifica se existem alunos com este curso vinculado
      const { count, error } = await supabase
        .from('fichas_cursos')
        .select('id', { count: 'exact', head: true })
        .eq('curso_id', curso.id);

      if (error) {
        throw new Error(error.message);
      }

      const hasLinks = Boolean(count && count > 0);

      showConfirm({
        title: hasLinks ? 'Módulo Vinculado a Alunos' : 'Excluir Módulo',
        message: hasLinks
          ? `O módulo "${curso.nome}" está vinculado a ${count} aluno(s).\n\nDeseja desvincular este curso de todos os alunos e apagá-lo definitivamente do catálogo?`
          : `Tem certeza que deseja excluir o módulo "${curso.nome}" do catálogo institucional?\nEsta ação não poderá ser desfeita.`,
        confirmText: hasLinks ? 'Sim, Desvincular e Excluir' : 'Sim, Excluir',
        cancelText: 'Cancelar',
        type: 'warning',
        onConfirm: async () => {
          try {
            // 1. Se houver alunos com este curso, desvincula primeiro para respeitar o FK RESTRICT
            if (hasLinks) {
              const { error: unlinkErr } = await supabase
                .from('fichas_cursos')
                .delete()
                .eq('curso_id', curso.id);

              if (unlinkErr) {
                throw new Error(`Falha ao desvincular alunos: ${unlinkErr.message}`);
              }
            }

            // 2. Exclui o curso do catálogo
            const { error: delErr } = await supabase
              .from('cursos')
              .delete()
              .eq('id', curso.id);

            if (delErr) {
              throw new Error(delErr.message);
            }

            await refreshCourses();
            showToast(
              hasLinks
                ? `Módulo "${curso.nome}" desvinculado de ${count} aluno(s) e excluído com sucesso!`
                : `Módulo "${curso.nome}" excluído com sucesso!`,
              'success'
            );
          } catch (err) {
            showAlert(
              err instanceof Error ? err.message : 'Falha ao excluir o módulo.',
              'error',
              'Erro ao Excluir'
            );
          }
        },
      });
    } catch (err) {
      showAlert(
        err instanceof Error ? err.message : 'Falha ao verificar vínculos do módulo.',
        'error',
        'Erro ao Verificar'
      );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Voltar para Alunos"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Catálogo de Cursos
            </h1>
            <p className="text-xs text-slate-500">
              Cursos e módulos oficiais disponíveis para alocação nas fichas pedagógicas
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#0f3b7d] hover:bg-[#0a2e68] transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Curso</span>
        </button>
      </div>

      {/* Formulário de Adição Rápida */}
      {isAdding && (
        <form
          onSubmit={handleAddCourse}
          className="bg-white rounded-2xl border border-blue-200 p-5 shadow-sm space-y-3 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0f3b7d]" />
              Adicionar Curso ao Catálogo Institucional
            </h3>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Cancelar
            </button>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-3">
            <input
              type="text"
              value={newCourseName}
              onChange={(e) => setNewCourseName(e.target.value)}
              placeholder="Digite o nome do curso (ex: Inteligência Artificial na Prática)..."
              className="flex-1 px-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0f3b7d] focus:border-transparent"
              autoFocus
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={submitting || !newCourseName.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#0f3b7d] hover:bg-[#0a2e68] disabled:opacity-50 transition-all shadow-xs"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>Cadastrar Curso</span>
            </button>
          </div>
        </form>
      )}

      {/* Barra de Busca e Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome do curso..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-[#0f3b7d] focus:border-transparent shadow-2xs"
          />
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-slate-600 shadow-2xs">
          <span>Total cadastrados:</span>
          <span className="font-bold text-[#0f3b7d]">{courses.length} cursos</span>
        </div>
      </div>

      {/* Grid de Cursos */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <Loader2 className="w-8 h-8 text-[#0f3b7d] animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-500">Carregando catálogo de cursos...</p>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-3">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">Nenhum curso encontrado</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Não encontramos nenhum curso com o termo &quot;{searchTerm}&quot;. Tente outro filtro ou cadastre um novo curso.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map((curso, idx) => {
            const isEditing = editingCourseId === curso.id;

            return (
              <div
                key={curso.id}
                className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 font-mono">
                      #{idx + 1}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Ativo
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2 pt-1 animate-in fade-in">
                      <input
                        type="text"
                        value={editingCourseName}
                        onChange={(e) => setEditingCourseName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEditCourse(curso.id);
                          } else if (e.key === 'Escape') {
                            cancelEditCourse();
                          }
                        }}
                        autoFocus
                        disabled={isSavingEdit}
                        className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-blue-400 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 text-slate-900"
                        placeholder="Nome do módulo..."
                      />
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={cancelEditCourse}
                          disabled={isSavingEdit}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          <X className="w-3 h-3" />
                          <span>Cancelar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEditCourse(curso.id)}
                          disabled={isSavingEdit || !editingCourseName.trim()}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold text-white bg-[#0f3b7d] hover:bg-[#0a2e68] transition-colors disabled:opacity-50"
                        >
                          {isSavingEdit ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          <span>Salvar</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <h3 className="text-xs font-bold text-slate-900 leading-snug">
                      {curso.nome}
                    </h3>
                  )}
                </div>

                {/* Ações do Módulo (Editar / Apagar) */}
                {!isEditing && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => startEditCourse(curso)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-[#0f3b7d] hover:bg-blue-50 transition-colors"
                      title="Editar nome deste módulo"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCourse(curso)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Excluir este módulo do catálogo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Apagar</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
