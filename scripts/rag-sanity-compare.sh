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

RAG_URL="${RAG_DATABASE_URL:-postgresql://strapi:strapi@127.0.0.1:5433/strapi}"
CHAT_URL="${RAG_SANITY_CHAT_URL:-http://127.0.0.1:3000/api/chat}"
OLLAMA_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
QUESTION="${1:-Санити-чек RAG: сравниваю окружения}"

echo "========== 1) Подключение к Postgres (строка без пароля) =========="
echo "$RAG_URL" | sed -E 's#(postgresql://[^:]*:)[^@]*@#\1***@#'

echo ""
echo "========== 2) Сколько записей в portal_rag_chunks =========="
if command -v psql >/dev/null 2>&1; then
  psql "$RAG_URL" -tAc "SELECT COUNT(*) FROM portal_rag_chunks;" | xargs echo "count:"
else
  echo "psql не найден. Установите postgresql client или выполните вручную в контейнере:"
  echo "  docker compose exec -T postgres psql -U strapi -d strapi -c \"SELECT COUNT(*) FROM portal_rag_chunks;\""
fi

echo ""
echo "========== 3) Три последних чанка: id, title из metadata, сниппет =========="
if command -v psql >/dev/null 2>&1; then
  psql "$RAG_URL" -c "SELECT id, COALESCE(metadata->>'title','') AS title, left(content, 100) AS snippet FROM portal_rag_chunks ORDER BY id DESC LIMIT 3;" 2>/dev/null || true
else
  echo "(пропущено, нет psql)"
fi

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
echo "Готово. Сравните: COUNT на Mac и на Ubuntu, сниппеты и длину/смысл ответа /api/chat."
echo "Если count=0 на сервере — RAG пуст: те же чанки нужно снова загрузить/проиндексировать (не «слова в фильтрах»)."
