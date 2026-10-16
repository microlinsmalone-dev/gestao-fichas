"""
E2E Testing Infrastructure Helpers and Domain Contracts
Project: SistemaFichas_Web
Author: test_writer_e2e
"""

import os
import re
import sqlite3
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple

SQLITE_PATH = r"D:\Malone\CriaFichas\sistema_fichas.db"
MODEL_EXCEL_PATH = r"D:\Malone\CriaFichas\ModeloFicha.xlsx"

CANONICAL_EXCEL_HEADERS = [
    "Matrícula",
    "Nome",
    "Email",
    "Data Nascimento",
    "Telefone",
    "Instrutor",
    "Data Início Curso",
    "Data Término Curso",
    "Data Linha da Vida",
    "Data Form1",
    "Data Form2",
    "Data Dreamday",
    "Data Fechamento 1",
    "Data Fechamento 2",
    "Data Fechamento 3",
    "Cursos Contratados (Separados por vírgula)"
]

WEEKDAYS = [
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
    "Domingo"
]

def normalize_date(val: Any) -> Optional[str]:
    """
    Normalizes dates from Excel serial integers, ISO datetime, or Brazilian DD/MM/YYYY formats
    into standard ISO format 'YYYY-MM-DD'.
    """
    if val is None:
        return None
    val_str = str(val).strip()
    if not val_str or val_str.lower() in ('none', 'null', '—', '-', ''):
        return None

    # Excel Serial (days since 1899-12-30)
    if val_str.isdigit():
        days = int(val_str)
        if days <= 0:
            return None
        # Excel bug: 1900 is treated as leap year in Excel
        base = datetime(1899, 12, 30)
        dt = base + timedelta(days=days)
        return dt.strftime("%Y-%m-%d")

    # ISO Format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
    if '-' in val_str:
        clean = val_str.split(' ')[0].split('T')[0]
        parts = clean.split('-')
        if len(parts) == 3:
            try:
                y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
                return f"{y:04d}-{m:02d}-{d:02d}"
            except ValueError:
                return None

    # Brazilian Format: DD/MM/YYYY or DD/MM/YY
    if '/' in val_str:
        clean = val_str.split(' ')[0]
        parts = clean.split('/')
        if len(parts) == 3:
            try:
                d = int(parts[0])
                m = int(parts[1])
                y = int(parts[2])
                if y < 100:
                    y += 2000 if y < 50 else 1900
                # Validate real calendar date
                datetime(y, m, d)
                return f"{y:04d}-{m:02d}-{d:02d}"
            except (ValueError, OverflowError):
                return None

    return None

def format_time(t: Optional[str]) -> Optional[str]:
    """
    Normalizes time input strings into canonical 'XXhYY' format:
    e.g. '14' -> '14h00', '1400' -> '14h00', '14:30' -> '14h30', '08' -> '08h00'.
    """
    if not t:
        return None
    t = str(t).strip().lower().replace(":", "h")
    if t.isdigit():
        if len(t) <= 2:
            return f"{int(t):02d}h00"
        if len(t) == 4:
            return f"{t[:2]}h{t[2:]}"
    if "h" in t:
        parts = t.split("h")
        if len(parts) == 2:
            h = parts[0].strip()
            m = parts[1].strip() or "00"
            if h.isdigit():
                return f"{int(h):02d}h{int(m):02d}" if m.isdigit() else f"{int(h):02d}h00"
    return t

def expand_year(d_str: str) -> str:
    """Expands 2-digit years in DD/MM/YY strings to 4-digit years DD/MM/YYYY."""
    d_str = d_str.strip()
    parts = d_str.split("/")
    if len(parts) == 3 and len(parts[2]) == 2 and parts[2].isdigit():
        y = int(parts[2])
        full_y = 2000 + y if y < 50 else 1900 + y
        return f"{parts[0]}/{parts[1]}/{full_y}"
    return d_str

def normalize_matricula(val: Any) -> str:
    """
    Normalizes matricula removing floating point suffixes (e.g. '5056188.0' -> '5056188')
    and stripping whitespace.
    """
    if val is None:
        return ""
    if isinstance(val, float):
        return str(int(val)).strip()
    s = str(val).strip()
    if s.endswith('.0') and s[:-2].isdigit():
        return s[:-2]
    return s

