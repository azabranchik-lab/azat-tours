# Alatoo — состояние проекта (передача дел)

Этот файл — чтобы в **новом чате** мгновенно продолжить работу. Покажи ассистенту папку
`C:\Users\user\kyrgyzstan-tours` и этот файл — он подхватит контекст.

## СТАТУС: проект РАЗВЁРНУТ на VPS (сайт + бот работают онлайн)
- Источник правды для **кода/дизайна** — локальная папка `C:\Users\user\kyrgyzstan-tours`. Правим здесь, потом обновляем сервер.
- Источник правды для **контента** (туры, блог, отзывы, гиды, фото, заявки, чаты) — **сервер**:
  владелец редактирует его через Telegram-бота вживую. Эти файлы (`content/*.json`, `images/`)
  на сервере новее локальных — поэтому при обновлении сервера их НЕ трогаем.

## Как продолжить в НОВОМ чате
1. Открой новый чат Claude Code на этом же компьютере (доступ к той же папке).
2. Первое сообщение: «Продолжаем проект Alatoo, прочитай `PROJECT-STATE.md` в `C:\Users\user\kyrgyzstan-tours`».
3. Скажи, что нужно: правка кода/дизайна (→ переразвернуть) или контент (→ через бота, без деплоя).

## Как выкатить изменения кода на сервер (после правок локально)
1. Пересобрать архив, ИСКЛЮЧАЯ серверные данные:
   `tar --exclude=kyrgyzstan-tours/node_modules --exclude=kyrgyzstan-tours/config.json --exclude=kyrgyzstan-tours/content --exclude=kyrgyzstan-tours/images -czf alatoo-update.tar.gz kyrgyzstan-tours`
2. Передать другу/на сервер, распаковать поверх (content/ и images/ на сервере сохранятся).
3. На сервере: `npm install` (если менялись зависимости) → `pm2 restart alatoo`.
- Бот работает только на сервере. Локально его НЕ запускать с тем же токеном (конфликт polling).
- Для локального предпросмотра дизайна достаточно `node server.js` (сайт без бота).

## Что это
Продающий сайт туров по Кыргызстану (англ., для иностранцев) + **Telegram-админка** для управления контентом.
Бренд: **Azat Tours** (ребренд из Alatoo сделан 2026-06-19 — см. раздел «Ребрендинг» ниже). Дизайн: чистый «editorial alpine», шрифты Fraunces + Hanken Grotesk,
акцент — бирюза Иссык-Куля. Иконки — тонкие SVG (line-art), без эмодзи.

## Стек / архитектура
- Статический фронтенд (HTML/CSS/JS) + Node-сервер `server.js` (отдаёт сайт + API заявок/чата).
- `bot.js` — Telegram-бот (grammY), управляет контентом, пишет в `content/*.json` и `images/`.
- `start.js` — запускает сайт+бота вместе (для хостинга).
- Источник данных туров: `content/tours.json` → бот пересобирает `tours-data.js` (его читает сайт).
- Блог: `content/posts.json` → `posts-data.js`; рендер `post.html` + `post-render.js` (md-разметка).
- Заявки: `content/leads.json`; чат: `content/chats.json`.
- Конфиг бота: `config.json` (token + ownerId) — НЕ коммитить.

## Ключевые файлы
- Страницы: index, tours, tour (шаблон ?slug=), builder, plan-trip, about, contact, reviews, blog, post.
- Рендер: `tours-render.js` (каталог+featured), `tour-detail.js`, `builder.js`, `blog-render.js`, `post-render.js`, `chat.js`, `script.js`.
- Стили: `styles.css`. Иконки: `scripts/deemoji.js` (эмодзи→SVG, идемпотентно).
- Данные/админ: `lib/content.js`, `lib/store.js`, `bot.js`, `server.js`, `start.js`, `scripts/seed-content.js`, `scripts/seed-posts.js`.

## Запуск локально
- Сайт+API: `node server.js` (порт 5173). Бот: `node bot.js`. Вместе: `node start.js`.
- Бот: первый `/start` привязывает владельца (сейчас ownerId 913187557).

