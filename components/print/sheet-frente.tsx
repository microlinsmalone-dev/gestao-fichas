// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Component: components/print/sheet-frente.tsx
// Ficha de Acompanhamento Individual do Aluno - Página 1 (Frente A4)
// Usa LITERALMENTE o molde oficial exportado do ModeloFicha.xlsx pelo Excel
// com posicionamento matemático exato das coordenadas (pt) das células e Shapes.
// ==============================================================================

'use client';

import React from 'react';
import type { StudentWithCourses, ScheduleConfig } from '../../types/database';
import {
  MODELO_FICHA_LAYOUT,
  MOLDE_FRENTE_DATA_URL,
} from '../../lib/constants/modelo-ficha-assets';
import {
  formatSheetDate,
  formatSheetPhone,
  resolveStudentDaySchedule,
  resolveStudentCourseName,
} from '../../lib/excel/modelo-ficha-injector';

interface SheetFrenteProps {
  student: StudentWithCourses;
  schedule?: ScheduleConfig;
}

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'] as const;

const TOTAL_W = MODELO_FICHA_LAYOUT.frenteWidthPt;
const TOTAL_H = MODELO_FICHA_LAYOUT.frenteHeightPt;

function boxStyle(rect: { left: number; top: number; width: number; height: number }): React.CSSProperties {
  return {
    position: 'absolute',
    left: `${(rect.left / TOTAL_W) * 100}%`,
    top: `${(rect.top / TOTAL_H) * 100}%`,
    width: `${(rect.width / TOTAL_W) * 100}%`,
    height: `${(rect.height / TOTAL_H) * 100}%`,
  };
}

function valueBoxStyle(rect: {
  top: number;
  height: number;
  valueLeft: number;
  valueWidth: number;
}): React.CSSProperties {
  return {
    position: 'absolute',
    left: `${(rect.valueLeft / TOTAL_W) * 100}%`,
    top: `${(rect.top / TOTAL_H) * 100}%`,
    width: `${(rect.valueWidth / TOTAL_W) * 100}%`,
    height: `${(rect.height / TOTAL_H) * 100}%`,
  };
}

