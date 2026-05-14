#!/usr/bin/env bash
# Project-specific deploy configuration.
# Sourced by scripts/deploy.sh before calling deploy-lib/deploy.sh.

export PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── Required ───────────────────────────────────────────────────────────────────
export VPS_HOST="root@45.76.126.189"
export VPS_APP="/opt/notes"
export SSH_KEY="$HOME/.ssh/id_ed25519"

export COMPOSE_PROJECT="notes"
export DOCKER_SERVICE="app"
export DOCKER_VOLUME="app-data"
export DB_FILE="app.db"

export REQUIREMENTS_DOC="RequirementSet.md"
export TEST_CMD="npm test"

# ── Optional ───────────────────────────────────────────────────────────────────
export NGINX_CONF="deploy/nginx.conf"
export NGINX_SITE="notes.onemorepeppy.com"
export GITHUB_REPO="miiiikeb/claude-notes"
export CACHE_BUST_FILES="home.js noteEditor.js noteDetail.js marked.min.js notes.css"
# export SMOKE_TEST_CMD="node -e \"require('http').get('http://localhost:3000/api/auth/me', r => process.exit(r.statusCode === 401 ? 0 : 1))\""
