/* ============================================================
   Kartenansicht mit Leaflet, Fahrzeug-Icons, Status & LocalStorage-Sync
   ============================================================ */
(function() {
  "use strict";

  // CSS-Stile für transparente Marker und die Kompakt-Ansicht dynamisch injizieren
  const style = document.createElement("style");
  style.textContent = `
    .custom-vehicle-marker {
      background: transparent !important;
      border: none !important;
    }
    .compact-cluster-wrap {
      display: flex; flex-direction: column; align-items: center;
    }
    .compact-cluster-box {
      background: #ffffff;
      border: 2px solid #1e293b;
      border-radius: 6px;
      padding: 6px 10px;
      font-family: sans-serif;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      min-width: 150px;
      white-space: nowrap;
    }
    .compact-cluster-tail {
      width: 0; height: 0;
      border-left: 9px solid transparent;
      border-right: 9px solid transparent;
      border-top: 12px solid #1e293b;
      margin-top: -1px;
      filter: drop-shadow(0 2px 1px rgba(0,0,0,0.3));
    }
    .compact-cluster-title {
      font-size: 10px; color: #64748b; text-align: center;
      border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 4px;
    }
    .compact-cluster-grid {
      display: grid; gap: 3px 16px;
    }
    .compact-cluster-item {
      display: flex; justify-content: space-between; align-items: center; gap: 10px;
      font-size: 12px; font-weight: bold; color: #1e293b;
    }
  `;
  document.head.appendChild(style);

  let map = null;
  let lastFitSig = null;   // verhindert wiederholtes Zentrieren bei gleicher Lage

  /* Entfernung zwischen zwei Koordinaten in Metern (Haversine). */
  function distanceMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  const markers = {}; // Speichert Marker nach Fahrzeug-Name
  const lines = [];   // Speichert Verbindungslinien

  /* ============================================================
     ZENTRALE EINSTELLUNGEN FÜR GRÖSSEN, FARBEN, GRID & ZOOM
     ============================================================ */
  const MAP_CONFIG = {
    // Icon-Größen
    imgWidth: 75,         // Breite des Fahrzeugbildes / SVGs (in Pixeln)
    imgHeight: 75,        // Höhe des Fahrzeugbildes / SVGs (in Pixeln)
    
    // Status-Balken & Name
    barHeight: 22,        // Höhe des Status-Balkens
    fontSize: 14,         // Schriftgröße der Statusnummer
    
    // Ab diesem Pixel-Abstand gelten Fahrzeuge als "am selben Ort" und werden
    // zu EINER kompakten Liste zusammengefasst (verhindert Icon-Ueberlagerung).
    clusterRadius: 70,
    // Maximale Hoehe der Kompakt-Liste (darueber wird sie scrollbar)
    compactMaxHeight: 340,

    // Auto-Polling Interval (in Millisekunden)
    pollInterval: 3000,

    // Positionen, die aelter als X Minuten sind, werden abgeblendet dargestellt
    // (0 = Funktion aus). Zeigt auf einen Blick, was noch aktuell ist.
    staleMinutes: 30,

    // Zoom-Einstellungen
    maxZoomOnBounds: 16,
    // Rand beim Zentrieren (in Pixeln). Oben mehr Platz fuer die Sprechblasen,
    // damit Namen/Listen nach dem Fit nicht abgeschnitten werden.
    padTopLeft: [60, 170],
    padBottomRight: [60, 90],

    // Fahrzeuge, die "an der Unterkunft" stehen, ausblenden (entlastet die Karte):
    // nur beim angegebenen Status UND innerhalb radiusM um die Basis-Koordinate.
    hideAtBase: {
      enabled: true,
      status: 2,       // nur diesen Status ausblenden (2 = Einsatzbereit Unterkunft)
      radiusM: 100,     // Radius in Metern
      // Unterkunft: Auf dem Knapp 21, 42855 Remscheid (THW OV Remscheid).
      lat: 51.182937,
      lng: 7.2301839
    }
  };

  /* ---------- Farbschema für den Status-Balken ---------- */
  const STATUS_COLORS = {
    0: "#ff0000", // Notruf / Grau
    1: "#2db7f5", // Frei auf Funk / Hellblau
    2: "#52c41a", // Einsatzbereit Wache / Grün
    3: "#fa8c16", // Einsatz übernommen / Orange
    4: "#ff6f76", // Am Einsatzort / Rot
    5: "#13c2c2", // Sprechwunsch / Cyan
    6: "#595959", // Nicht einsatzbereit / Dunkelgrau
    7: "#eb2f96", // Patient aufgenommen / Magenta
    8: "#722ed1", // Am Transportziel / Violett
    9: "#1890ff"  // Arztanforderung / Blau
  };

  /* ---------- LocalStorage Hilfsfunktionen ---------- */
  function getSavedPosition(vehicleName) {
    try {
      const saved = JSON.parse(localStorage.getItem("FMS_VEHICLE_POSITIONS")) || {};
      return saved[vehicleName] || null;
    } catch(e) {
      return null;
    }
  }

  function getSavedStatus(vehicleName, defaultStatus) {
    try {
      const savedStatuses = JSON.parse(localStorage.getItem("FMS_VEHICLE_STATUSES")) || {};
      if (savedStatuses[vehicleName] !== undefined) {
        return savedStatuses[vehicleName];
      }
    } catch(e) {}
    return defaultStatus !== undefined ? defaultStatus : 2;
  }

  /* ---------- Vorherige Linien löschen ---------- */
  function clearLines() {
    lines.forEach(line => map.removeLayer(line));
    lines.length = 0;
  }

  /* ---------- Karte initialisieren ---------- */
  function initMap() {
    const mapContainer = document.getElementById("map");
    if (!mapContainer || map) return;

    map = L.map("map").setView([51.1802, 7.1858], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    map.on('zoomend moveend', () => {
      renderAllVehicleMarkers(false);
    });

    renderAllVehicleMarkers(true);
  }

  /* ---------- Custom-Icon mit Namen & Status erzeugen ---------- */
  function createVehicleIcon(vehicleName, iconFileName, statusNum) {
    const iconUrl = iconFileName ? `icons/fahrzeuge/${iconFileName}` : 'icons/fahrzeuge/default.png';
    const barColor = STATUS_COLORS[statusNum] || "#334155";
    const statusText = statusNum !== undefined ? statusNum : '?';

    const width = MAP_CONFIG.imgWidth;
    const height = MAP_CONFIG.imgHeight + MAP_CONFIG.barHeight + 25;

    return L.divIcon({
      className: 'custom-vehicle-marker',
      html: `
        <div style="
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          justify-content: flex-start;
          width: ${width}px; 
          box-sizing: border-box;
        ">
          <!-- Fahrzeug Bild / Taktisches Zeichen -->
          <img src="${iconUrl}" 
               style="
                 width: ${MAP_CONFIG.imgWidth}px; 
                 height: ${MAP_CONFIG.imgHeight}px; 
                 object-fit: contain; 
                 display: block;
                 filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
               " 
               onerror="this.src='https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png'">
          
          <!-- Status-Balken unter dem Bild -->
          <div style="
            width: ${MAP_CONFIG.imgWidth}px; 
            height: ${MAP_CONFIG.barHeight}px; 
            background-color: ${barColor}; 
            color: #ffffff; 
            border-radius: 4px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.3); 
            border: 2px solid #ffffff; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            font-size: ${MAP_CONFIG.fontSize}px; 
            font-weight: bold; 
            font-family: sans-serif;
            margin-top: 3px;
            box-sizing: border-box;
          ">
            ${statusText}
          </div>

          <!-- Fahrzeugname direkt unter dem Status-Balken -->
          <div style="
            background: rgba(255, 255, 255, 0.9);
            color: #1e293b;
            font-size: 11px;
            font-weight: bold;
            font-family: sans-serif;
            padding: 1px 5px;
            border-radius: 3px;
            margin-top: 2px;
            border: 1px solid #cbd5e1;
            white-space: nowrap;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          ">
            ${vehicleName}
          </div>
        </div>
      `,
      iconSize: [width, height],
      iconAnchor: [width / 2, height / 2],
      popupAnchor: [0, -height / 2]
    });
  }

  /* ---------- Kompakt-Icon für >= 4 Fahrzeuge an einer Stelle ---------- */
  function createCompactClusterIcon(clusterVehicles) {
    let itemsHtml = '';
    clusterVehicles.forEach(veh => {
      const vehData = window.FMS_DATA?.fahrzeuge?.find(f => f.name === veh.name) || {};
      const currentStatus = getSavedStatus(veh.name, vehData.status);
      const color = STATUS_COLORS[currentStatus] || '#334155';

      itemsHtml += `
        <div class="compact-cluster-item">
          <span style="color: #1e293b;">${veh.name}</span>
          <span style="background: ${color}; color: #fff; padding: 1px 6px; border-radius: 3px; font-size: 11px;">${currentStatus}</span>
        </div>
      `;
    });

    // Mehrspaltig, damit der Kasten bei vielen Fahrzeugen niedrig bleibt
    const count = clusterVehicles.length;
    const cols = count > 16 ? 3 : (count > 8 ? 2 : 1);
    const rows = Math.ceil(count / cols);

    const rowH = 22, headerH = 26, padV = 14, tailH = 12, colW = 150;
    const boxHeight = rows * rowH + headerH + padV;
    const width = cols * colW + 24;
    const total = boxHeight + tailH;

    return L.divIcon({
      className: 'custom-vehicle-marker',
      html: `
        <div class="compact-cluster-wrap">
          <div class="compact-cluster-box">
            <div class="compact-cluster-title">⚠️ ${count} Fahrzeuge vor Ort</div>
            <div class="compact-cluster-grid" style="grid-template-columns: repeat(${cols}, max-content);">
              ${itemsHtml}
            </div>
          </div>
          <div class="compact-cluster-tail"></div>
        </div>
      `,
      iconSize: [width, total],
      iconAnchor: [width / 2, total]   // Pfeilspitze sitzt genau auf der Position
    });
  }

  /* ---------- Einzelnen Marker (Standard) zeichnen / aktualisieren ---------- */
  function drawOrUpdateMarker(key, vehicleName, displayLatLng) {
    const vehData = window.FMS_DATA?.fahrzeuge?.find(f => f.name === vehicleName) || {};
    const currentStatus = getSavedStatus(vehicleName, vehData.status);

    // Alter der Position bestimmen (fuer Abblenden + Zeitstempel im Popup)
    const saved = getSavedPosition(vehicleName);
    let opacity = 1;
    let stampLine = "";
    if (saved && saved.timestamp) {
      const d = new Date(saved.timestamp);
      const ageMin = (Date.now() - d.getTime()) / 60000;
      if (MAP_CONFIG.staleMinutes > 0 && ageMin > MAP_CONFIG.staleMinutes) opacity = 0.4;
      const t = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
      stampLine = `<br><small style="font-size: 11px; color:${opacity < 1 ? '#c0392b' : '#888'};">Stand: ${t}${opacity < 1 ? ' (veraltet)' : ''}</small>`;
    }

    const icon = createVehicleIcon(vehicleName, vehData.icon, currentStatus);
    const popupContent = `
      <div style="text-align: center; font-family: sans-serif;">
        <strong style="font-size: 15px;">${vehicleName}</strong><br>
        <span style="font-size: 13px; color: #444;">Status: <b style="color:${STATUS_COLORS[currentStatus] || '#000'}">${currentStatus}</b></span><br>
        <small style="font-size: 11px; color: #888;">ISSI: ${vehData.issi || '-'}</small>${stampLine}
      </div>
    `;

    if (markers[key]) {
      markers[key].setLatLng(displayLatLng);
      markers[key].setIcon(icon);
      markers[key].setOpacity(opacity);
      markers[key].getPopup().setContent(popupContent);
    } else {
      markers[key] = L.marker(displayLatLng, { icon: icon, opacity: opacity })
        .bindPopup(popupContent)
        .addTo(map);
    }
  }

  /* ---------- Fahrzeuge nach Pixel-Naehe gruppieren (Single-Linkage) ----------
     Verkettet alle Fahrzeuge, die naeher als clusterRadius beieinander liegen,
     zu EINER Gruppe. Dadurch entstehen keine sich ueberlappenden Icons und auch
     keine zwei Gruppen, die sich gegenseitig ueberdecken. */
  function clusterByProximity(items, radiusPx) {
    const pts = items.map(v => ({ v, p: map.latLngToContainerPoint([v.lat, v.lng]) }));
    const used = new Array(pts.length).fill(false);
    const clusters = [];
    for (let i = 0; i < pts.length; i++) {
      if (used[i]) continue;
      const group = [pts[i].v];
      used[i] = true;
      const queue = [i];
      while (queue.length) {
        const a = queue.pop();
        for (let j = 0; j < pts.length; j++) {
          if (used[j]) continue;
          const dx = pts[a].p.x - pts[j].p.x;
          const dy = pts[a].p.y - pts[j].p.y;
          if (Math.hypot(dx, dy) < radiusPx) { used[j] = true; group.push(pts[j].v); queue.push(j); }
        }
      }
      clusters.push(group);
    }
    return clusters;
  }

  /* ---------- Alle Marker zeichnen ---------- */
  function renderAllVehicleMarkers(shouldFitBounds = true) {
    if (!window.FMS_DATA || !Array.isArray(window.FMS_DATA.fahrzeuge) || !map) return;

    clearLines();

    // aktive Fahrzeuge mit Position sammeln (gespeicherte Position vor statischer)
    const active = [];
    const hb = MAP_CONFIG.hideAtBase;
    window.FMS_DATA.fahrzeuge.forEach(veh => {
      const savedPos = getSavedPosition(veh.name);
      const lat = savedPos ? parseFloat(savedPos.lat) : parseFloat(veh.lat);
      const lng = savedPos ? parseFloat(savedPos.lng) : parseFloat(veh.lng);
      if (!lat || !lng) return;

      // An der Unterkunft parkende Fahrzeuge ausblenden (Status + Radius)
      if (hb && hb.enabled) {
        const st = getSavedStatus(veh.name, veh.status);
        if (Number(st) === Number(hb.status) &&
            distanceMeters(lat, lng, hb.lat, hb.lng) <= hb.radiusM) {
          return; // nicht anzeigen
        }
      }

      active.push({ name: veh.name, lat: lat, lng: lng });
    });

    const usedKeys = new Set();
    const bounds = [];

    if (active.length) {
      const clusters = clusterByProximity(active, MAP_CONFIG.clusterRadius);

      clusters.forEach(cluster => {
        if (cluster.length === 1) {
          // Einzelnes Fahrzeug -> normales Icon
          const v = cluster[0];
          const key = "veh_" + v.name;
          usedKeys.add(key);
          drawOrUpdateMarker(key, v.name, [v.lat, v.lng]);
          bounds.push([v.lat, v.lng]);
        } else {
          // Mehrere am selben Ort -> EINE kompakte Liste (keine Ueberlagerung)
          const clat = cluster.reduce((s, v) => s + v.lat, 0) / cluster.length;
          const clng = cluster.reduce((s, v) => s + v.lng, 0) / cluster.length;
          const key = "cluster_" + cluster.map(v => v.name).sort().join("|");
          usedKeys.add(key);

          const dot = L.circleMarker([clat, clng], {
            radius: 6, color: '#d9363e', fillColor: '#ffffff', fillOpacity: 1, weight: 3
          }).addTo(map);
          lines.push(dot);

          const icon = createCompactClusterIcon(cluster);
          if (markers[key]) { markers[key].setLatLng([clat, clng]); markers[key].setIcon(icon); }
          else { markers[key] = L.marker([clat, clng], { icon: icon }).addTo(map); }
          bounds.push([clat, clng]);
        }
      });
    }

    // Veraltete Marker entfernen -> verhindert Geister-Icons beim Neuzeichnen
    Object.keys(markers).forEach(k => {
      if (!usedKeys.has(k)) { map.removeLayer(markers[k]); delete markers[k]; }
    });

    if (shouldFitBounds && bounds.length > 0) {
      // Signatur der aktuellen Positionen; nur bei Aenderung neu zentrieren.
      const sig = bounds.map(b => b[0].toFixed(4) + "," + b[1].toFixed(4)).sort().join("|");
      if (sig !== lastFitSig) {
        lastFitSig = sig;
        map.fitBounds(bounds, {
          paddingTopLeft: MAP_CONFIG.padTopLeft,
          paddingBottomRight: MAP_CONFIG.padBottomRight,
          maxZoom: MAP_CONFIG.maxZoomOnBounds,
          animate: false
        });
      }
    }
  }

  /* ---------- Globale Schnittstelle ---------- */
  window.MapModule = {
    init: initMap,
    // Embed (FMS_MAP_AUTOFIT=true) zentriert bei Updates weiter auf alle Einheiten;
    // normale Karte fittet nicht neu -> frei zoom-/scrollbar.
    update: function() { renderAllVehicleMarkers(!!window.FMS_MAP_AUTOFIT); },
    updateVehiclePosition: function(vehicleName, lat, lng) {
      renderAllVehicleMarkers(!!window.FMS_MAP_AUTOFIT);
    },
    // Basis-Koordinate/Radius/Status live setzen (zum Testen in der Konsole):
    //   MapModule.setHideBase(51.1723, 7.1996, 25, 2)
    setHideBase: function(lat, lng, radiusM, status) {
      MAP_CONFIG.hideAtBase.lat = lat;
      MAP_CONFIG.hideAtBase.lng = lng;
      if (radiusM !== undefined) MAP_CONFIG.hideAtBase.radiusM = radiusM;
      if (status !== undefined) MAP_CONFIG.hideAtBase.status = status;
      MAP_CONFIG.hideAtBase.enabled = true;
      lastFitSig = null;
      renderAllVehicleMarkers(!!window.FMS_MAP_AUTOFIT);
      console.log("[Map] Basis gesetzt:", MAP_CONFIG.hideAtBase);
    }
  };

  /* Auto-Start & Intervall-Polling (aktualisiert die Ansicht regelmaessig) */
  document.addEventListener("DOMContentLoaded", () => {
    initMap();
    setInterval(() => {
      // nur die Embed-Karte zentriert regelmaessig neu auf alle Einheiten
      renderAllVehicleMarkers(!!window.FMS_MAP_AUTOFIT);
    }, MAP_CONFIG.pollInterval);
  });

})();