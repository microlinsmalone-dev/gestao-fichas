// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Component: components/print/sheet-verso.tsx
// Ficha de Acompanhamento Individual do Aluno - Página 2 (Verso A4)
// Réplica fiel ao ModeloFicha.xlsx (Aba Verso - Calibração de Escala ~67%)
// ==============================================================================

'use client';

import React from 'react';
import type { StudentWithCourses } from '../../types/database';

interface SheetVersoProps {
  student: StudentWithCourses;
}

export function SheetVerso({ student }: SheetVersoProps) {
  return (
    <div
      className="a4-sheet a4-verso bg-white text-black font-sans leading-tight border border-black box-border mx-auto select-none print:m-0 print:border-black"
      style={{
        width: '200mm',
        height: '287mm',
        maxHeight: '287mm',
        overflow: 'hidden',
        fontSize: '8.5px',
      }}
    >
      {/* 1. TÍTULO PRINCIPAL (Linha 1 do ModeloFicha.xlsx Verso) */}
      <div className="h-[9.0mm] bg-[#D9D9D9] border-b border-black flex items-center justify-center px-2">
        <h1 className="text-[13px] font-bold text-[#0070C0] tracking-wide uppercase text-center">
          Indicações adicionais para performance do Aluno
        </h1>
      </div>

      {/* 2. IDENTIFICAÇÃO DO ALUNO (Cabeçalho de Referência) */}
      <div className="h-[5.2mm] border-b border-black bg-slate-50 flex items-center justify-between px-3 text-[8px]">
        <div className="flex items-center gap-3">
          <span>
            <strong className="text-slate-700">Aluno: </strong>
            <span className="font-bold uppercase">{student.nome || ''}</span>
          </span>
          <span>
            <strong className="text-slate-700">Matrícula: </strong>
            <span className="font-bold">{student.matricula || ''}</span>
          </span>
        </div>
        <div>
          <span>
            <strong className="text-slate-700">Instrutor: </strong>
            <span>{student.instrutor || '—'}</span>
          </span>
        </div>
      </div>

      {/* 3. TABELA DE PERFORMANCE E REPOSIÇÃO (33 LINHAS - Linhas 2 a 36 do ModeloFicha.xlsx) */}
      <div className="border-b border-black">
        {/* Cabeçalho Composto da Tabela do Verso */}
        <div className="bg-[#D9D9D9] border-b border-black text-[#0070C0] font-bold text-center text-[7.5px]">
          {/* Linha Superior */}
          <div className="grid grid-cols-[8%_6.5%_22%_22%_25.5%_8%_8%] divide-x divide-black h-[4.5mm] items-center">
            <div className="row-span-2">Data</div>
            <div className="row-span-2">Horário</div>
            <div className="row-span-2">Conteúdo indicado</div>
            <div className="row-span-2">Conteúdo trabalhado</div>
            <div className="border-b border-black">Indicação</div>
            <div className="row-span-2 text-[7px] leading-tight">Visto Instrutor</div>
            <div className="row-span-2 text-[7px] leading-tight">Assinatura Aluno</div>
          </div>
          {/* Subcolunas da Indicação */}
          <div className="grid grid-cols-[8%_6.5%_22%_22%_25.5%_8%_8%] divide-x divide-black h-[4.0mm] items-center border-t border-black text-[7px] text-slate-800">
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div className="grid grid-cols-7 divide-x divide-black h-full items-center font-semibold text-[6.5px]">
              <div className="truncate px-0.5">Rev.</div>
              <div className="truncate px-0.5">Rep.</div>
              <div className="truncate px-0.5">Aula</div>
              <div className="truncate px-0.5">Apost.</div>
              <div className="truncate px-0.5">T1</div>
              <div className="truncate px-0.5">T2</div>
              <div className="truncate px-0.5">T3</div>
            </div>
            <div></div>
            <div></div>
          </div>
        </div>

        {/* 33 Linhas Pautadas do Verso */}
        <div className="divide-y divide-black/80 font-mono text-[7px]">
          {Array.from({ length: 33 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[8%_6.5%_22%_22%_25.5%_8%_8%] divide-x divide-black/80 h-[4.5mm] items-center text-center bg-white"
            >
              <div className="text-slate-400 font-mono tracking-tighter text-[6.5px]">
                / &nbsp; /
              </div>
              <div className="text-slate-400 font-mono text-[6.5px]">
                &nbsp;h&nbsp;
              </div>
              <div></div>
              <div></div>
              <div className="grid grid-cols-7 divide-x divide-black/80 h-full">
                <div></div>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
              </div>
              <div></div>
              <div></div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. ANOTAÇÕES COMPLEMENTARES (12 LINHAS PAUTADAS - Linhas 37 a 49 do ModeloFicha.xlsx) */}
      <div className="flex flex-col flex-1">
        <div className="h-[4.2mm] bg-[#D9D9D9] border-b border-black flex items-center justify-center font-bold text-[#0070C0] text-[8px] uppercase tracking-wide">
          Anotações Complementares
        </div>
        <div className="divide-y divide-black">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div key={idx} className="h-[4.7mm] bg-white w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
