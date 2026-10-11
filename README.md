# Sigma Progress — App (PWA)

**Schritt 2 von 3: die funktionierende App.**

Hier steht kein Design-Prototyp mehr, sondern eine lauffähige, installierbare
PWA: fünf Bereiche, ein Trainingstagebuch, Essens-Tracking im Yazio-Stil, ein
Coach-Chat und ein
Onboarding, das aus den Angaben des Nutzers echte Daten erzeugt.

Dazu kommt die Verwaltung: **Anmelden mit Rolle** (Kunde, Coach, Admin), ein
Warteschritt vor der Freigabe und ein Admin-Bereich, der Anfragen annimmt,
ablehnt oder verschiebt und Konten freischaltet.

Alle Daten liegen **lokal auf dem Gerät** (`localStorage`) — Trainingsstand
genauso wie Konten, Sitzungen und Anfragen. Es gibt kein Backend und kein
Netzwerk; die beiden Grenzen dafür sind `core/repo.js` (Trainingsstand) und
`core/auth.js` (Zugang). Die Antworten im Chat stammen aus einer Regel Engine,
nicht von einem Modell.

```
pwa/
├── index.html              App-Rumpf, Icon-Sprite, Boot-Markup
├── manifest.webmanifest    Name, Theme-Farbe, Icons, Shortcuts
├── sw.js                   Service Worker: Offline + Update-Hinweis
├── css/
│   ├── app.css             einziger Einstieg, Import-Reihenfolge ist bindend
│   ├── tokens.css          Farben, Typo, Radien, Schatten, Bewegung
│   ├── base.css            Reset, Grundtypo, Hintergrund, Bildschirmgerüst
│   ├── components.css      Bausteine (Karten, Buttons, Dock, Diagramme …)
│   ├── forms.css           Eingaben, Auswahlkacheln, Regler
│   ├── overlay.css         Dialog und Meldung
│   ├── screens.css         Kompositionen
│   └── views.css           Bildschirme der App
├── js/
│   ├── main.js             Rumpf, Bildschirmwechsel, Dock, SW-Anmeldung
│   ├── core/               dom · format · overlay · repo · router · stats · auth
│   ├── components/         ui · charts · forms
│   ├── data/               seed · coach · foods · photos
│   └── screens/            login · freischaltung · onboarding · dashboard
│                           tracken · chat · fortschritt · profil · admin
├── icons/                  SVG-Quellen + PNG-Ausgabe (192/512, maskable)
└── scripts/
    ├── check.cjs           statische Prüfungen (siehe unten)
    └── build-icons.mjs     SVG → PNG
```

## Starten

Die App hat **keinen Build-Schritt**. Vanilla-ES-Module, ein Service Worker,
eine Stylesheet-Datei.

```bash
cd pwa
npx http-server -p 4174 -c-1 .
# → http://localhost:4174
```

Ein beliebiger statischer Server tut es. `file://` **nicht** — ES-Module und
der Service Worker brauchen einen Ursprung.

Beim ersten Aufruf steht man vor der Tür: die Anmeldung. Die drei Startkonten
stehen weiter unten. Wer noch keines hat, meldet sich über „Zugang anfragen"
an — das legt eine Anfrage an, keinen Zugang.

### Nach einer Änderung

```bash
# 1. Prüfen (Syntax, Importe, Bezeichner, h()-Aufrufe)
node scripts/check.cjs

# 2. CACHE_VERSION in sw.js hochzählen
#    sonst liefert der Browser die alte Datei aus dem Cache
```

Das ist die einzige Stolperfalle des Ansatzes und in `sw.js` auch so
vermerkt. Nach dem Hochzählen **zweimal** neu laden: beim ersten Mal installiert
der Worker die neue Version, beim zweiten Mal wird sie ausgeliefert.

---

## Zugang, Rollen, Freigabe

### Drei Rollen

| Rolle | Sieht | Was sie tun kann |
|---|---|---|
| **Kunde** | die fünf Bereiche | Trainingstagebuch, Essen, Gewicht, Termine |
| **Coach** | Verwaltung, reduziert | die eigenen Kunden (Übersicht, Kunden) |
| **Admin** | die ganze Verwaltung | Anfragen, alle Kunden, Coaches, Abo |

Die Verwaltung liegt unter `#/admin/<abschnitt>` und ist für Kunden gar nicht
erreichbar, für Coaches auf ihre Abschnitte beschränkt — die Wache sitzt in
`main.js` (`startRoute` und die Render-Guard), nicht in der Adresszeile.

