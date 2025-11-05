from flask import Flask, request, render_template, jsonify
from loaders import (
    load_excel,
    save_override_entry,
    delete_override_entry,
    get_overrides,
    LISTAS_DIR,
    _norm_key,
)
from tagger import generate_tag

app = Flask(__name__)

# Cargar datos al iniciar
LISTAS_MAP, REGLAS_TEXTO, _ = load_excel()

def families_for_ui():
    # Para cada familia devolvemos la lista de VALORES (descripciones) ordenados
    return {fam: sorted(mp.keys()) for fam, mp in LISTAS_MAP.items()}

@app.get("/")
def index():
    global LISTAS_MAP, REGLAS_TEXTO, _
    LISTAS_MAP, REGLAS_TEXTO, _ = load_excel()
    return render_template("index.html", familias=families_for_ui(), reglas=REGLAS_TEXTO)

# ====== GENERAR TAG + DESCRIPCION ======
@app.post("/api/generate")
def api_generate():
    data = request.get_json(force=True)

    # Mapear NOMBRE seleccionado -> CÓDIGO
    def code(fam, name):
        mp = LISTAS_MAP.get(fam, {})
        return mp.get(name or "", name or "")

    payload = {
        "TIPO": code("TIPO", data.get("tipo_name")),
        "LUGAR": code("LUGAR", data.get("lugar_name")),
        "SIGLAS": (data.get("siglas") or ""),
        "NIVEL": code("NIVEL", data.get("nivel")),
        "DISPOSITIVO": code("DISPOSITIVO", data.get("cod_disp_name")),
        "PROTECCION_SECUNDARIA": code("PROTECCION SECUNDARIA", data.get("prot_sec_name")),
        "QUE": code("QUE", data.get("que_name")),
        "SEÑAL": code("SEÑAL", data.get("senal_name")),
        "NUMERO": code("NUMERO", data.get("numero_name")),
    }

       # === Descripción (usar NOMBRE en NIVEL, QUE y SEÑAL) ===
    def norm(s: str) -> str:
        return (s or "").lower().strip()

    # nombre elegido por el usuario (no código)
    nivel_name = (data.get("nivel") or "").strip()
    que_name   = (data.get("que_name") or "").strip()
    senal_name = (data.get("senal_name") or "").strip()

    # regla especial para DISPOSITIVO según el NOMBRE elegido
    disp_name = (data.get("cod_disp_name") or "").strip()
    dn = norm(disp_name)
    if "ied" in dn:
        disp_token = ""
    elif "sobrecorriente temporizada a tierra" in dn:
        disp_token = "Io>"
    elif "sobrecorriente instantanea a tierra" in dn:
        disp_token = "Io>>"
    elif "sobrecorriente temporizada" in dn:
        disp_token = "I>"
    elif "sobrecorriente instantanea" in dn:
        disp_token = "I>>"
    elif "sobrecorriente general" in dn:
        disp_token = "general"
    else:
        disp_token = payload["DISPOSITIVO"]  # fallback: código

    # TIPO(cod)+LUGAR(cod) + ' ' + SIGLAS + ' ' + NIVEL(nombre) + ' ' +
    # QUE(nombre) + ' ' + disp_token + (' ' si hay) + SEÑAL(nombre) + NUMERO(cod)
    parts = [
        payload["TIPO"] + payload["LUGAR"],
        " ",
        payload["SIGLAS"],
        " ",
        nivel_name,
        " ",
        que_name,
        " ",
        disp_token,
        " " if disp_token else "",
        senal_name + (payload["NUMERO"] or ""),
    ]
    descripcion = "".join(parts).strip()


    # Resultado original del tag + adjuntar descripcion
    result = generate_tag(payload)
    result["descripcion"] = descripcion
    return jsonify(result)

# ---------- Editor de listas ----------
@app.get("/tables")
def tables_page():
    """
    Muestra SIEMPRE todas las familias:
    - en memoria (LISTAS_MAP)
    - en overrides
    - detectadas por nombre de archivo CSV en data/listas/*.csv
    """
    global LISTAS_MAP, REGLAS_TEXTO, _
    LISTAS_MAP, REGLAS_TEXTO, _ = load_excel()

    fams_mem = set(LISTAS_MAP.keys())
    fams_ov = set(get_overrides().keys())

    fams_csv = set()
    if LISTAS_DIR.exists():
        for f in LISTAS_DIR.glob("*.csv"):
            fams_csv.add(_norm_key(f.stem))

    familias = sorted(fams_mem | fams_ov | fams_csv)
    return render_template("tables.html", familias=familias)

@app.get("/api/lists")
def api_lists():
    return jsonify({"lists": LISTAS_MAP, "overrides": get_overrides()})

@app.post("/api/lists/upsert")
def api_lists_upsert():
    payload = request.get_json(force=True)
    fam = (payload.get("family") or "").strip()
    key = (payload.get("key") or "").strip()
    val = (payload.get("value") or "").strip()
    if not fam or not key or not val:
        return jsonify({"ok": False, "error": "family/key/value requeridos"}), 400
    save_override_entry(fam, key, val)
    global LISTAS_MAP, REGLAS_TEXTO, _
    LISTAS_MAP, REGLAS_TEXTO, _ = load_excel()
    return jsonify({"ok": True})

@app.post("/api/lists/delete")
def api_lists_delete():
    payload = request.get_json(force=True)
    fam = (payload.get("family") or "").strip()
    key = (payload.get("key") or "").strip()
    if not fam or not key:
        return jsonify({"ok": False, "error": "family/key requeridos"}), 400
    delete_override_entry(fam, key)
    global LISTAS_MAP, REGLAS_TEXTO, _
    LISTAS_MAP, REGLAS_TEXTO, _ = load_excel()
    return jsonify({"ok": True})

# ---------- Debug opcional ----------
@app.get("/api/debug-familias")
def api_debug_familias():
    return jsonify({
        "keys": list(LISTAS_MAP.keys()),
        "prot_sec_size": len(LISTAS_MAP.get("PROTECCION SECUNDARIA", {})),
        "sample": dict(list(LISTAS_MAP.get("PROTECCION SECUNDARIA", {}).items())[:5]),
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
