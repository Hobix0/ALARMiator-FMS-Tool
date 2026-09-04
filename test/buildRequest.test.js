/* Minimaler, abhaengigkeitsfreier Test fuer FMS.buildRequest.
   Ausfuehren:  node test/buildRequest.test.js  */
global.window = global;
require("../js/config.js");
require("../js/api.js");

let failed = 0;
function eq(actual, expected, name){
  const ok = actual === expected;
  console.log((ok ? "PASS" : "FAIL") + "  " + name);
  if(!ok){ console.log("  erwartet: " + expected); console.log("  erhalten: " + actual); failed++; }
}

const r1 = FMS.buildRequest({ base:"https://alarm.thw-remscheid.de", token:"TOKEN", issi:"5781238", status:1 });
eq(r1.options.method, "GET", "Methode ist GET");
eq(r1.url,
   "https://alarm.thw-remscheid.de/api/gear/setState?issi=5781238&radioStatusShort=1&token=TOKEN",
   "URL fuer Status 1");

const r0 = FMS.buildRequest({ base:"https://alarm.thw-remscheid.de/", token:"TOKEN", issi:"5781238", status:0 });
eq(r0.url,
   "https://alarm.thw-remscheid.de/api/gear/setState?issi=5781238&radioStatusShort=0&token=TOKEN",
   "abschliessender Slash in base wird entfernt");

console.log(failed === 0 ? "\nAlle Tests bestanden." : "\n" + failed + " Test(s) fehlgeschlagen.");
process.exit(failed === 0 ? 0 : 1);
