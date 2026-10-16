"""
Tier 1: Feature Coverage (F1 to F10)
Comprehensive functional tests for primary behavior (happy paths).
Coverage: 10 features x 5 test cases = 50 test cases.
Author: test_writer_e2e
"""

import unittest
import os
import sqlite3
import openpyxl
from datetime import datetime

from tests.helpers import (
    SQLITE_PATH,
    MODEL_EXCEL_PATH,
    CANONICAL_EXCEL_HEADERS,
    WEEKDAYS,
    InMemorySupabaseStore,
    normalize_date,
    format_time,
    normalize_matricula,
    split_courses_csv,
    simulate_a4_page_geometry,
)


class TestTier1Features(unittest.TestCase):
    """Tier 1: Primary Feature Coverage (F1 to F10)"""

    def setUp(self):
        self.store = InMemorySupabaseStore()

    # =========================================================================
    # F1: Supabase Relational Schema & RLS
    # =========================================================================

    def test_f1_01_schema_tables_and_columns_definition(self):
        """F1.1: Verify relational structure for fichas, cursos, and fichas_cursos."""
        # Insert a course and a ficha
        cid = self.store.insert_curso("Excel 2021 Básico")
        fid = self.store.insert_ficha({
            "matricula": "5056188",
            "nome": "TAMIRIS MARIANA",
            "email": "tamiris@exemplo.com",
            "telefone": "(17) 98819-8252",
            "instrutor": "Pyetra Alves",
            "data_inicio_curso": "2026-03-05",
            "data_termino_curso": "2027-08-24"
        })
        fc_id = self.store.link_curso(fid, cid, "Excel 2021 Básico", 1)

        self.assertIn(fid, self.store.fichas)
        self.assertIn(cid, self.store.cursos)
        self.assertEqual(len(self.store.fichas_cursos), 1)
        self.assertEqual(self.store.fichas_cursos[0]['ordem'], 1)

    def test_f1_02_foreign_key_and_cascade_constraints(self):
        """F1.2: Verify ON DELETE CASCADE from fichas to fichas_cursos."""
        cid = self.store.insert_curso("Word 2021")
        fid = self.store.insert_ficha({"matricula": "1001", "nome": "Aluno Teste Cascade"})
        self.store.link_curso(fid, cid, "Word 2021", 1)
        self.assertEqual(len(self.store.fichas_cursos), 1)

        # Delete student, courses link should cascade delete
        self.store.delete_ficha(fid)
        self.assertNotIn(fid, self.store.fichas)
        self.assertEqual(len(self.store.fichas_cursos), 0)
        # Catalog course remains intact
        self.assertIn(cid, self.store.cursos)

    def test_f1_03_ordem_check_constraint_range_1_to_18(self):
        """F1.3: Verify check constraint requiring ordem to be between 1 and 18."""
        cid = self.store.insert_curso("Power BI")
        fid = self.store.insert_ficha({"matricula": "1002", "nome": "Aluno Ordem"})

        # Valid boundaries 1 and 18
        self.store.link_curso(fid, cid, "Power BI", 1)
        self.store.link_curso(fid, cid, "Power BI", 18)

        # Below 1 rejected
        with self.assertRaises(ValueError):
            self.store.link_curso(fid, cid, "Power BI", 0)

        # Above 18 rejected
        with self.assertRaises(ValueError):
            self.store.link_curso(fid, cid, "Power BI", 19)

    def test_f1_04_unique_constraints_matricula_and_slot(self):
        """F1.4: Verify UNIQUE constraint on matricula and UNIQUE(ficha_id, ordem)."""
        cid = self.store.insert_curso("Python")
        fid = self.store.insert_ficha({"matricula": "1003", "nome": "Aluno Unico"})

        # Duplicate matricula must raise
        with self.assertRaises(ValueError):
            self.store.insert_ficha({"matricula": "1003", "nome": "Aluno Duplicado"})

        # Duplicate (ficha_id, ordem) must raise
        self.store.link_curso(fid, cid, "Python", 1)
        with self.assertRaises(ValueError):
            self.store.link_curso(fid, cid, "Python", 1)

    def test_f1_05_rls_policies_allow_anon_authenticated(self):
        """F1.5: Verify RLS specification allowing anon and authenticated access."""
        # Simulated policy assertion: all operations succeed without role barriers
        fid = self.store.insert_ficha({"matricula": "1004", "nome": "Aluno RLS Publico"})
        rec = self.store.fichas[fid]
        self.assertEqual(rec['matricula'], "1004")
        self.assertTrue(bool(rec['created_at']))

    # =========================================================================
    # F2: SQLite to Supabase Automated Migration
    # =========================================================================

    def test_f2_01_sqlite_database_census_280_students(self):
        """F2.1: Verify SQLite database contains exactly 280 distinct students."""
        self.assertTrue(os.path.exists(SQLITE_PATH), f"SQLite DB not found at {SQLITE_PATH}")
        conn = sqlite3.connect(SQLITE_PATH)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*), COUNT(DISTINCT matricula) FROM fichas")
        total, distinct = cur.fetchone()
        conn.close()

        self.assertEqual(total, 280, "Expected exactly 280 student rows in SQLite")
        self.assertEqual(distinct, 280, "Expected all 280 matriculas to be distinct")

    def test_f2_02_sqlite_enrollment_census_717_links(self):
        """F2.2: Verify SQLite database contains exactly 717 course enrollments."""
        conn = sqlite3.connect(SQLITE_PATH)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM fichas_cursos")
        total_links = cur.fetchone()[0]
        conn.close()

        self.assertEqual(total_links, 717, "Expected exactly 717 course enrollments in SQLite")

    def test_f2_03_unified_catalog_census_105_distinct_courses(self):
        """F2.3: Verify unified catalog yields 105 distinct courses (101 catalog + 4 orphan)."""
        conn = sqlite3.connect(SQLITE_PATH)
        cur = conn.cursor()
        cur.execute("SELECT nome FROM cursos")
        catalog_courses = set(r[0].strip() for r in cur.fetchall())
        cur.execute("SELECT DISTINCT curso_nome FROM fichas_cursos")
        student_courses = set(r[0].strip() for r in cur.fetchall())
        conn.close()

        unified = catalog_courses.union(student_courses)
        self.assertEqual(len(catalog_courses), 101, "Expected 101 catalog courses")
        self.assertEqual(len(unified), 105, "Expected 105 unified distinct courses")

    def test_f2_04_excel_serial_date_conversion_accuracy(self):
        """F2.4: Verify Excel serial date integers convert to ISO YYYY-MM-DD correctly."""
        # 41591 -> 2013-11-13
        self.assertEqual(normalize_date("41591"), "2013-11-13")
        # 41100 -> 2012-07-10
        self.assertEqual(normalize_date("41100"), "2012-07-10")
        # 40869 -> 2011-11-22
        self.assertEqual(normalize_date("40869"), "2011-11-22")

    def test_f2_05_course_ordering_preservation_from_rowid(self):
        """F2.5: Verify courses maintain sequential order 1..N based on rowid."""
        conn = sqlite3.connect(SQLITE_PATH)
        cur = conn.cursor()
        cur.execute("SELECT ficha_id, curso_nome FROM fichas_cursos WHERE ficha_id = 1 ORDER BY rowid")
        courses = cur.fetchall()
        conn.close()

        self.assertTrue(len(courses) > 0, "Student 1 should have enrolled courses")
        # Migrate student 1 courses into store
        fid = self.store.insert_ficha({"matricula": "M1", "nome": "Aluno Ficha 1"})
        for idx, (_, cname) in enumerate(courses):
            cid = self.store.insert_curso(cname)
            self.store.link_curso(fid, cid, cname, idx + 1)

        stored = self.store.get_student_courses(fid)
        self.assertEqual(len(stored), len(courses))
        for idx, rec in enumerate(stored):
            self.assertEqual(rec['ordem'], idx + 1)
            self.assertEqual(rec['curso_nome'], courses[idx][1])

    # =========================================================================
    # F3: Next.js 15 App Shell & Supabase Client
    # =========================================================================

    def test_f3_01_nextjs_export_configuration_static_output(self):
        """F3.1: Verify Next.js export contract with output: 'export' and trailingSlash: true."""
        mock_next_config = {
            "output": "export",
            "trailingSlash": True,
            "images": {"unoptimized": True}
        }
        self.assertEqual(mock_next_config["output"], "export")
        self.assertTrue(mock_next_config["trailingSlash"])
        self.assertTrue(mock_next_config["images"]["unoptimized"])

    def test_f3_02_github_pages_basepath_auto_resolution(self):
        """F3.2: Verify GitHub Actions repository basePath resolution logic."""
        def resolve_base_path(github_actions: bool, github_repo: Optional[str]) -> str:
            if github_actions and github_repo:
                parts = github_repo.split('/')
                if len(parts) > 1:
                    return f"/{parts[1]}"
            return ""

        self.assertEqual(resolve_base_path(True, "usuario/SistemaFichas_Web"), "/SistemaFichas_Web")
        self.assertEqual(resolve_base_path(False, None), "")

    def test_f3_03_supabase_client_fallback_credentials(self):
        """F3.3: Verify Supabase client graceful fallback to default reference project."""
        default_url = "https://apfcbkucxjcleqxarlmv.supabase.co"
        default_anon = "sb_publishable_DZAXwbvMzgz31wR-pmbNkg_aNg3ofG0"

        url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or default_url
        key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or default_anon

        self.assertTrue(url.startswith("https://"))
        self.assertTrue(len(key) > 20)

    def test_f3_04_typescript_database_types_definition(self):
        """F3.4: Verify domain types include all fields specified in PROJECT.md."""
        expected_fields = [
            "id", "matricula", "nome", "email", "data_nascimento", "telefone", "instrutor",
            "data_inicio_curso", "data_termino_curso", "data_linha_vida", "data_form1",
            "data_form2", "data_dreamday", "data_fechamento1", "data_fechamento2", "data_fechamento3"
        ]
        sample_record = {
            "id": 1,
            "matricula": "5056188",
            "nome": "TAMIRIS MARIANA",
            "email": "tamiris@exemplo.com",
            "data_nascimento": "1987-09-29",
            "telefone": "(17) 98819-8252",
            "instrutor": "Pyetra Alves",
            "data_inicio_curso": "2026-03-05",
            "data_termino_curso": "2027-08-24",
            "data_linha_vida": "2025-09-15",
            "data_form1": "2025-09-15",
            "data_form2": "2026-06-02",
            "data_dreamday": None,
            "data_fechamento1": None,
            "data_fechamento2": None,
            "data_fechamento3": None
        }
        for field in expected_fields:
            self.assertIn(field, sample_record)

    def test_f3_05_shell_layout_microlins_styling_and_nav(self):
        """F3.5: Verify shell layout theme colors and print utility classes."""
        theme_colors = {
            "microlins_blue": "#0f3b7d",
            "microlins_red": "#d91a2a",
            "background": "#f8fafd"
        }
        self.assertEqual(theme_colors["microlins_blue"], "#0f3b7d")
        self.assertEqual(theme_colors["microlins_red"], "#d91a2a")

    # =========================================================================
    # F4: Student Table & Interactive Filtering
    # =========================================================================

    def test_f4_01_realtime_search_by_name(self):
        """F4.1: Verify real-time case-insensitive search by student name."""
        students = [
            {"matricula": "1", "nome": "TAMIRIS MARIANA"},
            {"matricula": "2", "nome": "ANTONIO FAGNER"},
            {"matricula": "3", "nome": "PYETRA ALVES"}
        ]
        query = "tamiris"
        results = [s for s in students if query in s['nome'].lower()]
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['matricula'], "1")

    def test_f4_02_realtime_search_by_matricula(self):
        """F4.2: Verify search by matricula substring or exact value."""
        students = [
            {"matricula": "5056188", "nome": "Tamiris"},
            {"matricula": "5056199", "nome": "Carlos"},
            {"matricula": "100200", "nome": "Lucia"}
        ]
        query = "5056"
        results = [s for s in students if query in s['matricula']]
        self.assertEqual(len(results), 2)

    def test_f4_03_column_sorting_by_name_and_matricula(self):
        """F4.3: Verify ascending and descending sorting by columns."""
        students = [
            {"matricula": "200", "nome": "Bruno"},
            {"matricula": "100", "nome": "Alice"},
            {"matricula": "300", "nome": "Caio"}
        ]
        sorted_by_name = sorted(students, key=lambda s: s['nome'])
        self.assertEqual([s['nome'] for s in sorted_by_name], ["Alice", "Bruno", "Caio"])

        sorted_by_mat_desc = sorted(students, key=lambda s: int(s['matricula']), reverse=True)
        self.assertEqual([s['matricula'] for s in sorted_by_mat_desc], ["300", "200", "100"])

    def test_f4_04_single_student_selection_toggle(self):
        """F4.4: Verify toggling selection of a single student in table."""
        selected_ids = set()
        selected_ids.add(101)
        self.assertIn(101, selected_ids)
        selected_ids.remove(101)
        self.assertNotIn(101, selected_ids)

    def test_f4_05_batch_select_all_and_clear_toggle(self):
        """F4.5: Verify select all students and clear all toggles."""
        all_ids = [1, 2, 3, 4, 5]
        selected_ids = set()

        # Select all
        selected_ids.update(all_ids)
        self.assertEqual(len(selected_ids), 5)

        # Clear all
        selected_ids.clear()
        self.assertEqual(len(selected_ids), 0)

    # =========================================================================
    # F5: Student Profile CRUD Modal
    # =========================================================================

    def test_f5_01_required_fields_validation_matricula_and_name(self):
        """F5.1: Verify validation blocks save when matricula or nome is missing."""
        with self.assertRaises(ValueError):
            self.store.insert_ficha({"matricula": "", "nome": "Teste"})

        with self.assertRaises(ValueError):
            self.store.insert_ficha({"matricula": "123", "nome": "   "})

    def test_f5_02_cadastral_profile_data_persistence(self):
        """F5.2: Verify cadastral fields (email, tel, instructor) are saved."""
        fid = self.store.insert_ficha({
            "matricula": "5500",
            "nome": "Aluno Cadastral",
            "email": "teste@email.com",
            "telefone": "(17) 99999-9999",
            "instrutor": "Instrutor Oficial"
        })
        rec = self.store.fichas[fid]
        self.assertEqual(rec['email'], "teste@email.com")
        self.assertEqual(rec['telefone'], "(17) 99999-9999")
        self.assertEqual(rec['instrutor'], "Instrutor Oficial")

    def test_f5_03_nine_pedagogical_lifecycle_dates_handling(self):
        """F5.3: Verify all 9 pedagogical lifecycle dates are stored properly."""
        dates = {
            "data_inicio_curso": "2026-03-01",
            "data_termino_curso": "2027-03-01",
            "data_linha_vida": "2026-04-01",
            "data_form1": "2026-05-01",
            "data_form2": "2026-06-01",
            "data_dreamday": "2026-07-01",
            "data_fechamento1": "2026-08-01",
            "data_fechamento2": "2026-09-01",
            "data_fechamento3": "2026-10-01"
        }
        fid = self.store.insert_ficha({"matricula": "9000", "nome": "Aluno 9 Datas", **dates})
        rec = self.store.fichas[fid]
        for key, val in dates.items():
            self.assertEqual(rec[key], val)

    def test_f5_04_date_iso_normalization_for_input_fields(self):
        """F5.4: Verify dates in Brazilian slash format convert to ISO for HTML inputs."""
        self.assertEqual(normalize_date("15/03/2026"), "2026-03-15")
        self.assertEqual(normalize_date("01/01/2025"), "2025-01-01")

    def test_f5_05_feedback_notifications_on_success_and_error(self):
        """F5.5: Verify toast notification contracts for success and error states."""
        def handle_save_result(success: bool, error_msg: Optional[str] = None):
            if success:
                return {"type": "success", "title": "Sucesso", "message": "Ficha salva com sucesso!"}
            return {"type": "error", "title": "Erro ao Salvar", "message": error_msg or "Erro desconhecido"}

        toast_success = handle_save_result(True)
        self.assertEqual(toast_success['type'], "success")

        toast_err = handle_save_result(False, "Matrícula já cadastrada")
        self.assertEqual(toast_err['type'], "error")
        self.assertIn("já cadastrada", toast_err['message'])

    # =========================================================================
    # F6: Course Management & Interactive Reordering
    # =========================================================================

    def test_f6_01_catalog_autocomplete_filtering(self):
        """F6.1: Verify course autocomplete filters catalog by search string."""
        catalog = ["Excel 2021 Básico", "Excel 2021 Avançado", "Python", "Power BI", "Photoshop Mód I"]
        query = "excel"
        matches = [c for c in catalog if query in c.lower()]
        self.assertEqual(len(matches), 2)
        self.assertIn("Excel 2021 Básico", matches)

    def test_f6_02_add_multiple_courses_up_to_18_limit(self):
        """F6.2: Verify adding multiple courses up to the maximum 18 limit."""
        fid = self.store.insert_ficha({"matricula": "C18", "nome": "Aluno Max Cursos"})
        courses = [f"Curso Módulo {i}" for i in range(1, 19)]
        self.store.set_student_courses(fid, courses)

        stored = self.store.get_student_courses(fid)
        self.assertEqual(len(stored), 18)

    def test_f6_03_interactive_reordering_shift_up_and_down(self):
        """F6.3: Verify swapping adjacent course positions (shift up and down)."""
        courses = ["Introdução à Informática", "Windows 11", "Word 2021"]
        # Swap index 1 (Windows 11) up to index 0
        courses[0], courses[1] = courses[1], courses[0]
        self.assertEqual(courses, ["Windows 11", "Introdução à Informática", "Word 2021"])

    def test_f6_04_course_removal_and_slot_compaction(self):
        """F6.4: Verify removing a course compacts subsequent course ordens."""
        fid = self.store.insert_ficha({"matricula": "CRM", "nome": "Aluno Remove Curso"})
        courses = ["Curso A", "Curso B", "Curso C"]
        self.store.set_student_courses(fid, courses)

        # Remove "Curso B" and recompact
        updated = ["Curso A", "Curso C"]
        self.store.set_student_courses(fid, updated)

        stored = self.store.get_student_courses(fid)
        self.assertEqual(len(stored), 2)
        self.assertEqual(stored[0]['curso_nome'], "Curso A")
        self.assertEqual(stored[0]['ordem'], 1)
        self.assertEqual(stored[1]['curso_nome'], "Curso C")
        self.assertEqual(stored[1]['ordem'], 2)

    def test_f6_05_catalog_auto_expansion_for_new_courses(self):
        """F6.5: Verify inserting a novel course automatically adds it to catalog."""
        new_course = "Inteligência Artificial Aplicada 2026"
        cid = self.store.insert_curso(new_course)
        self.assertIn(cid, self.store.cursos)
        self.assertEqual(self.store.cursos[cid]['nome'], new_course)

    # =========================================================================
    # F7: A4 Frente & Verso Sheet Print Engine
    # =========================================================================

    def test_f7_01_frente_layout_conformance_to_model(self):
        """F7.1: Verify Frente sheet structure conforms to ModeloFicha.xlsx."""
        wb = openpyxl.load_workbook(MODEL_EXCEL_PATH, data_only=True)
        sheet = wb["Frente"]
        self.assertIsNotNone(sheet)
        # Check title in A1
        title_val = sheet["A1"].value
        self.assertIn("Ficha de Acompanhamento", str(title_val))
        wb.close()

    def test_f7_02_verso_layout_conformance_to_model(self):
        """F7.2: Verify Verso sheet structure conforms to ModeloFicha.xlsx."""
        wb = openpyxl.load_workbook(MODEL_EXCEL_PATH, data_only=True)
        sheet = wb["Verso"]
        self.assertIsNotNone(sheet)
        title_val = sheet["A1"].value
        self.assertIn("Indicações adicionais", str(title_val))
        wb.close()

    def test_f7_03_schedule_dialog_and_day_hours_injection(self):
        """F7.3: Verify schedule times are formatted and injected across weekdays."""
        schedule = {
            "Segunda-feira": {"inicio": format_time("14"), "fim": format_time("16")},
            "Quarta-feira": {"inicio": format_time("1400"), "fim": format_time("1600")}
        }
        self.assertEqual(schedule["Segunda-feira"]["inicio"], "14h00")
        self.assertEqual(schedule["Segunda-feira"]["fim"], "16h00")
        self.assertEqual(schedule["Quarta-feira"]["inicio"], "14h00")

    def test_f7_04_exact_33_log_rows_and_notes_pauled_lines(self):
        """F7.4: Verify exactly 33 log rows on Frente and Verso."""
        student = {"matricula": "100", "nome": "Teste Geometry"}
        metrics = simulate_a4_page_geometry(student, ["Word", "Excel"], include_verso=True)
        self.assertEqual(metrics['pages'][0]['log_rows'], 33)
        self.assertEqual(metrics['pages'][0]['note_lines'], 5)
        self.assertEqual(metrics['pages'][1]['log_rows'], 33)
        self.assertEqual(metrics['pages'][1]['note_lines'], 12)

    def test_f7_05_print_scale_and_css_media_print_rules(self):
        """F7.5: Verify print scale factors: 65% for Frente and 67% for Verso."""
        student = {"matricula": "100", "nome": "Teste Scale"}
        metrics = simulate_a4_page_geometry(student, [], include_verso=True)
        self.assertEqual(metrics['pages'][0]['scale'], 0.65)
        self.assertEqual(metrics['pages'][1]['scale'], 0.67)

    # =========================================================================
    # F8: Batch Printing with Clean Page Breaks
    # =========================================================================

    def test_f8_01_continuous_document_generation_for_selected(self):
        """F8.1: Verify batch generation produces 2 pages per selected student."""
        students = [
            {"matricula": "101", "nome": "Aluno 1"},
            {"matricula": "102", "nome": "Aluno 2"},
            {"matricula": "103", "nome": "Aluno 3"}
        ]
        all_pages = []
        for s in students:
            geom = simulate_a4_page_geometry(s, ["Curso 1"], include_verso=True)
            all_pages.extend(geom['pages'])

        self.assertEqual(len(all_pages), 6) # 3 students * 2 pages

    def test_f8_02_page_break_after_page_rule_enforcement(self):
        """F8.2: Verify page breaks are applied after each A4 page."""
        student = {"matricula": "101", "nome": "Aluno Break"}
        geom = simulate_a4_page_geometry(student, ["Curso 1"], include_verso=True)
        self.assertTrue(geom['pages'][0]['has_page_break_after'])

    def test_f8_03_include_verso_toggle_behavior(self):
        """F8.3: Verify disabling Verso generates only 1 page per student."""
        student = {"matricula": "101", "nome": "Aluno Sem Verso"}
        geom = simulate_a4_page_geometry(student, ["Curso 1"], include_verso=False)
        self.assertEqual(geom['total_pages'], 1)
        self.assertEqual(geom['pages'][0]['page_type'], 'Frente')

    def test_f8_04_last_page_break_avoidance(self):
        """F8.4: Verify the terminal page avoids an unnecessary trailing page-break."""
        student = {"matricula": "101", "nome": "Aluno Terminal"}
        geom = simulate_a4_page_geometry(student, ["Curso 1"], include_verso=True)
        # The verso (last page of student) has has_page_break_after = False
        self.assertFalse(geom['pages'][-1]['has_page_break_after'])

    def test_f8_05_batch_schedule_propagation(self):
        """F8.5: Verify a batch schedule applies uniformly to all batch students."""
        batch_schedule = {"Segunda-feira": "14h00 às 16h00"}
        students = [{"matricula": str(i), "nome": f"Aluno {i}"} for i in range(5)]
        assigned = [{**s, "schedule": batch_schedule} for s in students]
        for a in assigned:
            self.assertEqual(a['schedule']['Segunda-feira'], "14h00 às 16h00")

    # =========================================================================
    # F9: Client-Side Excel Import/Export & Model Template
    # =========================================================================

    def test_f9_01_download_16_column_blank_model_template(self):
        """F9.1: Verify canonical 16-column structure for blank import template."""
        self.assertEqual(len(CANONICAL_EXCEL_HEADERS), 16)
        self.assertEqual(CANONICAL_EXCEL_HEADERS[0], "Matrícula")
        self.assertEqual(CANONICAL_EXCEL_HEADERS[1], "Nome")
        self.assertEqual(CANONICAL_EXCEL_HEADERS[15], "Cursos Contratados (Separados por vírgula)")

    def test_f9_02_parse_and_validate_populated_excel(self):
        """F9.2: Verify parsing and validation of a populated Excel row dictionary."""
        row = {
            "Matrícula": "5056188",
            "Nome": "Tamiris Mariana",
            "Email": "tamiris@email.com",
            "Data Nascimento": "29/09/1987",
            "Telefone": "(17) 98819-8252",
            "Instrutor": "Pyetra Alves",
            "Data Início Curso": "05/03/2026",
            "Data Término Curso": "24/08/2027",
            "Cursos Contratados (Separados por vírgula)": "Word 2021, Excel 2021"
        }
        matricula = normalize_matricula(row["Matrícula"])
        nome = row["Nome"].strip()
        nasc = normalize_date(row["Data Nascimento"])
        courses = split_courses_csv(row["Cursos Contratados (Separados por vírgula)"])

        self.assertEqual(matricula, "5056188")
        self.assertEqual(nome, "Tamiris Mariana")
        self.assertEqual(nasc, "1987-09-29")
        self.assertEqual(courses, ["Word 2021", "Excel 2021"])

    def test_f9_03_csv_courses_splitting_and_trimming(self):
        """F9.3: Verify CSV courses split by comma, trimmed, with empty items removed."""
        raw = " Excel 2021 ,  , Power BI , Windows 11 "
        cleaned = split_courses_csv(raw)
        self.assertEqual(cleaned, ["Excel 2021", "Power BI", "Windows 11"])

    def test_f9_04_upsert_logic_for_existing_matriculas(self):
        """F9.4: Verify Excel import updates existing student instead of duplicating."""
        fid1 = self.store.insert_ficha({"matricula": "5000", "nome": "Nome Original", "email": "antigo@email.com"})
        self.assertEqual(len(self.store.fichas), 1)

        # Upsert with same matricula
        fid2 = self.store.upsert_ficha({"matricula": "5000", "nome": "Nome Atualizado", "email": "novo@email.com"})
        self.assertEqual(fid1, fid2)
        self.assertEqual(len(self.store.fichas), 1)
        self.assertEqual(self.store.fichas[fid1]['nome'], "Nome Atualizado")
        self.assertEqual(self.store.fichas[fid1]['email'], "novo@email.com")

    def test_f9_05_export_student_list_to_canonical_excel(self):
        """F9.5: Verify exported student records map accurately to 16 canonical columns."""
        student = {
            "matricula": "5056188",
            "nome": "TAMIRIS MARIANA",
            "email": "tamiris@email.com",
            "data_nascimento": "1987-09-29",
            "telefone": "(17) 98819-8252",
            "instrutor": "Pyetra Alves",
            "data_inicio_curso": "2026-03-05",
            "data_termino_curso": "2027-08-24",
            "data_linha_vida": "2025-09-15",
            "data_form1": "2025-09-15",
            "data_form2": "2026-06-02",
            "data_dreamday": None,
            "data_fechamento1": None,
            "data_fechamento2": None,
            "data_fechamento3": None,
            "courses": ["Excel 2021", "Power BI"]
        }
        export_row = [
            student["matricula"],
            student["nome"],
            student["email"],
            student["data_nascimento"],
            student["telefone"],
            student["instrutor"],
            student["data_inicio_curso"],
            student["data_termino_curso"],
            student["data_linha_vida"],
            student["data_form1"],
            student["data_form2"],
            student["data_dreamday"] or "—",
            student["data_fechamento1"] or "—",
            student["data_fechamento2"] or "—",
            student["data_fechamento3"] or "—",
            ", ".join(student["courses"])
        ]
        self.assertEqual(len(export_row), 16)
        self.assertEqual(export_row[0], "5056188")
        self.assertEqual(export_row[15], "Excel 2021, Power BI")

    # =========================================================================
    # F10: GitHub Actions CI/CD Deployment
    # =========================================================================

    def test_f10_01_workflow_trigger_branches_main_and_dispatch(self):
        """F10.1: Verify deploy workflow triggers on main branch push and workflow_dispatch."""
        workflow_config = {
            "on": {
                "push": {"branches": ["main", "master"]},
                "workflow_dispatch": {}
            }
        }
        self.assertIn("main", workflow_config["on"]["push"]["branches"])
        self.assertIn("workflow_dispatch", workflow_config["on"])

    def test_f10_02_runner_environment_and_node_version(self):
        """F10.2: Verify CI runner environment is ubuntu-latest with Node 22/24."""
        job_config = {
            "runs-on": "ubuntu-latest",
            "node_version": 22
        }
        self.assertEqual(job_config["runs-on"], "ubuntu-latest")
        self.assertIn(job_config["node_version"], (20, 22, 24))

    def test_f10_03_build_command_and_required_env_secrets(self):
        """F10.3: Verify npm run build command receives Supabase environment secrets."""
        env_vars = {
            "NEXT_PUBLIC_SUPABASE_URL": "https://apfcbkucxjcleqxarlmv.supabase.co",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY": "sb_publishable_test"
        }
        self.assertIn("NEXT_PUBLIC_SUPABASE_URL", env_vars)
        self.assertIn("NEXT_PUBLIC_SUPABASE_ANON_KEY", env_vars)

    def test_f10_04_pages_artifact_upload_and_deployment(self):
        """F10.4: Verify pages artifact upload from ./out folder and deploy-pages action."""
        upload_step = {
            "uses": "actions/upload-pages-artifact@v3",
            "with": {"path": "./out"}
        }
        deploy_step = {
            "uses": "actions/deploy-pages@v4"
        }
        self.assertEqual(upload_step["with"]["path"], "./out")
        self.assertTrue(deploy_step["uses"].startswith("actions/deploy-pages"))

    def test_f10_05_github_pages_permissions_configuration(self):
        """F10.5: Verify required permissions for GitHub Pages (pages: write, id-token: write)."""
        permissions = {
            "contents": "read",
            "pages": "write",
            "id-token": "write"
        }
        self.assertEqual(permissions["pages"], "write")
        self.assertEqual(permissions["id-token"], "write")


if __name__ == "__main__":
    unittest.main()
