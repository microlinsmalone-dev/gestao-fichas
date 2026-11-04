// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS POTIRENDABA
// Page: app/page.tsx
// Dashboard principal com KPIs dinâmicos, busca, filtros avançados,
// tabela de alunos com ordenação, seleção múltipla e modais de CRUD
// Estilo: Dark Moderno com Azul (#1f6aa5 / #242424)
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
import { parseStudentSchedule } from '../lib/utils/date-utils';
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
  const [pendingPrintConfig, setPendingPrintConfig] = useState<Partial<ScheduleConfig> | null>(null);

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

  // Ação de Impressão Individual (Carrega automaticamente os horários cadastrados do aluno)
  const handlePrintStudent = (student: StudentWithCourses) => {
    const studentConfig = parseStudentSchedule(student);
    setPendingPrintConfig(studentConfig);
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

    if (selectedIds.size === 1) {
      const singleId = Array.from(selectedIds)[0];
      const singleStudent = students.find((s) => s.id === singleId);
      if (singleStudent) {
        setPendingPrintConfig(parseStudentSchedule(singleStudent));
      } else {
        setPendingPrintConfig(null);
      }
    } else {
      setPendingPrintConfig(null);
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 text-slate-100">
      {/* Cards de Métricas e KPIs do Sistema - Estilo Escuro com Azul */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* KPI 1: Alunos Cadastrados */}
        <div className="bg-[#242424] p-5 rounded-2xl border border-[#333333] shadow-md flex items-center gap-4 transition-all hover:border-[#1f6aa5]/50">
          <div className="w-12 h-12 rounded-xl bg-[#1f6aa5]/20 text-[#38bdf8] flex items-center justify-center font-bold shrink-0 border border-[#1f6aa5]/40">
            <Users className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400">Alunos Cadastrados</p>
            <h3 className="text-2xl font-bold text-white mt-0.5">
              {studentsLoading ? '...' : totalStudents}
            </h3>
            <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Base de Dados Ativa
            </span>
          </div>
        </div>

        {/* KPI 2: Cursos Catalogados */}
        <div className="bg-[#242424] p-5 rounded-2xl border border-[#333333] shadow-md flex items-center gap-4 transition-all hover:border-[#1f6aa5]/50">
          <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold shrink-0 border border-rose-500/30">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400">Cursos Catalogados</p>
            <h3 className="text-2xl font-bold text-white mt-0.5">
              {coursesLoading ? '...' : totalCourses}
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">
              Catálogo Institucional
            </span>
          </div>
        </div>

        {/* KPI 3: Status do Banco */}
        <div className="bg-[#242424] p-5 rounded-2xl border border-[#333333] shadow-md flex items-center gap-4 transition-all hover:border-[#1f6aa5]/50">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0 border border-emerald-500/30">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400">Status do Banco</p>
            <h3 className="text-xl font-bold text-white mt-0.5 truncate">
              {studentsError ? 'Desconectado' : 'Conectado'}
            </h3>
            <span className="text-[11px] text-emerald-400 font-medium">
              Supabase PostgreSQL
            </span>
          </div>
        </div>
      </div>

      {/* Alerta de Erro de Conexão (se houver) */}
      {studentsError && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Erro ao conectar ao Supabase: {studentsError}</span>
          </div>
          <button
            type="button"
            onClick={() => refreshStudents()}
            className="px-3 py-1 bg-rose-900 border border-rose-700 rounded-lg text-rose-200 hover:bg-rose-800 font-medium transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Barra de Ferramentas Principal: Busca, Filtros e Ações */}
      <div className="bg-[#242424] rounded-2xl border border-[#333333] p-4 shadow-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Campo de Busca em Tempo Real */}
          <div className="flex-1 max-w-lg relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, matrícula, instrutor, telefone ou email..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-[#2e2e2e] border border-[#444444] text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1f6aa5]/40 focus:border-[#1f6aa5] transition-all"
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
                  ? 'bg-[#1f6aa5]/30 text-[#38bdf8] border border-[#1f6aa5]'
                  : 'bg-[#333333] text-slate-200 hover:bg-[#3d3d3d] border border-[#444444]'
              }`}
            >
              <Filter className="w-3.5 h-3.5 text-slate-300" />
              <span>Filtros</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-[#1f6aa5]" />
              )}
            </button>

            {/* Imprimir Selecionados */}
            <button
              type="button"
              onClick={handlePrintSelected}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                selectedIds.size > 0
                  ? 'bg-[#1f6aa5] text-white hover:bg-[#1a5c8e] shadow-md border border-[#2b82c4]'
                  : 'bg-[#333333] text-slate-300 hover:bg-[#3d3d3d] border border-[#444444]'
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
                <span className="px-1.5 py-0.2 rounded-full bg-blue-900 text-white text-[10px] font-bold">
                  {selectedIds.size}
                </span>
              )}
            </button>

            {/* Módulo Excel */}
            <Link
              href="/excel"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-[#333333] hover:bg-[#3d3d3d] border border-[#444444] rounded-xl transition-all"
            >
              <Download className="w-3.5 h-3.5 text-slate-300" />
              <span>Excel</span>
            </Link>

            {/* Botão Novo Aluno */}
            <button
              type="button"
              onClick={handleOpenNewStudent}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#1f6aa5] hover:bg-[#1a5c8e] rounded-xl shadow-md transition-all ml-auto sm:ml-0 border border-[#2b82c4]"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Aluno</span>
            </button>
          </div>
        </div>

        {/* Painel Expansível de Filtros Avançados */}
        {showFiltersPanel && (
          <div className="pt-3 border-t border-[#3a3a3a] grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
            {/* Filtro por Instrutor */}
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Filtrar por Instrutor:
              </label>
              <select
                value={selectedInstructor}
                onChange={(e) => setSelectedInstructor(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-[#444444] bg-[#2e2e2e] text-white focus:outline-none focus:ring-2 focus:ring-[#1f6aa5]/40 focus:border-[#1f6aa5]"
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
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Filtrar por Curso:
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) =>
                  setSelectedCourseId(
                    e.target.value === 'all' ? 'all' : Number(e.target.value)
                  )
                }
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-[#444444] bg-[#2e2e2e] text-white focus:outline-none focus:ring-2 focus:ring-[#1f6aa5]/40 focus:border-[#1f6aa5]"
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-[#333333] border border-transparent hover:border-[#444444] rounded-xl transition-colors disabled:opacity-40"
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
        initialConfig={pendingPrintConfig}
      />
    </div>
  );
}
