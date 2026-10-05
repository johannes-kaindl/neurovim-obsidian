# Aufnahme-Vertrag — README-Bilder

Was jedes Bild zeigen **muss**, damit es seine Zeile in der README trägt. Der Vertrag ist
die Vorgabe, nicht das Protokoll: weicht eine Aufnahme ab, wird die Aufnahme korrigiert —
oder der Vertrag, mit Begründung.

Erzeugt von `npm run shots`, geprüft von `npm run shots:check`
(zentraler Standard: `_docs/readme/readme-spec.json`, Block `images`).

## Bilder

| Datei | Klasse | referenziert von | muss zeigen |
|---|---|---|---|
| `hero.png` | hero | README, README.de | Das Kernversprechen in einem Bild: eine **Missionsnotiz im Editor**, daneben das Mission-HUD mit Missionskennung, laufender Zeit, Tastenzähler und Zeilenfortschritt `x/y`. **Der Vim-Modus muss aktiv sein** — ein Hero, dessen Statuszeile „Vim mode off" meldet, wirbt gegen das eigene Versprechen (so entstand die erste Aufnahme am 2026-08-16, Ursache: `vimMode` fehlte in der Fixture). Der Zustand ist der **Missionsstart**; ein bereits fortgeschrittener Lauf bräuchte echte Tastenanschläge, sonst widersprechen sich Tastenzähler und Zeilenfortschritt im Bild. |
| `missions.png` | feature | README, README.de | Der MISSIONS-Tab mit gemischtem Zustand: mindestens eine erledigte Mission (`✓`), eine offene mit XP-Wert, eine **gesperrte**. Nur so ist die Progression im Bild statt in der Prosa. |
| `archive.png` | feature | README, README.de | Der ARCHIVE-Tab mit dem LOOT-Gruppenkopf samt Zähler (`1/9`) und **mindestens einem offenen neben einem gesperrten** Artefakt (🔒 + `LVL n`). ⚠️ Der zweite Gruppenkopf (`FRAGMENTS — INTERCEPTS`) passt **nicht** mit ins Bild: LOOT hat neun Einträge, das Panel müsste dafür höher sein als das Fenster. Ursprünglich verlangte diese Zeile beide Köpfe — geändert am 2026-08-16, nachdem die Aufnahme zeigte, dass die Forderung nicht erfüllbar ist, ohne die Karten zu verstecken, um die es geht. |
| `reader.png` | feature | README, README.de | Ein geöffnetes Artefakt im Reader: gerendertes Markdown, der ASCII-Kopf als **geschlossener Rahmen**. Der Reader muss denselben Grund tragen wie der Hub dahinter — ein Bild, auf dem er dem Theme statt dem CRT-Schema folgt, ist als Beleg wertlos. |
| `briefing.png` | feature | README, README.de | Das Briefing-Modal vor dem Missionsstart: CIPHERs Ansprache **vollständig lesbar**, der Knopf `▶ BEGIN MISSION` sichtbar. Aufgenommen an **M-01**, nicht an M-05: dessen Briefing trägt einen langen Log-Auszug, der das Modal über die Fensterhöhe schiebt (2026-08-16 gemessen). Dass der DIRECTIVE-Block unten angeschnitten ist, ist in Ordnung — das Modal scrollt, und der Charakter des Spiels steckt in der CIPHER-Passage. |
| `guide.png` | feature | README, README.de | Der GUIDE-Tab mit **aktiver Suche**: ein Suchbegriff im Feld und die gefilterte Trefferliste. Ein ungefiltertes Cheatsheet zeigt nicht, dass es durchsuchbar ist. |
| `settings.png` | feature | README, README.de | Der Einstellungen-Tab ab dem Abschnitt **Appearance**: HUD-Platzierung, CRT-Farbschema, darunter der Abschnitt CIPHER uplink mit einem aktiven Endpunkt samt Modell. Der Tab ist länger als jeder Bildschirm (949 px gemessen), deshalb zeigt das Bild nicht auch den Missionsordner. Ab Obsidian 1.13 sind die Einstellungen ein **eigenes Fenster ohne Workspace** (in der Zweitinstanz ein Pop-out); der Treiber verbindet sich dafür ein zweites Mal (`attachTo("settings", …)`). |
| `uplink.png` | feature | README, README.de | Der UPLINK-Tab mit einem CIPHER-Wortwechsel — Frage des Spielers, Antwort in der Rolle. Der Treiber startet dafür einen **Fake-Endpunkt** (`node:http`, Port 8766, feste generische Antwort): die Oberfläche ist echt, nur die Worte sind festgelegt. |
| `hero-demo.gif` | hero-video | README, README.de | Die Hero-Sequenz an Mission M-08 als Bewegtbild: Zuschnitt Editor plus HUD-Box, Theme Birds of Yore, HUD-Schema `crt`, Schrift 20 px. Beginnt im Einfügemodus am Anfang der Zeile `Once upon a ██████████ dreary, …` (Pre-Roll `i` vor der Aufnahme), dann `ESC` · `3w` · `ciw` · `midnight` · `ESC`; am Ende liest die Zeile `Once upon a midnight dreary, …`, der Zeilenfortschritt im HUD tickt von 32/45 auf 33/45. 20 fps (der GIF-Takt ist 10 ms, 24 würde zu 25), 800 px, Palette je Datei; `hero-demo.mp4` daneben mit demselben Inhalt (D13). Quelle ist `out/sequenz/m08-hero/` (Einzelbilder, `eingaben.jsonl`, `sequenz.json`), nicht im Repo. |

