// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Component: components/courses/course-selector.tsx
// Interface de preenchimento ágil com 18 slots em grid 3x6 (Col 1: 1..6, Col 2: 7..12, Col 3: 13..18)
// Autocomplete instantâneo, drag-and-drop de reordenação nos números e modal de reordenação
// ==============================================================================

'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  X,
  ArrowUpDown,
  Trash2,
  ChevronUp,
  ChevronDown,
  Check,
  RotateCcw,
} from 'lucide-react';
import { useCourses } from '../../lib/hooks/use-courses';
import { normalizeText } from '../../lib/utils/excel-utils';
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

interface SlotState {
  curso_id: number;
  nome: string;
}

export function CourseSelector({
  selectedCourses,
  onChange,
  disabled = false,
}: CourseSelectorProps) {
  const { courses: catalog } = useCourses();
  const isInternalUpdateRef = useRef(false);

  // Inicializa 18 slots a partir de selectedCourses
  const [slots, setSlots] = useState<SlotState[]>(() => {
    return Array.from({ length: 18 }, (_, i) => {
      if (selectedCourses[i]) {
        return { curso_id: selectedCourses[i].curso_id, nome: selectedCourses[i].nome };
      }
      return { curso_id: 0, nome: '' };
    });
  });

  // Atualiza slots apenas quando selectedCourses mudar externamente (ex: abrir outro aluno)
  useEffect(() => {
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }
    setSlots(
      Array.from({ length: 18 }, (_, i) => {
        if (selectedCourses[i]) {
          return { curso_id: selectedCourses[i].curso_id, nome: selectedCourses[i].nome };
        }
        return { curso_id: 0, nome: '' };
      })
    );
  }, [selectedCourses]);

  // Propaga alterações não vazias para o pai
  const syncToParent = useCallback(
    (newSlots: SlotState[]) => {
      isInternalUpdateRef.current = true;
      const filled = newSlots
        .filter((s) => s.nome.trim() !== '' && s.curso_id > 0)
        .map((s) => ({ curso_id: s.curso_id, nome: s.nome }));
      onChange(filled);
    },
    [onChange]
  );

  // Estados de busca/dropdown ativo em um slot específico
  const [activeSlotDropdown, setActiveSlotDropdown] = useState<number | null>(null);
  const [searchTerms, setSearchTerms] = useState<{ [slotIndex: number]: string }>({});
  const [draggedSlotIndex, setDraggedSlotIndex] = useState<number | null>(null);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveSlotDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // IDs já selecionados para destacar ou avisar
  const selectedCourseIds = useMemo(() => {
    const set = new Set<number>();
    slots.forEach((s) => {
      if (s.curso_id > 0) set.add(s.curso_id);
    });
    return set;
  }, [slots]);

  // Contagem de cursos preenchidos
  const filledCount = useMemo(() => {
    return slots.filter((s) => s.curso_id > 0 && s.nome.trim() !== '').length;
  }, [slots]);

  // Manipulador de seleção de curso em um slot
  const handleSelectCourseForSlot = (slotIndex: number, curso: Curso) => {
    if (disabled) return;
    const updated = [...slots];
    updated[slotIndex] = {
      curso_id: curso.id,
      nome: curso.nome,
    };
    setSlots(updated);
    syncToParent(updated);

    // Limpa estado de busca do slot e fecha dropdown
    setSearchTerms((prev) => ({ ...prev, [slotIndex]: '' }));
    setActiveSlotDropdown(null);
  };

  // Limpar um slot individual
  const handleClearSlot = (slotIndex: number) => {
    if (disabled) return;
    const updated = [...slots];
    updated[slotIndex] = { curso_id: 0, nome: '' };
    setSlots(updated);
    syncToParent(updated);
    setSearchTerms((prev) => ({ ...prev, [slotIndex]: '' }));
  };

  // Limpar todos os slots
  const handleClearAll = () => {
    if (disabled) return;
    const updated = Array.from({ length: 18 }, () => ({ curso_id: 0, nome: '' }));
    setSlots(updated);
    syncToParent(updated);
    setSearchTerms({});
    setActiveSlotDropdown(null);
  };

  // Drag and drop entre números/slots
  const handleDragStart = (e: React.DragEvent, slotIndex: number) => {
    if (disabled) return;
    setDraggedSlotIndex(slotIndex);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(slotIndex));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetSlotIndex: number) => {
    e.preventDefault();
    if (disabled || draggedSlotIndex === null || draggedSlotIndex === targetSlotIndex) {
      setDraggedSlotIndex(null);
      return;
    }

    const updated = [...slots];
    const sourceItem = updated[draggedSlotIndex];
    const targetItem = updated[targetSlotIndex];

    // Troca de posição (Swap direto como no sistema desktop)
    updated[draggedSlotIndex] = targetItem;
    updated[targetSlotIndex] = sourceItem;

    setSlots(updated);
    syncToParent(updated);
    setDraggedSlotIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedSlotIndex(null);
  };

  // Funções para o modal de reordenação sequencial
  const handleMoveItemInReorder = (fromIndex: number, toIndex: number) => {
    const filled = slots.filter((s) => s.curso_id > 0 && s.nome.trim() !== '');
    if (toIndex < 0 || toIndex >= filled.length) return;

    const updatedFilled = [...filled];
    const [moved] = updatedFilled.splice(fromIndex, 1);
    updatedFilled.splice(toIndex, 0, moved);

    const newSlots = Array.from({ length: 18 }, (_, i) => {
      return updatedFilled[i] ? { ...updatedFilled[i] } : { curso_id: 0, nome: '' };
    });

    setSlots(newSlots);
    syncToParent(newSlots);
  };

  const handleRemoveItemInReorder = (indexToRemove: number) => {
    const filled = slots.filter((s) => s.curso_id > 0 && s.nome.trim() !== '');
    const updatedFilled = filled.filter((_, idx) => idx !== indexToRemove);

    const newSlots = Array.from({ length: 18 }, (_, i) => {
      return updatedFilled[i] ? { ...updatedFilled[i] } : { curso_id: 0, nome: '' };
    });

    setSlots(newSlots);
    syncToParent(newSlots);
  };

  // Renderização de cada coluna (6 slots por coluna)
  const renderColumn = (startIndex: number, endIndex: number, colNumber: number) => {
    const columnSlots = slots.slice(startIndex, endIndex);

    return (
      <div key={`col-${colNumber}`} className="space-y-2.5">
        {columnSlots.map((slot, localIdx) => {
          const slotIndex = startIndex + localIdx;
          const slotNumber = slotIndex + 1;
          const isDropdownOpen = activeSlotDropdown === slotIndex;
          const currentSearch = searchTerms[slotIndex] ?? '';
          const hasValue = slot.curso_id > 0 && slot.nome.trim() !== '';

          // Filtra catálogo para o dropdown desse slot
          const filteredOptions = catalog.filter((c) => {
            if (!currentSearch.trim()) return true;
            return normalizeText(c.nome).includes(normalizeText(currentSearch));
          });

          return (
            <div
              key={`slot-${slotIndex}`}
              className={`relative flex items-center gap-2 p-1.5 rounded-xl border transition-all ${
                draggedSlotIndex === slotIndex
                  ? 'border-blue-500 bg-blue-950/40 shadow-sm'
                  : hasValue
                  ? 'border-slate-700 bg-[#2b2b2b] hover:border-blue-500'
                  : 'border-slate-800 bg-[#222222] hover:bg-[#2a2a2a] hover:border-slate-700'
              }`}
            >
              {/* Número do Slot (Badge Arrastável como na img3) */}
              <div
                draggable={!disabled}
                onDragStart={(e) => handleDragStart(e, slotIndex)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, slotIndex)}
                onDragEnd={handleDragEnd}
                title="Clique e arraste este número para trocar a posição do curso"
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs select-none cursor-grab active:cursor-grabbing shrink-0 transition-transform hover:scale-105 shadow-2xs ${
                  hasValue
                    ? 'bg-[#1f6aa5] text-white'
                    : 'bg-[#333333] text-slate-400 hover:bg-[#1f6aa5]/40 hover:text-white'
                }`}
              >
                {slotNumber}
              </div>

              {/* Campo de Entrada / Autocomplete do Slot */}
              <div className="flex-1 relative min-w-0">
                <input
                  id={`course-slot-${slotIndex}`}
                  type="text"
                  tabIndex={slotIndex + 1}
                  disabled={disabled}
                  value={isDropdownOpen ? currentSearch : slot.nome}
                  onFocus={() => {
                    setActiveSlotDropdown(slotIndex);
                    setSearchTerms((prev) => ({
                      ...prev,
                      [slotIndex]: slot.nome || '',
                    }));
                  }}
                  onChange={(e) => {
                    setSearchTerms((prev) => ({
                      ...prev,
                      [slotIndex]: e.target.value,
                    }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setActiveSlotDropdown(null);
                    } else if (e.key === 'Tab') {
                      setActiveSlotDropdown(null);
                      if (!e.shiftKey) {
                        if (slotIndex < 17) {
                          e.preventDefault();
                          const next = document.getElementById(`course-slot-${slotIndex + 1}`);
                          next?.focus();
                        }
                      } else {
                        if (slotIndex > 0) {
                          e.preventDefault();
                          const prev = document.getElementById(`course-slot-${slotIndex - 1}`);
                          prev?.focus();
                        }
                      }
                    } else if (e.key === 'Enter') {
                      if (isDropdownOpen && filteredOptions.length > 0) {
                        e.preventDefault();
                        handleSelectCourseForSlot(slotIndex, filteredOptions[0]);
                        setActiveSlotDropdown(null);
                        if (slotIndex < 17) {
                          const next = document.getElementById(`course-slot-${slotIndex + 1}`);
                          next?.focus();
                        }
                      }
                    }
                  }}
                  placeholder={`Módulo ${slotNumber}...`}
                  className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none transition-all truncate pr-6 font-medium ${
                    hasValue
                      ? 'bg-[#333333] border-slate-600 text-white focus:border-[#1f6aa5] focus:bg-[#3a3a3a]'
                      : 'bg-transparent border-dashed border-slate-700 text-slate-400 placeholder-slate-500 focus:border-[#1f6aa5] focus:bg-[#333333] focus:text-white focus:border-solid'
                  }`}
                />

                {/* Botão de Limpar Slot */}
                {hasValue && !disabled && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => handleClearSlot(slotIndex)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                    title={`Limpar módulo ${slotNumber}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Dropdown de Autocomplete para este Slot */}
                {isDropdownOpen && !disabled && (
                  <div className="absolute z-40 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-[#242424] rounded-xl shadow-2xl border border-slate-700 py-1 divide-y divide-slate-700/60 animate-in fade-in duration-100">
                    {filteredOptions.length > 0 ? (
                      filteredOptions.slice(0, 12).map((c) => {
                        const isSelectedInThisSlot = slot.curso_id === c.id;
                        const isUsedInOtherSlot =
                          selectedCourseIds.has(c.id) && !isSelectedInThisSlot;

                        return (
                          <button
                            key={c.id}
                            type="button"
                            tabIndex={-1}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectCourseForSlot(slotIndex, c);
                            }}
                            onClick={() => {
                              handleSelectCourseForSlot(slotIndex, c);
                            }}
                            className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between transition-colors ${
                              isSelectedInThisSlot
                                ? 'bg-[#1f6aa5]/30 text-[#38bdf8] font-bold'
                                : 'text-slate-200 hover:bg-[#333333]'
                            }`}
                          >
                            <span className="truncate pr-2">{c.nome}</span>
                            {isSelectedInThisSlot ? (
                              <Check className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
                            ) : isUsedInOtherSlot ? (
                              <span className="text-[10px] text-amber-300 bg-amber-950/50 border border-amber-800/40 px-1.5 py-0.5 rounded shrink-0">
                                Já alocado
                              </span>
                            ) : null}
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-3 py-2 text-xs text-slate-400 text-center">
                        Nenhum curso encontrado no catálogo
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const filledItemsList = slots.filter((s) => s.curso_id > 0 && s.nome.trim() !== '');

  return (
    <div className="space-y-4" ref={containerRef}>
      {/* Top Header com Título e Ações da Tela de Cursos */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1e1e1e] border border-slate-700/80 p-3 rounded-2xl">
        <h3 className="text-sm font-bold text-white tracking-wide uppercase">
          Cursos Contratados
        </h3>

        {/* Botões de Ação Rápida */}
        <div className="flex items-center gap-2">
          {filledCount > 1 && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setIsReorderModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-200 bg-[#2a2a2a] border border-slate-700 hover:bg-[#333333] transition-colors shadow-2xs"
              title="Abrir painel para reordenar cursos sequencialmente"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>Reordenar</span>
            </button>
          )}

          {filledCount > 0 && (
            <button
              type="button"
              disabled={disabled}
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-rose-300 bg-rose-950/40 border border-rose-800/50 hover:bg-rose-900/40 transition-colors shadow-2xs"
              title="Limpar todos os 18 slots"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar Todos</span>
            </button>
          )}
        </div>
      </div>

      {/* Grade de 3 Colunas x 6 Linhas (Layout Exato da img3) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {renderColumn(0, 6, 1)}
        {renderColumn(6, 12, 2)}
        {renderColumn(12, 18, 3)}
      </div>

      {/* Modal Dedicado de Reordenação de Cursos Escolhidos */}
      {isReorderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#242424] rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-700 space-y-4 animate-in zoom-in-95 text-white">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white">
                  Reordenar Cursos Escolhidos
                </h4>
                <p className="text-xs text-slate-400">
                  Ajuste a ordem sequencial com as setas para cima ou para baixo
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsReorderModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {filledItemsList.length > 0 ? (
                filledItemsList.map((item, idx) => (
                  <div
                    key={`${item.curso_id}-${idx}`}
                    className="flex items-center gap-2 p-2 rounded-xl bg-[#2e2e2e] border border-slate-700 text-xs"
                  >
                    <span className="w-5 h-5 rounded-md bg-[#1f6aa5] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="flex-1 font-semibold text-slate-100 truncate">
                      {item.nome}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveItemInReorder(idx, idx - 1)}
                        className="p-1 rounded text-slate-400 hover:text-[#38bdf8] hover:bg-blue-950/40 disabled:opacity-30"
                        title="Subir posição"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === filledItemsList.length - 1}
                        onClick={() => handleMoveItemInReorder(idx, idx + 1)}
                        className="p-1 rounded text-slate-400 hover:text-[#38bdf8] hover:bg-blue-950/40 disabled:opacity-30"
                        title="Descer posição"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveItemInReorder(idx)}
                        className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/40"
                        title="Remover curso"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">
                  Nenhum curso preenchido para reordenar.
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-700 flex justify-end">
              <button
                type="button"
                onClick={() => setIsReorderModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#1f6aa5] hover:bg-[#154f78] rounded-xl shadow-xs transition-colors"
              >
                Concluir Reordenação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
