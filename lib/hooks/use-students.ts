// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Hook: lib/hooks/use-students.ts
// Gerenciamento completo de alunos (fichas) e cursos vinculados via Supabase
// ==============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase/client';
import type {
  Ficha,
  FichaInsert,
  FichaUpdate,
  FichaCursoInsert,
  StudentWithCourses,
  StudentCourseItem,
} from '../../types/database';

export function useStudents() {
  const [students, setStudents] = useState<StudentWithCourses[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Busca todas as fichas ordenadas por nome
      const { data: fichasData, error: fichasErr } = await supabase
        .from('fichas')
        .select('*')
        .order('nome', { ascending: true });

      if (fichasErr) {
        throw new Error(fichasErr.message);
      }

      // 2. Busca todos os vínculos de cursos ordenados por ordem
      const { data: linksData, error: linksErr } = await supabase
        .from('fichas_cursos')
        .select('*')
        .order('ordem', { ascending: true });

      if (linksErr) {
        throw new Error(linksErr.message);
      }

      // 3. Agrupa cursos por ficha_id
      const coursesMap = new Map<number, StudentCourseItem[]>();
      (linksData || []).forEach((link) => {
        const list = coursesMap.get(link.ficha_id) || [];
        list.push({
          id: link.id,
          curso_id: link.curso_id,
          nome: link.curso_nome,
          ordem: link.ordem,
        });
        coursesMap.set(link.ficha_id, list);
      });

      // 4. Monta lista completa de estudantes com seus cursos ordenados
      const compiled: StudentWithCourses[] = (fichasData || []).map((ficha) => ({
        ...ficha,
        cursos: (coursesMap.get(ficha.id) || []).sort((a, b) => a.ordem - b.ordem),
      }));

      setStudents(compiled);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar dados dos alunos';
      setError(msg);
      console.error('Erro em useStudents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  /**
   * Adiciona um novo aluno e seus cursos associados (até 18)
   */
  const addStudent = async (
    studentData: FichaInsert,
    courses: { curso_id: number; nome: string }[]
  ): Promise<{ success: boolean; student?: StudentWithCourses; error?: string }> => {
    try {
      setLoading(true);

      // Inserção do registro principal na tabela fichas
      const { data: newFicha, error: insertErr } = await supabase
        .from('fichas')
        .insert(studentData)
        .select()
        .single();

      if (insertErr) {
        throw new Error(insertErr.message);
      }

      // Inserção dos cursos vinculados na tabela fichas_cursos com ordem sequencial (1..18)
      if (courses && courses.length > 0) {
        const linksToInsert: FichaCursoInsert[] = courses.slice(0, 18).map((c, index) => ({
          ficha_id: newFicha.id,
          curso_id: c.curso_id,
          curso_nome: c.nome,
          ordem: index + 1,
        }));

        const { error: linksErr } = await supabase
          .from('fichas_cursos')
          .insert(linksToInsert);

        if (linksErr) {
          console.error('Aviso ao vincular cursos:', linksErr);
        }
      }

      await fetchStudents();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao cadastrar aluno';
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Atualiza os dados de um aluno e sincroniza seus cursos
   */
  const updateStudent = async (
    id: number,
    studentData: FichaUpdate,
    courses: { curso_id: number; nome: string }[]
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);

      // Atualiza tabela fichas
      const { error: updateErr } = await supabase
        .from('fichas')
        .update(studentData)
        .eq('id', id);

      if (updateErr) {
        throw new Error(updateErr.message);
      }

      // Remove cursos atuais do aluno
      const { error: delErr } = await supabase
        .from('fichas_cursos')
        .delete()
        .eq('ficha_id', id);

      if (delErr) {
        throw new Error(delErr.message);
      }

      // Reinsere cursos atualizados com ordem sequencial (1..18)
      if (courses && courses.length > 0) {
        const linksToInsert: FichaCursoInsert[] = courses.slice(0, 18).map((c, index) => ({
          ficha_id: id,
          curso_id: c.curso_id,
          curso_nome: c.nome,
          ordem: index + 1,
        }));

        const { error: linksErr } = await supabase
          .from('fichas_cursos')
          .insert(linksToInsert);

        if (linksErr) {
          throw new Error(linksErr.message);
        }
      }

      await fetchStudents();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao atualizar dados do aluno';
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Exclui um aluno pelo ID (cascade deleta fichas_cursos automaticamente no PostgreSQL)
   */
  const deleteStudent = async (id: number): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);

      const { error: delErr } = await supabase
        .from('fichas')
        .delete()
        .eq('id', id);

      if (delErr) {
        throw new Error(delErr.message);
      }

      // Atualiza o estado local imediatamente
      setStudents((prev) => prev.filter((s) => s.id !== id));
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao excluir aluno';
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  return {
    students,
    loading,
    error,
    refresh: fetchStudents,
    addStudent,
    updateStudent,
    deleteStudent,
  };
}
