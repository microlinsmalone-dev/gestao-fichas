// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Component: components/print/sheet-frente.tsx
// Ficha de Acompanhamento Individual do Aluno - Página 1 (Frente A4)
// Renderização 100% VETORIAL (zero blur de bitmap) usando literalmente o mapa de
// coordenadas exatas (Left, Top, Width, Height em pt) extraído do ModeloFicha.xlsx.
// ==============================================================================

'use client';

import React from 'react';
import type { StudentWithCourses, ScheduleConfig } from '../../types/database';
import {
  MODELO_FICHA_LAYOUT,
  type VectorCellSpec,
} from '../../lib/constants/modelo-ficha-assets';
import { MICROLINS_LOGO_BASE64 } from '../../lib/constants/microlins-logo';
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

// Margem vetorial de respiro de 2.5pt para que traços espessos (strokeWidth 2.4)
// nas bordas direita e inferior fiquem 100% contidos dentro do viewBox do SVG sem cortes.
const SVG_PAD = 2.5;
const VB_W = TOTAL_W + SVG_PAD * 2;
const VB_H = TOTAL_H + SVG_PAD * 2;

function pctBoxStyle(rect: { left: number; top: number; width: number; height: number }): React.CSSProperties {
  return {
    position: 'absolute',
    left: `${((rect.left + SVG_PAD) / VB_W) * 100}%`,
    top: `${((rect.top + SVG_PAD) / VB_H) * 100}%`,
    width: `${(rect.width / VB_W) * 100}%`,
    height: `${(rect.height / VB_H) * 100}%`,
  };
}

function scaleFontPx(excelPt: number): string {
  // Escala proporcional do Excel com boa legibilidade em papel A4
  if (excelPt >= 18) return '15.5px';
  if (excelPt >= 10) return '9.2px';
  if (excelPt >= 9) return '8.8px';
  return '8.2px';
}

