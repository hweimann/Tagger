/* ====== Helpers de UI ====== */
function opt(text) { const o = document.createElement("option"); o.value = text; o.textContent = text; return o; }
function selectWithOptions(options) { const s = document.createElement("select"); s.appendChild(opt("")); (options||[]).forEach(v=>s.appendChild(opt(v))); return s; }
function famOptions(name){
  const tries = [
    name, name.replace(/_/g," "), name.replace(/ /g,"_"),
    name.normalize("NFD").replace(/[\u0300-\u036f]/g,""),
    name.replace(/ /g,"_").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  ];
  for (const t of tries){ if (FAMILIAS[t]) return FAMILIAS[t]; }
  return [];
}
function normalizeAcentosMayus(s){ return (s||"").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().trim(); }
function isTransformador(text){ return normalizeAcentosMayus(text).includes("TRANSFORMADOR"); }

/* ====== Backend ====== */
async function generateOne(payload) {
  const resp = await fetch("/api/generate", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify(payload)
  });
  return resp.json();
}

/* ====== Fila <-> payload ====== */
function payloadFromRow(tr) {
  const tds = tr.querySelectorAll("td");
  const getVal = i => { const el = tds[i]?.querySelector("select, input, textarea"); return el ? el.value : ""; };
  return {
    ref:            getVal(0),
    tipo_name:      getVal(1),
    lugar_name:     getVal(2),
    objeto_name:    getVal(3),
    siglas:         getVal(4),
    nivel:          getVal(5),
    cod_disp_name:  getVal(6),
    prot_sec_name:  getVal(7),
    que_name:       getVal(8),
    senal_name:     getVal(9),
    numero_name:    getVal(10),
  };
}

/* ====== Outputs por fila ====== */
function setRowOutputs(tr, data) {
  const tagCell = tr.querySelector(".tag");
  const descCell = tr.querySelector(".desc");
  if (!data || (data.errors && data.errors.length)) {
    tagCell.textContent = "—";
    tagCell.title = (data?.errors || []).join(", ");
    tagCell.classList.add("muted");
    if (descCell) { descCell.textContent = "—"; descCell.title = ""; descCell.classList.add("muted"); }
  } else {
    tagCell.textContent = data.tag || "—";
    tagCell.title = data.tag || "";
    tagCell.classList.remove("muted");
    if (descCell) {
      descCell.textContent = data.descripcion || "—";
      descCell.title = data.descripcion || "";
      descCell.classList.toggle("muted", !data.descripcion);
    }
  }
}

async function refreshRow(tr) {
  try {
    const data = await generateOne(payloadFromRow(tr));
    setRowOutputs(tr, data);
  } catch (e) {
    setRowOutputs(tr, {errors:["Error al generar"]});
  }
}

