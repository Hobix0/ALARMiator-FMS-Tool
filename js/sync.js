/* ==========================================================================
   Geteilter Positions-/Status-Sync ueber eine eigene Firebase Realtime DB.
   Warum: GitHub Pages ist statisch und kann selbst nichts speichern. Diese
   Schicht schreibt/liest einen gemeinsamen Ablageort, damit ALLE Geraete die
   Positionen und Status sehen - nicht nur das eigene.

   Einbindung (siehe README): Firebase-SDK + diese Datei laden, in js/config.js
   FMS.SYNC.firebaseConfig ausfuellen. Ohne Konfiguration bleibt alles lokal.

   Datenmodell in der DB:  fms/<ovKey>/vehicles/<key> = {name,issi,status,lat,lng,ts}
   Gespiegelt nach:        localStorage FMS_VEHICLE_POSITIONS / FMS_VEHICLE_STATUSES
   ========================================================================== */
window.FMS = window.FMS || {};
(function(){
  "use strict";

  const Sync = { ready:false, db:null, ref:null };

  function cfgOk(){
    return FMS.SYNC && FMS.SYNC.firebaseConfig && FMS.SYNC.firebaseConfig.databaseURL;
  }
  function ovKey(){ return (FMS.SYNC && FMS.SYNC.ovKey) ? FMS.SYNC.ovKey : "default"; }
  function pathBase(){ return "fms/" + ovKey() + "/vehicles"; }
  // Firebase-Keys duerfen . # $ / [ ] und Leerzeichen nicht enthalten
  function keyFor(name){ return String(name).replace(/[.#$/\[\]\s]+/g, "_"); }

  /* Eingehende DB-Daten in die localStorage-Keys spiegeln, die Karte/Uebersicht lesen */
  function applyToLocal(val){
    let pos = {}, st = {};
    try{ pos = JSON.parse(localStorage.getItem("FMS_VEHICLE_POSITIONS")) || {}; }catch(e){}
    try{ st  = JSON.parse(localStorage.getItem("FMS_VEHICLE_STATUSES"))  || {}; }catch(e){}

    Object.keys(val || {}).forEach(k => {
      const v = val[k];
      if(!v || !v.name) return;
      if(v.lat != null && v.lng != null){
        pos[v.name] = { lat: v.lat, lng: v.lng, timestamp: v.ts || null };
      }
      if(v.status != null && v.status !== ""){
        st[v.name] = v.status;
      }
    });

    try{ localStorage.setItem("FMS_VEHICLE_POSITIONS", JSON.stringify(pos)); }catch(e){}
    try{ localStorage.setItem("FMS_VEHICLE_STATUSES",  JSON.stringify(st));  }catch(e){}
  }

  function subscribe(onUpdate){
    Sync.ref = Sync.db.ref(pathBase());
    Sync.ref.on("value", snap => {
      const val = snap.val() || {};
      applyToLocal(val);
      if(typeof onUpdate === "function") onUpdate(val);
      // Datenobjekt der Karte aktualisieren (Status ins FMS_DATA uebernehmen)
      if(window.FMS_DATA && Array.isArray(window.FMS_DATA.fahrzeuge)){
        Object.keys(val).forEach(k => {
          const v = val[k];
          const veh = v && window.FMS_DATA.fahrzeuge.find(f => f.name === v.name);
          if(veh && v.status != null && v.status !== "") veh.status = v.status;
        });
      }
      if(window.MapModule && typeof window.MapModule.update === "function") window.MapModule.update();
    });
    Sync.ready = true;
    console.info("[Sync] verbunden:", pathBase());
  }

  Sync.init = function(onUpdate){
    if(!cfgOk()){ console.warn("[Sync] Firebase nicht konfiguriert - laeuft nur lokal."); return; }
    if(typeof firebase === "undefined"){ console.warn("[Sync] Firebase-SDK nicht geladen."); return; }
    try{
      if(!firebase.apps || !firebase.apps.length) firebase.initializeApp(FMS.SYNC.firebaseConfig);
      Sync.db = firebase.database();

      // Optional: anonyme Anmeldung (falls DB-Regeln auth != null verlangen)
      if(FMS.SYNC.anonAuth && firebase.auth){
        firebase.auth().signInAnonymously()
          .then(() => subscribe(onUpdate))
          .catch(err => { console.warn("[Sync] anonyme Anmeldung fehlgeschlagen:", err); subscribe(onUpdate); });
      } else {
        subscribe(onUpdate);
      }
    }catch(e){ console.error("[Sync] init:", e); }
  };

  /* Eigene Aenderung veroeffentlichen (merge: nur gesetzte Felder werden ueberschrieben) */
  Sync.publish = function(name, dataObj){
    if(!Sync.ready || !Sync.ref || !name) return;
    const payload = { name: name, ts: Date.now() };
    if(dataObj){
      if(dataObj.issi   != null) payload.issi   = dataObj.issi;
      if(dataObj.status != null) payload.status = dataObj.status;
      if(dataObj.lat    != null) payload.lat    = dataObj.lat;
      if(dataObj.lng    != null) payload.lng    = dataObj.lng;
    }
    Sync.ref.child(keyFor(name)).update(payload).catch(e => console.warn("[Sync] publish:", e));
  };

  FMS.Sync = Sync;

  // Auto-Start auf jeder Seite, die diese Datei laedt
  document.addEventListener("DOMContentLoaded", () => Sync.init());
})();
