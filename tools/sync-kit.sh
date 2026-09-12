#!/bin/sh
# Re-vendor kit modules from ../obsidian-kit. Run after kit updates.
#
# Vorlage: koda-agent/tools/sync-kit.sh (uebernommen 2026-08-20). Drei Dinge, die es
# dort nicht gibt und die hier zwingend sind:
#   1. pure/think-splitter.ts liegt hier als think.ts — historischer Name, an dem die
#      Aufrufstellen haengen. Ohne den Sonderfall entsteht eine zweite, tote Datei.
#   2. endpoint-list.ts und model-picker.ts importieren kit-intern aus ../pure/ und
#      muessen aufs hiesige Vendor-Layout umgeschrieben werden — siehe relayer().
#   3. Der Pin geht auf den TAG, nicht auf HEAD (siehe SHA= unten).
set -e

KIT="${KIT_DIR:-../obsidian-kit}"
# Zweite Quelle seit obsidian-kit 2ab1bb5 ("domaenenfreie pure-Teilmenge zieht nach code-kit"):
# ALLE neun hier vendorten pure-Module plus think-splitter liegen dort, nicht mehr unter
# obsidian-kit/src/pure/. Bis 2026-09-03 kopierte dieses Skript weiter von der alten Stelle
# und starb am ersten Modul — mit einem Schaden, der groesser ist als der Abbruch: `set -e`
# beendet den Lauf, also lief die gekoppelte Schicht nicht mehr mit und VENDOR.json wurde
# gar nicht erst geschrieben. Die eine Datei, in der man den Vendor-Stand nachschlaegt,
# behauptet danach den alten — leise.
#
# Bewusst NICHT genommen: obsidian-kit traegt unter src/vendor/code-kit/ eigene Kopien.
# Eine Zwischenkopie als Quelle erzeugt eine Kopier-Kette, und die sieht bei der naechsten
# Zaehlung wie ein unabhaengiger Beleg aus (Dach-AGENTS, Kit-first Punkt 1).
CODE_KIT="${CODE_KIT_DIR:-../../code-kit}"
[ -d "$CODE_KIT/src/ts" ] || { echo "code-kit nicht gefunden unter $CODE_KIT (CODE_KIT_DIR setzen)" >&2; exit 1; }
[ -d "$KIT/src/pure" ] || { echo "sync-kit: Kit nicht gefunden unter $KIT (KIT_DIR setzen)" >&2; exit 1; }

# Die Version kommt aus dem PIN, nicht aus der package.json des Arbeitsstands
# (CORE-META-22, umgestellt 2026-09-07). Der Kopf dieses Skripts hatte die zweite
# Haelfte der Regel bereits sauber verstanden — die ^{commit}-Peelung ist unten
# ausfuehrlich begruendet —, aber `VER` las den Arbeitsstand des Nachbar-Repos.
# Gemessen am 2026-09-07: VENDOR.json pinnt 0.27.0, das Kit-Arbeitsverzeichnis
# stand auf 0.31.0. Ein Routinelauf waere also vier Minor-Versionen gesprungen,
# ohne dass jemand einen Sprung beauftragt haette — und der Stempel haette ihn
# korrekt gepeelt beglaubigt.
KIT_REF=${KIT_REF:-0.27.0}
CODE_KIT_REF=${CODE_KIT_REF:-0.5.0}