/* ====== Crear fila ====== */
function newRow(prefill = {}) {
  const tr = document.createElement("tr");

  // REF multiline
  const ref = document.createElement("textarea");
  ref.className = "refinput";
  ref.placeholder = "Referencia";
  ref.rows = 2;
  function autosizeRef(){ ref.style.height = "auto"; ref.style.height = (ref.scrollHeight) + "px"; }
  ref.addEventListener("input", autosizeRef);

  const tipo   = autoField("TIPO",                    prefill.tipo_name || "");
  const lugar  = autoField("LUGAR",                   prefill.lugar_name || "");
  const objeto = autoField("OBJETO",                  prefill.objeto_name || "");
  const siglas = document.createElement("input"); siglas.placeholder = "libre";
  const nivel  = autoField("NIVEL",                   prefill.nivel || "");
const disp   = autoField("DISPOSITIVO",             prefill.cod_disp_name || "");
const prot   = autoField("PROTECCION SECUNDARIA",   prefill.prot_sec_name || "");
const que    = autoField("QUE",                     prefill.que_name || "");
const senal  = autoField("SEÑAL",                   prefill.senal_name || "");
const numero = autoField("NUMERO",                  prefill.numero_name || "");

  // precarga
  ref.value     = prefill.ref || "";
  tipo.value    = prefill.tipo_name   || "";
  lugar.value   = prefill.lugar_name  || "";
  objeto.value  = prefill.objeto_name || "";
  siglas.value  = prefill.siglas      || "";
  nivel.value   = prefill.nivel       || "";
  disp.value    = prefill.cod_disp_name || "";
  prot.value    = prefill.prot_sec_name || "";
  que.value     = prefill.que_name      || "";
  senal.value   = prefill.senal_name    || "";
  numero.value  = prefill.numero_name   || "";

  // celdas principales
  const cells = [ref,tipo,lugar,objeto,siglas,nivel,disp,prot,que,senal,numero];
  cells.forEach((el, idx) => {
    const td = document.createElement("td");
    td.className = idx === 0 ? "col refcol" : "col";
    td.appendChild(el);
    tr.appendChild(td);
  });

  // TAG
  const tdTag = document.createElement("td"); tdTag.className="tag tagcol muted"; tdTag.textContent="—"; tr.appendChild(tdTag);

  // DESCRIPCION
  const tdDesc = document.createElement("td"); tdDesc.className="desc desccol muted"; tdDesc.textContent="—"; tr.appendChild(tdDesc);

  // REP (checkbox repetir fila anterior, incluye SIGLAS)
  const tdRep = document.createElement("td"); tdRep.className="repcol";
  const rep = document.createElement("input"); rep.type="checkbox"; rep.title="Repetir selecciones (incluye SIGLAS) de la fila anterior";
  tdRep.appendChild(rep); tr.appendChild(tdRep);

  // Acciones
  const tdActions = document.createElement("td"); tdActions.className="actcol";
  const btnDel = document.createElement("button"); btnDel.textContent="Eliminar";
  btnDel.onclick = ()=>{ tr.remove(); };
  tdActions.appendChild(btnDel); tr.appendChild(tdActions);

  const rowsEl = document.getElementById("rows");
  rowsEl.appendChild(tr);

  // Habilitar NIVEL solo para Transformador
  function updateNivelEnabled(){
    const enabled = isTransformador(objeto.value);
    nivel.disabled = !enabled;
    if (!enabled) nivel.value = "";
  }
  updateNivelEnabled();
  objeto.addEventListener("change", () => { updateNivelEnabled(); refreshRow(tr); });
  objeto.addEventListener("input",  () => { updateNivelEnabled(); });

  // Debounce general
  [ref,tipo,lugar,objeto,siglas,nivel,disp,prot,que,senal,numero].forEach(el=>{
    el.addEventListener("input", () => {
      clearTimeout(tr._t);
      tr._t = setTimeout(()=>refreshRow(tr), 120);
    });
  });

  // Pegado múltiple directo en REF
  ref.addEventListener("paste", (e)=>{
    const text = (e.clipboardData || window.clipboardData).getData("text");
    if (!text || (!text.includes("\n") && !text.includes("\t"))) return; // un valor -> pegar normal
    e.preventDefault();
    const rows = parsePastedTable(text);
    if (!rows.length) return;
    fillRowFromArray(tr, rows[0]); refreshRow(tr);
    for (let i=1;i<rows.length;i++){ newRow(prefillFromArray(rows[i])); }
  });

  // Repetir desde la fila anterior (mirror mientras esté tildado)
  function previousMainRow(curr){
    let prev = curr.previousElementSibling;
    return prev && prev.tagName === "TR" ? prev : null;
  }
  function copyFromPrev(){
    const prev = previousMainRow(tr);
    if (!prev) return;
    const src = prev.querySelectorAll("td");
    const dst = tr.querySelectorAll("td");
    // copia selects + SIGLAS (idx 4). No toca REF (idx 0)
    const selectIdx = [1,2,3,5,6,7,8,9,10];
    selectIdx.forEach(i=>{
      const s = src[i]?.querySelector("select");
      const d = dst[i]?.querySelector("select");
      if (s && d) d.value = s.value;
    });
    const sSig = src[4]?.querySelector("input");
    const dSig = dst[4]?.querySelector("input");
    if (sSig && dSig) dSig.value = sSig.value;

    updateNivelEnabled();
    refreshRow(tr);
  }
  function bindMirror(on){
    if (tr._mirror?.handlers) {
      tr._mirror.handlers.forEach(({el, fn})=> el.removeEventListener("input", fn));
      tr._mirror = null;
    }
    if (!on) return;
    const prev = previousMainRow(tr);
    if (!prev) { rep.checked = false; return; }
    const handler = ()=> copyFromPrev();
    const selects = prev.querySelectorAll("select, input[type='text']");
    selects.forEach(el=> el.addEventListener("input", handler));
    tr._mirror = { prev, handlers: Array.from(selects).map(el=>({el, fn:handler})) };
    copyFromPrev();
  }
  rep.addEventListener("change", ()=> bindMirror(rep.checked));

  // Estado inicial
  refreshRow(tr);
  autosizeRef();
  return tr;   // 👈 ESTA LÍNEA NUEVA
}