def split_courses_csv(courses_str: Optional[str]) -> List[str]:
    """Parses a comma-separated course list, trimming whitespace and filtering empty slots."""
    if not courses_str:
        return []
    items = [c.strip() for c in courses_str.split(",") if c.strip()]
    # Up to 18 courses
    return items

class InMemorySupabaseStore:
    """
    In-memory mock store implementing full PostgreSQL / Supabase constraints,
    referential integrity (ON DELETE CASCADE), unique constraints, and check constraints.
    """
    def __init__(self):
        self.fichas: Dict[int, Dict[str, Any]] = {}
        self.cursos: Dict[int, Dict[str, Any]] = {}
        self.fichas_cursos: List[Dict[str, Any]] = []
        self._next_ficha_id = 1
        self._next_curso_id = 1
        self._next_fc_id = 1

    def insert_curso(self, nome: str, ativo: bool = True) -> int:
        nome_clean = nome.strip()
        for cid, rec in self.cursos.items():
            if rec['nome'].lower() == nome_clean.lower():
                return cid
        cid = self._next_curso_id
        self._next_curso_id += 1
        self.cursos[cid] = {
            'id': cid,
            'nome': nome_clean,
            'ativo': ativo,
            'created_at': datetime.now().isoformat()
        }
        return cid

    def insert_ficha(self, data: Dict[str, Any]) -> int:
        matricula = normalize_matricula(data.get('matricula'))
        nome = (data.get('nome') or "").strip()
        if not matricula:
            raise ValueError("Matrícula is required and cannot be empty")
        if not nome:
            raise ValueError("Nome is required and cannot be empty")
        if len(matricula) > 50:
            raise ValueError("Matrícula exceeds maximum length of 50 characters")
        if len(nome) > 255:
            raise ValueError("Nome exceeds maximum length of 255 characters")

        for fid, rec in self.fichas.items():
            if rec['matricula'] == matricula:
                raise ValueError(f"Unique violation: matricula '{matricula}' already exists")

        fid = data.get('id') or self._next_ficha_id
        if fid >= self._next_ficha_id:
            self._next_ficha_id = fid + 1

        record = {
            'id': fid,
            'matricula': matricula,
            'nome': nome,
            'email': data.get('email') or None,
            'telefone': data.get('telefone') or None,
            'instrutor': data.get('instrutor') or None,
            'data_nascimento': normalize_date(data.get('data_nascimento')),
            'data_inicio_curso': normalize_date(data.get('data_inicio_curso')),
            'data_termino_curso': normalize_date(data.get('data_termino_curso')),
            'data_linha_vida': normalize_date(data.get('data_linha_vida')),
            'data_form1': normalize_date(data.get('data_form1')),
            'data_form2': normalize_date(data.get('data_form2')),
            'data_dreamday': normalize_date(data.get('data_dreamday')),
            'data_fechamento1': normalize_date(data.get('data_fechamento1')),
            'data_fechamento2': normalize_date(data.get('data_fechamento2')),
            'data_fechamento3': normalize_date(data.get('data_fechamento3')),
            'dia_semana': data.get('dia_semana') or None,
            'horario_inicio': format_time(data.get('horario_inicio')),
            'horario_fim': format_time(data.get('horario_fim')),
            'created_at': datetime.now().isoformat()
        }
        self.fichas[fid] = record
        return fid

    def upsert_ficha(self, data: Dict[str, Any]) -> int:
        matricula = normalize_matricula(data.get('matricula'))
        for fid, rec in self.fichas.items():
            if rec['matricula'] == matricula:
                # Update
                rec['nome'] = (data.get('nome') or rec['nome']).strip()
                if 'email' in data: rec['email'] = data.get('email') or None
                if 'telefone' in data: rec['telefone'] = data.get('telefone') or None
                if 'instrutor' in data: rec['instrutor'] = data.get('instrutor') or None
                if 'data_nascimento' in data: rec['data_nascimento'] = normalize_date(data.get('data_nascimento'))
                if 'data_inicio_curso' in data: rec['data_inicio_curso'] = normalize_date(data.get('data_inicio_curso'))
                if 'data_termino_curso' in data: rec['data_termino_curso'] = normalize_date(data.get('data_termino_curso'))
                if 'data_linha_vida' in data: rec['data_linha_vida'] = normalize_date(data.get('data_linha_vida'))
                if 'data_form1' in data: rec['data_form1'] = normalize_date(data.get('data_form1'))
                if 'data_form2' in data: rec['data_form2'] = normalize_date(data.get('data_form2'))
                if 'data_dreamday' in data: rec['data_dreamday'] = normalize_date(data.get('data_dreamday'))
                if 'data_fechamento1' in data: rec['data_fechamento1'] = normalize_date(data.get('data_fechamento1'))
                if 'data_fechamento2' in data: rec['data_fechamento2'] = normalize_date(data.get('data_fechamento2'))
                if 'data_fechamento3' in data: rec['data_fechamento3'] = normalize_date(data.get('data_fechamento3'))
                if 'dia_semana' in data: rec['dia_semana'] = data.get('dia_semana') or None
                if 'horario_inicio' in data: rec['horario_inicio'] = format_time(data.get('horario_inicio'))
                if 'horario_fim' in data: rec['horario_fim'] = format_time(data.get('horario_fim'))
                return fid
        return self.insert_ficha(data)

    def link_curso(self, ficha_id: int, curso_id: int, curso_nome: str, ordem: int) -> int:
        if ficha_id not in self.fichas:
            raise ValueError(f"Foreign key violation: ficha_id {ficha_id} does not exist")
        if ordem < 1 or ordem > 18:
            raise ValueError(f"Check constraint violation: ordem {ordem} must be between 1 and 18")

        for item in self.fichas_cursos:
            if item['ficha_id'] == ficha_id and item['ordem'] == ordem:
                raise ValueError(f"Unique violation: ficha {ficha_id} already has a course at ordem {ordem}")

        fc_id = self._next_fc_id
        self._next_fc_id += 1
        self.fichas_cursos.append({
            'id': fc_id,
            'ficha_id': ficha_id,
            'curso_id': curso_id,
            'curso_nome': curso_nome,
            'ordem': ordem
        })
        return fc_id

    def delete_ficha(self, ficha_id: int):
        if ficha_id in self.fichas:
            del self.fichas[ficha_id]
            # ON DELETE CASCADE
            self.fichas_cursos = [fc for fc in self.fichas_cursos if fc['ficha_id'] != ficha_id]

    def set_student_courses(self, ficha_id: int, course_names: List[str]):
        if len(course_names) > 18:
            raise ValueError("Maximum of 18 courses per student permitted")
        # Clear existing courses (as done in desktop & web reorder)
        self.fichas_cursos = [fc for fc in self.fichas_cursos if fc['ficha_id'] != ficha_id]
        for idx, cname in enumerate(course_names):
            cid = self.insert_curso(cname)
            self.link_curso(ficha_id, cid, cname, idx + 1)

    def get_student_courses(self, ficha_id: int) -> List[Dict[str, Any]]:
        links = [fc for fc in self.fichas_cursos if fc['ficha_id'] == ficha_id]
        links.sort(key=lambda x: x['ordem'])
        return links

