// ==============================================================================
// SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
// Module: lib/excel/modelo-ficha-injector.ts
// Manipulador cirúrgico do binário original ModeloFicha.xlsx embutido na aplicação.
// Injeta os dados do aluno diretamente nos arquivos XML internos (sheet1.xml e
// drawing1.xml) preservando 100% das bordas, caixas de texto, logo e PageSetup.
// ==============================================================================

import type { StudentWithCourses, ScheduleConfig } from '../../types/database';
import { MODELO_FICHA_XLSX_BASE64 } from '../constants/modelo-ficha-assets';

function base64ToUint8Array(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatSheetDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3 && parts[2].length === 2 && /^\d{2}$/.test(parts[2])) {
      return `${parts[0]}/${parts[1]}/20${parts[2]}`;
    }
    return clean;
  }
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
}

export function formatSheetPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function resolveStudentDaySchedule(
  student: StudentWithCourses,
  propSchedule?: ScheduleConfig,
  dayShort?: string
): { inicio: string; fim: string } {
  if (!dayShort) return { inicio: 'h', fim: 'h' };

  // 1. Verifica configuração detalhada por dia no ScheduleConfig do modal
  if (propSchedule?.diasConfig) {
    if (propSchedule.diasConfig[dayShort]) return propSchedule.diasConfig[dayShort];
    const fullName = `${dayShort}-feira`;
    if (propSchedule.diasConfig[fullName]) return propSchedule.diasConfig[fullName];
  }

  // 2. Verifica dias selecionados no modal de impressão (ScheduleConfig)
  if (propSchedule?.diasSemana && propSchedule.diasSemana.length > 0) {
    const active = propSchedule.diasSemana.some(
      (d: string) =>
        d.toLowerCase().includes(dayShort.toLowerCase()) || dayShort.toLowerCase().includes(d.toLowerCase())
    );
    if (active) {
      return {
        inicio: propSchedule.horarioInicio || 'h',
        fim: propSchedule.horarioFim || 'h',
      };
    }
  }

  // 3. Fallback para os campos dia_semana / horario_inicio / horario_fim salvos na ficha do aluno
  if (student.dia_semana) {
    const studentDays = student.dia_semana.split(/[,;/]/).map((s) => s.trim());
    const active = studentDays.some(
      (d: string) =>
        d.toLowerCase().includes(dayShort.toLowerCase()) || dayShort.toLowerCase().includes(d.toLowerCase())
    );
    if (active) {
      return {
        inicio: student.horario_inicio || 'h',
        fim: student.horario_fim || 'h',
      };
    }
  }

  return { inicio: 'h', fim: 'h' };
}

export function resolveStudentCourseName(student: StudentWithCourses, slotNumber: number): string {
  if (!student.cursos || student.cursos.length === 0) return '';
  const byOrder = student.cursos.find((c) => c.ordem === slotNumber);
  if (byOrder) return byOrder.nome;
  return '';
}

/** Calcula CRC32 padrão IEEE 802.3 para pacotes ZIP */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function inflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(compressed as unknown as BufferSource);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

