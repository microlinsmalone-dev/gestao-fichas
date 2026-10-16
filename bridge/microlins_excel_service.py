#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ==============================================================================
# MICROLINS - ASSISTENTE DE IMPRESSÃO NATIVO EXCEL (BACKGROUND SERVICE)
# Arquivo: bridge/microlins_excel_service.py
# Escuta em http://127.0.0.1:3827 e automatiza o Excel.Application via COM
# ==============================================================================

import os
import sys
import json
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
import pythoncom
import win32com.client

PORT = 3827
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

# Localiza ModeloFicha.xlsx (tenta pasta raiz, pai ou D:\Malone\CriaFichas)
POSSIBLE_PATHS = [
    os.path.join(CURRENT_DIR, "ModeloFicha.xlsx"),
    os.path.join(os.path.dirname(CURRENT_DIR), "ModeloFicha.xlsx"),
    r"D:\Malone\CriaFichas\ModeloFicha.xlsx",
    r"D:\Malone\Projetos\Sistemas_Microlins\SistemaFichas_Att\ModeloFicha.xlsx",
]

TEMPLATE_PATH = None
for p in POSSIBLE_PATHS:
    if os.path.exists(p):
        TEMPLATE_PATH = os.path.abspath(p)
        break

if not TEMPLATE_PATH:
    TEMPLATE_PATH = r"D:\Malone\CriaFichas\ModeloFicha.xlsx"


def expand_year(d_str):
    if not d_str:
        return ""
    d_str = str(d_str).strip()
    parts = d_str.split("/")
    if len(parts) == 3 and len(parts[2]) == 2 and parts[2].isdigit():
        parts[2] = "20" + parts[2]
        return "/".join(parts)
    return d_str


