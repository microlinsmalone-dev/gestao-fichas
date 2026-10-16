// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Component: components/courses/course-selector.tsx
// Seleção com autocomplete, reordenação interativa (subir/descer e drag)
// e limite de 18 cursos conforme modelo de ficha A4
// ==============================================================================

'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  BookOpen,
  AlertCircle,
} from 'lucide-react';
import { useCourses } from '../../lib/hooks/use-courses';
import type { Curso } from '../../types/database';

export interface SelectedCourse {
  curso_id: number;
  nome: string;
}

interface CourseSelectorProps {
  selectedCourses: SelectedCourse[];
  onChange: (courses: SelectedCourse[]) => void;
  disabled?: boolean;
}

export function CourseSelector({
  selectedCourses,
  onChange,
  disabled = false,
}: CourseSelectorProps) {
  const { courses: catalog, loading: catalogLoading } = useCourses();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Conjunto de IDs já selecionados para evitar duplicidade
  const selectedCourseIds = useMemo(() => {
    return new Set(selectedCourses.map((c) => c.curso_id));
  }, [selectedCourses]);

  // Cursos do catálogo filtrados pela busca e que ainda não foram selecionados
  const filteredCatalog = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return catalog
      .filter((c) => !selectedCourseIds.has(c.id))
      .filter((c) => (term ? c.nome.toLowerCase().includes(term) : true))
      .slice(0, 10); // Limita lista do dropdown para fluidez
  }, [catalog, selectedCourseIds, searchTerm]);

  const canAddMore = selectedCourses.length < 18;

  const handleSelectCourse = (curso: Curso) => {
    if (!canAddMore || disabled) return;
    const updated = [...selectedCourses, { curso_id: curso.id, nome: curso.nome }];
    onChange(updated);
    setSearchTerm('');
    setIsDropdownOpen(false);
    inputRef.current?.focus();
  };

  const handleRemoveCourse = (indexToRemove: number) => {
    if (disabled) return;
    const updated = selectedCourses.filter((_, idx) => idx !== indexToRemove);
    onChange(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0 || disabled) return;
    const updated = [...selectedCourses];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    onChange(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === selectedCourses.length - 1 || disabled) return;
    const updated = [...selectedCourses];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    onChange(updated);
  };

  // Drag and drop interativo
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index || disabled) return;

    const updated = [...selectedCourses];
    const item = updated.splice(draggedIndex, 1)[0];
    updated.splice(index, 0, item);
    setDraggedIndex(index);
    onChange(updated);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-3" ref={containerRef}>
      {/* Cabeçalho da Seção de Cursos */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-[#0f3b7d]" />
          <span>Cursos Contratados & Ordem Cronológica</span>
        </label>
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            selectedCourses.length >= 18
              ? 'bg-amber-100 text-amber-800'
              : 'bg-blue-50 text-[#0f3b7d]'
          }`}
        >
          {selectedCourses.length} de 18 cursos
        </span>
      </div>

      {/* Campo de Autocomplete e Busca */}
      <div className="relative">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            disabled={disabled || !canAddMore}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            placeholder={
              !canAddMore
                ? 'Limite máximo de 18 cursos atingido'
                : catalogLoading
                ? 'Carregando catálogo de cursos...'
                : 'Digite para buscar cursos no catálogo...'
            }
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d] transition-all disabled:bg-slate-100 disabled:cursor-not-allowed"
          />
        </div>

        {/* Dropdown com os Resultados Filtrados */}
        {isDropdownOpen && canAddMore && !disabled && (
          <div className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white rounded-xl shadow-lg border border-slate-200/90 py-1 divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-150">
            {filteredCatalog.length > 0 ? (
              filteredCatalog.map((curso) => (
                <button
                  key={curso.id}
                  type="button"
                  onClick={() => handleSelectCourse(curso)}
                  className="w-full px-3.5 py-2 text-left text-xs text-slate-800 hover:bg-blue-50/80 hover:text-[#0f3b7d] flex items-center justify-between group transition-colors"
                >
                  <span className="font-medium truncate">{curso.nome}</span>
                  <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0f3b7d] shrink-0" />
                </button>
              ))
            ) : (
              <div className="px-3.5 py-2.5 text-xs text-slate-400 text-center">
                {catalogLoading
                  ? 'Carregando cursos...'
                  : searchTerm
                  ? 'Nenhum curso correspondente encontrado'
                  : 'Todos os cursos compatíveis já foram adicionados'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Alerta de Limite Máximo */}
      {!canAddMore && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            A ficha pedagógica A4 suporta exatamente até 18 cursos no verso.
          </span>
        </div>
      )}

      {/* Lista Interativa de Cursos Vinculados com Reordenação */}
      {selectedCourses.length > 0 ? (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {selectedCourses.map((course, index) => (
            <div
              key={`${course.curso_id}-${index}`}
              draggable={!disabled}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all ${
                draggedIndex === index
                  ? 'bg-blue-50/80 border-[#0f3b7d] shadow-sm'
                  : 'bg-slate-50/70 hover:bg-slate-50 border-slate-200/80'
              }`}
            >
              {/* Ícone de Arrastar */}
              <div
                className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 shrink-0"
                title="Arraste para reordenar"
              >
                <GripVertical className="w-4 h-4" />
              </div>

              {/* Badge com a Ordem Sequencial (1..18) */}
              <span className="w-5 h-5 rounded-full bg-[#0f3b7d] text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-xs">
                {index + 1}
              </span>

              {/* Nome do Curso */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {course.nome}
                </p>
              </div>

              {/* Controles de Subir e Descer */}
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  disabled={index === 0 || disabled}
                  onClick={() => handleMoveUp(index)}
                  className="p-1 rounded text-slate-400 hover:text-[#0f3b7d] hover:bg-blue-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Mover para cima"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={index === selectedCourses.length - 1 || disabled}
                  onClick={() => handleMoveDown(index)}
                  className="p-1 rounded text-slate-400 hover:text-[#0f3b7d] hover:bg-blue-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Mover para baixo"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Botão de Excluir do Vínculo */}
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleRemoveCourse(index)}
                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                title="Remover curso"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
          Nenhum curso vinculado ainda. Busque e adicione os cursos acima.
        </div>
      )}
    </div>
  );
}
