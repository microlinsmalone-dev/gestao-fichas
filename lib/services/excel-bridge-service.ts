// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Service: lib/services/excel-bridge-service.ts
// Comunicação com o serviço local de automação do Microsoft Excel (porta 3827)
// ==============================================================================

import type { StudentWithCourses, ScheduleConfig } from '../../types/database';

const BRIDGE_URL = 'http://127.0.0.1:3827';

export interface BridgeStatus {
  online: boolean;
  service?: string;
  templateExists?: boolean;
}

/**
 * Verifica se o serviço local do Excel está ativo em segundo plano
 */
export async function checkExcelBridge(): Promise<BridgeStatus> {
  if (typeof window === 'undefined') {
    return { online: false };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1200);

  try {
    const res = await fetch(`${BRIDGE_URL}/status`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return {
        online: data.status === 'ready',
        service: data.service,
        templateExists: data.template_exists,
      };
    }
    return { online: false };
  } catch {
    clearTimeout(timeoutId);
    return { online: false };
  }
}

/**
 * Envia as fichas selecionadas diretamente para impressão pelo motor do Excel
 */
export async function printViaExcel(
  students: StudentWithCourses[],
  schedule: ScheduleConfig,
  includeVerso = true,
  copies = 1
): Promise<{ success: boolean; message: string }> {
  const payload = {
    students: students.map((s) => ({
      matricula: s.matricula,
      nome: s.nome,
      email: s.email,
      data_nascimento: s.data_nascimento,
      instrutor: s.instrutor,
      telefone: s.telefone,
      data_inicio_curso: s.data_inicio_curso,
      data_termino_curso: s.data_termino_curso,
      cursos: [...(s.cursos || [])]
        .sort((a, b) => a.ordem - b.ordem)
        .map((c) => c.nome),
      data_linha_vida: s.data_linha_vida,
      data_form1: s.data_form1,
      data_form2: s.data_form2,
      data_dreamday: s.data_dreamday,
      data_fechamento1: s.data_fechamento1,
      data_fechamento2: s.data_fechamento2,
      data_fechamento3: s.data_fechamento3,
    })),
    schedule,
    includeVerso,
    copies,
  };

  try {
    const res = await fetch(`${BRIDGE_URL}/print`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Erro ao processar impressão no Excel.');
    }

    return {
      success: true,
      message: data.message || `${students.length} ficha(s) impressa(s) via Excel com sucesso!`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Falha ao comunicar com o motor do Excel: ${msg}`);
  }
}
