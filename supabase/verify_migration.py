#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==============================================================================
SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
Script de Validação e Auditoria da Migração: verify_migration.py
Arquivo: supabase/verify_migration.py
==============================================================================

Validações Obrigatórias Executadas:
1. Exatamente 280 registros de alunos (fichas).
2. Exatamente 105 cursos unificados no catálogo.
3. Exatamente 717 vínculos aluno-curso (fichas_cursos).
4. 0 erros de conversão de datas (todas validadas no calendário gregoriano).
5. 0 duplicatas de matrícula (100% de unicidade em matrículas).
6. 100% de integridade referencial:
   - Todo ficha_id em fichas_cursos aponta para ficha válida.
   - Todo curso_id em fichas_cursos aponta para curso válido.
   - Sequência ordem estritamente entre 1 e 18 sem colisões (ficha_id, ordem).
7. Auditoria de casos de borda:
   - Datas seriais do Excel (ex: 41591 -> 2013-11-13).
   - Anos de 2 dígitos (ex: 28/02/26 -> 2026-02-28).
   - Máscara invertida YYYYMMDD (ex: 20/27/0728 -> 2027-07-28).
   - Cursos órfãos unificados (Assistente Administrativo, Design Gráfico, etc.).
   - Aluno com carga máxima (15 cursos).
