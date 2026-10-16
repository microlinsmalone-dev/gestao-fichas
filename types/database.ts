// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Types: types/database.ts
// Definições de tipos TypeScript alinhados ao schema PostgreSQL do Supabase
// ==============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Ficha = {
  id: number;
  matricula: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  instrutor: string | null;
  data_nascimento: string | null;
  data_inicio_curso: string | null;
  data_termino_curso: string | null;
  data_linha_vida: string | null;
  data_form1: string | null;
  data_form2: string | null;
  data_dreamday: string | null;
  data_fechamento1: string | null;
  data_fechamento2: string | null;
  data_fechamento3: string | null;
  dia_semana: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  unit_id?: string | null;
  observacoes: string | null;
  created_at?: string;
  updated_at?: string;
};

export type FichaInsert = {
  id?: number;
  matricula: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  instrutor?: string | null;
  data_nascimento?: string | null;
  data_inicio_curso?: string | null;
  data_termino_curso?: string | null;
  data_linha_vida?: string | null;
  data_form1?: string | null;
  data_form2?: string | null;
  data_dreamday?: string | null;
  data_fechamento1?: string | null;
  data_fechamento2?: string | null;
  data_fechamento3?: string | null;
  dia_semana?: string | null;
  horario_inicio?: string | null;
  horario_fim?: string | null;
  unit_id?: string | null;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type FichaUpdate = Partial<FichaInsert>;

export type Curso = {
  id: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
};

export type CursoInsert = {
  id?: number;
  nome: string;
  descricao?: string | null;
  ativo?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type CursoUpdate = Partial<CursoInsert>;

export type FichaCurso = {
  id: number;
  ficha_id: number;
  curso_id: number;
  curso_nome: string;
  ordem: number; // 1 .. 18
  created_at?: string;
  updated_at?: string;
};

export type FichaCursoInsert = {
  id?: number;
  ficha_id: number;
  curso_id: number;
  curso_nome?: string;
  ordem: number;
  created_at?: string;
  updated_at?: string;
};

export type FichaCursoUpdate = Partial<FichaCursoInsert>;

export type StudentCourseItem = {
  id?: number;
  curso_id?: number;
  nome: string;
  ordem: number;
};

export type StudentWithCourses = Ficha & {
  cursos: StudentCourseItem[];
};

export type ScheduleConfig = {
  horarioInicio: string;
  horarioFim: string;
  diasSemana: string[];
  includeVerso?: boolean;
  diasConfig?: Record<string, { inicio: string; fim: string }>;
};

export type Database = {
  public: {
    Tables: {
      fichas: {
        Row: Ficha;
        Insert: FichaInsert;
        Update: FichaUpdate;
        Relationships: [];
      };
      cursos: {
        Row: Curso;
        Insert: CursoInsert;
        Update: CursoUpdate;
        Relationships: [];
      };
      fichas_cursos: {
        Row: FichaCurso;
        Insert: FichaCursoInsert;
        Update: FichaCursoUpdate;
        Relationships: [
          {
            foreignKeyName: 'fichas_cursos_ficha_id_fkey';
            columns: ['ficha_id'];
            isOneToOne: false;
            referencedRelation: 'fichas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fichas_cursos_curso_id_fkey';
            columns: ['curso_id'];
            isOneToOne: false;
            referencedRelation: 'cursos';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
