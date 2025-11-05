import re
from unidecode import unidecode

def norm(s: str) -> str:
    """Normaliza texto: mayúsculas, sin tildes, sin caracteres raros (deja _ . -)."""
    if s is None:
        return ""
    s = unidecode(str(s)).upper().strip()
    s = re.sub(r"[^A-Z0-9_\.-]", "", s)
    return s

def generate_tag(payload: dict) -> dict:
    """
    TAG = [TIPO][LUGAR] . [SIGLAS] . [NIVEL][DISPOSITIVO][PROTECCION_SECUNDARIA][QUE][SEÑAL][NUMERO]
    Todos los valores deben venir como CÓDIGOS (no descripciones).
    """
    tipo   = norm(payload.get("TIPO", ""))
    lugar  = norm(payload.get("LUGAR", ""))
    siglas = norm(payload.get("SIGLAS", ""))
    nivel  = norm(payload.get("NIVEL", ""))
    disp   = norm(payload.get("DISPOSITIVO", ""))
    prot   = norm(payload.get("PROTECCION_SECUNDARIA", ""))
    que    = norm(payload.get("QUE", ""))
    senal  = norm(payload.get("SEÑAL", ""))
    numero = norm(payload.get("NUMERO", ""))

    errors = []
    if not tipo:
        errors.append("Falta código de TIPO")
    if not lugar:
        errors.append("Falta código de LUGAR")
    if not siglas:
        errors.append("Falta SIGLAS")

    if not errors:
        tag = f"{tipo}{lugar}.{siglas}.{nivel}{disp}{prot}{que}{senal}{numero}"
    else:
        tag = ""

    return {
        "tag": tag,
        "errors": errors,
        "parts": {
            "TIPO": tipo,
            "LUGAR": lugar,
            "SIGLAS": siglas,
            "NIVEL": nivel,
            "DISPOSITIVO": disp,
            "PROTECCION_SECUNDARIA": prot,
            "QUE": que,
            "SEÑAL": senal,
            "NUMERO": numero,
        },
    }
