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

function pctBoxStyle(rect: { left: number; top: number; width: number; height: number }): React.CSSProperties {
  return {
    position: 'absolute',
    left: `${(rect.left / TOTAL_W) * 100}%`,
    top: `${(rect.top / TOTAL_H) * 100}%`,
    width: `${(rect.width / TOTAL_W) * 100}%`,
    height: `${(rect.height / TOTAL_H) * 100}%`,
  };
}

function scaleFontPx(excelPt: number): string {
  if (excelPt >= 16) return '14px';
  if (excelPt >= 10) return '9.2px';
  if (excelPt >= 9) return '8.5px';
  return '8px';
}

export function SheetVerso({}: SheetVersoProps) {
  const { versoVectorCells } = MODELO_FICHA_LAYOUT;

  return (
    <div
      className="a4-sheet a4-verso relative bg-white text-black select-none mx-auto print:m-0"
      style={{
        width: '200mm',
        height: '286mm',
        maxHeight: '286mm',
        overflow: 'hidden',
        fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* 1. CAMADA DE GRADE E FUNDOS 100% VETORIAL (SVG CRISP EDGES) */}
      <svg
        viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        className="w-full h-full block pointer-events-none select-none"
        style={{ width: '100%', height: '100%' }}
      >
        {versoVectorCells.map((cell) => (
          <rect
            key={cell.addr}
            x={cell.left}
            y={cell.top}
            width={cell.width}
            height={cell.height}
            fill={cell.bg || '#FFFFFF'}
            stroke="#000000"
            strokeWidth="0.7"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Moldura Externa Fiel ao A1:P49 */}
        <rect
          x={0}
          y={0}
          width={TOTAL_W}
          height={TOTAL_H}
          fill="none"
          stroke="#000000"
          strokeWidth="1.1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* 2. CAMADA DE TEXTOS VETORIAIS DAS CÉLULAS NAS COORDENADAS EXATAS DO EXCEL */}
      {versoVectorCells.map((cell) => {
        if (!cell.text) return null;

        const displayText = cell.text;
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
                color: cell.color,
                fontSize: scaleFontPx(cell.fontSize),
                fontWeight: cell.bold ? 700 : 400,
              }}
              className="flex items-center justify-center overflow-hidden"
            >
              <span
                className="whitespace-nowrap block"
                style={{ transform: 'rotate(-90deg)' }}
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
              color: cell.color,
              fontSize: scaleFontPx(cell.fontSize),
              fontWeight: cell.bold ? 700 : 400,
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

