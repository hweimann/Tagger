#!/usr/bin/env python3
import argparse
from pathlib import Path
import pandas as pd
import re

def find_family_tag_pairs(df):
    """
    Heurística para la hoja LISTAS: busca columnas con nombre de familia
    (LUGAR, TIPO, OBJETO, NIVEL, DISPOSITIVO, PROTECCION...) y a su derecha
    la columna TAG/TAG.x correspondiente.
    Devuelve dict: { "FAMILIA": {"Valor": "Código", ...}, ... }
    """
    families = {}
    cols = list(df.columns)

    def is_family_name(c):
        if not isinstance(c, str):
            return False
        c = c.strip()
        if not c or c.lower().startswith("unnamed"):
            return False
        # familias esperadas
        expected = {
            "LUGAR","TIPO","OBJETO","NIVEL","DISPOSITIVO",
            "PROTECCION_SECUNDARIA","PROTECCIÓN_SECUNDARIA","QUE","SEÑAL","NUMERO","NÚMERO"
        }
        return c.upper() in expected

    for i, cname in enumerate(cols):
        if is_family_name(cname):
            # buscar TAG cercano a la derecha
            tag_col = None
            for j in range(i+1, min(i+4, len(cols))):
                if isinstance(cols[j], str) and str(cols[j]).upper().startswith("TAG"):
                    tag_col = cols[j]; break
            if not tag_col:
                continue
            fam = cname.upper()
            # normalizar variantes
            if fam == "PROTECCIÓN_SECUNDARIA":
                fam = "PROTECCION_SECUNDARIA"
            if fam in ("NÚMERO","NUMERO"):
                fam = "NUMERO"
            sub = df[[cname, tag_col]].dropna()
            mapping = {}
            for _, row in sub.iterrows():
                key = str(row[cname]).strip()
                val = str(row[tag_col]).strip()
                if key and val and key.lower() != "nan" and val.lower() != "nan":
                    mapping[key] = val
            if mapping:
                families[fam] = mapping
    return families

def main():
    ap = argparse.ArgumentParser(description="Convierte Excel LISTAS/Reglas a CSVs por familia + reglas.csv")
    ap.add_argument("--excel", required=True, help="Ruta al Excel original (ej. ~/tagger-flask/data/Tagger.xlsx)")
    ap.add_argument("--outdir", default="data/listas", help="Directorio de salida para listas CSV")
    ap.add_argument("--rules_out", default="data/reglas.csv", help="Ruta de salida para reglas.csv")
    args = ap.parse_args()

    excel_path = Path(args.excel).expanduser().resolve()
    outdir = Path(args.outdir).expanduser().resolve()
    rules_out = Path(args.rules_out).expanduser().resolve()

    if not excel_path.exists():
        raise SystemExit(f"[ERROR] No existe el Excel: {excel_path}")

    # Leer hojas
    xls = pd.ExcelFile(excel_path, engine="openpyxl")
    # LISTAS
    if "LISTAS" not in xls.sheet_names:
        raise SystemExit("[ERROR] El Excel no tiene hoja 'LISTAS'")

    listas_df = pd.read_excel(xls, "LISTAS", engine="openpyxl")
    families = find_family_tag_pairs(listas_df)

    outdir.mkdir(parents=True, exist_ok=True)
    # Guardar cada familia como CSV Valor,Código
    for fam, mp in families.items():
        # nombre de archivo: usar guion bajo para espacios
        fname = fam.replace(" ", "_")
        # mantener "SEÑAL" con tilde; si prefieres sin tilde, descomenta la siguiente línea:
        # fname = fname.replace("Ñ", "N").replace("ñ","n")
        df = pd.DataFrame(list(mp.items()), columns=["Valor","Código"]).sort_values("Valor")
        out_csv = outdir / f"{fname}.csv"
        df.to_csv(out_csv, index=False)
        print(f"[OK] {fam}: {len(df)} filas -> {out_csv}")

    # Reglas: desde hoja "Reglas" si existe
    reglas = []
    if "Reglas" in xls.sheet_names:
        reglas_df = pd.read_excel(xls, "Reglas", engine="openpyxl").fillna("")
        # concatenar strings útiles de cualquier columna tipo texto
        for _, row in reglas_df.iterrows():
            for v in row.values:
                if isinstance(v, str) and v.strip():
                    reglas.append(v.strip())
        # deduplicar manteniendo orden
        seen = set(); reglas_clean = []
        for r in reglas:
            if r not in seen:
                reglas_clean.append(r); seen.add(r)
        reglas = reglas_clean

    # Guardar reglas.csv
    rules_out.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame({"Regla": reglas}).to_csv(rules_out, index=False)
    print(f"[OK] reglas.csv: {len(reglas)} reglas -> {rules_out}")

    print("\nListo ✅  (Si la app estaba corriendo, refrescá el navegador o reiniciá Flask)")

if __name__ == "__main__":
    main()
