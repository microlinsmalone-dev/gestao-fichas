// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Component: components/students/student-table.tsx
// Tabela interativa com busca, ordenação de colunas, seleção múltipla (individual/todos),
// tags ordenadas de cursos e ações (Editar, Excluir, Imprimir individual)
// ==============================================================================

'use client';

import React, { useState, useMemo } from 'react';
import {
  Edit,
  Trash2,
  Printer,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BookOpen,
  UserX,
  Phone,
  Mail,
} from 'lucide-react';
import { formatDateBR, formatPhone } from '../../lib/utils/date-utils';
import type { StudentWithCourses } from '../../types/database';

type SortField = 'matricula' | 'nome' | 'instrutor' | 'data_inicio_curso' | 'cursos_count';
type SortOrder = 'asc' | 'desc';

interface StudentTableProps {
  students: StudentWithCourses[];
  loading: boolean;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: (filteredIds: number[]) => void;
  onEditStudent: (student: StudentWithCourses) => void;
  onDeleteStudent: (student: StudentWithCourses) => void;
  onPrintStudent: (student: StudentWithCourses) => void;
  searchQuery: string;
  selectedInstructor?: string;
  selectedCourseId?: number | 'all';
}

export function StudentTable({
  students,
  loading,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onEditStudent,
  onDeleteStudent,
  onPrintStudent,
  searchQuery,
  selectedInstructor = 'all',
  selectedCourseId = 'all',
}: StudentTableProps) {
  // Ordenação
  const [sortField, setSortField] = useState<SortField>('nome');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Paginação
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 25;

  // Filtragem dos alunos
  const filteredStudents = useMemo(() => {
    let result = [...students];

    // Busca por texto em tempo real (nome, matrícula, telefone, email, instrutor)
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((student) => {
        const matricula = (student.matricula || '').toLowerCase();
        const nome = (student.nome || '').toLowerCase();
        const instrutor = (student.instrutor || '').toLowerCase();
        const email = (student.email || '').toLowerCase();
        const telefone = (student.telefone || '').toLowerCase();
        return (
          matricula.includes(query) ||
          nome.includes(query) ||
          instrutor.includes(query) ||
          email.includes(query) ||
          telefone.includes(query)
        );
      });
    }

    // Filtro por instrutor
    if (selectedInstructor && selectedInstructor !== 'all') {
      result = result.filter(
        (s) => (s.instrutor || '').toLowerCase() === selectedInstructor.toLowerCase()
      );
    }

    // Filtro por curso vinculado
    if (selectedCourseId && selectedCourseId !== 'all') {
      result = result.filter((s) =>
        s.cursos.some((c) => c.curso_id === selectedCourseId)
      );
    }

    // Ordenação dinâmica
    result.sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      switch (sortField) {
        case 'matricula':
          valA = a.matricula || '';
          valB = b.matricula || '';
          break;
        case 'nome':
          valA = a.nome || '';
          valB = b.nome || '';
          break;
        case 'instrutor':
          valA = a.instrutor || '';
          valB = b.instrutor || '';
          break;
        case 'data_inicio_curso':
          valA = a.data_inicio_curso || '';
          valB = b.data_inicio_curso || '';
          break;
        case 'cursos_count':
          valA = a.cursos?.length || 0;
          valB = b.cursos?.length || 0;
          break;
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortOrder === 'asc'
        ? strA.localeCompare(strB, 'pt-BR')
        : strB.localeCompare(strA, 'pt-BR');
    });

    return result;
  }, [students, searchQuery, selectedInstructor, selectedCourseId, sortField, sortOrder]);

  // Paginação dos registros
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  // IDs dos registros atualmente filtrados
  const filteredIds = useMemo(() => filteredStudents.map((s) => s.id), [filteredStudents]);

  // Status da master checkbox
  const isAllSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const isPartiallySelected =
    filteredIds.some((id) => selectedIds.has(id)) && !isAllSelected;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-[#0f3b7d]" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-[#0f3b7d]" />
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Container da Tabela Responsiva com Scroll Horizontal Suave */}
      <div className="overflow-x-auto min-h-[380px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none">
              {/* Checkbox Master */}
              <th className="py-3 px-4 w-12 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isPartiallySelected;
                  }}
                  onChange={() => onToggleSelectAll(filteredIds)}
                  className="rounded border-slate-300 text-[#0f3b7d] focus:ring-[#0f3b7d] cursor-pointer"
                  title="Selecionar / Desmarcar todos os alunos filtrados"
                />
              </th>

              {/* Matrícula */}
              <th
                onClick={() => handleSort('matricula')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100/60 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Matrícula</span>
                  {getSortIcon('matricula')}
                </div>
              </th>

              {/* Nome do Aluno */}
              <th
                onClick={() => handleSort('nome')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100/60 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Nome do Aluno</span>
                  {getSortIcon('nome')}
                </div>
              </th>

              {/* Telefone */}
              <th className="py-3 px-4">
                <span>Telefone</span>
              </th>

              {/* Email */}
              <th className="py-3 px-4">
                <span>E-mail</span>
              </th>

              {/* Instrutor */}
              <th
                onClick={() => handleSort('instrutor')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100/60 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Instrutor</span>
                  {getSortIcon('instrutor')}
                </div>
              </th>

              {/* Ações */}
              <th className="py-3 px-4 text-right">
                <span>Ações</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-xs">
            {loading ? (
              // Esqueleto / Loading
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-4 px-4 text-center">
                    <div className="w-4 h-4 bg-slate-200 rounded mx-auto" />
                  </td>
                  <td className="py-4 px-4">
                    <div className="w-16 h-4 bg-slate-200 rounded" />
                  </td>
                  <td className="py-4 px-4">
                    <div className="w-44 h-4 bg-slate-200 rounded" />
                  </td>
                  <td className="py-4 px-4">
                    <div className="w-28 h-4 bg-slate-200 rounded" />
                  </td>
                  <td className="py-4 px-4">
                    <div className="w-36 h-4 bg-slate-200 rounded" />
                  </td>
                  <td className="py-4 px-4">
                    <div className="w-24 h-4 bg-slate-200 rounded" />
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="w-16 h-4 bg-slate-200 rounded ml-auto" />
                  </td>
                </tr>
              ))
            ) : paginatedStudents.length > 0 ? (
              paginatedStudents.map((student) => {
                const isSelected = selectedIds.has(student.id);

                return (
                  <tr
                    key={student.id}
                    className={`transition-colors group ${
                      isSelected
                        ? 'bg-blue-50/40 hover:bg-blue-50/70'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {/* Checkbox Individual */}
                    <td className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(student.id)}
                        className="rounded border-slate-300 text-[#0f3b7d] focus:ring-[#0f3b7d] cursor-pointer"
                      />
                    </td>

                    {/* Matrícula */}
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200/60 text-[11px]">
                        {student.matricula}
                      </span>
                    </td>

                    {/* Nome do Aluno */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 group-hover:text-[#0f3b7d] transition-colors">
                        {student.nome}
                      </div>
                      {student.data_inicio_curso && (
                        <div className="text-[10px] text-slate-400">
                          Início: {formatDateBR(student.data_inicio_curso)}
                        </div>
                      )}
                    </td>

                    {/* Telefone */}
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {student.telefone ? (
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{formatPhone(student.telefone)}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="py-3 px-4 text-slate-600 max-w-[160px] truncate">
                      {student.email ? (
                        <span
                          className="flex items-center gap-1.5 truncate"
                          title={student.email}
                        >
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{student.email}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Instrutor */}
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap font-medium">
                      {student.instrutor || (
                        <span className="text-slate-400 italic font-normal">
                          Não informado
                        </span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {/* Imprimir Ficha Individual */}
                        <button
                          type="button"
                          onClick={() => onPrintStudent(student)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#0f3b7d] hover:bg-blue-50 transition-colors"
                          title={`Imprimir ficha de ${student.nome}`}
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* Editar */}
                        <button
                          type="button"
                          onClick={() => onEditStudent(student)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title="Editar aluno"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {/* Excluir */}
                        <button
                          type="button"
                          onClick={() => onDeleteStudent(student)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Excluir aluno"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              // Sem registros encontrados
              <tr>
                <td colSpan={7} className="py-12 px-4 text-center">
                  <div className="max-w-sm mx-auto space-y-2">
                    <UserX className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-sm font-semibold text-slate-700">
                      Nenhum aluno encontrado
                    </p>
                    <p className="text-xs text-slate-400">
                      Tente alterar os termos da busca ou ajustar os filtros selecionados.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Rodapé com Total de Registros e Paginação */}
      <div className="p-4 border-t border-slate-200/80 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span>
            Exibindo <strong>{paginatedStudents.length}</strong> de{' '}
            <strong>{filteredStudents.length}</strong> alunos
          </span>
          {selectedIds.size > 0 && (
            <span className="text-[#0f3b7d] font-semibold bg-blue-100/70 px-2 py-0.5 rounded-full">
              {selectedIds.size} selecionado(s)
            </span>
          )}
        </div>

        {/* Controles de Paginação */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500">
            Página {currentPage} de {totalPages}
          </span>
          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors border-r border-slate-200"
              title="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="Próxima página"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
