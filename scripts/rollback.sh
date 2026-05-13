#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/deploy.config.sh"
. "$SCRIPT_DIR/../deploy-lib/rollback.sh"
