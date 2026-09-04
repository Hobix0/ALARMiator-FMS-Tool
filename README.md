# FMS-Bedienteil (Handy-Tool)

Ein schlankes, mobil-optimiertes FMS-Statusgeber-Tool fuer den Browser, das den
Fahrzeugstatus (FMS-Kennungen **0–9**) an eine
[Alarminator](https://alarm.thw-remscheid.de)-Instanz sendet. Reines HTML/CSS/JS,
keine Build-Kette, als PWA aufs Handy installierbar.

## Funktionen

- Tastenfeld **0–9** in klassischer FMS-Anordnung, grosse Touch-Flaechen
- Statusanzeige mit aktueller ISSI, Uhrzeit und Sende-Rueckmeldung (OK / Fehler)
- Farbcodierung nach Statustyp (einsatzbereit / Anfahrt / Sprechwunsch / Notruf)
- Einstellungen (ISSI, API-URL, Token) lokal im Geraet, **nie im Repo**
- Testmodus zum gefahrlosen Ausprobieren
- Offline-faehig via Service-Worker, installierbar via Web-App-Manifest

## FMS-Kennungen (THW)

| Status | Bedeutung |
|:---:|---|
| 1 | Einsatzbereit auf Funk |
| 2 | Einsatzbereit Unterkunft / ueber Melder * |
| 3 | Einsatzauftrag uebernommen |
| 4 | Ankunft Einsatzstelle |
| 5 | Sprechwunsch |
| 6 | Ausser Dienst / nicht einsatzklar |
| 7 | Einsatzgebunden * |
| 8 | Bedingt einsatzbereit * |
| 9 | Verstanden / Bestaetigung |
| 0 | Eigener Notruf |

\* Belegung von 2, 6, 7, 8, 9 ist je Landkreis unterschiedlich. Texte zentral in
[`js/statuses.js`](js/statuses.js) anpassen.

## API-Anbindung

Umgesetzt gegen die Alarminator-Swagger:

| | |
|---|---|
| Endpunkt | `GET /api/gear/setState` |
| Query-Parameter | `issi`, `radioStatusShort` (0–9), `token` |
| Antwort | `{ "success": 1, "description": "success" }` |
| CORS | Server sendet `Access-Control-Allow-Origin: *` → Aufruf von jeder Domain moeglich |

Beispiel:

```
GET https://alarm.thw-remscheid.de/api/gear/setState?issi=5781238&radioStatusShort=1&token=<TOKEN>
```

Die Anfrage wird ausschliesslich in
[`js/api.js`](js/api.js) → `FMS.buildRequest()` gebaut. Aendert sich die API,
ist das die einzige anzupassende Stelle (Endpunkt in [`js/config.js`](js/config.js)).

**Noch offen:** Die Bedienelemente *Freitext Notiz* und *Aktuelle Position setzen*
sind im UI vorhanden, aber noch nicht an einen Server-Endpunkt angebunden (in der
Swagger bisher nicht bekannt). Die Position wird bereits per Browser-Geolocation
erfasst; das Senden ist mit `TODO` in [`js/app.js`](js/app.js) markiert.

## Fahrzeuge & Gruppen pflegen

Alle Fahrzeuge und Gruppen stehen in [`data/gears.json`](data/gears.json). Diese
Datei wird beim Start geladen und befuellt das Dropdown. Ueber den Umschalter
oben wird zwischen **Fahrzeugen** und **Gruppen** gewechselt.

```json
{
  "fahrzeuge": [
    { "name": "Heros RS 21/10", "issi": "5781238" }
  ],
  "gruppen": [
    { "name": "ZTr", "fahrzeuge": ["Heros RS 21/10", "Heros RS 86/21"] }
  ]
}
```

- **ISSI eintragen:** bei jedem Fahrzeug das leere `issi`-Feld ausfuellen.
- **Gruppen befuellen:** in das `fahrzeuge`-Array die Fahrzeugnamen schreiben,
  die zur Gruppe gehoeren (exakt wie unter `fahrzeuge` benannt). Die ISSI wird
  automatisch aus der Fahrzeugliste aufgeloest.
- Wird eine **Gruppe** gewaehlt, sendet ein Tastendruck den Status an **alle**
  hinterlegten Fahrzeuge der Gruppe. Die Rueckmeldung zeigt `x/y gesendet`.

## Projektstruktur

```
fms-tool/
├── index.html                  # Aufbau der Seite, laedt CSS + JS
├── css/
│   └── styles.css              # gesamtes Styling (Dark-Cockpit-Theme)
├── data/
│   └── gears.json              # Fahrzeuge (mit ISSI) + Gruppen
├── js/
│   ├── config.js               # Endpunkt, Datenpfad, nicht-geheime Standardwerte
│   ├── statuses.js             # FMS-Statustabelle + Reihenfolge
│   ├── api.js                  # API-Aufruf (setState, Einzel + Gruppe)
│   └── app.js                  # UI-Logik (Umschalter, Dropdown, Tastenfeld)
├── test/
│   └── buildRequest.test.js    # abhaengigkeitsfreier Test der URL-Erzeugung
├── icons/icon.svg              # App-Icon
├── manifest.webmanifest        # PWA-Manifest
├── service-worker.js           # Offline-Cache der statischen Dateien
├── LICENSE
├── .gitignore
└── README.md
```

## Lokal starten

Wegen Service-Worker am besten ueber einen lokalen Server statt per Doppelklick
(`file://`):

```bash
python3 -m http.server 8080      # dann http://localhost:8080
# oder
npx serve
```

Test ausfuehren:

```bash
node test/buildRequest.test.js
```

## Bedienung

1. Tool oeffnen, oben rechts auf das Zahnrad.
2. **ISSI** des Fahrzeugs, **Token** eintragen, **Testmodus aus**, speichern.
3. Status 0–9 antippen. Die Anzeige zeigt gesetzten Status und Server-Rueckmeldung.

## Hosten

Dank `Access-Control-Allow-Origin: *` laeuft das Tool von jeder Domain aus, auch
lokal. Fuer den Dauerbetrieb bietet sich Hosting auf beliebigem Static-Webspace
oder GitHub Pages an (dann als PWA installierbar).

## Sicherheit

- Der Token wird **nur** lokal im Browser gehalten, nie ins Repo geschrieben
  (siehe `.gitignore`).
- Ein Token in einer reinen Client-App ist im Geraet grundsaetzlich einsehbar.
  Moeglichst gering berechtigtes Token verwenden.
- **Hinweis:** Ein gueltiger Token war im geteilten Screenshot sichtbar. Falls
  dieser Zugriff auf das Produktivsystem gibt, sollte er neu generiert werden.

## Lizenz

MIT – siehe [LICENSE](LICENSE). Copyright-Zeile bitte anpassen.