## Sequenzen

Eine Sequenz ist eine Bedienung in **einem** Start: Eingaben in festem Takt, je Anschlag ein Bild, dazu das Eingabe-Log im Vertrag von media-kit (`tools/obsidian-cdp/README.md` § Sequenz). Rezept: `scripts/sequenz.ts` (`npm run sequenz`). Die Einzelbilder liegen **nie** unter `docs/images/` (der Check `shots-contract-sync` verlangt dort je `.png` eine Vertragszeile), sondern unter `out/sequenz/<name>/` (gitignored, Übergabe an Kompositionen); nur GIF und MP4 der Hero-Sequenz wandern nach `docs/images/`.

Zustand für beide Sequenzen: Zweitinstanz mit Theme Birds of Yore (aus `fixture/make-theme.mjs`, Tag `birds-of-yore-0.3.0`) und `baseFontSize` 20, Spielstand 140 XP mit M-01 bis M-07 erledigt und M-08 frei (Level 2 ab 66 XP), HUD-Schema `crt`, HUD-Platzierung `box`, Fenster 1280×860, Zuschnitt `.cm-editor` plus `.nv-float-hud-container` bei Dichte 2. Das Log (`eingaben.jsonl`) hält die echten Zeitpunkte; `geraeusch taste` bekommt `--anschlag` aus `sequenz.json` → `anschlag.gemessen`. Jede Sequenz ist nur grün, wenn der Editortext am Ende dem Soll entspricht.

| Name | Schritte | Übergabe | muss zeigen |
|---|---|---|---|
| `m08-hero` | `ESC` · `3w` · `ciw` · `midnight` · `ESC` | `out/sequenz/m08-hero/` (16 Bilder, 5 Logzeilen, ≈ 7 s) | Die Reparatur eines Wortes mit echten Vim-Tasten, HUD zählt Tasten und Zeilen; Quelle für `hero-demo.gif`/`.mp4` und den Reparatur-Beat des Trailers. |
| `m08-voll` | wie `m08-hero`, dann alle weiteren Korruptionen des NEVERMORE-Profils (`c3w`, `ciw`, `S`, `8s`, `dd`), zuletzt `SUBMIT` über den Plugin-Befehl | `out/sequenz/m08-voll/` (222 Bilder, 50 Logzeilen, ≈ 59 s) | Alle neun Korruptionen repariert (zwei █-Läufe, vier REDACTED, SURVEILLANCE/MONITORING, EVERMORE, die entfernte Zeile, zwei Compliance-Banner), danach das Result-Modal „MISSION COMPLETE +35 XP“. Für den Trailer, nicht in der README. |

Zwei gemessene Fallen (2026-10-05): `SUBMIT` liest die Notiz von der Platte, Obsidian speichert erst nach rund 2 s Ruhe, deshalb ruft das Rezept vor dem Befehl `view.save()`; und M-08 hatte im Content bis zu diesem Tag keine Lösung, das Plugin konnte die Mission nicht starten (behoben im Monorepo, `solutions/M-08-SOLUTION-Corrupted_Transmission.md`).

