/* ==========================================================================
   UI-Verdrahtung: Umschalter, Custom-Dropdown, Tastenfeld, Position,
   Einstellungen, Theme-Switch, Service-Worker, PIN-Sperre & Status.
   ========================================================================== */
(function(){
  "use strict";
  const $ = id => document.getElementById(id);

  let cfg  = { ...FMS.DEFAULT_CONFIG };
  let data = { fahrzeuge:[], gruppen:[] };
  let pollTimer = null;

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

  /* ---------- Theme-Steuerung ---------- */
  function applyTheme(isDark) {
    document.documentElement.classList.toggle("dark-mode", !!isDark);
  }

  /* ---------- PIN-Schutz Logik ---------- */
  const TARGET_PIN = "2318";
  let currentPinInput = "";

  function initPinLock() {
    const backdrop = $("pinBackdrop");
    if (!backdrop) return;

    document.querySelectorAll(".pin-btn[data-val]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (currentPinInput.length < TARGET_PIN.length) {
          currentPinInput += btn.dataset.val;
          updatePinDots();
        }
      });
    });

    $("btnPinClear")?.addEventListener("click", () => {
      currentPinInput = "";
      updatePinDots();
    });

    $("btnPinSubmit")?.addEventListener("click", verifyPin);

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
  }

  /* ---------- Daten laden & lokalen Status mergen ---------- */
  function loadData(){
    if(!window.FMS_DATA || !Array.isArray(window.FMS_DATA.fahrzeuge)) {
      throw new Error("FMS_DATA fehlt (data/gears.js nicht geladen)");
    }

    const baseData = window.FMS_DATA;
    let savedStatuses = {};
    try {
      savedStatuses = JSON.parse(localStorage.getItem("FMS_VEHICLE_STATUSES")) || {};
    } catch(e) {}

    baseData.fahrzeuge = baseData.fahrzeuge.map(f => ({
      ...f,
      status: savedStatuses[f.name] !== undefined ? savedStatuses[f.name] : (f.status || 2)
    }));

    return baseData;
  }

  function saveVehicleStatus(vehicleName, newStatus) {
    try {
      const savedStatuses = JSON.parse(localStorage.getItem("FMS_VEHICLE_STATUSES")) || {};
      savedStatuses[vehicleName] = newStatus;
      localStorage.setItem("FMS_VEHICLE_STATUSES", JSON.stringify(savedStatuses));
    } catch(e) {}
  }

  function saveVehiclePosition(vehicleName, lat, lng) {
    try {
      const saved = JSON.parse(localStorage.getItem("FMS_VEHICLE_POSITIONS")) || {};
      saved[vehicleName] = { lat, lng, timestamp: new Date().toISOString() };
      localStorage.setItem("FMS_VEHICLE_POSITIONS", JSON.stringify(saved));
    } catch(e) {}
  }

  /* ---------- Status per GET abfragen (Nutzung von Basic Auth) ---------- */
  async function fetchRemoteStatuses() {
    const basicToken = cfg.basicToken || cfg.token;
    if (!cfg.base || !basicToken) return;

    const baseUrl = cfg.base.replace(/\/+$/, "");
    const url = new URL(baseUrl + (baseUrl.endsWith("/api") ? "/gear/getGearAndExternalGear" : "/api/gear/getGearAndExternalGear"));

    const authHeader = basicToken.startsWith("Basic ") ? basicToken : "Basic " + basicToken;

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": authHeader
        }
      });

      if (!response.ok) return;

      const result = await response.json();
      const gearList = result.gear || result.gears || (Array.isArray(result) ? result : []);

      let hasChanges = false;

      gearList.forEach(item => {
        const veh = data.fahrzeuge.find(f => 
          (f.name && item.title && f.name.trim().toLowerCase() === item.title.trim().toLowerCase()) ||
          (f.name && item.gearname && f.name.trim().toLowerCase() === item.gearname.trim().toLowerCase()) ||
          (f.issi && item.gearIdentifier && String(f.issi) === String(item.gearIdentifier)) ||
          (f.issi && item.issi && String(f.issi) === String(item.issi))
        );

        if (veh) {
          const statusRaw = item.radioStatusShort !== null && item.radioStatusShort !== undefined 
            ? item.radioStatusShort 
            : (item.status !== undefined ? item.status : item.radioStatusHumanReadable);

          const newStatus = parseInt(statusRaw, 10);

          if (!isNaN(newStatus) && veh.status !== newStatus) {
            veh.status = newStatus;
            saveVehicleStatus(veh.name, newStatus);
            hasChanges = true;
          }

          // Position aus der Serverantwort uebernehmen, falls vorhanden ->
          // dadurch sehen ALLE die Position (nicht nur das eigene Geraet).
          // Feldnamen ggf. an die echte API anpassen (Beispielkandidaten unten).
          const rlat = item.latitude ?? item.lat ?? (item.position && item.position.lat) ?? (item.gps && item.gps.lat);
          const rlng = item.longitude ?? item.lng ?? item.lon ?? (item.position && item.position.lng) ?? (item.gps && item.gps.lng);
          if (rlat != null && rlat !== "" && rlng != null && rlng !== "") {
            saveVehiclePosition(veh.name, parseFloat(rlat), parseFloat(rlng));
            hasChanges = true;
          }
        }
      });

      if (hasChanges) {
        populateSelect();
        refreshTitle();
        renderStatusOverview();
      }
    } catch (err) {
      console.warn("Fehler beim Abrufen der Fahrzeuge:", err);
    }
  }

  function startStatusPolling(intervalMs = 3000) {
    stopStatusPolling();
    fetchRemoteStatuses();
    pollTimer = setInterval(fetchRemoteStatuses, intervalMs);
  }

  function stopStatusPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
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
      b.setAttribute("aria-label", "Status " + n + ": " + s.label);

      b.innerHTML = `
        <span class="key-num">${n}</span>
        <span class="key-label">${s.label}</span>
      `;

      b.addEventListener("click", () => onKey(n));
      keypad.appendChild(b);
    });
  }

  function markSelected(n){
    document.querySelectorAll(".key").forEach(k => {
      const statusNum = Number(k.dataset.status);
      const isSelected = statusNum === Number(n);
      k.classList.toggle("selected", isSelected);
      if (isSelected) {
        k.setAttribute("data-status-active", statusNum);
      } else {
        k.removeAttribute("data-status-active");
      }
    });
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

      markSelected(statusNum);
    } else if (badge && label) {
      badge.textContent = "--";
      badge.removeAttribute("data-status");
      label.textContent = "Keine Auswahl";
      markSelected(-1);
    }

    document.querySelectorAll(".select-option").forEach(opt => {
      opt.classList.toggle("selected", opt.dataset.value === cfg.selected);
    });
  }

  /* Aktuelle Status aus dem lokalen Speicher (wird u. a. vom Sync gefuellt)
     ins Datenobjekt uebernehmen und die Badges im Dropdown in-place erneuern. */
  function readStatusesIntoData(){
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem("FMS_VEHICLE_STATUSES")) || {}; } catch(e) {}
    (data.fahrzeuge || []).forEach(f => {
      if (saved[f.name] !== undefined) f.status = saved[f.name];
    });
  }

  function refreshStatusUI(){
    readStatusesIntoData();
    document.querySelectorAll("#selectDropdown .select-option").forEach(opt => {
      const veh = (data.fahrzeuge || []).find(f => f.name === opt.dataset.value);
      if (!veh) return; // Gruppen haben keinen Einzelstatus
      const b = opt.querySelector(".status-badge");
      if (b) {
        const s = veh.status !== undefined ? veh.status : "?";
        b.textContent = s;
        b.dataset.status = s;
      }
    });
    updateSelectUI();
    if ($("statusOverviewBackdrop")?.classList.contains("open")) renderStatusOverview();
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

  /* ---------- Statusübersicht Modal ---------- */
  function renderStatusOverview() {
    const container = $("statusOverviewList");
    if (!container) return;
    container.innerHTML = "";

    data.fahrzeuge.forEach(f => {
      const row = document.createElement("div");
      row.className = "status-row";
      
      const st = f.status !== undefined ? f.status : "?";

      row.innerHTML = `
        <div class="status-box" data-status="${st}">${st}</div>
        <div class="vehicle-name">${f.name}</div>
      `;

      container.appendChild(row);
    });
  }

  function openOverview() {
    renderStatusOverview();
    $("statusOverviewBackdrop")?.classList.add("open");
  }

  function closeOverview() {
    $("statusOverviewBackdrop")?.classList.remove("open");
  }

  function undockOverview(e) {
    // Bevorzugt ein eigenes Fenster (fuer PC / zweiten Monitor). Klappt das nicht
    // (Popup-Blocker, PWA, mobil), uebernimmt der Link mit target="_blank".
    let win = null;
    try {
      win = window.open("uebersicht.html", "fmsUebersicht",
        "width=1100,height=720,resizable=yes,scrollbars=yes");
    } catch (_) {}
    if (win) {
      if (e && e.preventDefault) e.preventDefault();  // eigenes Fenster genutzt -> Link-Standard unterdruecken
      closeOverview();
    }
    // sonst: nichts tun -> der Link oeffnet regulaer einen neuen Tab
  }


 /* ---------- Status senden (inkl. hochpräzisem GPS & Karten-Update) ---------- */
  async function onKey(n){
    const target = currentTarget();
    if(!target || !target.members.length){
      toast(cfg.mode === "gruppen" ? "Gruppe ohne Fahrzeuge." : "Kein Fahrzeug gewählt.", "err");
      return;
    }
    
    markSelected(n);
    toast("Sende Status " + n + " \u2026");

    // 1. FMS-Status senden
    const results = await Promise.all(target.members.map(m =>
      FMS.sendOne({ 
        base: cfg.base, 
        token: cfg.apiToken || cfg.token, 
        basicToken: cfg.basicToken,
        issi: m.issi, 
        status: n, 
        test: cfg.test 
      })
    ));

    // 2. Status sofort im LocalStorage & Datenobjekt speichern (Wichtig fürs Karten-Redraw!)
    target.members.forEach((m, idx) => {
      if (results[idx].ok || cfg.test) {
        const veh = data.fahrzeuge.find(f => f.name === m.name);
        if (veh) veh.status = n;
        
        // Speichere den neuen Status im LocalStorage
        try {
          const savedStatuses = JSON.parse(localStorage.getItem("FMS_VEHICLE_STATUSES")) || {};
          savedStatuses[m.name] = n;
          localStorage.setItem("FMS_VEHICLE_STATUSES", JSON.stringify(savedStatuses));
        } catch(e) {}

        // Status an den geteilten Sync melden (sehen alle)
        if (FMS.Sync && FMS.Sync.publish) FMS.Sync.publish(m.name, { issi: m.issi, status: n });
      }
    });

    // 3. Hochpräzise GPS-Position abfragen
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          
          let savedPositions = {};
          try {
            savedPositions = JSON.parse(localStorage.getItem("FMS_VEHICLE_POSITIONS")) || {};
          } catch(e) {}

          target.members.forEach(m => {
            savedPositions[m.name] = { lat, lng, timestamp: new Date().toISOString() };

            // Direktes Update des Markers auf der Karte auslösen
            if (window.MapModule && typeof window.MapModule.updateVehiclePosition === "function") {
              window.MapModule.updateVehiclePosition(m.name, lat, lng);
            }

            // Position (mit aktuellem Status) an den geteilten Sync melden (sehen alle)
            if (FMS.Sync && FMS.Sync.publish) FMS.Sync.publish(m.name, { issi: m.issi, lat: lat, lng: lng, status: n });
          });

          try {
            localStorage.setItem("FMS_VEHICLE_POSITIONS", JSON.stringify(savedPositions));
          } catch(e) {}

          // Position auch zentral an den Server senden, sobald ein Positions-
          // Endpunkt konfiguriert ist (siehe FMS.POSITION_ENDPOINT in js/api.js).
          // Erst dann ist die Position fuer ANDERE sichtbar.
          if (!cfg.test && FMS.POSITION_ENDPOINT) {
            target.members.forEach(m => {
              FMS.sendPosition({
                base: cfg.base,
                token: cfg.apiToken || cfg.token,
                basicToken: cfg.basicToken,
                issi: m.issi,
                lat: lat,
                lng: lng
              });
            });
          }
        },
        (err) => console.warn("GPS-Abfrage fehlerhaft:", err),
        { 
          enableHighAccuracy: true, // Erzwingt echten Sensor/GPS-Chip statt IP-Ortung
          timeout: 10000, 
          maximumAge: 0            // Verhindert das Nutzen alter/gecacheter Standortdaten
        }
      );
    }

    populateSelect();
    updateSelectUI();
    refreshTitle();
    renderStatusOverview();

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

  /* ---------- Automatisches Polling-Intervall (Gleiches Intervall wie GET/Fetch) ---------- */
  // Falls dein Poller z.B. alle 5000ms läuft, aktualisiere die Karte im selben Intervall:
  const POLL_INTERVAL = 5000; 

  setInterval(() => {
    if (window.MapModule && typeof window.MapModule.update === "function") {
      window.MapModule.update();
    }
  }, POLL_INTERVAL);

  /* ---------- Einstellungen Sheet ---------- */
  const backdrop = $("sheetBackdrop");
  
  function openSheet(){
    if($("fBase")) $("fBase").value = cfg.base || (FMS.DEFAULT_CONFIG && FMS.DEFAULT_CONFIG.base) || "";
    if($("fApiToken")) $("fApiToken").value = cfg.apiToken || cfg.token || "";
    if($("fBasicToken")) $("fBasicToken").value = cfg.basicToken || "";
    if($("fTest")) $("fTest").checked = cfg.test;
    
    const themeCheckbox = $("fTheme");
    if(themeCheckbox) {
      themeCheckbox.checked = cfg.darkMode !== false;
    }

    backdrop?.classList.add("open");
  }

  function closeSheet(){ backdrop?.classList.remove("open"); }

  function save(){
    if($("fBase")) cfg.base = $("fBase").value.trim();
    if($("fApiToken")) cfg.apiToken = $("fApiToken").value.trim();
    if($("fBasicToken")) cfg.basicToken = $("fBasicToken").value.trim();
    if($("fTest")) cfg.test = $("fTest").checked;
    if($("fTheme")) cfg.darkMode = $("fTheme").checked;
    
    cfg.token = cfg.apiToken || cfg.basicToken;
    
    applyTheme(cfg.darkMode);
    saveCfg();
    startStatusPolling(3000);

    toast("Einstellungen gespeichert.", "ok");
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

    if (cfg.darkMode === undefined) cfg.darkMode = true;
    applyTheme(cfg.darkMode);

    $("fTheme")?.addEventListener("change", (e) => {
      applyTheme(e.target.checked);
    });

    buildKeypad();

    $("btnSettings")?.addEventListener("click", openSheet);
    $("btnClose")?.addEventListener("click", closeSheet);
    $("btnSave")?.addEventListener("click", save);
    $("segFahrzeuge")?.addEventListener("click", () => setMode("fahrzeuge"));
    $("segGruppen")?.addEventListener("click", () => setMode("gruppen"));
    
    $("btnOpenOverview")?.addEventListener("click", openOverview);
    $("btnCloseOverview")?.addEventListener("click", closeOverview);
    $("btnUndockOverview")?.addEventListener("click", undockOverview);

    $("selectTrigger")?.addEventListener("click", toggleCustomSelect);
    document.addEventListener("click", e => {
      const cs = $("customSelect");
      if (cs && !cs.contains(e.target)) closeCustomSelect();
    });

    backdrop?.addEventListener("click", e => { if(e.target === backdrop) closeSheet(); });

    $("segFahrzeuge")?.classList.toggle("active", cfg.mode === "fahrzeuge");
    $("segGruppen")?.classList.toggle("active", cfg.mode === "gruppen");

    try { data = loadData(); } catch(e) {}

    populateSelect();
    refreshStatusUI();
    setInterval(refreshStatusUI, 2000);   // Statusaenderungen (Sync/Server) ins Dropdown uebernehmen

    if(!cfg.apiToken && !cfg.basicToken && !cfg.token) {
      openSheet();
    } else {
      startStatusPolling(3000);
    }

    registerSW();
  });

})();