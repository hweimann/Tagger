/* ===========================================================
   BASE: Helpers de catálogos y autocompletado
   =========================================================== */

// Devuelve nombres (strings) de la familia indicada a partir de famOptions(...)
function famNames(fam) {
  try {
    const raw = (typeof famOptions === "function" ? famOptions(fam) : []) || [];
    return raw.map(r => (r && (r.name || r.nombre)) ? (r.name || r.nombre) : String(r || ""))
              .filter(Boolean);
  } catch (e) {
    console.warn("famNames fallback for", fam, e);
    return [];
  }
}

// Input con datalist que sugiere opciones mientras escribís
function autoField(fam, value = "") {
  const id = "auto_" + fam.replace(/\s+/g, "_").toLowerCase();
  let dl = document.getElementById(id);
  if (!dl) {
    dl = document.createElement("datalist");
    dl.id = id;
    document.body.appendChild(dl);
  }
  const names = famNames(fam);
  dl.innerHTML = "";
  names.forEach(n => {
    const opt = document.createElement("option");
    opt.value = n;
    dl.appendChild(opt);
  });

  const inp = document.createElement("input");
  inp.type = "text";
  inp.setAttribute("list", id);
  inp.autocomplete = "off";
  inp.spellcheck = false;
  inp.placeholder = fam;
  inp.style.width = "100%";
  if (value) inp.value = value;

  // Dispara "change" también en cada input para que tu lógica regenere TAG/DESCRIPCION
  const fire = () => { inp.dispatchEvent(new Event("change", { bubbles: true })); };
  inp.addEventListener("input", fire);
  inp.addEventListener("change", fire);

  inp.getValue = () => inp.value.trim();
  inp.setValue = (v) => { inp.value = v || ""; fire(); };

  return inp;
}

/* ===========================================================
   GENERADOR: crear filas (expuesto como window.newRow)
   =========================================================== */

function locateRowsTbody() {
  let tb = document.getElementById("rows");
  if (tb) return tb;
  const table = document.getElementById("tagTable") || document.querySelector("#tableContainer table");
  if (!table) return null;
  tb = table.querySelector("tbody");
  if (!tb) { tb = document.createElement("tbody"); tb.id = "rows"; table.appendChild(tb); }
  return tb;
}

// Crea una fila con autocompletado en todas las columnas
function newRow(prefill = {}) {
  const tbody = locateRowsTbody();
  if (!tbody) { console.warn("No se encontró tbody#rows ni tabla del generador"); return null; }

  const tr = document.createElement("tr");

  const tipo   = autoField("TIPO",                  prefill.tipo_name     || "");
  const lugar  = autoField("LUGAR",                 prefill.lugar_name    || "");
  const objeto = autoField("OBJETO",                prefill.objeto_name   || "");
  const siglas = document.createElement("input");   siglas.value = prefill.siglas || ""; siglas.style.width="100%";
  const nivel  = autoField("NIVEL",                 prefill.nivel         || "");
  const disp   = autoField("DISPOSITIVO",           prefill.cod_disp_name || "");
  const prot   = autoField("PROTECCION SECUNDARIA", prefill.prot_sec_name || "");
  const que    = autoField("QUE",                   prefill.que_name      || "");
  const senal  = autoField("SEÑAL",                 prefill.senal_name    || "");
  const numero = autoField("NUMERO",                prefill.numero_name   || "");

  [tipo,lugar,objeto,siglas,nivel,disp,prot,que,senal,numero].forEach(el=>{
    const td = document.createElement("td");
    td.appendChild(el);
    tr.appendChild(td);
  });

  tbody.appendChild(tr);
  return tr;
}
window.newRow = newRow;

/* ===========================================================
   TEMPLATES v2 (DISPOSITIVO / PROT. SEC. / QUE / SEÑAL)
   =========================================================== */