export function SheetFrente({ student, schedule }: SheetFrenteProps) {
  const { cells, courses, schedule: scheduleBoxes } = MODELO_FICHA_LAYOUT;

  const getCourseName = (index: number) => resolveStudentCourseName(student, index);

  return (
    <div
      className="a4-sheet a4-frente relative bg-white text-black select-none mx-auto print:m-0"
      style={{
        width: '200mm',
        height: '286mm',
        maxHeight: '286mm',
        overflow: 'hidden',
        fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif",
      }}
    >
      {/* CAMADA BASE LITERAL: Molde oficial extraído diretamente do ModeloFicha.xlsx pelo Excel */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={MOLDE_FRENTE_DATA_URL}
        alt="Ficha de Acompanhamento Individual do Aluno"
        className="w-full h-full block pointer-events-none select-none"
        style={{ width: '100%', height: '100%', objectFit: 'fill' }}
      />

      {/* 1. DADOS PESSOAIS DO ALUNO (Linhas 2 a 5: A2, D2, A3, A4, D4, A5) */}
      <div
        style={valueBoxStyle(cells.matricula)}
        className="flex items-center text-[9px] font-normal text-black truncate leading-none"
      >
        {student.matricula || ''}
      </div>

      <div
        style={valueBoxStyle(cells.nome)}
        className="flex items-center text-[9px] font-normal text-black truncate leading-none"
      >
        {student.nome || ''}
      </div>

      <div
        style={valueBoxStyle(cells.email)}
        className="flex items-center text-[9px] font-normal text-black truncate leading-none"
      >
        {student.email || ''}
      </div>

      <div
        style={valueBoxStyle(cells.data_nascimento)}
        className="flex items-center text-[9px] font-normal text-black truncate leading-none"
      >
        {formatSheetDate(student.data_nascimento)}
      </div>

      <div
        style={valueBoxStyle(cells.instrutor)}
        className="flex items-center text-[9px] font-normal text-black truncate leading-none"
      >
        {student.instrutor || ''}
      </div>

      <div
        style={valueBoxStyle(cells.telefone)}
        className="flex items-center text-[9px] font-normal text-black truncate leading-none"
      >
        {formatSheetPhone(student.telefone)}
      </div>

      {/* 2. DATAS DE INÍCIO E TÉRMINO DO CURSO (M5:O6 e P5:P6) */}
      <div
        style={boxStyle(cells.data_inicio_curso)}
        className="flex items-center justify-center text-center text-[9.5px] font-normal text-black leading-none"
      >
        {formatSheetDate(student.data_inicio_curso)}
      </div>

      <div
        style={boxStyle(cells.data_termino_curso)}
        className="flex items-center justify-center text-center text-[9.5px] font-normal text-black leading-none"
      >
        {formatSheetDate(student.data_termino_curso)}
      </div>

      {/* 3. QUADRO DE HORÁRIOS NAS COORDENADAS EXATAS DAS TEXTBOXES DO EXCEL */}
      {WEEKDAYS.map((day) => {
        const dayBoxes = scheduleBoxes[day];
        const times = resolveStudentDaySchedule(student, schedule, day);
        return (
          <React.Fragment key={day}>
            <div
              style={boxStyle(dayBoxes.inicio)}
              className="flex items-center justify-center text-center text-[9px] font-normal text-black leading-none"
            >
              {times.inicio || 'h'}
            </div>
            <div
              style={boxStyle(dayBoxes.fim)}
              className="flex items-center justify-center text-center text-[9px] font-normal text-black leading-none"
            >
              {times.fim || 'h'}
            </div>
          </React.Fragment>
        );
      })}

      {/* 4. CURSOS / MÓDULOS CONTRATADOS (Slots 1 a 18: A10..H15) */}
      {Array.from({ length: 18 }).map((_, idx) => {
        const slotNum = idx + 1;
        const slotKey = String(slotNum) as keyof typeof courses;
        const rect = courses[slotKey];
        const courseName = getCourseName(slotNum);
        if (!courseName) return null;
        return (
          <div
            key={slotKey}
            style={valueBoxStyle(rect)}
            className="flex items-center text-[8.5px] font-normal text-black truncate leading-none"
          >
            {courseName}
          </div>
        );
      })}

      {/* 5. DATAS DE "DE OLHO NA CARREIRA DO ALUNO" (Coluna P: P7 a P15) */}
      <div
        style={boxStyle(cells.data_linha_vida)}
        className="flex items-center justify-center text-center text-[8.5px] font-normal text-black leading-none"
      >
        {formatSheetDate(student.data_linha_vida)}
      </div>

      <div
        style={boxStyle(cells.data_form1)}
        className="flex items-center justify-center text-center text-[8.5px] font-normal text-black leading-none"
      >
        {formatSheetDate(student.data_form1)}
      </div>

      <div
        style={boxStyle(cells.data_form2)}
        className="flex items-center justify-center text-center text-[8.5px] font-normal text-black leading-none"
      >
        {formatSheetDate(student.data_form2)}
      </div>

      <div
        style={boxStyle(cells.data_dream_day)}
        className="flex items-center justify-center text-center text-[8.5px] font-normal text-black leading-none"
      >
        {formatSheetDate(student.data_dreamday)}
      </div>

      <div
        style={boxStyle(cells.data_fechamento1)}
        className="flex items-center justify-center text-center text-[8.5px] font-normal text-black leading-none"
      >
        {formatSheetDate(student.data_fechamento1)}
      </div>

      <div
        style={boxStyle(cells.data_fechamento2)}
        className="flex items-center justify-center text-center text-[8.5px] font-normal text-black leading-none"
      >
        {formatSheetDate(student.data_fechamento2)}
      </div>

      <div
        style={boxStyle(cells.data_fechamento3)}
        className="flex items-center justify-center text-center text-[8.5px] font-normal text-black leading-none"
      >
        {formatSheetDate(student.data_fechamento3)}
      </div>
    </div>
  );
}
