'use client';

// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Page: app/cursos/page.tsx
// Consulta e gestão do catálogo de cursos institucionais Microlins
// Estilo: Dark Moderno com Azul (#1f6aa5 / #242424)
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

    try {
      setIsSavingEdit(true);
      const { error } = await supabase
        .from('cursos')
        .update({ nome: cleanName })
        .eq('id', cursoId);

      if (error) throw new Error(error.message);

      setEditingCourseId(null);
      setEditingCourseName('');
      await refreshCourses();
      showToast(`Módulo atualizado para "${cleanName}" com sucesso!`, 'success');
    } catch (err) {
      showAlert(
        err instanceof Error ? err.message : 'Falha ao renomear o módulo.',
        'error',
        'Erro ao Salvar'
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Apagar curso do catálogo (desvinculando alunos primeiro se necessário)
  const handleDeleteCourse = async (curso: Curso) => {
    try {
      const { count, error } = await supabase
        .from('fichas_cursos')
        .select('*', { count: 'exact', head: true })
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 text-slate-100">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-[#2e2e2e] border border-[#444444] text-slate-300 hover:text-white hover:bg-[#383838] transition-colors shadow-xs"
            title="Voltar para Alunos"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">
              Catálogo de Cursos
            </h1>
            <p className="text-xs text-slate-400">
              Cursos e módulos oficiais disponíveis para alocação nas fichas pedagógicas
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#1f6aa5] hover:bg-[#1a5c8e] border border-[#2b82c4] transition-all shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Curso</span>
        </button>
      </div>

      {/* Formulário de Adição Rápida */}
      {isAdding && (
        <form
          onSubmit={handleAddCourse}
          className="bg-[#242424] rounded-2xl border border-[#333333] p-5 shadow-md space-y-3 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#38bdf8]" />
              Adicionar Curso ao Catálogo Institucional
            </h3>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-xs text-slate-400 hover:text-white"
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
              className="flex-1 px-4 py-2 text-xs rounded-xl bg-[#2e2e2e] border border-[#444444] text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1f6aa5]/40 focus:border-[#1f6aa5]"
              autoFocus
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={submitting || !newCourseName.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#1f6aa5] hover:bg-[#1a5c8e] border border-[#2b82c4] disabled:opacity-50 transition-all shadow-md"
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
            className="w-full pl-10 pr-4 py-2.5 bg-[#242424] border border-[#333333] rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1f6aa5]/40 focus:border-[#1f6aa5] shadow-xs"
          />
        </div>

        <div className="bg-[#242424] border border-[#333333] rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-slate-300 shadow-xs">
          <span>Total cadastrados:</span>
          <span className="font-bold text-[#38bdf8]">{courses.length} cursos</span>
        </div>
      </div>

      {/* Grid de Cursos */}
      {loading ? (
        <div className="bg-[#242424] rounded-2xl border border-[#333333] p-12 text-center">
          <Loader2 className="w-8 h-8 text-[#1f6aa5] animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-400">Carregando catálogo de cursos...</p>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="bg-[#242424] rounded-2xl border border-[#333333] p-12 text-center space-y-3">
          <BookOpen className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-sm font-bold text-white">Nenhum curso encontrado</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
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
                className="bg-[#242424] rounded-xl border border-[#333333] p-4 shadow-xs hover:border-[#1f6aa5]/60 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 font-mono">
                      #{idx + 1}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/60">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
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
                        className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-[#2e2e2e] border border-[#1f6aa5] focus:outline-none focus:ring-2 focus:ring-[#1f6aa5]/40 text-white"
                        placeholder="Nome do módulo..."
                      />
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={cancelEditCourse}
                          disabled={isSavingEdit}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-400 hover:text-white hover:bg-[#333333] transition-colors"
                        >
                          <X className="w-3 h-3" />
                          <span>Cancelar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEditCourse(curso.id)}
                          disabled={isSavingEdit || !editingCourseName.trim()}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold text-white bg-[#1f6aa5] hover:bg-[#1a5c8e] border border-[#2b82c4] transition-colors disabled:opacity-50"
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
                    <h3 className="text-xs font-bold text-white leading-snug">
                      {curso.nome}
                    </h3>
                  )}
                </div>

                {/* Ações do Módulo (Editar / Apagar) */}
                {!isEditing && (
                  <div className="mt-4 pt-3 border-t border-[#333333] flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => startEditCourse(curso)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-300 hover:text-[#38bdf8] hover:bg-[#1f6aa5]/20 transition-colors"
                      title="Editar nome deste módulo"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCourse(curso)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
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