export function SheetFrente({ student, schedule }: SheetFrenteProps) {
  const {
    schedule: scheduleBoxes,
    weekdayHeaders,
    headerShapes,
    frenteVectorCells,
  } = MODELO_FICHA_LAYOUT;

  /**
   * Resolve o texto exato de cada célula da Frente combinando os rótulos
   * originais do ModeloFicha.xlsx com os valores preenchidos do aluno.
   */
  const resolveCellDisplayText = (cell: VectorCellSpec): string => {
    switch (cell.addr) {
      case 'A2:C2':
        return `Matrícula: ${student.matricula || ''}`;
      case 'D2:L2':
        return `Nome do Aluno: ${student.nome || ''}`;
      case 'A3:L3':
        return `Email: ${student.email || ''}`;
      case 'A4:C4':
        return `Data Nascimento: ${formatSheetDate(student.data_nascimento)}`;
      case 'D4:L4':
        return `Instrutor: ${student.instrutor || ''}`;
      case 'A5:L5':
        return `Telefone: ${formatSheetPhone(student.telefone)}`;
      case 'M5:O6':
        return formatSheetDate(student.data_inicio_curso);
      case 'P5:P6':
        return formatSheetDate(student.data_termino_curso);
      case 'P7:P8':
        return formatSheetDate(student.data_linha_vida);
      case 'P9':
        return formatSheetDate(student.data_form1);
      case 'P10':
        return formatSheetDate(student.data_form2);
      case 'P11:P12':
        return formatSheetDate(student.data_dreamday);
      case 'P13':
        return formatSheetDate(student.data_fechamento1);
      case 'P14':
        return formatSheetDate(student.data_fechamento2);
      case 'P15':
        return formatSheetDate(student.data_fechamento3);
      default:
        break;
    }

    // Slots de cursos (Linhas 10 a 15: A10..C15 = 1..6, D10..G15 = 7..12, H10..L15 = 13..18)
    if (cell.row >= 10 && cell.row <= 15) {
      const offset = cell.row - 9; // 1..6
      if (cell.col === 1) {
        const cName = resolveStudentCourseName(student, offset);
        return cName ? `${offset}. ${cName}` : `${offset}.`;
      }
      if (cell.col === 4) {
        const slot = offset + 6;
        const cName = resolveStudentCourseName(student, slot);
        return cName ? `${slot}. ${cName}` : `${slot}.`;
      }
      if (cell.col === 8) {
        const slot = offset + 12;
        const cName = resolveStudentCourseName(student, slot);
        return cName ? `${slot}. ${cName}` : `${slot}.`;
      }
    }

    return cell.text;
  };

  return (
    <div
      className="a4-sheet a4-frente relative bg-white text-black select-none mx-auto print:m-0"
      style={{
        width: '198mm',
        height: '283mm',
        maxHeight: '283mm',
        overflow: 'hidden',
        fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* 1. CAMADA DE GRADE E FUNDOS 100% VETORIAL (SVG CRISP EDGES) */}
      <svg
        viewBox={`-${SVG_PAD} -${SVG_PAD} ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        shapeRendering="geometricPrecision"
        className="w-full h-full block pointer-events-none select-none"
        style={{ width: '100%', height: '100%' }}
      >
        {/* Células e Áreas Mescladas do ModeloFicha.xlsx */}
        {frenteVectorCells.map((cell) => (
          <rect
            key={cell.addr}
            x={cell.left}
            y={cell.top}
            width={cell.width}
            height={cell.height}
            fill={cell.bg === '#D9D9D9' ? '#C8D0DC' : (cell.bg || 'none')}
            stroke="#000000"
            strokeWidth="2.4"
            strokeLinejoin="miter"
            strokeLinecap="square"
          />
        ))}

        {/* Caixas de Texto dos Cabeçalhos de Dias da Semana (TextBox 16..22) */}
        {weekdayHeaders.map((wh) => (
          <rect
            key={`wh-${wh.label}`}
            x={wh.left}
            y={wh.top}
            width={wh.width}
            height={wh.height}
            fill="none"
            stroke="#000000"
            strokeWidth="2.4"
            strokeLinejoin="miter"
            strokeLinecap="square"
          />
        ))}

        {/* Caixas de Texto dos Horários Inicial e Final (TextBox 1..7 e 9..15) */}
        {WEEKDAYS.map((day) => {
          const dayBoxes = scheduleBoxes[day];
          return (
            <React.Fragment key={`svg-sched-${day}`}>
              <rect
                x={dayBoxes.inicio.left}
                y={dayBoxes.inicio.top}
                width={dayBoxes.inicio.width}
                height={dayBoxes.inicio.height}
                fill="none"
                stroke="#000000"
                strokeWidth="2.4"
                strokeLinejoin="miter"
                strokeLinecap="square"
              />
              <rect
                x={dayBoxes.fim.left}
                y={dayBoxes.fim.top}
                width={dayBoxes.fim.width}
                height={dayBoxes.fim.height}
                fill="none"
                stroke="#000000"
                strokeWidth="2.4"
                strokeLinejoin="miter"
                strokeLinecap="square"
              />
            </React.Fragment>
          );
        })}

        {/* Moldura Externa Fiel ao A1:P59 com traço firme */}
        <rect
          x={0}
          y={0}
          width={TOTAL_W}
          height={TOTAL_H}
          fill="none"
          stroke="#000000"
          strokeWidth="2.4"
          strokeLinejoin="miter"
          strokeLinecap="square"
        />
      </svg>

      {/* 2. CAMADA DE TEXTOS VETORIAIS DAS CÉLULAS NAS COORDENADAS EXATAS DO EXCEL */}
      {frenteVectorCells.map((cell) => {
        const displayText = resolveCellDisplayText(cell);
        if (!displayText) return null;

        const isDateValueBox =
          cell.addr === 'M5:O6' ||
          cell.addr === 'P5:P6' ||
          cell.addr.startsWith('P');

        const isCentered =
          cell.align === 'center' ||
          isDateValueBox ||
          cell.text === '/         /' ||
          cell.text === 'h';

        const isHeader = cell.bg === '#D9D9D9' || cell.bold || cell.addr === 'A1:P1';
        // Converte o azul claro #0070C0 para o azul real profundo #003B75 para maior densidade de tinta
        const fontColor = cell.color === '#0070C0' ? '#003B75' : (cell.color || '#000000');
        const isMarker = cell.text === '/         /' || cell.text === 'h';
        const isCourseSlot = cell.row >= 10 && cell.row <= 15 && (cell.col === 1 || cell.col === 4 || cell.col === 8);
        const isBold = isHeader || cell.bold || isCourseSlot || isMarker;

        if (cell.vertical) {
          return (
            <div
              key={`txt-${cell.addr}`}
              style={{
                ...pctBoxStyle(cell),
                color: fontColor,
                fontSize: '9.8px',
                fontWeight: 700,
              }}
              className="flex items-center justify-center overflow-hidden"
            >
              <span
                className="whitespace-nowrap tracking-wider select-none block"
                style={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  textAlign: 'center',
                }}
              >
                {displayText}
              </span>
            </div>
          );
        }

        // No título principal A1:P1, preserva o recuo central antes do logo como no Excel
        const boxRect =
          cell.addr === 'A1:P1'
            ? { ...cell, width: 650 }
            : cell;

        return (
          <div
            key={`txt-${cell.addr}`}
            style={{
              ...pctBoxStyle(boxRect),
              color: fontColor,
              fontSize: scaleFontPx(cell.fontSize),
              fontWeight: isBold ? (isMarker ? 600 : 700) : 400,
              paddingLeft: isCentered ? '1px' : '3px',
              paddingRight: '2px',
            }}
            className={`flex items-center leading-tight ${
              isCentered
                ? 'justify-center text-center'
                : 'justify-start text-left truncate'
            }`}
          >
            <span
              className={isCentered ? 'leading-tight whitespace-pre-wrap' : 'truncate whitespace-pre'}
              style={{ whiteSpace: cell.text === '/         /' ? 'pre' : isCentered ? 'pre-wrap' : 'pre' }}
            >
              {displayText}
            </span>
          </div>
        );
      })}

      {/* 3. CABEÇALHOS DOS DIAS DA SEMANA (TextBox 16..22) */}
      {weekdayHeaders.map((wh) => (
        <div
          key={`lbl-${wh.label}`}
          style={{
            ...pctBoxStyle(wh),
            fontSize: '8.8px',
          }}
          className="flex items-center justify-center text-center text-black font-bold leading-none"
        >
          {wh.label}
        </div>
      ))}

      {/* 4. HORÁRIOS INICIAL E FINAL (TextBox 1..7 e 9..15) */}
      {WEEKDAYS.map((day) => {
        const dayBoxes = scheduleBoxes[day];
        const times = resolveStudentDaySchedule(student, schedule, day);
        return (
          <React.Fragment key={`sched-val-${day}`}>
            <div
              style={{
                ...pctBoxStyle(dayBoxes.inicio),
                fontSize: '8.8px',
                fontWeight: times.inicio ? 700 : 600,
              }}
              className="flex items-center justify-center text-center text-black leading-none"
            >
              {times.inicio || 'h'}
            </div>
            <div
              style={{
                ...pctBoxStyle(dayBoxes.fim),
                fontSize: '8.8px',
                fontWeight: times.fim ? 700 : 600,
              }}
              className="flex items-center justify-center text-center text-black leading-none"
            >
              {times.fim || 'h'}
            </div>
          </React.Fragment>
        );
      })}

      {/* 5. LOGO MICROLINS (Picture 23) E TEXTO DE VERSÃO (TextBox 8) */}
      <div
        style={pctBoxStyle(headerShapes.logo)}
        className="flex items-center justify-center pointer-events-none"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={MICROLINS_LOGO_BASE64}
          alt="Microlins"
          className="w-full h-full object-contain"
        />
      </div>

      <div
        style={{
          ...pctBoxStyle(headerShapes.version),
          fontSize: '7.2px',
          fontWeight: 700,
        }}
        className="flex items-center justify-center text-center text-black leading-none whitespace-nowrap"
      >
        {headerShapes.version.text}
      </div>
    </div>
  );
}
