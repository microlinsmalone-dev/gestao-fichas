#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Empirical Adversarial Test Suite for Milestone 2 (challenger_m2_2)
Verifies:
1. TypeScript definitions in types/database.ts vs SQL schema in supabase/migrations/20261015_initial_schema.sql.
2. Nullable vs non-null fields, dates (string YYYY-MM-DD vs Date), numbers, enums.
3. Supabase client fallback behavior across 5 environment permutations.
4. Live Supabase endpoint authentication with default fallback credentials.
5. TypeScript compiler behavior and type ergonomics (Insert/Update contracts).
"""

import os
import sys
import re
import json
import subprocess
import unittest
import urllib.request

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCHEMA_FILE = os.path.join(ROOT_DIR, "supabase", "migrations", "20261015_initial_schema.sql")
TYPES_FILE = os.path.join(ROOT_DIR, "types", "database.ts")
CLIENT_FILE = os.path.join(ROOT_DIR, "lib", "supabase", "client.ts")
PATCH_READLINK = os.path.join(ROOT_DIR, "scripts", "patch-readlink.js")


class TestSchemaVsTypesFidelity(unittest.TestCase):
    """Rigorous comparison between SQL DDL and TypeScript definitions."""

    @classmethod
    def setUpClass(cls):
        with open(SCHEMA_FILE, "r", encoding="utf-8") as f:
            cls.sql_content = f.read()
        with open(TYPES_FILE, "r", encoding="utf-8") as f:
            cls.ts_content = f.read()

    def test_sql_tables_exist_in_typescript(self):
        """All 3 relational tables (cursos, fichas, fichas_cursos) must exist in Database interface."""
        tables_block_match = re.search(r"Tables:\s*\{(.*?)\n\s*Views:", self.ts_content, re.DOTALL)
        self.assertIsNotNone(tables_block_match, "Tables property missing in Database interface")
        tables_block = tables_block_match.group(1)

        self.assertIn("cursos:", tables_block)
        self.assertIn("fichas:", tables_block)
        self.assertIn("fichas_cursos:", tables_block)

    def test_cursos_column_parity_and_types(self):
        """Verify table 'cursos' columns, data types, and nullability."""
        # SQL: id BIGINT, nome VARCHAR(255) NOT NULL, descricao TEXT (nullable),
        #      ativo BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
        curso_match = re.search(r"export interface Curso\s*\{([^}]+)\}", self.ts_content)
        self.assertIsNotNone(curso_match, "Curso interface missing")
        curso_body = curso_match.group(1)

        fields = {}
        for line in curso_body.strip().split("\n"):
            line = line.strip()
            if not line or line.startswith("//"):
                continue
            m = re.match(r"^(\w+)(\??):\s*([^;]+);", line)
            if m:
                fields[m.group(1)] = {
                    "optional": bool(m.group(2)),
                    "type": m.group(3).strip()
                }

        expected_columns = ["id", "nome", "descricao", "ativo", "created_at", "updated_at"]
        for col in expected_columns:
            self.assertIn(col, fields, f"Column '{col}' missing from Curso interface")

        # Data types
        self.assertEqual(fields["id"]["type"], "number")
        self.assertEqual(fields["nome"]["type"], "string")
        self.assertEqual(fields["descricao"]["type"], "string | null")
        self.assertEqual(fields["ativo"]["type"], "boolean")
        self.assertIn("string", fields["created_at"]["type"])
        self.assertIn("string", fields["updated_at"]["type"])

        # Non-null in SQL: id, nome, ativo
        self.assertFalse(fields["id"]["optional"])
        self.assertNotIn("null", fields["id"]["type"])
        self.assertFalse(fields["nome"]["optional"])
        self.assertNotIn("null", fields["nome"]["type"])
        self.assertFalse(fields["ativo"]["optional"])
        self.assertNotIn("null", fields["ativo"]["type"])

        # Nullable in SQL: descricao
        self.assertIn("null", fields["descricao"]["type"])

    def test_fichas_column_parity_and_types(self):
        """Verify table 'fichas' columns, data types, nullability, and date representations."""
        ficha_match = re.search(r"export interface Ficha\s*\{([^}]+)\}", self.ts_content)
        self.assertIsNotNone(ficha_match, "Ficha interface missing")
        ficha_body = ficha_match.group(1)

        fields = {}
        for line in ficha_body.strip().split("\n"):
            line = line.strip()
            if not line or line.startswith("//"):
                continue
            m = re.match(r"^(\w+)(\??):\s*([^;]+);", line)
            if m:
                fields[m.group(1)] = {
                    "optional": bool(m.group(2)),
                    "type": m.group(3).strip()
                }

        expected_columns = [
            "id", "matricula", "nome", "email", "data_nascimento", "telefone", "instrutor",
            "data_inicio_curso", "data_termino_curso", "data_linha_vida", "data_form1",
            "data_form2", "data_dreamday", "data_fechamento1", "data_fechamento2", "data_fechamento3",
            "dia_semana", "horario_inicio", "horario_fim", "unit_id", "observacoes",
            "created_at", "updated_at"
        ]

        for col in expected_columns:
            self.assertIn(col, fields, f"Column '{col}' missing from Ficha interface")

        # Identity and required text fields
        self.assertEqual(fields["id"]["type"], "number")
        self.assertFalse(fields["id"]["optional"])
        self.assertEqual(fields["matricula"]["type"], "string")
        self.assertFalse(fields["matricula"]["optional"])
        self.assertEqual(fields["nome"]["type"], "string")
        self.assertFalse(fields["nome"]["optional"])

        # Date fields: MUST be string | null (ISO 'YYYY-MM-DD'), NEVER Date
        date_fields = [
            "data_nascimento", "data_inicio_curso", "data_termino_curso", "data_linha_vida",
            "data_form1", "data_form2", "data_dreamday", "data_fechamento1",
            "data_fechamento2", "data_fechamento3"
        ]
        for df in date_fields:
            self.assertEqual(fields[df]["type"], "string | null",
                             f"Date field '{df}' must be 'string | null', got '{fields[df]['type']}'")
            self.assertNotIn("Date", fields[df]["type"],
                             f"Date field '{df}' must not use JavaScript 'Date' object")

        # Nullable string fields
        nullable_strings = [
            "email", "telefone", "instrutor", "dia_semana", "horario_inicio", "horario_fim", "observacoes"
        ]
        for ns in nullable_strings:
            self.assertEqual(fields[ns]["type"], "string | null",
                             f"Field '{ns}' must be 'string | null'")

    def test_fichas_cursos_column_parity_and_types(self):
        """Verify table 'fichas_cursos' columns, data types, and foreign keys."""
        fc_match = re.search(r"export interface FichaCurso\s*\{([^}]+)\}", self.ts_content)
        self.assertIsNotNone(fc_match, "FichaCurso interface missing")
        fc_body = fc_match.group(1)

        fields = {}
        for line in fc_body.strip().split("\n"):
            line = line.strip()
            if not line or line.startswith("//"):
                continue
            m = re.match(r"^(\w+)(\??):\s*([^;]+);", line)
            if m:
                fields[m.group(1)] = {
                    "optional": bool(m.group(2)),
                    "type": m.group(3).strip()
                }

        expected = ["id", "ficha_id", "curso_id", "curso_nome", "ordem", "created_at", "updated_at"]
        for col in expected:
            self.assertIn(col, fields, f"Column '{col}' missing from FichaCurso interface")

        # Numbers
        self.assertEqual(fields["id"]["type"], "number")
        self.assertEqual(fields["ficha_id"]["type"], "number")
        self.assertEqual(fields["curso_id"]["type"], "number")
        self.assertEqual(fields["ordem"]["type"], "number")

        # String
        self.assertEqual(fields["curso_nome"]["type"], "string")

        # Non-null constraints in SQL: all are NOT NULL
        for col in ["id", "ficha_id", "curso_id", "curso_nome", "ordem"]:
            self.assertNotIn("null", fields[col]["type"], f"'{col}' should not be nullable")

    def test_enums_parity(self):
        """Verify that enum representation matches database schema (zero custom enums in initial_schema.sql)."""
        # SQL schema has 0 CREATE TYPE ... AS ENUM
        sql_enums = re.findall(r"CREATE\s+TYPE\s+(\w+)\s+AS\s+ENUM", self.sql_content, re.IGNORECASE)
        self.assertEqual(len(sql_enums), 0, "SQL schema contains unexpected enums")

        # TS schema has Enums: { [_ in never]: never; }
        self.assertIn("Enums: {", self.ts_content)
        self.assertIn("[_ in never]: never;", self.ts_content)


class TestSupabaseClientFallback(unittest.TestCase):
    """Empirical verification of Supabase client fallback behavior under 5 environment states."""

    DEFAULT_URL = "https://apfcbkucxjcleqxarlmv.supabase.co"
    DEFAULT_KEY = "sb_publishable_DZAXwbvMzgz31wR-pmbNkg_aNg3ofG0"

    def _run_node_check(self, env_vars: dict) -> dict:
        """Executes a Node child process with the specified env dict and returns client properties."""
        env = os.environ.copy()
        # Remove existing Supabase env vars first
        env.pop("NEXT_PUBLIC_SUPABASE_URL", None)
        env.pop("NEXT_PUBLIC_SUPABASE_ANON_KEY", None)
        env.update(env_vars)

        js_code = (
            "import('./lib/supabase/client.ts').then(m => {"
            "  console.log(JSON.stringify({"
            "    url: m.supabase.supabaseUrl,"
            "    key: m.supabase.supabaseKey,"
            "    hasClient: !!m.supabase"
            "  }));"
            "}).catch(err => {"
            "  console.error(err);"
            "  process.exit(1);"
            "});"
        )

        cmd = [
            "node",
            "-r", PATCH_READLINK,
            "--experimental-strip-types",
            "-e", js_code
        ]

        proc = subprocess.run(cmd, cwd=ROOT_DIR, env=env, capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0, f"Node process failed:\nSTDOUT: {proc.stdout}\nSTDERR: {proc.stderr}")

        # Extract JSON from output (ignoring node warnings)
        for line in proc.stdout.splitlines():
            line = line.strip()
            if line.startswith("{") and line.endswith("}"):
                return json.loads(line)

        raise AssertionError(f"Could not parse JSON output from Node process:\n{proc.stdout}")

    def test_fallback_when_env_vars_missing(self):
        """Scenario A: Both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are undefined."""
        res = self._run_node_check({})
        self.assertTrue(res["hasClient"])
        self.assertEqual(res["url"], self.DEFAULT_URL)
        self.assertEqual(res["key"], self.DEFAULT_KEY)

    def test_custom_env_vars_used_when_present(self):
        """Scenario B: Both env vars provided with valid custom values."""
        custom_url = "https://custom-proj.supabase.co"
        custom_key = "sb_publishable_CUSTOM_KEY_1234567890"
        res = self._run_node_check({
            "NEXT_PUBLIC_SUPABASE_URL": custom_url,
            "NEXT_PUBLIC_SUPABASE_ANON_KEY": custom_key
        })
        self.assertTrue(res["hasClient"])
        self.assertEqual(res["url"], custom_url)
        self.assertEqual(res["key"], custom_key)

    def test_fallback_when_env_vars_empty_strings(self):
        """Scenario C: Environment variables set to empty strings ('') gracefully fallback via || operator."""
        res = self._run_node_check({
            "NEXT_PUBLIC_SUPABASE_URL": "",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY": ""
        })
        self.assertTrue(res["hasClient"])
        self.assertEqual(res["url"], self.DEFAULT_URL)
        self.assertEqual(res["key"], self.DEFAULT_KEY)

    def test_partial_env_var_custom_url_default_key(self):
        """Scenario D: Custom URL set, but anon key omitted -> custom URL with default key."""
        custom_url = "https://custom-proj-2.supabase.co"
        res = self._run_node_check({
            "NEXT_PUBLIC_SUPABASE_URL": custom_url
        })
        self.assertTrue(res["hasClient"])
        self.assertEqual(res["url"], custom_url)
        self.assertEqual(res["key"], self.DEFAULT_KEY)

    def test_partial_env_var_default_url_custom_key(self):
        """Scenario E: URL omitted, but custom anon key set -> default URL with custom key."""
        custom_key = "sb_publishable_CUSTOM_KEY_XYZ987654321"
        res = self._run_node_check({
            "NEXT_PUBLIC_SUPABASE_ANON_KEY": custom_key
        })
        self.assertTrue(res["hasClient"])
        self.assertEqual(res["url"], self.DEFAULT_URL)
        self.assertEqual(res["key"], custom_key)


class TestLiveSupabaseEndpoint(unittest.TestCase):
    """Empirical live ping to the Supabase endpoint using fallback credentials."""

    def test_live_supabase_endpoint_connection(self):
        """Verify that default fallback URL and publishable key authenticate against live Supabase."""
        url = "https://apfcbkucxjcleqxarlmv.supabase.co/rest/v1/units?select=id,name&limit=1"
        headers = {
            "apikey": "sb_publishable_DZAXwbvMzgz31wR-pmbNkg_aNg3ofG0",
            "Authorization": "Bearer sb_publishable_DZAXwbvMzgz31wR-pmbNkg_aNg3ofG0"
        }
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                self.assertEqual(resp.status, 200)
                data = json.loads(resp.read().decode())
                self.assertIsInstance(data, list)
                self.assertGreaterEqual(len(data), 1)
                self.assertEqual(data[0]["id"], "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")
                self.assertIn("Potirendaba", data[0]["name"])
        except urllib.error.URLError as e:
            self.fail(f"Failed to connect to Supabase with default fallback credentials: {e}")


class TestTypeScriptTypeChecking(unittest.TestCase):
    """Adversarially validates TypeScript compiler enforcement on types and interfaces."""

    def _run_tsc_on_snippet(self, code_snippet: str) -> subprocess.CompletedProcess:
        """Helper to run tsc --noEmit against a temporary TS file."""
        tmp_file = os.path.join(ROOT_DIR, "tests", "unit", "_tmp_type_check.ts")
        try:
            with open(tmp_file, "w", encoding="utf-8") as f:
                f.write(code_snippet)
            cmd = ["npx", "tsc", "--noEmit"]
            return subprocess.run(cmd, cwd=ROOT_DIR, capture_output=True, text=True, shell=True)
        finally:
            if os.path.exists(tmp_file):
                os.remove(tmp_file)

    def test_typescript_rejects_js_date_objects(self):
        """TypeScript compiler must reject JavaScript Date objects for date columns (must be string YYYY-MM-DD)."""
        snippet = """
