// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Component: components/print/sheet-verso.tsx
// Ficha de Acompanhamento Individual do Aluno - Página 2 (Verso A4)
// Réplica estrutural e milimétrica 100% fiel ao ModeloFicha.xlsx do Excel
// ==============================================================================

'use client';

import React from 'react';
import type { StudentWithCourses } from '../../types/database';

interface SheetVersoProps {
  student?: StudentWithCourses;
}

export function SheetVerso({}: SheetVersoProps) {
  return (
    <div
      className="a4-sheet a4-verso bg-white text-black leading-tight border border-black box-border mx-auto select-none print:m-0 print:border-black"
      style={{
        width: '200mm',
        height: '286mm',
        maxHeight: '286mm',
        overflow: 'hidden',
        fontSize: '8.5px',
        fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif",
      }}
    >
      {/* 1. TÍTULO PRINCIPAL (Linha 1 do ModeloFicha.xlsx Verso) */}
      <div className="h-[9.5mm] bg-[#D9D9D9] border-b border-black flex items-center justify-center px-2">
        <h1 className="text-[13px] font-bold text-[#0070C0] tracking-wide text-center">
          Indicações adicionais para performance do Aluno
        </h1>
      </div>

      {/* 2. TABELA DE PERFORMANCE E REPOSIÇÃO (Linhas 2 a 36 do ModeloFicha.xlsx Verso) */}
      <div className="border-b border-black">
        {/* Cabeçalho Composto da Tabela do Verso */}
        <div className="bg-[#D9D9D9] border-b border-black text-[#0070C0] font-bold text-center text-[7.5px]">
          {/* Linha 2 do Excel: Linha Superior */}
          <div className="grid grid-cols-[8.3%_4.9%_12.4%_13.6%_36.8%_6.1%_17.9%] divide-x divide-black h-[4.2mm] items-center">
            <div className="row-span-2">Data</div>
            <div className="row-span-2">Horário</div>
            <div className="row-span-2">Conteúdo indicado</div>
            <div className="row-span-2">Conteúdo trabalhado</div>
            <div className="border-b border-black">Indicação</div>
            <div className="row-span-2 text-[7px] leading-tight">Visto Instrutor</div>
            <div className="row-span-2 text-[7px] leading-tight">Assinatura do Aluno</div>
          </div>
          {/* Linha 3 do Excel: Subcolunas da Indicação */}
          <div className="grid grid-cols-[8.3%_4.9%_12.4%_13.6%_36.8%_6.1%_17.9%] divide-x divide-black h-[3.8mm] items-center border-t border-black text-[7px] text-[#0070C0]">
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div className="grid grid-cols-7 divide-x divide-black h-full items-center font-bold text-[6.5px]">
              <div className="truncate px-0.5">Revisão</div>
              <div className="truncate px-0.5">Reposição</div>
              <div className="truncate px-0.5">Aula</div>
              <div className="truncate px-0.5">Apostila</div>
              <div className="truncate px-0.5">Teste 1</div>
              <div className="truncate px-0.5">Teste 2</div>
              <div className="truncate px-0.5">Teste 3</div>
            </div>
            <div></div>
            <div></div>
          </div>
        </div>

        {/* Linhas 4 a 36: Exatamente 33 Linhas Pautadas do Verso */}
        <div className="divide-y divide-black/80 font-mono text-[7px]">
          {Array.from({ length: 33 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[8.3%_4.9%_12.4%_13.6%_36.8%_6.1%_17.9%] divide-x divide-black/80 h-[4.0mm] items-center text-center bg-white"
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

      {/* 3. ANOTAÇÕES COMPLEMENTARES (Linhas 37 a 51 do ModeloFicha.xlsx Verso) */}
      <div className="flex flex-col flex-1">
        {/* Linha 37 do Excel: Cabeçalho */}
        <div className="h-[4.2mm] bg-[#D9D9D9] border-b border-black flex items-center justify-center font-bold text-[#0070C0] text-[8px]">
          Anotações Complementares
        </div>
        {/* Linhas 38 a 51: 14 Linhas pautadas em branco */}
        <div className="divide-y divide-black">
          {Array.from({ length: 14 }).map((_, idx) => (
            <div key={idx} className="h-[4.0mm] bg-white w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