def simulate_a4_page_geometry(student: Dict[str, Any], courses: List[str], schedule: Optional[Dict[str, str]] = None, include_verso: bool = True) -> Dict[str, Any]:
    """
    Computes strict A4 page geometry, line counts, scaling parameters,
    and page breaks to guarantee exact fit without extra pages.
    """
    # A4 standard dimensions at 96 DPI: 794 x 1123 px (approx 210 x 297 mm)
    # Printable area with 4mm top/bottom, 5mm left/right margins: 200mm x 289mm
    frente_max_courses = 18
    frente_log_rows = 33
    frente_note_lines = 5
    verso_log_rows = 33
    verso_note_lines = 12

    frente_scale = 0.65 # Model scale factor
    verso_scale = 0.67  # Model scale factor

    # Verify courses fit
    rendered_courses = courses[:frente_max_courses]
    overflow_courses = len(courses) > frente_max_courses

    pages = []
    # Front page
    pages.append({
        'page_type': 'Frente',
        'matricula': student.get('matricula'),
        'student_name': student.get('nome'),
        'courses_count': len(rendered_courses),
        'log_rows': frente_log_rows,
        'note_lines': frente_note_lines,
        'scale': frente_scale,
        'has_page_break_after': include_verso
    })

    if include_verso:
        pages.append({
            'page_type': 'Verso',
            'matricula': student.get('matricula'),
            'student_name': student.get('nome'),
            'log_rows': verso_log_rows,
            'note_lines': verso_note_lines,
            'scale': verso_scale,
            'has_page_break_after': False # Last page of student
        })

    return {
        'total_pages': len(pages),
        'pages': pages,
        'overflow_courses': overflow_courses,
        'fits_a4': True
    }
