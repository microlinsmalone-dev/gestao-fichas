// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Component: components/print/sheet-frente.tsx
// Ficha de Acompanhamento Individual do Aluno - Página 1 (Frente A4)
// Réplica fiel ao ModeloFicha.xlsx (Aba Frente - Calibração de Escala ~65%)
// ==============================================================================

'use client';

import React from 'react';
import type { StudentWithCourses, ScheduleConfig } from '../../types/database';
import { formatDateForSheet, formatPhoneForSheet } from '../../lib/utils/date-utils';
import { WEEKDAYS } from './schedule-dialog';

interface SheetFrenteProps {
  student: StudentWithCourses;
  schedule?: ScheduleConfig;
}

export function SheetFrente({ student, schedule }: SheetFrenteProps) {
  // Matriz de até 18 cursos organizados em 3 colunas de 6 linhas
  const studentCourses = [...(student.cursos || [])].sort((a, b) => a.ordem - b.ordem);
  const courseMatrix: { slotNumber: number; name: string }[][] = [
    // Coluna 1: 1 a 6
    Array.from({ length: 6 }, (_, i) => {
      const slot = i + 1;
      const found = studentCourses.find((c) => c.ordem === slot) || studentCourses[i];
      return { slotNumber: slot, name: found?.nome || '' };
    }),
    // Coluna 2: 7 a 12
    Array.from({ length: 6 }, (_, i) => {
      const slot = i + 7;
      const found = studentCourses.find((c) => c.ordem === slot) || studentCourses[i + 6];
      return { slotNumber: slot, name: found?.nome || '' };
    }),
    // Coluna 3: 13 a 18
    Array.from({ length: 6 }, (_, i) => {
      const slot = i + 13;
      const found = studentCourses.find((c) => c.ordem === slot) || studentCourses[i + 12];
      return { slotNumber: slot, name: found?.nome || '' };
    }),
  ];

  // Horários por dia da semana
  const activeDays = schedule?.diasSemana || [];
  const getDaySchedule = (dayName: string) => {
    if (!activeDays.includes(dayName)) {
      return { inicio: '', fim: '' };
    }
    if (schedule?.diasConfig && schedule.diasConfig[dayName]) {
      return schedule.diasConfig[dayName];
    }
    return {
      inicio: schedule?.horarioInicio || '',
      fim: schedule?.horarioFim || '',
    };
  };

  // 7 Marcos Pedagógicos
  const milestones = [
    { label: 'Linha da vida', date: formatDateForSheet(student.data_linha_vida), doubleRow: true },
    { label: 'Form 1', date: formatDateForSheet(student.data_form1), doubleRow: false },
    { label: 'Form 2', date: formatDateForSheet(student.data_form2), doubleRow: false },
    { label: 'Dream Day', date: formatDateForSheet(student.data_dreamday), doubleRow: true },
    { label: 'Fechamento 1', date: formatDateForSheet(student.data_fechamento1), doubleRow: false },
    { label: 'Fechamento 2', date: formatDateForSheet(student.data_fechamento2), doubleRow: false },
    { label: 'Fechamento 3', date: formatDateForSheet(student.data_fechamento3), doubleRow: false },
  ];

  return (
    <div
      className="a4-sheet a4-frente bg-white text-black font-sans leading-tight border border-black box-border mx-auto select-none print:m-0 print:border-black"
      style={{
        width: '200mm',
        height: '287mm',
        maxHeight: '287mm',
        overflow: 'hidden',
        fontSize: '8.5px',
      }}
    >
      {/* 1. TÍTULO PRINCIPAL (Linha 1 do ModeloFicha.xlsx) */}
      <div className="h-[9.5mm] bg-[#D9D9D9] border-b border-black flex items-center justify-center px-2">
        <h1 className="text-[14px] font-bold text-[#0070C0] tracking-wide uppercase text-center">
          Ficha de Acompanhamento Individual do Aluno
        </h1>
      </div>

      {/* 2. DADOS CADASTRAIS + DATAS DE INÍCIO E TÉRMINO (Linhas 2 a 5/6) */}
      <div className="grid grid-cols-[72%_28%] border-b border-black text-[8.5px]">
        {/* Lado Esquerdo: Dados Pessoais */}
        <div className="border-r border-black divide-y divide-black">
          <div className="grid grid-cols-[30%_70%] h-[5.2mm] items-center px-1.5 divide-x divide-black">
            <div className="truncate pr-1">
              <span className="font-semibold text-slate-800">Matrícula: </span>
              <span className="font-bold">{student.matricula || ''}</span>
            </div>
            <div className="truncate pl-1.5">
              <span className="font-semibold text-slate-800">Nome do Aluno: </span>
              <span className="font-bold text-[9px] uppercase">{student.nome || ''}</span>
            </div>
          </div>

          <div className="h-[5.2mm] flex items-center px-1.5 truncate">
            <span className="font-semibold text-slate-800 mr-1">Email: </span>
            <span className="truncate">{student.email || ''}</span>
          </div>

          <div className="grid grid-cols-[38%_62%] h-[5.2mm] items-center px-1.5 divide-x divide-black">
            <div className="truncate pr-1">
              <span className="font-semibold text-slate-800">Data Nascimento: </span>
              <span>{formatDateForSheet(student.data_nascimento)}</span>
            </div>
            <div className="truncate pl-1.5">
              <span className="font-semibold text-slate-800">Instrutor: </span>
              <span className="font-medium">{student.instrutor || ''}</span>
            </div>
          </div>

          <div className="h-[5.2mm] flex items-center px-1.5 truncate">
            <span className="font-semibold text-slate-800 mr-1">Telefone: </span>
            <span>{formatPhoneForSheet(student.telefone)}</span>
          </div>
        </div>

        {/* Lado Direito: Início do Curso e Previsão de Término */}
        <div className="grid grid-cols-2 divide-x divide-black text-center">
          <div className="flex flex-col justify-between">
            <div className="h-[9.5mm] bg-[#D9D9D9] border-b border-black flex items-center justify-center p-1 font-semibold text-[8px] leading-tight text-slate-800">
              Data inicio do curso:
            </div>
            <div className="flex-1 flex items-center justify-center font-bold text-[9px] py-1 bg-white">
              {formatDateForSheet(student.data_inicio_curso)}
            </div>
          </div>
          <div className="flex flex-col justify-between">
            <div className="h-[9.5mm] bg-[#D9D9D9] border-b border-black flex items-center justify-center p-1 font-semibold text-[7.5px] leading-tight text-slate-800">
              Data prevista para término do curso:
            </div>
            <div className="flex-1 flex items-center justify-center font-bold text-[9px] py-1 bg-white">
              {formatDateForSheet(student.data_termino_curso)}
            </div>
          </div>
        </div>
      </div>

      {/* 3. QUADRO DE HORÁRIOS & DIAS DA SEMANA (Linhas 6 a 8) */}
      <div className="border-b border-black text-[8px]">
        {/* Linha Dias da Semana */}
        <div className="grid grid-cols-[14%_repeat(7,_12.28%)] h-[4.8mm] items-center divide-x divide-black border-b border-black text-center bg-[#D9D9D9]">
          <span className="font-bold text-left px-1 text-[7.5px] text-[#0070C0]">
            Dia da semana:
          </span>
          {WEEKDAYS.map((w) => (
            <span key={w} className="font-bold text-slate-800 text-[8px] truncate px-0.5">
              {w.replace('-feira', '')}
            </span>
          ))}
        </div>

        {/* Linha Horário Inicial */}
        <div className="grid grid-cols-[14%_repeat(7,_12.28%)] h-[4.8mm] items-center divide-x divide-black border-b border-black text-center bg-white">
          <span className="font-semibold text-left px-1 text-[7.5px] text-slate-700">
            Horário inicial:
          </span>
          {WEEKDAYS.map((w) => {
            const sch = getDaySchedule(w);
            return (
              <span key={w} className="font-semibold text-[8px] text-slate-900 truncate">
                {sch.inicio}
              </span>
            );
          })}
        </div>

        {/* Linha Horário Final */}
        <div className="grid grid-cols-[14%_repeat(7,_12.28%)] h-[4.8mm] items-center divide-x divide-black text-center bg-white">
          <span className="font-semibold text-left px-1 text-[7.5px] text-slate-700">
            Horário final:
          </span>
          {WEEKDAYS.map((w) => {
            const sch = getDaySchedule(w);
            return (
              <span key={w} className="font-semibold text-[8px] text-slate-900 truncate">
                {sch.fim}
              </span>
            );
          })}
        </div>
      </div>

      {/* 4. CURSOS CONTRATADOS (18 SLOTS) + MARCOS DA CARREIRA (Linhas 9 a 15) */}
      <div className="grid grid-cols-[72%_28%] border-b border-black">
        {/* Bloco de Cursos (Esquerda) */}
        <div className="border-r border-black flex flex-col">
          {/* Cabeçalho da Seção de Cursos */}
          <div className="h-[4.8mm] bg-[#D9D9D9] border-b border-black flex items-center justify-center font-bold text-[#0070C0] text-[8.5px] uppercase tracking-wide">
            Cursos / Módulos Contratados:
          </div>

          {/* Grade 3 Colunas x 6 Linhas de Cursos */}
          <div className="grid grid-cols-3 divide-x divide-black flex-1 text-[8px]">
            {courseMatrix.map((col, colIdx) => (
              <div key={colIdx} className="divide-y divide-black">
                {col.map((item) => (
                  <div
                    key={item.slotNumber}
                    className="h-[4.7mm] px-1 flex items-center overflow-hidden"
                  >
                    <span className="font-bold text-slate-600 mr-1 shrink-0">
                      {item.slotNumber}.
                    </span>
                    <span
                      className="truncate font-medium text-slate-900 text-[7.5px]"
                      title={item.name}
                    >
                      {item.name}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Bloco de Marcos Pedagógicos (Direita) */}
        <div className="grid grid-cols-[18%_82%] divide-x divide-black text-[7.5px]">
          {/* Faixa Lateral "De olho na carreira do aluno" */}
          <div className="bg-[#D9D9D9] flex items-center justify-center p-0.5 font-bold text-[#0070C0] text-center select-none">
            <span
              className="inline-block transform -rotate-90 whitespace-nowrap text-[7.5px] tracking-tight uppercase"
              style={{ transformOrigin: 'center center' }}
            >
              Carreira do aluno
            </span>
          </div>

          {/* Tabela de 7 Marcos */}
          <div className="flex flex-col divide-y divide-black justify-between text-[7.5px]">
            {milestones.map((m, idx) => (
              <div
                key={idx}
                className={`grid grid-cols-[55%_45%] divide-x divide-black items-center ${
                  m.doubleRow ? 'h-[5.0mm]' : 'h-[4.0mm]'
                }`}
              >
                <div className="px-1 font-semibold text-slate-800 truncate">{m.label}</div>
                <div className="px-1 text-center font-bold text-slate-900 truncate">
                  {m.date}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. TABELA DE REGISTRO DE AULAS (33 LINHAS - Linhas 16 a 50) */}
      <div className="border-b border-black">
        {/* Cabeçalho da Tabela de Frequência / Estágio */}
        <div className="bg-[#D9D9D9] border-b border-black text-[#0070C0] font-bold text-center text-[7.5px]">
          {/* Linha Superior do Cabeçalho */}
          <div className="grid grid-cols-[8%_6.5%_31%_26%_7.5%_7%_14%] divide-x divide-black h-[4.5mm] items-center">
            <div className="row-span-2">Data</div>
            <div className="row-span-2">Horário</div>
            <div className="row-span-2">Curso / Aula / Conteúdo</div>
            <div className="border-b border-black">Estágio da Aula</div>
            <div className="row-span-2">Instrutor</div>
            <div className="row-span-2">Coord.</div>
            <div className="row-span-2">Assinatura do Aluno</div>
          </div>
          {/* Subcolunas do Estágio */}
          <div className="grid grid-cols-[8%_6.5%_31%_26%_7.5%_7%_14%] divide-x divide-black h-[4.0mm] items-center border-t border-black text-[7px] text-slate-800">
            <div></div>
            <div></div>
            <div></div>
            <div className="grid grid-cols-5 divide-x divide-black h-full items-center font-semibold">
              <div>Aula</div>
              <div>Apost.</div>
              <div>T1</div>
              <div>T2</div>
              <div>T3</div>
            </div>
            <div></div>
            <div></div>
            <div></div>
          </div>
        </div>

        {/* 33 Linhas de Registro Pautadas */}
        <div className="divide-y divide-black/80 font-mono text-[7px]">
          {Array.from({ length: 33 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[8%_6.5%_31%_26%_7.5%_7%_14%] divide-x divide-black/80 h-[4.25mm] items-center text-center bg-white"
            >
              <div className="text-slate-400 font-mono tracking-tighter text-[6.5px]">
                / &nbsp; /
              </div>
              <div className="text-slate-400 font-mono text-[6.5px]">
                &nbsp;h&nbsp;
              </div>
              <div></div>
              <div className="grid grid-cols-5 divide-x divide-black/80 h-full">
                <div></div>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
              </div>
              <div></div>
              <div></div>
              <div></div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. ANOTAÇÕES COMPLEMENTARES (8 LINHAS PAUTADAS - Linhas 51 a 59) */}
      <div className="flex flex-col">
        <div className="h-[4.0mm] bg-[#D9D9D9] border-b border-black flex items-center justify-center font-bold text-[#0070C0] text-[8px] uppercase tracking-wide">
          Anotações complementares
        </div>
        <div className="divide-y divide-black">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="h-[4.1mm] bg-white w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
