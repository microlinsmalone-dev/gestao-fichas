// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Component: components/students/student-modal.tsx
// Formulário completo de cadastro e edição de alunos com campos cadastrais,
// as 9 datas pedagógicas e gestão/ordenação de cursos
// ==============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Calendar,
  BookOpen,
  Save,
  Loader2,
  AlertCircle,
  Clock,
  FileText,
} from 'lucide-react';
import { CourseSelector, type SelectedCourse } from '../courses/course-selector';
import { toInputDate } from '../../lib/utils/date-utils';
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

type TabType = 'cadastral' | 'pedagogico' | 'cursos';

export function StudentModal({
  isOpen,
  onClose,
  student,
  onSave,
}: StudentModalProps) {
  const isEditing = Boolean(student);
  const [activeTab, setActiveTab] = useState<TabType>('cadastral');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Campos cadastrais
  const [matricula, setMatricula] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [instrutor, setInstrutor] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');

  // As 9 Datas do Ciclo Pedagógico
  const [dataInicioCurso, setDataInicioCurso] = useState('');
  const [dataTerminoCurso, setDataTerminoCurso] = useState('');
  const [dataLinhaVida, setDataLinhaVida] = useState('');
  const [dataForm1, setDataForm1] = useState('');
  const [dataForm2, setDataForm2] = useState('');
  const [dataDreamday, setDataDreamday] = useState('');
  const [dataFechamento1, setDataFechamento1] = useState('');
  const [dataFechamento2, setDataFechamento2] = useState('');
  const [dataFechamento3, setDataFechamento3] = useState('');

  // Dados de agendamento & observações
  const [diaSemana, setDiaSemana] = useState('');
  const [horarioInicio, setHorarioInicio] = useState('');
  const [horarioFim, setHorarioFim] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Cursos vinculados
  const [selectedCourses, setSelectedCourses] = useState<SelectedCourse[]>([]);

  // Inicializa ou reseta formulário quando abre ou o aluno muda
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setActiveTab('cadastral');

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

        setDiaSemana(student.dia_semana || '');
        setHorarioInicio(student.horario_inicio || '');
        setHorarioFim(student.horario_fim || '');
        setObservacoes(student.observacoes || '');

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

        setDiaSemana('');
        setHorarioInicio('');
        setHorarioFim('');
        setObservacoes('');

        setSelectedCourses([]);
      }
    }
  }, [isOpen, student]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validações obrigatórias
    const cleanMatricula = matricula.trim();
    const cleanNome = nome.trim();

    if (!cleanMatricula) {
      setErrorMessage('A matrícula é obrigatória.');
      setActiveTab('cadastral');
      return;
    }

    if (!cleanNome) {
      setErrorMessage('O nome do aluno é obrigatório.');
      setActiveTab('cadastral');
      return;
    }

    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setErrorMessage('Por favor, informe um e-mail válido.');
        setActiveTab('cadastral');
        return;
      }
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
      dia_semana: diaSemana.trim() || null,
      horario_inicio: horarioInicio.trim() || null,
      horario_fim: horarioFim.trim() || null,
      observacoes: observacoes.trim() || null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden transform animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Cabeçalho do Modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0f3b7d] flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isEditing ? `Editar Aluno: ${student?.nome}` : 'Cadastrar Novo Aluno'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing
                  ? `Matrícula: ${student?.matricula} • Atualize dados cadastrais e cursos`
                  : 'Preencha os dados cadastrais, pedagógicos e vincule os cursos'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas de Navegação no Formulário */}
        <div className="flex border-b border-slate-100 px-6 bg-white gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('cadastral')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'cadastral'
                ? 'border-[#0f3b7d] text-[#0f3b7d]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Dados Cadastrais</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pedagogico')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'pedagogico'
                ? 'border-[#0f3b7d] text-[#0f3b7d]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Ciclo Pedagógico (9 Datas)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cursos')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'cursos'
                ? 'border-[#0f3b7d] text-[#0f3b7d]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Cursos Contratados ({selectedCourses.length}/18)</span>
          </button>
        </div>

        {/* Mensagem de Erro Geral */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Corpo do Formulário com Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ABA 1: DADOS CADASTRAIS */}
          {activeTab === 'cadastral' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Matrícula <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value)}
                    placeholder="Ex: 5056188"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome Completo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: TAMIRIS MARIANA"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d] font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="aluno@exemplo.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefone / Celular
                  </label>
                  <input
                    type="text"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(17) 98819-8252"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Instrutor Pedagógico
                  </label>
                  <input
                    type="text"
                    value={instrutor}
                    onChange={(e) => setInstrutor(e.target.value)}
                    placeholder="Ex: Pyetra Alves"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data de Nascimento
                  </label>
                  <input
                    type="date"
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d]"
                  />
                </div>
              </div>

              {/* Informações adicionais de horário de aula */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Horários das Aulas (Ficha Frente)</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Dia da Semana
                    </label>
                    <input
                      type="text"
                      value={diaSemana}
                      onChange={(e) => setDiaSemana(e.target.value)}
                      placeholder="Ex: Segunda e Quarta"
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Horário Inicial
                    </label>
                    <input
                      type="text"
                      value={horarioInicio}
                      onChange={(e) => setHorarioInicio(e.target.value)}
                      placeholder="08:00"
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Horário Final
                    </label>
                    <input
                      type="text"
                      value={horarioFim}
                      onChange={(e) => setHorarioFim(e.target.value)}
                      placeholder="10:00"
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações Gerais
                </label>
                <textarea
                  rows={2}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Informações adicionais pedagógicas..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d]"
                />
              </div>
            </div>
          )}

          {/* ABA 2: AS 9 DATAS DO CICLO PEDAGÓGICO */}
          {activeTab === 'pedagogico' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-blue-50/70 border border-blue-200/60 p-3 rounded-xl text-xs text-blue-900 leading-relaxed">
                As 9 datas do ciclo pedagógico são impressas diretamente no cabeçalho e verso
                da Ficha de Acompanhamento A4 da Microlins Potirendaba.
              </div>

              {/* Grupo 1: Curso Principal */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#0f3b7d]" />
                  <span>Vigência do Contrato</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      1. Data de Início do Curso
                    </label>
                    <input
                      type="date"
                      value={dataInicioCurso}
                      onChange={(e) => setDataInicioCurso(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      2. Data de Término Prevista
                    </label>
                    <input
                      type="date"
                      value={dataTerminoCurso}
                      onChange={(e) => setDataTerminoCurso(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d]"
                    />
                  </div>
                </div>
              </div>

              {/* Grupo 2: Marcos Pedagógicos */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#0f3b7d]" />
                  <span>Marcos e Avaliações de Acompanhamento</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      3. Linha da Vida
                    </label>
                    <input
                      type="date"
                      value={dataLinhaVida}
                      onChange={(e) => setDataLinhaVida(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      4. Form 1
                    </label>
                    <input
                      type="date"
                      value={dataForm1}
                      onChange={(e) => setDataForm1(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      5. Form 2
                    </label>
                    <input
                      type="date"
                      value={dataForm2}
                      onChange={(e) => setDataForm2(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      6. Dreamday
                    </label>
                    <input
                      type="date"
                      value={dataDreamday}
                      onChange={(e) => setDataDreamday(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d]"
                    />
                  </div>
                </div>
              </div>

              {/* Grupo 3: Fechamentos Pedagógicos */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#0f3b7d]" />
                  <span>Fechamentos de Ciclo</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      7. Fechamento 1
                    </label>
                    <input
                      type="date"
                      value={dataFechamento1}
                      onChange={(e) => setDataFechamento1(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      8. Fechamento 2
                    </label>
                    <input
                      type="date"
                      value={dataFechamento2}
                      onChange={(e) => setDataFechamento2(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      9. Fechamento 3
                    </label>
                    <input
                      type="date"
                      value={dataFechamento3}
                      onChange={(e) => setDataFechamento3(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0f3b7d]/20 focus:border-[#0f3b7d]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA 3: CURSOS CONTRATADOS & ORDENAÇÃO */}
          {activeTab === 'cursos' && (
            <div className="animate-in fade-in">
              <CourseSelector
                selectedCourses={selectedCourses}
                onChange={setSelectedCourses}
                disabled={isSubmitting}
              />
            </div>
          )}
        </form>

        {/* Rodapé com Ações */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {activeTab === 'cadastral' && 'Passo 1 de 3: Identificação'}
            {activeTab === 'pedagogico' && 'Passo 2 de 3: Datas de Acompanhamento'}
            {activeTab === 'cursos' && 'Passo 3 de 3: Catálogo Didático'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all"
            >
              Cancelar
            </button>

            {activeTab !== 'cursos' ? (
              <button
                type="button"
                onClick={() =>
                  setActiveTab(activeTab === 'cadastral' ? 'pedagogico' : 'cursos')
                }
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-200/80 hover:bg-slate-300 rounded-xl transition-all"
              >
                Próximo
              </button>
            ) : null}

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-[#0f3b7d] hover:bg-[#0a2e68] rounded-xl shadow-xs transition-all disabled:opacity-60"
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
    </div>
  );
}