async function deflateRaw(raw: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(raw as unknown as BufferSource);
  writer.close();
  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

interface ZipEntry {
  name: string;
  nameBytes: Uint8Array;
  versionMadeBy: number;
  versionNeeded: number;
  flags: number;
  method: number;
  dosTime: number;
  dosDate: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  externalAttrs: number;
  compressedData: Uint8Array;
}

function parseZipEntries(zipBytes: Uint8Array): ZipEntry[] {
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
  // Procura End of Central Directory (0x06054b50)
  let eocdOffset = -1;
  for (let i = zipBytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error('Formato ZIP inválido em ModeloFicha.xlsx');
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  let cdOffset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder('utf-8');
  const entries: ZipEntry[] = [];

  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(cdOffset, true) !== 0x02014b50) {
      throw new Error('Cabeçalho de diretório central ZIP corrompido');
    }
    const versionMadeBy = view.getUint16(cdOffset + 4, true);
    const versionNeeded = view.getUint16(cdOffset + 6, true);
    const flags = view.getUint16(cdOffset + 8, true);
    const method = view.getUint16(cdOffset + 10, true);
    const dosTime = view.getUint16(cdOffset + 12, true);
    const dosDate = view.getUint16(cdOffset + 14, true);
    const crc = view.getUint32(cdOffset + 16, true);
    const compressedSize = view.getUint32(cdOffset + 20, true);
    const uncompressedSize = view.getUint32(cdOffset + 24, true);
    const nameLen = view.getUint16(cdOffset + 28, true);
    const extraLen = view.getUint16(cdOffset + 30, true);
    const commentLen = view.getUint16(cdOffset + 32, true);
    const externalAttrs = view.getUint32(cdOffset + 38, true);
    const localHeaderOffset = view.getUint32(cdOffset + 42, true);

    const nameBytes = zipBytes.slice(cdOffset + 46, cdOffset + 46 + nameLen);
    const name = decoder.decode(nameBytes);

    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compressedData = zipBytes.slice(dataStart, dataStart + compressedSize);

    entries.push({
      name,
      nameBytes,
      versionMadeBy,
      versionNeeded,
      flags,
      method,
      dosTime,
      dosDate,
      crc,
      compressedSize,
      uncompressedSize,
      externalAttrs,
      compressedData,
    });

    cdOffset += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

function buildZipBytes(entries: ZipEntry[]): Uint8Array {
  let localSize = 0;
  let cdSize = 0;
  for (const e of entries) {
    localSize += 30 + e.nameBytes.length + e.compressedData.length;
    cdSize += 46 + e.nameBytes.length;
  }
  const totalSize = localSize + cdSize + 22;
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  let offset = 0;
  const localOffsets: number[] = [];

  for (const e of entries) {
    localOffsets.push(offset);
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, e.versionNeeded, true);
    view.setUint16(offset + 6, e.flags & ~0x0008, true);
    view.setUint16(offset + 8, e.method, true);
    view.setUint16(offset + 10, e.dosTime, true);
    view.setUint16(offset + 12, e.dosDate, true);
    view.setUint32(offset + 14, e.crc, true);
    view.setUint32(offset + 18, e.compressedData.length, true);
    view.setUint32(offset + 22, e.uncompressedSize, true);
    view.setUint16(offset + 26, e.nameBytes.length, true);
    view.setUint16(offset + 28, 0, true);
    out.set(e.nameBytes, offset + 30);
    out.set(e.compressedData, offset + 30 + e.nameBytes.length);
    offset += 30 + e.nameBytes.length + e.compressedData.length;
  }

  const cdStart = offset;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, e.versionMadeBy, true);
    view.setUint16(offset + 6, e.versionNeeded, true);
    view.setUint16(offset + 8, e.flags & ~0x0008, true);
    view.setUint16(offset + 10, e.method, true);
    view.setUint16(offset + 12, e.dosTime, true);
    view.setUint16(offset + 14, e.dosDate, true);
    view.setUint32(offset + 16, e.crc, true);
    view.setUint32(offset + 20, e.compressedData.length, true);
    view.setUint32(offset + 24, e.uncompressedSize, true);
    view.setUint16(offset + 28, e.nameBytes.length, true);
    view.setUint16(offset + 30, 0, true);
    view.setUint16(offset + 32, 0, true);
    view.setUint16(offset + 34, 0, true);
    view.setUint16(offset + 36, 0, true);
    view.setUint32(offset + 38, e.externalAttrs, true);
    view.setUint32(offset + 42, localOffsets[i], true);
    out.set(e.nameBytes, offset + 46);
    offset += 46 + e.nameBytes.length;
  }

  const cdLength = offset - cdStart;
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 4, 0, true);
  view.setUint16(offset + 6, 0, true);
  view.setUint16(offset + 8, entries.length, true);
  view.setUint16(offset + 10, entries.length, true);
  view.setUint32(offset + 12, cdLength, true);
  view.setUint32(offset + 16, cdStart, true);
  view.setUint16(offset + 20, 0, true);

  return out;
}

function replaceCellInSheetXml(sheetXml: string, cellRef: string, textValue: string): string {
  const escaped = escapeXml(textValue);
  const re = new RegExp(`<c r="${cellRef}"([^/>]*)(?:/>|>([\\s\\S]*?)</c>)`);
  return sheetXml.replace(re, (_match, attrs: string) => {
    const styleMatch = attrs.match(/\bs="(\d+)"/);
    const styleAttr = styleMatch ? ` s="${styleMatch[1]}"` : '';
    if (!textValue) {
      return `<c r="${cellRef}"${styleAttr}/>`;
    }
    return `<c r="${cellRef}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${escaped}</t></is></c>`;
  });
}

function replaceShapeTextInDrawingXml(drawingXml: string, shapeName: string, newText: string): string {
  const escaped = escapeXml(newText);
  const marker = `name="${shapeName}"`;
  const idx = drawingXml.indexOf(marker);
  if (idx < 0) return drawingXml;
  const spEnd = drawingXml.indexOf('</xdr:sp>', idx);
  if (spEnd < 0) return drawingXml;
  const segment = drawingXml.slice(idx, spEnd);
  const updatedSegment = segment.replace(/<a:t>[\s\S]*?<\/a:t>/, `<a:t>${escaped}</a:t>`);
  return drawingXml.slice(0, idx) + updatedSegment + drawingXml.slice(spEnd);
}

/**
 * Gera os bytes de um arquivo .xlsx que é literalmente o ModeloFicha.xlsx original
 * preenchido com os dados do aluno informado.
 */
