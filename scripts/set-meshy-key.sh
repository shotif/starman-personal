#!/bin/bash
# Saves the owner's Meshy API key into this repository's git-ignored .env, after checking it with
# Meshy. The key is typed without being shown, never printed, and only ever sent to api.meshy.ai.
#
#   bash scripts/set-meshy-key.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE=".env"

if ! git check-ignore -q "$ENV_FILE"; then
  echo "Stopping: $ENV_FILE is not ignored by git, so the key could end up in a commit." >&2
  exit 1
fi

printf 'Paste your Meshy API key (it will not be shown), then press Return: '
IFS= read -rs key || true
echo
key="$(printf '%s' "$key" | tr -d '[:space:]')"
if [ -z "$key" ]; then
  echo "No key entered. Nothing changed." >&2
  exit 1
fi

echo "Checking the key with Meshy..."
# The header goes to curl on standard input, so the key never appears in the list of processes.
if ! response="$(printf 'Authorization: Bearer %s\n' "$key" |
  curl -sS --max-time 20 -w '\n%{http_code}' -H @- https://api.meshy.ai/openapi/v1/balance)"; then
  echo "Could not reach Meshy. Check the connection and try again. Nothing changed." >&2
  exit 1
fi
status="${response##*$'\n'}"
body="${response%$'\n'*}"
if [ "$status" != "200" ]; then
  echo "Meshy did not accept the key (HTTP $status). Nothing changed." >&2
  exit 1
fi

umask 077
touch "$ENV_FILE"
tmp="$(mktemp)"
grep -v '^MESHY_API_KEY=' "$ENV_FILE" > "$tmp" || true
printf 'MESHY_API_KEY=%s\n' "$key" >> "$tmp"
mv "$tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"

balance="$(printf '%s' "$body" | sed -n 's/.*"balance":[[:space:]]*\([0-9][0-9]*\).*/\1/p')"
echo "Saved as MESHY_API_KEY in $ENV_FILE (ignored by git). Meshy reports ${balance:-an unknown number of} credits."
