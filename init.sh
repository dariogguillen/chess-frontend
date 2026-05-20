#!/usr/bin/env bash
#
# init.sh — Verification entry point for chess-frontend.
#
# This script is the single source of truth for "does this project work?".
# A passing run is the only acceptable evidence that a feature is done.
#
# Steps (current baseline; extended by features as they introduce tooling):
#   1. Sanity checks (Node, npm version floor, jq, required files)
#   2. feature_list.json invariants (at most one in_progress feature)
#   3. Install dependencies from lock (npm ci) — `.npmrc` enforces
#      `ignore-scripts=true`, so no install-time scripts run for any
#      dependency.
#   4. Rebuild the explicit postinstall allowlist (esbuild only today).
#      This is the controlled escape hatch from `ignore-scripts=true`:
#      packages that legitimately need to materialise a native binary
#      get a single, audited rebuild step. Adding a package that
#      silently requires a postinstall fails the next build visibly
#      (missing binary) and forces a documented allowlist update.
#   5. Audit (npm audit --audit-level=moderate) — fails the build on
#      any moderate-or-higher finding. Resolution path: patch upgrade,
#      `overrides` in `package.json`, or escalate.
#   6. Lint (npm run lint)
#   6.5. Format check (npm run format:check) — introduced by feature 1.5
#   7. Type check (npm run typecheck) — introduced by feature 1
#   8. Test (npm run test) — introduced by feature 1
#   9. Build (npm run build)
#
# Steps 6.5, 7, and 8 are skipped silently if the corresponding npm script
# does not exist yet (the harness ships with only lint and build initially;
# typecheck and test are added in feature 1, format:check in feature 1.5).
#
# Exit code 0 = green. Any non-zero = stop and read the output.

set -euo pipefail

# --- Colors (only when stdout is a TTY) ---
if [ -t 1 ]; then
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  RED='\033[0;31m'
  NC='\033[0m'
else
  GREEN=''
  YELLOW=''
  RED=''
  NC=''
fi

info() { printf "${YELLOW}==>${NC} %s\n" "$1"; }
ok() { printf "${GREEN}✔${NC}  %s\n" "$1"; }
fail() {
  printf "${RED}✘${NC}  %s\n" "$1" >&2
  exit 1
}

has_script() {
  # Returns 0 if package.json defines the given npm script, 1 otherwise.
  jq -e --arg s "$1" '.scripts[$s]' package.json >/dev/null 2>&1
}

# --- Step 1: Sanity ---
info "Sanity checks"

if ! command -v node >/dev/null 2>&1; then
  fail "node not found on PATH"
fi

NODE_MAJOR=$(node --version | sed 's/^v//' | cut -d. -f1)
NVMRC_MAJOR=""
if [ -f ".nvmrc" ]; then
  NVMRC_MAJOR=$(sed 's/^v//' .nvmrc | cut -d. -f1)
fi
if [ -n "${NVMRC_MAJOR}" ] && [ "${NODE_MAJOR}" -lt "${NVMRC_MAJOR}" ]; then
  fail "Node ${NVMRC_MAJOR}+ required (per .nvmrc), found ${NODE_MAJOR}"
fi
ok "Node ${NODE_MAJOR} found (.nvmrc requests ${NVMRC_MAJOR}+)"

if ! command -v npm >/dev/null 2>&1; then
  fail "npm not found on PATH"
fi

# npm >= 11.7 is required for the `min-release-age` setting in `.npmrc`.
# The supply chain hygiene policy depends on it; older npm silently
# ignores the option and the policy is incomplete.
NPM_VERSION=$(npm --version)
NPM_MAJOR=$(echo "${NPM_VERSION}" | cut -d. -f1)
NPM_MINOR=$(echo "${NPM_VERSION}" | cut -d. -f2)
if [ "${NPM_MAJOR}" -lt 11 ] || { [ "${NPM_MAJOR}" -eq 11 ] && [ "${NPM_MINOR}" -lt 7 ]; }; then
  fail "npm >= 11.7 is required (found ${NPM_VERSION}). Upgrade with: npm install -g npm@latest"
