#!/bin/bash
# ===============================================================================
# Phase 0 (G0-5) — CI baseline collection
# ===============================================================================
# Тянет последние GH Actions runs и считает средние/p95 длительности.
# Результат — markdown-таблица для коммита в docs/02-monitoring/CI_BASELINE.md.
#
# Зачем: без зафиксированного baseline нельзя сказать, ускоряют ли P0-21/22
# (кеш зависимостей, parallelization) что-то на самом деле.
#
# Требует: gh CLI авторизован (`gh auth status`), jq.
#
# Использование:
#   ./scripts/ci-baseline.sh [количество_runs] [workflow_name]
#   ./scripts/ci-baseline.sh 30 ci.yml
# ===============================================================================

set -euo pipefail

LIMIT="${1:-30}"
WORKFLOW="${2:-}"

if ! command -v gh >/dev/null; then
  echo "[FATAL] gh CLI не установлен." >&2; exit 2
fi
if ! command -v jq >/dev/null; then
  echo "[FATAL] jq не установлен." >&2; exit 2
fi

# Тянем raw данные. updatedAt - createdAt = wall-clock длительность run'а.
FILTER='[.[] | {
  name: .name,
  workflow: .workflowName,
  conclusion: .conclusion,
  status: .status,
  branch: .headBranch,
  durationSec: (((.updatedAt | fromdateiso8601) - (.createdAt | fromdateiso8601))),
  startedAt: .createdAt,
  url: .url
}]'

if [[ -n "${WORKFLOW}" ]]; then
  RAW=$(gh run list --limit "${LIMIT}" --workflow "${WORKFLOW}" --json name,workflowName,conclusion,status,headBranch,createdAt,updatedAt,url)
else
  RAW=$(gh run list --limit "${LIMIT}" --json name,workflowName,conclusion,status,headBranch,createdAt,updatedAt,url)
fi

ENRICHED=$(echo "${RAW}" | jq "${FILTER}")

# --- Сводка по workflow --------------------------------------------------------
echo "# CI Baseline ($(date -Iseconds))"
echo ""
echo "Source: \`gh run list --limit ${LIMIT}${WORKFLOW:+ --workflow ${WORKFLOW}}\`"
echo ""
echo "## Per-workflow stats"
echo ""
echo "| Workflow | Runs | Success | p50 (s) | p95 (s) | Avg (s) | Max (s) |"
echo "|---|---:|---:|---:|---:|---:|---:|"

echo "${ENRICHED}" | jq -r '
  group_by(.workflow)
  | map({
      workflow: .[0].workflow,
      runs: length,
      success: ([.[] | select(.conclusion=="success")] | length),
      durations: [.[].durationSec] | sort
    })
  | .[]
  | "| \(.workflow) | \(.runs) | \(.success)/\(.runs) | \(.durations[(.durations|length)/2|floor] | floor) | \(.durations[(.durations|length*0.95)|floor] | floor) | \((.durations | add / length) | floor) | \(.durations[-1] | floor) |"
'

echo ""
echo "## Recent runs (last ${LIMIT})"
echo ""
echo "| When | Workflow | Branch | Conclusion | Duration (s) |"
echo "|---|---|---|---|---:|"
echo "${ENRICHED}" | jq -r '
  sort_by(.startedAt) | reverse
  | .[]
  | "| \(.startedAt) | \(.workflow) | \(.branch) | \(.conclusion // .status) | \(.durationSec | floor) |"
'

echo ""
echo "_Сохрани в \`docs/02-monitoring/CI_BASELINE.md\` и перезапускай раз в неделю._"