for paar in "$KIT|$KIT_REF" "$CODE_KIT|$CODE_KIT_REF"; do
  repo=${paar%%|*}; ref=${paar##*|}
  git -C "$repo" rev-parse --verify --quiet "$ref^{commit}" >/dev/null \
    || { echo "sync-kit: Ref '$ref' existiert nicht in $repo (KIT_REF/CODE_KIT_REF setzen)" >&2; exit 1; }
done

VER=$(git -C "$KIT" describe --tags --abbrev=0 "$KIT_REF")
CODE_VER=$(git -C "$CODE_KIT" describe --tags --abbrev=0 "$CODE_KIT_REF")

# Ein pures Modul kann in drei Schichten liegen. Statt fester Zuordnung wird gesucht — die
# naechste Umschichtung soll dieses Skript nicht wieder toeten, sondern nur einen anderen
# Fundort ergeben. Ausgabe: <pfad>|<quelle>|<quell-relativer-pfad>|<version>
quelle_fuer() {
  for kandidat in \
    "$KIT|obsidian-kit|src/pure/$1.ts|$VER|$KIT_REF" \
    "$CODE_KIT|code-kit|src/ts/pure/$1.ts|$CODE_VER|$CODE_KIT_REF" \
    "$CODE_KIT|code-kit|src/ts/web/$1.ts|$CODE_VER|$CODE_KIT_REF"; do
    k_repo=$(printf '%s' "$kandidat" | cut -d'|' -f1)
    k_pfad=$(printf '%s' "$kandidat" | cut -d'|' -f3)
    k_ref=$(printf '%s' "$kandidat" | cut -d'|' -f5)
    if git -C "$k_repo" cat-file -e "$k_ref:$k_pfad" 2>/dev/null; then
      printf '%s\n' "$kandidat"; return 0
    fi
  done
  return 1
}

# vendor_aus_ref <ziel> <repo> <ref> <quell-pfad>
# Schreibt ERST nach .tmp: `git show ... > ziel` legt die Datei an, BEVOR git show
# laeuft — fehlt die Quelle, bleibt ein Stummel liegen, der wie ein Vendoring aussieht.
vendor_aus_ref() {
  git -C "$2" show "$3:$4" > "$1.tmp" || {
    rm -f "$1.tmp"
    echo "sync-kit: $4 fehlt in $2@$3 — nichts geschrieben." >&2
    exit 1
  }
  mv "$1.tmp" "$1"
}
# Pin auf den TAG, nicht auf HEAD: das Kit bekommt nach einem Release weitere Commits
# (README u. ae.), ein HEAD-Pin zeigt dann auf einen Stand, den es als Release nicht gibt.
# `^{commit}` ist NICHT optional: ../tools/release/release.mjs taggt annotiert
# (`git tag -a`, release.mjs:117), und `rev-parse --short <annotierter Tag>` liefert die SHA
# des TAG-OBJEKTS, nicht die des Commits. Im Kit sind 0.1.0/0.2.0/0.12.0/0.13.0 bereits
# annotiert (Gegenprobe 0.13.0: Tag-Objekt 137732f vs. Commit 80abae9) — 0.27.0 ist nur
# zufaellig leichtgewichtig. Ohne die Peelung schriebe der naechste Kit-Sprung eine SHA in
# VENDOR.json, die in `git log` des Kits gar nicht vorkommt. Praezedenz: obsidian-paperize.
SHA=$(git -C "$KIT" rev-parse --short "$KIT_REF^{commit}")

stamp() { # stamp <vendored-file> <quell-relativer-pfad> [<quelle> <version>]
  quelle=${3:-obsidian-kit}
  version=${4:-$VER}
  header="// vendored from $quelle@$version, $2 — do not hand-edit; re-vendor via tools/sync-kit.sh"
  printf '%s\n' "$header" | cat - "$1" > "$1.tmp"
  mv "$1.tmp" "$1"
}

# Kit-interne Querimporte aufs Vendor-Layout umschreiben. Im Kit liegen die Schichten als
# src/obsidian + src/pure nebeneinander, hier als src/vendor/kit-obsidian + src/vendor/kit —
# `../pure/` zeigt hier also ins Leere. Das ist die EINZIGE zulaessige Abweichung von verbatim;
# bei jedem Re-Vendor reproduzieren, sonst darf nichts abweichen.
# Praezedenz: kuro-gamification, markdown-presentation, vault-crews, vim-dojo (seit 0.26.0) —
# neun Importzeilen, in allen vier byte-identisch.
relayer() { # relayer <vendored-file>
  f=$1

  # (0) VORBEDINGUNG: der Umschrieb setzt die Zwei-Ordner-Form der Kit-README voraus. Ohne
  #     sie zeigt `../kit/` von src/vendor/kit/ aus auf DIE DATEI SELBST — und weil
  #     obsidian/clipboard.ts und pure/clipboard.ts denselben Basenamen tragen, faellt das
  #     erst im Typecheck auf (TS2305). Laut abbrechen statt still falsch vendorieren.
  case "$f" in
    src/vendor/kit-obsidian/*) ;;
    *) echo "sync-kit: $f liegt nicht in src/vendor/kit-obsidian/ — der Querimport-Umschrieb setzt die Zwei-Ordner-Form voraus (obsidian-kit/README.md)" >&2; exit 1 ;;
  esac
  [ -d src/vendor/kit ] || { echo "sync-kit: src/vendor/kit/ fehlt — pure-Schicht anlegen, bevor gekoppelte Module mit Querimport vendoriert werden" >&2; exit 1; }

  # (1) Umschreiben, und feststellen OB umgeschrieben wurde. `cmp` statt md5: portabel,
  #     macOS (md5) und GitHub-CI (md5sum) heissen verschieden. Das Muster ankert am
  #     Anfuehrungszeichen, nicht an `from "` — das Kit schreibt auch einfache.
  # ZWEI Muster, seit obsidian-kit 2ab1bb5: die gekoppelte Schicht importierte frueher
  # `../pure/x`, seit dem code-kit-Umzug importiert sie `../vendor/code-kit/{pure,web}/x`.
  # Wer nur das alte kennt, laesst den neuen Import stehen — er zeigt ins Leere. Hier
  # gemessen 2026-09-03: endpoint-list.ts riss den Typecheck mit acht TS2307 auf einmal.
  sed -e 's|\(["'"'"']\)\.\./pure/|\1../kit/|g' \
      -e 's|\(["'"'"']\)\.\./vendor/code-kit/pure/|\1../kit/|g' \
      -e 's|\(["'"'"']\)\.\./vendor/code-kit/web/|\1../kit/|g' "$f" > "$f.tmp"
  if cmp -s "$f" "$f.tmp"; then rm -f "$f.tmp"; return 0; fi   # nichts zu tun, KEINE Notiz
  mv "$f.tmp" "$f"

  # (2) Gegenprobe: bleibt ein ../pure/ stehen, bricht der Build spaeter und woanders.
  if grep -qE '\.\./(pure|vendor/code-kit)/' "$f"; then
    echo "sync-kit: '../pure/' in $f nicht umgeschrieben — Muster pruefen" >&2; exit 1
  fi

  # (3) Mitvendorier-Gegenprobe: jedes umgeschriebene Ziel muss auch wirklich da sein.
  for dep in $(sed -n 's|.*from ["'"'"']\.\./kit/\([A-Za-z0-9_/-]*\)["'"'"'].*|\1|p' "$f" | sort -u); do
    [ -f "src/vendor/kit/$dep.ts" ] || {
      echo "sync-kit: $f importiert ../kit/$dep, aber src/vendor/kit/$dep.ts fehlt — mitvendorieren" >&2; exit 1
    }
  done

  note="// ONE mechanical deviation from verbatim: kit-internal imports ../pure/ → ../kit/ (vendor layout); reproduce on every re-vendor, nothing else may differ."
  printf '%s\n' "$note" | cat - "$f" > "$f.tmp"
  mv "$f.tmp" "$f"
}

mkdir -p src/vendor/kit src/vendor/kit-obsidian

PURE_MODULE="sse endpoint endpoint_diagnostics reasoning model-context endpoint_config model-choice model-list-cache timeout"

# Erst ALLE Quellen aufloesen (think-splitter mit, s. Ausnahme unten), dann kopieren: ein
# fehlendes Modul ist ein Aufbaufehler und wird als solcher gemeldet, statt den Lauf auf
# halber Strecke abzubrechen.
for m in $PURE_MODULE think-splitter; do
  quelle_fuer "$m" >/dev/null || {
    echo "FEHLER: $m.ts liegt weder in $KIT/src/pure/ noch in $CODE_KIT/src/ts/{pure,web}/." >&2
    echo "  Seit obsidian-kit 2ab1bb5 ist code-kit die Quelle der domaenenfreien Module." >&2
    exit 2
  }
done

for m in $PURE_MODULE; do
  fund=$(quelle_fuer "$m")
  q_repo=$(printf '%s' "$fund" | cut -d'|' -f1)
  quelle=$(printf '%s' "$fund" | cut -d'|' -f2)
  rel=$(printf '%s' "$fund" | cut -d'|' -f3)
  ver=$(printf '%s' "$fund" | cut -d'|' -f4)
  q_ref=$(printf '%s' "$fund" | cut -d'|' -f5)
  vendor_aus_ref "src/vendor/kit/$m.ts" "$q_repo" "$q_ref" "$rel"
  stamp "src/vendor/kit/$m.ts" "$rel" "$quelle" "$ver"
  echo "vendored $quelle@$ver/$rel"
done

# Ausnahme 1 (s. Kopf): think-splitter.ts -> think.ts.
ts_fund=$(quelle_fuer think-splitter)
ts_repo=$(printf '%s' "$ts_fund" | cut -d'|' -f1)
ts_quelle=$(printf '%s' "$ts_fund" | cut -d'|' -f2)
ts_rel=$(printf '%s' "$ts_fund" | cut -d'|' -f3)
ts_ver=$(printf '%s' "$ts_fund" | cut -d'|' -f4)
ts_ref=$(printf '%s' "$ts_fund" | cut -d'|' -f5)
vendor_aus_ref src/vendor/kit/think.ts "$ts_repo" "$ts_ref" "$ts_rel"
stamp src/vendor/kit/think.ts "$ts_rel" "$ts_quelle" "$ts_ver"
echo "vendored $ts_quelle@$ts_ver/$ts_rel -> think.ts"

for m in clock collapsible endpoint-list model-picker folder-suggest settings_walker; do
  vendor_aus_ref "src/vendor/kit-obsidian/$m.ts" "$KIT" "$KIT_REF" "src/obsidian/$m.ts"
  relayer "src/vendor/kit-obsidian/$m.ts"   # Ausnahme 2 (s. Kopf) — no-op fuer clock/collapsible/folder-suggest/settings_walker
  stamp "src/vendor/kit-obsidian/$m.ts" "src/obsidian/$m.ts"
  echo "vendored obsidian-kit@$VER/obsidian/$m.ts"
done

cat > src/vendor/kit/VENDOR.json <<JSON
{
  "source": "obsidian-kit",
  "version": "$VER",
  "sha": "$SHA",
  "code_kit_version": "$CODE_VER",
  "vendored": "pure/sse.ts, pure/think-splitter.ts (als think.ts), pure/endpoint.ts, pure/endpoint_diagnostics.ts, pure/reasoning.ts, pure/model-context.ts, pure/endpoint_config.ts, pure/model-choice.ts, pure/model-list-cache.ts, pure/timeout.ts",
  "note": "Verbatim snapshot. Never hand-edit. Re-vendor via tools/sync-kit.sh. obsidian/clock.ts + obsidian/collapsible.ts + obsidian/endpoint-list.ts + obsidian/model-picker.ts liegen in ../kit-obsidian/, siehe dortige VENDOR.json."
}
JSON
cat > src/vendor/kit-obsidian/VENDOR.json <<JSON
{
  "source": "obsidian-kit",
  "version": "$VER",
  "sha": "$SHA",
  "vendored": "obsidian/clock.ts, obsidian/collapsible.ts, obsidian/endpoint-list.ts, obsidian/model-picker.ts, obsidian/folder-suggest.ts, obsidian/settings_walker.ts",
  "note": "Verbatim snapshot. Never hand-edit. Re-vendor via tools/sync-kit.sh. collapsible.ts has no consumer in src/, checked by test/vendorKit.test.ts only. endpoint-list.ts and model-picker.ts carry ONE mechanical deviation from verbatim: kit-internal imports of ../pure/* are rewritten to ../kit/* to match this repo's vendor layout (obsidian-kit's src/obsidian + src/pure become kit-obsidian + kit here). Reproduce that rewrite on every re-vendor; nothing else may differ. Same fix precedented in markdown-presentation's VENDOR.json at the same sha. folder-suggest.ts and settings_walker.ts have no ../pure/ imports, so relayer() is a no-op for both (same as clock/collapsible) — settings_walker.ts imports ./folder-suggest, both must stay vendored together."
}
JSON
echo "VENDOR.json → $VER ($SHA)"
