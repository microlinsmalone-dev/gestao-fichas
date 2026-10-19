#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extrai o molde visual literal (300 DPI vetorial via EMF) e o mapa exato de
coordenadas das células e TextBoxes diretamente do ModeloFicha.xlsx usando
o motor oficial do Microsoft Excel (COM).
"""

import os
import json
import base64
import ctypes
import tempfile
import shutil
import win32com.client
from PIL import Image

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRIA_FICHAS_XLSX = r"D:\Malone\CriaFichas\ModeloFicha.xlsx"
TEMPLATE_XLSX = CRIA_FICHAS_XLSX if os.path.exists(CRIA_FICHAS_XLSX) else os.path.join(ROOT_DIR, "ModeloFicha.xlsx")
PUBLIC_TEMPLATES_DIR = os.path.join(ROOT_DIR, "public", "templates")
CONSTANTS_OUT = os.path.join(ROOT_DIR, "lib", "constants", "modelo-ficha-assets.ts")


def copy_range_to_high_dpi_png(sheet, range_addr, out_png_path, dpi=240):
    """
    Copia o Range do Excel como Metafile Vetorial (xlPicture = -4147)
    e rasteriza na resolução exata (DPI) sem margens externas.
    """
    sheet.Range(range_addr).CopyPicture(Appearance=1, Format=-4147)

    user32 = ctypes.windll.user32
    gdi32 = ctypes.windll.gdi32
    user32.GetClipboardData.restype = ctypes.c_void_p
    gdi32.CopyEnhMetaFileW.argtypes = [ctypes.c_void_p, ctypes.c_wchar_p]
    gdi32.CopyEnhMetaFileW.restype = ctypes.c_void_p
    gdi32.DeleteEnhMetaFile.argtypes = [ctypes.c_void_p]

    tmp_emf = os.path.join(tempfile.gettempdir(), f"microlins_mold_{os.getpid()}.emf")
    if os.path.exists(tmp_emf):
        os.remove(tmp_emf)

    user32.OpenClipboard(0)
    try:
        hemf = user32.GetClipboardData(14)  # CF_ENHMETAFILE
        if not hemf:
            raise RuntimeError(f"Falha ao obter CF_ENHMETAFILE para {range_addr}")
        hemf_copy = gdi32.CopyEnhMetaFileW(hemf, tmp_emf)
        gdi32.DeleteEnhMetaFile(hemf_copy)
    finally:
        user32.CloseClipboard()

    im = Image.open(tmp_emf)
    im.load(dpi=dpi)
    # Converte para RGB limpo e salva PNG otimizado
    if im.mode != "RGB":
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[3] if len(im.split()) == 4 else None)
        im = bg
    im.save(out_png_path, "PNG", optimize=True)
    im_size = im.size
    im.close()
    if os.path.exists(tmp_emf):
        os.remove(tmp_emf)
    return im_size


def measure_label_end_pt(img_path, total_w_pt, total_h_pt, cell_rect):
    """
    Localiza a coordenada X exata (em pontos do Excel) onde termina o texto do
    rótulo fixo (ex: 'Matrícula: ', '1. ') dentro da célula renderizada pelo Excel.
    """
    im = Image.open(img_path).convert("L")
    px_w, px_h = im.size
    scale_x = px_w / total_w_pt
    scale_y = px_h / total_h_pt

    # Recorta internamente evitando as linhas de borda da célula (2pt de margem interna)
    x0 = int((cell_rect["left"] + 2.0) * scale_x)
    y0 = int((cell_rect["top"] + 2.5) * scale_y)
    x1 = int((cell_rect["left"] + cell_rect["width"] - 2.0) * scale_x)
    y1 = int((cell_rect["top"] + cell_rect["height"] - 2.5) * scale_y)

    max_dark_x = x0
    pixels = im.load()
    for y in range(y0, y1):
        for x in range(x0, x1):
            if pixels[x, y] < 200:  # pixel de texto
                if x > max_dark_x:
                    max_dark_x = x
    im.close()
    # Retorna em pontos do Excel + 3.5pt de espaçamento após os dois-pontos/ponto
    return round((max_dark_x / scale_x) + 3.5, 2)


def main():
    os.makedirs(PUBLIC_TEMPLATES_DIR, exist_ok=True)
    # Copia também o binário original para public/templates/ModeloFicha.xlsx
    shutil.copyfile(TEMPLATE_XLSX, os.path.join(PUBLIC_TEMPLATES_DIR, "ModeloFicha.xlsx"))

    # Faz uma cópia temporária para limpar apenas os 'h' das caixas de horário
    tmp_xlsx = os.path.join(tempfile.gettempdir(), "ModeloFicha_mold_temp.xlsx")
    shutil.copyfile(TEMPLATE_XLSX, tmp_xlsx)

    excel = win32com.client.DispatchEx("Excel.Application")
    excel.Visible = False
    excel.DisplayAlerts = False

    try:
        wb = excel.Workbooks.Open(tmp_xlsx)
        frente = wb.Sheets("Frente")
        verso = wb.Sheets("Verso")

        # Dimensões totais em pontos do Excel
        frente_range = frente.Range("A1:P59")
        total_w = float(frente_range.Width)
        total_h = float(frente_range.Height)

        verso_range = verso.Range("A1:P49")
        verso_w = float(verso_range.Width)
        verso_h = float(verso_range.Height)

        def get_rect(rng):
            return {
                "left": round(float(rng.Left), 2),
                "top": round(float(rng.Top), 2),
                "width": round(float(rng.Width), 2),
                "height": round(float(rng.Height), 2),
            }

        # Mapeia todas as células dinâmicas na Frente
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

        # Mapeia os 18 slots de cursos
        courses_map = {}
        for i in range(1, 7):
            r = 9 + i
            courses_map[str(i)] = get_rect(frente.Range(f"A{r}:C{r}"))
            courses_map[str(i + 6)] = get_rect(frente.Range(f"D{r}:G{r}"))
            courses_map[str(i + 12)] = get_rect(frente.Range(f"H{r}:L{r}"))

        # Mapeia as TextBoxes de horários e limpa o 'h' para o molde limpo
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
                "inicio": {
                    "left": round(float(s_ini.Left), 2),
                    "top": round(float(s_ini.Top), 2),
                    "width": round(float(s_ini.Width), 2),
                    "height": round(float(s_ini.Height), 2),
                },
                "fim": {
                    "left": round(float(s_fim.Left), 2),
                    "top": round(float(s_fim.Top), 2),
                    "width": round(float(s_fim.Width), 2),
                    "height": round(float(s_fim.Height), 2),
                },
            }
            # Limpa apenas o texto 'h' mantendo a caixa e suas bordas intactas
            s_ini.TextFrame.Characters().Text = ""
            s_fim.TextFrame.Characters().Text = ""

        # Padroniza TextBox 8 conforme Imagem 1 de referência ("Gerado por aplicação. V1.0")
        try:
            frente.Shapes("TextBox 8").TextFrame.Characters().Text = "Gerado por aplicação. V1.0"
        except Exception:
            pass

        frente_png = os.path.join(PUBLIC_TEMPLATES_DIR, "molde-frente.png")
        verso_png = os.path.join(PUBLIC_TEMPLATES_DIR, "molde-verso.png")

        frente_px = copy_range_to_high_dpi_png(frente, "A1:P59", frente_png, dpi=240)
        verso_px = copy_range_to_high_dpi_png(verso, "A1:P49", verso_png, dpi=240)

        print(f"Frente PNG gerado: {frente_px}, Verso PNG gerado: {verso_px}")

        wb.Close(False)
    finally:
        excel.Quit()
        if os.path.exists(tmp_xlsx):
            os.remove(tmp_xlsx)

    # Mede o ponto exato onde termina cada rótulo fixo ('Matrícula: ', '1. ', etc.)
    for key in ["matricula", "nome", "email", "data_nascimento", "instrutor", "telefone"]:
        rect = cells_map[key]
        text_left = measure_label_end_pt(frente_png, total_w, total_h, rect)
        rect["valueLeft"] = text_left
        rect["valueWidth"] = round(rect["left"] + rect["width"] - text_left - 2.0, 2)

    for idx_str, rect in courses_map.items():
        text_left = measure_label_end_pt(frente_png, total_w, total_h, rect)
        rect["valueLeft"] = text_left
        rect["valueWidth"] = round(rect["left"] + rect["width"] - text_left - 2.0, 2)

    # Codifica o ModeloFicha.xlsx original e as imagens em Base64 / constantes
    with open(TEMPLATE_XLSX, "rb") as f:
        xlsx_b64 = base64.b64encode(f.read()).decode("ascii")

    with open(frente_png, "rb") as f:
        frente_b64 = "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")

    with open(verso_png, "rb") as f:
        verso_b64 = "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")

    layout_data = {
        "frenteWidthPt": total_w,
        "frenteHeightPt": total_h,
        "versoWidthPt": verso_w,
        "versoHeightPt": verso_h,
        "cells": cells_map,
        "courses": courses_map,
        "schedule": schedule_boxes,
    }

    ts_content = f"""// ==============================================================================
// ARQUIVO GERADO AUTOMATICAMENTE A PARTIR DO MODELOFICHA.XLSX OFICIAL
// Contém o molde literal exportado pelo Microsoft Excel, o binário original
// da planilha ModeloFicha.xlsx em Base64 e as coordenadas exatas em pontos (pt).
// ==============================================================================

export const MODELO_FICHA_LAYOUT = {json.dumps(layout_data, indent=2, ensure_ascii=False)} as const;

export const MODELO_FICHA_XLSX_BASE64 = "{xlsx_b64}";

export const MOLDE_FRENTE_DATA_URL = "{frente_b64}";

export const MOLDE_VERSO_DATA_URL = "{verso_b64}";
"""

    with open(CONSTANTS_OUT, "w", encoding="utf-8") as f:
        f.write(ts_content)

    print("Constantes salvas com sucesso em:", CONSTANTS_OUT)
    print("Tamanho de modelo-ficha-assets.ts:", os.path.getsize(CONSTANTS_OUT), "bytes")


if __name__ == "__main__":
    main()
