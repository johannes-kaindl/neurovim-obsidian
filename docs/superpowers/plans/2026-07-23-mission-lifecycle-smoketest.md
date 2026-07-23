# Smoke-Test — Mission-Lifecycle (in Pallas)

Vorher deployen: `npm run build`, dann `main.js` + `manifest.json` + `styles.css` nach
`10_Pallas/.obsidian/plugins/neurovim/` kopieren und Obsidian neu laden.

## Pause-Lifecycle (Bug #1)

- [ ] Mission M-02 starten → Vim ist an, HUD zeigt Fortschritt (`0/21 lines`)
- [ ] Eine Zeile korrigieren → Zähler steigt live, ohne Submit
- [ ] Andere Notiz öffnen → Notice „Mission paused — Vim restored", Vim ist **aus**,
      normales Tippen funktioniert
- [ ] Statusleiste unten zeigt `▸ M-02 PAUSED mm:ss`, die Zeit steht still
- [ ] Zurück in die Missions-Notiz → Vim wieder an, Timer läuft weiter (nicht von vorn)
- [ ] In die NeuroVim-Sidebar klicken → Mission bleibt **aktiv**, pausiert nicht
- [ ] Command-Palette öffnen → Mission bleibt **aktiv**
- [ ] `Paused reminder after` auf 1 setzen, Notiz verlassen, 1 min warten → Banner erscheint
- [ ] Banner-RETURN öffnet die Notiz und setzt fort
- [ ] Banner-ABORT beendet die Mission sauber (Vim zurück, Statusleiste leer)
- [ ] `Paused reminder after` auf 0 → kein Banner mehr, Statusleiste weiterhin da
- [ ] Obsidian mit pausierter Mission beenden → Vim-Einstellung ist wiederhergestellt

## Diff-Feedback (Bug #2)

- [ ] Submit mit mehreren Fehlern → alle betroffenen Zeilen rot markiert
- [ ] Eine davon korrigieren → **nur diese** wird sofort sauber, die anderen bleiben rot
- [ ] Vor dem ersten Submit ist nichts markiert
- [ ] HINT zeigt `Has:  … ex»it«` / `Want: … ex»fil«`

## Fortschritt (Bug #3)

- [ ] `LINES x/y` zählt live mit; `y` ist die Zeilenzahl der **Lösung**
- [ ] Bei M-02 bleibt der Zähler unter `21/21`, solange die vier fehlenden Zeilen fehlen
      (belegt den Content-Defekt — siehe eigener Monorepo-Task)

## Ehrliche Metriken (Bug #4)

- [ ] Mission per Copy-Paste der Lösung ohne einen Tastendruck abschließen →
      Result zeigt `UNVERIFIED — no keystrokes recorded, not saved as a best`
- [ ] `data.json` behält den vorherigen `best_keystrokes` (nicht 0)
- [ ] `runs` wurde trotzdem erhöht, XP gutgeschrieben, Mission gilt als abgeschlossen
- [ ] Ein normal getippter Lauf zeigt kein `UNVERIFIED` und setzt Bestwerte wie gehabt
