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
| `settings.png` | feature | README, README.de | Der Einstellungen-Tab, so weit er ohne Scrollen lesbar ist: Missionsordner, HUD-Platzierung, Farbschema. **Offene Lücke (2026-08-16):** ab Obsidian 1.13 sind die Einstellungen ein **eigenes Fenster ohne Workspace**; der Treiber ist mit dem Workspace-Fenster verbunden und findet den Tab dort nicht. Lösung wäre eine zweite CDP-Verbindung (`attachTo("settings", …)`, in der Brücke vorhanden) — nicht gebaut, weil kein anderes Bild sie braucht. `shots:check` meldet die Lücke bei jedem Lauf. |
| `uplink.png` | feature | README, README.de | Der UPLINK-Tab mit einem CIPHER-Wortwechsel — Frage des Spielers, Antwort in der Rolle. **Vorbehalt:** braucht einen erreichbaren OpenAI-kompatiblen Endpunkt. Ist keiner verfügbar, bleibt diese Zeile stehen und `shots:check` meldet das Bild bei jedem Lauf als fehlend — eine sichtbare Lücke ist besser als eine stillschweigend gestrichene Zusage. |

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

```bash
export STAGING_VAULTS_DIR=/Users/Shared/60_StagingVaults

npm run shots -- --setup          # Vault aus fixture/ bauen; danach Obsidian NEU STARTEN
osascript -e 'quit app "Obsidian"'
open -a Obsidian --args --remote-debugging-port=9222

npm run shots -- --vault vim-dojo             # alle Bilder
npm run shots -- --vault vim-dojo --only hero # ein einzelnes
npm run shots:check                            # gegen den Standard prüfen
```

Der Vault entsteht unter `$STAGING_VAULTS_DIR/vim-dojo` — die Variable ist Pflicht, ein
fest eingebauter Pfad wäre für jeden außer einer Person falsch (und `check-no-abs-paths`
verbietet ihn zu Recht).

`--setup` löscht `workspace.json` und die Plugin-`data.json` im Aufnahme-Vault: ein
früherer Lauf soll nicht in die nächsten Bilder durchschlagen.

## Offene Lücken

`shots:check` meldet `settings.png` und `uplink.png` bei jedem Lauf als fehlend. Das ist
Absicht: beide sind im Vertrag zugesagt und technisch machbar, nur nicht gebaut. Eine
gemeldete Lücke bleibt sichtbar, eine gestrichene Zeile nicht.

- **`settings.png`** — braucht eine zweite CDP-Verbindung zum Einstellungsfenster.
- **`uplink.png`** — braucht einen erreichbaren OpenAI-kompatiblen Endpunkt. Der Weg ist
  bekannt (`koda-agent` bringt im Treiber einen eigenen `node:http`-Server auf Port 0 mit,
  statt von einem laufenden LLM-Server abzuhängen), aber ungebaut.
