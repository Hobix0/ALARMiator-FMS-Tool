/* ==========================================================================
   API-Anbindung an Alarminator.
   Endpunkt (Swagger):  GET /api/gear/setState
   Query-Parameter:     issi, radioStatusShort (0-9), token
   ========================================================================== */
window.FMS = window.FMS || {};

FMS.ENDPOINT = "/api/gear/setState";

/* Position zentral setzen (damit ANDERE die Position sehen).
   >>> Sobald der Endpunkt aus der Swagger bekannt ist, hier eintragen, z. B.
       FMS.POSITION_ENDPOINT = "/api/gear/setPosition";
   Leer lassen = Position wird nur lokal gespeichert (nur fuer einen selbst sichtbar). */
FMS.POSITION_ENDPOINT = "";

FMS.buildRequest = function(opts){
  let baseUrl = opts.base.replace(/\/+$/, "");
  
  if (baseUrl.endsWith("/api")) {
    baseUrl = baseUrl.substring(0, baseUrl.length - 4);
  }

  const url = new URL(baseUrl + FMS.ENDPOINT);
  url.searchParams.set("issi", opts.issi);
  url.searchParams.set("radioStatusShort", opts.status);

  // Der API-Token wird in die URL als ?token= gesetzt
  const apiToken = (opts.token || "").trim();
  url.searchParams.set("token", apiToken);

  const headers = {
    "Accept": "application/json"
  };

  // Falls zusätzlich ein Basic Auth Token angegeben wurde
  const basicToken = (opts.basicToken || "").trim();
  if (basicToken) {
    headers["Authorization"] = basicToken.startsWith("Basic ") ? basicToken : "Basic " + basicToken;
  }

  return { 
    url: url.toString(), 
    options: { 
      method: "GET", 
      headers: headers
    } 
  };
};

FMS.sendOne = async function(opts){
  const issi = opts.issi;
  if(opts.test){
    await new Promise(r => setTimeout(r, 250));
    return { ok:true, test:true, issi, message:"Testmodus (nicht gesendet)." };
  }
  if(!opts.base)  return { ok:false, issi, message:"Keine API-Basis-URL." };
  if(!issi)       return { ok:false, issi, message:"Keine ISSI hinterlegt." };
  if(!opts.token && !opts.basicToken) return { ok:false, issi, message:"Kein Token gesetzt." };

  const { url, options } = FMS.buildRequest(opts);
  try{
    const res = await fetch(url, options);
    let data = null;
    try{ data = await res.json(); }catch(e){}

    if(res.ok && (!data || data.success === 1 || data.success === true)){
      return { ok:true, issi, code:res.status, message:(data && data.description) || "OK" };
    }
    const desc = data && data.description ? " - " + data.description : "";
    return { ok:false, issi, code:res.status, message:"HTTP " + res.status + desc };
  }catch(err){
    return { ok:false, issi, message:"Netzwerk-/CORS-Fehler." };
  }
};

/* ==========================================================================
   Position an den Server senden (fuer die geteilte Kartenansicht).
   Standard-Annahme: GET {POSITION_ENDPOINT}?issi=&lat=&lng=&token=
   Feldnamen/Methode ggf. an die Swagger anpassen (analog buildRequest).
   ========================================================================== */
FMS.buildPositionRequest = function(opts){
  let baseUrl = opts.base.replace(/\/+$/, "");
  if (baseUrl.endsWith("/api")) baseUrl = baseUrl.substring(0, baseUrl.length - 4);

  const url = new URL(baseUrl + FMS.POSITION_ENDPOINT);
  url.searchParams.set("issi", opts.issi);
  url.searchParams.set("lat", opts.lat);
  url.searchParams.set("lng", opts.lng);
  url.searchParams.set("token", (opts.token || "").trim());

  const headers = { "Accept": "application/json" };
  const basicToken = (opts.basicToken || "").trim();
  if (basicToken) headers["Authorization"] = basicToken.startsWith("Basic ") ? basicToken : "Basic " + basicToken;

  return { url: url.toString(), options: { method: "GET", headers } };
};

FMS.sendPosition = async function(opts){
  if(!FMS.POSITION_ENDPOINT) return { ok:false, issi:opts.issi, message:"Kein Positions-Endpunkt konfiguriert." };
  if(opts.test) return { ok:true, test:true, issi:opts.issi, message:"Testmodus (Position nicht gesendet)." };
  if(!opts.base || !opts.issi) return { ok:false, issi:opts.issi, message:"Basis/ISSI fehlt." };
  if(opts.lat == null || opts.lng == null) return { ok:false, issi:opts.issi, message:"Keine Koordinaten." };

  const { url, options } = FMS.buildPositionRequest(opts);
  try{
    const res = await fetch(url, options);
    let data = null; try{ data = await res.json(); }catch(e){}
    if(res.ok && (!data || data.success === 1 || data.success === true)){
      return { ok:true, issi:opts.issi, code:res.status, message:(data && data.description) || "OK" };
    }
    return { ok:false, issi:opts.issi, code:res.status, message:"HTTP " + res.status };
  }catch(err){
    return { ok:false, issi:opts.issi, message:"Netzwerk-/CORS-Fehler." };
  }
};
