#!/usr/bin/env bash
#
# Setzt den GEMINI_API_KEY in der .env auf der Bookstore-VM und startet den
# Stack neu. Der Key wird verdeckt eingelesen und per stdin uebertragen, er
# steht damit weder in der Shell-History noch in der Prozessliste (`ps`), wo
# Kommando-Argumente fuer alle Nutzer sichtbar waeren.
#
# Aufruf:  ./scripts/set-gemini-key.sh
# Loeschen: ./scripts/set-gemini-key.sh --clear    (zurueck auf lokalen Tier)
#
# Key anlegen: https://aistudio.google.com/app/apikey

set -euo pipefail

VM_NAME="${VM_NAME:-bookstore}"
VM_ZONE="${VM_ZONE:-europe-west3-a}"
VM_USER="${VM_USER:-quocnamtran}"
VM_HOST="${VM_HOST:-bookstore.quocnamtran.com}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/gce_bookstore_ed25519}"
APP_DIR="${APP_DIR:-bookstore}"

die() { printf '\nFehler: %s\n' "$1" >&2; exit 1; }

[ -f "$SSH_KEY" ] || die "SSH-Key nicht gefunden: $SSH_KEY
Alternativ per gcloud verbinden:
  gcloud compute ssh $VM_NAME --zone=$VM_ZONE"

ssh_vm() {
  ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 \
      "$VM_USER@$VM_HOST" "$@"
}

# ── Key einlesen ────────────────────────────────────────────────────────────
if [ "${1:-}" = "--clear" ]; then
  KEY=""
  echo "Entferne den Gemini-Key (der lokale Embedding-Tier uebernimmt)."
else
  printf 'Gemini-API-Key (Eingabe bleibt unsichtbar): '
  IFS= read -rs KEY || true
  printf '\n'

  [ -n "$KEY" ] || die "Kein Key eingegeben. Abbruch, .env bleibt unveraendert."

  # Google-AI-Studio-Keys beginnen mit AIza und sind ~39 Zeichen lang.
  case "$KEY" in
    AIza*) : ;;
    *) printf 'Warnung: der Key beginnt nicht mit "AIza". Trotzdem setzen? [j/N] '
       read -r ans
       case "$ans" in j|J|y|Y) : ;; *) die "Abgebrochen." ;; esac ;;
  esac
  printf 'Key erkannt: %s… (%d Zeichen)\n' "${KEY:0:6}" "${#KEY}"
fi

# ── Auf der VM eintragen ────────────────────────────────────────────────────
# Der Key kommt ueber stdin, nicht als Argument. Auf der VM liest ihn ein
# kurzes Skript aus der ersten Zeile und schreibt die .env neu.
echo "Schreibe .env auf $VM_HOST …"
printf '%s\n' "$KEY" | ssh_vm "APP_DIR='$APP_DIR' bash -s" <<'REMOTE'
set -euo pipefail
IFS= read -r key || key=""
cd "$HOME/$APP_DIR" || { echo "Verzeichnis $HOME/$APP_DIR fehlt" >&2; exit 1; }
[ -f .env ] || { echo ".env fehlt" >&2; exit 1; }

cp .env .env.bak
# Zeile ersetzen, falls vorhanden, sonst anhaengen. Der Key wird ueber die
# Umgebung an awk gereicht, damit er nicht in der Kommandozeile auftaucht.
if grep -q '^GEMINI_API_KEY=' .env; then
  KEY="$key" awk '/^GEMINI_API_KEY=/{print "GEMINI_API_KEY=" ENVIRON["KEY"]; next} {print}' .env > .env.new
else
  cp .env .env.new
  KEY="$key" awk 'BEGIN{}{print}END{print "GEMINI_API_KEY=" ENVIRON["KEY"]}' .env > .env.new
fi
mv .env.new .env
chmod 600 .env

if [ -n "$key" ]; then
  echo "  gesetzt: GEMINI_API_KEY (${#key} Zeichen)"
else
  echo "  geleert: GEMINI_API_KEY"
fi

echo "Starte den Stack neu …"
sudo docker compose -f compose.prod.yml up -d >/dev/null 2>&1
sleep 8
sudo docker compose -f compose.prod.yml ps --format 'table {{.Service}}\t{{.Status}}'
REMOTE

unset KEY

# ── Verifizieren ────────────────────────────────────────────────────────────
echo
echo "Pruefe den Empfehler …"
for i in 1 2 3 4 5 6; do
  body=$(curl -s --max-time 90 -X POST "https://$VM_HOST/api/recommend" \
          -H 'Content-Type: application/json' \
          -d '{"query":"etwas Vertraeumtes fuer einen Regentag","locale":"de"}' || true)
  src=$(printf '%s' "$body" | sed -n 's/.*"source":"\([a-z]*\)".*/\1/p')
  if [ -n "$src" ]; then
    printf 'Antwort-Quelle: %s\n' "$src"
    case "$src" in
      gemini|ai|llm) echo "Tier 1 laeuft, der Key greift." ;;
      semantic)      echo "Tier 2 (lokales Modell). Bei gesetztem Key: Logs pruefen mit
  gcloud compute ssh $VM_NAME --zone=$VM_ZONE --command='cd $APP_DIR && sudo docker compose -f compose.prod.yml logs --tail=30 app'" ;;
      keyword)       echo "Tier 3 (Stichwort). Weder Gemini noch das lokale Modell antworten." ;;
    esac
    exit 0
  fi
  sleep 10
done

die "Keine verwertbare Antwort von /api/recommend. Logs pruefen:
  gcloud compute ssh $VM_NAME --zone=$VM_ZONE --command='cd $APP_DIR && sudo docker compose -f compose.prod.yml logs --tail=40 app'"
