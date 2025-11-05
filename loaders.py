import json
import pandas as pd
import unicodedata, re as _re
from pathlib import Path

# --- Config base_dir (si tienes config.py con BASE_DIR, puedes importar de ahí) ---
try:
    from config import BASE_DIR  # opcional
except Exception:
    BASE_DIR = Path(__file__).resolve().parent

LISTAS_DIR   = BASE_DIR / "data" / "listas"
OVERRIDE_PATH = BASE_DIR / "data" / "lists_override.json"
REGLAS_CSV   = BASE_DIR / "data" / "reglas.csv"
REGLAS_TXT   = BASE_DIR / "data" / "reglas.txt"

# ------------------ utilidades ------------------

def _norm_key(k: str) -> str:
    """Normaliza el nombre de familia para evitar problemas de acentos/espacios/guiones."""
    s = unicodedata.normalize("NFD", str(k)).encode("ascii", "ignore").decode()
    s = s.upper().strip()
    s = s.replace("_", " ").replace(".", " ")
    s = _re.sub(r"\s+", " ", s)

    # Alias canónicos
    if s in ("PROTECCION SECUNDARIA", "PROTECCION SEC", "PROT SEC", "PROT SECUNDARIA"):
        s = "PROTECCION SECUNDARIA"
    if s in ("SENAL", "SENAL ", "SEÑAL"):
        s = "SEÑAL"
    if s in ("NUMERO", "NÚMERO"):
        s = "NUMERO"
    return s

def _load_overrides() -> dict:
    if OVERRIDE_PATH.exists():
        try:
            with open(OVERRIDE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                # normalizamos claves por si vinieron “raras”
                return {_norm_key(k): v for k, v in (data or {}).items()}
        except Exception:
            return {}
    return {}

def _save_overrides(data: dict):
    OVERRIDE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OVERRIDE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ------------------ API pública pedida por app.py ------------------

def save_override_entry(family: str, key: str, value: str):
    """Agrega/actualiza una entrada en overrides (pisa al CSV)."""
    family = _norm_key(family)
    data = _load_overrides()
    fam = data.get(family, {})
    fam[key] = value
    data[family] = fam
    _save_overrides(data)

def delete_override_entry(family: str, key: str):
    """Elimina una entrada de overrides."""
    family = _norm_key(family)
    data = _load_overrides()
    fam = data.get(family, {})
    if key in fam:
        del fam[key]
        data[family] = fam
        _save_overrides(data)

def get_overrides() -> dict:
    """Devuelve el JSON de overrides tal cual (con claves ya normalizadas)."""
    return _load_overrides()

# ------------------ loader principal ------------------

def _read_csv_flexible(path: Path) -> pd.DataFrame:
    """
    Lee un CSV tolerante a:
      - separador coma o punto y coma
      - encabezados con/ sin tilde / espacios / mayúsculas
    """
    try:
        df = pd.read_csv(path, dtype=str).fillna("")
    except Exception:
        df = pd.read_csv(path, dtype=str, sep=";").fillna("")

    # normalizamos nombres de columnas para localizar Valor/Código
    norm_cols = {c: _re.sub(r"\s+", "", str(c)).lower() for c in df.columns}

    def pick(*cands):
        for k, v in norm_cols.items():
            if v in cands:
                return k
        return None

    col_valor  = pick("valor", "valores")
    col_codigo = pick("codigo", "código", "cod")

    if not col_valor or not col_codigo:
        raise ValueError(f"Encabezados inválidos ({list(df.columns)}), se esperaban Valor/Código (coma o ';')")

    # Devolvemos sólo esas dos columnas con nombres estandarizados
    out = pd.DataFrame({
        "Valor":  df[col_valor].astype(str).str.strip(),
        "Código": df[col_codigo].astype(str).str.strip(),
    })
    # Filtramos vacíos
    out = out[(out["Valor"] != "") & (out["Código"] != "")]
    return out

def load_excel():
    """
    Carga listas desde data/listas/*.csv (Valor,Código),
    aplica overrides (prioridad), y lee reglas de reglas.csv o reglas.txt.
    Devuelve: (listas_map, reglas_texto, None)
    """
    listas_raw = {}

    if LISTAS_DIR.exists():
        for csv_file in LISTAS_DIR.glob("*.csv"):
            fam = _norm_key(csv_file.stem)
            try:
                df = _read_csv_flexible(csv_file)
                mapping = dict(zip(df["Valor"], df["Código"]))
                if mapping:
                    listas_raw[fam] = mapping
                    # print(f"[INFO] {fam}: {len(mapping)} filas ({csv_file.name})")
            except Exception as e:
                print(f"[WARN] No se pudo leer {csv_file.name}: {e}")

    # aplicar overrides
    overrides = _load_overrides()
    listas_map = {}
    for fam, mp in listas_raw.items():
        base = dict(mp)
        ov = overrides.get(fam, {})
        base.update(ov)
        listas_map[fam] = base

    # reglas
    reglas_texto = []
    if REGLAS_CSV.exists():
        try:
            rdf = _read_csv_flexible(REGLAS_CSV)
            # si el CSV de reglas tiene "Regla" como Valor y "Código" vacío, igual sirve
            if "Valor" in rdf.columns and len(rdf):
                reglas_texto = [r for r in rdf["Valor"].tolist() if r.strip()]
        except Exception:
            # fallback a un CSV normal con columna 'Regla'
            try:
                df = pd.read_csv(REGLAS_CSV, dtype=str).fillna("")
                col = None
                for c in df.columns:
                    if str(c).strip().lower() in ("regla", "texto", "descripcion", "descripción"):
                        col = c; break
                if col:
                    reglas_texto = [r for r in df[col].tolist() if str(r).strip()]
            except Exception as e:
                print(f"[WARN] No se pudo leer reglas.csv: {e}")

    if not reglas_texto and REGLAS_TXT.exists():
        try:
            with open(REGLAS_TXT, "r", encoding="utf-8") as f:
                reglas_texto = [line.strip() for line in f if line.strip()]
        except Exception as e:
            print(f"[WARN] No se pudo leer reglas.txt: {e}")

    return listas_map, reglas_texto, None
