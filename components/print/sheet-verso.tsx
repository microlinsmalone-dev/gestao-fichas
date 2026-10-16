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
        fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif",
      }}
    >
      {/* ============================================================== */}
      {/* 1. TABELA PRINCIPAL DE PERFORMANCE E REPOSIÇÃO (Linhas 1 a 36) */}
      {/* ============================================================== */}
      <table
        className="w-full border-collapse border border-black table-fixed text-[7.5px]"
        style={{ width: '100%', borderSpacing: 0 }}
      >
        <colgroup>
          {/* Matriz exata de 16 Colunas A..P do ModeloFicha.xlsx Verso */}
          <col style={{ width: '8.256%' }} />  {/* A: Data */}
          <col style={{ width: '4.917%' }} />  {/* B: Horário */}
          <col style={{ width: '12.430%' }} /> {/* C: Conteúdo indicado */}
          <col style={{ width: '13.636%' }} /> {/* D: Conteúdo trabalhado */}
          <col style={{ width: '5.009%' }} />  {/* E: Revisão */}
          <col style={{ width: '5.751%' }} />  {/* F: Reposição */}
          <col style={{ width: '4.638%' }} />  {/* G: Aula */}
          <col style={{ width: '5.195%' }} />  {/* H: Apostila */}
          <col style={{ width: '4.824%' }} />  {/* I: Teste 1 */}
          <col style={{ width: '3.432%' }} />  {/* J: Teste 2 (parte 1) */}
          <col style={{ width: '1.855%' }} />  {/* K: Teste 2 (parte 2) */}
          <col style={{ width: '6.122%' }} />  {/* L: Teste 3 */}
          <col style={{ width: '3.432%' }} />  {/* M: Visto Instrutor (parte 1) */}
          <col style={{ width: '2.690%' }} />  {/* N: Visto Instrutor (parte 2) */}
          <col style={{ width: '5.751%' }} />  {/* O: Assinatura do Aluno (parte 1) */}
          <col style={{ width: '12.059%' }} /> {/* P: Assinatura do Aluno (parte 2) */}
        </colgroup>

        <thead>
          {/* LINHA 1 DO EXCEL: TÍTULO PRINCIPAL DO VERSO (A1:P1) */}
          <tr style={{ height: '10.5mm' }}>
            <th
              colSpan={16}
              className="bg-[#D9D9D9] border-b border-black text-center font-bold text-[#0070C0] text-[13.5px] px-2"
            >
              Indicações adicionais para performance do Aluno
            </th>
          </tr>

          {/* LINHA 2 DO EXCEL: CABEÇALHOS PRINCIPAIS */}
          <tr style={{ height: '4.2mm' }} className="bg-[#D9D9D9] text-[#0070C0] font-bold text-center">
            <th rowSpan={2} className="border-b border-r border-black">Data</th>
            <th rowSpan={2} className="border-b border-r border-black">Horário</th>
            <th rowSpan={2} className="border-b border-r border-black">Conteúdo indicado</th>
            <th rowSpan={2} className="border-b border-r border-black">Conteúdo trabalhado</th>
            <th colSpan={8} className="border-b border-r border-black">Indicação</th>
            <th colSpan={2} rowSpan={2} className="border-b border-r border-black leading-tight text-[7px]">
              Visto Instrutor
            </th>
            <th colSpan={2} rowSpan={2} className="border-b border-black leading-tight text-[7px]">
              Assinatura do Aluno
            </th>
          </tr>

          {/* LINHA 3 DO EXCEL: SUBCOLUNAS DE INDICAÇÃO */}
          <tr style={{ height: '3.8mm' }} className="bg-[#D9D9D9] text-[#0070C0] font-bold text-center text-[6.5px]">
            <th className="border-b border-r border-black">Revisão</th>
            <th className="border-b border-r border-black">Reposição</th>
            <th className="border-b border-r border-black">Aula</th>
            <th className="border-b border-r border-black">Apostila</th>
            <th className="border-b border-r border-black">Teste 1</th>
            <th colSpan={2} className="border-b border-r border-black">Teste 2</th>
            <th className="border-b border-r border-black">Teste 3</th>
          </tr>
        </thead>

        <tbody>
          {/* LINHAS 4 A 36 DO EXCEL: EXATAMENTE 33 LINHAS DE REGISTRO DO VERSO */}
          {Array.from({ length: 33 }).map((_, i) => (
            <tr
              key={i}
              style={{ height: '3.95mm' }}
              className="border-b border-black/80 font-mono text-[7px] text-center bg-white"
            >
              <td className="border-r border-black/80 text-slate-400 font-mono tracking-tighter text-[6.5px]">
                / &nbsp; /
              </td>
              <td className="border-r border-black/80 text-slate-400 font-mono text-[6.5px]">
                &nbsp;h&nbsp;
              </td>
              <td className="border-r border-black/80"></td>
              <td className="border-r border-black/80"></td>
              <td className="border-r border-black/80"></td>
              <td className="border-r border-black/80"></td>
              <td className="border-r border-black/80"></td>
              <td className="border-r border-black/80"></td>
              <td className="border-r border-black/80"></td>
              <td colSpan={2} className="border-r border-black/80"></td>
              <td className="border-r border-black/80"></td>
              <td colSpan={2} className="border-r border-black/80"></td>
              <td colSpan={2}></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ============================================================== */}
      {/* 2. ANOTAÇÕES COMPLEMENTARES DO VERSO (Linhas 37 a 49 do Excel) */}
      {/* ============================================================== */}
      <table
        className="w-full border-collapse border-b border-l border-r border-black table-fixed text-[8px]"
        style={{ width: '100%', borderSpacing: 0 }}
      >
        <tbody>
          {/* Linha 37: Cabeçalho */}
          <tr style={{ height: '4.2mm' }}>
            <td className="bg-[#D9D9D9] border-b border-black text-center font-bold text-[#0070C0] uppercase">
              Anotações Complementares
            </td>
          </tr>
          {/* Linhas 38 a 49: 12 Linhas pautadas em branco */}
          {Array.from({ length: 12 }).map((_, idx) => (
            <tr key={idx} style={{ height: '3.9mm' }}>
              <td className="border-b border-black bg-white"></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