Es gibt **keinen Demo-Knopf und kein Zurücksetzen per E-Mail**. Wer keine
Zugangsdaten hat, kommt nicht weiter; die Startkonten stehen hier:

| Rolle | E-Mail | Passwort |
|---|---|---|
| Admin | `admin@sigma-progress.de` | `SigmaAdmin26` |
| Coach | `coach@sigma-progress.de` | `SigmaCoach26` |
| Kunde | `kunde@sigma-progress.de` | `SigmaKunde26` |

### Wie ein Kunde entsteht

```
Anfrage (Website-Formular oder „Zugang anfragen" in der App)
        │  → landet beim Admin, Status „offen"
        ▼
Admin: annehmen · verschieben · ablehnen
        │  „annehmen" legt das Konto mit Startpasswort an
        │  (Kunde: Status „wartend", Probestunde terminiert)
        ▼
Probestunde
        ▼
Admin: „Freischalten"  →  Status „freigegeben", Abo aktiv, Probe erledigt
        │  (dem Kunden ist im selben Bereich ein Coach zugeordnet)
        ▼
Kunde sieht die Warteseite (#/freischaltung) bis dahin und danach die App
```

Zwei Wege führen zur Anfrage: die **externe Website** (kommt als
`source: "website"` here) und die **Registrierung in der App**
(`source: "app"`). Beide landen in derselben Liste. Die Registrierung setzt
voraus, dass die AGB und die Datenschutzerklärung bestätigt werden — sonst
entsteht kein Konto.

Ein Konto, dessen Zugang entzogen wurde (`gesperrt`), behält seinen Stand und
kommt auf dieselbe Warteseite mit anderem Text.

### Abrechnung

Ein Tarif: **100 € im Monat**, monatlich kündbar, alles inklusive (App,
wöchentliches Video-Check-in, Chat). Er wird beim Freischalten aktiv, beim
Sperren pausiert. Der Wert liegt in `PRICE_EUR` in `core/auth.js`.

### Wo der Zugang liegt

`core/auth.js` ist — analog zu `core/repo.js` — die **einzige** Datei, die
Konten, Sitzungen und Anfragen anfasst: die Begriffe `sigma.progress.accounts`
/ `.requests` / `.session` kommen sonst nirgends vor. Passwörter liegen als
SHA-256 mit Salz (`crypto.subtle`), nie im Klartext. Wer später echte
Authentifizierung einhängen will, ersetzt dort `signIn` / `signUp` /
`acceptRequest` / `freeAccount` und fasst sonst nichts an.

Der Trainingsstand ist pro Konto getrennt (`sigma.progress.state.<adresse>`);
`repo.useOwner(scope)` legt den Bereich fest, `auth.sessionScope()` sagt, wer
angemeldet ist. Der Zustand einer Änderung wirkt ohne erneutes Anmelden: Rolle
und Status werden bei jedem Zeichnen aus dem Konto gelesen.

---

## Wie der Code geschnitten ist

### Eine Quelle der Wahrheit pro Sache

Der wichtigste Zuschnitt. Vier Regeln, die das Zusammenspiel der Bildschirme
in Ordnung halten:

| Frage | Datei | Sonst |
|---|---|---|
| Wo liegen die Daten? | `core/repo.js` | — |
| Wo liegen Zugang und Sitzung? | `core/auth.js` | — |
| Welche Zahl gilt? | `core/stats.js` | — |
| Wie sieht ein Baustein aus? | `components/ui.js` | — |

`core/repo.js` ist die **einzige** Datei, die den Trainingsstand im
`localStorage` anfasst. Wer später ein echtes Backend einhängen will,
ersetzt dort `getState` / `update` / `reset` durch Aufrufe und fasst sonst
nichts an. `core/auth.js` ist dieselbe Grenze für Konto, Sitzung und
Anfrage.

`core/stats.js` hält alle abgeleiteten Zahlen: Gewichtsverlauf, Serien,
BMI, Wochenziele, Trainingsumfang, Wasser, Schritte, Ernährung, Aufgaben des
Tages. Dashboard, Fortschritt und Profil rufen dieselben Funktionen auf — sie
können sich deshalb nicht widersprechen.

### Bildschirme rendern, nichts speichern

