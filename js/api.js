/* ==========================================================================
   API-Anbindung an Alarminator.
   Endpunkt (Swagger):  GET /api/gear/setState
   Query-Parameter:     issi, radioStatusShort (0-9), token
   ========================================================================== */
window.FMS = window.FMS || {};

FMS.ENDPOINT = "/api/gear/setState";

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
