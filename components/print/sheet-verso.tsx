// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Component: components/print/sheet-verso.tsx
// Ficha de Acompanhamento Individual do Aluno - Página 2 (Verso A4)
// Usa LITERALMENTE a aba Verso exportada diretamente do ModeloFicha.xlsx pelo Excel
// ==============================================================================

'use client';

import React from 'react';
import type { StudentWithCourses } from '../../types/database';
import { MOLDE_VERSO_DATA_URL } from '../../lib/constants/modelo-ficha-assets';

interface SheetVersoProps {
  student?: StudentWithCourses;
}

export function SheetVerso({}: SheetVersoProps) {
  return (
    <div
      className="a4-sheet a4-verso relative bg-white text-black select-none mx-auto print:m-0"
      style={{
        width: '200mm',
        height: '286mm',
        maxHeight: '286mm',
        overflow: 'hidden',
        fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif",
      }}
    >
      {/* CAMADA LITERAL: Aba Verso exportada diretamente do ModeloFicha.xlsx pelo Excel */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={MOLDE_VERSO_DATA_URL}
        alt="Indicações adicionais para performance do Aluno"
        className="w-full h-full block pointer-events-none select-none"
        style={{ width: '100%', height: '100%', objectFit: 'fill' }}
      />
    </div>
  );
}
