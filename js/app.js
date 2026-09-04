/* ==========================================================================
   UI-Verdrahtung: Umschalter, Dropdown, Tastenfeld, Position,
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


/* ---------- PIN-Schutz Logik ---------- */
  const TARGET_PIN = "2318"; // Hier Wunsch-PIN festlegen
  let currentPinInput = "";

  function initPinLock() {
    const backdrop = $("pinBackdrop");
    if (!backdrop) return;

    // Klicks auf Zahlentasten 0-9
    document.querySelectorAll(".pin-btn[data-val]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (currentPinInput.length < TARGET_PIN.length) {
          currentPinInput += btn.dataset.val;
          updatePinDots();
        }
      });
    });

    // Löschen (C)
    $("btnPinClear")?.addEventListener("click", () => {
      currentPinInput = "";
      updatePinDots();
    });

    // Bestätigen (✓)
    $("btnPinSubmit")?.addEventListener("click", verifyPin);

    // Tastatur-Eingabe unterstützen
    document.addEventListener("keydown", e => {
      if (backdrop.classList.contains("hidden")) return;

      if (e.key >= "0" && e.key <= "9") {
        if (currentPinInput.length < TARGET_PIN.length) {
          currentPinInput += e.key;
          updatePinDots();
        }
      } else if (e.key === "Backspace") {
        currentPinInput = currentPinInput.slice(0, -1);
        updatePinDots();
      } else if (e.key === "Enter") {
        verifyPin();
      }
    });
  }

  function updatePinDots() {
    const dots = document.querySelectorAll("#pinDots .dot");
    dots.forEach((dot, idx) => {
      dot.classList.toggle("active", idx < currentPinInput.length);
    });
  }

  function verifyPin() {
    if (currentPinInput === TARGET_PIN) {
      $("pinBackdrop")?.classList.add("hidden");
      currentPinInput = "";
      updatePinDots();
    } else {
      toast("Falsche PIN!", "err");
      currentPinInput = "";
      updatePinDots();
    }
  };






/* ---------- Daten laden & lokalen Status mergen ---------- */
  function loadData(){
    if(!window.FMS_DATA || !Array.isArray(window.FMS_DATA.fahrzeuge)) {
      throw new Error("FMS_DATA fehlt (data/gears.js nicht geladen)");
    }

    const baseData = window.FMS_DATA;
    
    // Gespeicherte Status-Werte aus dem LocalStorage holen
    let savedStatuses = {};
    try {
      savedStatuses = JSON.parse(localStorage.getItem("FMS_VEHICLE_STATUSES")) || {};
    } catch(e) {}

    // Fahrzeuge mit lokal gespeichertem Status (oder Standard 2) anreichern
    baseData.fahrzeuge = baseData.fahrzeuge.map(f => ({
      ...f,
      status: savedStatuses[f.name] !== undefined ? savedStatuses[f.name] : (f.status || 2)
    }));

    return baseData;
  }

  /* Status lokal auf dem Gerät speichern */
  function saveVehicleStatus(vehicleName, newStatus) {
    try {
      const savedStatuses = JSON.parse(localStorage.getItem("FMS_VEHICLE_STATUSES")) || {};
      savedStatuses[vehicleName] = newStatus;
      localStorage.setItem("FMS_VEHICLE_STATUSES", JSON.stringify(savedStatuses));
    } catch(e) {}
  }

  /* ---------- Tastenfeld ---------- */
  function buildKeypad(){
    const keypad = $("keypad");
    if (!keypad) return;
    keypad.innerHTML = "";
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
    if (!t) return;
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
    const titleEl = $("title");
    if(!titleEl) return;
    if(!t){ titleEl.textContent = "\u2014"; return; }
    titleEl.textContent = t.mode === "gruppen"
      ? t.name + " (" + t.members.length + ")"
      : t.name;
  }

  /* ---------- Custom Select Befüllen ---------- */
  function populateSelect() {
    const list = activeList();
    const dropdown = $("selectDropdown");
    if (!dropdown) return;
    dropdown.innerHTML = "";

    if (!list.some(i => i.name === cfg.selected)) {
      cfg.selected = list.length ? list[0].name : "";
    }

    list.forEach(item => {
      const option = document.createElement("div");
      option.className = "select-option" + (item.name === cfg.selected ? " selected" : "");
      option.dataset.value = item.name;

      const statusNum = item.status !== undefined ? item.status : "?";
      const text = cfg.mode === "gruppen"
        ? item.name + " (" + ((item.fahrzeuge || []).length) + ")"
        : item.name;

      option.innerHTML = `
        <span class="status-badge" data-status="${statusNum}">${statusNum}</span>
        <span class="select-label">${text}</span>
      `;

      option.addEventListener("click", () => {
        cfg.selected = item.name;
        updateSelectUI();
        refreshTitle();
        saveCfg();
        closeCustomSelect();
      });

      dropdown.appendChild(option);
    });

    updateSelectUI();
    refreshTitle();
  }

  function updateSelectUI() {
    const list = activeList();
    const current = list.find(i => i.name === cfg.selected);
    const badge = $("selectedBadge");
    const label = $("selectedLabel");

    if (current && badge && label) {
      const statusNum = current.status !== undefined ? current.status : "?";
      const text = cfg.mode === "gruppen"
        ? current.name + " (" + ((current.fahrzeuge || []).length) + ")"
        : current.name;

      badge.textContent = statusNum;
      badge.dataset.status = statusNum;
      label.textContent = text;
    } else if (badge && label) {
      badge.textContent = "--";
      badge.removeAttribute("data-status");
      label.textContent = "Keine Auswahl";
    }

    document.querySelectorAll(".select-option").forEach(opt => {
      opt.classList.toggle("selected", opt.dataset.value === cfg.selected);
    });
  }

  function toggleCustomSelect() {
    const cs = $("customSelect");
    if (!cs) return;
    cs.classList.toggle("open");
    const isOpen = cs.classList.contains("open");
    $("selectTrigger")?.setAttribute("aria-expanded", isOpen);
  }

  function closeCustomSelect() {
    $("customSelect")?.classList.remove("open");
    $("selectTrigger")?.setAttribute("aria-expanded", "false");
  }

  function setMode(mode){
    cfg.mode = mode;
    $("segFahrzeuge")?.classList.toggle("active", mode === "fahrzeuge");
    $("segGruppen")?.classList.toggle("active", mode === "gruppen");
    cfg.selected = "";
    populateSelect();
    saveCfg();
  }

