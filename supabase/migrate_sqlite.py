#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==============================================================================
SISTEMA DE GESTÃO DE FICHAS PEDAGÓGICAS - MICROLINS
Script de Migração: SQLite Legado -> Supabase PostgreSQL
Arquivo: supabase/migrate_sqlite.py
==============================================================================

Funcionalidades:
1. Conexão estritamente somente-leitura ao banco SQLite de produção
   (D:\\Malone\\CriaFichas\\sistema_fichas.db).
2. Normalização de datas com 100% de precisão para tipo DATE (YYYY-MM-DD):
   - Números seriais inteiros do Excel (época 30/12/1899).
   - Formatos brasileiros DD/MM/AAAA e DD/MM/AA (expansão inteligente de 2 dígitos).
   - Formatos ISO (YYYY-MM-DD HH:MM:SS -> YYYY-MM-DD).
   - Máscara invertida YYYYMMDD (20/YY/MMDD -> YYYY-MM-DD).
   - Conversão de strings vazias para NULL / None.
3. Unificação de todos os 105 cursos distintos (101 existentes + 4 órfãos).
4. Mapeamento de 717 vínculos aluno-curso com `ordem` sequencial explícita (1..18).
5. Modos de execução:
   - `--dry-run`: Extrai, sanitiza, valida e salva `migration_payload.json`
     e `migration_inserts.sql`.
   - `--live`: Executa a carga via API REST do Supabase em lotes configuráveis.
