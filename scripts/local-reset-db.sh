#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER_NAME="${NOLYVRA_DB_CONTAINER:-nolyvra-postgres}"
DB_NAME="${NOLYVRA_DB_NAME:-nolyvra}"
DB_USER="${NOLYVRA_DB_USER:-nolyvra}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required to reset the local database." >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
  echo "Local database container '${CONTAINER_NAME}' is not running." >&2
  echo "Start it first, then rerun this script." >&2
  exit 1
fi

echo "Resetting local Nolyvra database in container '${CONTAINER_NAME}'..."
docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" \
  < "${REPO_ROOT}/additional/sql/local_reset_data.sql"

echo "Seeding local login and default job..."
docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" \
  < "${REPO_ROOT}/additional/sql/local_seed_data.sql"

echo "Done."
echo "Login: local@nolyvra.test"
echo "Password: Welcome1"