const TPL2_KEY = "tagger.templates.v2";
const TPL2 = {
  _bound: false,
  _saving: false,
  state: { all: [], selectedId: null, editingId: null },

  uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); },

  load(){
    try {
      const p = JSON.parse(localStorage.getItem(TPL2_KEY) || "[]");
      this.state.all = Array.isArray(p) ? p : [];
    } catch {
      this.state.all = [];
    }
  },
  save(){ localStorage.setItem(TPL2_KEY, JSON.stringify(this.state.all)); },

  itemToPrefill(it){
    return {
      cod_disp_name: it.cod_disp_name || "",
      prot_sec_name: it.prot_sec_name || "",
      que_name:      it.que_name      || "",
      senal_name:    it.senal_name    || it.senal || ""
    };
  },

  // Abre tpl2Dialog o tplDialog (compat)
  open(){
    const dlg = document.getElementById("tpl2Dialog") || document.getElementById("tplDialog");
    if (!dlg) { alert("No encontré el diálogo de Templates (tpl2Dialog / tplDialog)."); return; }
    this.renderList();
    this.renderPreview();
    const ed = document.getElementById("tpl2Editor") || document.getElementById("tplEditor");
    if (ed) ed.style.display = "none";
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.style.display = "";
  },
  close(){
    (document.getElementById("tpl2Dialog") || document.getElementById("tplDialog"))?.close?.();
    const dlg = document.getElementById("tpl2Dialog") || document.getElementById("tplDialog");
    if (dlg && !dlg.close) dlg.style.display = "none";
  },

  renderList(){
    const q = (document.getElementById("tpl2Search")?.value || "").toLowerCase();
    const body = document.getElementById("tpl2List");
    if (!body) return;
    body.innerHTML = "";
    this.state.all
      .filter(t => (t.nombre||"").toLowerCase().includes(q) || (t.descripcion||"").toLowerCase().includes(q))
      .forEach(t=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${t.nombre || "—"}</td>
          <td>${t.descripcion || ""}</td>
          <td><button type="button" data-id="${t.id}" class="tpl2-choose">Elegir</button></td>
        `;
        body.appendChild(tr);
      });
    body.querySelectorAll(".tpl2-choose").forEach(b=>{
      b.onclick = (ev) => {
        ev.preventDefault();
        this.state.selectedId = b.dataset.id;
        this.renderPreview();
      };
    });
  },

  renderPreview(){
    const prev = document.getElementById("tpl2Preview");
    if (!prev) return;
    prev.innerHTML = "";
    const t = this.state.all.find(x=>x.id===this.state.selectedId);
    if (!t) return;
    (t.items||[]).forEach((it,i)=>{
      const p = this.itemToPrefill(it);
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${i+1}</td>
                      <td>${p.cod_disp_name}</td>
                      <td>${p.prot_sec_name}</td>
                      <td>${p.que_name}</td>
                      <td>${p.senal_name}</td>`;
      prev.appendChild(tr);
    });
  },

  addItemRow(it={}){
    const items = document.getElementById("tpl2Items");
    if (!items) return;
    const tr = document.createElement("tr");

    const disp  = autoField("DISPOSITIVO");
    const prot  = autoField("PROTECCION SECUNDARIA");
    const que   = autoField("QUE");
    const senal = autoField("SEÑAL");

    const p = this.itemToPrefill(it);
    disp.value  = p.cod_disp_name;
    prot.value  = p.prot_sec_name;
    que.value   = p.que_name;
    senal.value = p.senal_name;

    tr.innerHTML = `<td class="idx"></td>`;
    [disp,prot,que,senal].forEach(el=>{ const td=document.createElement("td"); td.appendChild(el); tr.appendChild(td); });

    const tdAct = document.createElement("td");
    const del = document.createElement("button");
    del.type="button"; del.textContent="Eliminar";
    del.onclick = ()=>{ tr.remove(); this.reindex(); };
    tdAct.appendChild(del);
    tr.appendChild(tdAct);

    items.appendChild(tr);
    this.reindex();
  },

  reindex(){ document.querySelectorAll("#tpl2Items .idx").forEach((e,i)=> e.textContent=i+1); },

  collectItems(){
    return Array.from(document.querySelectorAll("#tpl2Items tr")).map(tr=>{
      const get=(n)=> tr.querySelectorAll("td")[n]?.querySelector("input,select,textarea")?.value || "";
      // 0=#, 1=DISP, 2=PROT, 3=QUE, 4=SEÑAL, 5=acciones
      return {
        cod_disp_name: get(1),
        prot_sec_name: get(2),
        que_name:      get(3),
        senal_name:    get(4)
      };
    });
  },

  startNew(){
    this.state.editingId="new";
    const nombre = document.getElementById("tpl2FormNombre");
    const desc   = document.getElementById("tpl2FormDesc");
    const tags   = document.getElementById("tpl2FormTags");
    if (nombre) nombre.value = "";
    if (desc)   desc.value   = "";
    if (tags)   tags.value   = "";
    const items = document.getElementById("tpl2Items"); if (items) items.innerHTML = "";
    this.addItemRow({});
    const ed = document.getElementById("tpl2Editor") || document.getElementById("tplEditor");
    if (ed) ed.style.display = "";
  },

  startEdit(){
    const t = this.state.all.find(x=>x.id===this.state.selectedId);
    if (!t) { alert("Primero elegí un equipo de la lista."); return; }
    this.state.editingId = t.id;

    const nombre = document.getElementById("tpl2FormNombre");
    const desc   = document.getElementById("tpl2FormDesc");
    const tags   = document.getElementById("tpl2FormTags");
    if (nombre) nombre.value = t.nombre || "";
    if (desc)   desc.value   = t.descripcion || "";
    if (tags)   tags.value   = (t.tags || []).join(", ");

    const items = document.getElementById("tpl2Items"); if (items) items.innerHTML = "";
    (t.items || []).forEach(it => this.addItemRow(it));
    const ed = document.getElementById("tpl2Editor") || document.getElementById("tplEditor");
    if (ed) ed.style.display = "";
  },

  saveEdit(){
    if (this._saving) return;
    this._saving = true;
    try {
      const nombre = (document.getElementById("tpl2FormNombre")?.value || "").trim() || "Sin nombre";
      const descripcion = (document.getElementById("tpl2FormDesc")?.value || "").trim();
      const tags = (document.getElementById("tpl2FormTags")?.value || "")
                    .split(",").map(s=>s.trim()).filter(Boolean);
      const items = this.collectItems();
      const id = this.state.editingId === "new" ? this.uid() : this.state.editingId;
      const idx = this.state.all.findIndex(x=>x.id===id);
      const obj = { id, nombre, descripcion, tags, items };
      if (idx >= 0) this.state.all[idx] = obj; else this.state.all.unshift(obj);
      this.save();
      this.state.selectedId = id;
      const ed = document.getElementById("tpl2Editor") || document.getElementById("tplEditor");
      if (ed) ed.style.display = "none";
      this.renderList(); this.renderPreview();
    } finally { this._saving = false; }
  },

  delete(){
    const id = this.state.selectedId; if (!id) return;
    this.state.all = this.state.all.filter(x=>x.id!==id);
    this.save(); this.state.selectedId = null;
    this.renderList(); this.renderPreview();
  },

  apply(){
    const t = this.state.all.find(x=>x.id===this.state.selectedId);
    if (!t) return;
    (t.items || []).forEach(it => {
      const p = this.itemToPrefill(it);
      newRow({
        cod_disp_name: p.cod_disp_name,
        prot_sec_name: p.prot_sec_name,
        que_name:      p.que_name,
        senal_name:    p.senal_name
      });
    });
    this.close();
  },

  bindUI(){
    if (this._bound) return;
    this._bound = true;

    this.load();

    const $ = (id)=>document.getElementById(id);
    // Asegurar type="button" para evitar submits en <form method="dialog">
    ["tpl2Open","templatesOpen","tpl2Close","tpl2Apply","tpl2New","tpl2Edit","tpl2Delete","tpl2Save","tpl2AddItem","tpl2CancelEdit"]
      .forEach(id => { const el=$(id); if (el) el.type="button"; });

    // Botones compatibles
    $("#tpl2Open")      ?.addEventListener("click",(e)=>{e.preventDefault();this.open();});
    $("#templatesOpen") ?.addEventListener("click",(e)=>{e.preventDefault();this.open();});
    document.querySelectorAll('[data-action="open-templates"]').forEach(el=>{
      el.addEventListener("click",(e)=>{e.preventDefault();this.open();});
    });

    $("#tpl2Close")     ?.addEventListener("click",(e)=>{e.preventDefault();this.close();});
    $("#tpl2Apply")     ?.addEventListener("click",(e)=>{e.preventDefault();this.apply();});
    $("#tpl2New")       ?.addEventListener("click",(e)=>{e.preventDefault();this.startNew();});
    $("#tpl2Edit")      ?.addEventListener("click",(e)=>{e.preventDefault();this.startEdit();});
    $("#tpl2Delete")    ?.addEventListener("click",(e)=>{e.preventDefault();this.delete();});
    $("#tpl2Save")      ?.addEventListener("click",(e)=>{e.preventDefault();this.saveEdit();});
    $("#tpl2AddItem")   ?.addEventListener("click",(e)=>{e.preventDefault();this.addItemRow({});});
    $("#tpl2CancelEdit")?.addEventListener("click",(e)=>{e.preventDefault(); const ed=document.getElementById("tpl2Editor")||document.getElementById("tplEditor"); if(ed) ed.style.display="none"; });

    $("#tpl2Search")    ?.addEventListener("input",()=>this.renderList());
    $("#tpl2Export")    ?.addEventListener("click",(e)=>{e.preventDefault();this.export();});
    $("#tpl2ImportFile")?.addEventListener("change",(e)=>{ const f=e.target.files?.[0]; if(f) this.import(f); e.target.value=""; });

    this.renderList();
  },

  export(){
    const blob=new Blob([JSON.stringify(this.state.all,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download="templates_equipos.json"; a.click();
    URL.revokeObjectURL(url);
  },
  import(file){
    const rd=new FileReader();
    rd.onload=()=>{
      try{
        const data=JSON.parse(String(rd.result));
        if(Array.isArray(data)){ this.state.all=data; this.save(); this.renderList(); this.renderPreview(); }
      }catch(e){ alert("Archivo JSON inválido."); }
    };
    rd.readAsText(file);
  }
};

/* ===========================================================
   GENERADOR: rebind de toolbar (no destructivo)
   =========================================================== */

const MainUI = {
  _bound:false,
  bind(){
    if (this._bound) return;
    this._bound = true;

    const $ = (id)=>document.getElementById(id);
    const ensureBody = locateRowsTbody;

    const addOneRow = (prefill={})=>{
      if (typeof window.onAddRow === "function") return window.onAddRow(prefill);
      if (typeof window.addRow   === "function") return window.addRow(prefill);
      ensureBody(); return newRow(prefill);
    };

    const cloneLastRow = ()=>{
      const tb = ensureBody(); if (!tb) return;
      const last = tb.querySelector("tr:last-child");
      if (!last) { addOneRow({}); return; }
      if (typeof window.onDuplicateLast === "function") return window.onDuplicateLast();
      const clone = last.cloneNode(true);
      const src = last.querySelectorAll("input,textarea,select");
      const dst = clone.querySelectorAll("input,textarea,select");
      src.forEach((s,i)=>{ if (dst[i]) dst[i].value = s.value; });
      tb.appendChild(clone);
    };

    const clearAll = ()=>{
      const tb = ensureBody(); if (!tb) return;
      if (typeof window.onClearAll === "function") return window.onClearAll();
      tb.innerHTML = "";
    };

    const exportCSV = ()=>{
      const tb = ensureBody(); if (!tb) return;
      if (typeof window.onExportCsv === "function") return window.onExportCsv();
      const rows = Array.from(tb.querySelectorAll("tr"));
      const data = rows.map(tr=>{
        const cells = Array.from(tr.querySelectorAll("td")).map(td=>{
          const el = td.querySelector("input,textarea,select");
          const v = el ? el.value : (td.textContent || "").trim();
          const needsQuotes = /[",;\n]/.test(v);
          const vv = String(v).replace(/"/g,'""');
          return needsQuotes ? `"${vv}"` : vv;
        });
        return cells.join(";");
      });
      const blob = new Blob([data.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "tags.csv"; a.click();
      URL.revokeObjectURL(url);
    };

    const openPaste = ()=>{
      if (typeof window.onOpenPaste === "function") return window.onOpenPaste();
      const modal = document.getElementById("pasteModal");
      const input = document.getElementById("pasteInput");
      const apply = document.getElementById("pasteApply");
      if (modal && input && apply) {
        modal.style.display = "";
        apply.onclick = ()=>{
          const text = input.value || "";
          text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).forEach(line=> addOneRow({ senal_name: line }));
          modal.style.display = "none";
          input.value = "";
        };
      } else {
        const text = window.prompt("Pegá líneas (una por fila):","");
        if (text) text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).forEach(line=> addOneRow({ senal_name: line }));
      }
    };

    const safeOn = (id, handler)=>{
      const el = $(id); if (!el) return;
      if (!el.type) el.type = "button";
      el.addEventListener("click", (ev)=>{ ev.preventDefault(); handler(); }, { passive:true });
    };

    safeOn("add",        ()=> addOneRow({}));
    safeOn("dup",        ()=> cloneLastRow());
    safeOn("clear",      ()=> clearAll());
    safeOn("exportCsv",  ()=> exportCSV());
    safeOn("pasteMulti", ()=> openPaste());
  }
};

/* ===========================================================
   ARRANQUE
   =========================================================== */

// Si tu proyecto ya define init(), lo respetamos
document.addEventListener("DOMContentLoaded", ()=>{
  try { if (typeof window.init === "function") window.init(); } catch(e){ console.warn("init() error:", e); }
  try { MainUI.bind(); } catch(e){ console.warn("MainUI.bind() error:", e); }
  try { TPL2.bindUI(); } catch(e){ console.warn("TPL2.bindUI() error:", e); }
});
