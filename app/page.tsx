// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS POTIRENDABA
// Page: app/page.tsx
// Dashboard principal com KPIs dinâmicos, busca, filtros avançados,
// tabela de alunos com ordenação, seleção múltipla e modais de CRUD
// ==============================================================================

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  Filter,
  Plus,
  Printer,
  Download,
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useStudents } from '../lib/hooks/use-students';
import { useCourses } from '../lib/hooks/use-courses';
import { StudentTable } from '../components/students/student-table';
import { StudentModal } from '../components/students/student-modal';
import { ScheduleDialog } from '../components/print/schedule-dialog';
import { useDialog } from '../components/ui/dialog';
import type { StudentWithCourses, FichaInsert, ScheduleConfig } from '../types/database';
import type { SelectedCourse } from '../components/courses/course-selector';

export default function DashboardPage() {
  const router = useRouter();
  const { showConfirm, showToast } = useDialog();

  // Dados gerenciados via hooks Supabase
  const {
    students,
    loading: studentsLoading,
    error: studentsError,
    addStudent,
    updateStudent,
    deleteStudent,
    refresh: refreshStudents,
  } = useStudents();

  const { courses: catalogCourses, loading: coursesLoading } = useCourses();

  // Estados de busca e filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInstructor, setSelectedInstructor] = useState('all');
  const [selectedCourseId, setSelectedCourseId] = useState<number | 'all'>('all');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  // Lê parâmetro de busca da URL se houver (ex: vindo de /cursos)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const busca = params.get('busca');
      if (busca) {
        setSearchQuery(busca);
      }
    }
  }, []);

  // Seleção de alunos para impressão em lote
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Estado do modal de cadastro/edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentWithCourses | null>(null);

  // Estado do modal de agendamento de impressão
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [pendingPrintIds, setPendingPrintIds] = useState<number[]>([]);

  // Lista única de instrutores disponíveis a partir dos alunos
  const availableInstructors = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.instrutor && s.instrutor.trim()) {
        set.add(s.instrutor.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [students]);

  // Contadores para os KPI cards
  const totalStudents = students.length || 280;
  const totalCourses = catalogCourses.length || 105;

  // Manipuladores de Seleção
  const handleToggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(
    (filteredIds: number[]) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        const allFilteredSelected = filteredIds.every((id) => next.has(id));

        if (allFilteredSelected) {
          // Desmarca todos os filtrados
          filteredIds.forEach((id) => next.delete(id));
        } else {
          // Marca todos os filtrados
          filteredIds.forEach((id) => next.add(id));
        }
        return next;
      });
    },
    []
  );

  // Abrir Modal para Novo Aluno
  const handleOpenNewStudent = () => {
    setEditingStudent(null);
    setIsModalOpen(true);
  };

  // Abrir Modal para Edição
  const handleEditStudent = (student: StudentWithCourses) => {
    setEditingStudent(student);
    setIsModalOpen(true);
  };

  // Confirmação e Exclusão de Aluno
  const handleDeleteStudent = (student: StudentWithCourses) => {
    showConfirm({
      title: 'Confirmar Exclusão',
      message: `Tem certeza que deseja excluir o cadastro de "${student.nome}" (Matrícula: ${student.matricula})?\nEsta ação removerá todos os cursos e registros pedagógicos vinculados.`,
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      type: 'warning',
      onConfirm: async () => {
        const res = await deleteStudent(student.id);
        if (res.success) {
          // Remove da seleção se estava selecionado
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(student.id);
            return next;
          });
          showToast(
            `Aluno "${student.nome}" excluído com sucesso.`,
            'success',
            'Excluído'
          );
        } else {
          showToast(res.error || 'Erro ao excluir aluno.', 'error', 'Erro');
        }
      },
    });
  };

  // Ação de Impressão Individual
  const handlePrintStudent = (student: StudentWithCourses) => {
    setPendingPrintIds([student.id]);
    setIsScheduleModalOpen(true);
  };

  // Ação de Impressão em Massa / Selecionados
  const handlePrintSelected = () => {
    if (selectedIds.size === 0) {
      showToast(
        'Por favor, selecione ao menos um aluno na tabela para imprimir as fichas.',
        'warning',
        'Nenhum aluno selecionado'
      );
      return;
    }
    setPendingPrintIds(Array.from(selectedIds));
    setIsScheduleModalOpen(true);
  };

  // Confirmação do diálogo de agendamento e redirecionamento para impressão
  const handleConfirmScheduleAndPrint = (config: ScheduleConfig) => {
    setIsScheduleModalOpen(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('microlins_schedule_config', JSON.stringify(config));
    }
    const idsParam = pendingPrintIds.join(',');
    router.push(`/imprimir?ids=${idsParam}`);
  };

  // Salvar Aluno (Novo ou Atualizado)
  const handleSaveStudent = async (
    data: FichaInsert,
    courses: SelectedCourse[]
  ): Promise<{ success: boolean; error?: string }> => {
    if (editingStudent) {
      const res = await updateStudent(editingStudent.id, data, courses);
      if (res.success) {
        showToast(
          `Dados de "${data.nome}" atualizados com sucesso.`,
          'success',
          'Aluno Atualizado'
        );
      }
      return res;
    } else {
      const res = await addStudent(data, courses);
      if (res.success) {
        showToast(
          `Novo aluno "${data.nome}" cadastrado com sucesso.`,
          'success',
          'Aluno Cadastrado'
        );
      }
      return res;
    }
  };

  // Limpar todos os filtros aplicados
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedInstructor('all');
    setSelectedCourseId('all');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedInstructor !== 'all' ||
    selectedCourseId !== 'all';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Cards de Métricas e KPIs do Sistema */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* KPI 1: Alunos Cadastrados */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#0f3b7d] flex items-center justify-center font-bold shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">Alunos Cadastrados</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
              {studentsLoading ? '...' : totalStudents}
            </h3>
            <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Base de Dados Ativa
            </span>
          </div>
        </div>

        {/* KPI 2: Cursos Catalogados */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-[#d91a2a] flex items-center justify-center font-bold shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">Cursos Catalogados</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
              {coursesLoading ? '...' : totalCourses}
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">
              Catálogo Institucional
            </span>
          </div>
        </div>

        {/* KPI 3: Status do Banco */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">Status do Banco</p>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5 truncate">
              {studentsError ? 'Desconectado' : 'Conectado'}
            </h3>
            <span className="text-[11px] text-emerald-600 font-medium">
              Supabase PostgreSQL
            </span>
          </div>
        </div>
      </div>

      {/* Alerta de Erro de Conexão (se houver) */}
      {studentsError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Erro ao conectar ao Supabase: {studentsError}</span>
          </div>
          <button
            type="button"
            onClick={() => refreshStudents()}
            className="px-3 py-1 bg-white border border-rose-300 rounded-lg text-rose-700 hover:bg-rose-100 font-medium transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Barra de Ferramentas Principal: Busca, Filtros e Ações */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Campo de Busca em Tempo Real */}
          <div className="flex-1 max-w-lg relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, matrícula, instrutor, telefone ou email..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d] transition-all"
            />
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Toggle Painel de Filtros */}
            <button
              type="button"
              onClick={() => setShowFiltersPanel((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                showFiltersPanel || hasActiveFilters
                  ? 'bg-blue-50 text-[#0f3b7d] border border-blue-200/80'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70 border border-transparent'
              }`}
            >
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>Filtros</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-[#0f3b7d]" />
              )}
            </button>

            {/* Imprimir Selecionados */}
            <button
              type="button"
              onClick={handlePrintSelected}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                selectedIds.size > 0
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
              }`}
              title={
                selectedIds.size > 0
                  ? `Imprimir fichas de ${selectedIds.size} aluno(s) selecionado(s)`
                  : 'Selecione alunos na tabela para imprimir em lote'
              }
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
              {selectedIds.size > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-800 text-white text-[10px]">
                  {selectedIds.size}
                </span>
              )}
            </button>

            {/* Módulo Excel */}
            <Link
              href="/excel"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/70 rounded-xl transition-all"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Excel</span>
            </Link>

            {/* Botão Novo Aluno */}
            <button
              type="button"
              onClick={handleOpenNewStudent}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0f3b7d] hover:bg-[#0a2e68] rounded-xl shadow-xs transition-all ml-auto sm:ml-0"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Aluno</span>
            </button>
          </div>
        </div>

        {/* Painel Expansível de Filtros Avançados */}
        {showFiltersPanel && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
            {/* Filtro por Instrutor */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Filtrar por Instrutor:
              </label>
              <select
                value={selectedInstructor}
                onChange={(e) => setSelectedInstructor(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d] bg-white"
              >
                <option value="all">Todos os Instrutores</option>
                {availableInstructors.map((inst) => (
                  <option key={inst} value={inst}>
                    {inst}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Curso Vinculado */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Filtrar por Curso:
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) =>
                  setSelectedCourseId(
                    e.target.value === 'all' ? 'all' : Number(e.target.value)
                  )
                }
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d] bg-white"
              >
                <option value="all">Todos os Cursos</option>
                {catalogCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Limpar Filtros */}
            <div className="flex items-end">
              <button
                type="button"
                disabled={!hasActiveFilters}
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Limpar Filtros</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabela de Alunos com Ordenação, Seleção e Ações */}
      <StudentTable
        students={students}
        loading={studentsLoading}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
        onEditStudent={handleEditStudent}
        onDeleteStudent={handleDeleteStudent}
        onPrintStudent={handlePrintStudent}
        searchQuery={searchQuery}
        selectedInstructor={selectedInstructor}
        selectedCourseId={selectedCourseId}
      />

      {/* Modal de Criação / Edição de Aluno */}
      <StudentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        student={editingStudent}
        onSave={handleSaveStudent}
      />

      {/* Modal de Configuração de Horários Pré-Impressão */}
      <ScheduleDialog
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        selectedStudentsCount={pendingPrintIds.length}
        onConfirm={handleConfirmScheduleAndPrint}
      />
    </div>
  );
}
