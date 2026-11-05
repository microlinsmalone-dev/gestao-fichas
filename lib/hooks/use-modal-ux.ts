// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Hook: lib/hooks/use-modal-ux.ts
// Gerenciamento de usabilidade de modais: bloqueio de rolagem do body (com contagem
// de pilha para modais aninhados) e atalho de tecla ESC com prioridade hierárquica.
// ==============================================================================

'use client';

import { useEffect, useCallback } from 'react';

// Contador global de modais abertos no body
let openModalCounter = 0;

interface UseModalUxOptions {
  isOpen: boolean;
  onClose: () => void;
  /** Se houver uma subjanela/modal filho ativo neste momento, ignora o ESC do modal pai */
  nestedActive?: boolean;
}

export function useModalUx({ isOpen, onClose, nestedActive = false }: UseModalUxOptions) {
  // 1. Bloqueio de rolagem da página ao fundo (body scroll lock)
  useEffect(() => {
    if (!isOpen) return;

    openModalCounter++;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      openModalCounter = Math.max(0, openModalCounter - 1);
      if (openModalCounter === 0) {
        document.body.style.overflow = '';
      }
    };
  }, [isOpen]);

  // 2. Atalho de tecla ESC (respeitando subjanelas ativas)
  useEffect(() => {
    if (!isOpen || nestedActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, nestedActive, onClose]);

  // 3. Helper de clique no backdrop (fundo escuro fora do conteúdo)
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  return { handleBackdropClick };
}