fi
ok "npm ${NPM_VERSION} present (>= 11.7 required for min-release-age)"

if ! command -v jq >/dev/null 2>&1; then
  fail "jq is required to validate feature_list.json. Install: pacman -S jq / brew install jq"
fi
ok "jq present"

for f in package.json package-lock.json CLAUDE.md AGENTS.md feature_list.json; do
  if [ ! -f "${f}" ]; then
    fail "Required file missing: ${f}"
  fi
done
ok "Required files present"

# --- Step 2: feature_list.json invariants ---
info "feature_list.json invariants"

IN_PROGRESS_COUNT=$(jq '[.[] | select(.status == "in_progress")] | length' feature_list.json)
if [ "${IN_PROGRESS_COUNT}" -gt 1 ]; then
  fail "More than one feature is in_progress (${IN_PROGRESS_COUNT}). Only one is allowed at a time."
fi
ok "At most one feature in_progress (${IN_PROGRESS_COUNT})"

PENDING_COUNT=$(jq '[.[] | select(.status == "pending")] | length' feature_list.json)
DONE_COUNT=$(jq '[.[] | select(.status == "done")] | length' feature_list.json)
info "Feature counts — pending: ${PENDING_COUNT}, in_progress: ${IN_PROGRESS_COUNT}, done: ${DONE_COUNT}"

# --- Step 3: Install ---
# `npm ci` honours `.npmrc` settings, so `ignore-scripts=true` is in
# effect: no `preinstall` / `install` / `postinstall` hooks run for any
# dependency during this step.
info "Install (npm ci)"
npm ci --silent
ok "Dependencies installed from lock (ignore-scripts honoured)"

# --- Step 4: Rebuild postinstall allowlist ---
# The single legitimate postinstall in our tree today is `esbuild`,
# which downloads its platform-specific native binary. Without this
# explicit rebuild the binary is missing and `vite build` would fail.
# Adding a new package that depends on a postinstall to function will
# fail visibly here or in the build step and force an audited update
# of this allowlist — that is the policy.
info "Rebuild postinstall allowlist (esbuild)"
npm rebuild esbuild --silent
ok "esbuild rebuilt"

# --- Step 5: Audit ---
# Fails the build on any vulnerability at moderate severity or higher.
# Resolution path (in order): patch-level upgrade via `npm update`,
# transitive pin via `overrides` in `package.json`, or escalate to the
# leader if no fix exists short of a breaking change.
info "Audit (npm audit --audit-level=moderate)"
npm audit --audit-level=moderate
ok "Audit clean at moderate+"

# --- Step 6: Lint ---
info "Lint (npm run lint)"
npm run lint --silent
ok "Lint passed"

# --- Step 6.5: Format check (if script exists) ---
# Gates only — `format:check` runs Prettier in `--check` mode and never
# mutates the working tree. Local fix is `npm run format`. Introduced
# in feature 1.5 (`format-the-world`).
if has_script format:check; then
  info "Format check (npm run format:check)"
  npm run format:check --silent
  ok "Format check passed"
else
  info "Skipping format:check — not yet defined in package.json (feature 1.5 adds it)"
fi

# --- Step 7: Type check (if script exists) ---
if has_script typecheck; then
  info "Type check (npm run typecheck)"
  npm run typecheck --silent
  ok "Type check passed"
else
  info "Skipping typecheck — not yet defined in package.json (feature 1 adds it)"
fi

# --- Step 8: Test (if script exists) ---
if has_script test; then
  info "Test (npm run test)"
  npm run test --silent
  ok "Tests passed"
else
  info "Skipping test — not yet defined in package.json (feature 1 adds it)"
fi

# --- Step 9: Build ---
info "Build (npm run build)"
npm run build --silent
ok "Build passed"

# --- Done ---
echo
printf "${GREEN}All checks passed.${NC}\n"