"""

import os
import sys
import re
import json
import sqlite3
import argparse
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple, Set

# Forçar saída padrão em UTF-8 no Windows
if sys.platform.startswith("win"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

# Constantes e caminhos padrão
DEFAULT_SQLITE_PATH = r"D:\Malone\CriaFichas\sistema_fichas.db"
DEFAULT_SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://apfcbkucxjcleqxarlmv.supabase.co")
DEFAULT_SUPABASE_KEY = os.environ.get(
    "SUPABASE_SERVICE_ROLE_KEY",
    os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_DZAXwbvMzgz31wR-pmbNkg_aNg3ofG0")
)
DEFAULT_UNIT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

DATE_COLUMNS = [
    "data_nascimento",
    "data_inicio_curso",
    "data_termino_curso",
    "data_linha_vida",
    "data_form1",
    "data_form2",
    "data_dreamday",
    "data_fechamento1",
    "data_fechamento2",
    "data_fechamento3",
]


def normalize_date(val: Any) -> Optional[str]:
    """
    Normaliza representações heterogêneas de datas para o formato ISO 'YYYY-MM-DD'.
    Retorna None para valores nulos ou strings vazias.
    Lança ValueError se o padrão for desconhecido ou inválido no calendário.
    """
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() in ("none", "null", "nan", ""):
        return None

    # 1. Serial do Excel (número inteiro de 4 ou 5 dígitos, ex: 41591, 30765)
    if re.match(r"^\d{4,5}$", s):
        serial = int(s)
        dt = datetime(1899, 12, 30) + timedelta(days=serial)
        return dt.strftime("%Y-%m-%d")

    # 2. Formato ISO com ou sem timestamp: YYYY-MM-DD...
    m_iso = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if m_iso:
        y, m_val, d = int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3))
        dt = datetime(y, m_val, d)
        return dt.strftime("%Y-%m-%d")

    # 3. Máscara invertida YYYYMMDD onde o mês digitado excede 12 (ex: 20/27/0728 -> 2027-07-28)
    m_mask = re.match(r"^20/(\d{2})/(\d{2})(\d{2})$", s)
    if m_mask and int(m_mask.group(1)) > 12:
        y = 2000 + int(m_mask.group(1))
        m_val = int(m_mask.group(2))
        d = int(m_mask.group(3))
        dt = datetime(y, m_val, d)
        return dt.strftime("%Y-%m-%d")

    # 4. Formato brasileiro DD/MM/AAAA ou DD/MM/AA
    m_br = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", s)
    if m_br:
        d, m_val, y = int(m_br.group(1)), int(m_br.group(2)), int(m_br.group(3))
        if y < 100:
            y = 2000 + y if y <= 50 else 1900 + y
        dt = datetime(y, m_val, d)
        return dt.strftime("%Y-%m-%d")

    raise ValueError(f"Formato de data não reconhecido: {val!r}")


def extract_legacy_data(db_path: str) -> Dict[str, Any]:
    """
    Lê o banco SQLite de forma 100% segura em modo somente-leitura e extrai:
    - 280 fichas sanitizadas
    - 105 cursos unificados
    - 717 vínculos fichas_cursos com ordem sequencial (1..n)
    """
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"Banco de dados SQLite não encontrado no caminho: {db_path}")

    # Abrir SQLite em modo somente-leitura através de URI
    uri_path = os.path.abspath(db_path).replace("\\", "/")
    conn_uri = f"file:///{uri_path}?mode=ro"
    conn = sqlite3.connect(conn_uri, uri=True)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        # 1. Extração dos Cursos Legados
        cursos_raw = cursor.execute("SELECT id, nome FROM cursos ORDER BY id").fetchall()
        cursos_db_names = {r["nome"].strip(): r["id"] for r in cursos_raw if r["nome"] and r["nome"].strip()}

        # 2. Extração dos Vínculos Aluno-Cursos
        fc_raw = cursor.execute(
            "SELECT rowid, ficha_id, curso_nome FROM fichas_cursos ORDER BY ficha_id, rowid"
        ).fetchall()

        fc_course_names = {r["curso_nome"].strip() for r in fc_raw if r["curso_nome"] and r["curso_nome"].strip()}

        # 3. Unificação dos Cursos (101 existentes + cursos órfãos presentes em fichas_cursos)
        all_course_names = sorted(list(set(cursos_db_names.keys()) | fc_course_names))
        if len(all_course_names) != 105:
            print(f"[AVISO] Quantidade de cursos distintos é {len(all_course_names)}, esperava-se 105.")

        cursos_list: List[Dict[str, Any]] = []
        course_name_to_id: Dict[str, int] = {}

        # Mapeia IDs: atribui ID sequencial ordenado de 1 a 105 para integridade relacional
        for idx, c_name in enumerate(all_course_names, start=1):
            course_name_to_id[c_name] = idx
            cursos_list.append({
                "id": idx,
                "nome": c_name,
                "descricao": None,
                "ativo": True,
            })

        # 4. Extração e Sanitização das Fichas
        fichas_raw = cursor.execute("SELECT * FROM fichas ORDER BY id").fetchall()
        fichas_list: List[Dict[str, Any]] = []
        date_conversion_errors: List[Dict[str, Any]] = []
        seen_matriculas: Set[str] = set()

        for row in fichas_raw:
            f_id = row["id"]
            matricula = str(row["matricula"]).strip() if row["matricula"] is not None else ""
            nome = str(row["nome"]).strip() if row["nome"] is not None else ""

            if not matricula:
                raise ValueError(f"Ficha ID {f_id} possui matrícula vazia.")
            if not nome:
                raise ValueError(f"Ficha ID {f_id} possui nome vazio.")

            if matricula in seen_matriculas:
                raise ValueError(f"Matrícula duplicada detectada no SQLite: {matricula} (ID {f_id})")
            seen_matriculas.add(matricula)

            def clean_str(val: Any) -> Optional[str]:
                if val is None:
                    return None
                s = str(val).strip()
                return s if s else None

            # Normalização de todas as datas
            dates_normalized: Dict[str, Optional[str]] = {}
            for col in DATE_COLUMNS:
                raw_val = row[col]
                try:
                    norm = normalize_date(raw_val)
                    dates_normalized[col] = norm
                except Exception as e:
                    date_conversion_errors.append({
                        "ficha_id": f_id,
                        "matricula": matricula,
                        "coluna": col,
                        "valor_bruto": raw_val,
                        "erro": str(e)
                    })
                    dates_normalized[col] = None

            created_at_val = row["data_criacao"]
            if created_at_val and str(created_at_val).strip():
                try:
                    c_dt = datetime.strptime(str(created_at_val).strip(), "%Y-%m-%d %H:%M:%S")
                    created_at_iso = c_dt.strftime("%Y-%m-%dT%H:%M:%S+00:00")
                except Exception:
                    created_at_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
            else:
                created_at_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")

            ficha_dict = {
                "id": f_id,
                "matricula": matricula,
                "nome": nome,
                "email": clean_str(row["email"]),
                "telefone": clean_str(row["telefone"]),
                "instrutor": clean_str(row["instrutor"]),
                "data_nascimento": dates_normalized["data_nascimento"],
                "data_inicio_curso": dates_normalized["data_inicio_curso"],
                "data_termino_curso": dates_normalized["data_termino_curso"],
                "data_linha_vida": dates_normalized["data_linha_vida"],
                "data_form1": dates_normalized["data_form1"],
                "data_form2": dates_normalized["data_form2"],
                "data_dreamday": dates_normalized["data_dreamday"],
                "data_fechamento1": dates_normalized["data_fechamento1"],
                "data_fechamento2": dates_normalized["data_fechamento2"],
                "data_fechamento3": dates_normalized["data_fechamento3"],
                "dia_semana": None,
                "horario_inicio": None,
                "horario_fim": None,
                "unit_id": DEFAULT_UNIT_ID,
                "observacoes": None,
                "created_at": created_at_iso,
                "updated_at": created_at_iso,
            }
            fichas_list.append(ficha_dict)

        if date_conversion_errors:
            raise RuntimeError(f"{len(date_conversion_errors)} erros de conversão de data encontrados: {date_conversion_errors}")

        # 5. Mapeamento das Matrículas e Vínculos com Ordem Didática
        fichas_cursos_list: List[Dict[str, Any]] = []
        order_counter: Dict[int, int] = {}
        fk_errors: List[str] = []

        for idx, row in enumerate(fc_raw, start=1):
            ficha_id = row["ficha_id"]
            curso_nome = str(row["curso_nome"]).strip() if row["curso_nome"] else ""

            if ficha_id not in {f["id"] for f in fichas_list}:
                fk_errors.append(f"Vínculo rowid={row['rowid']} referencia ficha_id inexistente: {ficha_id}")
                continue

            curso_id = course_name_to_id.get(curso_nome)
            if not curso_id:
                fk_errors.append(f"Curso {curso_nome!r} não localizado no catálogo unificado")
                continue

            current_order = order_counter.get(ficha_id, 0) + 1
            order_counter[ficha_id] = current_order

            if current_order > 18:
                print(f"[AVISO] Aluno ID {ficha_id} possui {current_order} cursos (limite A4 é 18).")

            fichas_cursos_list.append({
                "id": idx,
                "ficha_id": ficha_id,
                "curso_id": curso_id,
                "curso_nome": curso_nome,
                "ordem": current_order,
                "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00"),
                "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00"),
            })

        if fk_errors:
            raise RuntimeError(f"Erros de integridade referencial detectados: {fk_errors}")

        return {
            "metadata": {
                "source_sqlite": db_path,
                "extracted_at": datetime.now(timezone.utc).isoformat(),
                "counts": {
                    "fichas": len(fichas_list),
                    "cursos": len(cursos_list),
                    "fichas_cursos": len(fichas_cursos_list),
                },
            },
            "cursos": cursos_list,
            "fichas": fichas_list,
            "fichas_cursos": fichas_cursos_list,
        }
    finally:
        conn.close()


def generate_sql_inserts(data: Dict[str, Any]) -> str:
    """
    Gera script com comandos SQL INSERT formatados para PostgreSQL.
    Permite inserção direta ou execução manual via Supabase SQL Editor.
    """
    lines: List[str] = [
        "-- ==============================================================================",
        "-- DADOS DE MIGRAÇÃO: SQLite -> Supabase PostgreSQL",
        f"-- Gerado em: {data['metadata']['extracted_at']}",
        f"-- Total Fichas: {len(data['fichas'])} | Cursos: {len(data['cursos'])} | Vínculos: {len(data['fichas_cursos'])}",
        "-- ==============================================================================",
        "",
        "BEGIN;",
        "",
        "-- 1. Inserir Cursos (105 registros unificados)",
    ]

    def esc(val: Any) -> str:
        if val is None:
            return "NULL"
        if isinstance(val, bool):
            return "TRUE" if val else "FALSE"
        if isinstance(val, (int, float)):
            return str(val)
        s = str(val).replace("'", "''")
        return f"'{s}'"

    for c in data["cursos"]:
        lines.append(
            f"INSERT INTO public.cursos (id, nome, descricao, ativo) "
            f"VALUES ({c['id']}, {esc(c['nome'])}, {esc(c['descricao'])}, {esc(c['ativo'])}) "
            f"ON CONFLICT (nome) DO UPDATE SET updated_at = NOW();"
        )

    lines.append("")
    lines.append("-- 2. Inserir Fichas dos Alunos (280 registros)")
    for f in data["fichas"]:
        cols = [
            "id", "matricula", "nome", "email", "data_nascimento", "telefone", "instrutor",
            "data_inicio_curso", "data_termino_curso", "data_linha_vida", "data_form1",
            "data_form2", "data_dreamday", "data_fechamento1", "data_fechamento2",
            "data_fechamento3", "unit_id", "created_at", "updated_at"
        ]
        vals = [
            str(f["id"]),
            esc(f["matricula"]),
            esc(f["nome"]),
            esc(f["email"]),
            esc(f["data_nascimento"]),
            esc(f["telefone"]),
            esc(f["instrutor"]),
            esc(f["data_inicio_curso"]),
            esc(f["data_termino_curso"]),
            esc(f["data_linha_vida"]),
            esc(f["data_form1"]),
            esc(f["data_form2"]),
            esc(f["data_dreamday"]),
            esc(f["data_fechamento1"]),
            esc(f["data_fechamento2"]),
            esc(f["data_fechamento3"]),
            esc(f["unit_id"]),
            esc(f["created_at"]),
            esc(f["updated_at"]),
        ]
        lines.append(
            f"INSERT INTO public.fichas ({', '.join(cols)}) VALUES ({', '.join(vals)}) "
            f"ON CONFLICT (matricula) DO UPDATE SET "
            f"nome = EXCLUDED.nome, email = EXCLUDED.email, telefone = EXCLUDED.telefone, "
            f"instrutor = EXCLUDED.instrutor, data_nascimento = EXCLUDED.data_nascimento, "
            f"data_inicio_curso = EXCLUDED.data_inicio_curso, data_termino_curso = EXCLUDED.data_termino_curso, "
            f"updated_at = NOW();"
        )

    lines.append("")
    lines.append("-- 3. Inserir Vínculos Aluno-Cursos (717 registros com ordem explícita)")
    for fc in data["fichas_cursos"]:
        lines.append(
            f"INSERT INTO public.fichas_cursos (id, ficha_id, curso_id, curso_nome, ordem) "
            f"VALUES ({fc['id']}, {fc['ficha_id']}, {fc['curso_id']}, {esc(fc['curso_nome'])}, {fc['ordem']}) "
            f"ON CONFLICT (ficha_id, ordem) DO UPDATE SET "
            f"curso_id = EXCLUDED.curso_id, curso_nome = EXCLUDED.curso_nome, updated_at = NOW();"
        )

    lines.append("")
    lines.append("-- Ajustar sequências de IDs das tabelas")
    lines.append("SELECT setval(pg_get_serial_sequence('public.cursos', 'id'), COALESCE(MAX(id), 1), true) FROM public.cursos;")
    lines.append("SELECT setval(pg_get_serial_sequence('public.fichas', 'id'), COALESCE(MAX(id), 1), true) FROM public.fichas;")
    lines.append("SELECT setval(pg_get_serial_sequence('public.fichas_cursos', 'id'), COALESCE(MAX(id), 1), true) FROM public.fichas_cursos;")
    lines.append("")
    lines.append("COMMIT;")
    lines.append("")

    return "\n".join(lines)


def run_live_migration(
    data: Dict[str, Any],
    supabase_url: str,
    supabase_key: str,
    batch_size: int = 50
) -> Dict[str, Any]:
    """
    Executa a carga direta no Supabase via API REST do PostgREST.
    Insere cursos, fichas e vínculos em lotes otimizados.
    """
    import requests

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }

    base_url = supabase_url.rstrip("/") + "/rest/v1"
    results = {"cursos": 0, "fichas": 0, "fichas_cursos": 0}

    print(f"\n[LIVE MIGRATION] Iniciando carga no Supabase: {supabase_url}")

    # 1. Carga de Cursos
    print(f"[LIVE MIGRATION] Inserindo {len(data['cursos'])} cursos...")
    cursos_payload = [
        {"id": c["id"], "nome": c["nome"], "descricao": c["descricao"], "ativo": c["ativo"]}
        for c in data["cursos"]
    ]
    for i in range(0, len(cursos_payload), batch_size):
        chunk = cursos_payload[i : i + batch_size]
        res = requests.post(f"{base_url}/cursos", headers=headers, json=chunk)
        if res.status_code not in (200, 201):
            raise RuntimeError(f"Erro ao inserir lote de cursos ({res.status_code}): {res.text}")
        results["cursos"] += len(chunk)
    print(f"[LIVE MIGRATION] ✓ {results['cursos']} cursos carregados com sucesso.")

    # 2. Carga de Fichas
    print(f"[LIVE MIGRATION] Inserindo {len(data['fichas'])} fichas de alunos...")
    for i in range(0, len(data["fichas"]), batch_size):
        chunk = data["fichas"][i : i + batch_size]
        res = requests.post(f"{base_url}/fichas", headers=headers, json=chunk)
        if res.status_code not in (200, 201):
            raise RuntimeError(f"Erro ao inserir lote de fichas ({res.status_code}): {res.text}")
        results["fichas"] += len(chunk)
    print(f"[LIVE MIGRATION] ✓ {results['fichas']} fichas carregadas com sucesso.")

    # 3. Carga de Fichas_Cursos
    print(f"[LIVE MIGRATION] Inserindo {len(data['fichas_cursos'])} vínculos aluno-cursos...")
    fc_payload = [
        {
            "id": fc["id"],
            "ficha_id": fc["ficha_id"],
            "curso_id": fc["curso_id"],
            "curso_nome": fc["curso_nome"],
            "ordem": fc["ordem"],
        }
        for fc in data["fichas_cursos"]
    ]
    for i in range(0, len(fc_payload), batch_size):
        chunk = fc_payload[i : i + batch_size]
        res = requests.post(f"{base_url}/fichas_cursos", headers=headers, json=chunk)
        if res.status_code not in (200, 201):
            raise RuntimeError(f"Erro ao inserir lote de fichas_cursos ({res.status_code}): {res.text}")
        results["fichas_cursos"] += len(chunk)
    print(f"[LIVE MIGRATION] ✓ {results['fichas_cursos']} vínculos carregados com sucesso.")

    return results


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Migrador do Banco de Dados SQLite Legado para Supabase PostgreSQL"
    )
    parser.add_argument(
        "--db-path",
        default=DEFAULT_SQLITE_PATH,
        help=f"Caminho do arquivo SQLite (Padrão: {DEFAULT_SQLITE_PATH})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Executa a extração, validação e gera os arquivos JSON e SQL sem alterar o banco remoto",
    )
    parser.add_argument(
        "--live",
        action="store_true",
        default=False,
        help="Executa a carga ativa diretamente no Supabase remoto via API REST",
    )
    parser.add_argument(
        "--supabase-url",
        default=DEFAULT_SUPABASE_URL,
        help=f"URL do Supabase (Padrão: {DEFAULT_SUPABASE_URL})",
    )
    parser.add_argument(
        "--supabase-key",
        default=DEFAULT_SUPABASE_KEY,
        help="Chave de API do Supabase (anon ou service_role)",
    )
    parser.add_argument(
        "--output-dir",
        default=os.path.join(os.path.dirname(os.path.abspath(__file__))),
        help="Diretório de saída para os artefatos de migração",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Tamanho do lote para envio ao Supabase REST (Padrão: 100)",
    )

    args = parser.parse_args()

    # Se nenhum modo especificado, padrão é dry-run para segurança
    if not args.live and not args.dry_run:
        args.dry_run = True

    print("=" * 75)
    print("MIGRAÇÃO DE BANCO DE DADOS: SQLite -> Supabase PostgreSQL")
    print(f"Modo: {'LIVE MIGRATION' if args.live else 'DRY RUN (Validação e Geração de Artefatos)'}")
    print(f"Banco SQLite de Origem: {args.db_path}")
    print("=" * 75)

    try:
        data = extract_legacy_data(args.db_path)
    except Exception as e:
        print(f"\n[ERRO CRÍTICO NA EXTRAÇÃO] {e}", file=sys.stderr)
        return 1

    counts = data["metadata"]["counts"]
    print(f"\n[EXTRAÇÃO CONCLUÍDA COM SUCESSO]")
    print(f"  - Total de Fichas Cadastradas:  {counts['fichas']} (Esperado: 280)")
    print(f"  - Total de Cursos Unificados:   {counts['cursos']} (Esperado: 105)")
    print(f"  - Total de Vínculos Aluno-Curso:{counts['fichas_cursos']} (Esperado: 717)")

    # Validações estritas de conformidade
    assert counts["fichas"] == 280, f"Falha na contagem de fichas: {counts['fichas']}"
    assert counts["cursos"] == 105, f"Falha na contagem de cursos: {counts['cursos']}"
    assert counts["fichas_cursos"] == 717, f"Falha na contagem de vínculos: {counts['fichas_cursos']}"

    os.makedirs(args.output_dir, exist_ok=True)

    # Gerar artefatos locais
    json_path = os.path.join(args.output_dir, "migration_payload.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  - Payload JSON gerado: {json_path} ({os.path.getsize(json_path):,} bytes)")

    sql_content = generate_sql_inserts(data)
    sql_path = os.path.join(args.output_dir, "migration_inserts.sql")
    with open(sql_path, "w", encoding="utf-8") as f:
        f.write(sql_content)
    print(f"  - Script SQL de Carga gerado: {sql_path} ({os.path.getsize(sql_path):,} bytes)")

    if args.live:
        try:
            live_res = run_live_migration(
                data=data,
                supabase_url=args.supabase_url,
                supabase_key=args.supabase_key,
                batch_size=args.batch_size,
            )
            print("\n[SUCESSO] Migração Live concluída com êxito!")
            print(f"Resultados: {live_res}")
        except Exception as e:
            print(f"\n[ERRO NA CARGA LIVE] {e}", file=sys.stderr)
            print("[INFO] Certifique-se de que a migration DDL (20261015_initial_schema.sql) foi executada no Supabase antes da carga live.")
            return 2

    print("\n✓ Processo concluído com 100% de integridade.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
