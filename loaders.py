import json
import pandas as pd
import unicodedata, re as _re
import csv
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
TEMPLATES_PATH = BASE_DIR / "data" / "templates.json"
DELETED_SENTINEL = "__DELETED__"


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

def _csv_path_for_family(family: str) -> Path:
    """
    Devuelve el path del CSV para una familia dada.
    Ej.: family="DISPOSITIVO" → data/listas/dispositivo.csv
    """
    fam = _norm_key(family)   # DISPOSITIVO, LUGAR, QUE, etc.
    filename = fam.lower() + ".csv"
    return LISTAS_DIR / filename


def _read_family_csv(family: str) -> dict[str, str]:
    """
    Lee el CSV de una familia y devuelve {valor: codigo}.
    Intenta aceptar encabezados 'valor/codigo' o 'VALOR/CODIGO'.
    """
    path = _csv_path_for_family(family)
    result: dict[str, str] = {}
    if not path.exists():
        return result

    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        # Auto-detectar nombres de columnas
        field_val = None
        field_cod = None
        if reader.fieldnames:
            names = [n.lower() for n in reader.fieldnames]
            for i, n in enumerate(names):
                if n in ("valor", "nombre", "texto"):
                    field_val = reader.fieldnames[i]
                if n in ("codigo", "código", "code"):
                    field_cod = reader.fieldnames[i]
        for row in reader:
            k = (row.get(field_val) or "").strip() if field_val else ""
            v = (row.get(field_cod) or "").strip() if field_cod else ""
            if k:
                result[k] = v
    return result


def _write_family_csv(family: str, mapping: dict[str, str]) -> None:
    """
    Escribe el CSV de una familia usando encabezados 'valor,codigo'.
    Deja las filas ordenadas alfabéticamente por valor.
    """
    path = _csv_path_for_family(family)
    path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = ["valor", "codigo"]
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for k in sorted(mapping.keys(), key=lambda s: s.lower()):
            writer.writerow({"valor": k, "codigo": mapping[k]})


def _load_overrides() -> dict:
    """Compatibilidad: ya no usamos overrides, devolvemos dict vacío."""
    return {}


def _save_overrides(data: dict):
    OVERRIDE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OVERRIDE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ------------------ API pública pedida por app.py ------------------

def save_override_entry(family: str, key: str, value: str):
    """
    Guarda/actualiza una entrada directamente en el CSV de la familia.
    - family: nombre de la familia (TIPO, LUGAR, DISPOSITIVO, etc.)
    - key: valor visible en la lista (texto)
    - value: código asociado
    """
    family = _norm_key(family)
    data = _read_family_csv(family)
    data[key] = value
    _write_family_csv(family, data)


def delete_override_entry(family: str, key: str):
    """
    Elimina una entrada del CSV de la familia.
    Si el valor no existe, no hace nada.
    """
    family = _norm_key(family)
    data = _read_family_csv(family)
    if key in data:
        del data[key]
        _write_family_csv(family, data)



def get_overrides() -> dict:
    return {}


def load_templates() -> list:
    """Carga la lista de templates globales desde data/templates.json."""
    if TEMPLATES_PATH.exists():
        try:
            with open(TEMPLATES_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                # esperamos una lista de objetos
                return data if isinstance(data, list) else []
        except Exception:
            return []
    return []


def save_templates(templates: list):
    """Guarda la lista completa de templates globales."""
    TEMPLATES_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(TEMPLATES_PATH, "w", encoding="utf-8") as f:
        json.dump(templates, f, ensure_ascii=False, indent=2)


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

          # Ya no usamos overrides: las listas se leen directo de los CSV
    listas_map = {fam: dict(mp) for fam, mp in listas_raw.items()}


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