## Anzeigebreite: nie über die aufgenommene Größe

**Ein Bild wird höchstens so groß dargestellt, wie es aufgenommen wurde (Maßstab 1:1) —
außer es gibt einen Grund zu zoomen.** Die Klassenbreite aus `readme-spec.json` ist eine
Obergrenze, keine Vorgabe.

Der Fallstrick sitzt im Zusammenspiel mit Retina: der Treiber nimmt mit `deviceScaleFactor 2`
auf, und `scaleTo` verkleinert **nur, was breiter als `capture_width` (1200) ist**. Ein
schmaler Ausschnitt bleibt deshalb unskaliert und trägt doppelte Pixel:

| Aufnahme | Bilddatei | echte CSS-Breite | zulässige Anzeigebreite |
|---|---|---|---|
| Sidebar-Panel (420 px breit) | 824 px | 412 | **412** — nicht 820 |
| Modal | 1168 px | 584 | **584** |
| ganzes Fenster (1280 px) | 1200 px (herunterskaliert) | 1280 | 820 (Klassenbreite) |

Faustregel: **ist die Datei schmaler als 1200 px, ist sie eine unskalierte Retina-Aufnahme —
dann Anzeigebreite = Dateibreite ÷ 2.** Ist sie genau 1200 px breit, wurde sie skaliert und
die Klassenbreite gilt.

Am 2026-08-16 waren fünf von sechs Bildern mit `width="820"` eingebettet und damit bis zu
**doppelt so groß** dargestellt wie aufgenommen — von Johannes im gerenderten README gesehen,
nicht vom Lint: der prüft Klassen und Budgets, nicht den Maßstab.

## UI-Strings (verbatim aus `src/`)

Zum Gegenlesen der Bilder — geändert sich einer, ist entweder das Bild veraltet oder der
Vertrag.

- Tabs (`src/HubView.tsx`): `NEXUS` · `MISSIONS` · `ARCHIVE` · `GUIDE` · `UPLINK`
  (UPLINK erscheint nur bei konfiguriertem Endpunkt)
- Archiv-Gruppen (`src/lore/loreIndex.ts`): `LOOT — Recovered Files` ·
  `FRAGMENTS — Intercepts`
- Gesperrtes Artefakt (`src/HubView.tsx`): `🔒 <Titel>` · `LVL <n>` ·
  `Locked — reach level <n> to recover.`
- HUD-Knöpfe (`src/MissionHud.tsx`): `SUBMIT` · `HINT` · `ABORT`
- Pausen-Banner (`src/main.ts`): `RETURN` · `ABORT`
- Reader (`src/lore/LoreModal.ts`): Titelzeile `>_ <ID> — <Titel>`, Knopf `← ARCHIVE`

## Beispieldaten

Der Aufnahme-Vault ist **nicht** der Arbeits-Vault des Maintainers. Er wird aus
`fixture/` erzeugt und enthält nur generische, englische Inhalte — keine echten Namen,
keine privaten Notizen. Der Datei-Explorer ist in jedem Bild mit im Rahmen, deshalb ist
das keine Kosmetik.

Der **Spielstand** (XP, freigeschaltete Missionen, Bestwerte) wird vom Treiber vor der
Aufnahme gesetzt und ist Teil des Rezepts, nicht Zufall: `missions.png` und `archive.png`
brauchen einen Mittelstand, sonst ist entweder alles gesperrt oder alles offen und das
Bild zeigt die Progression nicht.

## Reproduktion

### Sequenz (Zweitinstanz, eigener Port, Lock je Port)

