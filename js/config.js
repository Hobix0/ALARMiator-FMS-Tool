/* Nicht-geheime Standardwerte. Sicher zu committen.
   Token wird NICHT hier abgelegt, sondern nur im Browser (localStorage)
   ueber die Einstellungen im Tool gespeichert.
   ISSI/Fahrzeuge kommen aus data/gears.js (Auswahl im Dropdown). */
window.FMS = window.FMS || {};

/* Fester Endpunkt der Alarminator-API (aus Swagger: GET /api/gear/setState). */
FMS.ENDPOINT = "/api/gear/setState";


FMS.DEFAULT_CONFIG = {
  base:     "https://alarm.thw-remscheid.de",  // API-Basis-URL
  token:    "",                                // nur lokal, nie committen
  test:     true,                              // Testmodus: sendet nichts an den Server
  mode:     "fahrzeuge",                        // aktueller Umschalter: "fahrzeuge" | "gruppen"
  selected: ""                                 // zuletzt gewaehlter Name (Persistenz)
};

FMS.STORAGE_KEY = "fmsCfg";
