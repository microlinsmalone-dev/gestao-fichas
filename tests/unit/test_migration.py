#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Testes Unitários para a Lógica de Migração e Normalização de Dados (Milestone 1)
Arquivo: tests/unit/test_migration.py
"""

import os
import sys
import unittest
from datetime import datetime

# Adicionar supabase/ ao sys.path para importar migrate_sqlite
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SUPABASE_DIR = os.path.join(ROOT_DIR, "supabase")
if SUPABASE_DIR not in sys.path:
    sys.path.insert(0, SUPABASE_DIR)

from migrate_sqlite import (
    DEFAULT_SQLITE_PATH,
    normalize_date,
    extract_legacy_data,
    generate_sql_inserts,
)


class TestDateNormalization(unittest.TestCase):
    """Testes rigorosos para a função de normalização de datas."""

    def test_excel_serial_integers(self):
        """Valida a conversão de números seriais inteiros do Excel baseados em 30/12/1899."""
        # 41591 = 13 de Novembro de 2013
        self.assertEqual(normalize_date(41591), "2013-11-13")
        self.assertEqual(normalize_date("41591"), "2013-11-13")
        # 41100 = 10 de Julho de 2012
        self.assertEqual(normalize_date(41100), "2012-07-10")
        # 30765 = 24 de Março de 1984
        self.assertEqual(normalize_date(30765), "1984-03-24")

    def test_brazilian_4digit_years(self):
        """Valida o padrão brasileiro DD/MM/AAAA."""
        self.assertEqual(normalize_date("02/12/2025"), "2025-12-02")
        self.assertEqual(normalize_date("28/09/2013"), "2013-09-28")
        self.assertEqual(normalize_date("1/5/2024"), "2024-05-01")

    def test_brazilian_2digit_years(self):
        """Valida expansão de anos com 2 dígitos (<= 50 vira 20YY, > 50 vira 19YY)."""
        self.assertEqual(normalize_date("28/02/26"), "2026-02-28")
        self.assertEqual(normalize_date("26/11/25"), "2025-11-26")
        self.assertEqual(normalize_date("15/08/95"), "1995-08-15")

    def test_iso_dates_and_timestamps(self):
        """Valida formato ISO com e sem horas."""
        self.assertEqual(normalize_date("2026-03-05"), "2026-03-05")
        self.assertEqual(normalize_date("2027-08-24 00:00:00"), "2027-08-24")

    def test_masked_inverted_dates(self):
        """Valida o caso de borda específico onde YYYYMMDD foi digitado numa máscara DD/MM/AAAA."""
        # 20270728 digitado na máscara vira 20/27/0728
        self.assertEqual(normalize_date("20/27/0728"), "2027-07-28")
        # 20270301 digitado na máscara vira 20/27/0301
        self.assertEqual(normalize_date("20/27/0301"), "2027-03-01")

    def test_empty_and_null_values(self):
        """Valida que valores vazios ou nulos retornam None sem lançar exceção."""
        self.assertIsNone(normalize_date(None))
        self.assertIsNone(normalize_date(""))
        self.assertIsNone(normalize_date("   "))
        self.assertIsNone(normalize_date("none"))
        self.assertIsNone(normalize_date("NULL"))
        self.assertIsNone(normalize_date("nan"))

    def test_invalid_calendar_dates_raise_error(self):
        """Valida que datas impossíveis no calendário gregoriano lançam ValueError."""
        with self.assertRaises(ValueError):
            normalize_date("31/02/2025")
        with self.assertRaises(ValueError):
            normalize_date("texto_aleatorio")


class TestLegacyDatabaseExtraction(unittest.TestCase):
    """Testes de integridade da extração sobre a base de produção SQLite."""

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(DEFAULT_SQLITE_PATH):
            raise unittest.SkipTest(f"Banco SQLite não encontrado em {DEFAULT_SQLITE_PATH}")
        cls.data = extract_legacy_data(DEFAULT_SQLITE_PATH)

    def test_exact_student_count(self):
        """Garante que exatamente 280 alunos foram extraídos."""
        self.assertEqual(len(self.data["fichas"]), 280)

    def test_exact_unified_course_count(self):
        """Garante que exatamente 105 cursos unificados constam no catálogo."""
        self.assertEqual(len(self.data["cursos"]), 105)

    def test_exact_enrollment_links_count(self):
        """Garante que exatamente 717 vínculos aluno-curso foram gerados."""
        self.assertEqual(len(self.data["fichas_cursos"]), 717)

    def test_orphaned_courses_presence(self):
        """Garante que os 4 cursos órfãos foram integrados ao catálogo de cursos."""
        catalogo = {c["nome"] for c in self.data["cursos"]}
        for orfao in ["Assistente Administrativo", "Design Gráfico", "Inglês Avançado", "Inglês Básico"]:
            self.assertIn(orfao, catalogo, f"Curso órfão {orfao} ausente no catálogo")

    def test_enrollment_order_sequential_and_within_bounds(self):
        """Garante que a ordem didática é sequencial de 1 a N e nunca excede 18."""
        by_student = {}
        for fc in self.data["fichas_cursos"]:
            by_student.setdefault(fc["ficha_id"], []).append(fc["ordem"])

        for fid, orders in by_student.items():
            self.assertEqual(orders, list(range(1, len(orders) + 1)), f"Ordem não sequencial no aluno {fid}")
            self.assertLessEqual(max(orders), 18, f"Aluno {fid} excedeu 18 cursos")

    def test_unique_matriculas(self):
        """Garante que todas as 280 matrículas são 100% únicas e não vazias."""
        mats = [f["matricula"] for f in self.data["fichas"]]
        self.assertEqual(len(mats), 280)
        self.assertEqual(len(set(mats)), 280)
        for m in mats:
            self.assertTrue(m and m.strip())

    def test_sql_inserts_generation(self):
        """Garante que o gerador de SQL produz um script sintaticamente robusto."""
        sql = generate_sql_inserts(self.data)
        self.assertIn("INSERT INTO public.cursos", sql)
        self.assertIn("INSERT INTO public.fichas", sql)
        self.assertIn("INSERT INTO public.fichas_cursos", sql)
        self.assertIn("COMMIT;", sql)


if __name__ == "__main__":
    unittest.main()