import type { Ficha } from '../../types/database';
const f: Ficha = {
  id: 1, matricula: '123', nome: 'A', email: null, telefone: null, instrutor: null,
  data_nascimento: new Date() as any as Date, // Should fail because string | null is expected
  data_inicio_curso: null, data_termino_curso: null, data_linha_vida: null,
  data_form1: null, data_form2: null, data_dreamday: null,
  data_fechamento1: null, data_fechamento2: null, data_fechamento3: null,
  dia_semana: null, horario_inicio: null, horario_fim: null, unit_id: null,
  observacoes: null, created_at: undefined, updated_at: undefined
};
"""
        proc = self._run_tsc_on_snippet(snippet)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("TS2322", proc.stdout)
        self.assertIn("Type 'Date' is not assignable to type 'string'", proc.stdout)

    def test_typescript_rejects_string_numeric_id(self):
        """TypeScript compiler must reject string values for numeric 'id' and 'ordem' fields."""
        snippet = """
import type { FichaCurso } from '../../types/database';
const fc: FichaCurso = {
  id: '1' as any as string, // Should fail because number is expected
  ficha_id: 1, curso_id: 2, curso_nome: 'Test', ordem: 1
};
"""
        proc = self._run_tsc_on_snippet(snippet)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("TS2322", proc.stdout)

    def test_typescript_rejects_string_for_boolean_ativo(self):
        """TypeScript compiler must reject non-boolean values for 'ativo'."""
        snippet = """
