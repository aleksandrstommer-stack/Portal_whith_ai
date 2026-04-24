#!/usr/bin/env sh
# Подтянуть модели в контейнер ollama (docker compose) или в локальную Ollama на хосте.
set -eu

case "$0" in
  */*) SCRIPT_DIR=$(CDPATH= cd "${0%/*}" && pwd) ;;
  *) SCRIPT_DIR=$(pwd) ;;
esac
ROOT=$(CDPATH= cd "$SCRIPT_DIR/.." && pwd)
cd "$ROOT" || {
  echo "Не удалось перейти в $ROOT" >&2
  exit 1
}

EMBED="${OLLAMA_EMBEDDING_MODEL:-nomic-embed-text}"
CHAT="${OLLAMA_CHAT_MODEL:-llama3.2}"

cid="$(docker compose ps -q ollama 2>/dev/null || true)"
if [ -n "$cid" ]; then
  echo "Используется контейнер ollama."
  echo "ollama pull $EMBED"
  docker compose exec ollama ollama pull "$EMBED"
  echo "ollama pull $CHAT"
  docker compose exec ollama ollama pull "$CHAT"
  echo "Готово: docker compose exec ollama ollama list"
  exit 0
fi

if command -v ollama >/dev/null 2>&1; then
  echo "Контейнер ollama не запущен — качаем модели в локальную Ollama (Mac)."
  echo "Запустите стек: docker compose up -d  или  ollama serve"
  echo ""
  echo "ollama pull $EMBED"
  ollama pull "$EMBED"
  echo "ollama pull $CHAT"
  ollama pull "$CHAT"
  echo "Готово: ollama list"
  exit 0
fi

echo "Контейнер ollama не запущен и команда ollama на хосте не найдена." >&2
echo "" >&2
echo "  cd \"$ROOT\" && docker compose up -d" >&2
echo "  sh scripts/rag-ollama-pull.sh" >&2
exit 1
