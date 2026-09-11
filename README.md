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

Alle Fahrzeuge und Gruppen stehen in [`data/gears.js`](data/gears.js). Die Datei
wird per `<script>` geladen (setzt `window.FMS_DATA`) und funktioniert dadurch
sowohl lokal per Doppelklick (`file://`) als auch gehostet. Inhalt ist JSON, nur
mit `window.FMS_DATA =` am Anfang und `;` am Ende:

```js
window.FMS_DATA = {
  "fahrzeuge": [
    { "name": "Heros RS 21/10", "issi": "5781238" }
  ],
  "gruppen": [
    { "name": "ZTr", "fahrzeuge": ["Heros RS 21/10", "Heros RS 86/21"] }
  ]
};
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
│   └── gears.js                # Fahrzeuge (mit ISSI) + Gruppen (per script geladen)
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

## Positions-Sync (eigenes Backend via Firebase)

GitHub Pages ist rein statisch und kann selbst nichts speichern. Damit **alle**
Geraete die Positionen und Status sehen (nicht nur das eigene), gibt es eine
gemeinsame Ablage in einer **Firebase Realtime Database** (kostenloses
Kontingent, reine Client-Anbindung, Echtzeit). Ohne Konfiguration laeuft die App
unveraendert nur lokal.

### Einrichtung (einmalig)

1. Auf https://console.firebase.google.com ein kostenloses Projekt anlegen.
2. **Build → Realtime Database → Datenbank erstellen** (Region z. B. `europe-west1`).
3. **Projektuebersicht → Web-App hinzufuegen (`</>`)**; die angezeigten Werte
   (`apiKey`, `authDomain`, `databaseURL`, `projectId`, `appId`) nach
   `js/config.js` in `FMS.SYNC.firebaseConfig` eintragen. `databaseURL` ist Pflicht.
4. `FMS.SYNC.ovKey` auf allen Geraeten gleich lassen (trennt z. B. mehrere OVs).

Diese Firebase-Werte sind **keine Geheimnisse** und duerfen ins Repo – der Schutz
laeuft ueber die Datenbank-Regeln (siehe unten).

### Datenbank-Regeln

Schneller Start (offen – jeder mit der URL kann lesen/schreiben, nur fuer Tests):

```json
{ "rules": { "fms": { "$ov": { ".read": true, ".write": true } } } }
```

Empfohlen (nur angemeldete Geraete). Dazu in der Firebase-Konsole unter
**Authentication** die **anonyme Anmeldung** aktivieren und in `js/config.js`
`FMS.SYNC.anonAuth = true` setzen:

```json
{ "rules": { "fms": { "$ov": { ".read": "auth != null", ".write": "auth != null" } } } }
```

Hinweis: Auch das ist kein starker Schutz (jeder kann sich anonym anmelden). Fuer
sensible Nutzung sollte ein echtes Login/serverseitiger Schutz davor. Fuer eine
interne OV-Nutzung ist es in der Regel ausreichend.

### Ablauf

Beim Druecken eines Status wird der Status – und nach der GPS-Abfrage die Position –
an die geteilte DB gemeldet (`FMS.Sync.publish`). Alle Geraete erhalten die
Aenderung in Echtzeit; Karte und Uebersicht lesen sie automatisch (die Sync-Schicht
spiegelt sie in dieselben `localStorage`-Keys, die die Ansichten ohnehin lesen).

Datenmodell in der DB: `fms/<ovKey>/vehicles/<key> = { name, issi, status, lat, lng, ts }`.

### Alternative

Statt Firebase geht auch **Supabase** (Postgres + Realtime, ebenfalls kostenloses
Kontingent). Die Sync-Schicht in `js/sync.js` ist die einzige Stelle, die man dafuer
austauschen muesste.

## Kartenansicht einbetten (iframe)

Fuer Dashboards/Wandanzeigen gibt es `karte-embed.html` - eine schlanke, rein
lesende Kartenkopie ohne Kopfzeile und ohne PIN, die den ganzen Rahmen ausfuellt.
Einbinden per iframe:

```html
<iframe src="https://hobix0.github.io/ALARMiator-FMS-Tool/karte-embed.html"
        style="width:100%; height:600px; border:0;"
        title="Fahrzeugkarte"></iframe>
```

(GitHub Pages setzt kein `X-Frame-Options`, die Seite ist also einbettbar.)

## Zugang / PIN

Tool und Karte sind mit einer 4-stelligen PIN (`6630`) gesperrt. Wichtig zur
Einordnung: Diese PIN ist ein einfacher Kiosk-Schutz, **keine echte Sicherheit** -
sie steht im Client-Code und die Embed-Karte (`karte-embed.html`) ist bewusst
ohne PIN. Fuer echten Schutz braeuchte es eine serverseitige Anmeldung. Die PIN
laesst sich in `js/app.js` (`TARGET_PIN`) aendern.
