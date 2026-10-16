// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Hook: lib/hooks/use-courses.ts
// Gerenciamento e consulta do catálogo de cursos via Supabase
// ==============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase/client';
import type { Curso } from '../../types/database';

export function useCourses() {
  const [courses, setCourses] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: sbError } = await supabase
        .from('cursos')
        .select('*')
        .order('nome', { ascending: true });

      if (sbError) {
        throw new Error(sbError.message);
      }

      setCourses(data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar cursos';
      setError(msg);
      console.error('Erro em useCourses:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  return {
    courses,
    loading,
    error,
    refresh: fetchCourses,
  };
}
