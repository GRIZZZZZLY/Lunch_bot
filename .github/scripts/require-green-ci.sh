#!/usr/bin/env bash
# Выпускается только коммит, для которого обязательный CI завершился успешно.
#
# Раньше workflow выпуска проверял лишь, что коммит существует, и мог выкатить
# то, что CI ещё не проверил или уже забраковал. CI для этого SHA может ещё
# идти (тег поставлен сразу после push в main) — тогда ждём, но не бесконечно.
#
# Нужны: gh, GH_TOKEN с правом actions:read, GITHUB_REPOSITORY, DEPLOY_SHA.
# CI_WAIT_SECONDS и CI_POLL_SECONDS — необязательно, для проверки скрипта.
set -euo pipefail

: "${GITHUB_REPOSITORY:?}" "${DEPLOY_SHA:?}"
wait_seconds=${CI_WAIT_SECONDS:-2400}
poll_seconds=${CI_POLL_SECONDS:-30}
deadline=$((SECONDS + wait_seconds))

while :; do
  run=$(gh run list --repo "$GITHUB_REPOSITORY" --workflow ci.yml \
    --commit "$DEPLOY_SHA" --limit 1 --json status,conclusion,url \
    --jq '.[0] // empty | "\(.status)|\(.conclusion // "")|\(.url)"')

  if [ -z "$run" ]; then
    echo "::error::CI для $DEPLOY_SHA не запускался. Запустите CI для этого коммита (workflow_dispatch) и повторите выпуск."
    exit 1
  fi

  IFS='|' read -r status conclusion url <<<"$run"

  if [ "$status" = completed ]; then
    if [ "$conclusion" = success ]; then
      echo "CI для $DEPLOY_SHA успешен: $url"
      exit 0
    fi
    echo "::error::CI для $DEPLOY_SHA завершился с итогом «$conclusion»: $url"
    exit 1
  fi

  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "::error::CI для $DEPLOY_SHA не завершился за $((wait_seconds / 60)) мин: $url"
    exit 1
  fi

  echo "CI для $DEPLOY_SHA ещё идёт ($status), ждём: $url"
  sleep "$poll_seconds"
done
