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

  const tipo   = selectWithOptions(famOptions("TIPO"));
  const lugar  = selectWithOptions(famOptions("LUGAR"));
  const objeto = selectWithOptions(famOptions("OBJETO"));
  const siglas = document.createElement("input"); siglas.placeholder = "libre";
  const nivel  = selectWithOptions(famOptions("NIVEL"));
  const disp   = selectWithOptions(famOptions("DISPOSITIVO"));
  const prot   = selectWithOptions(famOptions("PROTECCION SECUNDARIA"));
  const que    = selectWithOptions(famOptions("QUE"));
  const senal  = selectWithOptions(famOptions("SEÑAL"));
  const numero = selectWithOptions(famOptions("NUMERO"));

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
}

/* ====== Toolbar actions ====== */
function duplicateLastRow() {
  const rows = document.querySelectorAll("#rows tr");
  if (!rows.length) return newRow({});
  const last = rows[rows.length - 1];
  newRow(payloadFromRow(last));
}
function clearAllRows() { document.getElementById("rows").innerHTML = ""; }
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
    TPL_bindUI();
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


/* ====== Templates (Equipos) ====== */
const TPL_LS_KEY = "tagger.templates.v1";
function TPL_uid(){ return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function TPL_seed(){
  return [
    { id: TPL_uid(), nombre: "CELDA MT - Alimentador", descripcion: "Protecciones y señales base de una celda MT para alimentador.", tags: ["MT","Protección","Alimentador"], items: [{senal:"I>"},{senal:"I>>"},{senal:"Io>"},{senal:"Io>>"},{senal:"Disparo"},{senal:"Rearme"},{senal:"Posición Abierto"},{senal:"Posición Cerrado"}] },
    { id: TPL_uid(), nombre: "CELDA MT - Transformador de Potencia", descripcion: "Señales típicas TF; ajustá a tu estándar.", tags: ["MT","Trafo"], items: [{senal:"BOMBA ACEITE EN MARCHA"},{senal:"FAN EN MARCHA"},{senal:"RELÉ GAS"},{senal:"TEMPERATURA ALTA"},{senal:"NIVEL ACEITE BAJO"},{senal:"DISPARO DIFERENCIAL"}] }
  ];
}
function TPL_load(){ try{ const raw=localStorage.getItem(TPL_LS_KEY); const parsed=raw?JSON.parse(raw):null; return Array.isArray(parsed)?parsed:TPL_seed(); }catch(_){ return TPL_seed(); } }
function TPL_save(list){ localStorage.setItem(TPL_LS_KEY, JSON.stringify(list)); }
let TPL_state = { all: TPL_load(), selectedId: null, editingId: null };

function TPL_open(){ const dlg=document.getElementById("tplDialog"); TPL_renderList(); TPL_renderPreview(); document.getElementById("tplEditor").style.display="none"; dlg.showModal(); }
function TPL_close(){ document.getElementById("tplDialog").close(); }
function TPL_filter(q){ q=(q||"").toLowerCase().trim(); if(!q) return TPL_state.all; return TPL_state.all.filter(t => t.nombre.toLowerCase().includes(q) || (t.descripcion||"").toLowerCase().includes(q) || (t.tags||[]).some(tag => tag.toLowerCase().includes(q))); }

function TPL_renderList(){
  const q=document.getElementById("tplSearch")?.value||"";
  const list=TPL_filter(q);
  const tbody=document.getElementById("tplList"); tbody.innerHTML="";
  list.forEach(t=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td><div style="font-weight:600">${t.nombre}</div><div style="font-size:12px; opacity:.7">${(t.tags||[]).join(" · ")}</div></td>
      <td>${t.descripcion||""}</td>
      <td style="text-align:right;"><button type="button" data-id="${t.id}" class="tpl-choose">Elegir</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll(".tpl-choose").forEach(btn=>{
    btn.addEventListener("click", ()=>{ TPL_state.selectedId=btn.getAttribute("data-id"); TPL_renderPreview(); });
  });
}

function TPL_renderPreview(){
  const tbody=document.getElementById("tplPreview"); tbody.innerHTML="";
  const t=TPL_state.all.find(x=>x.id===TPL_state.selectedId);
  if(!t) return;
  t.items.forEach((it,idx)=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${idx+1}</td><td>${it.senal}</td>`;
    tbody.appendChild(tr);
  });
}

function TPL_apply(){
  const t=TPL_state.all.find(x=>x.id===TPL_state.selectedId);
  if(!t) return;
  t.items.forEach(it => newRow({ senal_name: it.senal })); // Solo SENAL
  TPL_close();
}

function TPL_startNew(){
  TPL_state.editingId="new";
  document.getElementById("tplFormNombre").value=""; document.getElementById("tplFormDesc").value="";
  document.getElementById("tplFormTags").value="";
  const items=document.getElementById("tplItems"); items.innerHTML="";
  TPL_addItemRow("");
  document.getElementById("tplEditor").style.display="";
}
function TPL_startEdit(){
  const t=TPL_state.all.find(x=>x.id===TPL_state.selectedId); if(!t) return;
  TPL_state.editingId=t.id;
  document.getElementById("tplFormNombre").value=t.nombre||"";
  document.getElementById("tplFormDesc").value=t.descripcion||"";
  document.getElementById("tplFormTags").value=(t.tags||[]).join(", ");
  const items=document.getElementById("tplItems"); items.innerHTML="";
  (t.items||[]).forEach(it=>TPL_addItemRow(it.senal));
  document.getElementById("tplEditor").style.display="";
}
function TPL_addItemRow(senal=""){
  const items=document.getElementById("tplItems");
  const tr=document.createElement("tr");
  tr.innerHTML=`
    <td class="idx"></td>
    <td><input class="tplItemSenal" value="${(senal||"").replace(/"/g,'&quot;')}" placeholder="Ej.: I>, Disparo, Posición Cerrado…" style="width:100%; padding:6px;"></td>
    <td style="text-align:right;"><button type="button" class="tplDelItem">Eliminar</button></td>`;
  items.appendChild(tr);
  TPL_reindexItems();
  tr.querySelector(".tplDelItem").addEventListener("click", ()=>{ tr.remove(); TPL_reindexItems(); });
}
function TPL_reindexItems(){ document.querySelectorAll("#tplItems .idx").forEach((el,i)=> el.textContent=i+1); }

function TPL_saveEdit(){
  const nombre=(document.getElementById("tplFormNombre").value||"").trim()||"Sin nombre";
  const descripcion=(document.getElementById("tplFormDesc").value||"").trim();
  const tags=(document.getElementById("tplFormTags").value||"").split(",").map(s=>s.trim()).filter(Boolean);
  const items=Array.from(document.querySelectorAll("#tplItems .tplItemSenal")).map(inp=>({ senal: (inp.value||"").trim() })).filter(it=>it.senal.length>0);
  const payload={ id: TPL_state.editingId==="new" ? TPL_uid() : TPL_state.editingId, nombre, descripcion, tags, items };
  const idx=TPL_state.all.findIndex(x=>x.id===payload.id);
  if(idx>=0){ TPL_state.all[idx]=payload; } else { TPL_state.all.unshift(payload); }
  TPL_save(TPL_state.all); TPL_state.selectedId=payload.id; TPL_renderList(); TPL_renderPreview();
  document.getElementById("tplEditor").style.display="none";
}
function TPL_delete(){
  const id=TPL_state.selectedId; if(!id) return;
  TPL_state.all=TPL_state.all.filter(x=>x.id!==id);
  TPL_save(TPL_state.all); TPL_state.selectedId=null;
  TPL_renderList(); TPL_renderPreview();
}
function TPL_export(){
  const blob=new Blob([JSON.stringify(TPL_state.all,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="templates_equipos.json"; a.click(); URL.revokeObjectURL(url);
}
function TPL_import(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=JSON.parse(String(reader.result));
      if(Array.isArray(data)){
        TPL_state.all=data.map(t=>({ id:t.id||TPL_uid(), nombre:String(t.nombre||"Sin nombre"), descripcion:t.descripcion?String(t.descripcion):"", tags:Array.isArray(t.tags)?t.tags.map(String):[], items:Array.isArray(t.items)?t.items.map(it=>({ senal:String(it.senal||"").trim() })).filter(it=>it.senal):[] }));
        TPL_save(TPL_state.all); TPL_renderList(); TPL_renderPreview();
      }
    }catch(e){ console.error("JSON inválido", e); }
  };
  reader.readAsText(file);
}
function TPL_bindUI(){
  const dlg=document.getElementById("tplDialog"); if(!dlg) return;
  document.getElementById("templatesOpen")?.addEventListener("click", TPL_open);
  document.getElementById("tplClose")?.addEventListener("click", TPL_close);
  document.getElementById("tplApply")?.addEventListener("click", TPL_apply);
  document.getElementById("tplSearch")?.addEventListener("input", TPL_renderList);
  document.getElementById("tplNew")?.addEventListener("click", TPL_startNew);
  document.getElementById("tplEdit")?.addEventListener("click", TPL_startEdit);
  document.getElementById("tplDelete")?.addEventListener("click", TPL_delete);
  document.getElementById("tplAddItem")?.addEventListener("click", ()=> TPL_addItemRow(""));
  document.getElementById("tplSave")?.addEventListener("click", TPL_saveEdit);
  document.getElementById("tplCancelEdit")?.addEventListener("click", ()=>{ document.getElementById("tplEditor").style.display="none"; });
  document.getElementById("tplExport")?.addEventListener("click", TPL_export);
  document.getElementById("tplImportFile")?.addEventListener("change",(e)=>{ const file=e.target.files?.[0]; if(file) TPL_import(file); e.target.value=""; });
}