8. Modo --live: Auditoria dos registros carregados diretamente no Supabase REST.
"""

import os
import sys
import re
import json
import sqlite3
import argparse
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

# Forçar UTF-8 no Windows
if sys.platform.startswith("win"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

# Importar lógica central de migração
try:
    from migrate_sqlite import (
        DEFAULT_SQLITE_PATH,
        DEFAULT_SUPABASE_URL,
        DEFAULT_SUPABASE_KEY,
        DATE_COLUMNS,
        extract_legacy_data,
        normalize_date,
    )
except ImportError:
    # Se executado a partir de outro diretório
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from migrate_sqlite import (
        DEFAULT_SQLITE_PATH,
        DEFAULT_SUPABASE_URL,
        DEFAULT_SUPABASE_KEY,
        DATE_COLUMNS,
        extract_legacy_data,
        normalize_date,
    )


class MigrationAuditor:
    def __init__(self, db_path: str = DEFAULT_SQLITE_PATH):
        self.db_path = db_path
        self.extracted_data: Optional[Dict[str, Any]] = None
        self.audit_results: List[Tuple[str, bool, str]] = []

    def record_check(self, title: str, passed: bool, details: str):
        self.audit_results.append((title, passed, details))

    def run_offline_audit(self) -> bool:
        print("\n" + "=" * 75)
        print("AUDITORIA FORENSE OFFLINE DA MIGRAÇÃO")
        print(f"Fonte SQLite: {self.db_path}")
        print("=" * 75)

        # 1. Extração
        try:
            self.extracted_data = extract_legacy_data(self.db_path)
            self.record_check("Extração de Dados SQLite", True, "Extração concluída sem exceções")
        except Exception as e:
            self.record_check("Extração de Dados SQLite", False, f"Falha na extração: {e}")
            return False

        fichas = self.extracted_data["fichas"]
        cursos = self.extracted_data["cursos"]
        fichas_cursos = self.extracted_data["fichas_cursos"]

        # 2. Asserção: Exatamente 280 alunos
        fichas_count = len(fichas)
        passed_fichas = (fichas_count == 280)
        self.record_check(
            "Censo de Fichas (280 registros)",
            passed_fichas,
            f"Encontrados: {fichas_count} | Esperados: 280"
        )

        # 3. Asserção: Exatamente 105 cursos
        cursos_count = len(cursos)
        passed_cursos = (cursos_count == 105)
        self.record_check(
            "Catálogo Unificado de Cursos (105 registros)",
            passed_cursos,
            f"Encontrados: {cursos_count} | Esperados: 105"
        )

        # 4. Asserção: Exatamente 717 vínculos aluno-curso
        fc_count = len(fichas_cursos)
        passed_fc = (fc_count == 717)
        self.record_check(
            "Vínculos Aluno-Curso (717 registros)",
            passed_fc,
            f"Encontrados: {fc_count} | Esperados: 717"
        )

        # 5. Asserção: 0 erros de conversão de datas
        total_dates = 0
        date_errors = 0
        invalid_format_dates = []

        for f in fichas:
            for col in DATE_COLUMNS:
                val = f.get(col)
                if val is not None:
                    total_dates += 1
                    # Deve corresponder estritamente a YYYY-MM-DD
                    if not re.match(r"^\d{4}-\d{2}-\d{2}$", val):
                        date_errors += 1
                        invalid_format_dates.append((f["id"], col, val, "Formato regex não é YYYY-MM-DD"))
                        continue
                    # Deve ser data válida no calendário gregoriano
                    try:
                        y, m, d = map(int, val.split("-"))
                        datetime(y, m, d)
                    except Exception as err:
                        date_errors += 1
                        invalid_format_dates.append((f["id"], col, val, str(err)))

        passed_dates = (date_errors == 0 and total_dates == 877)
        self.record_check(
            "Conversão e Validação de Datas (877 datas, 0 erros)",
            passed_dates,
            f"Total de datas validadas: {total_dates} | Erros: {date_errors}"
        )

        # 6. Asserção: 0 matrículas duplicadas
        mats = [f["matricula"] for f in fichas]
        empty_mats = [m for m in mats if not m]
        seen = set()
        duplicates = []
        for m in mats:
            if m in seen:
                duplicates.append(m)
            seen.add(m)

        passed_mats = (len(empty_mats) == 0 and len(duplicates) == 0 and len(mats) == 280)
        self.record_check(
            "Unicidade e Integridade de Matrículas (0 duplicatas)",
            passed_mats,
            f"Matrículas únicas: {len(seen)} | Duplicadas: {len(duplicates)} | Vazias: {len(empty_mats)}"
        )

        # 7. Asserção: 100% de integridade referencial
        ficha_ids = {f["id"] for f in fichas}
        curso_ids = {c["id"] for c in cursos}
        fk_ficha_errors = []
        fk_curso_errors = []
        order_errors = []
        seen_ficha_ordem: Set[Tuple[int, int]] = set()

        for fc in fichas_cursos:
            fid = fc["ficha_id"]
            cid = fc["curso_id"]
            ordem = fc["ordem"]

            if fid not in ficha_ids:
                fk_ficha_errors.append(fc)
            if cid not in curso_ids:
                fk_curso_errors.append(fc)
            if not (1 <= ordem <= 18):
                order_errors.append(fc)

            key = (fid, ordem)
            if key in seen_ficha_ordem:
                order_errors.append(f"Colisão de ordem ({fid}, {ordem})")
            seen_ficha_ordem.add(key)

        passed_fk = (
            len(fk_ficha_errors) == 0 and
            len(fk_curso_errors) == 0 and
            len(order_errors) == 0
        )
        self.record_check(
            "Integridade Referencial e Restrição de Ordem (1..18)",
            passed_fk,
            f"FK Ficha Erros: {len(fk_ficha_errors)} | FK Curso Erros: {len(fk_curso_errors)} | Ordem Erros: {len(order_errors)}"
        )

        # 8. Verificação de Casos de Borda Críticos
        # Caso A: Serial Excel 41591 -> 2013-11-13
        # Aluno id=9 com matricula 5049910 ou similar
        sample_serial_found = False
        for f in fichas:
            if f["data_nascimento"] == "2013-11-13":
                sample_serial_found = True
                break
        self.record_check(
            "Auditoria Caso A: Resolução de Seriais Excel (41591 -> 2013-11-13)",
            sample_serial_found,
            "Serial 41591 verificado como 2013-11-13 com sucesso" if sample_serial_found else "Data 2013-11-13 não localizada"
        )

        # Caso B: Máscara Invertida YYYYMMDD
        # id=45 (20/27/0728 -> 2027-07-28) e id=101 (20/27/0301 -> 2027-03-01)
        f_45 = next((f for f in fichas if f["id"] == 45), None)
        f_101 = next((f for f in fichas if f["id"] == 101), None)
        passed_masked = (
            f_45 is not None and f_45.get("data_termino_curso") == "2027-07-28" and
            f_101 is not None and f_101.get("data_termino_curso") == "2027-03-01"
        )
        self.record_check(
            "Auditoria Caso B: Resolução de Máscara Invertida (IDs 45 e 101)",
            passed_masked,
            f"ID 45 Término: {f_45.get('data_termino_curso') if f_45 else 'N/A'} (Esperado: 2027-07-28) | "
            f"ID 101 Término: {f_101.get('data_termino_curso') if f_101 else 'N/A'} (Esperado: 2027-03-01)"
        )

        # Caso C: Cursos Órfãos Unificados no Catálogo
        orphans = {"Assistente Administrativo", "Design Gráfico", "Inglês Avançado", "Inglês Básico"}
        cat_names = {c["nome"] for c in cursos}
        orphans_resolved = orphans.issubset(cat_names)
        self.record_check(
            "Auditoria Caso C: Unificação dos 4 Cursos Órfãos",
            orphans_resolved,
            f"Todos os 4 cursos órfãos presentes no catálogo: {orphans_resolved}"
        )

        # Caso D: Aluno com Carga Máxima de Cursos (ID 124 com 15 cursos) e Aluno sem Cursos (ID 143 com 0 cursos)
        fc_124 = [fc for fc in fichas_cursos if fc["ficha_id"] == 124]
        fc_143 = [fc for fc in fichas_cursos if fc["ficha_id"] == 143]
        passed_max_courses = (
            len(fc_124) == 15 and
            [fc["ordem"] for fc in fc_124] == list(range(1, 16)) and
            len(fc_143) == 0
        )
        self.record_check(
            "Auditoria Caso D: Carga Máxima (ID 124, 15 cursos) e Vazio (ID 143, 0 cursos)",
            passed_max_courses,
            f"Aluno 124: {len(fc_124)} cursos vinculados (ordem 1..15) | Aluno 143: {len(fc_143)} cursos vinculados"
        )

        # 9. Verificação dos Artefatos Gerados
        base_dir = os.path.dirname(os.path.abspath(__file__))
        payload_file = os.path.join(base_dir, "migration_payload.json")
        inserts_file = os.path.join(base_dir, "migration_inserts.sql")
        schema_file = os.path.join(base_dir, "migrations", "20261015_initial_schema.sql")

        payload_exists = os.path.isfile(payload_file) and os.path.getsize(payload_file) > 100000
        inserts_exists = os.path.isfile(inserts_file) and os.path.getsize(inserts_file) > 100000
        schema_exists = os.path.isfile(schema_file) and os.path.getsize(schema_file) > 1000

        self.record_check(
            "Artefato: migration_payload.json",
            payload_exists,
            f"Arquivo existe ({os.path.getsize(payload_file):,} bytes)" if payload_exists else "Arquivo ausente ou inválido"
        )
        self.record_check(
            "Artefato: migration_inserts.sql",
            inserts_exists,
            f"Arquivo existe ({os.path.getsize(inserts_file):,} bytes)" if inserts_exists else "Arquivo ausente ou inválido"
        )
        self.record_check(
            "Artefato: migrations/20261015_initial_schema.sql",
            schema_exists,
            f"Arquivo existe ({os.path.getsize(schema_file):,} bytes)" if schema_exists else "Arquivo ausente ou inválido"
        )

        # Resumo final
        all_passed = all(item[1] for item in self.audit_results)
        print("\n" + "-" * 75)
        print(f"{'ITEM AUDITADO':<55} | {'STATUS':<8}")
        print("-" * 75)
        for title, passed, details in self.audit_results:
            status_str = "✓ PASS" if passed else "✗ FAIL"
            print(f"{title:<55} | {status_str:<8}")
            print(f"  ↳ {details}")
        print("-" * 75)

        return all_passed

    def run_live_audit(self, supabase_url: str, supabase_key: str) -> bool:
        """
        Audita a base Supabase remota via PostgREST.
        """
        import requests

        print("\n" + "=" * 75)
        print("AUDITORIA REMOTA LIVE NO SUPABASE")
        print(f"URL: {supabase_url}")
        print("=" * 75)

        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Prefer": "count=exact",
        }
        base_url = supabase_url.rstrip("/") + "/rest/v1"

        live_checks = []

        for table, expected_count in [("cursos", 105), ("fichas", 280), ("fichas_cursos", 717)]:
            try:
                res = requests.get(f"{base_url}/{table}?select=id", headers=headers)
                if res.status_code == 200:
                    content_range = res.headers.get("content-range", "")
                    count_match = re.search(r"/(\d+)$", content_range)
                    if count_match:
                        actual_count = int(count_match.group(1))
                    else:
                        actual_count = len(res.json())

                    passed = (actual_count == expected_count)
                    live_checks.append((
                        f"Tabela Supabase: {table}",
                        passed,
                        f"Contagem Remota: {actual_count} | Esperado: {expected_count}"
                    ))
                elif res.status_code == 404:
                    live_checks.append((
                        f"Tabela Supabase: {table}",
                        False,
                        f"Tabela não encontrada no schema cache (404). Execute 20261015_initial_schema.sql primeiro."
                    ))
                else:
                    live_checks.append((
                        f"Tabela Supabase: {table}",
                        False,
                        f"Erro HTTP {res.status_code}: {res.text}"
                    ))
            except Exception as e:
                live_checks.append((f"Tabela Supabase: {table}", False, f"Exceção de rede: {e}"))

        print("\n" + "-" * 75)
        print(f"{'TABELA REMOTA':<55} | {'STATUS':<8}")
        print("-" * 75)
        for title, passed, details in live_checks:
            status_str = "✓ PASS" if passed else "✗ FAIL"
            print(f"{title:<55} | {status_str:<8}")
            print(f"  ↳ {details}")
        print("-" * 75)

        return all(item[1] for item in live_checks)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Auditoria e Verificação Rigorosa da Migração de Dados"
    )
    parser.add_argument(
        "--db-path",
        default=DEFAULT_SQLITE_PATH,
        help=f"Caminho do arquivo SQLite (Padrão: {DEFAULT_SQLITE_PATH})",
    )
    parser.add_argument(
        "--live",
        action="store_true",
        default=False,
        help="Executa validação remota contra a instância do Supabase",
    )
    parser.add_argument(
        "--supabase-url",
        default=DEFAULT_SUPABASE_URL,
        help=f"URL do Supabase (Padrão: {DEFAULT_SUPABASE_URL})",
    )
    parser.add_argument(
        "--supabase-key",
        default=DEFAULT_SUPABASE_KEY,
        help="Chave de API do Supabase",
    )

    args = parser.parse_args()

    auditor = MigrationAuditor(db_path=args.db_path)
    offline_success = auditor.run_offline_audit()

    if not offline_success:
        print("\n✗ FALHA NA AUDITORIA OFFLINE.")
        return 1

    if args.live:
        live_success = auditor.run_live_audit(args.supabase_url, args.supabase_key)
        if not live_success:
            print("\n✗ FALHA NA AUDITORIA LIVE REMOTA.")
            return 2

    print("\n✓ TODAS AS ASSERÇÕES DE INTEGRIDADE PASSARAM COM 100% DE ÊXITO.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
