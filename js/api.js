/* ==========================================================================
   API-Anbindung an Alarminator.
   Endpunkt (Swagger):  GET /api/gear/setState
   Query-Parameter:     issi, radioStatusShort (0-9), token
   Antwort:             { "success": 1, "description": "success" }
   ========================================================================== */
window.FMS = window.FMS || {};

/* Baut die konkrete Anfrage-URL. Reine Funktion (kein Netzwerk) -> gut testbar.
   opts = { base, token, issi, status } */
FMS.buildRequest = function(opts){
  const url = new URL(opts.base.replace(/\/+$/,"") + FMS.ENDPOINT);
  url.searchParams.set("issi", opts.issi);
  url.searchParams.set("radioStatusShort", opts.status);
  url.searchParams.set("token", opts.token);
  return { url: url.toString(), options: { method:"GET", headers:{ "Accept":"application/json" } } };
};

/* Sendet EINEN Status an EINE ISSI. Gibt zurueck:
   { ok:boolean, issi, code?:number, test?:boolean, message:string } */
FMS.sendOne = async function(opts){
  const issi = opts.issi;
  if(opts.test){
    await new Promise(r => setTimeout(r, 250));
    return { ok:true, test:true, issi, message:"Testmodus (nicht gesendet)." };
  }
  if(!opts.base)  return { ok:false, issi, message:"Keine API-Basis-URL." };
  if(!issi)       return { ok:false, issi, message:"Keine ISSI hinterlegt." };
  if(!opts.token) return { ok:false, issi, message:"Kein Token gesetzt." };

  const { url, options } = FMS.buildRequest(opts);
  try{
    const res = await fetch(url, options);
    let data = null;
    try{ data = await res.json(); }catch(e){}
    if(res.ok && (!data || data.success)){
      return { ok:true, issi, code:res.status, message:(data && data.description) || "OK" };
    }
    const desc = data && data.description ? " - " + data.description : "";
    return { ok:false, issi, code:res.status, message:"HTTP " + res.status + desc };
  }catch(err){
    return { ok:false, issi, message:"Netzwerk-/CORS-Fehler." };
  }
};
