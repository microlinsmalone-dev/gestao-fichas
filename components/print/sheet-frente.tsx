// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Component: components/print/sheet-frente.tsx
// Ficha de Acompanhamento Individual do Aluno - Página 1 (Frente A4)
// Réplica estrutural e milimétrica 100% fiel ao ModeloFicha.xlsx do Excel
// ==============================================================================

'use client';

import React from 'react';
import type { StudentWithCourses, ScheduleConfig } from '../../types/database';
import { MICROLINS_LOGO_BASE64 } from '../../lib/constants/microlins-logo';

interface SheetFrenteProps {
  student: StudentWithCourses;
  schedule?: ScheduleConfig;
}

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function formatDateForSheet(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (clean.includes('/')) return clean;
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
}

function formatPhoneForSheet(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function SheetFrente({ student, schedule: propSchedule }: SheetFrenteProps) {
  const getCourseName = (index: number) => {
    const course = student.cursos?.[index - 1];
    return course ? course.nome : '';
  };

  const getDaySchedule = (day: string) => {
    const schedule = propSchedule || student.horarios;
    const isDayActive = schedule?.dias?.some(
      (d) => d.toLowerCase().includes(day.toLowerCase()) || day.toLowerCase().includes(d.toLowerCase())
    );

    if (schedule?.diasConfig) {
      if (schedule.diasConfig[day]) return schedule.diasConfig[day];
      const fullName = `${day}-feira`;
      if (schedule.diasConfig[fullName]) return schedule.diasConfig[fullName];
    }

    if (isDayActive) {
      return {
        inicio: schedule?.horarioInicio || 'h',
        fim: schedule?.horarioFim || 'h',
      };
    }

    return { inicio: 'h', fim: 'h' };
  };

  return (
    <div
      className="a4-sheet a4-frente bg-white text-black leading-tight border border-black box-border mx-auto select-none print:m-0 print:border-black"
      style={{
        width: '200mm',
        height: '286mm',
        maxHeight: '286mm',
        overflow: 'hidden',
        fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif",
      }}
    >
      {/* ============================================================== */}
      {/* 1. TABELA PRINCIPAL DE DADOS E CARREIRA (Linhas 1 a 15 Excel)  */}
      {/* ============================================================== */}
      <table
        className="w-full border-collapse border border-black table-fixed text-[8px]"
        style={{ width: '100%', borderSpacing: 0 }}
      >
        <colgroup>
          {/* Matriz exata de 16 Colunas A..P do ModeloFicha.xlsx */}
          <col style={{ width: '8.256%' }} />  {/* A: Data / Matrícula */}
          <col style={{ width: '4.917%' }} />  {/* B: Horário */}
          <col style={{ width: '12.430%' }} /> {/* C */}
          <col style={{ width: '13.636%' }} /> {/* D: Nome / Instrutor */}
          <col style={{ width: '5.009%' }} />  {/* E */}
          <col style={{ width: '5.751%' }} />  {/* F */}
          <col style={{ width: '4.638%' }} />  {/* G */}
          <col style={{ width: '5.195%' }} />  {/* H */}
          <col style={{ width: '4.824%' }} />  {/* I */}
          <col style={{ width: '3.432%' }} />  {/* J */}
          <col style={{ width: '1.855%' }} />  {/* K */}
          <col style={{ width: '6.122%' }} />  {/* L (Fim do bloco A..L = 76.067%) */}

          <col style={{ width: '3.432%' }} />  {/* M: Vertical 'De olho na carreira' */}
          <col style={{ width: '2.690%' }} />  {/* N: Rótulo do Marco */}
          <col style={{ width: '5.751%' }} />  {/* O: Rótulo do Marco (continuação) */}
          <col style={{ width: '12.059%' }} /> {/* P: Data do Marco / Término */}
        </colgroup>

        <tbody>
          {/* LINHA 1: TÍTULO PRINCIPAL + LOGO MICROLINS (A1:P1) */}
          <tr style={{ height: '10.5mm' }}>
            <td
              colSpan={12}
              className="bg-[#D9D9D9] border-b border-r border-black text-center font-bold text-[#0070C0] text-[13.5px] px-2"
            >
              Ficha de Acompanhamento Individual do Aluno
            </td>
            <td
              colSpan={4}
              className="bg-white border-b border-black text-center p-1 align-middle"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={MICROLINS_LOGO_BASE64}
                alt="Microlins"
                className="h-[5.5mm] w-auto object-contain mx-auto"
              />
              <span className="block text-[6.5px] text-slate-700 tracking-tight text-center leading-none mt-0.5">
                Gerado por aplicação. V1.0
              </span>
            </td>
          </tr>

          {/* LINHA 2: MATRÍCULA | NOME | CABEÇALHOS DE DATAS */}
          <tr style={{ height: '4.6mm' }}>
            <td colSpan={3} className="border-b border-r border-black px-1.5 truncate">
              <span className="text-slate-800">Matrícula: </span>
              <span className="font-bold">{student.matricula || ''}</span>
            </td>
            <td colSpan={9} className="border-b border-r border-black px-1.5 truncate">
              <span className="text-slate-800">Nome do Aluno: </span>
              <span className="font-bold text-[9px] uppercase">{student.nome || ''}</span>
            </td>
            <td
              colSpan={3}
              rowSpan={3}
              className="bg-[#D9D9D9] border-b border-r border-black text-center p-1 text-[7.5px] font-semibold leading-tight text-slate-800 align-middle"
            >
              Data inicio do curso:
            </td>
            <td
              colSpan={1}
              rowSpan={3}
              className="bg-[#D9D9D9] border-b border-black text-center p-1 text-[7.5px] font-semibold leading-tight text-slate-800 align-middle"
            >
              Data prevista para término do curso:
            </td>
          </tr>

          {/* LINHA 3: EMAIL */}
          <tr style={{ height: '4.6mm' }}>
            <td colSpan={12} className="border-b border-r border-black px-1.5 truncate">
              <span className="text-slate-800 mr-1">Email: </span>
              <span className="truncate">{student.email || ''}</span>
            </td>
          </tr>

          {/* LINHA 4: DATA NASCIMENTO | INSTRUTOR */}
          <tr style={{ height: '4.6mm' }}>
            <td colSpan={3} className="border-b border-r border-black px-1.5 truncate">
              <span className="text-slate-800">Data Nascimento: </span>
              <span>{formatDateForSheet(student.data_nascimento)}</span>
            </td>
            <td colSpan={9} className="border-b border-r border-black px-1.5 truncate">
              <span className="text-slate-800">Instrutor: </span>
              <span className="font-medium">{student.instrutor || ''}</span>
            </td>
          </tr>

          {/* LINHA 5: TELEFONE | VALORES DAS DATAS DE INÍCIO E TÉRMINO */}
          <tr style={{ height: '4.6mm' }}>
            <td colSpan={12} className="border-b border-r border-black px-1.5 truncate">
              <span className="text-slate-800 mr-1">Telefone: </span>
              <span>{formatPhoneForSheet(student.telefone)}</span>
            </td>
            <td
              colSpan={3}
              rowSpan={2}
              className="border-b border-r border-black text-center font-bold text-[9px] align-middle bg-white"
            >
              {formatDateForSheet(student.data_inicio_curso)}
            </td>
            <td
              colSpan={1}
              rowSpan={2}
              className="border-b border-black text-center font-bold text-[9px] align-middle bg-white"
            >
              {formatDateForSheet(student.data_termino_curso)}
            </td>
          </tr>

          {/* LINHA 6: QUADRO DE HORÁRIOS - DIAS DA SEMANA */}
          <tr style={{ height: '4.4mm' }}>
            <td colSpan={12} className="p-0 border-b border-r border-black">
              <table className="w-full h-full border-collapse table-fixed text-center" style={{ borderSpacing: 0 }}>
                <colgroup>
                  <col style={{ width: '13.83%' }} />
                  <col style={{ width: '12.31%' }} />
                  <col style={{ width: '12.31%' }} />
                  <col style={{ width: '12.31%' }} />
                  <col style={{ width: '12.31%' }} />
                  <col style={{ width: '12.31%' }} />
                  <col style={{ width: '12.31%' }} />
                  <col style={{ width: '12.31%' }} />
                </colgroup>
                <tbody>
                  <tr style={{ height: '4.4mm' }} className="bg-white">
                    <td className="border-r border-black text-left px-1 font-semibold text-[7.5px] text-slate-900">
                      Dia da semana:
                    </td>
                    {WEEKDAYS.map((d, idx) => (
                      <td
                        key={d}
                        className={`font-semibold text-[7.5px] ${idx < 6 ? 'border-r border-black' : ''}`}
                      >
                        {d}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* LINHA 7: HORÁRIO INICIAL | INÍCIO DA CARREIRA DO ALUNO */}
          <tr style={{ height: '4.4mm' }}>
            <td colSpan={12} className="p-0 border-b border-r border-black">
              <table className="w-full h-full border-collapse table-fixed text-center" style={{ borderSpacing: 0 }}>
                <colgroup>
                  <col style={{ width: '13.83%' }} />
                  <col style={{ width: '12.31%' }} />
                  <col style={{ width: '12.31%' }} />
                  <col style={{ width: '12.31%' }} />
                  <col style={{ width: '12.31%' }} />
                  <col style={{ width: '12.31%' }} />
                  <col style={{ width: '12.31%' }} />
                  <col style={{ width: '12.31%' }} />
                </colgroup>
                <tbody>
                  <tr style={{ height: '4.4mm' }} className="bg-white">
                    <td className="border-r border-black text-left px-1 text-[7.5px] text-slate-800">
                      Horário inicial:
                    </td>
                    {WEEKDAYS.map((d, idx) => (
                      <td
                        key={d}
                        className={`text-[7.5px] ${idx < 6 ? 'border-r border-black' : ''}`}
                      >
                        {getDaySchedule(d).inicio}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </td>
            {/* Faixa vertical: "De olho na carreira do aluno" (Linhas 7 a 15) */}
            <td
              rowSpan={9}
              className="bg-[#D9D9D9] border-b border-r border-black text-center font-bold text-[#0070C0] p-0 select-none overflow-hidden"
              style={{ verticalAlign: 'middle' }}
            >
              <div
                className="transform -rotate-90 whitespace-nowrap text-[7px] font-bold tracking-tight text-center mx-auto"
                style={{ width: '100%', minWidth: '40mm' }}
              >
                De olho na carreira do aluno
              </div>
            </td>
            {/* Marco 1: Linha da vida (Linha 7 e 8) */}
            <td colSpan={2} rowSpan={2} className="border-b border-r border-black px-1 text-slate-800 text-[7.5px] align-middle">
              Linha da vida
            </td>
            <td colSpan={1} rowSpan={2} className="border-b border-black text-center font-bold text-[8px] align-middle bg-white">
              {formatDateForSheet(student.data_linha_vida)}
            </td>
          </tr>

          {/* LINHA 8: HORÁRIO FINAL */}
          <tr style={{ height: '4.4mm' }}>
            <td colSpan={12} className="p-0 border-b border-r border-black">
              <table className="w-full h-full border-collapse table-fixed text-center" style={{ borderSpacing: 0 }}>
                <colgroup>
                  <col style={{ width: '13.83%' }} />
                  <col style={{ width: '12.31%' }} />
                  <col style={{ width: '12.31%' }} />
                  <col style={{ width: '12.31%' }} />
                  <col style={{ width: '12.31%' }} />
                  <col style={{ width: '12.31%' }} />
                  <col style={{ width: '12.31%' }} />
                  <col style={{ width: '12.31%' }} />
                </colgroup>
                <tbody>
                  <tr style={{ height: '4.4mm' }} className="bg-white">
                    <td className="border-r border-black text-left px-1 text-[7.5px] text-slate-800">
                      Horário final:
                    </td>
                    {WEEKDAYS.map((d, idx) => (
                      <td
                        key={d}
                        className={`text-[7.5px] ${idx < 6 ? 'border-r border-black' : ''}`}
                      >
                        {getDaySchedule(d).fim}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* LINHA 9: CABEÇALHO CURSOS CONTRATADOS | FORM 1 */}
          <tr style={{ height: '4.4mm' }}>
            <td
              colSpan={12}
              className="bg-[#D9D9D9] border-b border-r border-black text-center font-bold text-[#0070C0] text-[8px]"
            >
              Cursos / Módulos Contratados:
            </td>
            <td colSpan={2} className="border-b border-r border-black px-1 text-slate-800 text-[7.5px] align-middle">
              Form 1
            </td>
            <td colSpan={1} className="border-b border-black text-center font-bold text-[8px] align-middle bg-white">
              {formatDateForSheet(student.data_form1)}
            </td>
          </tr>

          {/* LINHA 10: CURSOS 1, 7, 13 | FORM 2 */}
          <tr style={{ height: '4.4mm' }}>
            <td colSpan={3} className="border-b border-r border-black px-1 truncate bg-white">
              <span className="font-semibold text-slate-700 mr-1">1.</span>
              <span>{getCourseName(1)}</span>
            </td>
            <td colSpan={4} className="border-b border-r border-black px-1 truncate bg-white">
              <span className="font-semibold text-slate-700 mr-1">7.</span>
              <span>{getCourseName(7)}</span>
            </td>
            <td colSpan={5} className="border-b border-r border-black px-1 truncate bg-white">
              <span className="font-semibold text-slate-700 mr-1">13.</span>
              <span>{getCourseName(13)}</span>
            </td>
            <td colSpan={2} className="border-b border-r border-black px-1 text-slate-800 text-[7.5px] align-middle">
              Form 2
            </td>
            <td colSpan={1} className="border-b border-black text-center font-bold text-[8px] align-middle bg-white">
              {formatDateForSheet(student.data_form2)}
            </td>
          </tr>

          {/* LINHA 11: CURSOS 2, 8, 14 | DREAM DAY (Row 1) */}
          <tr style={{ height: '4.4mm' }}>
            <td colSpan={3} className="border-b border-r border-black px-1 truncate bg-white">
              <span className="font-semibold text-slate-700 mr-1">2.</span>
              <span>{getCourseName(2)}</span>
            </td>
            <td colSpan={4} className="border-b border-r border-black px-1 truncate bg-white">
              <span className="font-semibold text-slate-700 mr-1">8.</span>
              <span>{getCourseName(8)}</span>
            </td>
            <td colSpan={5} className="border-b border-r border-black px-1 truncate bg-white">
              <span className="font-semibold text-slate-700 mr-1">14.</span>
              <span>{getCourseName(14)}</span>
            </td>
            <td colSpan={2} rowSpan={2} className="border-b border-r border-black px-1 text-slate-800 text-[7.5px] align-middle">
              Dream Day
            </td>
            <td colSpan={1} rowSpan={2} className="border-b border-black text-center font-bold text-[8px] align-middle bg-white">
              {formatDateForSheet(student.data_dream_day)}
            </td>
          </tr>

          {/* LINHA 12: CURSOS 3, 9, 15 | DREAM DAY (Row 2) */}
          <tr style={{ height: '4.4mm' }}>
            <td colSpan={3} className="border-b border-r border-black px-1 truncate bg-white">
              <span className="font-semibold text-slate-700 mr-1">3.</span>
              <span>{getCourseName(3)}</span>
            </td>
            <td colSpan={4} className="border-b border-r border-black px-1 truncate bg-white">
              <span className="font-semibold text-slate-700 mr-1">9.</span>
              <span>{getCourseName(9)}</span>
            </td>
            <td colSpan={5} className="border-b border-r border-black px-1 truncate bg-white">
              <span className="font-semibold text-slate-700 mr-1">15.</span>
              <span>{getCourseName(15)}</span>
            </td>
          </tr>

          {/* LINHA 13: CURSOS 4, 10, 16 | FECHAMENTO 1 */}
          <tr style={{ height: '4.4mm' }}>
            <td colSpan={3} className="border-b border-r border-black px-1 truncate bg-white">
              <span className="font-semibold text-slate-700 mr-1">4.</span>
              <span>{getCourseName(4)}</span>
            </td>
            <td colSpan={4} className="border-b border-r border-black px-1 truncate bg-white">
              <span className="font-semibold text-slate-700 mr-1">10.</span>
              <span>{getCourseName(10)}</span>
            </td>
            <td colSpan={5} className="border-b border-r border-black px-1 truncate bg-white">
              <span className="font-semibold text-slate-700 mr-1">16.</span>
              <span>{getCourseName(16)}</span>
            </td>
            <td colSpan={2} className="border-b border-r border-black px-1 text-slate-800 text-[7.5px] align-middle">
              Fechamento 1
            </td>
            <td colSpan={1} className="border-b border-black text-center font-bold text-[8px] align-middle bg-white">
              {formatDateForSheet(student.data_fechamento1)}
            </td>
          </tr>

          {/* LINHA 14: CURSOS 5, 11, 17 | FECHAMENTO 2 */}
          <tr style={{ height: '4.4mm' }}>
            <td colSpan={3} className="border-b border-r border-black px-1 truncate bg-white">
              <span className="font-semibold text-slate-700 mr-1">5.</span>
              <span>{getCourseName(5)}</span>
            </td>
            <td colSpan={4} className="border-b border-r border-black px-1 truncate bg-white">
              <span className="font-semibold text-slate-700 mr-1">11.</span>
              <span>{getCourseName(11)}</span>
            </td>
            <td colSpan={5} className="border-b border-r border-black px-1 truncate bg-white">
              <span className="font-semibold text-slate-700 mr-1">17.</span>
              <span>{getCourseName(17)}</span>
            </td>
            <td colSpan={2} className="border-b border-r border-black px-1 text-slate-800 text-[7.5px] align-middle">
              Fechamento 2
            </td>
            <td colSpan={1} className="border-b border-black text-center font-bold text-[8px] align-middle bg-white">
              {formatDateForSheet(student.data_fechamento2)}
            </td>
          </tr>

          {/* LINHA 15: CURSOS 6, 12, 18 | FECHAMENTO 3 */}
          <tr style={{ height: '4.4mm' }}>
            <td colSpan={3} className="border-b border-r border-black px-1 truncate bg-white">
              <span className="font-semibold text-slate-700 mr-1">6.</span>
              <span>{getCourseName(6)}</span>
            </td>
            <td colSpan={4} className="border-b border-r border-black px-1 truncate bg-white">
              <span className="font-semibold text-slate-700 mr-1">12.</span>
              <span>{getCourseName(12)}</span>
            </td>
            <td colSpan={5} className="border-b border-r border-black px-1 truncate bg-white">
              <span className="font-semibold text-slate-700 mr-1">18.</span>
              <span>{getCourseName(18)}</span>
            </td>
            <td colSpan={2} className="border-b border-r border-black px-1 text-slate-800 text-[7.5px] align-middle">
              Fechamento 3
            </td>
            <td colSpan={1} className="border-b border-black text-center font-bold text-[8px] align-middle bg-white">
              {formatDateForSheet(student.data_fechamento3)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ============================================================== */}
      {/* 2. TABELA DE REGISTRO DE AULAS (Linhas 16 a 50 do Excel)        */}
      {/* ============================================================== */}
      <table
        className="w-full border-collapse border-b border-l border-r border-black table-fixed text-[7.5px]"
        style={{ width: '100%', borderSpacing: 0 }}
      >
        <colgroup>
          <col style={{ width: '8.256%' }} />  {/* Data */}
          <col style={{ width: '4.917%' }} />  {/* Horário */}
          <col style={{ width: '12.430%' }} /> {/* Curso / Aula / Conteúdo (Col C) */}
          <col style={{ width: '13.636%' }} /> {/* Curso / Aula / Conteúdo (Col D) */}
          <col style={{ width: '5.009%' }} />  {/* Aula (Col E) */}
          <col style={{ width: '5.751%' }} />  {/* Apostila (Col F) */}
          <col style={{ width: '4.638%' }} />  {/* Teste 1 (Col G) */}
          <col style={{ width: '5.195%' }} />  {/* Teste 2 (Col H) */}
          <col style={{ width: '4.824%' }} />  {/* Teste 3 (Col I) */}
          <col style={{ width: '3.432%' }} />  {/* Instrutor (Col J) */}
          <col style={{ width: '1.855%' }} />  {/* Instrutor (Col K) */}
          <col style={{ width: '6.122%' }} />  {/* Coord. (Col L) */}
          <col style={{ width: '3.432%' }} />  {/* Assinatura do Aluno (Col M) */}
          <col style={{ width: '2.690%' }} />  {/* Assinatura do Aluno (Col N) */}
          <col style={{ width: '5.751%' }} />  {/* Assinatura do Aluno (Col O) */}
          <col style={{ width: '12.059%' }} /> {/* Assinatura do Aluno (Col P) */}
        </colgroup>

        <thead>
          {/* LINHA 16 DO EXCEL: CABEÇALHO SUPERIOR */}
          <tr style={{ height: '4.2mm' }} className="bg-[#D9D9D9] text-[#0070C0] font-bold text-center">
            <th rowSpan={2} className="border-b border-r border-black">Data</th>
            <th rowSpan={2} className="border-b border-r border-black">Horário</th>
            <th colSpan={2} rowSpan={2} className="border-b border-r border-black">Curso / Aula / Conteúdo</th>
            <th colSpan={5} className="border-b border-r border-black">Estágio da Aula</th>
            <th colSpan={2} rowSpan={2} className="border-b border-r border-black">Instrutor</th>
            <th rowSpan={2} className="border-b border-r border-black">Coord.</th>
            <th colSpan={4} rowSpan={2} className="border-b border-black">Assinatura do Aluno</th>
          </tr>

          {/* LINHA 17 DO EXCEL: SUBCOLUNAS DE ESTÁGIO DA AULA */}
          <tr style={{ height: '3.8mm' }} className="bg-[#D9D9D9] text-[#0070C0] font-bold text-center text-[6.5px]">
            <th className="border-b border-r border-black">Aula</th>
            <th className="border-b border-r border-black">Apostila</th>
            <th className="border-b border-r border-black">Teste 1</th>
            <th className="border-b border-r border-black">Teste 2</th>
            <th className="border-b border-r border-black">Teste 3</th>
          </tr>
        </thead>

        <tbody>
          {/* LINHAS 18 A 50 DO EXCEL: EXATAMENTE 33 LINHAS DE REGISTRO */}
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
              <td colSpan={2} className="border-r border-black/80"></td>
              <td className="border-r border-black/80"></td>
              <td className="border-r border-black/80"></td>
              <td className="border-r border-black/80"></td>
              <td className="border-r border-black/80"></td>
              <td className="border-r border-black/80"></td>
              <td colSpan={2} className="border-r border-black/80"></td>
              <td className="border-r border-black/80"></td>
              <td colSpan={4}></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ============================================================== */}
      {/* 3. ANOTAÇÕES COMPLEMENTARES (Linhas 51 a 59 do Excel)           */}
      {/* ============================================================== */}
      <table
        className="w-full border-collapse border-b border-l border-r border-black table-fixed text-[8px]"
        style={{ width: '100%', borderSpacing: 0 }}
      >
        <tbody>
          {/* Linha 51: Cabeçalho */}
          <tr style={{ height: '4.2mm' }}>
            <td className="bg-[#D9D9D9] border-b border-black text-center font-bold text-[#0070C0] uppercase">
              Anotações complementares
            </td>
          </tr>
          {/* Linhas 52 a 59: 8 Linhas pautadas em branco */}
          {Array.from({ length: 8 }).map((_, idx) => (
            <tr key={idx} style={{ height: '3.9mm' }}>
              <td className="border-b border-black bg-white"></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
