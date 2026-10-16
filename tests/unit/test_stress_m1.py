#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Adversarial Stress Test Suite for Milestone 1: Database Schema & Migration
Author: challenger_m1_2 (Empirical Challenger)
Project: SistemaFichas_Web
"""

import os
import sys
import re
import json
import sqlite3
import unittest
from datetime import datetime, timedelta

# Ensure UTF-8 output
if sys.platform.startswith("win"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SUPABASE_DIR = os.path.join(ROOT_DIR, "supabase")
if SUPABASE_DIR not in sys.path:
    sys.path.insert(0, SUPABASE_DIR)

from migrate_sqlite import (
    DEFAULT_SQLITE_PATH,
    DATE_COLUMNS,
    extract_legacy_data,
    normalize_date,
    generate_sql_inserts,
)


class TestAdversarialLegacyCenso(unittest.TestCase):
    """Auditoria forense direta no arquivo SQLite original (sem intermediários)."""

    @classmethod
    def setUpClass(cls):
        cls.db_path = DEFAULT_SQLITE_PATH
        if not os.path.exists(cls.db_path):
            raise unittest.SkipTest(f"SQLite DB not found: {cls.db_path}")
        uri = f"file:///{os.path.abspath(cls.db_path).replace(os.sep, '/')}?mode=ro"
        cls.conn = sqlite3.connect(uri, uri=True)
        cls.conn.row_factory = sqlite3.Row
        cls.extracted = extract_legacy_data(cls.db_path)

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "conn"):
            cls.conn.close()

    def test_01_fichas_census_and_primary_keys(self):
        """Verifica se há exatamente 280 fichas, com IDs contíguos de 1 a 280."""
        cur = self.conn.cursor()
        rows = cur.execute("SELECT id, matricula, nome FROM fichas ORDER BY id").fetchall()
        self.assertEqual(len(rows), 280, "Tabela fichas deve ter exatamente 280 registros")
        ids = [r["id"] for r in rows]
        self.assertEqual(ids, list(range(1, 281)), "IDs devem ser estritamente contíguos de 1 a 280")
        
        # Unicidade e não-vazio de matrículas
        mats = [str(r["matricula"]).strip() for r in rows]
        self.assertEqual(len(set(mats)), 280, "Todas as 280 matrículas devem ser únicas")
        for m in mats:
            self.assertTrue(len(m) > 0, "Nenhuma matrícula pode ser vazia")
            self.assertFalse(m.endswith(".0"), f"Matrícula não deve ter sufixo float: {m}")

        # Nomes não-vazios
        nomes = [str(r["nome"]).strip() for r in rows]
        for n in nomes:
            self.assertTrue(len(n) > 0, "Nenhum nome de aluno pode ser vazio")

    def test_02_cursos_census(self):
        """Verifica a tabela cursos: exatamente 101 cursos legados."""
        cur = self.conn.cursor()
        rows = cur.execute("SELECT id, nome FROM cursos ORDER BY id").fetchall()
        self.assertEqual(len(rows), 101, "Tabela cursos legada deve ter exatamente 101 registros")
        names = [r["nome"].strip() for r in rows if r["nome"]]
        self.assertEqual(len(names), 101, "Todos os 101 cursos devem ter nomes válidos")
        self.assertEqual(len(set(names)), 101, "Todos os 101 cursos no catálogo legado devem ser únicos")

    def test_03_fichas_cursos_and_orphaned_courses(self):
        """Verifica fichas_cursos: 717 vínculos, 4 cursos órfãos, união totalizando 105 cursos."""
        cur = self.conn.cursor()
        fc_rows = cur.execute("SELECT rowid, ficha_id, curso_nome FROM fichas_cursos ORDER BY ficha_id, rowid").fetchall()
        self.assertEqual(len(fc_rows), 717, "Tabela fichas_cursos deve ter exatamente 717 vínculos")

        # Verificar integridade referencial com fichas
        cur_fichas_ids = {r[0] for r in cur.execute("SELECT id FROM fichas").fetchall()}
        for fc in fc_rows:
            self.assertIn(fc["ficha_id"], cur_fichas_ids, f"Vínculo referencia ficha_id inexistente: {fc['ficha_id']}")

        # Identificar cursos órfãos
        cur_cursos_names = {r[0].strip() for r in cur.execute("SELECT nome FROM cursos").fetchall()}
        fc_course_names = {r["curso_nome"].strip() for r in fc_rows if r["curso_nome"]}
        
        orphaned = fc_course_names - cur_cursos_names
        expected_orphans = {"Assistente Administrativo", "Design Gráfico", "Inglês Avançado", "Inglês Básico"}
        self.assertEqual(orphaned, expected_orphans, "Cursos órfãos devem ser exatamente os 4 esperados")

        unified = cur_cursos_names | fc_course_names
        self.assertEqual(len(unified), 105, "União de cursos deve ter exatamente 105 cursos distintos")

    def test_04_max_courses_per_student_and_empty_students(self):
        """Verifica a distribuição de cursos por aluno: max 15 (aluno 124) e 188 alunos com 0 cursos."""
        cur = self.conn.cursor()
        counts = cur.execute(
            "SELECT ficha_id, count(*) as cnt FROM fichas_cursos GROUP BY ficha_id ORDER BY cnt DESC"
        ).fetchall()
        
        self.assertEqual(len(counts), 92, "Exatamente 92 alunos devem possuir vínculos em fichas_cursos")
        max_student_id, max_count = counts[0]["ficha_id"], counts[0]["cnt"]
        self.assertEqual(max_student_id, 124, "Aluno com mais cursos deve ser ID 124")
        self.assertEqual(max_count, 15, "Aluno ID 124 deve ter exatamente 15 cursos")
        self.assertLessEqual(max_count, 18, "Nenhum aluno pode exceder 18 cursos (limite da ficha A4)")

        # Alunos sem cursos: 280 - 92 = 188
        student_with_courses = {c["ficha_id"] for c in counts}
        all_students = {r[0] for r in cur.execute("SELECT id FROM fichas").fetchall()}
        empty_students = all_students - student_with_courses
        self.assertEqual(len(empty_students), 188, "Exatamente 188 alunos devem ter 0 cursos vinculados")
        self.assertIn(143, empty_students, "Aluno 143 deve ser um dos alunos sem cursos")

    def test_05_duplicate_courses_per_student(self):
        """Verifica se há algum aluno cadastrado no mesmo curso mais de uma vez no SQLite."""
        cur = self.conn.cursor()
        dups = cur.execute("""
            SELECT ficha_id, curso_nome, count(*) as cnt 
            FROM fichas_cursos 
            GROUP BY ficha_id, curso_nome 
            HAVING cnt > 1
        """).fetchall()
        # Verificar se há duplicatas e documentar
        # Se houver, a migração com ordem sequencial (rowid) ainda assim preserva a ordem didática
        print(f"\n[INFO ADVERSARIAL] Alunos com cursos repetidos em fichas_cursos: {len(dups)}")
        for d in dups:
            print(f"  Aluno {d['ficha_id']}: Curso '{d['curso_nome']}' repetido {d['cnt']} vezes")

    def test_06_field_by_field_extraction_parity(self):
        """Verifica a paridade campo a campo entre o SQLite bruto e os dados extraídos."""
        cur = self.conn.cursor()
        fichas_raw = {r["id"]: dict(r) for r in cur.execute("SELECT * FROM fichas").fetchall()}
        extracted_fichas = {f["id"]: f for f in self.extracted["fichas"]}

        self.assertEqual(len(extracted_fichas), 280)
        for fid, raw in fichas_raw.items():
            ext = extracted_fichas[fid]
            self.assertEqual(str(raw["matricula"]).strip(), ext["matricula"])
            self.assertEqual(str(raw["nome"]).strip(), ext["nome"])
            
            # Checar strings
            raw_email = raw["email"].strip() if raw["email"] else None
            self.assertEqual(raw_email, ext["email"])
            raw_tel = raw["telefone"].strip() if raw["telefone"] else None
            self.assertEqual(raw_tel, ext["telefone"])
            raw_instr = raw["instrutor"].strip() if raw["instrutor"] else None
            self.assertEqual(raw_instr, ext["instrutor"])


class TestAdversarialDates(unittest.TestCase):
    """Stress tests para o motor de normalização de datas e auditoria de todas as datas do banco."""

    @classmethod
    def setUpClass(cls):
        cls.db_path = DEFAULT_SQLITE_PATH
        uri = f"file:///{os.path.abspath(cls.db_path).replace(os.sep, '/')}?mode=ro"
        cls.conn = sqlite3.connect(uri, uri=True)
        cls.conn.row_factory = sqlite3.Row

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def test_01_all_877_dates_in_production_db(self):
        """Varre todas as 2800 células de datas no banco SQLite e valida que 877 são válidas."""
        cur = self.conn.cursor()
        rows = cur.execute("SELECT * FROM fichas").fetchall()

        total_dates = 0
        converted_dates = 0
        min_date = datetime(2999, 1, 1)
        max_date = datetime(1900, 1, 1)

        for row in rows:
            for col in DATE_COLUMNS:
                val = row[col]
                if val is not None and str(val).strip() and str(val).strip().lower() not in ("none", "null", ""):
                    total_dates += 1
                    norm = normalize_date(val)
                    self.assertIsNotNone(norm, f"Data não deveria ser None: row={row['id']} col={col} val={val}")
                    # Validar padrão YYYY-MM-DD
                    self.assertTrue(re.match(r"^\d{4}-\d{2}-\d{2}$", norm), f"Formato inválido: {norm}")
                    # Validar data no calendário real
                    dt = datetime.strptime(norm, "%Y-%m-%d")
                    if dt < min_date:
                        min_date = dt
                    if dt > max_date:
                        max_date = dt
                    converted_dates += 1

        self.assertEqual(total_dates, 877, "Exatamente 877 datas devem existir no banco SQLite")
        self.assertEqual(converted_dates, 877, "Todas as 877 datas devem ser convertidas sem erro")
        print(f"\n[INFO ADVERSARIAL] Intervalo de datas no SQLite: {min_date.strftime('%Y-%m-%d')} até {max_date.strftime('%Y-%m-%d')}")
        self.assertGreaterEqual(min_date.year, 1950, "Data mínima deve ser plausível (>= 1950)")
        self.assertLessEqual(max_date.year, 2035, "Data máxima deve ser plausível (<= 2035)")

    def test_02_excel_serial_boundaries(self):
        """Testa seriais Excel de borda e cálculos de calendário."""
        # 41591 -> 2013-11-13
        self.assertEqual(normalize_date(41591), "2013-11-13")
        self.assertEqual(normalize_date("41591"), "2013-11-13")
        # 45000 -> 2023-03-15
        self.assertEqual(normalize_date(45000), "2023-03-15")
        # 30000 -> 1982-02-18
        self.assertEqual(normalize_date(30000), "1982-02-18")
        # Float serial que pode ter vindo de planilha Excel: '41591.0'
        # Nota: o banco SQLite pode conter seriais como int ou string.

    def test_03_invalid_and_adversarial_dates(self):
        """Testa valores maliciosos ou corruptos para garantir falha graciosa ou erro explícito."""
        # Dias inválidos
        with self.assertRaises(ValueError):
            normalize_date("31/02/2024")
        with self.assertRaises(ValueError):
            normalize_date("29/02/2023")  # Não é bissexto
        with self.assertRaises(ValueError):
            normalize_date("31/04/2024")  # Abril tem 30 dias

        # Injeção de texto ou SQL
        with self.assertRaises(ValueError):
            normalize_date("'; DROP TABLE fichas; --")
        with self.assertRaises(ValueError):
            normalize_date("<script>alert(1)</script>")
        with self.assertRaises(ValueError):
            normalize_date("2025-99-99")

        # Nulos e vazios
        self.assertIsNone(normalize_date(None))
        self.assertIsNone(normalize_date(""))
        self.assertIsNone(normalize_date("   "))
        self.assertIsNone(normalize_date("none"))
        self.assertIsNone(normalize_date("null"))
        self.assertIsNone(normalize_date("NaN"))


class TestAdversarialSqlInjection(unittest.TestCase):
    """Stress tests para injeção de SQL e robustez da geração de comandos INSERT."""

    def test_01_single_quotes_and_special_characters(self):
        """Verifica se aspas simples em nomes de alunos e cursos são escapadas corretamente."""
        malicious_data = {
            "metadata": {"extracted_at": "2026-10-15T12:00:00Z"},
            "cursos": [
                {"id": 1, "nome": "Curso D'Água & Arte", "descricao": "Teste d'ouro", "ativo": True},
                {"id": 2, "nome": "SQL'; DROP TABLE cursos; --", "descricao": None, "ativo": False},
            ],
            "fichas": [
                {
                    "id": 1,
                    "matricula": "M'1001",
                    "nome": "João D'Arc Silva",
                    "email": "joao.d'arc@example.com",
                    "data_nascimento": "2000-01-01",
                    "telefone": "17 99999-9999",
                    "instrutor": "Prof. O'Connor",
                    "data_inicio_curso": "2025-01-01",
                    "data_termino_curso": "2025-12-31",
                    "data_linha_vida": None,
                    "data_form1": None,
                    "data_form2": None,
                    "data_dreamday": None,
                    "data_fechamento1": None,
                    "data_fechamento2": None,
                    "data_fechamento3": None,
                    "unit_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
                    "created_at": "2026-10-15T12:00:00Z",
                    "updated_at": "2026-10-15T12:00:00Z",
                },
                {
                    "id": 2,
                    "matricula": "M'1002'); DROP TABLE fichas; --",
                    "nome": "Robert'); DROP TABLE fichas; --",
                    "email": None,
                    "data_nascimento": None,
                    "telefone": None,
                    "instrutor": None,
                    "data_inicio_curso": None,
                    "data_termino_curso": None,
                    "data_linha_vida": None,
                    "data_form1": None,
                    "data_form2": None,
                    "data_dreamday": None,
                    "data_fechamento1": None,
                    "data_fechamento2": None,
                    "data_fechamento3": None,
                    "unit_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
                    "created_at": "2026-10-15T12:00:00Z",
                    "updated_at": "2026-10-15T12:00:00Z",
                }
            ],
            "fichas_cursos": [
                {
                    "id": 1,
                    "ficha_id": 1,
                    "curso_id": 1,
                    "curso_nome": "Curso D'Água & Arte",
                    "ordem": 1,
                }
            ]
        }

        sql = generate_sql_inserts(malicious_data)
        
        # O nome do curso deve ser escapado como 'Curso D''Água & Arte'
        self.assertIn("'Curso D''Água & Arte'", sql)
        # O payload com DROP TABLE deve ser neutralizado como 'SQL''; DROP TABLE cursos; --'
        self.assertIn("'SQL''; DROP TABLE cursos; --'", sql)
        # O nome do aluno deve ser escapado como 'João D''Arc Silva'
        self.assertIn("'João D''Arc Silva'", sql)
        self.assertIn("'Robert''); DROP TABLE fichas; --'", sql)

        # Não deve haver nenhuma ocorrência de `DROP TABLE` fora de literais de string com aspas duplas de escape
        # Verificar que não há quebra de instrução SQL
        lines = [line.strip() for line in sql.split("\n") if line.strip() and not line.strip().startswith("--")]
        for line in lines:
            if line.startswith("INSERT INTO"):
                # Deve terminar com ponto e vírgula
                self.assertTrue(line.endswith(";"), f"Linha SQL não termina com ';': {line}")
                # Não deve conter ponto e vírgula solto desprotegido no meio da instrução
                # Apenas aspas simples fechadas

    def test_02_production_sql_inserts_syntax_integrity(self):
        """Verifica a integridade do script SQL de carga real gerado para produção."""
        sql_path = os.path.join(SUPABASE_DIR, "migration_inserts.sql")
        self.assertTrue(os.path.isfile(sql_path), f"Arquivo não encontrado: {sql_path}")
        
        with open(sql_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Verificar blocos obrigatórios
        self.assertIn("BEGIN;", content)
        self.assertIn("COMMIT;", content)
        self.assertIn("INSERT INTO public.cursos", content)
        self.assertIn("INSERT INTO public.fichas", content)
        self.assertIn("INSERT INTO public.fichas_cursos", content)
        self.assertIn("SELECT setval(pg_get_serial_sequence('public.cursos', 'id')", content)
        self.assertIn("SELECT setval(pg_get_serial_sequence('public.fichas', 'id')", content)
        self.assertIn("SELECT setval(pg_get_serial_sequence('public.fichas_cursos', 'id')", content)

        # Contar inserts de cada tabela
        cursos_inserts = len(re.findall(r"INSERT INTO public\.cursos\b", content))
        fichas_inserts = len(re.findall(r"INSERT INTO public\.fichas\b", content))
        fc_inserts = len(re.findall(r"INSERT INTO public\.fichas_cursos\b", content))

        self.assertEqual(cursos_inserts, 105, "Devem haver exatamente 105 INSERTs de cursos")
        self.assertEqual(fichas_inserts, 280, "Devem haver exatamente 280 INSERTs de fichas")
        self.assertEqual(fc_inserts, 717, "Devem haver exatamente 717 INSERTs de fichas_cursos")

        # Verificar aspas desbalanceadas nas linhas
        for idx, line in enumerate(content.split("\n"), 1):
            s = line.strip()
            if not s or s.startswith("--") or s in ("BEGIN;", "COMMIT;"):
                continue
            # Contar aspas simples na linha (em SQL padrão, aspas escapadas são duas simples '')
            # O número total de aspas simples numa linha com literais fechados deve ser PAR
            single_quotes = s.count("'")
            self.assertEqual(single_quotes % 2, 0, f"Linha {idx} possui aspas simples desbalanceadas (ímpar={single_quotes}): {s}")


class TestAdversarialIdempotencyAndConstraints(unittest.TestCase):
    """Stress tests de idempotência, simulação de re-execução e restrições relacionais."""

    def test_01_on_conflict_clauses(self):
        """Verifica se todos os comandos INSERT contêm cláusulas ON CONFLICT apropriadas."""
        sql_path = os.path.join(SUPABASE_DIR, "migration_inserts.sql")
        with open(sql_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        curso_conflicts = 0
        ficha_conflicts = 0
        fc_conflicts = 0

        for line in lines:
            if "INSERT INTO public.cursos" in line:
                self.assertIn("ON CONFLICT (nome) DO UPDATE SET updated_at = NOW();", line)
                curso_conflicts += 1
            elif "INSERT INTO public.fichas " in line:
                self.assertIn("ON CONFLICT (matricula) DO UPDATE SET", line)
                ficha_conflicts += 1
            elif "INSERT INTO public.fichas_cursos" in line:
                self.assertIn("ON CONFLICT (ficha_id, ordem) DO UPDATE SET", line)
                fc_conflicts += 1

        self.assertEqual(curso_conflicts, 105)
        self.assertEqual(ficha_conflicts, 280)
        self.assertEqual(fc_conflicts, 717)

    def test_02_schema_ddl_constraints(self):
        """Verifica se o DDL em 20261015_initial_schema.sql define todas as regras requeridas."""
        schema_path = os.path.join(SUPABASE_DIR, "migrations", "20261015_initial_schema.sql")
        self.assertTrue(os.path.isfile(schema_path))
        
        with open(schema_path, "r", encoding="utf-8") as f:
            ddl = f.read()

        # Tabelas
        self.assertIn("CREATE TABLE IF NOT EXISTS public.cursos", ddl)
        self.assertIn("CREATE TABLE IF NOT EXISTS public.fichas", ddl)
        self.assertIn("CREATE TABLE IF NOT EXISTS public.fichas_cursos", ddl)

        # Chaves primárias Identity
        self.assertIn("id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY", ddl)

        # Constraints essenciais
        self.assertIn("CONSTRAINT cursos_nome_unique UNIQUE (nome)", ddl)
        self.assertIn("CONSTRAINT fichas_matricula_unique UNIQUE (matricula)", ddl)
        self.assertIn("CONSTRAINT fichas_cursos_ficha_ordem_unique UNIQUE (ficha_id, ordem)", ddl)
        self.assertIn("ordem INTEGER NOT NULL CHECK (ordem >= 1 AND ordem <= 18)", ddl)

        # Chaves estrangeiras
        self.assertIn("REFERENCES public.fichas(id) ON DELETE CASCADE", ddl)
        self.assertIn("REFERENCES public.cursos(id) ON DELETE RESTRICT", ddl)

        # RLS Policies
        self.assertIn("ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;", ddl)
        self.assertIn("ALTER TABLE public.fichas ENABLE ROW LEVEL SECURITY;", ddl)
        self.assertIn("ALTER TABLE public.fichas_cursos ENABLE ROW LEVEL SECURITY;", ddl)
        self.assertIn("CREATE POLICY \"Acesso total a cursos para anon e authenticated\"", ddl)
        self.assertIn("CREATE POLICY \"Acesso total a fichas para anon e authenticated\"", ddl)
        self.assertIn("CREATE POLICY \"Acesso total a fichas_cursos para anon e authenticated\"", ddl)

        # Triggers updated_at
        self.assertIn("CREATE OR REPLACE FUNCTION public.handle_updated_at()", ddl)
        self.assertIn("CREATE TRIGGER set_cursos_updated_at", ddl)
        self.assertIn("CREATE TRIGGER set_fichas_updated_at", ddl)
        self.assertIn("CREATE TRIGGER set_fichas_cursos_updated_at", ddl)


class TestAdversarialSqliteMockExecution(unittest.TestCase):
    """
    Executa a carga completa do migration_inserts em um banco SQLite temporário
    (convertendo tipos Postgres para sintaxe compatível com SQLite) para testar
    a validade sintática e relacional dos dados gerados.
    """

    def test_mock_insert_execution(self):
        """Simula a execução dos inserts para provar que nenhum dado causa erro de parsing."""
        sql_path = os.path.join(SUPABASE_DIR, "migration_inserts.sql")
        with open(sql_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        mem_conn = sqlite3.connect(":memory:")
        mem_cur = mem_conn.cursor()

        # Criar schema compatível em memória
        mem_cur.execute("""
            CREATE TABLE cursos (
                id INTEGER PRIMARY KEY,
                nome TEXT UNIQUE NOT NULL,
                descricao TEXT,
                ativo INTEGER DEFAULT 1
            )
        """)
        mem_cur.execute("""
            CREATE TABLE fichas (
                id INTEGER PRIMARY KEY,
                matricula TEXT UNIQUE NOT NULL,
                nome TEXT NOT NULL,
                email TEXT,
                data_nascimento TEXT,
                telefone TEXT,
                instrutor TEXT,
                data_inicio_curso TEXT,
                data_termino_curso TEXT,
                data_linha_vida TEXT,
                data_form1 TEXT,
                data_form2 TEXT,
                data_dreamday TEXT,
                data_fechamento1 TEXT,
                data_fechamento2 TEXT,
                data_fechamento3 TEXT,
                unit_id TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        """)
        mem_cur.execute("""
            CREATE TABLE fichas_cursos (
                id INTEGER PRIMARY KEY,
                ficha_id INTEGER NOT NULL REFERENCES fichas(id),
                curso_id INTEGER NOT NULL REFERENCES cursos(id),
                curso_nome TEXT NOT NULL,
                ordem INTEGER NOT NULL,
                UNIQUE (ficha_id, ordem)
            )
        """)

        # Executar cada INSERT adaptado para SQLite (removendo ON CONFLICT específico do postgres)
        cursos_count = 0
        fichas_count = 0
        fc_count = 0

        for line in lines:
            line_str = line.strip()
            if not line_str or line_str.startswith("--") or line_str in ("BEGIN;", "COMMIT;"):
                continue
            if line_str.startswith("SELECT setval"):
                continue

            # Adaptar cláusula ON CONFLICT para SQLite (INSERT OR REPLACE)
            if line_str.startswith("INSERT INTO public.cursos"):
                m = re.match(r"INSERT INTO public\.cursos \((.*?)\) VALUES \((.*?)\) ON CONFLICT.*?;", line_str)
                self.assertIsNotNone(m, f"Falha no regex de cursos: {line_str}")
                cols, vals = m.group(1), m.group(2)
                mem_cur.execute(f"INSERT OR REPLACE INTO cursos ({cols}) VALUES ({vals})")
                cursos_count += 1
            elif line_str.startswith("INSERT INTO public.fichas "):
                m = re.match(r"INSERT INTO public\.fichas \((.*?)\) VALUES \((.*?)\) ON CONFLICT.*?;", line_str)
                self.assertIsNotNone(m, f"Falha no regex de fichas: {line_str}")
                cols, vals = m.group(1), m.group(2)
                mem_cur.execute(f"INSERT OR REPLACE INTO fichas ({cols}) VALUES ({vals})")
                fichas_count += 1
            elif line_str.startswith("INSERT INTO public.fichas_cursos"):
                m = re.match(r"INSERT INTO public\.fichas_cursos \((.*?)\) VALUES \((.*?)\) ON CONFLICT.*?;", line_str)
                self.assertIsNotNone(m, f"Falha no regex de fichas_cursos: {line_str}")
                cols, vals = m.group(1), m.group(2)
                mem_cur.execute(f"INSERT OR REPLACE INTO fichas_cursos ({cols}) VALUES ({vals})")
                fc_count += 1

        mem_conn.commit()

        # Verificar contagens inseridas no banco em memória
        self.assertEqual(cursos_count, 105)
        self.assertEqual(fichas_count, 280)
        self.assertEqual(fc_count, 717)

        c_db = mem_cur.execute("SELECT count(*) FROM cursos").fetchone()[0]
        f_db = mem_cur.execute("SELECT count(*) FROM fichas").fetchone()[0]
        fc_db = mem_cur.execute("SELECT count(*) FROM fichas_cursos").fetchone()[0]

        self.assertEqual(c_db, 105)
        self.assertEqual(f_db, 280)
        self.assertEqual(fc_db, 717)

        # Testar re-execução (Idempotência no mock)
        for line in lines:
            line_str = line.strip()
            if line_str.startswith("INSERT INTO public.cursos"):
                m = re.match(r"INSERT INTO public\.cursos \((.*?)\) VALUES \((.*?)\) ON CONFLICT.*?;", line_str)
                cols, vals = m.group(1), m.group(2)
                mem_cur.execute(f"INSERT OR REPLACE INTO cursos ({cols}) VALUES ({vals})")
            elif line_str.startswith("INSERT INTO public.fichas "):
                m = re.match(r"INSERT INTO public\.fichas \((.*?)\) VALUES \((.*?)\) ON CONFLICT.*?;", line_str)
                cols, vals = m.group(1), m.group(2)
                mem_cur.execute(f"INSERT OR REPLACE INTO fichas ({cols}) VALUES ({vals})")
            elif line_str.startswith("INSERT INTO public.fichas_cursos"):
                m = re.match(r"INSERT INTO public\.fichas_cursos \((.*?)\) VALUES \((.*?)\) ON CONFLICT.*?;", line_str)
                cols, vals = m.group(1), m.group(2)
                mem_cur.execute(f"INSERT OR REPLACE INTO fichas_cursos ({cols}) VALUES ({vals})")

        mem_conn.commit()

        # Contagens devem permanecer as mesmas após re-execução
        self.assertEqual(mem_cur.execute("SELECT count(*) FROM cursos").fetchone()[0], 105)
        self.assertEqual(mem_cur.execute("SELECT count(*) FROM fichas").fetchone()[0], 280)
        self.assertEqual(mem_cur.execute("SELECT count(*) FROM fichas_cursos").fetchone()[0], 717)

        mem_conn.close()


class TestAdversarialDatabaseCorruption(unittest.TestCase):
    """Testa como a rotina de extração reage a bancos SQLite corrompidos, violados ou maliciosos."""

    def create_mock_sqlite(self, setup_sql: str) -> str:
        import tempfile
        fd, path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        conn = sqlite3.connect(path)
        conn.executescript(setup_sql)
        conn.commit()
        conn.close()
        return path

    def test_missing_table(self):
        """SQLite sem a tabela fichas deve lançar sqlite3.OperationalError."""
        path = self.create_mock_sqlite("CREATE TABLE cursos (id INT, nome TEXT);")
        try:
            with self.assertRaises(sqlite3.OperationalError):
                extract_legacy_data(path)
        finally:
            if os.path.exists(path):
                os.remove(path)

    def test_duplicate_matricula(self):
        """SQLite contendo duas fichas com a mesma matrícula deve lançar ValueError."""
        sql = """
            CREATE TABLE cursos (id INT, nome TEXT);
            CREATE TABLE fichas_cursos (rowid INT, ficha_id INT, curso_nome TEXT);
            CREATE TABLE fichas (id INT, matricula TEXT, nome TEXT, email TEXT, telefone TEXT, instrutor TEXT,
                data_nascimento TEXT, data_inicio_curso TEXT, data_termino_curso TEXT, data_linha_vida TEXT,
                data_form1 TEXT, data_form2 TEXT, data_dreamday TEXT, data_fechamento1 TEXT, data_fechamento2 TEXT,
                data_fechamento3 TEXT, data_criacao TEXT);
            INSERT INTO fichas (id, matricula, nome) VALUES (1, 'MAT123', 'Aluno A');
            INSERT INTO fichas (id, matricula, nome) VALUES (2, 'MAT123', 'Aluno B');
        """
        path = self.create_mock_sqlite(sql)
        try:
            with self.assertRaises(ValueError) as ctx:
                extract_legacy_data(path)
            self.assertIn("Matrícula duplicada", str(ctx.exception))
        finally:
            if os.path.exists(path):
                os.remove(path)

    def test_empty_matricula(self):
        """SQLite contendo ficha com matrícula vazia deve lançar ValueError."""
        sql = """
            CREATE TABLE cursos (id INT, nome TEXT);
            CREATE TABLE fichas_cursos (rowid INT, ficha_id INT, curso_nome TEXT);
            CREATE TABLE fichas (id INT, matricula TEXT, nome TEXT, email TEXT, telefone TEXT, instrutor TEXT,
                data_nascimento TEXT, data_inicio_curso TEXT, data_termino_curso TEXT, data_linha_vida TEXT,
                data_form1 TEXT, data_form2 TEXT, data_dreamday TEXT, data_fechamento1 TEXT, data_fechamento2 TEXT,
                data_fechamento3 TEXT, data_criacao TEXT);
            INSERT INTO fichas (id, matricula, nome) VALUES (1, '', 'Aluno Sem Matricula');
        """
        path = self.create_mock_sqlite(sql)
        try:
            with self.assertRaises(ValueError) as ctx:
                extract_legacy_data(path)
            self.assertIn("matrícula vazia", str(ctx.exception).lower())
        finally:
            if os.path.exists(path):
                os.remove(path)

    def test_empty_student_name(self):
        """SQLite contendo aluno sem nome deve lançar ValueError."""
        sql = """
            CREATE TABLE cursos (id INT, nome TEXT);
            CREATE TABLE fichas_cursos (rowid INT, ficha_id INT, curso_nome TEXT);
            CREATE TABLE fichas (id INT, matricula TEXT, nome TEXT, email TEXT, telefone TEXT, instrutor TEXT,
                data_nascimento TEXT, data_inicio_curso TEXT, data_termino_curso TEXT, data_linha_vida TEXT,
                data_form1 TEXT, data_form2 TEXT, data_dreamday TEXT, data_fechamento1 TEXT, data_fechamento2 TEXT,
                data_fechamento3 TEXT, data_criacao TEXT);
            INSERT INTO fichas (id, matricula, nome) VALUES (1, 'MAT001', '   ');
        """
        path = self.create_mock_sqlite(sql)
        try:
            with self.assertRaises(ValueError) as ctx:
                extract_legacy_data(path)
            self.assertIn("nome vazio", str(ctx.exception).lower())
        finally:
            if os.path.exists(path):
                os.remove(path)

    def test_corrupted_date_format(self):
        """SQLite contendo data com formato inválido deve lançar RuntimeError com detalhes."""
        sql = """
            CREATE TABLE cursos (id INT, nome TEXT);
            CREATE TABLE fichas_cursos (rowid INT, ficha_id INT, curso_nome TEXT);
            CREATE TABLE fichas (id INT, matricula TEXT, nome TEXT, email TEXT, telefone TEXT, instrutor TEXT,
                data_nascimento TEXT, data_inicio_curso TEXT, data_termino_curso TEXT, data_linha_vida TEXT,
                data_form1 TEXT, data_form2 TEXT, data_dreamday TEXT, data_fechamento1 TEXT, data_fechamento2 TEXT,
                data_fechamento3 TEXT, data_criacao TEXT);
            INSERT INTO fichas (id, matricula, nome, data_nascimento) VALUES (1, 'MAT001', 'Aluno Data Bug', 'DATA_INVALIDA_XYZ');
        """
        path = self.create_mock_sqlite(sql)
        try:
            with self.assertRaises(RuntimeError) as ctx:
                extract_legacy_data(path)
            self.assertIn("erros de conversão de data", str(ctx.exception).lower())
        finally:
            if os.path.exists(path):
                os.remove(path)

    def test_foreign_key_orphan_ficha_id(self):
        """SQLite contendo fichas_cursos apontando para ficha inexistente deve lançar RuntimeError."""
        sql = """
            CREATE TABLE cursos (id INT, nome TEXT);
            INSERT INTO cursos (id, nome) VALUES (1, 'Informática');
            CREATE TABLE fichas (id INT, matricula TEXT, nome TEXT, email TEXT, telefone TEXT, instrutor TEXT,
                data_nascimento TEXT, data_inicio_curso TEXT, data_termino_curso TEXT, data_linha_vida TEXT,
                data_form1 TEXT, data_form2 TEXT, data_dreamday TEXT, data_fechamento1 TEXT, data_fechamento2 TEXT,
                data_fechamento3 TEXT, data_criacao TEXT);
            INSERT INTO fichas (id, matricula, nome) VALUES (1, 'MAT001', 'Aluno 1');
            CREATE TABLE fichas_cursos (rowid INT, ficha_id INT, curso_nome TEXT);
            INSERT INTO fichas_cursos (rowid, ficha_id, curso_nome) VALUES (1, 9999, 'Informática');
        """
        path = self.create_mock_sqlite(sql)
        try:
            with self.assertRaises(RuntimeError) as ctx:
                extract_legacy_data(path)
            self.assertIn("integridade referencial", str(ctx.exception).lower())
        finally:
            if os.path.exists(path):
                os.remove(path)


if __name__ == "__main__":
    unittest.main()

