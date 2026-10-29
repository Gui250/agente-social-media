#!/bin/sh
# Sends the variables in .env and .env.local to the Vercel project's production environment,
# with the OAuth redirect URIs pointing at the production domain, then redeploys.
# Skips empty values and VERCEL_OIDC_TOKEN.
# Usage: sh scripts/vercel-env-push.sh [https://your-domain]
cd "$(dirname "$0")/.." || exit 1
APP_URL=${1:-https://agente-social-media-zeta.vercel.app}

push() {
  if printf '%s' "$2" | npx -y vercel@latest env add "$1" production --force >/dev/null 2>&1; then
    echo "ok $1"
  else
    echo "FALHOU $1"
  fi
}

cat .env .env.local 2>/dev/null | grep -E '^[A-Z_]+=' |
  grep -vE '^(VERCEL_OIDC_TOKEN|INSTAGRAM_REDIRECT_URI|FACEBOOK_REDIRECT_URI)=' |
  while IFS= read -r line; do
    k=${line%%=*}
    v=${line#*=}
    v=${v%\"}
    v=${v#\"}
    if [ -z "$v" ]; then echo "pulado $k (vazio)"; else push "$k" "$v"; fi
  done

push INSTAGRAM_REDIRECT_URI "$APP_URL/api/instagram/callback"
push FACEBOOK_REDIRECT_URI "$APP_URL/api/instagram/facebook/callback"

# Env changes only apply to new deployments.
npx -y vercel@latest deploy --prod --yes >/dev/null 2>&1 && echo "deploy ok: $APP_URL" || echo "deploy FALHOU"
