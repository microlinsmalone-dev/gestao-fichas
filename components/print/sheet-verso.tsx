// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Component: components/print/sheet-verso.tsx
// Ficha de Acompanhamento Individual do Aluno - Página 2 (Verso A4)
// Renderização 100% VETORIAL (zero blur de bitmap) usando literalmente o mapa de
// coordenadas exatas (Left, Top, Width, Height em pt) da aba Verso do ModeloFicha.xlsx.
// ==============================================================================

'use client';

import React from 'react';
import type { StudentWithCourses } from '../../types/database';
import { MODELO_FICHA_LAYOUT } from '../../lib/constants/modelo-ficha-assets';

interface SheetVersoProps {
  student?: StudentWithCourses;
}

const TOTAL_W = MODELO_FICHA_LAYOUT.versoWidthPt;
const TOTAL_H = MODELO_FICHA_LAYOUT.versoHeightPt;

// Margem vetorial de respiro de 4pt para que todos os traços
// nas 4 bordas fiquem 100% contidos dentro do viewBox do SVG sem cortes.
const SVG_PAD = 4;
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
  if (excelPt >= 16) return '14.5px';
  if (excelPt >= 10) return '9.2px';
  if (excelPt >= 9) return '8.8px';
  return '8.2px';
}

export function SheetVerso({}: SheetVersoProps) {
  const { versoVectorCells } = MODELO_FICHA_LAYOUT;

  return (
    <div
      className="a4-sheet a4-verso relative bg-white text-black select-none mx-auto print:mx-auto print:my-0"
      style={{
        width: '196mm',
        height: '282mm',
        maxHeight: '282mm',
        overflow: 'hidden',
        fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* 1. CAMADA DE GRADE E FUNDOS 100% VETORIAL (2 CAMADAS: FUNDOS -> GRADE UNIFORME) */}
      <svg
        viewBox={`-${SVG_PAD} -${SVG_PAD} ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        shapeRendering="geometricPrecision"
        className="w-full h-full block pointer-events-none select-none"
        style={{ width: '100%', height: '100%' }}
      >
        {/* CAMADA 1A: FUNDOS COLORIDOS (SEM BORDA, PARA NUNCA ENCOBRIR TRAÇOS VIZINHOS) */}
        {versoVectorCells
          .filter((cell) => Boolean(cell.bg))
          .map((cell) => (
            <rect
              key={`bg-${cell.addr}`}
              x={cell.left}
              y={cell.top}
              width={cell.width}
              height={cell.height}
              fill={cell.bg === '#D9D9D9' ? '#C8D0DC' : cell.bg!}
              stroke="none"
            />
          ))}

        {/* CAMADA 1B: GRADE COMPLETA (100% DAS LINHAS INTERNAS E EXTERNAS COM A MESMA FORÇA) */}
        {versoVectorCells.map((cell) => (
          <rect
            key={cell.addr}
            x={cell.left}
            y={cell.top}
            width={cell.width}
            height={cell.height}
            fill="none"
            stroke="#000000"
            strokeWidth="1.8"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="miter"
            strokeLinecap="square"
          />
        ))}

        {/* Moldura Externa Fiel ao A1:P49 com exatamente a mesma força da grade */}
        <rect
          x={0}
          y={0}
          width={TOTAL_W}
          height={TOTAL_H}
          fill="none"
          stroke="#000000"
          strokeWidth="1.8"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="miter"
          strokeLinecap="square"
        />
      </svg>

      {/* 2. CAMADA DE TEXTOS VETORIAIS DAS CÉLULAS NAS COORDENADAS EXATAS DO EXCEL */}
      {versoVectorCells.map((cell) => {
        if (!cell.text) return null;

        const displayText = cell.text;
        const isHeader = cell.bg === '#D9D9D9' || cell.bold || cell.addr === 'A1:P1' || cell.addr === 'A37:P37';
        // Converte o azul claro #0070C0 para o azul real profundo #003B75 para maior densidade de tinta
        const fontColor = cell.color === '#0070C0' ? '#003B75' : (cell.color || '#000000');
        const isMarker = cell.text === '/         /' || cell.text === 'h';
        const isBold = isHeader || cell.bold || isMarker;

        const isCentered =
          cell.align === 'center' ||
          cell.text === '/         /' ||
          cell.text === 'h';

        if (cell.vertical) {
          return (
            <div
              key={`vtxt-${cell.addr}`}
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

        return (
          <div
            key={`vtxt-${cell.addr}`}
            style={{
              ...pctBoxStyle(cell),
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
    </div>
  );
}

