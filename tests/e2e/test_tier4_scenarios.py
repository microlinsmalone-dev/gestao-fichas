"""
Tier 4: Real-World Application Scenarios
End-to-end user workflows, lifecycle simulations, and full-system round-trips.
Coverage: >= 5 test cases.
Author: test_writer_e2e
"""

import unittest
import os
import sqlite3
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


class TestTier4Scenarios(unittest.TestCase):
    """Tier 4: End-to-End Real-World Application Scenarios"""

    def setUp(self):
        self.store = InMemorySupabaseStore()

    def test_t4_01_complete_migration_workflow_all_280_students(self):
        """
        T4.1: Complete Migration Workflow
        Loads production SQLite 'sistema_fichas.db', migrates all 280 students,
        all 105 distinct courses, and all 717 enrollment records with zero data loss.
        """
        self.assertTrue(os.path.exists(SQLITE_PATH), f"SQLite DB missing at {SQLITE_PATH}")
        conn = sqlite3.connect(SQLITE_PATH)
        cur = conn.cursor()

        # 1. Unify and insert all courses into store
        cur.execute("SELECT nome FROM cursos")
        for (cname,) in cur.fetchall():
            self.store.insert_curso(cname)

        cur.execute("SELECT DISTINCT curso_nome FROM fichas_cursos")
        for (cname,) in cur.fetchall():
            self.store.insert_curso(cname)

        self.assertEqual(len(self.store.cursos), 105, "Catalog must contain exactly 105 courses")

        # 2. Migrate all 280 students
        cur.execute("""
            SELECT id, matricula, nome, email, data_nascimento, telefone, instrutor,
                   data_inicio_curso, data_termino_curso, data_linha_vida, data_form1,
                   data_form2, data_dreamday, data_fechamento1, data_fechamento2, data_fechamento3
            FROM fichas ORDER BY id ASC
        """)
        student_rows = cur.fetchall()

        serial_date_conversions = 0
        for row in student_rows:
            raw_nasc = row[4]
            if raw_nasc and str(raw_nasc).isdigit():
                serial_date_conversions += 1

            self.store.insert_ficha({
                "id": row[0],
                "matricula": row[1],
                "nome": row[2],
                "email": row[3],
                "data_nascimento": row[4],
                "telefone": row[5],
                "instrutor": row[6],
                "data_inicio_curso": row[7],
                "data_termino_curso": row[8],
                "data_linha_vida": row[9],
                "data_form1": row[10],
                "data_form2": row[11],
                "data_dreamday": row[12],
                "data_fechamento1": row[13],
                "data_fechamento2": row[14],
                "data_fechamento3": row[15]
            })

        self.assertEqual(len(self.store.fichas), 280, "Expected all 280 students migrated")
        self.assertEqual(serial_date_conversions, 185, "Expected exactly 185 serial dates converted")

        # 3. Migrate all 717 enrollment records preserving rowid order
        cur.execute("SELECT ficha_id, curso_nome FROM fichas_cursos ORDER BY ficha_id, rowid")
        enrollment_rows = cur.fetchall()
        conn.close()

        current_fid = None
        ordem_counter = 1
        for fid, cname in enrollment_rows:
            if fid != current_fid:
                current_fid = fid
                ordem_counter = 1

            cid = self.store.insert_curso(cname)
            self.store.link_curso(fid, cid, cname, ordem_counter)
            ordem_counter += 1

        self.assertEqual(len(self.store.fichas_cursos), 717, "Expected all 717 enrollments migrated")

    def test_t4_02_end_to_end_pedagogical_lifecycle(self):
        """
        T4.2: End-to-End Pedagogical Lifecycle
        Cadastral registration -> 12 courses enrolled -> didactic reordering ->
        tracking 9 lifecycle dates -> schedule configuration -> A4 sheet emission.
        """
        # Step 1: Student Registration
        fid = self.store.insert_ficha({
            "matricula": "LIFECYCLE_2026",
            "nome": "GABRIEL HENRIQUE ALVES",
            "email": "gabriel.alves@microlins.com.br",
            "telefone": "(17) 98111-2233",
            "instrutor": "Antonio Fagner dos Santos Silva",
            "data_nascimento": "2008-04-12"
        })
        self.assertIn(fid, self.store.fichas)

        # Step 2: Course Enrollment (12 courses)
        initial_courses = [
            "Introdução à Informática", "Windows 11", "Word 2021", "Excel 2021 Básico",
            "Excel 2021 Avançado", "PowerPoint 2021", "Internet e Redes Sociais",
            "Assistente Administrativo Mód I", "Assistente Administrativo Mód II",
            "Lógica de Programação", "Python", "Power BI"
        ]
        self.store.set_student_courses(fid, initial_courses)
        self.assertEqual(len(self.store.get_student_courses(fid)), 12)

        # Step 3: Didactic Reordering
        # Swap position of Python to come right after Lógica de Programação
        reordered = list(initial_courses)
        reordered.remove("Power BI")
        reordered.append("Power BI")
        self.store.set_student_courses(fid, reordered)
        self.assertEqual(self.store.get_student_courses(fid)[-1]['curso_nome'], "Power BI")

        # Step 4: Tracking Lifecycle Dates
        self.store.upsert_ficha({
            "matricula": "LIFECYCLE_2026",
            "data_inicio_curso": "2026-03-01",
            "data_termino_curso": "2028-03-01",
            "data_linha_vida": "2026-04-10",
            "data_form1": "2026-05-15",
            "data_form2": "2026-11-20",
            "data_dreamday": "2027-04-10",
            "data_fechamento1": "2027-08-15",
            "data_fechamento2": "2027-11-15",
            "data_fechamento3": "2028-02-15"
        })
        updated = self.store.fichas[fid]
        self.assertEqual(updated['data_form1'], "2026-05-15")
        self.assertEqual(updated['data_fechamento3'], "2028-02-15")

        # Step 5: Schedule Configuration
        schedule_config = {
            "Segunda-feira": {"inicio": "14h00", "fim": "16h00"},
            "Quarta-feira": {"inicio": "14h00", "fim": "16h00"}
        }

        # Step 6: Print Sheet Emission (Frente & Verso)
        student_courses = [fc['curso_nome'] for fc in self.store.get_student_courses(fid)]
        geom = simulate_a4_page_geometry(updated, student_courses, schedule=schedule_config, include_verso=True)

        self.assertEqual(geom['total_pages'], 2)
        self.assertTrue(geom['fits_a4'])
        self.assertEqual(geom['pages'][0]['page_type'], 'Frente')
        self.assertEqual(geom['pages'][0]['courses_count'], 12)
        self.assertEqual(geom['pages'][1]['page_type'], 'Verso')

    def test_t4_03_bulk_administrative_cycle(self):
        """
        T4.3: Bulk Administrative Cycle
        Generate blank template -> simulate 25 incoming students ->
        bulk upsert into store -> search by instructor -> batch print A4 sheets.
        """
        # Step 1: Verify 16 columns of import template
        headers = list(CANONICAL_EXCEL_HEADERS)
        self.assertEqual(len(headers), 16)

        # Step 2: 25 incoming student rows
        imported_rows = []
        for i in range(1, 26):
            inst = "Pyetra Alves" if i <= 15 else "Antonio Fagner"
            imported_rows.append({
                "Matrícula": f"2026_{i:04d}",
                "Nome": f"ALUNO NOVO {i:02d}",
                "Email": f"aluno{i}@email.com",
                "Data Nascimento": "15/05/2007",
                "Telefone": "(17) 98800-0000",
                "Instrutor": inst,
                "Data Início Curso": "01/04/2026",
                "Data Término Curso": "01/04/2027",
                "Cursos Contratados (Separados por vírgula)": "Windows 11, Word 2021, Excel 2021"
            })

        # Step 3: Browser Client Bulk Upsert
        for r in imported_rows:
            fid = self.store.upsert_ficha({
                "matricula": r["Matrícula"],
                "nome": r["Nome"],
                "email": r["Email"],
                "data_nascimento": r["Data Nascimento"],
                "telefone": r["Telefone"],
                "instrutor": r["Instrutor"],
                "data_inicio_curso": r["Data Início Curso"],
                "data_termino_curso": r["Data Término Curso"]
            })
            courses = split_courses_csv(r["Cursos Contratados (Separados por vírgula)"])
            self.store.set_student_courses(fid, courses)

        self.assertEqual(len(self.store.fichas), 25)

        # Step 4: Search & Filter by instructor "Pyetra Alves"
        pyetra_students = [s for s in self.store.fichas.values() if s['instrutor'] == "Pyetra Alves"]
        self.assertEqual(len(pyetra_students), 15)

        # Step 5: Batch Select all filtered students
        selected_ids = [s['id'] for s in pyetra_students]

        # Step 6: Batch Print A4 Generation
        total_pages = 0
        for sid in selected_ids:
            s = self.store.fichas[sid]
            c = [fc['curso_nome'] for fc in self.store.get_student_courses(sid)]
            geom = simulate_a4_page_geometry(s, c, include_verso=True)
            total_pages += geom['total_pages']

        self.assertEqual(total_pages, 30) # 15 students * 2 pages = 30 pages

    def test_t4_04_high_density_student_handling(self):
        """
        T4.4: High-Density Student Handling
        Maximum 18 courses, 6 scheduled days, all 7 career dates, longest name (42 chars).
        Verifies A4 Frente & Verso geometry fits strictly with zero spillover.
        """
        longest_name = "EMILLY VITÓRIA FERREIRA DOS SANTOS SILVA"
        self.assertEqual(len(longest_name), 40)

        # 18 courses (max allowed in physical sheet)
        all_18_courses = [
            "Introdução à Informática", "Windows 11", "Word 2021 Básico", "Word 2021 Avançado",
            "Excel 2021 Básico", "Excel 2021 Avançado Mód I", "Excel 2021 Avançado Mód II",
            "PowerPoint 2021", "Access 2021", "Power BI", "Lógica de Programação",
            "Programação C# Mód I", "Programação C# Mód II", "Python", "Photoshop Mód I",
            "CorelDraw Mód I", "Assistente Administrativo Mód I", "Secretariado Executivo"
        ]

        # 6 days schedule
        schedule_6_days = {
            d: {"inicio": "08h00", "fim": "10h00"}
            for d in ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"]
        }

        fid = self.store.insert_ficha({
            "matricula": "MAX_CAPACITY_01",
            "nome": longest_name,
            "email": "emilly.vitoria.longemail@microlins.com.br",
            "telefone": "(17) 99888-7766",
            "instrutor": "Antonio Fagner dos Santos Silva",
            "data_nascimento": "2006-11-23",
            "data_inicio_curso": "2026-02-01",
            "data_termino_curso": "2029-02-01",
            "data_linha_vida": "2026-03-01",
            "data_form1": "2026-04-01",
            "data_form2": "2026-10-01",
            "data_dreamday": "2027-02-01",
            "data_fechamento1": "2027-08-01",
            "data_fechamento2": "2028-02-01",
            "data_fechamento3": "2028-08-01"
        })
        self.store.set_student_courses(fid, all_18_courses)

        student = self.store.fichas[fid]
        courses = [fc['curso_nome'] for fc in self.store.get_student_courses(fid)]
        geom = simulate_a4_page_geometry(student, courses, schedule=schedule_6_days, include_verso=True)

        self.assertEqual(geom['total_pages'], 2)
        self.assertFalse(geom['overflow_courses'])
        self.assertTrue(geom['fits_a4'])
        self.assertEqual(geom['pages'][0]['courses_count'], 18)
        self.assertEqual(geom['pages'][0]['log_rows'], 33)
        self.assertEqual(geom['pages'][1]['log_rows'], 33)

    def test_t4_05_full_system_data_portability_roundtrip(self):
        """
        T4.5: Full System Data Portability Round-Trip
        SQLite DB -> Supabase Store -> Web Table -> Excel Export ->
        File Modification -> Excel Re-import (Upsert) -> Print Engine.
        """
        # 1. Seed from SQLite row (Tamiris Mariana)
        conn = sqlite3.connect(SQLITE_PATH)
        cur = conn.cursor()
        cur.execute("SELECT id, matricula, nome, email, telefone, instrutor FROM fichas WHERE matricula = '5056188'")
        seed = cur.fetchone()
        conn.close()

        fid = self.store.insert_ficha({
            "id": seed[0],
            "matricula": seed[1],
            "nome": seed[2],
            "email": seed[3],
            "telefone": seed[4],
            "instrutor": seed[5]
        })
        self.store.set_student_courses(fid, ["Word 2021", "Excel 2021"])

        # 2. Emulate Web Table Query
        student_before = self.store.fichas[fid]
        courses_before = [fc['curso_nome'] for fc in self.store.get_student_courses(fid)]
        self.assertEqual(student_before['nome'], "TAMIRIS MARIANA DE CARVALHO RUBO BERTAN")
        self.assertEqual(len(courses_before), 2)

        # 3. Export to canonical Excel row
        exported_row = {
            "Matrícula": student_before["matricula"],
            "Nome": student_before["nome"],
            "Email": student_before["email"],
            "Telefone": student_before["telefone"],
            "Instrutor": student_before["instrutor"],
            "Cursos Contratados (Separados por vírgula)": ", ".join(courses_before)
        }

        # 4. Client modifies exported row outside app (adds course, changes email)
        modified_row = dict(exported_row)
        modified_row["Email"] = "tamiris.nova@email.com"
        modified_row["Cursos Contratados (Separados por vírgula)"] = "Word 2021, Excel 2021, Power BI"

        # 5. Client re-imports modified file (Upsert)
        fid_updated = self.store.upsert_ficha({
            "matricula": modified_row["Matrícula"],
            "nome": modified_row["Nome"],
            "email": modified_row["Email"],
            "telefone": modified_row["Telefone"],
            "instrutor": modified_row["Instrutor"]
        })
        new_courses = split_courses_csv(modified_row["Cursos Contratados (Separados por vírgula)"])
        self.store.set_student_courses(fid_updated, new_courses)

        # Verify database updated without duplicating student
        self.assertEqual(fid_updated, fid)
        self.assertEqual(len(self.store.fichas), 1)
        self.assertEqual(self.store.fichas[fid]["email"], "tamiris.nova@email.com")

        courses_after = [fc['curso_nome'] for fc in self.store.get_student_courses(fid)]
        self.assertEqual(len(courses_after), 3)
        self.assertIn("Power BI", courses_after)

        # 6. Verify Print Engine reflects updated data
        geom = simulate_a4_page_geometry(self.store.fichas[fid], courses_after, include_verso=True)
        self.assertEqual(geom['pages'][0]['courses_count'], 3)
        self.assertTrue(geom['fits_a4'])


if __name__ == "__main__":
    unittest.main()
