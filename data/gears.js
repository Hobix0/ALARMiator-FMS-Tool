/* ============================================================
   Fahrzeuge und Gruppen  -  DIESE DATEI pflegen.
   Der Inhalt ist JSON. Nur  window.FMS_DATA =  am Anfang und das
   Semikolon am Ende muessen stehen bleiben.

   - Fahrzeug: ISSI in das leere "issi"-Feld eintragen.
   - Gruppe:   Fahrzeugnamen in das "fahrzeuge"-Array schreiben
               (exakt wie unter "fahrzeuge" benannt).
   Kommas zwischen den Eintraegen nicht vergessen, hinter dem
   letzten Eintrag KEIN Komma.
   ============================================================ */
window.FMS_DATA = {
  "fahrzeuge": [
    { "name": "Heros RS 21/10", "issi": "81365", "status": 2},
    { "name": "Heros RS 22/51", "issi": "85539", "status": 2 },
    { "name": "Heros RS 24/54", "issi": "90287", "status": 2 },
    { "name": "Heros RS 39/55", "issi": "91316", "status": 2 },
    { "name": "Heros RS 39/75", "issi": "84381", "status": 2 },
    { "name": "Heros RS 58/34", "issi": "90712", "status": 2 },
    { "name": "Heros RS 75/25", "issi": "99006", "status": 2 },
    { "name": "Heros RS 86/21", "issi": "99385", "status": 2 },
    { "name": "Heros RS 86/25", "issi": "91455", "status": 2 },
    { "name": "Heros RS 86/31", "issi": "83122", "status": 2 },
    { "name": "Heros RS 86/45", "issi": "8168", "status": 2 },
    { "name": "Heros RS 86/73", "issi": "97568", "status": 2 },
    { "name": "Anh EGS", "issi": "", "status": 2 },
    { "name": "Anh LiMa", "issi": "", "status": 2 },
    { "name": "Anh WB", "issi": "", "status": 2 },
    { "name": "Anh BRmG klein", "issi": "", "status": 2 },
    { "name": "Anh ERS", "issi": "", "status": 2 },
    { "name": "Anh PKW", "issi": "", "status": 2 },
    { "name": "Anh Boot", "issi": "", "status": 2 }
  ],
  "gruppen": [
    { "name": "ZTr",  "fahrzeuge": ["Heros RS 21/10"] },
    { "name": "B",    "fahrzeuge": ["Heros RS 22/51"] },
    { "name": "N",    "fahrzeuge": ["Heros RS 24/54"] },
    { "name": "SB",   "fahrzeuge": ["Heros RS 39/55","Heros RS 39/75"] },
    { "name": "BT",   "fahrzeuge": ["Heros RS 58/34"] },
    { "name": "ESS",  "fahrzeuge": ["Heros RS 75/25"] },
    { "name": "STAB", "fahrzeuge": [] }
  ]
};
