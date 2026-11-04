// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Component: components/students/student-modal.tsx
// Formulário ágil de alta produtividade (inspirado nas telas img2 e img3)
// Tela 1: Dados Cadastrais & Ciclo Pedagógico (layout em 3 colunas) com Agendamento Múltiplo
// Tela 2: Cursos Contratados (grade 3x6 de 18 slots)
// ==============================================================================

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  User,
  Calendar,
  BookOpen,
  Save,
  Loader2,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';
import { CourseSelector, type SelectedCourse } from '../courses/course-selector';
import { toInputDate, formatTime, handleDatePaste } from '../../lib/utils/date-utils';
import type { StudentWithCourses, FichaInsert } from '../../types/database';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student?: StudentWithCourses | null;
  onSave: (
    data: FichaInsert,
    courses: SelectedCourse[]
  ) => Promise<{ success: boolean; error?: string }>;
}

type StepType = 'dados' | 'cursos';

export const WEEKDAYS = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export interface DaySchedule {
  inicio: string;
  fim: string;
}

const DEFAULT_SCHEDULE: Record<Weekday, DaySchedule> = {
  'Segunda-feira': { inicio: '', fim: '' },
  'Terça-feira': { inicio: '', fim: '' },
  'Quarta-feira': { inicio: '', fim: '' },
  'Quinta-feira': { inicio: '', fim: '' },
  'Sexta-feira': { inicio: '', fim: '' },
  'Sábado': { inicio: '', fim: '' },
  'Domingo': { inicio: '', fim: '' },
};