Ein Bildschirm ist eine Funktion `render(ctx, route) -> Knoten`. Er bekommt
`ctx` mit `getState`, `update`, `refresh`, `go`, `navigate`. Zustand, der nur
während des Bildschirms gilt — ein laufendes Training, ein offener Dialog —
liegt als Modul-Local im jeweiligen Screen, nicht in den Daten.

Zwei Konsequenzen, die den Code ruhig machen:

- **Eingaben schreiben in einen Entwurf, nicht in den Store.** Getippt wird
  über `oninput` in ein lokales Objekt; gespeichert erst beim Bestätigen. Sonst
  würde jeder Tastendruck einen Neulauf auslösen und den Cursor verrücken.
- **Ein Bildschirmwechsel baut den Screen neu auf.** Kein-diff, kein
  Patch-Verfahren. Bei sieben Bildschirmen ist das schneller und lesbarer als
  jede Stateful-Differenzierung — und Fehler zeigen sich sofort.

Zeitstempel und Tagesdaten laufen ausschließlich über `core/format.js`
(`dayKey`, `parseDay`, `addDays`, `weekStart`). `toISOString().slice(0, 10)` ist
verboten: das liefert in Mitteleuropa am Morgen den Vortag.

### Daten statt Platzhalter

`data/seed.js` erzeugt die Demodaten **aus dem Profil**, das im Onboarding
entstanden ist. Ziel, Zeit und Trainingshäufigkeit bestimmen Tagesziele,
Trainingsumfang und Mahlzeiten; aus dem aktuellen Gewicht wird eine plausible
Startkurve gerechnet.

Jeder Zufall kommt aus einem benannten Strom (`streamFor(name)`) mit
deterministischem Startwert. Gleiche Eingabe, gleiche Daten — sonst wäre die
App bei jedem Neuladen anders und man könnte einen Fehler nicht wiederfinden.

---

## Die fünf Bereiche

