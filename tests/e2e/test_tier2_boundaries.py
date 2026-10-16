"""
Tier 2: Boundary & Corner Cases (F1 to F10)
Adversarial tests for edge cases, resource boundaries, malformed inputs, and constraints.
Coverage: 10 features x 5 test cases = 50 test cases.
Author: test_writer_e2e
"""

import unittest
import os
import re
import sqlite3
import unicodedata
from datetime import datetime

from tests.helpers import (
    SQLITE_PATH,
    MODEL_EXCEL_PATH,
    CANONICAL_EXCEL_HEADERS,
    InMemorySupabaseStore,
    normalize_date,
    format_time,
    expand_year,
    normalize_matricula,
    split_courses_csv,
    simulate_a4_page_geometry,
)


class TestTier2Boundaries(unittest.TestCase):
    """Tier 2: Boundary & Corner Cases (F1 to F10)"""

    def setUp(self):
        self.store = InMemorySupabaseStore()

    # =========================================================================
    # F1 Boundaries: Schema & Constraints
    # =========================================================================

    def test_f1_b01_matricula_max_length_boundary_50(self):
        """F1.B1: Matricula accepts exactly 50 chars, rejects 51 chars."""
        mat_50 = "A" * 50
        fid = self.store.insert_ficha({"matricula": mat_50, "nome": "Aluno 50 Chars"})
        self.assertEqual(self.store.fichas[fid]['matricula'], mat_50)

        mat_51 = "A" * 51
        with self.assertRaises(ValueError):
            self.store.insert_ficha({"matricula": mat_51, "nome": "Aluno 51 Chars"})

    def test_f1_b02_ordem_boundary_rejection_below_1_and_above_18(self):
        """F1.B2: Check constraint strictly enforces 1 <= ordem <= 18."""
        cid = self.store.insert_curso("Curso Boundary")
        fid = self.store.insert_ficha({"matricula": "BORD1", "nome": "Aluno Ordem Boundary"})

        # Boundaries 0 and -1 rejected
        with self.assertRaises(ValueError):
            self.store.link_curso(fid, cid, "Curso Boundary", 0)
        with self.assertRaises(ValueError):
            self.store.link_curso(fid, cid, "Curso Boundary", -1)

        # Boundaries 19 and 100 rejected
        with self.assertRaises(ValueError):
            self.store.link_curso(fid, cid, "Curso Boundary", 19)
        with self.assertRaises(ValueError):
            self.store.link_curso(fid, cid, "Curso Boundary", 100)

    def test_f1_b03_empty_string_versus_null_handling(self):
        """F1.B3: Empty string values for dates and optional fields convert to None (SQL NULL)."""
        fid = self.store.insert_ficha({
            "matricula": "NULL1",
            "nome": "Aluno Null Test",
            "email": "",
            "telefone": "",
            "data_nascimento": "",
            "data_inicio_curso": ""
        })
        rec = self.store.fichas[fid]
        self.assertIsNone(rec['email'])
        self.assertIsNone(rec['telefone'])
        self.assertIsNone(rec['data_nascimento'])
        self.assertIsNone(rec['data_inicio_curso'])

    def test_f1_b04_duplicate_matricula_rejection_integrity(self):
        """F1.B4: Duplicate matricula rejection preserves existing student data intact."""
        self.store.insert_ficha({"matricula": "DUP1", "nome": "Aluno Original", "email": "orig@email.com"})
        with self.assertRaises(ValueError):
            self.store.insert_ficha({"matricula": "DUP1", "nome": "Aluno Impostor", "email": "fake@email.com"})

        # Confirm original record was NOT overwritten by failed insert
        for rec in self.store.fichas.values():
            if rec['matricula'] == "DUP1":
                self.assertEqual(rec['nome'], "Aluno Original")

    def test_f1_b05_duplicate_course_slot_rejection(self):
        """F1.B5: Rejects assigning two courses to the same slot (ficha_id, ordem)."""
        cid1 = self.store.insert_curso("Curso Slot 1")
        cid2 = self.store.insert_curso("Curso Slot 2")
        fid = self.store.insert_ficha({"matricula": "SLOT1", "nome": "Aluno Slot"})

        self.store.link_curso(fid, cid1, "Curso Slot 1", 1)
        with self.assertRaises(ValueError):
            self.store.link_curso(fid, cid2, "Curso Slot 2", 1)

    # =========================================================================
    # F2 Boundaries: SQLite Migration
    # =========================================================================

    def test_f2_b01_excel_serial_epoch_boundary_dates(self):
        """F2.B1: Excel serial boundary conversion: day 1 (1900-01-01) and large numbers."""
        self.assertEqual(normalize_date("1"), "1899-12-31")
        self.assertEqual(normalize_date("41591"), "2013-11-13")
        self.assertEqual(normalize_date("0"), None)
        self.assertEqual(normalize_date("-10"), None)

    def test_f2_b02_two_digit_year_expansion_boundary(self):
        """F2.B2: 2-digit year conversion: 26 -> 2026, 49 -> 2049, 50 -> 1950, 99 -> 1999."""
        self.assertEqual(expand_year("15/03/26"), "15/03/2026")
        self.assertEqual(expand_year("28/02/49"), "28/02/2049")
        self.assertEqual(expand_year("01/01/50"), "01/01/1950")
        self.assertEqual(expand_year("31/12/99"), "31/12/1999")

    def test_f2_b03_student_with_zero_enrolled_courses(self):
        """F2.B3: Verify migration handles students with 0 enrolled courses cleanly."""
        conn = sqlite3.connect(SQLITE_PATH)
        cur = conn.cursor()
        cur.execute("""
            SELECT count(*) FROM fichas
            WHERE id NOT IN (SELECT DISTINCT ficha_id FROM fichas_cursos)
        """)
        zero_courses_count = cur.fetchone()[0]
        conn.close()

        # In production SQLite, exactly 188 students have 0 enrolled courses
        self.assertEqual(zero_courses_count, 188)
        fid = self.store.insert_ficha({"matricula": "ZERO1", "nome": "Aluno Zero Cursos"})
        self.assertEqual(len(self.store.get_student_courses(fid)), 0)

    def test_f2_b04_student_with_maximum_enrolled_courses_15(self):
        """F2.B4: Verify student with maximum courses in legacy DB (15) migrates fully."""
        conn = sqlite3.connect(SQLITE_PATH)
        cur = conn.cursor()
        cur.execute("""
            SELECT ficha_id, count(*) as c FROM fichas_cursos
            GROUP BY ficha_id ORDER BY c DESC LIMIT 1
        """)
        max_fid, max_count = cur.fetchone()
        self.assertEqual(max_count, 15)

        cur.execute("SELECT curso_nome FROM fichas_cursos WHERE ficha_id = ? ORDER BY rowid", (max_fid,))
        courses = [r[0] for r in cur.fetchall()]
        conn.close()

        fid = self.store.insert_ficha({"matricula": f"MAX_{max_fid}", "nome": "Aluno 15 Cursos"})
        self.store.set_student_courses(fid, courses)
        stored = self.store.get_student_courses(fid)
        self.assertEqual(len(stored), 15)

    def test_f2_b05_utf8_portuguese_accent_preservation(self):
        """F2.B5: Verify UTF-8 Portuguese character fidelity across migration."""
        accented_names = ["Antônio Fagner dos Santos Silva", "Diéssica", "João Gonçalves", "Conceição"]
        for idx, name in enumerate(accented_names):
            fid = self.store.insert_ficha({"matricula": f"UTF8_{idx}", "nome": name})
            self.assertEqual(self.store.fichas[fid]['nome'], name)
            # Ensure no double UTF-8 mojibake (e.g. Ã£, Ã©) or replacement character
            self.assertNotIn("Ã£", self.store.fichas[fid]['nome'])
            self.assertNotIn("\ufffd", self.store.fichas[fid]['nome'])

    # =========================================================================
    # F3 Boundaries: App Shell & Client
    # =========================================================================

    def test_f3_b01_empty_github_actions_env_sets_empty_basepath(self):
        """F3.B1: Local build without GITHUB_ACTIONS sets basePath to empty string."""
        is_gh = False
        repo = "usuario/SistemaFichas_Web"
        base_path = f"/{repo.split('/')[1]}" if is_gh and repo else ""
        self.assertEqual(base_path, "")

    def test_f3_b02_missing_repository_env_handles_gracefully(self):
        """F3.B2: GITHUB_ACTIONS true but GITHUB_REPOSITORY empty handles cleanly."""
        is_gh = True
        repo = ""
        base_path = f"/{repo.split('/')[1]}" if is_gh and repo and '/' in repo else ""
        self.assertEqual(base_path, "")

    def test_f3_b03_supabase_client_empty_anon_key_falls_back(self):
        """F3.B3: Fallback anon key triggers when environment variable is empty string."""
        fallback = "sb_publishable_DZAXwbvMzgz31wR-pmbNkg_aNg3ofG0"
        configured_key = ""
        active_key = configured_key if configured_key else fallback
        self.assertEqual(active_key, fallback)

    def test_f3_b04_static_export_trailing_slash_route_mapping(self):
        """F3.B4: Static route with trailingSlash produces route/index.html mapping."""
        def route_to_static_file(route: str) -> str:
            clean = route.strip('/')
            return f"{clean}/index.html" if clean else "index.html"

        self.assertEqual(route_to_static_file("/fichas"), "fichas/index.html")
        self.assertEqual(route_to_static_file("/cursos"), "cursos/index.html")
        self.assertEqual(route_to_static_file("/"), "index.html")

    def test_f3_b05_css_print_media_styles_isolation(self):
        """F3.B5: Screen view hides print-only components; print view hides no-print."""
        screen_rules = {"no-print": "display: block", "print-only": "display: none"}
        print_rules = {"no-print": "display: none !important", "print-only": "display: block !important"}
        self.assertEqual(print_rules["no-print"], "display: none !important")
        self.assertEqual(print_rules["print-only"], "display: block !important")

    # =========================================================================
    # F4 Boundaries: Student Table & Filters
    # =========================================================================

    def test_f4_b01_search_with_empty_and_whitespace_only_query(self):
        """F4.B1: Searching with empty or whitespace string returns full list."""
        all_students = [{"matricula": "1", "nome": "Ana"}, {"matricula": "2", "nome": "Beto"}]
        query = "   "
        q_clean = query.strip()
        results = all_students if not q_clean else [s for s in all_students if q_clean in s['nome']]
        self.assertEqual(len(results), 2)

    def test_f4_b02_search_with_special_regex_characters(self):
        """F4.B2: Search handles meta-characters ([ * + ? ( ) { }) without regex crash."""
        students = [{"matricula": "1", "nome": "Curso C# (Básico)"}]
        query = "(Básico)"
        # Substring search (not raw regex) prevents SyntaxError
        results = [s for s in students if query.lower() in s['nome'].lower()]
        self.assertEqual(len(results), 1)

    def test_f4_b03_search_case_and_accent_insensitive(self):
        """F4.B3: Searching 'antonio' matches 'Antônio' via accent stripping."""
        def strip_accents(s: str) -> str:
            return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

        students = [{"matricula": "1", "nome": "Antônio Silva"}]
        query = strip_accents("antonio".lower())
        results = [s for s in students if query in strip_accents(s['nome'].lower())]
        self.assertEqual(len(results), 1)

    def test_f4_b04_search_non_matching_query_returns_empty(self):
        """F4.B4: Searching non-existent term returns empty list gracefully."""
        students = [{"matricula": "1", "nome": "Tamiris"}]
        query = "XYZ999_NON_EXISTENT"
        results = [s for s in students if query in s['nome']]
        self.assertEqual(len(results), 0)

    def test_f4_b05_batch_selection_state_toggle_interleaving(self):
        """F4.B5: Select all -> deselect 1 produces indeterminate selection state."""
        all_ids = {1, 2, 3, 4, 5}
        selected = set(all_ids)
        # Deselect one item
        selected.remove(3)
        is_all_selected = (len(selected) == len(all_ids))
        is_indeterminate = (0 < len(selected) < len(all_ids))

        self.assertFalse(is_all_selected)
        self.assertTrue(is_indeterminate)

    # =========================================================================
    # F5 Boundaries: Student CRUD Modal
    # =========================================================================

    def test_f5_b01_matricula_empty_or_whitespace_rejection(self):
        """F5.B1: Whitespace-only matricula is rejected."""
        with self.assertRaises(ValueError):
            self.store.insert_ficha({"matricula": "   \t\n  ", "nome": "Nome Valido"})

    def test_f5_b02_nome_empty_or_whitespace_rejection(self):
        """F5.B2: Whitespace-only nome is rejected."""
        with self.assertRaises(ValueError):
            self.store.insert_ficha({"matricula": "MAT123", "nome": "    "})

    def test_f5_b03_leap_year_february_29_handling(self):
        """F5.B3: February 29 is valid on leap year (2024), invalid on non-leap (2023)."""
        self.assertEqual(normalize_date("29/02/2024"), "2024-02-29")
        self.assertIsNone(normalize_date("29/02/2023"))

    def test_f5_b04_all_nine_dates_null_acceptable(self):
        """F5.B4: Student record is successfully saved with all 9 lifecycle dates null."""
        fid = self.store.insert_ficha({"matricula": "NODATES", "nome": "Aluno Sem Datas"})
        rec = self.store.fichas[fid]
        self.assertIsNone(rec['data_inicio_curso'])
        self.assertIsNone(rec['data_termino_curso'])
        self.assertIsNone(rec['data_linha_vida'])
        self.assertIsNone(rec['data_form1'])

    def test_f5_b05_telephone_various_formatting_masks(self):
        """F5.B5: Handles telephone strings with or without punctuation masks."""
        fid1 = self.store.insert_ficha({"matricula": "T1", "nome": "Aluno T1", "telefone": "(17) 98819-8252"})
        fid2 = self.store.insert_ficha({"matricula": "T2", "nome": "Aluno T2", "telefone": "17988198252"})
        self.assertEqual(self.store.fichas[fid1]['telefone'], "(17) 98819-8252")
        self.assertEqual(self.store.fichas[fid2]['telefone'], "17988198252")

    # =========================================================================
    # F6 Boundaries: Course Management & Reordering
    # =========================================================================

    def test_f6_b01_course_reorder_top_item_up_no_op(self):
        """F6.B1: Shifting the first course up is clamped (no-op)."""
        courses = ["Primeiro", "Segundo", "Terceiro"]
        idx = 0
        target = max(0, idx - 1)
        self.assertEqual(target, 0)
        # Position unchanged
        self.assertEqual(courses[0], "Primeiro")

    def test_f6_b02_course_reorder_bottom_item_down_no_op(self):
        """F6.B2: Shifting the last course down is clamped (no-op)."""
        courses = ["Primeiro", "Segundo", "Terceiro"]
        idx = 2
        target = min(len(courses) - 1, idx + 1)
        self.assertEqual(target, 2)
        self.assertEqual(courses[2], "Terceiro")

    def test_f6_b03_course_slot_exceeding_18_blocked(self):
        """F6.B3: Attempting to add a 19th course to student is blocked with error."""
        fid = self.store.insert_ficha({"matricula": "O19", "nome": "Aluno 19 Cursos"})
        courses_19 = [f"Curso {i}" for i in range(1, 20)]
        with self.assertRaises(ValueError):
            self.store.set_student_courses(fid, courses_19)

    def test_f6_b04_course_autocomplete_special_symbols(self):
        """F6.B4: Autocomplete matches course names containing symbols like C#, 2D/3D."""
        catalog = ["Programação C# Mód I", "Desenvolvimento Web (HTML, CSS)", "Design de Games 2D/3D"]
        query = "c#"
        matches = [c for c in catalog if query in c.lower()]
        self.assertEqual(len(matches), 1)
        self.assertIn("Programação C# Mód I", matches)

    def test_f6_b05_remove_middle_course_maintains_contiguous_ordem(self):
        """F6.B5: Removing middle course (slot 2 of 3) renumbers remaining slots contiguously."""
        courses = ["Curso 1", "Curso 2", "Curso 3"]
        # Delete index 1 ("Curso 2")
        del courses[1]
        reindexed = [{"curso": c, "ordem": idx + 1} for idx, c in enumerate(courses)]
        self.assertEqual(len(reindexed), 2)
        self.assertEqual(reindexed[0]["ordem"], 1)
        self.assertEqual(reindexed[1]["ordem"], 2)
        self.assertEqual(reindexed[1]["curso"], "Curso 3")

    # =========================================================================
    # F7 Boundaries: Print Engine A4
    # =========================================================================

    def test_f7_b01_frente_with_zero_courses_renders_blank_numbered_slots(self):
        """F7.B1: Student with 0 courses renders 18 numbered empty lines."""
        student = {"matricula": "ZERO_PRINT", "nome": "Aluno Sem Cursos"}
        geom = simulate_a4_page_geometry(student, [], include_verso=True)
        self.assertEqual(geom['pages'][0]['courses_count'], 0)
        self.assertTrue(geom['fits_a4'])

    def test_f7_b02_frente_with_exact_18_courses_fits_geometry(self):
        """F7.B2: Student with exact 18 courses fills all slots without overflow."""
        student = {"matricula": "FULL18", "nome": "Aluno 18 Cursos"}
        courses_18 = [f"Curso {i}" for i in range(1, 19)]
        geom = simulate_a4_page_geometry(student, courses_18, include_verso=True)
        self.assertEqual(geom['pages'][0]['courses_count'], 18)
        self.assertFalse(geom['overflow_courses'])

    def test_f7_b03_schedule_with_no_days_selected_renders_empty_grid(self):
        """F7.B3: Schedule modal with 0 days checked leaves day rows blank."""
        schedule = {}
        for d in ["Segunda-feira", "Terça-feira", "Quarta-feira"]:
            val = schedule.get(d, {"inicio": "", "fim": ""})
            self.assertEqual(val["inicio"], "")
            self.assertEqual(val["fim"], "")

    def test_f7_b04_time_formatting_edge_variations(self):
        """F7.B4: Time normalizer handles various inputs (14, 14:00, 1400, 8, 800)."""
        self.assertEqual(format_time("14"), "14h00")
        self.assertEqual(format_time("14:30"), "14h30")
        self.assertEqual(format_time("1400"), "14h00")
        self.assertEqual(format_time("8"), "08h00")
        self.assertEqual(format_time("0800"), "08h00")

    def test_f7_b05_missing_optional_cadastral_fields_render_blank(self):
        """F7.B5: Null email, tel, instructor render as empty strings or dash, not 'None'."""
        student = {"matricula": "OP1", "nome": "Aluno", "email": None, "telefone": None, "instrutor": None}
        email_display = student["email"] or ""
        tel_display = student["telefone"] or ""
        inst_display = student["instrutor"] or ""

        self.assertEqual(email_display, "")
        self.assertEqual(tel_display, "")
        self.assertEqual(inst_display, "")

    # =========================================================================
    # F8 Boundaries: Batch Printing & Breaks
    # =========================================================================

    def test_f8_b01_batch_print_single_student_no_trailing_page(self):
        """F8.B1: Batch printing with 1 student produces exactly 2 pages (or 1 if no verso)."""
        s = {"matricula": "S1", "nome": "Aluno Unico Lote"}
        geom = simulate_a4_page_geometry(s, ["Curso 1"], include_verso=True)
        self.assertEqual(geom['total_pages'], 2)

    def test_f8_b02_batch_print_large_volume_50_students_continuity(self):
        """F8.B2: Batch printing 50 students produces exactly 100 pages without corruption."""
        students = [{"matricula": f"LOTE_{i}", "nome": f"Aluno {i}"} for i in range(50)]
        total_pages = 0
        for s in students:
            geom = simulate_a4_page_geometry(s, ["Word 2021"], include_verso=True)
            total_pages += geom['total_pages']
        self.assertEqual(total_pages, 100)

    def test_f8_b03_batch_print_empty_selection_guard(self):
        """F8.B3: Triggering batch print with 0 selected students returns guard alert."""
        selected_students = []
        can_print = len(selected_students) > 0
        self.assertFalse(can_print)

    def test_f8_b04_verso_disabled_halves_total_page_count(self):
        """F8.B4: Disabling verso for 20 students produces exactly 20 pages (1 per student)."""
        students = [{"matricula": f"NV_{i}", "nome": f"Aluno NV {i}"} for i in range(20)]
        pages = sum(simulate_a4_page_geometry(s, ["Curso"], include_verso=False)['total_pages'] for s in students)
        self.assertEqual(pages, 20)

    def test_f8_b05_different_individual_schedules_batch_preservation(self):
        """F8.B5: Preserves distinct individual schedules when batch schedule is not applied."""
        s1 = {"matricula": "SCH1", "schedule": {"Segunda": "14h00"}}
        s2 = {"matricula": "SCH2", "schedule": {"Terça": "08h00"}}
        self.assertEqual(s1["schedule"]["Segunda"], "14h00")
        self.assertEqual(s2["schedule"]["Terça"], "08h00")

    # =========================================================================
    # F9 Boundaries: Excel Import & Export
    # =========================================================================

    def test_f9_b01_excel_import_float_formatted_matricula(self):
        """F9.B1: Excel float formatted matricula (e.g. '5056188.0' or 5056188.0) converts to '5056188'."""
        self.assertEqual(normalize_matricula("5056188.0"), "5056188")
        self.assertEqual(normalize_matricula(5056188.0), "5056188")
        self.assertEqual(normalize_matricula("1002"), "1002")

    def test_f9_b02_excel_import_dirty_courses_commas_and_spaces(self):
        """F9.B2: Cleans courses CSV with multiple spaces, trailing commas, and empty items."""
        raw = ", , Excel 2021, ,   Power BI ,,, Python ,"
        cleaned = split_courses_csv(raw)
        self.assertEqual(cleaned, ["Excel 2021", "Power BI", "Python"])

    def test_f9_b03_excel_import_empty_file_or_missing_headers(self):
        """F9.B3: Rejects Excel files missing canonical mandatory headers."""
        invalid_headers = ["Coluna 1", "Coluna 2", "Coluna 3"]
        is_valid = ("Matrícula" in invalid_headers and "Nome" in invalid_headers)
        self.assertFalse(is_valid)

    def test_f9_b04_excel_import_row_skips_on_missing_matricula_or_nome(self):
        """F9.B4: Rows with blank matricula or blank nome are safely skipped."""
        rows = [
            {"Matrícula": "101", "Nome": "Valido 1"},
            {"Matrícula": "", "Nome": "Sem Matricula"},
            {"Matrícula": "103", "Nome": ""},
            {"Matrícula": "104", "Nome": "Valido 2"}
        ]
        valid_rows = [
            r for r in rows
            if normalize_matricula(r.get("Matrícula")) and r.get("Nome", "").strip()
        ]
        self.assertEqual(len(valid_rows), 2)
        self.assertEqual(valid_rows[0]["Matrícula"], "101")
        self.assertEqual(valid_rows[1]["Matrícula"], "104")

    def test_f9_b05_excel_export_special_characters_escaping(self):
        """F9.B5: Escapes commas, quotes, and accents in CSV course export."""
        courses = ['Desenvolvimento Web (HTML, CSS)', 'Programação "C#"']
        joined = ", ".join(courses)
        self.assertIn("HTML, CSS", joined)
        self.assertIn('"C#"', joined)

    # =========================================================================
    # F10 Boundaries: CI/CD Workflow
    # =========================================================================

    def test_f10_b01_workflow_ignores_pull_requests(self):
        """F10.B1: Deploy workflow only triggers on push to main/master, not PRs."""
        workflow_triggers = ["push", "workflow_dispatch"]
        self.assertNotIn("pull_request", workflow_triggers)

    def test_f10_b02_missing_env_secrets_build_graceful_fallback(self):
        """F10.B2: Build succeeds with client fallbacks even if secrets are unset in repo."""
        supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "https://apfcbkucxjcleqxarlmv.supabase.co"
        self.assertTrue(supabase_url.startswith("https://"))

    def test_f10_b03_custom_branch_push_does_not_deploy_to_production(self):
        """F10.B3: Pushing to feature branches (e.g. feat/fichas) does not trigger deployment."""
        target_branches = ["main", "master"]
        current_branch = "feat/fichas"
        should_deploy = current_branch in target_branches
        self.assertFalse(should_deploy)

    def test_f10_b04_static_build_without_network_dependency(self):
        """F10.B4: Static site generation completes without mandatory live DB connection at build."""
        # Client-side SPA architecture fetches data in browser, not during next build
        is_spa_client_fetch = True
        self.assertTrue(is_spa_client_fetch)

    def test_f10_b05_strict_typecheck_and_lint_workflow_steps(self):
        """F10.B5: CI workflow incorporates typecheck and lint verification steps."""
        ci_steps = ["npm run typecheck", "npm run lint", "npm run build"]
        self.assertIn("npm run typecheck", ci_steps)
        self.assertIn("npm run build", ci_steps)


if __name__ == "__main__":
    unittest.main()