export function StudentModal({
  isOpen,
  onClose,
  student,
  onSave,
}: StudentModalProps) {
  const isEditing = Boolean(student);
  const [activeStep, setActiveStep] = useState<StepType>('dados');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Coluna 1: Campos cadastrais
  const [matricula, setMatricula] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [instrutor, setInstrutor] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');

  // Agendamento Múltiplo (popup conforme imagem do sistema desktop)
  const [schedules, setSchedules] = useState<Record<Weekday, DaySchedule>>(DEFAULT_SCHEDULE);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  // Coluna 2: As 6 primeiras datas do Ciclo Pedagógico
  const [dataInicioCurso, setDataInicioCurso] = useState('');
  const [dataTerminoCurso, setDataTerminoCurso] = useState('');
  const [dataLinhaVida, setDataLinhaVida] = useState('');
  const [dataForm1, setDataForm1] = useState('');
  const [dataForm2, setDataForm2] = useState('');
  const [dataDreamday, setDataDreamday] = useState('');

  // Coluna 3: Os 3 Fechamentos Pedagógicos
  const [dataFechamento1, setDataFechamento1] = useState('');
  const [dataFechamento2, setDataFechamento2] = useState('');
  const [dataFechamento3, setDataFechamento3] = useState('');

  // Cursos vinculados (Tela 2 - 18 slots)
  const [selectedCourses, setSelectedCourses] = useState<SelectedCourse[]>([]);

  // Inicializa ou reseta formulário quando abre ou o aluno muda
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setActiveStep('dados');
      setIsScheduleOpen(false);

      if (student) {
        setMatricula(student.matricula || '');
        setNome(student.nome || '');
        setEmail(student.email || '');
        setTelefone(student.telefone || '');
        setInstrutor(student.instrutor || '');
        setDataNascimento(toInputDate(student.data_nascimento));

        setDataInicioCurso(toInputDate(student.data_inicio_curso));
        setDataTerminoCurso(toInputDate(student.data_termino_curso));
        setDataLinhaVida(toInputDate(student.data_linha_vida));
        setDataForm1(toInputDate(student.data_form1));
        setDataForm2(toInputDate(student.data_form2));
        setDataDreamday(toInputDate(student.data_dreamday));
        setDataFechamento1(toInputDate(student.data_fechamento1));
        setDataFechamento2(toInputDate(student.data_fechamento2));
        setDataFechamento3(toInputDate(student.data_fechamento3));

        // Parser de agendamento múltiplo
        const parsed: Record<Weekday, DaySchedule> = { ...DEFAULT_SCHEDULE };
        if (student.dia_semana && student.dia_semana.startsWith('{')) {
          try {
            const obj = JSON.parse(student.dia_semana);
            WEEKDAYS.forEach((d) => {
              if (obj[d]) {
                parsed[d] = {
                  inicio: formatTime(obj[d].inicio || ''),
                  fim: formatTime(obj[d].fim || ''),
                };
              }
            });
          } catch {}
        } else if (student.dia_semana) {
          const raw = student.dia_semana.toLowerCase();
          const ini = formatTime(student.horario_inicio) || '14h00';
          const fim = formatTime(student.horario_fim) || '16h00';
          if (raw.includes('seg')) parsed['Segunda-feira'] = { inicio: ini, fim };
          if (raw.includes('ter')) parsed['Terça-feira'] = { inicio: ini, fim };
          if (raw.includes('qua')) parsed['Quarta-feira'] = { inicio: ini, fim };
          if (raw.includes('qui')) parsed['Quinta-feira'] = { inicio: ini, fim };
          if (raw.includes('sex')) parsed['Sexta-feira'] = { inicio: ini, fim };
          if (raw.includes('sáb') || raw.includes('sab')) parsed['Sábado'] = { inicio: ini, fim };
          if (raw.includes('dom')) parsed['Domingo'] = { inicio: ini, fim };
        }
        setSchedules(parsed);

        const mappedCourses: SelectedCourse[] = (student.cursos || []).map((c) => ({
          curso_id: c.curso_id || c.id || 0,
          nome: c.nome,
        }));
        setSelectedCourses(mappedCourses);
      } else {
        // Modo Novo Aluno: limpa campos
        setMatricula('');
        setNome('');
        setEmail('');
        setTelefone('');
        setInstrutor('');
        setDataNascimento('');

        setDataInicioCurso('');
        setDataTerminoCurso('');
        setDataLinhaVida('');
        setDataForm1('');
        setDataForm2('');
        setDataDreamday('');
        setDataFechamento1('');
        setDataFechamento2('');
        setDataFechamento3('');

        setSchedules({ ...DEFAULT_SCHEDULE });
        setSelectedCourses([]);
      }
    }
  }, [isOpen, student]);

  // Dias com horários preenchidos
  const activeDaysList = useMemo(() => {
    return WEEKDAYS.filter(
      (d) => schedules[d].inicio.trim() !== '' || schedules[d].fim.trim() !== ''
    );
  }, [schedules]);

  // Atalho de teclado Ctrl+Enter para salvar rapidamente
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (!isOpen) return null;

  // Limpa apenas as 9 datas pedagógicas
  const handleClearDates = () => {
    setDataInicioCurso('');
    setDataTerminoCurso('');
    setDataLinhaVida('');
    setDataForm1('');
    setDataForm2('');
    setDataDreamday('');
    setDataFechamento1('');
    setDataFechamento2('');
    setDataFechamento3('');
  };

  const handleScheduleBlur = (dia: Weekday, field: 'inicio' | 'fim') => {
    setSchedules((prev) => {
      const raw = prev[dia][field];
      if (!raw) return prev;
      return {
        ...prev,
        [dia]: {
          ...prev[dia],
          [field]: formatTime(raw),
        },
      };
    });
  };

  const handleConfirmScheduleModal = () => {
    setSchedules((prev) => {
      const next: Record<Weekday, DaySchedule> = { ...DEFAULT_SCHEDULE };
      WEEKDAYS.forEach((d) => {
        next[d] = {
          inicio: formatTime(prev[d].inicio),
          fim: formatTime(prev[d].fim),
        };
      });
      return next;
    });
    setIsScheduleOpen(false);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const cleanMatricula = matricula.trim();
    const cleanNome = nome.trim();

    if (!cleanMatricula) {
      setErrorMessage('A matrícula é obrigatória.');
      setActiveStep('dados');
      return;
    }

    if (!cleanNome) {
      setErrorMessage('O nome do aluno é obrigatório.');
      setActiveStep('dados');
      return;
    }

    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setErrorMessage('Por favor, informe um e-mail válido.');
        setActiveStep('dados');
        return;
      }
    }

    // Monta dados do agendamento múltiplo
    let diaSemanaPayload: string | null = null;
    let horarioInicioPayload: string | null = null;
    let horarioFimPayload: string | null = null;

    if (activeDaysList.length > 0) {
      const scheduleMap: Record<string, { inicio: string; fim: string }> = {};
      activeDaysList.forEach((d) => {
        scheduleMap[d] = {
          inicio: formatTime(schedules[d].inicio),
          fim: formatTime(schedules[d].fim),
        };
      });
      diaSemanaPayload = JSON.stringify(scheduleMap);
      horarioInicioPayload = formatTime(schedules[activeDaysList[0]].inicio) || null;
      horarioFimPayload = formatTime(schedules[activeDaysList[0]].fim) || null;
    }

    const payload: FichaInsert = {
      matricula: cleanMatricula,
      nome: cleanNome,
      email: email.trim() || null,
      telefone: telefone.trim() || null,
      instrutor: instrutor.trim() || null,
      data_nascimento: dataNascimento || null,
      data_inicio_curso: dataInicioCurso || null,
      data_termino_curso: dataTerminoCurso || null,
      data_linha_vida: dataLinhaVida || null,
      data_form1: dataForm1 || null,
      data_form2: dataForm2 || null,
      data_dreamday: dataDreamday || null,
      data_fechamento1: dataFechamento1 || null,
      data_fechamento2: dataFechamento2 || null,
      data_fechamento3: dataFechamento3 || null,
      dia_semana: diaSemanaPayload,
      horario_inicio: horarioInicioPayload,
      horario_fim: horarioFimPayload,
      observacoes: student?.observacoes || null,
    };

    setIsSubmitting(true);
    try {
      const result = await onSave(payload, selectedCourses);
      if (result.success) {
        onClose();
      } else {
        setErrorMessage(result.error || 'Erro ao salvar aluno.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado ao salvar';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-[#242424] rounded-2xl max-w-6xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-700 overflow-hidden transform animate-in zoom-in-95 duration-150 text-white"
        role="dialog"
        aria-modal="true"
      >
        {/* Cabeçalho do Modal */}
        <div className="px-6 py-3.5 border-b border-slate-700/80 flex items-center justify-between bg-[#1e1e1e]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1f6aa5]/25 text-[#38bdf8] flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                {isEditing ? `Editar Aluno: ${student?.nome}` : 'Cadastrar Novo Aluno'}
              </h3>
              <p className="text-xs text-slate-400">
                {isEditing ? `Matrícula: ${student?.matricula}` : 'Preencha os dados cadastrais e o ciclo pedagógico'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            title="Fechar formulário"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas Principais em 2 Etapas Ágeis (img2 e img3) */}
        <div className="flex border-b border-slate-700/80 px-6 bg-[#1e1e1e] gap-3">
          <button
            type="button"
            onClick={() => setActiveStep('dados')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeStep === 'dados'
                ? 'border-[#1f6aa5] text-[#38bdf8]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Dados Cadastrais</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep('cursos')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeStep === 'cursos'
                ? 'border-[#1f6aa5] text-[#38bdf8]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>2. Cursos Contratados</span>
          </button>
        </div>

        {/* Mensagem de Erro Geral */}
        {errorMessage && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Corpo do Formulário com Scroll Suave */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-[#242424]">
          {/* ============================================================== */}
          {/* TELA 1: DADOS CADASTRAIS & CICLO PEDAGÓGICO (ESTILO IMG2)       */}
          {/* ============================================================== */}
          {activeStep === 'dados' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
              {/* --- COLUNA 1: DADOS PESSOAIS DO ALUNO --- */}
              <div className="space-y-3.5 bg-[#1c1c1c] p-4 rounded-2xl border border-slate-700/70">
                <div className="flex items-center gap-1.5 pb-1 border-b border-slate-700/60">
                  <User className="w-4 h-4 text-[#38bdf8]" />
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                    Identificação do Aluno
                  </h4>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    N° MATRÍCULA <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    tabIndex={1}
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value)}
                    placeholder="Ex: 5135887"
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-600 focus:outline-none focus:ring-1 focus:ring-[#1f6aa5] focus:border-[#1f6aa5] font-mono bg-[#2b2b2b] text-white font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    NOME COMPLETO <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    tabIndex={2}
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: MIGUEL ALEXANDRE BRAGA LEITE"
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-600 focus:outline-none focus:ring-1 focus:ring-[#1f6aa5] focus:border-[#1f6aa5] bg-[#2b2b2b] text-white font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    E-MAIL
                  </label>
                  <input
                    type="email"
                    tabIndex={3}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="aluno@exemplo.com"
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-600 focus:outline-none focus:ring-1 focus:ring-[#1f6aa5] focus:border-[#1f6aa5] bg-[#2b2b2b] text-white placeholder-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    DATA DE NASCIMENTO
                  </label>
                  <input
                    type="date"
                    tabIndex={4}
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    onPaste={(e) => handleDatePaste(e, setDataNascimento)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-600 focus:outline-none focus:ring-1 focus:ring-[#1f6aa5] focus:border-[#1f6aa5] bg-[#2b2b2b] text-white [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    TELEFONE / CELULAR
                  </label>
                  <input
                    type="text"
                    tabIndex={5}
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(17) 99185-9001"
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-600 focus:outline-none focus:ring-1 focus:ring-[#1f6aa5] focus:border-[#1f6aa5] bg-[#2b2b2b] text-white placeholder-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    INSTRUTOR PEDAGÓGICO
                  </label>
                  <input
                    type="text"
                    tabIndex={6}
                    value={instrutor}
                    onChange={(e) => setInstrutor(e.target.value)}
                    placeholder="Ex: Pyetra Alves"
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-600 focus:outline-none focus:ring-1 focus:ring-[#1f6aa5] focus:border-[#1f6aa5] bg-[#2b2b2b] text-white placeholder-slate-500"
                  />
                </div>

                {/* Agendamento Múltiplo de Horários (Conforme Imagem 2 do Sistema Desktop) */}
                <div className="pt-2">
                  <button
                    type="button"
                    tabIndex={7}
                    onClick={() => setIsScheduleOpen(true)}
                    className="w-full py-2 px-3 rounded-xl border border-slate-600 bg-[#2b2b2b] hover:bg-[#333333] hover:border-[#1f6aa5] text-slate-200 text-xs font-semibold flex items-center justify-between transition-all shadow-2xs group"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#38bdf8]" />
                      <span>Agendamento Múltiplo</span>
                    </div>
                    {activeDaysList.length > 0 ? (
                      <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-700/60 px-2 py-0.5 rounded-full">
                        {activeDaysList.length} dia(s) configurado(s)
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 group-hover:text-[#38bdf8]">
                        Definir horários →
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* --- COLUNA 2: CICLO PEDAGÓGICO - VIGÊNCIA & FORMS --- */}
              <div className="space-y-3.5 bg-[#1c1c1c] p-4 rounded-2xl border border-slate-700/70">
                <div className="flex items-center gap-1.5 pb-1 border-b border-slate-700/60">
                  <Calendar className="w-4 h-4 text-[#38bdf8]" />
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                    Ciclo Pedagógico (Parte 1)
                  </h4>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    DATA INÍCIO CURSO
                  </label>
                  <input
                    type="date"
                    tabIndex={8}
                    value={dataInicioCurso}
                    onChange={(e) => setDataInicioCurso(e.target.value)}
                    onPaste={(e) => handleDatePaste(e, setDataInicioCurso)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-600 focus:outline-none focus:ring-1 focus:ring-[#1f6aa5] focus:border-[#1f6aa5] bg-[#2b2b2b] text-white [color-scheme:dark] font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    DATA TÉRMINO CURSO
                  </label>
                  <input
                    type="date"
                    tabIndex={9}
                    value={dataTerminoCurso}
                    onChange={(e) => setDataTerminoCurso(e.target.value)}
                    onPaste={(e) => handleDatePaste(e, setDataTerminoCurso)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-600 focus:outline-none focus:ring-1 focus:ring-[#1f6aa5] focus:border-[#1f6aa5] bg-[#2b2b2b] text-white [color-scheme:dark] font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    DATA LINHA DA VIDA
                  </label>
                  <input
                    type="date"
                    tabIndex={10}
                    value={dataLinhaVida}
                    onChange={(e) => setDataLinhaVida(e.target.value)}
                    onPaste={(e) => handleDatePaste(e, setDataLinhaVida)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-600 focus:outline-none focus:ring-1 focus:ring-[#1f6aa5] focus:border-[#1f6aa5] bg-[#2b2b2b] text-white [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    DATA FORM 1
                  </label>
                  <input
                    type="date"
                    tabIndex={11}
                    value={dataForm1}
                    onChange={(e) => setDataForm1(e.target.value)}
                    onPaste={(e) => handleDatePaste(e, setDataForm1)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-600 focus:outline-none focus:ring-1 focus:ring-[#1f6aa5] focus:border-[#1f6aa5] bg-[#2b2b2b] text-white [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    DATA FORM 2
                  </label>
                  <input
                    type="date"
                    tabIndex={12}
                    value={dataForm2}
                    onChange={(e) => setDataForm2(e.target.value)}
                    onPaste={(e) => handleDatePaste(e, setDataForm2)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-600 focus:outline-none focus:ring-1 focus:ring-[#1f6aa5] focus:border-[#1f6aa5] bg-[#2b2b2b] text-white [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    DATA DREAMDAY
                  </label>
                  <input
                    type="date"
                    tabIndex={13}
                    value={dataDreamday}
                    onChange={(e) => setDataDreamday(e.target.value)}
                    onPaste={(e) => handleDatePaste(e, setDataDreamday)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-600 focus:outline-none focus:ring-1 focus:ring-[#1f6aa5] focus:border-[#1f6aa5] bg-[#2b2b2b] text-white [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* --- COLUNA 3: FECHAMENTOS & AÇÕES RÁPIDAS --- */}
              <div className="space-y-3.5 bg-[#1c1c1c] p-4 rounded-2xl border border-slate-700/70 flex flex-col justify-between">
                <div className="space-y-3.5">
                  <div className="flex items-center gap-1.5 pb-1 border-b border-slate-700/60">
                    <Calendar className="w-4 h-4 text-[#38bdf8]" />
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                      Fechamentos de Ciclo
                    </h4>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      DATA FECHAMENTO 1
                    </label>
                    <input
                      type="date"
                      tabIndex={14}
                      value={dataFechamento1}
                      onChange={(e) => setDataFechamento1(e.target.value)}
                      onPaste={(e) => handleDatePaste(e, setDataFechamento1)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-600 focus:outline-none focus:ring-1 focus:ring-[#1f6aa5] focus:border-[#1f6aa5] bg-[#2b2b2b] text-white [color-scheme:dark]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      DATA FECHAMENTO 2
                    </label>
                    <input
                      type="date"
                      tabIndex={15}
                      value={dataFechamento2}
                      onChange={(e) => setDataFechamento2(e.target.value)}
                      onPaste={(e) => handleDatePaste(e, setDataFechamento2)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-600 focus:outline-none focus:ring-1 focus:ring-[#1f6aa5] focus:border-[#1f6aa5] bg-[#2b2b2b] text-white [color-scheme:dark]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      DATA FECHAMENTO 3
                    </label>
                    <input
                      type="date"
                      tabIndex={16}
                      value={dataFechamento3}
                      onChange={(e) => setDataFechamento3(e.target.value)}
                      onPaste={(e) => handleDatePaste(e, setDataFechamento3)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-600 focus:outline-none focus:ring-1 focus:ring-[#1f6aa5] focus:border-[#1f6aa5] bg-[#2b2b2b] text-white [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Bloco de Ações Rápidas */}
                <div className="pt-3 border-t border-slate-700/80 space-y-2">
                  <button
                    type="button"
                    onClick={() => setActiveStep('cursos')}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-all flex items-center justify-center gap-2 shadow-xs"
                  >
                    <span>PRÓXIMO: CURSOS CONTRATADOS</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleClearDates}
                      className="flex-1 py-1.5 px-2 rounded-xl text-[11px] font-semibold text-rose-300 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-800/50 transition-colors flex items-center justify-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Limpar Datas</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TELA 2: CURSOS CONTRATADOS (GRADE 3X6 DE 18 SLOTS - IMG3)      */}
          {/* ============================================================== */}
          {activeStep === 'cursos' && (
            <div className="animate-in fade-in space-y-4">
              <CourseSelector
                selectedCourses={selectedCourses}
                onChange={setSelectedCourses}
                disabled={isSubmitting}
              />
            </div>
          )}
        </div>

        {/* Rodapé com Navegação e Botão de Salvar */}
        <div className="px-6 py-3.5 bg-[#1e1e1e] border-t border-slate-700/80 flex items-center justify-between">
          <div className="text-xs font-medium text-slate-400">
            {activeStep === 'dados'
              ? 'Passo 1 de 2: Dados Cadastrais'
              : 'Passo 2 de 2: Cursos Contratados'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-all"
            >
              Cancelar
            </button>

            {activeStep === 'cursos' ? (
              <button
                type="button"
                onClick={() => setActiveStep('dados')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-200 bg-[#2a2a2a] hover:bg-[#333333] border border-slate-700 rounded-xl transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveStep('cursos')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-200 bg-[#2a2a2a] hover:bg-[#333333] border border-slate-700 rounded-xl transition-all"
              >
                <span>Próximo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit()}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#1f6aa5] hover:bg-[#154f78] rounded-xl shadow-xs transition-all disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'Salvar Alterações' : 'Cadastrar Aluno'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* POPUP MODAL: AGENDAMENTO MÚLTIPLO (CONFORME IMAGEM 2)           */}
      {/* ============================================================== */}
      {isScheduleOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#242424] text-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-700 space-y-4 animate-in zoom-in-95">
            {/* Header da Janela de Agendamento */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-[#1f6aa5] flex items-center justify-center text-white text-[10px] font-bold shadow-xs">
                  C
                </div>
                <h4 className="text-sm font-bold text-white tracking-wide">
                  Agendamento Múltiplo
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Subtítulo Instrutivo */}
            <div className="text-center space-y-0.5">
              <p className="text-xs font-bold text-slate-100">
                Preencha os horários nos dias desejados:
              </p>
              <p className="text-[11px] text-slate-400">
                (Ex: 14h00 às 16h00)
              </p>
            </div>

            {/* Linhas dos 7 Dias da Semana */}
            <div className="space-y-2 py-1">
              {WEEKDAYS.map((dia) => (
                <div key={dia} className="flex items-center justify-between gap-2 text-xs">
                  <span className="w-28 text-slate-200 font-medium">{dia}</span>
                  <input
                    type="text"
                    value={schedules[dia].inicio}
                    onChange={(e) =>
                      setSchedules((prev) => ({
                        ...prev,
                        [dia]: { ...prev[dia], inicio: e.target.value },
                      }))
                    }
                    onBlur={() => handleScheduleBlur(dia, 'inicio')}
                    placeholder="14h00"
                    className="w-20 px-2 py-1 bg-[#333333] border border-slate-600 rounded-lg text-white text-center text-xs focus:outline-none focus:border-blue-400 font-mono"
                  />
                  <span className="text-slate-400 text-xs">às</span>
                  <input
                    type="text"
                    value={schedules[dia].fim}
                    onChange={(e) =>
                      setSchedules((prev) => ({
                        ...prev,
                        [dia]: { ...prev[dia], fim: e.target.value },
                      }))
                    }
                    onBlur={() => handleScheduleBlur(dia, 'fim')}
                    placeholder="16h00"
                    className="w-20 px-2 py-1 bg-[#333333] border border-slate-600 rounded-lg text-white text-center text-xs focus:outline-none focus:border-blue-400 font-mono"
                  />
                </div>
              ))}
            </div>

            {/* Botão Confirmar Centralizado */}
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={handleConfirmScheduleModal}
                className="w-44 py-2 px-4 rounded-xl text-xs font-bold text-white bg-[#1f6aa5] hover:bg-[#154f78] transition-colors shadow-sm"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
