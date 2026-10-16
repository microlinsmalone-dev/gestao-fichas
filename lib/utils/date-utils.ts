// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Utilities: lib/utils/date-utils.ts
// Formatação e conversão de datas para padrão brasileiro (DD/MM/YYYY) e ISO (YYYY-MM-DD)
// ==============================================================================

/**
 * Converte data ISO (YYYY-MM-DD) para formato de exibição brasileiro (DD/MM/YYYY).
 */
export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const clean = dateStr.trim();
  if (!clean) return '-';

  // Se já estiver em DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    return clean;
  }

  // Se for YYYY-MM-DD
  const parts = clean.split('T')[0].split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }

  return clean;
}

/**
 * Converte qualquer formato de data para o padrão aceito por <input type="date"> (YYYY-MM-DD).
 */
export function toInputDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (!clean) return '';

  // Se já for YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // Se for DD/MM/YYYY
  const parts = clean.split('/');
  if (parts.length === 3 && parts[2].length === 4) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Se tiver timestamp ISO
  if (clean.includes('T')) {
    return clean.split('T')[0];
  }

  return clean;
}

/**
 * Formata número de telefone brasileiro: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '-';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '-';
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/**
 * Formata telefone para exibição em ficha impressa (retorna vazio se nulo ou traço)
 */
export function formatPhoneForSheet(phone: string | null | undefined): string {
  if (!phone) return '';
  const formatted = formatPhone(phone);
  return formatted === '-' ? '' : formatted;
}

/**
 * Normaliza horário para formato institucional (ex: '14' -> '14h00', '14:30' -> '14h30', '8' -> '08h00')
 */
export function formatTime(t: string | null | undefined): string {
  if (!t) return '';
  const clean = String(t).trim().toLowerCase().replace(':', 'h');
  if (!clean || clean === 'none' || clean === 'null' || clean === '-') return '';
  if (/^\d+$/.test(clean)) {
    if (clean.length <= 2) {
      return `${clean.padStart(2, '0')}h00`;
    }
    if (clean.length === 4) {
      return `${clean.slice(0, 2)}h${clean.slice(2)}`;
    }
    if (clean.length === 3) {
      return `0${clean.slice(0, 1)}h${clean.slice(1)}`;
    }
  }
  if (clean.includes('h')) {
    const parts = clean.split('h');
    const h = parts[0].trim();
    const m = parts[1].trim() || '00';
    if (/^\d+$/.test(h)) {
      const hPad = h.padStart(2, '0');
      const mPad = /^\d+$/.test(m) ? m.padEnd(2, '0').slice(0, 2) : '00';
      return `${hPad}h${mPad}`;
    }
  }
  return clean;
}

/**
 * Converte data para exibição em ficha impressa (retorna string vazia para nulo/indefinido)
 */
export function formatDateForSheet(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const clean = String(dateStr).trim();
  if (!clean || clean.toLowerCase() === 'none' || clean.toLowerCase() === 'null' || clean === '-' || clean === '—') {
    return '';
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    return clean;
  }
  const parts = clean.split('T')[0].split(' ')[0].split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  return clean;
}