/* ====== Toolbar actions ====== */
function duplicateLastRow() {
  const rows = document.querySelectorAll("#rows tr");
  if (!rows.length) return newRow({});
  const last = rows[rows.length - 1];
  newRow(payloadFromRow(last));
}

function clearAllRows() {
  const tbody = document.getElementById("rows");
  if (!tbody) return;

  const active = localStorage.getItem("tagger.activeCat.v1") || "BIN";

  // Nombre lindo para el mensaje
  const labels = {
    ANA: "Analógicas",
    BIN: "Binarias",
    CMD: "Comandos"
  };
  const nice = labels[active] || active;

  if (!confirm(`¿Vaciar todas las filas de la categoría "${nice}"?`)) {
    return;
  }

  Array.from(tbody.querySelectorAll("tr")).forEach(tr => {
    const cat = tr.dataset.cat || "BIN"; // filas viejas sin data-cat → BIN
    if (cat === active) {
      tr.remove();
    }
  });
}



function exportCsv() {
  const rows = document.querySelectorAll("#rows tr");
  const headers = ["REF","TIPO","LUGAR","OBJETO","SIGLAS","NIVEL","DISPOSITIVO","PROTECCION_SECUNDARIA","QUE","SEÑAL","NUMERO","TAG","DESCRIPCION"];
  const out = [headers.join(",")];
  rows.forEach(tr=>{
    const p = payloadFromRow(tr);
    const tag = tr.querySelector(".tag")?.textContent || "";
    const desc = tr.querySelector(".desc")?.textContent || "";
    const vals = [p.ref,p.tipo_name,p.lugar_name,p.objeto_name,p.siglas,p.nivel,p.cod_disp_name,p.prot_sec_name,p.que_name,p.senal_name,p.numero_name,tag,desc]
      .map(v=>{ const s=(v??"").toString(); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; });
    out.push(vals.join(","));
  });
  const blob = new Blob([out.join("\n")], {type:"text/csv;charset=utf-8;"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "tags_generados.csv"; a.click(); URL.revokeObjectURL(a.href);
}

/* ====== Pegar (multi) con modal ====== */
function showPasteModal(on){
  const m = document.getElementById("pasteModal");
  m.style.display = on ? "flex" : "none";
  if (on) setTimeout(()=>document.getElementById("pasteArea").focus(), 50);
}
function parseCSVLine(line){
  const out=[]; let cur=""; let quoted=false;
  for (let i=0;i<line.length;i++){
    const ch=line[i];
    if (ch === '"'){
      if (quoted && line[i+1] === '"'){ cur+='"'; i++; }
      else quoted=!quoted;
    } else if (ch === ',' && !quoted){
      out.push(cur); cur="";
    } else { cur+=ch; }
  }
  out.push(cur);
  return out;
}
function parsePastedTable(text){
  const lines = text.replace(/\r/g,"").split("\n").filter(l=>l.trim()!=="");
  if (!lines.length) return [];
  const isTSV = lines.some(l=>l.includes("\t"));
  if (isTSV) return lines.map(l => l.split("\t"));
  else if (lines.some(l=>l.includes(","))) return lines.map(parseCSVLine);
  else return lines.map(l => [l]); // solo REF
}
function prefillFromArray(arr){
  return {
    ref: (arr[0]||"").trim(),
    tipo_name: (arr[1]||"").trim(),
    lugar_name: (arr[2]||"").trim(),
    objeto_name: (arr[3]||"").trim(),
    siglas: (arr[4]||"").trim(),
    nivel: (arr[5]||"").trim(),
    cod_disp_name: (arr[6]||"").trim(),
    prot_sec_name: (arr[7]||"").trim(),
    que_name: (arr[8]||"").trim(),
    senal_name: (arr[9]||"").trim(),
    numero_name: (arr[10]||"").trim(),
  };
}
function fillRowFromArray(tr, arr){
  const pre = prefillFromArray(arr);
  const tds = tr.querySelectorAll("td");
  const set = (idx, val)=>{ const el=tds[idx]?.querySelector("select, input, textarea"); if (el) el.value = val; };
  set(0, pre.ref);  set(1, pre.tipo_name); set(2, pre.lugar_name); set(3, pre.objeto_name); set(4, pre.siglas);
  set(5, pre.nivel); set(6, pre.cod_disp_name); set(7, pre.prot_sec_name); set(8, pre.que_name); set(9, pre.senal_name); set(10, pre.numero_name);
}

/* ====== Toggles globales ====== */
function applyCompact(on){ document.body.dataset.compact = on ? "1" : "0"; }

/* ====== Init ====== */
function init() {
   // TPL_bindUI();
document.getElementById("add").addEventListener("click", ()=> newRow({}));
  document.getElementById("dup").addEventListener("click", duplicateLastRow);
  document.getElementById("clear").addEventListener("click", clearAllRows);
  document.getElementById("exportCsv").addEventListener("click", exportCsv);

  const compactChk = document.getElementById("toggleCompact");
  compactChk.addEventListener("change", ()=> applyCompact(compactChk.checked));

  document.getElementById("pasteMulti").addEventListener("click", ()=> showPasteModal(true));
  document.getElementById("pasteCancel").addEventListener("click", ()=> showPasteModal(false));
  document.getElementById("pasteApply").addEventListener("click", handlePasteApply);

  newRow({});
  applyCompact(true);
}
document.addEventListener("DOMContentLoaded", init);


/* ====== TEMPLATES v2 (solo DISPOSITIVO / PROT. SEC. / SEÑAL) ====== */
const TPL2_KEY = "tagger.templates.v2";
const TPL2 = {
  uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); },
  state: { all: [], selectedId:null, editingId:null },

  load(){
    try{ const p=JSON.parse(localStorage.getItem(TPL2_KEY)||"[]"); this.state.all=Array.isArray(p)?p:[]; }
    catch{ this.state.all=[]; }
  },
  save(){ localStorage.setItem(TPL2_KEY, JSON.stringify(this.state.all)); },

  // Solo 4 campos
itemToPrefill(it){
  return {
    cod_disp_name: it.cod_disp_name || "",
    prot_sec_name: it.prot_sec_name || "",
    que_name:      it.que_name      || "",
    senal_name:    it.senal_name    || it.senal || ""
  };
},

  // Usa tus helpers existentes (famOptions/selectWithOptions)
  mkSelect(fam){
    if (typeof famOptions==="function" && typeof selectWithOptions==="function"){
      return selectWithOptions(famOptions(fam));
    }
    const i=document.createElement("input"); i.placeholder=fam; return i;
  },

  /* ---------- UI principal ---------- */
  open(){ this.renderList(); this.renderPreview(); document.getElementById("tpl2Editor").style.display="none"; document.getElementById("tpl2Dialog").showModal(); },
  close(){ document.getElementById("tpl2Dialog").close(); },

  renderList(){
    const q=(document.getElementById("tpl2Search")?.value||"").toLowerCase();
    const body=document.getElementById("tpl2List"); body.innerHTML="";
    this.state.all
      .filter(t=>t.nombre?.toLowerCase().includes(q) || (t.descripcion||"").toLowerCase().includes(q))
      .forEach(t=>{
        const tr=document.createElement("tr");
        //tr.innerHTML=`<td>${t.nombre||"—"}</td><td>${t.descripcion||""}</td><td><button data-id="${t.id}" class="tpl2-choose">Elegir</button></td>`;
        tr.innerHTML = `
  <td>${t.nombre || "—"}</td>
  <td>${t.descripcion || ""}</td>
  <td><button type="button" data-id="${t.id}" class="tpl2-choose">Elegir</button></td>
`;

        body.appendChild(tr);
      });
    body.querySelectorAll(".tpl2-choose").forEach(b=> b.onclick=()=>{ this.state.selectedId=b.dataset.id; this.renderPreview(); });
  },

  renderPreview(){
  const prev=document.getElementById("tpl2Preview"); prev.innerHTML="";
  const t=this.state.all.find(x=>x.id===this.state.selectedId); if(!t) return;
  (t.items||[]).forEach((it,i)=>{
    const p=this.itemToPrefill(it);
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${i+1}</td><td>${p.cod_disp_name}</td><td>${p.prot_sec_name}</td><td>${p.que_name}</td><td>${p.senal_name}</td>`;
    prev.appendChild(tr);
  });
},

  /* ---------- Editor (4 columnas) ---------- */
  addItemRow(it={}){
    const items=document.getElementById("tpl2Items");
    const tr=document.createElement("tr");

    //const disp=this.mkSelect("DISPOSITIVO");
    //const prot=this.mkSelect("PROTECCION SECUNDARIA");
    //const que=this.mkSelect("QUE");
    //const senal=this.mkSelect("SEÑAL");

    const disp  = autoField("DISPOSITIVO");
    const prot  = autoField("PROTECCION SECUNDARIA");
    const que   = autoField("QUE");
    const senal = autoField("SEÑAL");

    const p=this.itemToPrefill(it);
    disp.value=p.cod_disp_name; prot.value=p.prot_sec_name; que.value=p.que_name; senal.value=p.senal_name;

    tr.innerHTML=`<td class="idx"></td>`;
    [disp,prot,que,senal].forEach(el=>{ const td=document.createElement("td"); td.appendChild(el); tr.appendChild(td); });
    const tdAct=document.createElement("td"); const del=document.createElement("button"); del.textContent="Eliminar";
    del.onclick=()=>{ tr.remove(); this.reindex(); }; tdAct.appendChild(del); tr.appendChild(tdAct);

    items.appendChild(tr); this.reindex();
  },


  reindex(){ document.querySelectorAll("#tpl2Items .idx").forEach((e,i)=> e.textContent=i+1); },

  collectItems(){
  return Array.from(document.querySelectorAll("#tpl2Items tr")).map(tr=>{
    const get=(n)=> tr.querySelectorAll("td")[n]?.querySelector("select,input")?.value || "";
    // n=1 DISPOSITIVO, n=2 PROT SEC, n=3 QUE, n=4 SEÑAL
    return {
      cod_disp_name:get(1),
      prot_sec_name:get(2),
      que_name:get(3),
      senal_name:get(4)
    };
  });
},

  /* ---------- Acciones CRUD ---------- */
  startNew(){
    this.state.editingId="new";
    document.getElementById("tpl2FormNombre").value="";
    document.getElementById("tpl2FormDesc").value="";
    document.getElementById("tpl2FormTags").value="";
    const items=document.getElementById("tpl2Items"); items.innerHTML="";
    this.addItemRow({});
    document.getElementById("tpl2Editor").style.display="";
  },

  startEdit(){
    const t=this.state.all.find(x=>x.id===this.state.selectedId); if(!t) return;
    this.state.editingId=t.id;
    document.getElementById("tpl2FormNombre").value=t.nombre||"";
    document.getElementById("tpl2FormDesc").value=t.descripcion||"";
    document.getElementById("tpl2FormTags").value=(t.tags||[]).join(", ");
    const items=document.getElementById("tpl2Items"); items.innerHTML="";
    (t.items||[]).forEach(it=> this.addItemRow(it));
    document.getElementById("tpl2Editor").style.display="";
  },

  saveEdit(){
    const nombre=(document.getElementById("tpl2FormNombre").value||"").trim()||"Sin nombre";
    const descripcion=(document.getElementById("tpl2FormDesc").value||"").trim();
    const tags=(document.getElementById("tpl2FormTags").value||"").split(",").map(s=>s.trim()).filter(Boolean);
    const items=this.collectItems();
    const id=this.state.editingId==="new" ? this.uid() : this.state.editingId;
    const idx=this.state.all.findIndex(x=>x.id===id);
    const obj={id,nombre,descripcion,tags,items};
    if(idx>=0) this.state.all[idx]=obj; else this.state.all.unshift(obj);
    this.save(); this.state.selectedId=id; document.getElementById("tpl2Editor").style.display="none";
    this.renderList(); this.renderPreview();
  },

  delete(){
    const id = this.state.selectedId;
    if (!id) return;

    const t = this.state.all.find(x => x.id === id);
    const nombre = t?.nombre || "";

    const msg = nombre
      ? `¿Seguro que querés eliminar el template "${nombre}"?`
      : "¿Seguro que querés eliminar este template?";

    if (!confirm(msg)) return;

    this.state.all = this.state.all.filter(x => x.id !== id);
    this.save();
    this.state.selectedId = null;
    this.renderList();
    this.renderPreview();
  },

  /* ---------- Aplicar al generador ---------- */
  apply(){
  const t=this.state.all.find(x=>x.id===this.state.selectedId); if(!t) return;
  (t.items||[]).forEach(it => {
    const p=this.itemToPrefill(it);
    newRow({
      cod_disp_name: p.cod_disp_name,
      prot_sec_name: p.prot_sec_name,
      que_name:      p.que_name,
      senal_name:    p.senal_name
    });
  });
  this.close();
},

  export(){
    const blob=new Blob([JSON.stringify(this.state.all,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a");
    a.href=url; a.download="templates_equipos.json"; a.click(); URL.revokeObjectURL(url);
  },
  import(file){
    const rd=new FileReader();
    rd.onload=()=>{ try{
      const data=JSON.parse(String(rd.result)); if(Array.isArray(data)){ this.state.all=data; this.save(); this.renderList(); this.renderPreview(); }
    }catch(e){ console.error("JSON inválido", e); } };
    rd.readAsText(file);
  },

  bindUI(){
    this.load();
    const $=id=>document.getElementById(id);
    $("tpl2Open")?.addEventListener("click",()=>this.open());
    $("tpl2Close")?.addEventListener("click",()=>this.close());
    $("tpl2Search")?.addEventListener("input",()=>this.renderList());
    $("tpl2Apply")?.addEventListener("click",()=>this.apply());
    $("tpl2New")?.addEventListener("click",()=>this.startNew());
    $("tpl2Edit")?.addEventListener("click",()=>this.startEdit());
    $("tpl2Delete")?.addEventListener("click",()=>this.delete());
    $("tpl2Save")?.addEventListener("click",()=>this.saveEdit());
    $("tpl2AddItem")?.addEventListener("click",()=>this.addItemRow({}));
    $("tpl2CancelEdit")?.addEventListener("click",()=>{ $("tpl2Editor").style.display="none"; });
    $("tpl2Export")?.addEventListener("click",()=>this.export());
    $("tpl2ImportFile")?.addEventListener("change",(e)=>{ const f=e.target.files?.[0]; if(f) this.import(f); e.target.value=""; });
  }
};

document.addEventListener("DOMContentLoaded", ()=> TPL2.bindUI());

/* =======================
   AUTOCOMPLETE (combobox)
   ======================= */

/**
 * Devuelve la lista de nombres de una familia (TIPO, LUGAR, ...).
 * Soporta objetos {code, name} o strings planos.
 */
function famNames(fam) {
  try {
    const raw = famOptions(fam) || [];
    return raw.map(r => (r && (r.name || r.nombre)) ? (r.name || r.nombre) : String(r || ""))
              .filter(Boolean);
  } catch (e) {
    console.warn("famNames fallback for", fam, e);
    return [];
  }
}

/**
 * Crea un input con <datalist> que sugiere opciones de la familia indicada.
 * - fam: "TIPO", "LUGAR", "DISPOSITIVO", "PROTECCION SECUNDARIA", "QUE", "SEÑAL", "NIVEL", "NUMERO"
 * - value: valor inicial (texto)
 */
function autoField(fam, value = "") {
  const id = "auto_" + fam.replace(/\s+/g, "_").toLowerCase();
  // Datalist único por familia (se reutiliza)
  let dl = document.getElementById(id);
  if (!dl) {
    dl = document.createElement("datalist");
    dl.id = id;
    document.body.appendChild(dl);
  }
  // (Re)popular opciones
  const names = famNames(fam);
  dl.innerHTML = "";
  names.forEach(n => {
    const opt = document.createElement("option");
    opt.value = n;
    dl.appendChild(opt);
  });

  // Input asociado
  const inp = document.createElement("input");
  inp.type = "text";
  inp.setAttribute("list", id);
  inp.autocomplete = "off";
  inp.spellcheck = false;
  inp.style.width = "100%";
  inp.placeholder = fam;
  if (value) inp.value = value;

  // Disparar eventos de cambio mientras escribe (para que tu generador regenera TAG/DESCRIPCION)
  const fire = () => { inp.dispatchEvent(new Event("change", { bubbles: true })); };
  inp.addEventListener("input", fire);
  inp.addEventListener("change", fire);

  // API simpática para leer/escribir como un <select>
  inp.getValue = () => inp.value.trim();
  inp.setValue = (v) => { inp.value = v || ""; fire(); };

  return inp;
}

/* ===========================================================
   Categorías + Persistencia por categoría (restaura sin mezclar)
   =========================================================== */
(function(){
  // --- Config ---
  const STORAGE_KEY = "tagger.state.v3";       // estado por categoría
  const CAT_KEY     = "tagger.activeCat.v1";   // última categoría usada
  const CAT = { ANA: "ANA", BIN: "BIN", CMD: "CMD" };

  // --- Estado en memoria ---
  let ACTIVE    = localStorage.getItem(CAT_KEY) || CAT.BIN;
  let RESTORING = false; // bandera para no re-etiquetar durante la restauración

  // --- Helpers DOM ---
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  // Lee todos los valores de una fila, en orden de inputs/selects/textareas
  function readRowValues(tr){
    return Array.from(tr.querySelectorAll("input,textarea,select")).map(el => el.value);
  }

  // Escribe valores en una fila creada con newRow()
  function writeRowValues(tr, values){
    const inputs = tr.querySelectorAll("input,textarea,select");
    values.forEach((v,i)=>{ if (inputs[i]) inputs[i].value = v; });
  }

  // ¿La fila tiene algún dato “real” (algo distinto de "" y del "on" del checkbox)?
  function rowHasData(values){
    if (!values) return false;
    const n = values.length;
    for (let i=0; i<n; i++){
      let v = (values[i] || "").trim();
      if (!v) continue;
      // último campo suele ser el checkbox REP → ignoro el "on"
      if (v === "on" && i === n-1) continue;
      return true;
    }
    return false;
  }

  function snapshotHasAnyData(data){
    if (!data || typeof data !== "object") return false;
    for (const cat of [CAT.ANA, CAT.BIN, CAT.CMD]){
      const arr = data[cat] || [];
      for (const vals of arr){
        if (rowHasData(vals)) return true;
      }
    }
    return false;
  }

  // --- Persistencia ---
  function snapshotState(){
    const byCat = { ANA: [], BIN: [], CMD: [] };
    $$("#rows tr").forEach(tr=>{
      const cat  = tr.dataset.cat || CAT.BIN;
      const vals = readRowValues(tr);
      if (rowHasData(vals)) {          // ⬅️ NO guardamos filas totalmente vacías
        byCat[cat].push(vals);
      }
    });
    return byCat;
  }

  function saveState(){
    const data = snapshotState();
    if (!snapshotHasAnyData(data)) {
      // No pisar un estado bueno con un snapshot vacío
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(CAT_KEY, ACTIVE);
  }

  function restoreState(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    let data;
    try { data = JSON.parse(raw); } catch { return false; }
    if (!snapshotHasAnyData(data)) return false;

    const tb = $("#rows"); 
    if (!tb) return false;

    RESTORING = true;   // 🔒 desactiva etiquetado automático durante la reconstrucción
    tb.innerHTML = "";

    // Recrear en orden: ANA, BIN, CMD (el orden no importa, se filtra después)
    [CAT.ANA, CAT.BIN, CAT.CMD].forEach(cat=>{
      (data[cat] || []).forEach(values=>{
        const tr = (typeof window.newRow === "function") ? window.newRow({}) : null;
        if (!tr) return;
        writeRowValues(tr, values);
        tr.dataset.cat = cat; // 🔑 categoría correcta
      });
    });

    RESTORING = false;  // 🔓 reactivar
    applyCategoryFilter(); // mostrar solo la activa
    return true;
  }

  // --- Filtro visual por categoría ---
  function applyCategoryFilter(){
    $$("#rows tr").forEach(tr=>{
      const cat = tr.dataset.cat || CAT.BIN;
      tr.style.display = (cat === ACTIVE) ? "" : "none";
    });
    paintButtons();
  }

  function setActive(cat){
    ACTIVE = (cat===CAT.ANA || cat===CAT.CMD) ? cat : CAT.BIN;
    applyCategoryFilter();
    localStorage.setItem(CAT_KEY, ACTIVE);
  }

  function paintButtons(){
    const on = (el, yes)=>{
      if (!el) return;
      el.style.background   = yes ? "#0078d7" : "";
      el.style.color        = yes ? "#fff"    : "";
      el.style.border       = "1px solid #ccc";
      el.style.borderRadius = "18px";
      el.style.padding      = "6px 10px";
    };
    on($("#catAnalog"),  ACTIVE===CAT.ANA);
    on($("#catBinary"),  ACTIVE===CAT.BIN);
    on($("#catCommand"), ACTIVE===CAT.CMD);
  }

  // --- Observadores y eventos ---
  function installAutosave(){
    const tb = $("#rows"); 
    if (!tb) return;

    // Guardar cuando se escribe o cambian valores
    tb.addEventListener("input",  ()=> saveState(), { passive:true });
    tb.addEventListener("change", ()=> saveState(), { passive:true });

    // Observar filas nuevas: si NO estamos restaurando, etiqueta con la categoría activa
    const mo = new MutationObserver(muts=>{
      if (RESTORING) return; // <- clave para que al restaurar NO se reasigne a BIN
      muts.forEach(m=>{
        m.addedNodes.forEach(n=>{
          if (n && n.nodeType===1 && n.tagName==="TR") {
            if (!n.dataset.cat) n.dataset.cat = ACTIVE;
            // asegurar visibilidad acorde
            n.style.display = (n.dataset.cat===ACTIVE) ? "" : "none";
          }
        });
      });
      saveState();
    });
    mo.observe(tb, { childList:true });

    // Guardados extra por seguridad
    window.addEventListener("beforeunload", saveState);
    document.addEventListener("visibilitychange", ()=> {
      if (document.visibilityState === "hidden") saveState();
    });
  }

  function bindCategoryButtons(){
    $("#catAnalog") ?.addEventListener("click", ()=> setActive(CAT.ANA));
    $("#catBinary") ?.addEventListener("click", ()=> setActive(CAT.BIN));
    $("#catCommand")?.addEventListener("click", ()=> setActive(CAT.CMD));
  }

  // --- Arranque ---
  document.addEventListener("DOMContentLoaded", ()=>{
    bindCategoryButtons();

    // Etiquetar filas existentes (si no tienen data-cat, asume BIN)
    $$("#rows tr").forEach(tr=>{ 
      if (!tr.dataset.cat) tr.dataset.cat = CAT.BIN; 
    });

    // Restaurar (si hay) y sino aplicar filtro a la categoría activa guardada
    if (!restoreState()) {
      ACTIVE = localStorage.getItem(CAT_KEY) || CAT.BIN;
      applyCategoryFilter();
    }

    installAutosave();
  });
})();
