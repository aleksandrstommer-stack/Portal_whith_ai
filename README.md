# Корпоративный портал (MVP)

Монорепозиторий: **Next.js** (фронтенд), **Strapi 4** (CMS), **PostgreSQL**. Локальный запуск на macOS через **Docker Compose**.

## Возможности

- Контент из Strapi (REST), без хардкода основных текстов и списков на фронте.
- Разделы: новости, сотрудники (поиск, фильтры, группировка по отделам), официальная информация, обучение, вакансии, FAQ, заявки и обращения, полезные ссылки, виртуальная приёмная.
- Информационные разделы: боковая навигация и хлебные крошки.
- Главная: баннер (single type), быстрые действия, новости, ссылки, объявления.
- **ИИ‑чат (RAG):** Ollama (рекомендуется нативный на Mac для GPU через Metal), **pgvector** в Postgres (опционально через образ), импорт из **Google Docs** (текст и картинки по ссылкам), **Word .docx** (картинки сохраняются в `public/rag-media`) или Strapi **документов базы знаний**.

## Требования

- Docker Desktop для Mac  
- (опционально) Node.js 20+, если хотите запускать фронт или CMS вне Docker.

## Если при `docker compose up` ошибка pull Postgres (EOF / failed to resolve)

Сообщение вроде `Head "https://registry-1.docker.io/.../manifests/16-alpine": EOF` означает **проблему сети до Docker Hub**, а не ошибку в репозитории.

Что сделать по шагам:

1. **Повторить** после минуты: `docker pull pgvector/pgvector:pg16` (или `postgres:16-alpine`, если без RAG) затем снова `docker compose up --build`.
2. Отключить **VPN / корпоративный прокси** или сменить сеть (например, телефон как точка доступа).
3. В **Docker Desktop** → *Settings* → *Docker Engine* добавить DNS, например: `"dns": ["8.8.8.8", "1.1.1.1"]`, применить и перезапустить Docker.
4. Выполнить **`docker login`** (у анонимных иногда лимиты на скачивание).
5. Если есть свой registry, задайте в `.env`: `POSTGRES_IMAGE=...` (см. `.env.example`).

Образ Postgres в compose задаётся переменной **`POSTGRES_IMAGE`** (по умолчанию **`pgvector/pgvector:pg16`** для AI-чата). Если не тянется с Docker Hub — временно **`postgres:16-alpine`** (чат без векторов).

### Ошибка pull через Cloudflare (`production.cloudflare.docker.com` … **EOF**)

Это сбой **скачивания слоя** с registry (часто VPN, прокси, нестабильный Wi‑Fi, лимиты Hub). Что помогает:

1. **Не вызывайте** отдельно `docker compose pull`, если сеть к Hub нестабильна — используйте только `docker compose up -d --build` (образы, уже лежащие локально, подхватятся).
2. В `docker-compose.yml` для Postgres и **ollama** задано **`pull_policy: if_not_present`** — не перекачивает образ, если тег уже в кэше.
3. Повторить позже / другая сеть / `docker login` — как в разделе про Postgres выше.
4. Для macOS рекомендуется **нативный Ollama на хосте** (GPU через Metal). В проекте по умолчанию задано **`OLLAMA_BASE_URL=http://host.docker.internal:11434`**. Контейнер `ollama` в compose остаётся опциональным (для CPU/изолированного запуска): тогда выставьте `OLLAMA_BASE_URL=http://ollama:11434`. Модели в контейнер: **`sh scripts/rag-ollama-pull.sh`** после `docker compose up -d`.

### Автопереключение GPU/CPU

Поддержан список адресов Ollama в переменной **`OLLAMA_BASE_URLS`** (через запятую).  
По умолчанию:

`OLLAMA_BASE_URLS=http://host.docker.internal:11434,http://ollama:11434`

- если доступен хостовый Ollama (на Mac обычно `metal`/GPU) — запросы идут туда;
- если он недоступен — автоматически используется контейнерный Ollama (обычно CPU).

Внутри выбранного Ollama бэкенд (`GPU` или `CPU`) выбирается самим Ollama автоматически по доступности железа.

### AI: Google Docs / Word → векторная база → чат

**Google Docs (текст + изображения):** импорт идёт через экспорт **HTML**; встроенные картинки превращаются в строки вида `![figure](https://…)` в чанках, чтобы модель могла сослаться на них в ответе, а чат показывал превью.

1. В Google Docs: **Доступ** → «**Всем, у кого есть ссылка**» → **читатель** (иначе экспорт недоступен без OAuth).
2. Скопируйте **ссылку** или **ID** из URL (`/document/d/ЭТОТ_ID/…`).
3. Импорт в Postgres (из хоста, пока фронт слушает 3000):

   ```bash
   curl -sS -X POST http://localhost:3000/api/rag/import-google-doc \
     -H "Content-Type: application/json" \
     -d '{"url":"https://docs.google.com/document/d/ВАШ_ID/edit","title":"Регламент ресепшена","testKey":"reception-admin","testTitle":"Тест для администратора ресепшена"}'
   ```

   Если задан **`RAG_IMPORT_SECRET`** в `.env`, добавьте заголовок: `-H "Authorization: Bearer ВАШ_СЕКРЕТ"`.

