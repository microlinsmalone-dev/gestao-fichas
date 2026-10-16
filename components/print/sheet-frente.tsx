// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Component: components/print/sheet-frente.tsx
// Ficha de Acompanhamento Individual do Aluno - Página 1 (Frente A4)
// Réplica estrutural e milimétrica 100% fiel ao ModeloFicha.xlsx do Excel
// ==============================================================================

'use client';

import React from 'react';
import type { StudentWithCourses, ScheduleConfig } from '../../types/database';
import { formatDateForSheet, formatPhoneForSheet } from '../../lib/utils/date-utils';
import { MICROLINS_LOGO_BASE64 } from '../../lib/constants/microlins-logo';

interface SheetFrenteProps {
  student: StudentWithCourses;
  schedule?: ScheduleConfig;
}

const WEEKDAYS = [
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
  'Domingo',
];

export function SheetFrente({ student, schedule }: SheetFrenteProps) {
  // Matriz de até 18 cursos organizados em 3 colunas de 6 linhas (Linhas 10 a 15 do Excel)
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

  // Recupera horário por dia da semana
  const activeDays = schedule?.diasSemana || [];
  const getDaySchedule = (dayName: string) => {
    const fullName = `${dayName}-feira`;
    const isDayActive =
      activeDays.includes(dayName) ||
      activeDays.includes(fullName) ||
      (schedule?.diasConfig && (schedule.diasConfig[dayName] || schedule.diasConfig[fullName]));

    if (schedule?.diasConfig) {
      if (schedule.diasConfig[dayName]) return schedule.diasConfig[dayName];
      if (schedule.diasConfig[fullName]) return schedule.diasConfig[fullName];
    }

    if (isDayActive) {
      return {
        inicio: schedule?.horarioInicio || 'h',
        fim: schedule?.horarioFim || 'h',
      };
    }

    // No modelo Excel, células sem horário exibem "h" centralizado
    return { inicio: 'h', fim: 'h' };
  };

  // 7 Marcos Pedagógicos (Linhas 7 a 15 do Excel)
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
      className="a4-sheet a4-frente bg-white text-black leading-tight border border-black box-border mx-auto select-none print:m-0 print:border-black"
      style={{
        width: '200mm',
        height: '286mm',
        maxHeight: '286mm',
        overflow: 'hidden',
        fontSize: '8.5px',
        fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif",
      }}
    >
      {/* 1. TÍTULO PRINCIPAL + LOGO MICROLINS (Linha 1 do ModeloFicha.xlsx: A1:L1 e M1:P1) */}
      <div className="grid grid-cols-[76%_24%] border-b border-black h-[10.5mm]">
        {/* Lado Esquerdo (A1:L1): Título em Azul com fundo cinza claro #D9D9D9 */}
        <div className="bg-[#D9D9D9] border-r border-black flex items-center justify-center px-2">
          <h1 className="text-[14px] font-bold text-[#0070C0] tracking-wide text-center">
            Ficha de Acompanhamento Individual do Aluno
          </h1>
        </div>

        {/* Lado Direito (M1:P1): Logotipo oficial Microlins + V1.0 */}
        <div className="bg-white flex flex-col items-center justify-center p-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={MICROLINS_LOGO_BASE64}
            alt="Microlins"
            className="h-[5.5mm] w-auto object-contain mx-auto"
          />
          <span className="text-[6.5px] text-slate-700 tracking-tight text-center leading-none mt-0.5">
            Gerado por aplicação. V1.0
          </span>
        </div>
      </div>

      {/* 2. CORPO INTERMEDIÁRIO DUAS COLUNAS PARALELAS (Linhas 2 a 15 do Excel) */}
      <div className="grid grid-cols-[76%_24%] border-b border-black">
        {/* ============================================================== */}
        {/* COLUNA ESQUERDA (Colunas A a L do Excel - 76% da largura)      */}
        {/* Contém: Dados Pessoais (2-5) + Horários (6-8) + Cursos (9-15)  */}
        {/* ============================================================== */}
        <div className="border-r border-black flex flex-col">
          {/* A) DADOS CADASTRAIS (Linhas 2 a 5 do Excel) */}
          <div className="divide-y divide-black">
            {/* Linha 2: Matrícula e Nome */}
            <div className="grid grid-cols-[33%_67%] h-[4.6mm] items-center px-1.5 divide-x divide-black">
              <div className="truncate pr-1">
                <span className="text-slate-800">Matrícula: </span>
                <span className="font-bold">{student.matricula || ''}</span>
              </div>
              <div className="truncate pl-1.5">
                <span className="text-slate-800">Nome do Aluno: </span>
                <span className="font-bold text-[9px] uppercase">{student.nome || ''}</span>
              </div>
            </div>

            {/* Linha 3: Email */}
            <div className="h-[4.6mm] flex items-center px-1.5 truncate">
              <span className="text-slate-800 mr-1">Email: </span>
              <span className="truncate">{student.email || ''}</span>
            </div>

            {/* Linha 4: Data de Nascimento e Instrutor */}
            <div className="grid grid-cols-[38%_62%] h-[4.6mm] items-center px-1.5 divide-x divide-black">
              <div className="truncate pr-1">
                <span className="text-slate-800">Data Nascimento: </span>
                <span>{formatDateForSheet(student.data_nascimento)}</span>
              </div>
              <div className="truncate pl-1.5">
                <span className="text-slate-800">Instrutor: </span>
                <span className="font-medium">{student.instrutor || ''}</span>
              </div>
            </div>

            {/* Linha 5: Telefone */}
            <div className="h-[4.6mm] flex items-center px-1.5 truncate">
              <span className="text-slate-800 mr-1">Telefone: </span>
              <span>{formatPhoneForSheet(student.telefone)}</span>
            </div>
          </div>

          {/* B) QUADRO DE HORÁRIOS & DIAS DA SEMANA (Linhas 6 a 8 do Excel) */}
          <div className="border-t border-black text-[8px]">
            {/* Linha 6: Dias da Semana */}
            <div className="grid grid-cols-[14%_repeat(7,_12.28%)] h-[4.4mm] items-center divide-x divide-black border-b border-black text-center bg-white">
              <span className="text-left px-1 text-[7px] text-slate-900 font-semibold">
                Dia da semana:
              </span>
              {WEEKDAYS.map((w) => (
                <span key={w} className="font-semibold text-slate-900 text-[7.5px] truncate px-0.5">
                  {w}
                </span>
              ))}
            </div>

            {/* Linha 7: Horário Inicial */}
            <div className="grid grid-cols-[14%_repeat(7,_12.28%)] h-[4.4mm] items-center divide-x divide-black border-b border-black text-center bg-white">
              <span className="text-left px-1 text-[7px] text-slate-800">
                Horário inicial:
              </span>
              {WEEKDAYS.map((w) => {
                const sch = getDaySchedule(w);
                const isPlaceholder = sch.inicio === 'h' || !sch.inicio;
                return (
                  <span
                    key={w}
                    className={`text-[7.5px] truncate ${
                      isPlaceholder ? 'text-slate-400 font-mono' : 'font-bold text-slate-900'
                    }`}
                  >
                    {sch.inicio || 'h'}
                  </span>
                );
              })}
            </div>

            {/* Linha 8: Horário Final */}
            <div className="grid grid-cols-[14%_repeat(7,_12.28%)] h-[4.4mm] items-center divide-x divide-black border-b border-black text-center bg-white">
              <span className="text-left px-1 text-[7px] text-slate-800">
                Horário final:
              </span>
              {WEEKDAYS.map((w) => {
                const sch = getDaySchedule(w);
                const isPlaceholder = sch.fim === 'h' || !sch.fim;
                return (
                  <span
                    key={w}
                    className={`text-[7.5px] truncate ${
                      isPlaceholder ? 'text-slate-400 font-mono' : 'font-bold text-slate-900'
                    }`}
                  >
                    {sch.fim || 'h'}
                  </span>
                );
              })}
            </div>
          </div>

          {/* C) CURSOS CONTRATADOS (Linhas 9 a 15 do Excel - 18 Slots) */}
          <div className="flex flex-col flex-1">
            {/* Linha 9: Cabeçalho da Seção de Cursos */}
            <div className="h-[4.4mm] bg-[#D9D9D9] border-b border-black flex items-center justify-center font-bold text-[#0070C0] text-[8px]">
              Cursos / Módulos Contratados:
            </div>

            {/* Linhas 10 a 15: Grade 3 Colunas x 6 Linhas de Cursos */}
            <div className="grid grid-cols-3 divide-x divide-black flex-1 text-[8px]">
              {courseMatrix.map((col, colIdx) => (
                <div key={colIdx} className="divide-y divide-black">
                  {col.map((item) => (
                    <div
                      key={item.slotNumber}
                      className="h-[4.4mm] px-1 flex items-center overflow-hidden bg-white"
                    >
                      <span className="font-semibold text-slate-700 mr-1 shrink-0">
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
        </div>

        {/* ============================================================== */}
        {/* COLUNA DIREITA (Colunas M a P do Excel - 24% da largura)       */}
        {/* Contém: Início/Término (2-6) + De olho na carreira (7-15)      */}
        {/* ============================================================== */}
        <div className="flex flex-col">
          {/* A) DATAS DE INÍCIO E TÉRMINO DO CURSO (Linhas 2 a 6 do Excel) */}
          <div className="grid grid-cols-2 divide-x divide-black border-b border-black text-center h-[23.0mm]">
            <div className="flex flex-col justify-between">
              <div className="h-[14.5mm] bg-[#D9D9D9] border-b border-black flex items-center justify-center p-1 text-[7.5px] leading-tight text-slate-800 font-semibold">
                Data inicio do curso:
              </div>
              <div className="flex-1 flex items-center justify-center font-bold text-[9px] py-1 bg-white">
                {formatDateForSheet(student.data_inicio_curso)}
              </div>
            </div>
            <div className="flex flex-col justify-between">
              <div className="h-[14.5mm] bg-[#D9D9D9] border-b border-black flex items-center justify-center p-1 text-[7.5px] leading-tight text-slate-800 font-semibold">
                Data prevista para término do curso:
              </div>
              <div className="flex-1 flex items-center justify-center font-bold text-[9px] py-1 bg-white">
                {formatDateForSheet(student.data_termino_curso)}
              </div>
            </div>
          </div>

          {/* B) DE OLHO NA CARREIRA DO ALUNO + 7 MARCOS (Linhas 7 a 15 do Excel) */}
          <div className="grid grid-cols-[16%_84%] divide-x divide-black flex-1 text-[7.5px]">
            {/* Faixa Lateral Vertical (M7:M15): "De olho na carreira do aluno" */}
            <div className="bg-[#D9D9D9] flex items-center justify-center p-0.5 font-bold text-[#0070C0] text-center select-none overflow-hidden">
              <span
                className="inline-block transform -rotate-90 whitespace-nowrap text-[7.5px] font-bold tracking-tight"
                style={{ transformOrigin: 'center center' }}
              >
                De olho na carreira do aluno
              </span>
            </div>

            {/* Tabela de 7 Marcos Pedagógicos (N7:P15) */}
            <div className="flex flex-col divide-y divide-black justify-between text-[7.5px]">
              {milestones.map((m, idx) => (
                <div
                  key={idx}
                  className={`grid grid-cols-[55%_45%] divide-x divide-black items-center ${
                    m.doubleRow ? 'h-[5.8mm]' : 'h-[4.4mm]'
                  } bg-white`}
                >
                  <div className="px-1 text-slate-800 truncate">{m.label}</div>
                  <div className="px-1 text-center font-bold text-slate-900 truncate">
                    {m.date}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. TABELA DE REGISTRO DE AULAS (33 LINHAS - Linhas 16 a 50 do Excel) */}
      <div className="border-b border-black">
        {/* Cabeçalho Composto da Tabela de Frequência / Estágio */}
        <div className="bg-[#D9D9D9] border-b border-black text-[#0070C0] font-bold text-center text-[7.5px]">
          {/* Linha 16: Linha Superior do Cabeçalho */}
          <div className="grid grid-cols-[8.26%_4.92%_26.07%_25.42%_5.28%_6.12%_23.93%] divide-x divide-black h-[4.2mm] items-center">
            <div className="row-span-2">Data</div>
            <div className="row-span-2">Horário</div>
            <div className="row-span-2">Curso / Aula / Conteúdo</div>
            <div className="border-b border-black">Estágio da Aula</div>
            <div className="row-span-2">Instrutor</div>
            <div className="row-span-2">Coord.</div>
            <div className="row-span-2">Assinatura do Aluno</div>
          </div>
          {/* Linha 17: Subcolunas de Estágio da Aula (Nomes integrais idênticos ao Excel) */}
          <div className="grid grid-cols-[8.26%_4.92%_26.07%_25.42%_5.28%_6.12%_23.93%] divide-x divide-black h-[3.8mm] items-center border-t border-black text-[7px] text-[#0070C0]">
            <div></div>
            <div></div>
            <div></div>
            <div className="grid grid-cols-5 divide-x divide-black h-full items-center font-bold text-[6.5px]">
              <div>Aula</div>
              <div>Apostila</div>
              <div>Teste 1</div>
              <div>Teste 2</div>
              <div>Teste 3</div>
            </div>
            <div></div>
            <div></div>
            <div></div>
          </div>
        </div>

        {/* Linhas 18 a 50: Exatamente 33 Linhas de Registro Pautadas */}
        <div className="divide-y divide-black/80 font-mono text-[7px]">
          {Array.from({ length: 33 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[8.26%_4.92%_26.07%_25.42%_5.28%_6.12%_23.93%] divide-x divide-black/80 h-[3.95mm] items-center text-center bg-white"
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

      {/* 4. ANOTAÇÕES COMPLEMENTARES (Linhas 51 a 59 do Excel - 8 Linhas Pautadas) */}
      <div className="flex flex-col">
        {/* Linha 51: Cabeçalho */}
        <div className="h-[4.2mm] bg-[#D9D9D9] border-b border-black flex items-center justify-center font-bold text-[#0070C0] text-[8px]">
          Anotações complementares
        </div>
        {/* Linhas 52 a 59: 8 Linhas pautadas em branco */}
        <div className="divide-y divide-black">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="h-[3.9mm] bg-white w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