```bash
npm run sequenz -- --setup                      # Vault aus fixture/ bauen, Theme und Schrift 20 px setzen
UD=/tmp/obs-test-neurovim-obsidian; pgrep -f "user-data-dir=$UD" && echo "Profil belegt"; mkdir -p "$UD"
cp ~/Library/Application\ Support/obsidian/obsidian-<version>.asar "$UD"/      # sonst startet die gebündelte Version
# $UD/obsidian.json mit {"vaults":{"nvseq":{"path":"$STAGING_VAULTS_DIR/neurovim-obsidian","ts":<ms>,"open":true}}}
python3 ~/.claude/hooks/obsidian-cdp-lock.py acquire --label neurovim-obsidian --intent "Sequenz M-08" --ttl 900 --exclusive focus --port 9360
/Applications/Obsidian.app/Contents/MacOS/Obsidian --user-data-dir="$UD" --remote-debugging-port=9360 &
npm run sequenz -- --vault neurovim-obsidian --port 9360 --sequenz m08-hero      # schreibt hero-demo.gif/.mp4
npm run sequenz -- --port 9360 --beenden        # eigene Instanz beenden; je Aufnahme ein frischer Prozess
npm run sequenz -- --vault neurovim-obsidian --port 9360 --sequenz m08-voll --ohne-video
npm run sequenz -- --sequenz m08-hero --nur-video   # GIF/MP4 neu aus out/sequenz/m08-hero, ohne Obsidian
python3 ~/.claude/hooks/obsidian-cdp-lock.py release
```

Vor dem ersten Lauf bestätigt `prepareInstance` den Vertrauensdialog des frischen Profils und hebt den eingeschränkten Modus auf. Eine Aufnahme verlangt einen sauberen Arbeitsbaum (`git status --porcelain` leer), sonst beschreibt der Commit in `sequenz.json` → `herkunft` nicht den Stand, der sie erzeugt hat; `--herkunft-unsauber` erlaubt das nur für Messläufe und schreibt die abweichenden Dateien in die Herkunft. `--nur-video` schreibt ausschließlich `hero-demo.gif`/`.mp4` aus `out/sequenz/m08-hero/`. Ein Messlauf: `--modus schritt|screencast --out out/messung-<x> --ohne-video`; die Messzeile steht nach `✅` in der Ausgabe und in `sequenz.json` → `messung`.

### Bilder (reguläre Instanz oder Zweitinstanz)

⚠️ **Vor dem Quit koordinieren — Obsidian ist geteilte Infrastruktur.** Dieses Rezept
braucht den frischen Start (ein Bild pro Start, jeder Lauf hinterlässt Zustand); Mitnutzen ist
hier keine Alternative. Aber Obsidian ist Single-Instance: der Quit trifft die Instanz, an der
möglicherweise eine andere Session arbeitet, und zerstört deren Zustand. Der eigene Lauf ist
danach sauber grün; der Schaden fällt nicht auf.

```bash
lsof -nP -iTCP:9222 -sTCP:LISTEN >/dev/null && echo "belegt — erst fragen, wem"
```

Hört der Port, hängt jemand dran: **erst fragen, dann quitten.** ⚠️ Und die Prüfung ersetzt die
Frage nicht — sie zeigt aktive CDP-Treiber, aber nicht, wer ein Fenster offen hält oder auf den
Port wartet; am 2026-08-30 hätte sie einen zwei Stunden alten Reindex nicht gezeigt, denn der
hing an Ollama, nicht am Port.

```bash
export STAGING_VAULTS_DIR="$STAGING_VAULTS"   # Sammelordner der Aufnahme-Vaults

npm run shots -- --setup          # Vault aus fixture/ bauen; danach Obsidian NEU STARTEN
osascript -e 'quit app "Obsidian"'
open -a Obsidian --args --remote-debugging-port=9222

npm run shots -- --vault neurovim-obsidian             # alle Bilder
npm run shots -- --vault neurovim-obsidian --only hero # ein einzelnes
npm run shots:check                            # gegen den Standard prüfen
```

Der Vault entsteht unter `$STAGING_VAULTS_DIR/neurovim-obsidian` — die Variable ist Pflicht, ein
fest eingebauter Pfad wäre für jeden außer einer Person falsch. `check-no-abs-paths`
(Teil von `npm test`) verbietet ihn auch in dieser Datei; der konkrete Ort steht deshalb
im maintainer-lokalen Cockpit, nicht hier.

`--setup` löscht `workspace.json` und die Plugin-`data.json` im Aufnahme-Vault: ein
früherer Lauf soll nicht in die nächsten Bilder durchschlagen.

## Offene Lücken

Keine für Bilder (`settings.png` und `uplink.png` seit 2026-10-03, `hero-demo.gif` seit 2026-10-05). Die Sequenz `m08-voll` ist Übergabe, kein README-Bild; ihr Trailer-Einsatz hängt an Johannes' Storyboard (`clipwerk/projects/neurovim-trailer`).
