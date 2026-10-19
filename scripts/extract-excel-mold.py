#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extrai o mapa vetorial 100% literal (todas as células, áreas mescladas, cores,
fontes, alinhamentos e Shapes com coordenadas exatas Left/Top/Width/Height em pt)
diretamente do ModeloFicha.xlsx via Microsoft Excel COM, além do binário .xlsx.
"""

import os
import json
import base64
import shutil
import win32com.client

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRIA_FICHAS_XLSX = r"D:\Malone\CriaFichas\ModeloFicha.xlsx"
TEMPLATE_XLSX = CRIA_FICHAS_XLSX if os.path.exists(CRIA_FICHAS_XLSX) else os.path.join(ROOT_DIR, "ModeloFicha.xlsx")
PUBLIC_TEMPLATES_DIR = os.path.join(ROOT_DIR, "public", "templates")
CONSTANTS_OUT = os.path.join(ROOT_DIR, "lib", "constants", "modelo-ficha-assets.ts")


def bgr_int_to_hex(bgr_val):
    if bgr_val is None:
        return None
    val = int(bgr_val)
    r = val & 0xFF
    g = (val >> 8) & 0xFF
    b = (val >> 16) & 0xFF
    return f"#{r:02X}{g:02X}{b:02X}"


def extract_sheet_vector_cells(sheet, max_row, max_col=16):
    """
    Percorre todas as células e áreas mescladas (1..max_row, 1..max_col)
    extraindo as coordenadas exatas em pontos (pt) diretamente do Excel COM.
    """
    visited = set()
    vector_cells = []

    # xlCenter = -4108, xlRight = -4152
    for r in range(1, max_row + 1):
        for c in range(1, max_col + 1):
            if (r, c) in visited:
                continue
            cell = sheet.Cells(r, c)
            ma = cell.MergeArea
            start_r = int(ma.Row)
            start_c = int(ma.Column)
            rows_cnt = int(ma.Rows.Count)
            cols_cnt = int(ma.Columns.Count)

            for mr in range(start_r, start_r + rows_cnt):
                for mc in range(start_c, start_c + cols_cnt):
                    visited.add((mr, mc))

            addr = ma.Address.replace("$", "")
            left = round(float(ma.Left), 2)
            top = round(float(ma.Top), 2)
            width = round(float(ma.Width), 2)
            height = round(float(ma.Height), 2)

            raw_text = str(cell.Text or "")
            text = raw_text.strip()

            # Cor de preenchimento
            interior_idx = int(cell.Interior.ColorIndex or -4142)
            bg_hex = None
            if interior_idx != -4142:
                c_hex = bgr_int_to_hex(cell.Interior.Color)
                if c_hex and c_hex != "#FFFFFF":
                    bg_hex = c_hex

            # Fonte
            font_size = float(cell.Font.Size or 9.0)
            bold = bool(cell.Font.Bold)
            font_color = bgr_int_to_hex(cell.Font.Color) or "#000000"

            # Alinhamento horizontal
            h_align_val = int(cell.HorizontalAlignment or 1)
            if h_align_val == -4108:
                align = "center"
            elif h_align_val == -4152:
                align = "right"
            elif "/" in text and len(text.replace("/", "").strip()) == 0:
                align = "center"
            elif text == "h":
                align = "center"
            else:
                align = "left"

            orientation = int(cell.Orientation or 0)

            vector_cells.append({
                "addr": addr,
                "row": start_r,
                "col": start_c,
                "left": left,
                "top": top,
                "width": width,
                "height": height,
                "text": text,
                "bg": bg_hex,
                "color": font_color,
                "fontSize": font_size,
                "bold": bold,
                "align": align,
                "vertical": orientation == 90,
            })

    return vector_cells


def main():
    os.makedirs(PUBLIC_TEMPLATES_DIR, exist_ok=True)
    shutil.copyfile(TEMPLATE_XLSX, os.path.join(PUBLIC_TEMPLATES_DIR, "ModeloFicha.xlsx"))

    excel = win32com.client.DispatchEx("Excel.Application")
    excel.Visible = False
    excel.DisplayAlerts = False

    try:
        wb = excel.Workbooks.Open(TEMPLATE_XLSX, ReadOnly=True)
        frente = wb.Sheets("Frente")
        verso = wb.Sheets("Verso")

        frente_range = frente.Range("A1:P59")
        total_w = round(float(frente_range.Width), 2)
        total_h = round(float(frente_range.Height), 2)

        verso_range = verso.Range("A1:P49")
        verso_w = round(float(verso_range.Width), 2)
        verso_h = round(float(verso_range.Height), 2)

        def get_rect(rng):
            return {
                "left": round(float(rng.Left), 2),
                "top": round(float(rng.Top), 2),
                "width": round(float(rng.Width), 2),
                "height": round(float(rng.Height), 2),
            }

        frente_cells = extract_sheet_vector_cells(frente, 59, 16)
        verso_cells = extract_sheet_vector_cells(verso, 49, 16)

        # Mapeia os rótulos de dias da semana (TextBox 16..22)
        day_header_shapes = [
            ("Segunda", "TextBox 22"),
            ("Terça", "TextBox 21"),
            ("Quarta", "TextBox 20"),
            ("Quinta", "TextBox 19"),
            ("Sexta", "TextBox 18"),
            ("Sábado", "TextBox 17"),
            ("Domingo", "TextBox 16"),
        ]
        weekday_headers = []
        for label, s_name in day_header_shapes:
            sh = frente.Shapes(s_name)
            weekday_headers.append({
                "label": label,
                "left": round(float(sh.Left), 2),
                "top": round(float(sh.Top), 2),
                "width": round(float(sh.Width), 2),
                "height": round(float(sh.Height), 2),
            })

        # Mapeia as TextBoxes de horários (TextBox 1..7 e TextBox 9..15)
        day_tb_pairs = {
            "Segunda": ("TextBox 7", "TextBox 15"),
            "Terça": ("TextBox 6", "TextBox 14"),
            "Quarta": ("TextBox 5", "TextBox 13"),
            "Quinta": ("TextBox 4", "TextBox 12"),
            "Sexta": ("TextBox 3", "TextBox 11"),
            "Sábado": ("TextBox 2", "TextBox 10"),
            "Domingo": ("TextBox 1", "TextBox 9"),
        }

        schedule_boxes = {}
        for day, (tb_ini_name, tb_fim_name) in day_tb_pairs.items():
            s_ini = frente.Shapes(tb_ini_name)
            s_fim = frente.Shapes(tb_fim_name)
            schedule_boxes[day] = {
                "inicio": get_rect(s_ini),
                "fim": get_rect(s_fim),
            }

        # Logo e Texto de versão no cabeçalho
        logo_shape = frente.Shapes("Picture 23")
        version_shape = frente.Shapes("TextBox 8")
        header_shapes = {
            "logo": get_rect(logo_shape),
            "version": {
                **get_rect(version_shape),
                "text": "Gerado por aplicação. V1.0",
            },
        }

        # Células dinâmicas para acesso direto
        cells_map = {
            "matricula": get_rect(frente.Range("A2:C2")),
            "nome": get_rect(frente.Range("D2:L2")),
            "email": get_rect(frente.Range("A3:L3")),
            "data_nascimento": get_rect(frente.Range("A4:C4")),
            "instrutor": get_rect(frente.Range("D4:L4")),
            "telefone": get_rect(frente.Range("A5:L5")),
            "data_inicio_curso": get_rect(frente.Range("M5:O6")),
            "data_termino_curso": get_rect(frente.Range("P5:P6")),
            "data_linha_vida": get_rect(frente.Range("P7:P8")),
            "data_form1": get_rect(frente.Range("P9")),
            "data_form2": get_rect(frente.Range("P10")),
            "data_dream_day": get_rect(frente.Range("P11:P12")),
            "data_fechamento1": get_rect(frente.Range("P13")),
            "data_fechamento2": get_rect(frente.Range("P14")),
            "data_fechamento3": get_rect(frente.Range("P15")),
        }

        courses_map = {}
        for i in range(1, 7):
            r = 9 + i
            courses_map[str(i)] = get_rect(frente.Range(f"A{r}:C{r}"))
            courses_map[str(i + 6)] = get_rect(frente.Range(f"D{r}:G{r}"))
            courses_map[str(i + 12)] = get_rect(frente.Range(f"H{r}:L{r}"))

        wb.Close(False)
    finally:
        excel.Quit()

    with open(TEMPLATE_XLSX, "rb") as f:
        xlsx_b64 = base64.b64encode(f.read()).decode("ascii")

    layout_data = {
        "frenteWidthPt": total_w,
        "frenteHeightPt": total_h,
        "versoWidthPt": verso_w,
        "versoHeightPt": verso_h,
        "cells": cells_map,
        "courses": courses_map,
        "schedule": schedule_boxes,
        "weekdayHeaders": weekday_headers,
        "headerShapes": header_shapes,
        "frenteVectorCells": frente_cells,
        "versoVectorCells": verso_cells,
    }

    ts_content = f"""// ==============================================================================
// ARQUIVO GERADO AUTOMATICAMENTE A PARTIR DO MODELOFICHA.XLSX OFICIAL
// Contém o mapa vetorial 100% literal (coordenadas exatas Left/Top/Width/Height
// em pontos de todas as células e Shapes do Excel) e o binário ModeloFicha.xlsx.
// ==============================================================================

export interface VectorCellSpec {{
  addr: string;
  row: number;
  col: number;
  left: number;
  top: number;
  width: number;
  height: number;
  text: string;
  bg: string | null;
  color: string;
  fontSize: number;
  bold: boolean;
  align: string;
  vertical: boolean;
}}

export const MODELO_FICHA_LAYOUT = {json.dumps(layout_data, indent=2, ensure_ascii=False)};

export const MODELO_FICHA_XLSX_BASE64 = "{xlsx_b64}";
"""

    with open(CONSTANTS_OUT, "w", encoding="utf-8") as f:
        f.write(ts_content)

    print(f"Frente vector cells: {len(frente_cells)}, Verso vector cells: {len(verso_cells)}")
    print("Tamanho de modelo-ficha-assets.ts:", os.path.getsize(CONSTANTS_OUT), "bytes")


if __name__ == "__main__":
    main()