import type { Curso } from '../../types/database';
const c: Curso = {
  id: 1, nome: 'Excel', descricao: null,
  ativo: 'true' as any as string // Should fail because boolean is expected
};
"""
        proc = self._run_tsc_on_snippet(snippet)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("TS2322", proc.stdout)

    def test_adversarial_finding_ficha_insert_forces_nullable_fields(self):
        """Empirically prove that FichaInsert rejects minimal record { matricula, nome } because nullable fields lack '?'."""
        snippet = """
import type { FichaInsert } from '../../types/database';
// Minimal insert with only required SQL columns
const f: FichaInsert = {
  matricula: '12345',
  nome: 'ALUNO NOVO'
};
"""
        proc = self._run_tsc_on_snippet(snippet)
        # It MUST fail compilation due to the bug/design limitation in types/database.ts
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("TS2322", proc.stdout)
        self.assertIn("missing the following properties", proc.stdout)
        self.assertIn("email", proc.stdout)

    def test_adversarial_finding_curso_insert_forces_descricao_and_ativo(self):
        """Empirically prove that CursoInsert rejects minimal record { nome } because descricao and ativo are required."""
        snippet = """
import type { CursoInsert } from '../../types/database';
// Minimal insert with only required SQL column 'nome'
const c: CursoInsert = {
  nome: 'CURSO NOVO'
};
"""
        proc = self._run_tsc_on_snippet(snippet)
        # It MUST fail compilation due to the bug/design limitation in types/database.ts
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("TS2322", proc.stdout)
        self.assertIn("descricao", proc.stdout)
        self.assertIn("ativo", proc.stdout)

    def test_adversarial_finding_supabase_insert_infer_never_array(self):
        """Empirically prove that supabase.from('fichas').insert(...) infers 'never[]' due to interface-vs-Record limitation."""
        snippet = """
import { supabase } from '../../lib/supabase/client';
import type { FichaInsert } from '../../types/database';

async function testInsert() {
  const insertPayload: FichaInsert = {
    matricula: '5056188', nome: 'TAMIRIS MARIANA', email: null, telefone: null, instrutor: null,
    data_nascimento: null, data_inicio_curso: null, data_termino_curso: null, data_linha_vida: null,
    data_form1: null, data_form2: null, data_dreamday: null, data_fechamento1: null, data_fechamento2: null,
    data_fechamento3: null, dia_semana: null, horario_inicio: null, horario_fim: null, unit_id: null,
    observacoes: null
  };
  await supabase.from('fichas').insert(insertPayload);
}
"""
        proc = self._run_tsc_on_snippet(snippet)
        # It MUST fail compilation because supabase-js infers never[]
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("TS2345", proc.stdout)
        self.assertIn("never[]", proc.stdout)


if __name__ == "__main__":
    unittest.main()

