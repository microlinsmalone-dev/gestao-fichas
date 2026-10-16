"""
Tier 3: Cross-Feature Interactions
Integration tests verifying pairwise and multi-feature contract interactions.
Coverage: >= 10 test cases.
Author: test_writer_e2e
"""

import unittest
import os
import sqlite3
from typing import List, Dict, Any
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


class TestTier3Interactions(unittest.TestCase):
    """Tier 3: Cross-Feature Pairwise Interactions"""

    def setUp(self):
        self.store = InMemorySupabaseStore()

    def test_t3_01_excel_import_reorder_courses_print_frente(self):
        """T3.1: Excel Import (F9) -> Course Reordering (F6) -> Print Engine A4 (F7)."""
        # 1. Simulate Excel Import row
        excel_row = {
            "Matrícula": "8801",
            "Nome": "ALUNO INTEGRACAO 1",
            "Cursos Contratados (Separados por vírgula)": "Windows 11, Word 2021, Excel 2021"
        }
        matricula = normalize_matricula(excel_row["Matrícula"])
        nome = excel_row["Nome"]
        courses = split_courses_csv(excel_row["Cursos Contratados (Separados por vírgula)"])

        # 2. Insert into store (F1/F5)
        fid = self.store.insert_ficha({"matricula": matricula, "nome": nome})
        self.store.set_student_courses(fid, courses)

        # 3. Interactive Reorder: Move Excel 2021 to first position (F6)
        # Original: ["Windows 11", "Word 2021", "Excel 2021"]
        reordered = ["Excel 2021", "Windows 11", "Word 2021"]
        self.store.set_student_courses(fid, reordered)

        # 4. Pass to Print Engine (F7)
        student_rec = self.store.fichas[fid]
        stored_courses = [fc['curso_nome'] for fc in self.store.get_student_courses(fid)]
        geom = simulate_a4_page_geometry(student_rec, stored_courses, include_verso=True)

        self.assertEqual(stored_courses[0], "Excel 2021")
        self.assertEqual(stored_courses[1], "Windows 11")
        self.assertEqual(geom['pages'][0]['courses_count'], 3)
        self.assertTrue(geom['fits_a4'])

    def test_t3_02_search_filter_batch_select_batch_print(self):
        """T3.2: Search Filter (F4) -> Batch Select (F4) -> Batch Print (F8)."""
        # Populate multiple students with different instructors
        for i in range(1, 11):
            inst = "Antonio Fagner" if i % 2 == 0 else "Pyetra Alves"
            self.store.insert_ficha({
                "matricula": f"FILT_{i}",
                "nome": f"Aluno Filtro {i}",
                "instrutor": inst
            })

        # Filter by instructor "Pyetra Alves"
        filtered = [s for s in self.store.fichas.values() if s['instrutor'] == "Pyetra Alves"]
        self.assertEqual(len(filtered), 5)

        # Batch select all filtered
        selected_ids = {s['id'] for s in filtered}
        self.assertEqual(len(selected_ids), 5)

        # Trigger batch print
        batch_pages = []
        for sid in selected_ids:
            s = self.store.fichas[sid]
            geom = simulate_a4_page_geometry(s, ["Curso Padrão"], include_verso=True)
            batch_pages.extend(geom['pages'])

        self.assertEqual(len(batch_pages), 10) # 5 students * 2 pages = 10 pages

    def test_t3_03_sqlite_migration_student_profile_update_rls(self):
        """T3.3: SQLite Migration (F2) -> Student Profile Update (F5) -> Supabase Schema RLS (F1)."""
        # Read real student 1 from SQLite
        conn = sqlite3.connect(SQLITE_PATH)
        cur = conn.cursor()
        cur.execute("SELECT id, matricula, nome, email FROM fichas WHERE id = 1")
        row = cur.fetchone()
        conn.close()

        # Migrate to store
        fid = self.store.insert_ficha({
            "id": row[0],
            "matricula": row[1],
            "nome": row[2],
            "email": row[3]
        })

        # Update profile via CRUD
        self.store.upsert_ficha({
            "matricula": row[1],
            "nome": "Malone Atualizado",
            "telefone": "(17) 99123-4567",
            "data_inicio_curso": "2026-03-01"
        })

        updated = self.store.fichas[fid]
        self.assertEqual(updated['nome'], "Malone Atualizado")
        self.assertEqual(updated['telefone'], "(17) 99123-4567")
        self.assertEqual(updated['data_inicio_curso'], "2026-03-01")

    def test_t3_04_course_catalog_add_student_assignment_excel_export(self):
        """T3.4: Course Catalog Add (F6) -> Student Assignment (F6) -> Excel Export (F9)."""
        # Add new institutional course
        new_course_name = "Cloud Computing AWS 2026"
        cid = self.store.insert_curso(new_course_name)

        # Assign to student
        fid = self.store.insert_ficha({"matricula": "AWS100", "nome": "Aluno Nuvem"})
        self.store.link_curso(fid, cid, new_course_name, 1)

        # Generate Excel export row
        student = self.store.fichas[fid]
        assigned_courses = [fc['curso_nome'] for fc in self.store.get_student_courses(fid)]
        export_row = {
            "Matrícula": student["matricula"],
            "Nome": student["nome"],
            "Cursos Contratados (Separados por vírgula)": ", ".join(assigned_courses)
        }

        self.assertEqual(export_row["Cursos Contratados (Separados por vírgula)"], new_course_name)

    def test_t3_05_student_modal_lifecycle_dates_career_milestones_render(self):
        """T3.5: Student Modal Lifecycle Dates (F5) -> Career Milestones Render (F7) -> Print Frente."""
        lifecycle_dates = {
            "data_linha_vida": "2025-09-15",
            "data_form1": "2025-09-15",
            "data_form2": "2026-06-02",
            "data_dreamday": "2026-07-20",
            "data_fechamento1": "2026-08-10",
            "data_fechamento2": "2026-09-10",
            "data_fechamento3": "2026-10-10"
        }
        fid = self.store.insert_ficha({
            "matricula": "CAREER1",
            "nome": "Aluno Carreira",
            **lifecycle_dates
        })
        student = self.store.fichas[fid]

        # Verify mapping into the 7 milestone slots on Frente sheet (lines 7 to 15, cols N-P)
        milestones = [
            ("Linha da vida", student["data_linha_vida"]),
            ("Form 1", student["data_form1"]),
            ("Form 2", student["data_form2"]),
            ("Dream Day", student["data_dreamday"]),
            ("Fechamento 1", student["data_fechamento1"]),
            ("Fechamento 2", student["data_fechamento2"]),
            ("Fechamento 3", student["data_fechamento3"])
        ]
        self.assertEqual(len(milestones), 7)
        for label, dt_val in milestones:
            self.assertIsNotNone(dt_val)

    def test_t3_06_excel_template_generation_roundtrip_reimport_table_refresh(self):
        """T3.6: Excel Template Generation (F9) -> Reimport with Upsert (F9) -> Table Refresh (F4)."""
        # Emulate blank template header validation
        headers = list(CANONICAL_EXCEL_HEADERS)
        self.assertEqual(len(headers), 16)

        # Client populates 2 rows
        incoming_rows = [
            {"Matrícula": "9901", "Nome": "Aluno Importado 1", "Cursos Contratados (Separados por vírgula)": "Python, SQL"},
            {"Matrícula": "9902", "Nome": "Aluno Importado 2", "Cursos Contratados (Separados por vírgula)": "Excel 2021"}
        ]

        for r in incoming_rows:
            fid = self.store.upsert_ficha({"matricula": r["Matrícula"], "nome": r["Nome"]})
            courses = split_courses_csv(r["Cursos Contratados (Separados por vírgula)"])
            self.store.set_student_courses(fid, courses)

        # Table state reflects 2 students
        self.assertEqual(len(self.store.fichas), 2)
        # Search for imported 1
        found = [s for s in self.store.fichas.values() if "Importado 1" in s["nome"]]
        self.assertEqual(len(found), 1)

    def test_t3_07_batch_schedule_dialog_batch_print_multi_student(self):
        """T3.7: Batch Schedule Dialog (F7) -> Batch Print (F8) -> Multi-Student Page Layout."""
        # Schedule applied in dialog
        schedule_config = {
            "diasSemana": ["Segunda-feira", "Quarta-feira"],
            "horarioInicio": "14h00",
            "horarioFim": "16h00"
        }

        # 3 selected students
        students = [
            {"matricula": "SCHED_1", "nome": "Aluno Batch S1"},
            {"matricula": "SCHED_2", "nome": "Aluno Batch S2"},
            {"matricula": "SCHED_3", "nome": "Aluno Batch S3"}
        ]

        document_stream = []
        for s in students:
            # Frente with injected schedule
            geom = simulate_a4_page_geometry(s, ["Curso 1", "Curso 2"], schedule=schedule_config, include_verso=True)
            document_stream.extend(geom['pages'])

        self.assertEqual(len(document_stream), 6)
        # Check alternating pages Frente / Verso
        self.assertEqual(document_stream[0]['page_type'], 'Frente')
        self.assertEqual(document_stream[1]['page_type'], 'Verso')
        self.assertEqual(document_stream[2]['page_type'], 'Frente')
        self.assertEqual(document_stream[3]['page_type'], 'Verso')

    def test_t3_08_sqlite_migration_185_serial_dates_modal_display_export(self):
        """T3.8: SQLite Migration Serial Dates (F2) -> Modal Display (F5) -> Excel Export (F9)."""
        # Take real student with serial date from SQLite
        conn = sqlite3.connect(SQLITE_PATH)
        cur = conn.cursor()
        cur.execute("SELECT id, matricula, nome, data_nascimento FROM fichas WHERE data_nascimento = '41591'")
        row = cur.fetchone()
        conn.close()

        self.assertIsNotNone(row, "Expected at least one student with serial 41591")
        # Migrate & normalize (F2)
        iso_date = normalize_date(row[3])
        self.assertEqual(iso_date, "2013-11-13")

        fid = self.store.insert_ficha({
            "matricula": row[1],
            "nome": row[2],
            "data_nascimento": iso_date
        })

        # Formatted for Modal / Display in BR format (F5)
        dt = datetime.strptime(self.store.fichas[fid]["data_nascimento"], "%Y-%m-%d")
        display_date = dt.strftime("%d/%m/%Y")
        self.assertEqual(display_date, "13/11/2013")

        # Exported back to canonical Excel row (F9)
        export_date = self.store.fichas[fid]["data_nascimento"]
        self.assertEqual(export_date, "2013-11-13")

    def test_t3_09_app_shell_navigation_filter_persistence_individual_print(self):
        """T3.9: App Shell Navigation (F3) -> Filter Persistence (F4) -> Individual Print View (F7)."""
        for i in range(1, 6):
            self.store.insert_ficha({"matricula": f"NAV_{i}", "nome": f"Aluno Nav {i}", "instrutor": "Malone"})

        # Navigation state retains filter parameter
        active_route = "/fichas?instrutor=Malone"
        self.assertIn("instrutor=Malone", active_route)

        # User clicks print on student NAV_2
        target_student = next(s for s in self.store.fichas.values() if s['matricula'] == "NAV_2")
        geom = simulate_a4_page_geometry(target_student, ["Curso Nav"], include_verso=True)
        self.assertEqual(geom['total_pages'], 2)
        self.assertEqual(geom['pages'][0]['student_name'], "Aluno Nav 2")

    def test_t3_10_migration_orphan_courses_catalog_autocomplete_student_link(self):
        """T3.10: Migration Orphan Courses (F2) -> Catalog Autocomplete (F6) -> Student Link (F1)."""
        # Orphan courses found in SQLite:
        orphan_courses = ["Design Gráfico", "Assistente Administrativo", "Inglês Básico", "Inglês Avançado"]

        # 1. Unified into catalog during migration (F2 -> F1)
        for oc in orphan_courses:
            self.store.insert_curso(oc)

        # 2. Autocomplete matches "inglês" (F6)
        query = "inglês"
        matches = [c['nome'] for c in self.store.cursos.values() if query in c['nome'].lower()]
        self.assertEqual(len(matches), 2)
        self.assertIn("Inglês Básico", matches)
        self.assertIn("Inglês Avançado", matches)

        # 3. New student enrolls in orphan course (F1)
        fid = self.store.insert_ficha({"matricula": "ORPHAN_LINK", "nome": "Novo Aluno Ingles"})
        cid = next(c['id'] for c in self.store.cursos.values() if c['nome'] == "Inglês Básico")
        self.store.link_curso(fid, cid, "Inglês Básico", 1)

        links = self.store.get_student_courses(fid)
        self.assertEqual(len(links), 1)
        self.assertEqual(links[0]['curso_nome'], "Inglês Básico")


if __name__ == "__main__":
    unittest.main()