/* ---------- Status senden & im Speicher aktualisieren ---------- */
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
    
    // Status lokal für alle erfolgreichen (oder im Testmodus alle) Fahrzeuge speichern
    target.members.forEach((m, idx) => {
      if (results[idx].ok || cfg.test) {
        // Status im aktiven Objekt aktualisieren
        const veh = data.fahrzeuge.find(f => f.name === m.name);
        if (veh) veh.status = n;
        
        // Im LocalStorage sichern
        saveVehicleStatus(m.name, n);
      }
    });

    // Dropdown UI mit den neuen Status-Farben aktualisieren
    populateSelect();

    if(tot === 1){
      const r = results[0];
      toast(r.ok ? "Status " + n + " gesendet (" + r.message + ")." : "Fehler: " + r.message,
            r.ok ? "ok" : "err");
    } else {
      const kind = ok === tot ? "ok" : (ok === 0 ? "err" : "");
      toast("Status " + n + ": " + ok + "/" + tot + " Fahrzeuge gesendet.", kind);
    }
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
    if($("fBase")) $("fBase").value = cfg.base;
    if($("fToken")) $("fToken").value = cfg.token;
    if($("fTest")) $("fTest").checked = cfg.test;
    backdrop?.classList.add("open");
  }
  function closeSheet(){ backdrop?.classList.remove("open"); }
  function save(){
    if($("fBase")) cfg.base = $("fBase").value.trim();
    if($("fToken")) cfg.token = $("fToken").value.trim();
    if($("fTest")) cfg.test = $("fTest").checked;
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
    initPinLock();
    loadCfg();
    buildKeypad();

    $("btnSettings")?.addEventListener("click", openSheet);
    $("btnClose")?.addEventListener("click", closeSheet);
    $("btnSave")?.addEventListener("click", save);
    $("btnPos")?.addEventListener("click", setPosition);
    $("segFahrzeuge")?.addEventListener("click", () => setMode("fahrzeuge"));
    $("segGruppen")?.addEventListener("click", () => setMode("gruppen"));
    
    // Custom Select Listener
    $("selectTrigger")?.addEventListener("click", toggleCustomSelect);
    document.addEventListener("click", e => {
      const cs = $("customSelect");
      if (cs && !cs.contains(e.target)) closeCustomSelect();
    });

    backdrop?.addEventListener("click", e => { if(e.target === backdrop) closeSheet(); });

    $("segFahrzeuge")?.classList.toggle("active", cfg.mode === "fahrzeuge");
    $("segGruppen")?.classList.toggle("active", cfg.mode === "gruppen");

    try{
      data = await loadData();
    }catch(e){
      toast("data/gears.js nicht geladen. Datei vorhanden?", "err");
    }
    populateSelect();

    if(!cfg.token) openSheet();
    registerSW();
  });
})();