4. Откройте [http://localhost:3000/chat](http://localhost:3000/chat) и задайте вопрос по содержимому документа.

**Word (.docx):** загрузка файла на тот же сервер фронта (multipart). Рисунки извлекаются и кладутся в **`frontend/public/rag-media/`** (в git не коммитятся, см. `.gitignore`). Повторная загрузка того же файла по содержимому заменяет старые чанки с тем же «отпечатком».

```bash
curl -sS -X POST http://localhost:3000/api/rag/import-word \
  -F "file=@/путь/к/документ.docx" \
  -F "title=Мой регламент" \
  -F "testKey=reception-admin" \
  -F "testTitle=Тест для администратора ресепшена"
```

С секретом импорта: `-H "Authorization: Bearer ВАШ_СЕКРЕТ"`.

**Авто-импорт при первом сообщении в чате:** в `.env` задайте `RAG_BOOTSTRAP_GOOGLE_DOC_ID=<id или полная ссылка>` (тот же публичный документ). Тогда при пустом индексе чат сначала загрузит Google Doc, затем при отсутствии чанков попробует документы базы знаний из Strapi.

### Проверка GPU в Ollama (macOS)

1. Запустите нативный Ollama на хосте:
   ```bash
   ollama serve
   ```
2. В другом терминале запустите модель (пример):
   ```bash
   ollama run llama3.2 "Привет"
   ```
3. Проверьте процессор:
   ```bash
   ollama ps
   ```
   В колонке `PROCESSOR` будет `metal`/`gpu` (используется GPU) или `cpu` (работает на CPU).

### Векторная база из админки Strapi

В **Content Manager** появился тип **«Векторная база знаний»** (`vector-knowledges`). Создайте запись, вставьте **заголовок** и **текст** (richtext), нажмите **Publish**. Strapi вызовет Ollama (эмбеддинги), запишет чанки в таблицу `portal_rag_chunks` в Postgres (нужен образ с **pgvector**). Черновик или снятие с публикации удаляет чанки этой записи. Удаление записи тоже очищает её чанки.

Для этого у контейнера **strapi** в compose заданы `RAG_DATABASE_URL`, `OLLAMA_BASE_URL`, `OLLAMA_EMBEDDING_MODEL`, `RAG_EMBEDDING_DIM` (как у фронта для чата).

## Быстрый старт

1. Скопируйте переменные окружения (по желанию):

   ```bash
   cp .env.example .env
   ```

2. Запустите стек:

   ```bash
   cd /Users/aleksandrstommer/Project/Portal
   docker compose up --build
   ```

3. Откройте в браузере:

   - Портал: [http://localhost:3000](http://localhost:3000)  
   - Админка Strapi: [http://localhost:1337/admin](http://localhost:1337/admin)

При первом запуске Strapi создаст администратора по мастеру в браузере (если база пустая). После входа демо-данные подтянутся из bootstrap при следующем рестарте контейнера **strapi**, если коллекции ещё пустые.

Чтобы **принудительно пересоздать** демо-данные, очистите том PostgreSQL и перезапустите:

```bash
docker compose down -v
docker compose up --build
```

## Первичная настройка Strapi

1. Пройдите регистрацию первого администратора на `/admin`.  
2. В **Settings → Users & permissions → Roles → Public** при необходимости включите `find` / `findOne` для нужных типов (bootstrap обычно уже выставляет чтение для публичного API).  
3. Контент правится в **Content Manager**; фронт читает только опубликованные записи (где включён **Draft & publish**).

## Сборка фронтенда

`next build` не требует запущенного Strapi: в `frontend/src/app/layout.tsx` включён `dynamic = "force-dynamic"`, чтобы страницы собирались без обращения к CMS на этапе сборки.

## Локальная разработка без Docker (опционально)

- PostgreSQL должен быть доступен; пропишите `DATABASE_*` в `cms/.env`.  
- `cd cms && npm install && npm run develop`  
- `cd frontend && npm install && npm run dev` — задайте `NEXT_PUBLIC_STRAPI_URL=http://localhost:1337`.

## Структура репозитория

| Путь | Назначение |
|------|------------|
| `docker-compose.yml` | Postgres, Strapi, Ollama, Next.js |
| `cms/` | Strapi: схемы контент-типов, bootstrap с демо-данными |
| `frontend/` | Next.js App Router, Tailwind, shadcn/ui |

## Переменные окружения (фронт)

| Переменная | Описание |
|------------|----------|
| `NEXT_PUBLIC_STRAPI_URL` | URL Strapi для браузера (например `http://localhost:1337`) |
| `STRAPI_INTERNAL_URL` | URL Strapi из Docker-сети (для SSR в контейнере, по умолчанию `http://strapi:1337`) |

## Лицензия и продакшен

Секреты в `.env.example` только для разработки. Для продакшена сгенерируйте новые `APP_KEYS`, JWT и соли Strapi и вынесите их в безопасное хранилище.