| # | Bereich | Route | Inhalt |
|---|---------|-------|--------|
| 1 | **Dashboard** | `#/dashboard` | Begrüssung, Tageszahlen (Gewicht, Kalorien, Schritte, Training), heutiger Tagebucheintrag mit „Training eintragen", Wochenziel, Gewichtsverlauf, Tagesimpuls, Coach-Kurzfassung, offene Aufgaben |
| 2 | **Tracken** | `#/tracken` | Gewicht eintragen · **Trainingstagebuch** (Art, Datum, Dauer, Intensität, „mit Trainer", Notiz; das Training findet vor Ort statt) · **Ernährung** im Yazio-Stil (Tagesbilanz mit Rest-Kalorien und Makros, Wasser-Tracker, Mahlzeiten mit Lebensmittelsuche, Portionen und Favoriten; alternativ nur Kalorien eintippen) · Fortschrittsfotos |
| 3 | **Chat** | `#/chat` | Verlauf mit dem Coach, Themenleiste, Schnellantworten, Eingabezeile, „Coach tippt" |
| 4 | **Fortschritt** | `#/fortschritt` | Gewichtsverlauf 30 T / 90 T / 1 J, Trainingsumfang je Woche, Einheiten und Minuten, Verteilung der Trainingsarten, Fotos, Meilensteine |
| 5 | **Profil** | `#/profil` | Kennzahlen, Stammdaten (bearbeitbar), Coaching mit Check-in und Aufgaben, Einstellungen, Datenschutz, Daten sichern / zurücksetzen |

Das Training ist ein **Tagebuch**: die Einheit passiert vor Ort mit dem Trainer,
nicht in der App. Deshalb gibt es keinen geführten Ablauf und keine
Satzprotokolle mehr — eingetragen wird danach, was gemacht wurde. Pro Tag ist
ein Eintrag vorgesehen; die Historie zeigt die letzten Einheiten und lässt sich
bearbeiten.

Der Kurs `#/onboarding` läuft in vier Schritten und erzeugt aus den Angaben
das Demomaterial — aber nur, wer bereits freigeschaltet ist, kommt dorthin.

Zwei Türen stehen davor und sind bewusst eigene Routen:

- `#/login` — keine Anmeldung: die Tür, mit Anmelden und „Zugang anfragen".
- `#/freischaltung` — Konto vorhanden, aber nicht freigegeben: die Warteseite.
  Sie deckt die drei Fälle „wartend", „abgelehnt" und „gesperrt" ab und hat
  einen „Status prüfen"-Knopf, der nachsehen lässt, ob der Admin inzwischen
  freigeschaltet hat.

Die Verwaltung (`#/admin/<abschnitt>`) ist eine Vollbild-Route ohne Dock:
Übersicht, Anfragen, Kunden, Coaches und Abo. Siehe „Zugang, Rollen, Freigabe".

### Was wirklich rechnet

| Aktion | Wirkung |
|---|---|
| Gewicht eintragen | erscheint sofort in Dashboard, Fortschritt (Kurve, Serie, Ziel-Prozent) und Profil |
| Training eintragen | Einheit landet mit Art/Datum/Dauer/Intensität und „Mit Trainer"-Kennzeichnung in der Historie, Wochenstatistik und Verteilung |
| Mahlzeit mit Lebensmitteln | Lebensmittel gesucht und gewählt, Portion in Gramm gesetzt, Summe (kcal + Makros) rechnet die App und füllt die Tagesbalken |
| Wasser antippen | ein Glas (250 ml) mehr oder weniger, Tagesanzeige und Balken ziehen sofort nach |
| Check-in absenden | Status wechselt auf erledigt, der Coach antwortet im Chat, die Aufgabe verschwindet vom Dashboard |
| Chatnachricht | wird gespeichert, das Thema erkannt, geantwortet |
| Einstellung ändern | überlebt den Neustart |
| Anfrage annehmen | legt das Konto an (Rolle, Startpasswort, Probetermin) — der Kunde sieht danach die Warteseite |
| Konto freischalten | hebt die Freigabe auf, Abo läuft an, „Status prüfen" schickt den Kunden in die App |
| „Alle Daten zurücksetzen" | zurück zum Onboarding |

Die Historie behauptet nichts, was nicht passiert ist: nur eingetragene
Einheiten und Mahlzeiten zählen.

---

## Gestaltung

Anthrazit als Grund, abgestufte Grautöne für die Karten, Grün ausschliesslich
als Akzent, Weiss für Text und Zahlen. Der ausführliche Aufbau — Tokens,
gemessene Kontraste, Typografie, Radien, Bewegung — steht in
[`../design-prototype/README.md`](../design-prototype/README.md); die Regeln
sind unverändert übernommen.

Zwei Punkte, die sich beim Bauen als wichtig erwiesen haben:

- **Der Button-Hover wird dunkler, nicht heller** (`--green-600` →
  `--green-700`). Ein Aufhellen fällt unter die AA-Grenze; die Leuchtwirkung
  kommt stattdessen von einem grünen Glow und einer hellen 1px-Kante oben.
- **Tiefe entsteht über Flächenhelligkeit**, nicht über Schlagschatten. Jede
  Karte ist einen Tick heller als der Grund.

`tokens.css` enthält zusätzlich einen experimentalen hellen Blocksatz
(`.theme-light` auf `<html>`) mit `--glass-*`-Tokens, damit Topbar, Dock, Sheet
und Composer mitziehen. Er ist nicht im Menü zugänglich und nicht im
Screenshot-Stand — gewollt als Ausgangspunkt, nicht als fertiges Thema.

Icons: ein einziger Sprite am Kopf von `index.html`, **63 Symbole**. Durchgehend
24×24, 1,75px Linie, runde Enden, `currentColor`, eingebunden als
`<use href="#i-…">`. Die Gestaltung liegt im CSS, nicht im Markup —
`Icon(name)` schreibt `class="icon"` und das Symbol benennt nur noch den Pfad.
Die Wortmarke daneben ist CSS und Inline-Markup, kein Sprite-Symbol.

---

## Service Worker

Zwei Regeln, mehr nicht:

- **Navigation** → Netz zuerst, Cache als Rückfall. Eine alte Version zu zeigen,
  obwohl es eine neue gibt, ist schlimmer als kurz offline zu sein.
- **Alles andere** → Cache zuerst, Netz im Hintergrund (stale-while-revalidate).

Die PRECACHE-Liste in `sw.js` muss exakt den Dateien auf der Platte entsprechen.
Nach jeder Änderung an einer gecachten Datei `CACHE_VERSION` hochzählen.

Updates meldet die App selbst: der neue Worker ruft `skipWaiting` und
`clients.claim`, `main.js` zeigt danach einen Hinweis mit „Neu laden".

### Icons neu erzeugen

`icons/icon.svg` und `icons/maskable.svg` sind die Quellen, die PNGs sind
Ausgabe. Nur ändern, wenn die SVG stimmt:

```bash
node scripts/build-icons.mjs
```

Braucht `sharp` aus dem `node_modules` des Monorepo-Wurzelverzeichnisses.

---

## Prüfen

```bash
node scripts/check.cjs
```

Vier statische Prüfungen über `js/`:

1. **Syntax** — `node --check` lässt bei ES-Modulen Syntaxfehler durch
2. **Importe** — exportiert das Zielmodul den Namen wirklich? was wird
   importiert, aber nie benutzt?
3. **Ungebundene Bezeichner** — benutzt etwas einen Namen, den es im Modul
   nicht gibt? Das ist der Fehler, der sonst erst abstürzt, wenn ein
   Bildschirm zum ersten Mal aufgerufen wird
4. **`h()`-Tag** — `h(Icon(…))` erzeugt ein `<[object Object]>` und fällt erst
   beim Rendern auf

Kein Testlauf, kein Framework — dafür vier Dinge, die man sonst nur beim
Durchklicken findet.

Zusätzlich gemessen:

| Prüfung | Ergebnis |
|---|---|
| Lighthouse Accessibility, **mobil** und **Desktop** | **100** / **100**, 52 von 52 Audits |
| Best Practices, SEO | **100** / **100** |
| Horizontaler Überlauf | **0px** bei 320 / 360 / 390 / 414 / 768 / 1280px über alle Routen |
| Neuladen ohne Netz | vollständige App aus dem Cache, Offline-Hinweis sichtbar |
| Konsole | keine Fehler, keine Warnungen |

---

## Abgrenzung

- **Kein Backend.** Alles liegt im `localStorage` des Geräts — Trainingsstand
  genauso wie Konten, Sitzungen und Anfragen. Wer die App auf einem zweiten
  Gerät öffnet, fängt leer an und ohne Zugangsdaten.
- **Keine KI.** `data/coach.js` ist eine Regel Engine: Nachricht → Thema →
  Antwort, mit dem echten Stand des Nutzers aus `state`. `reply(text, state)`
  ist bewusst die einzige Stelle, die später ein Modell oder eine API bedienen
  würde — der Aufrufer ist gegen Fehler abgesichert, damit ein Ausfall dort
  nicht als stummer Chat endet.
- **Zahlung ist abgebildet, nicht vollzogen.** Die 100 € stehen im Modell
  (`PRICE_EUR`), ein Zahlungsdienst ist nie involviert. Das Abo wechselt mit
  Freischalten/Sperren zwischen aktiv und pausiert.
- **Der Login ist lokal.** Er prüft gegen `core/auth.js` mit gesalzenen
  SHA-256-Hashes — echte Authentifizierung hängt man dort ein; die Oberfläche
  und die Rollenlogik ändern sich nicht.
- **Fotos bleiben auf dem Gerät.** Hochgeladen wird nichts; die Bilder werden
  als Data-URL abgelegt, was den Speicher begrenzt.

Am Monorepo wurde nichts geändert. `apps/app`, `apps/web` und `packages/*` sind
unberührt; die App steht bewusst im Wurzelverzeichnis `pwa/`, damit
`npm run dev` und `npm run build` im Monorepo genauso laufen wie vorher.

---

## Nächster Arbeitsschritt: Sprachen

Die Anforderung nennt drei Sprachen — **Deutsch, Englisch, Arabisch (RTL)**.
Deutsch ist heute überall sichtbar, die anderen beiden fehlen. Aufgemessen
wurde das im Code: rund **1.500 sichtbare Strings** über alle Bildschirme,
Komponenten und Dialoge. Daraus sind zwei getrennte Pakete geworden, die nicht
im selben Zug wie diese Runde erledigt werden sollten:

1. **Strings zentralisieren.** Ein `i18n/`-Modul mit `t(key, params)` und
   Übersetzungen DE/EN/AR; Bildschirme und Komponenten geben ihre Texte dort
   ab. Danach ist der Sprachwechsel ein reiner Datenwechsel.
2. **Layout und Formate.** RTL spiegelt nicht nur Texte: Zeilen, Diagramme,
   Glyphen und Ausrichtung werden gespiegelt (`dir="rtl"` + CSS-Logik), und
   Datums-, Zahlen- und Währungsformate laufen heute über
   `Intl` mit `de-CH` — das bekommt eine Sprache.

Der Umbau ist bewusst nicht „auch noch schnell" passiert: Bei ~1.500 Strings
ist das ein eigener, sorgfältiger Arbeitsschritt mit eigenem Review, keine
Zugabe zu einer ohnehin langen Runde.