export async function generateFilledModeloFichaXlsx(
  student: StudentWithCourses,
  schedule?: ScheduleConfig
): Promise<Uint8Array> {
  const rawZip = base64ToUint8Array(MODELO_FICHA_XLSX_BASE64);
  const entries = parseZipEntries(rawZip);
  const decoder = new TextDecoder('utf-8');
  const encoder = new TextEncoder();

  for (const entry of entries) {
    if (entry.name === 'xl/worksheets/sheet1.xml') {
      const xmlBytes = entry.method === 8 ? await inflateRaw(entry.compressedData) : entry.compressedData;
      let xml = decoder.decode(xmlBytes);

      xml = replaceCellInSheetXml(xml, 'A2', `Matrícula: ${student.matricula || ''}`);
      xml = replaceCellInSheetXml(xml, 'D2', `Nome do Aluno: ${student.nome || ''}`);
      xml = replaceCellInSheetXml(xml, 'A3', `Email: ${student.email || ''}`);
      xml = replaceCellInSheetXml(xml, 'A4', `Data Nascimento: ${formatSheetDate(student.data_nascimento)}`);
      xml = replaceCellInSheetXml(xml, 'D4', `Instrutor: ${student.instrutor || ''}`);
      xml = replaceCellInSheetXml(xml, 'A5', `Telefone: ${formatSheetPhone(student.telefone)}`);

      xml = replaceCellInSheetXml(xml, 'M5', formatSheetDate(student.data_inicio_curso));
      xml = replaceCellInSheetXml(xml, 'P5', formatSheetDate(student.data_termino_curso));

      xml = replaceCellInSheetXml(xml, 'P7', formatSheetDate(student.data_linha_vida));
      xml = replaceCellInSheetXml(xml, 'P9', formatSheetDate(student.data_form1));
      xml = replaceCellInSheetXml(xml, 'P10', formatSheetDate(student.data_form2));
      xml = replaceCellInSheetXml(xml, 'P11', formatSheetDate(student.data_dreamday));
      xml = replaceCellInSheetXml(xml, 'P13', formatSheetDate(student.data_fechamento1));
      xml = replaceCellInSheetXml(xml, 'P14', formatSheetDate(student.data_fechamento2));
      xml = replaceCellInSheetXml(xml, 'P15', formatSheetDate(student.data_fechamento3));

      // Cursos 1 a 18 (A10..A15, D10..D15, H10..H15)
      for (let i = 1; i <= 6; i++) {
        const row = 9 + i;
        const c1 = resolveStudentCourseName(student, i);
        const c2 = resolveStudentCourseName(student, i + 6);
        const c3 = resolveStudentCourseName(student, i + 12);
        xml = replaceCellInSheetXml(xml, `A${row}`, `${i}. ${c1}`);
        xml = replaceCellInSheetXml(xml, `D${row}`, `${i + 6}. ${c2}`);
        xml = replaceCellInSheetXml(xml, `H${row}`, `${i + 12}. ${c3}`);
      }

      const newRaw = encoder.encode(xml);
      entry.uncompressedSize = newRaw.length;
      entry.crc = crc32(newRaw);
      entry.compressedData = await deflateRaw(newRaw);
      entry.compressedSize = entry.compressedData.length;
      entry.method = 8;
    } else if (entry.name === 'xl/drawings/drawing1.xml') {
      const xmlBytes = entry.method === 8 ? await inflateRaw(entry.compressedData) : entry.compressedData;
      let xml = decoder.decode(xmlBytes);

      const dayShapeMap: Array<{ day: string; ini: string; fim: string }> = [
        { day: 'Segunda', ini: 'CaixaDeTexto 7', fim: 'CaixaDeTexto 15' },
        { day: 'Terça', ini: 'CaixaDeTexto 6', fim: 'CaixaDeTexto 14' },
        { day: 'Quarta', ini: 'CaixaDeTexto 5', fim: 'CaixaDeTexto 13' },
        { day: 'Quinta', ini: 'CaixaDeTexto 4', fim: 'CaixaDeTexto 12' },
        { day: 'Sexta', ini: 'CaixaDeTexto 3', fim: 'CaixaDeTexto 11' },
        { day: 'Sábado', ini: 'CaixaDeTexto 2', fim: 'CaixaDeTexto 10' },
        { day: 'Domingo', ini: 'CaixaDeTexto 1', fim: 'CaixaDeTexto 9' },
      ];

      for (const item of dayShapeMap) {
        const times = resolveStudentDaySchedule(student, schedule, item.day);
        xml = replaceShapeTextInDrawingXml(xml, item.ini, times.inicio || 'h');
        xml = replaceShapeTextInDrawingXml(xml, item.fim, times.fim || 'h');
      }

      const newRaw = encoder.encode(xml);
      entry.uncompressedSize = newRaw.length;
      entry.crc = crc32(newRaw);
      entry.compressedData = await deflateRaw(newRaw);
      entry.compressedSize = entry.compressedData.length;
      entry.method = 8;
    }
  }

  return buildZipBytes(entries);
}

/**
 * Baixa a planilha ModeloFicha.xlsx real preenchida para o aluno.
 */
export async function downloadFilledModeloFichaXlsx(
  student: StudentWithCourses,
  schedule?: ScheduleConfig
): Promise<void> {
  const bytes = await generateFilledModeloFichaXlsx(student, schedule);
  const blob = new Blob([bytes as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const safeName = (student.nome || 'Aluno').replace(/[\\/:*?"<>|]/g, '').trim();
  const filename = `Ficha - ${safeName} (${student.matricula || 'SM'}).xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