def print_students_via_excel(students, schedule_info, include_verso=True, copies=1):
    pythoncom.CoInitialize()
    excel = None
    wb = None
    processed = 0

    try:
        excel = win32com.client.DispatchEx("Excel.Application")
        excel.Visible = False
        excel.DisplayAlerts = False
        excel.AutomationSecurity = 3  # msoAutomationSecurityForceDisable

        for student in students:
            matricula = student.get("matricula", "")
            nome = student.get("nome", "")
            cursos_list = student.get("cursos", [])
            if isinstance(cursos_list, list) and len(cursos_list) > 0 and isinstance(cursos_list[0], dict):
                cursos_list = [c.get("nome", "") for c in cursos_list]

            wb = excel.Workbooks.Open(TEMPLATE_PATH, ReadOnly=True)
            sheet = wb.Sheets("Frente")

            sheet.Range("A2").Value = f"Matrícula: {matricula}"
            sheet.Range("D2").Value = f"Nome do Aluno: {nome}"

            dt_inicio = expand_year(student.get("data_inicio_curso") or student.get("DATA_INICIO_CURSO", ""))
            dt_fim = expand_year(student.get("data_termino_curso") or student.get("DATA_TERMINO_CURSO", ""))
            if dt_inicio:
                sheet.Range("M5").Value = dt_inicio
            if dt_fim:
                sheet.Range("P5").Value = dt_fim

            sheet.Range("A3").Value = f"Email: {student.get('email') or student.get('EMAIL', '')}"
            sheet.Range("A4").Value = f"Data Nascimento: {student.get('data_nascimento') or student.get('DATA_NASCIMENTO', '')}"
            sheet.Range("D4").Value = f"Instrutor: {student.get('instrutor') or student.get('INSTRUTOR', '')}"
            sheet.Range("A5").Value = f"Telefone: {student.get('telefone') or student.get('TELEFONE', '')}"

            # Quadro de Horários nas caixas de texto (Shapes)
            tb_mapping = {
                "Segunda-feira": ("TextBox 7", "TextBox 15"),
                "Segunda": ("TextBox 7", "TextBox 15"),
                "Terça-feira": ("TextBox 6", "TextBox 14"),
                "Terça": ("TextBox 6", "TextBox 14"),
                "Quarta-feira": ("TextBox 5", "TextBox 13"),
                "Quarta": ("TextBox 5", "TextBox 13"),
                "Quinta-feira": ("TextBox 4", "TextBox 12"),
                "Quinta": ("TextBox 4", "TextBox 12"),
                "Sexta-feira": ("TextBox 3", "TextBox 11"),
                "Sexta": ("TextBox 3", "TextBox 11"),
                "Sábado": ("TextBox 2", "TextBox 10"),
                "Sabado": ("TextBox 2", "TextBox 10"),
                "Domingo": ("TextBox 1", "TextBox 9"),
            }

            # Normaliza schedule
            if schedule_info:
                dias_config = schedule_info.get("diasConfig", {})
                dias_semana = schedule_info.get("diasSemana", [])
                h_inicio_padrao = schedule_info.get("horarioInicio", "")
                h_fim_padrao = schedule_info.get("horarioFim", "")

                for dia, (tb_ini, tb_fim) in tb_mapping.items():
                    h_ini = ""
                    h_fim = ""
                    if dia in dias_config:
                        h_ini = dias_config[dia].get("inicio", "")
                        h_fim = dias_config[dia].get("fim", "")
                    elif dia in dias_semana or f"{dia}-feira" in dias_semana:
                        h_ini = h_inicio_padrao
                        h_fim = h_fim_padrao

                    if h_ini or h_fim:
                        try:
                            sheet.Shapes(tb_ini).TextFrame.Characters().Text = h_ini
                            sheet.Shapes(tb_fim).TextFrame.Characters().Text = h_fim
                        except Exception:
                            pass

            # Cursos: 18 slots (3 colunas x 6 linhas)
            row_slots = [10, 11, 12, 13, 14, 15]
            col_slots = ["A", "D", "H"]
            for idx, curso in enumerate(cursos_list):
                if idx >= 18:
                    break
                cell = f"{col_slots[idx // 6]}{row_slots[idx % 6]}"
                sheet.Range(cell).Value = f"{idx + 1}. {curso}"

            # Marcos da Carreira
            sheet.Range("P7").Value = student.get("data_linha_vida") or student.get("DATA_LINHA_VIDA", "")
            sheet.Range("P9").Value = student.get("data_form1") or student.get("DATA_FORM1", "")
            sheet.Range("P10").Value = student.get("data_form2") or student.get("DATA_FORM2", "")
            sheet.Range("P11").Value = student.get("data_dreamday") or student.get("DATA_DREAMDAY", "")
            sheet.Range("P13").Value = student.get("data_fechamento1") or student.get("DATA_FECHAMENTO_1", "")
            sheet.Range("P14").Value = student.get("data_fechamento2") or student.get("DATA_FECHAMENTO_2", "")
            sheet.Range("P15").Value = student.get("data_fechamento3") or student.get("DATA_FECHAMENTO_3", "")

            # Disparo nativo de impressão
            sheet.PrintOut(From=1, To=1, Copies=copies)

            if include_verso:
                try:
                    sheet_verso = wb.Sheets("Verso")
                    sheet_verso.PrintOut(From=1, To=1, Copies=copies)
                except Exception:
                    pass

            wb.Close(False)
            wb = None
            processed += 1

    finally:
        if wb:
            try:
                wb.Close(False)
            except Exception:
                pass
        if excel:
            try:
                excel.Quit()
            except Exception:
                pass
        pythoncom.CoUninitialize()

    return processed


class BridgeHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == "/status" or self.path == "/":
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()

            payload = {
                "status": "ready",
                "service": "Microlins Excel Print Bridge",
                "version": "1.0",
                "template_path": TEMPLATE_PATH,
                "template_exists": os.path.exists(TEMPLATE_PATH) if TEMPLATE_PATH else False,
            }
            self.wfile.write(json.dumps(payload).encode("utf-8"))
        else:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()

    def do_POST(self):
        if self.path == "/print":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")

            try:
                data = json.loads(body)
                students = data.get("students", [])
                schedule = data.get("schedule", {})
                include_verso = data.get("includeVerso", True)
                copies = int(data.get("copies", 1))

                if not students:
                    raise Exception("Nenhum aluno fornecido para impressão.")

                count = print_students_via_excel(students, schedule, include_verso, copies)

                self.send_response(200)
                self._send_cors_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()

                res = {
                    "success": True,
                    "count": count,
                    "message": f"{count} ficha(s) enviada(s) com sucesso para a impressora pelo Excel!",
                }
                self.wfile.write(json.dumps(res).encode("utf-8"))

            except Exception as e:
                self.send_response(500)
                self._send_cors_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()

                err_res = {
                    "success": False,
                    "error": str(e),
                    "traceback": traceback.format_exc(),
                }
                self.wfile.write(json.dumps(err_res).encode("utf-8"))
        else:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()

    def log_message(self, format, *args):
        # Silencia logs de requisição no console
        return


def run_server():
    server_address = ("127.0.0.1", PORT)
    httpd = HTTPServer(server_address, BridgeHandler)
    print(f"Microlins Excel Service ativo na porta {PORT}...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    run_server()
