/* ==========================================================================
   UI-Verdrahtung: Umschalter, Dropdown, Tastenfeld, Notiz, Position,
   Einstellungen, Service-Worker.
   Datenquelle: data/gears.js (setzt window.FMS_DATA, per <script> geladen).
   ========================================================================== */
(function(){
  "use strict";
  const $ = id => document.getElementById(id);

  let cfg  = { ...FMS.DEFAULT_CONFIG };
  let data = { fahrzeuge:[], gruppen:[] };

  /* ---------- Konfiguration ---------- */
  function loadCfg(){
    try{
      const raw = localStorage.getItem(FMS.STORAGE_KEY);
      if(raw) cfg = { ...FMS.DEFAULT_CONFIG, ...JSON.parse(raw) };
    }catch(e){}
  }
  function saveCfg(){
    try{ localStorage.setItem(FMS.STORAGE_KEY, JSON.stringify(cfg)); }catch(e){}
  }

  /* ---------- Daten laden ----------
     Kommen aus data/gears.js (setzt window.FMS_DATA, per <script> geladen).
     Das funktioniert lokal (file://) und gehostet gleichermassen. */
  function loadData(){
    if(window.FMS_DATA && Array.isArray(window.FMS_DATA.fahrzeuge)) return window.FMS_DATA;
    throw new Error("FMS_DATA fehlt (data/gears.js nicht geladen)");
  }

  /* ---------- Tastenfeld ---------- */
  function buildKeypad(){
    const keypad = $("keypad");
    FMS.ORDER.forEach(n => {
      const s = FMS.STATUS[n];
      const b = document.createElement("button");
      b.className = "key" + (n === 0 ? " zero" : "");
      b.dataset.status = n;
      b.textContent = n;
      b.setAttribute("aria-label", "Status " + n + ": " + s.label);
      b.addEventListener("click", () => onKey(n));
      keypad.appendChild(b);
    });
  }
  function markSelected(n){
    document.querySelectorAll(".key").forEach(k =>
      k.classList.toggle("selected", Number(k.dataset.status) === n));
  }

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg, kind){
    const t = $("toast");
    t.textContent = msg;
    t.className = "toast show" + (kind ? " " + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = "toast"; }, 3600);
  }

  /* ---------- Auswahl / Ziel ---------- */
  function activeList(){ return cfg.mode === "gruppen" ? data.gruppen : data.fahrzeuge; }
  function issiOf(name){
    const v = data.fahrzeuge.find(f => f.name === name);
    return v ? (v.issi || "") : "";
  }
  function currentTarget(){
    if(cfg.mode === "gruppen"){
      const g = data.gruppen.find(x => x.name === cfg.selected);
      if(!g) return null;
      const members = (g.fahrzeuge || []).map(nm => ({ name:nm, issi:issiOf(nm) }));
      return { name:g.name, mode:"gruppen", members };
    }
    const v = data.fahrzeuge.find(x => x.name === cfg.selected);
    if(!v) return null;
    return { name:v.name, mode:"fahrzeuge", members:[{ name:v.name, issi:v.issi || "" }] };
  }

  function refreshTitle(){
    const t = currentTarget();
    if(!t){ $("title").textContent = "\u2014"; return; }
    $("title").textContent = t.mode === "gruppen"
      ? t.name + " (" + t.members.length + ")"
      : t.name;
  }

  function populateSelect(){
    const sel = $("target");
    const list = activeList();
    sel.innerHTML = "";
    list.forEach(item => {
      const o = document.createElement("option");
      o.value = item.name;
      o.textContent = cfg.mode === "gruppen"
        ? item.name + " (" + ((item.fahrzeuge || []).length) + ")"
        : item.name;
      sel.appendChild(o);
    });
    if(!list.some(i => i.name === cfg.selected)){
      cfg.selected = list.length ? list[0].name : "";
    }
    sel.value = cfg.selected;
    refreshTitle();
  }

  function setMode(mode){
    cfg.mode = mode;
    $("segFahrzeuge").classList.toggle("active", mode === "fahrzeuge");
    $("segGruppen").classList.toggle("active", mode === "gruppen");
    cfg.selected = "";           // Auswahl fuer neuen Modus neu bestimmen
    populateSelect();
    saveCfg();
  }

  /* ---------- Status senden (1 Fahrzeug oder ganze Gruppe) ---------- */
  async function onKey(n){
    markSelected(n);
    const target = currentTarget();
    if(!target || !target.members.length){
      toast(cfg.mode === "gruppen" ? "Gruppe ohne Fahrzeuge." : "Kein Fahrzeug gewaehlt.", "err");
      return;
    }
    toast("Sende Status " + n + " \u2026");
    const results = await Promise.all(target.members.map(m =>
      FMS.sendOne({ base:cfg.base, token:cfg.token, issi:m.issi, status:n, test:cfg.test })));

    const ok  = results.filter(r => r.ok).length;
    const tot = results.length;
    if(tot === 1){
      const r = results[0];
      toast(r.ok ? "Status " + n + " gesendet (" + r.message + ")." : "Fehler: " + r.message,
            r.ok ? "ok" : "err");
    } else {
      const kind = ok === tot ? "ok" : (ok === 0 ? "err" : "");
      toast("Status " + n + ": " + ok + "/" + tot + " Fahrzeuge gesendet.", kind);
    }
  }

  /* ---------- Freitext-Notiz (Endpunkt noch offen) ---------- */
  function sendNote(){
    const text = $("note").value.trim();
    if(!text){ toast("Notiz ist leer."); return; }
    toast("Notiz-Endpunkt noch nicht hinterlegt.", "err");
  }

  /* ---------- Aktuelle Position erfassen ---------- */
  function setPosition(){
    if(!navigator.geolocation){ toast("Standort wird nicht unterstuetzt.", "err"); return; }
    toast("Ermittle Position \u2026");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const la = pos.coords.latitude.toFixed(5), lo = pos.coords.longitude.toFixed(5);
        toast("Position " + la + ", " + lo + " (Senden noch nicht angebunden).", "ok");
      },
      () => toast("Position nicht verfuegbar (Freigabe pruefen).", "err"),
      { enableHighAccuracy:true, timeout:8000 }
    );
  }

  /* ---------- Einstellungen ---------- */
  const backdrop = $("sheetBackdrop");
  function openSheet(){
    $("fBase").value  = cfg.base;
    $("fToken").value = cfg.token;
    $("fTest").checked = cfg.test;
    backdrop.classList.add("open");
  }
  function closeSheet(){ backdrop.classList.remove("open"); }
  function save(){
    cfg.base  = $("fBase").value.trim();
    cfg.token = $("fToken").value.trim();
    cfg.test  = $("fTest").checked;
    saveCfg();
    toast(cfg.test ? "Gespeichert. Testmodus aktiv." : "Einstellungen gespeichert.", "ok");
    closeSheet();
  }

  /* ---------- Service-Worker ---------- */
  function registerSW(){
    if("serviceWorker" in navigator && location.protocol.startsWith("http")){
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    }
  }

  /* ---------- Start ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    loadCfg();
    buildKeypad();

    $("btnSettings").addEventListener("click", openSheet);
    $("btnClose").addEventListener("click", closeSheet);
    $("btnSave").addEventListener("click", save);
    $("btnNote").addEventListener("click", sendNote);
    $("btnPos").addEventListener("click", setPosition);
    $("btnBack").addEventListener("click", () => history.length > 1 ? history.back() : null);
    $("segFahrzeuge").addEventListener("click", () => setMode("fahrzeuge"));
    $("segGruppen").addEventListener("click", () => setMode("gruppen"));
    $("target").addEventListener("change", e => { cfg.selected = e.target.value; refreshTitle(); saveCfg(); });
    backdrop.addEventListener("click", e => { if(e.target === backdrop) closeSheet(); });

    // Umschalter auf gespeicherten Modus setzen
    $("segFahrzeuge").classList.toggle("active", cfg.mode === "fahrzeuge");
    $("segGruppen").classList.toggle("active", cfg.mode === "gruppen");

    try{
      data = await loadData();
    }catch(e){
      toast("data/gears.js nicht geladen. Datei vorhanden?", "err");
    }
    populateSelect();

    if(!cfg.token) openSheet();      // beim ersten Start Einstellungen zeigen
    registerSW();
  });
})();
