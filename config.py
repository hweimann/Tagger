from pathlib import Path


# Ruta al Excel (ajustala si lo ubicás en otro lado)
BASE_DIR = Path(__file__).resolve().parent
EXCEL_PATH = BASE_DIR / "data" / "Tagger.xlsx"

# Agregá/ajustá estas dos líneas
SEPARATOR = "."  # si querés separador global, p.ej. "_" o "."
TAG_TEMPLATE_ORDER = ["TIPO","LUGAR","OBJETO","SIGLAS","NIVEL","DISPOSITIVO","PROTECCION_SECUNDARIA","QUE","SEÑAL","NUMERO"]

# Regex global de validación
REGEX_GLOBAL = r"^[A-Z0-9_\.]{3,64}$"

# Truncamientos por segmento (opcional)
TRUNC = {
    "TIPO": 4,
    "LUGAR": 4,
    "SIGLAS": 16,
    "COD_DISP": 8,
    "COD_ACCION": 8,
}