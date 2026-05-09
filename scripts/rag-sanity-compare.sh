#!/usr/bin/env bash
# Один и те же проверки на Mac и на Ubuntu: объём RAG, выборка чанков, чат, Ollama.
# ВАЖНО (zsh): не ставьте # в конце строки с export в одной строке; подставьте РЕАЛЬНЫЕ логин/пароль/порт из .env, не буквально USER:PASS.
# Пример с локальным Docker (порт postgres с хоста часто 5433):
#   export RAG_DATABASE_URL="postgresql://strapi:strapi@127.0.0.1:5433/strapi"
#   export RAG_SANITY_CHAT_URL="http://127.0.0.1:3000/api/chat"
#   export OLLAMA_BASE_URL="http://127.0.0.1:11434"
#   ./scripts/rag-sanity-compare.sh "вопрос"
# Файл должен существовать в репо: git pull на сервере, если scрипт только что добавлен.

set -euo pipefail

# Корень репозитория (папка с docker-compose.yml) — заходить в неё, не в /Users/... с другой машины
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RAG_URL="${RAG_DATABASE_URL:-postgresql://strapi:strapi@127.0.0.1:5433/strapi}"
CHAT_URL="${RAG_SANITY_CHAT_URL:-http://127.0.0.1:3000/api/chat}"
OLLAMA_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
QUESTION="${1:-Санити-чек RAG: сравниваю окружения}"

# psql с хоста к порту, либо без psql — через docker compose exec
psql_rag() {
  if command -v psql >/dev/null 2>&1; then
    psql "$RAG_URL" "$@"
  elif [[ -f "$REPO_ROOT/docker-compose.yml" ]] && command -v docker >/dev/null 2>&1; then
    (cd "$REPO_ROOT" && docker compose exec -T postgres psql -U strapi -d strapi "$@")
  else
    return 1
  fi
}

echo "========== 0) Репозиторий (сюда смотрят docker compose и cd) =========="
echo "$REPO_ROOT"

echo "========== 1) Подключение к Postgres (строка без пароля) =========="
echo "$RAG_URL" | sed -E 's#(postgresql://[^:]*:)[^@]*@#\1***@#'

echo ""
echo "========== 2) Сколько записей в portal_rag_chunks =========="
set +e
CNT="$(psql_rag -tAc "SELECT COUNT(*) FROM portal_rag_chunks" 2>/dev/null)"
set -e
if [[ -n "${CNT// /}" ]]; then
  echo "count: ${CNT// /}"
else
  echo "Не удалось выполнить запрос. Убедитесь, что из $REPO_ROOT команда: docker compose ps postgres, или установите psql."
fi

echo ""
echo "========== 3) Три последних чанка: id, title из metadata, сниппет =========="
set +e
psql_rag -c "SELECT id, COALESCE(metadata->>'title','') AS title, left(content, 100) AS snippet FROM portal_rag_chunks ORDER BY id DESC LIMIT 3;" 2>/dev/null || echo "(запрос не выполнен: запустите скрипт из папки репо, docker compose up -d)"
set -e

echo ""
echo "========== 4) Ollama: какие модели (должны совпадать embed/chat с .env) =========="
curl -sS --connect-timeout 3 "${OLLAMA_URL}/api/tags" | head -c 400 || echo "(Ollama недоступен по $OLLAMA_URL)"

echo ""
echo ""
echo "========== 5) Один и тот же вопрос в /api/chat (первые 900 символов тела) =========="
echo "question: $QUESTION"
json_body() {
  if command -v node >/dev/null 2>&1; then
    node -e "console.log(JSON.stringify({ question: process.argv[1] }))" "$QUESTION"
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c "import json, sys; print(json.dumps({'question': sys.argv[1]}, ensure_ascii=False))" "$QUESTION"
  else
    echo '{"question":"(установите node или python3 для JSON с кириллицей)"}' 
  fi
}
curl -sS --connect-timeout 10 -X POST "$CHAT_URL" \
  -H "Content-Type: application/json" \
  -d "$(json_body)" | head -c 900
echo
echo ""
echo "Готово. Сравните: COUNT, блок 3) и длину/смысл ответа /api/chat на Mac и Ubuntu."
echo "Если count сильно отличается — разные данные в Postgres (не тот volume / не тот RAG_DATABASE_URL в контейнере frontend)."
echo "Если в ответе есть materials, entails, «в контексте» про HR — на сервере, скорее всего, старая сборка API: git pull, затем docker compose build --no-cache frontend && docker compose up -d"
