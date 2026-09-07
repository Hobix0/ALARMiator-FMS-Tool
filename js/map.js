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
    .compact-cluster-box {
      background: #ffffff;
      border: 2px solid #1e293b;
      border-radius: 6px;
      padding: 6px 10px;
      font-family: sans-serif;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      min-width: 140px;
    }
    .compact-cluster-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      font-weight: bold;
      padding: 2px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .compact-cluster-item:last-child {
      border-bottom: none;
    }
  `;
  document.head.appendChild(style);

  let map = null;
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
    
    // Grid-Raster Einstellungen (Abstände in Pixeln auf dem Bildschirm)
    gridSpacingX: 90,     
    gridSpacingY: 130,    // Platz für Namen unter dem Balken
    maxColumns: 3,        

    // Ab wie vielen Fahrzeugen auf eine Kompakt-Liste umgeschaltet wird
    compactThreshold: 4,

    // Auto-Polling Interval (in Millisekunden)
    pollInterval: 3000,

    // Zoom-Einstellungen
    maxZoomOnBounds: 16,  
    boundsPadding: [50, 50]
  };

  /* ---------- Farbschema für den Status-Balken ---------- */
  const STATUS_COLORS = {
    0: "#8c8c8c", // Notruf / Grau
    1: "#2db7f5", // Frei auf Funk / Hellblau
    2: "#52c41a", // Einsatzbereit Wache / Grün
    3: "#fa8c16", // Einsatz übernommen / Orange
    4: "#f5222d", // Am Einsatzort / Rot
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
          <span style="margin-right: 10px; color: #1e293b;">${veh.name}</span>
          <span style="background: ${color}; color: #fff; padding: 1px 6px; border-radius: 3px; font-size: 11px;">${currentStatus}</span>
        </div>
      `;
    });

    return L.divIcon({
      className: 'custom-vehicle-marker',
      html: `
        <div class="compact-cluster-box">
          <div style="font-size: 10px; color: #64748b; margin-bottom: 3px; text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
            ⚠️ ${clusterVehicles.length} Fahrzeuge vor Ort
          </div>
          ${itemsHtml}
        </div>
      `,
      iconSize: [160, clusterVehicles.length * 20 + 30],
      iconAnchor: [80, (clusterVehicles.length * 20 + 30) / 2]
    });
  }

  /* ---------- Einzelnen Marker (Standard) zeichnen / aktualisieren ---------- */
  function drawOrUpdateMarker(vehicleName, displayLatLng) {
    const vehData = window.FMS_DATA?.fahrzeuge?.find(f => f.name === vehicleName) || {};
    const currentStatus = getSavedStatus(vehicleName, vehData.status);

    const icon = createVehicleIcon(vehicleName, vehData.icon, currentStatus);
    const popupContent = `
      <div style="text-align: center; font-family: sans-serif;">
        <strong style="font-size: 15px;">${vehicleName}</strong><br>
        <span style="font-size: 13px; color: #444;">Status: <b style="color:${STATUS_COLORS[currentStatus] || '#000'}">${currentStatus}</b></span><br>
        <small style="font-size: 11px; color: #888;">ISSI: ${vehData.issi || '-'}</small>
      </div>
    `;

    if (markers[vehicleName]) {
      markers[vehicleName].setLatLng(displayLatLng);
      markers[vehicleName].setIcon(icon);
      markers[vehicleName].getPopup().setContent(popupContent);
    } else {
      markers[vehicleName] = L.marker(displayLatLng, { icon: icon })
        .bindPopup(popupContent)
        .addTo(map);
    }
  }

  /* ---------- Alle Marker zeichnen ---------- */
  function renderAllVehicleMarkers(shouldFitBounds = true) {
    if (!window.FMS_DATA || !Array.isArray(window.FMS_DATA.fahrzeuge) || !map) return;

    clearLines();

    const activeVehicles = [];
    window.FMS_DATA.fahrzeuge.forEach(veh => {
      // Prüfen, ob eine im LocalStorage gespeicherte Position existiert (durch Statusänderung/GPS-Setzen)
      const savedPos = getSavedPosition(veh.name);
      const lat = savedPos ? savedPos.lat : veh.lat;
      const lng = savedPos ? savedPos.lng : veh.lng;

      if (lat && lng) {
        activeVehicles.push({
          name: veh.name,
          lat: parseFloat(lat),
          lng: parseFloat(lng)
        });
      }
    });

    if (activeVehicles.length === 0) return;

    const clusters = [];
    activeVehicles.forEach(veh => {
      const vehPoint = map.latLngToContainerPoint([veh.lat, veh.lng]);
      let addedToCluster = false;

      for (const cluster of clusters) {
        const centerPoint = map.latLngToContainerPoint([cluster[0].lat, cluster[0].lng]);
        const pixelDist = Math.sqrt(
          Math.pow(vehPoint.x - centerPoint.x, 2) + 
          Math.pow(vehPoint.y - centerPoint.y, 2)
        );

        if (pixelDist < MAP_CONFIG.gridSpacingX) {
          cluster.push(veh);
          addedToCluster = true;
          break;
        }
      }

      if (!addedToCluster) {
        clusters.push([veh]);
      }
    });

    const allDisplayBounds = [];

    clusters.forEach(cluster => {
      const count = cluster.length;
      const centerLatLng = L.latLng(cluster[0].lat, cluster[0].lng);
      const centerPoint = map.latLngToContainerPoint(centerLatLng);

      if (count === 1) {
        const veh = cluster[0];
        const displayLatLng = [veh.lat, veh.lng];
        allDisplayBounds.push(displayLatLng);
        drawOrUpdateMarker(veh.name, displayLatLng);
      } 
      else if (count >= MAP_CONFIG.compactThreshold) {
        const clusterId = "compact_" + cluster.map(v => v.name).join("_");
        const icon = createCompactClusterIcon(cluster);

        const originMarker = L.circleMarker(centerLatLng, {
          radius: 6,
          color: '#d9363e',
          fillColor: '#ffffff',
          fillOpacity: 1,
          weight: 3
        }).addTo(map);
        lines.push(originMarker);

        if (markers[clusterId]) {
          markers[clusterId].setLatLng(centerLatLng);
          markers[clusterId].setIcon(icon);
        } else {
          markers[clusterId] = L.marker(centerLatLng, { icon: icon }).addTo(map);
        }
        allDisplayBounds.push(centerLatLng);
      } 
      else {
        const originMarker = L.circleMarker(centerLatLng, {
          radius: 6,
          color: '#d9363e',
          fillColor: '#ffffff',
          fillOpacity: 1,
          weight: 3
        }).addTo(map);
        lines.push(originMarker);

        const cols = Math.min(count, MAP_CONFIG.maxColumns);
        const rows = Math.ceil(count / cols);

        cluster.forEach((veh, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          const itemsInThisRow = (row === rows - 1 && count % cols !== 0) ? (count % cols) : cols;

          const xOffset = (col - (itemsInThisRow - 1) / 2) * MAP_CONFIG.gridSpacingX;
          const yOffset = (row - (rows - 1) / 2) * MAP_CONFIG.gridSpacingY;

          const targetPoint = L.point(centerPoint.x + xOffset, centerPoint.y + yOffset);
          const displayLatLng = map.containerPointToLatLng(targetPoint);

          const line = L.polyline([centerLatLng, displayLatLng], {
            color: '#1e293b',
            weight: 2,
            opacity: 0.7,
            dashArray: '4, 4'
          }).addTo(map);
          lines.push(line);

          allDisplayBounds.push(displayLatLng);
          drawOrUpdateMarker(veh.name, displayLatLng);
        });
      }
    });

    if (shouldFitBounds && allDisplayBounds.length > 0) {
      map.fitBounds(allDisplayBounds, {
        padding: MAP_CONFIG.boundsPadding,
        maxZoom: MAP_CONFIG.maxZoomOnBounds
      });
    }
  }

  /* ---------- Globale Schnittstellen ---------- */
  window.MapModule = {
    init: initMap,
    updateVehiclePosition: function(vehicleName, lat, lng) {
      renderAllVehicleMarkers(true);
    }
  };

  window.FMS_MAP = {
    init: initMap,
    update: function() {
      renderAllVehicleMarkers(true);
    }
  };

  /* Auto-Start & Intervall-Polling (Aktualisiert die Ansicht regelmäßig aus dem LocalStorage) */
  document.addEventListener("DOMContentLoaded", () => {
    initMap();
    
    setInterval(() => {
      renderAllVehicleMarkers(false); // false = Zoom nicht ständig erzwingen beim Polling
    }, MAP_CONFIG.pollInterval);
  });

})();