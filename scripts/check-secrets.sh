#!/usr/bin/env bash
# Pre-commit gate: blokkeert commits met secrets of met bestanden die nooit
# in Git horen. Faalt luid; bij twijfel blokkeert hij liever ten onrechte.
set -uo pipefail

staged=$(git diff --cached --name-only --diff-filter=ACM)
[ -z "$staged" ] && exit 0

fail=0
note() { echo "  ✗ $1"; fail=1; }

# 1. Bestanden die categorisch niet gecommit mogen worden
while IFS= read -r f; do
  case "$f" in
    .env|.env.*|*/.env|*/.env.*)
      [ "${f##*/}" = ".env.example" ] || note "$f — .env hoort niet in Git" ;;
    *.pem|*.key|*credentials*.json|*client_secret*.json|*service-account*.json)
      note "$f — credentialbestand" ;;
    data/*.db|data/*.db-wal|data/*.db-shm)
      note "$f — database met versleutelde tokens" ;;
  esac
done <<< "$staged"

# 2. Patronen in de inhoud van staged wijzigingen
#    Alleen toegevoegde regels; .example-bestanden overslaan.
for f in $staged; do
  case "$f" in *.example|*.md|scripts/check-secrets.sh) continue ;; esac
  [ -f "$f" ] || continue
  added=$(git diff --cached -U0 -- "$f" | grep '^+' | grep -v '^+++' || true)
  [ -z "$added" ] && continue

  echo "$added" | grep -qE '\bGOCSPX-[A-Za-z0-9_-]{20,}' && note "$f — Google OAuth client secret"
  echo "$added" | grep -qE '\bya29\.[A-Za-z0-9_-]{20,}'  && note "$f — Google access token"
  echo "$added" | grep -qE '\b1//[A-Za-z0-9_-]{30,}'     && note "$f — Google refresh token"
  echo "$added" | grep -qE '\bAIza[A-Za-z0-9_-]{35}'     && note "$f — Google API key"
  echo "$added" | grep -qE '\bsk-[A-Za-z0-9]{32,}'       && note "$f — API-sleutel (sk-)"
  echo "$added" | grep -qE '\bEA[A-Za-z0-9]{80,}'        && note "$f — Meta access token"
  # Toegewezen secrets met een echte waarde (niet de placeholders uit .env.example)
  echo "$added" | grep -qiE '(client_secret|api_key|apikey|password|passwd|private_key|encryption_key|developer_token)[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9/_+=-]{16,}' \
    && ! echo "$added" | grep -qiE '(your-|replace-with|example|placeholder|xxx|<.*>)' \
    && note "$f — lijkt een ingevulde secret te bevatten"
done

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "Commit geblokkeerd door scripts/check-secrets.sh"
  echo "Bewust toch committen: git commit --no-verify"
  exit 1
fi
exit 0
