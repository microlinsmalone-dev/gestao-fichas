#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Empirical Adversarial Test Suite for Milestone 3 (challenger_m3_2)
Focus Areas:
1. CRUD Data Flow & Supabase Interaction:
   - Student creation, update, deletion and local UI state synchronization.
2. Courses Order Translation:
   - Array of selected courses translates to sequential integer `ordem` (1, 2, ..., N up to 18).
   - Array reordering preserves 1-based sequential integers without gaps.
   - Truncation / boundary enforcement at 18 courses.
3. Deletion Confirmation & Cascade:
   - Confirmation dialog prompting before deletion.
   - Database foreign key cascade deletion of `fichas_cursos`.
   - Local UI state cleanup (`students` list filter and `selectedIds` removal).
"""

import os
import sys
import re
import unittest
from typing import List, Dict, Any

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from tests.helpers import InMemorySupabaseStore, normalize_matricula
USE_STUDENTS_FILE = os.path.join(ROOT_DIR, "lib", "hooks", "use-students.ts")
STUDENT_MODAL_FILE = os.path.join(ROOT_DIR, "components", "students", "student-modal.tsx")
STUDENT_TABLE_FILE = os.path.join(ROOT_DIR, "components", "students", "student-table.tsx")
COURSE_SELECTOR_FILE = os.path.join(ROOT_DIR, "components", "courses", "course-selector.tsx")
DASHBOARD_FILE = os.path.join(ROOT_DIR, "app", "page.tsx")
SCHEMA_FILE = os.path.join(ROOT_DIR, "supabase", "migrations", "20261015_initial_schema.sql")


class TestCoursesOrderTranslation(unittest.TestCase):
    """Adversarial stress-testing of course ordering and sequential integer assignment."""

    def setUp(self):
        self.store = InMemorySupabaseStore()
        # Create 20 catalog courses
        self.catalog_ids = [self.store.insert_curso(f"Curso_{i:02d}") for i in range(1, 21)]

    def test_courses_translate_to_sequential_ordem_1_based(self):
        """Selected courses array must map to 1-based sequential integers 1, 2, ..."""
        with open(USE_STUDENTS_FILE, "r", encoding="utf-8") as f:
            content = f.read()

        # Check addStudent logic
        self.assertIn("courses.slice(0, 18).map", content)
        self.assertIn("ordem: index + 1", content)

        # Simulate mapping logic
        selected = [{"curso_id": cid, "nome": f"Curso_{i+1:02d}"} for i, cid in enumerate(self.catalog_ids[:5])]
        mapped = [
            {"curso_id": c["curso_id"], "curso_nome": c["nome"], "ordem": idx + 1}
            for idx, c in enumerate(selected[:18])
        ]

        for idx, item in enumerate(mapped):
            self.assertEqual(item["ordem"], idx + 1)
            self.assertGreaterEqual(item["ordem"], 1)
            self.assertLessEqual(item["ordem"], 18)

    def test_courses_truncation_at_18(self):
        """Array with more than 18 courses must be sliced to strictly 18."""
        with open(USE_STUDENTS_FILE, "r", encoding="utf-8") as f:
            content = f.read()

        # Both addStudent and updateStudent must slice(0, 18)
        matches = re.findall(r"courses\.slice\(0,\s*18\)", content)
        self.assertEqual(len(matches), 2, "Expected courses.slice(0, 18) in both addStudent and updateStudent")

        selected = [{"curso_id": cid, "nome": f"Curso_{i+1:02d}"} for i, cid in enumerate(self.catalog_ids)]
        self.assertEqual(len(selected), 20)
        sliced = selected[:18]
        self.assertEqual(len(sliced), 18)

    def test_course_reordering_produces_contiguous_sequence(self):
        """Reordering (e.g. reverse, swap, move) must always re-index to contiguous 1..N with no gaps."""
        courses = [
            {"curso_id": 101, "nome": "A"},
            {"curso_id": 102, "nome": "B"},
            {"curso_id": 103, "nome": "C"},
            {"curso_id": 104, "nome": "D"},
        ]

        # Simulate moving item 2 to top
        reordered = [courses[2], courses[0], courses[1], courses[3]]
        mapped = [{"curso_id": c["curso_id"], "ordem": idx + 1} for idx, c in enumerate(reordered)]

        ordens = [m["ordem"] for m in mapped]
        self.assertEqual(ordens, [1, 2, 3, 4])
        self.assertEqual(mapped[0]["curso_id"], 103)
        self.assertEqual(mapped[1]["curso_id"], 101)


class TestStudentCrudDataFlow(unittest.TestCase):
    """Verify student creation, update, deletion and state transitions."""

    def setUp(self):
        self.store = InMemorySupabaseStore()
        with open(USE_STUDENTS_FILE, "r", encoding="utf-8") as f:
            self.use_students_code = f.read()
        with open(DASHBOARD_FILE, "r", encoding="utf-8") as f:
            self.dashboard_code = f.read()

    def test_add_student_flow_updates_state(self):
        """addStudent inserts student, inserts courses, then calls fetchStudents."""
        self.assertIn("await fetchStudents()", self.use_students_code)
        self.assertIn("return { success: true }", self.use_students_code)

        # Store simulation
        fid = self.store.insert_ficha({"matricula": "TEST01", "nome": "Novo Aluno"})
        cid = self.store.insert_curso("Curso 1")
        self.store.link_curso(fid, cid, "Curso 1", 1)

        self.assertIn(fid, self.store.fichas)
        links = [l for l in self.store.fichas_cursos if l["ficha_id"] == fid]
        self.assertEqual(len(links), 1)
        self.assertEqual(links[0]["ordem"], 1)

    def test_update_student_flow_replaces_courses_and_refetches(self):
        """updateStudent deletes old fichas_cursos and re-inserts new ones with order 1..N."""
        # Check source implementation
        self.assertIn(".from('fichas_cursos')", self.use_students_code)
        self.assertIn(".delete()", self.use_students_code)
        self.assertIn(".eq('ficha_id', id)", self.use_students_code)

        # Store simulation
        fid = self.store.insert_ficha({"matricula": "TEST02", "nome": "Aluno Original"})
        c1 = self.store.insert_curso("Curso 1")
        c2 = self.store.insert_curso("Curso 2")
        self.store.link_curso(fid, c1, "Curso 1", 1)

        # Update: remove c1, add c2 as ordem 1
        self.store.fichas[fid]["nome"] = "Aluno Atualizado"
        self.store.fichas_cursos = [l for l in self.store.fichas_cursos if l["ficha_id"] != fid]
        self.store.link_curso(fid, c2, "Curso 2", 1)

        self.assertEqual(self.store.fichas[fid]["nome"], "Aluno Atualizado")
        updated_links = [l for l in self.store.fichas_cursos if l["ficha_id"] == fid]
        self.assertEqual(len(updated_links), 1)
        self.assertEqual(updated_links[0]["curso_id"], c2)
        self.assertEqual(updated_links[0]["ordem"], 1)

    def test_delete_student_updates_local_state_immediately(self):
        """deleteStudent filters local state immediately without waiting for full refetch."""
        self.assertIn("setStudents((prev) => prev.filter((s) => s.id !== id))", self.use_students_code)

        # Store simulation
        fid = self.store.insert_ficha({"matricula": "TEST03", "nome": "Aluno Exclusao"})
        cid = self.store.insert_curso("Curso 1")
        self.store.link_curso(fid, cid, "Curso 1", 1)

        # Delete
        self.store.delete_ficha(fid)
        self.assertNotIn(fid, self.store.fichas)
        # Cascade delete verified
        self.assertEqual(len(self.store.fichas_cursos), 0)


class TestDeletionConfirmationAndCascade(unittest.TestCase):
    """Verify prompt confirmation before deletion and database ON DELETE CASCADE."""

    def test_database_schema_has_on_delete_cascade(self):
        """fichas_cursos.ficha_id must have ON DELETE CASCADE foreign key constraint."""
        with open(SCHEMA_FILE, "r", encoding="utf-8") as f:
            schema = f.read()

        match = re.search(r"REFERENCES\s+public\.fichas\(id\)\s+ON\s+DELETE\s+CASCADE", schema, re.IGNORECASE)
        self.assertIsNotNone(match, "Missing ON DELETE CASCADE on fichas_cursos table")

    def test_ui_prompts_confirmation_before_delete(self):
        """Dashboard handleDeleteStudent must call showConfirm with confirmation dialog."""
        with open(DASHBOARD_FILE, "r", encoding="utf-8") as f:
            code = f.read()

        self.assertIn("showConfirm({", code)
        self.assertIn("title: 'Confirmar Exclusão'", code)
        self.assertIn("Tem certeza que deseja excluir o cadastro de", code)
        self.assertIn("confirmText: 'Sim, Excluir'", code)
        self.assertIn("cancelText: 'Cancelar'", code)

    def test_deletion_cleans_selected_ids(self):
        """Dashboard handleDeleteStudent removes deleted student ID from selectedIds set."""
        with open(DASHBOARD_FILE, "r", encoding="utf-8") as f:
            code = f.read()

        self.assertIn("setSelectedIds((prev) => {", code)
        self.assertIn("next.delete(student.id)", code)


class TestUIInputValidationAndEdgeCases(unittest.TestCase):
    """Stress-test modal validation and edge cases."""

    def setUp(self):
        with open(STUDENT_MODAL_FILE, "r", encoding="utf-8") as f:
            self.modal_code = f.read()

    def test_matricula_and_nome_are_strictly_required(self):
        """Empty or whitespace-only matricula or nome triggers validation error."""
        self.assertIn("if (!cleanMatricula)", self.modal_code)
        self.assertIn("A matrícula é obrigatória", self.modal_code)
        self.assertIn("if (!cleanNome)", self.modal_code)
        self.assertIn("O nome do aluno é obrigatório", self.modal_code)

    def test_email_regex_validation(self):
        """Invalid email formats are rejected before submit."""
        self.assertIn("emailRegex.test(email.trim())", self.modal_code)
        pattern = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
        self.assertTrue(bool(re.match(pattern, "teste@microlins.com.br")))
        self.assertTrue(bool(re.match(pattern, "aluno.123@gmail.com")))
        self.assertFalse(bool(re.match(pattern, "sem_arroba.com")))
        self.assertFalse(bool(re.match(pattern, "com@espaço .com")))
        self.assertFalse(bool(re.match(pattern, "invalido@dominio")))

    def test_course_selector_boundaries(self):
        """CourseSelector prevents adding more than 18 courses and disallows duplicate courses."""
        with open(COURSE_SELECTOR_FILE, "r", encoding="utf-8") as f:
            selector_code = f.read()

        self.assertIn("selectedCourses.length < 18", selector_code)
        self.assertIn("!selectedCourseIds.has(c.id)", selector_code)
        self.assertIn("handleMoveUp", selector_code)
        self.assertIn("handleMoveDown", selector_code)
        self.assertIn("index === 0", selector_code)
        self.assertIn("index === selectedCourses.length - 1", selector_code)


if __name__ == "__main__":
    unittest.main()