## Сделано
- Главная, каталог из 39 туров (данные kyrgyzriders), детальные страницы из JSON, Trip Builder (5 шагов),
  About, Contact (карта), Reviews + бейджи + Instagram-блок, хаб Plan-your-trip, блог с 3 статьями.
- Заявки: форма + билдер → `/api/lead` → сохранение + Telegram. Чат на сайте ↔ Telegram (ответ Reply).
- Telegram-админка: /tours /addtour (+редактирование полей, фото), /posts /addpost (CRUD, обложка, галерея),
  /leads, /chats, /reply.
- UI: карточки туров кликабельны целиком; эмодзи заменены на SVG-иконки по всему сайту.
- WhatsApp/Telegram: номер +996222222011. Web3Forms-ключ был, сейчас лиды идут через свой /api/lead.

## Осталось / следующее
- **Деплой** (см. `ДЕПЛОЙ.md`): VPS+pm2 (реком) или Railway+Volume. Нужен постоянный диск (бот пишет фото).
- Перед продакшеном: **пересоздать токен бота** (@BotFather /revoke), задать `BOT_TOKEN`/`OWNER_ID` через env.
- Реальный контент клиента: фото команды/туров, лицензия, ссылки Tripadvisor/Google/Instagram, домен, бренд.
- Опционально: GA4 + Meta Pixel, юр-страницы + cookie-баннер, мультиязычность, онлайн-оплата.

## Планы/прогресс
`ROADMAP.md`, `ПЛАН-РАБОТ.md`, `ТГ-АДМИНКА-ПЛАН.md`, `НАСТРОЙКА.md`.

## Ребрендинг Alatoo → Azat Tours (сделано 2026-06-19, локально, НЕ задеплоено)
- **Бэкап до изменений:** папка `C:\Users\user\kyrgyzstan-tours-BACKUP-2026-06-19` + git (репо инициализирован, baseline-коммит `f520aa7`). Откат: `git reset --hard f520aa7` или из папки-бэкапа.
- **Что изменено (всё локально, ждёт деплоя):**
  - About/Mission переписаны «тёплым голосом местного» (hero, story, новый блок Mission). Бренд-гайд: `BRAND.md`, маркетинг-контекст: `.agents/product-marketing-context.md`.
  - Переименованы ТОЛЬКО видимые `Alatoo`→`Azat Tours` (HTML, title/meta/og, schema, копирайт, логотип-текст, WhatsApp-тексты, видимый текст chat/builder/tour-detail/post-render, sitemap, robots).
  - **Убраны все выдуманные соц-доказательства** (реальных отзывов нет): фейк-статистика, бейджи Tripadvisor/Google, рейтинги 4.9/«128 reviews», `aggregateRating` в schema, «2400+ travellers», «since/est. 2009». Страница `reviews.html` **скрыта** (ссылки убраны из подвалов и sitemap, файл оставлен на диске).
  - SEO: self-canonical + og добавлены где не было; новый `favicon.svg` (горная марка) подключён во всех страницах.
- **НЕ тронуто (внутреннее, оставить как есть):** pm2-процесс `alatoo`, `name` в package.json (`alatoo-kyrgyzstan`), `.claude/launch.json` (`alatoo`), localStorage-ключи (`alatoo_chat_*`, `alatoo_builder`), `content/*.json` + `images/` (серверный контент, через бота), `reviews-data.js` (генерится из content).
- **Домен-заглушка:** теперь `azattours.travel` (в canonical/og/sitemap/robots/email/IG). Зарегистрировать реальный домен + IG `@azattours.kyrgyzstan` + email перед продом.
- **Осталось:** задеплоить (tar без `node_modules`/`config.json`/`content`/`images`; **новый `favicon.svg` попадёт в архив автоматически**; можно добавить `--exclude=.git` и `--exclude` папки-бэкапа) → `pm2 restart alatoo`. Внести реальные данные клиента (отзывы появятся → вернуть reviews-страницу).
- **Мелочь на потом:** на `tour-ala-kul.html` осталась промо-плашка «Save 10% before May 31» (выдуманная срочность) — убрать/заменить, если не актуально.
