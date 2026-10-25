# Фаза 0. Разведка и baseline (2026-10-25)

Только чтение. Ветка `seo-fixes` создана от `origin/main` (b4a8154, это и есть прод). Код сайта не менялся.

## 1. Как устроен сайт

| Что | Как |
|---|---|
| Хостинг | VPS 178.128.115.215 (Ubuntu), nginx 1.24 как reverse proxy и TLS, за ним Node `server.js` под pm2 (`azat-tours`), папка `/root/azat-tours`. |
| Деплой | GitHub Actions `.github/workflows/deploy.yml`: push в `main` → `git reset --hard` на сервере → `npm ci` → `scripts/migrate.js` (одноразовые миграции контента) → `scripts/regenerate-all.js` → `pm2 reload`. Заработал 2026-10-17. **Push в main = прод.** |
| Генерация страниц | Серверный рендер по запросу (`lib/pages.js`, `lib/tour-page.js`, `lib/post-page.js`): шаблон `public/*.html` + данные, кэш в памяти по mtime файлов. Статической сборки нет. |
| Данные | `content/tours.json` (80 туров, 79 опубликованных, 1 скрыт), `content/posts.json` (9 статей), `content/sights.json`, `content/site.json`, `content/reviews.json` (пустой). Источник правды — сервер, владелец правит через Telegram-бота. Локально контент был на 41 тур короче прода; миграция `2026-10-16-new-tours` применена локально, теперь локально = прод (снимок до неё в `content/before-2026-10-16-new-tours/`). |
| Sitemap | Уже генерируется сервером на лету из тех же данных (`pages.sitemapXml`), `lastmod` из поля `updatedAt`, которое ставится при реальной правке. `scripts/build-sitemap.js` только обновляет закоммиченную копию. |
| Редиректы | Уже в `server.js` (`routePage`): `tour.html?slug=СТАРЫЙ|НОВЫЙ`, `tour.html?id=`, `post.html?slug=`, `tours.html`, `blog.html`, `index.html`, адрес без слэша, старый slug в `/tours/<slug>/`, `www.` → без www. Карта: `scripts/_tour-renames.json`. Query-параметры обрабатывает сам Node, nginx трогать не нужно. |
| Проверка | `node scripts/check-site.js [url]` уже существует (title, description, canonical, H1, JSON-LD, ссылки). |

**Важно:** задание писалось по состоянию прода до 17 октября. Многие пункты фаз 1.1 и 1.2 на проде уже выполнены (ниже отмечено что именно). Утверждение «`tour.html?slug=song-kol-lake-on-horseback-3-days` открывает каталог» сейчас неверно: отдаёт 301 на `/tours/song-kul-horse-trek-3-days/`.

## 2. Инвентаризация URL

Прод sitemap: 92 URL = 6 служебных (`/`, `/tours/`, `/plan-trip.html`, `/blog/`, `/about.html`, `/contact.html`) + 77 туров + 9 статей. Без `changefreq`/`priority` не обошлось: они есть (убрать в фазе 1). `lastmod`: 45 страниц 2026-10-13, 47 страниц 2026-10-17.

Не в sitemap, но существуют: `/builder.html` (noindex, приложение), `/reviews.html` (noindex, отзывов нет, ни одна страница на неё не ссылается), `/404.html`, `/llms.txt`, `/llms-full.txt`, `.md`-версии каждого тура и статьи (`X-Robots-Tag: noindex`), `/cars/` (404, пока нет опубликованных машин).

Туров опубликовано 79, в sitemap 77: два тура (`tash-rabat-kel-suu-road-trip-11-days`, `tash-rabat-kel-suu-ala-kul-11-days`) открываются, но их canonical указывает на 12-дневные версии, поэтому в sitemap их нет (решение 2026-10-14).

Старый sitemap (июльский, с `tour.html?slug=`) достать не удалось: прод уже отдаёт новый, в Wayback Machine снимков нет. Список старых адресов собран из `scripts/_tour-renames.json` (38 переименований + 1 скрытый тур), текущих slug (`tour.html?slug=<текущий>`, `tour.html?id=<id>`) и статей (`post.html?slug=`).

**Статусы старых адресов на проде** (`baseline/prod/old-urls.csv`, 260 адресов): 257 → 301 одним хопом на конкретную страницу, 0 цепочек, 0 редиректов на каталог вместо страницы. Три 404 — это намеренно несуществующие slug для проверки.

## 3. Карта редиректов

`seo-audit/redirect-map.csv` (генерируется `node seo-audit/build-redirect-map.js`): 252 строки, 249 high, 1 medium, 2 требуют решения.

- **medium:** `tour.html?slug=elena-tabers-tour-7-days` → `/tours/kyzyl-oi-song-kul-chong-kemin-8-days/`. Тур скрыт 13.10 как почти дубль (имя реального человека). Подтвердите цель.
- **решение:** неизвестный slug сейчас отдаёт честный 404. Задание требует 301 на `/tours/` (единственный допустимый случай). Я бы оставил 404: Google трактует редирект всех мусорных URL на каталог как soft 404, а реальных старых slug, которых нет в карте, не найдено.

## 4. Baseline

`seo-audit/baseline/prod/` и `seo-audit/baseline/local/` (скрипт `seo-audit/crawl.js`, без выполнения JS): `pages.csv`/`pages.json` (статус, title, description, canonical, H1, слова, noindex, JSON-LD, og:image, картинки без alt/размеров/lazy), `old-urls.csv`, `links.csv`, `summary.txt`, копия sitemap. Сравнение `node seo-audit/compare.js baseline/prod baseline/local`: **0 отличий**, локальная сборка пригодна как эталон для всех следующих фаз.

Итог по проду: 92/92 страниц 200, canonical совпадает с URL, по одному H1, title ≤ 60 и description ≤ 158 везде, дублей title/description нет, noindex нет, 749 внутренних ссылок и ассетов отвечают 200 напрямую (ссылок на старые адреса в HTML нет).

## 5. Что уже сделано на проде из фазы 1 (делать не нужно)

1.1 sitemap генерируется из данных, lastmod настоящий; 1.2 серверные 301 без цепочек; 1.5 JSON-LD есть: главная `TravelAgency` (+`FAQPage`), тур `TouristTrip` + `BreadcrumbList` + `FAQPage` (+ `AggregateOffer` только при цене), статья `BlogPosting` + `BreadcrumbList`; 1.7 уникальные title/description, один H1, alt у всех картинок.

## 6. Реальные проблемы (в фазу 1)

1. **«Sights visited» (1.3).** Причина найдена: поле `places[]` сгенерировано скриптом `scripts/build-places.js` из заголовков дней и с тех пор не пересчитывалось, а маршруты переписывались. На `song-kul-horse-trek-3-days` в `places` стоит «Lake Issyk-Kul», хотя ни один день его не упоминает. Предварительная проверка по всем 79 турам: 362 достопримечательности, 24 подозрительных (в основном «Karakol» и «Bokonbayevo», которые есть в маршруте, но не названы в тексте). Полная таблица будет в `sights-mismatch.csv`.
2. **Дубли на странице тура (1.4).** В HTML одновременно мобильные вкладки и настольные секции: summary 3 раза (hero, вкладка Description, JSON-LD), хайлайты 2 раза, список «включено» 2 раза, факты (pace, season, starts in) 3 раза. «What to pack» и «Before you go» одинаковые на всех 79 турах (меняются только 3 пункта по тегу).
3. **Sitemap:** лишние `changefreq`/`priority`; `lastmod` служебных страниц берётся из mtime файла шаблона на сервере (после `git reset` это дата деплоя).
4. **Главная:** 4 карточки «must-see places» ведут на `/tours/`; нет `WebSite` в JSON-LD; `sameAs` только Instagram.
5. **Картинки:** ни у одной из 1406 нет `width`/`height` (CLS); 100 без `loading="lazy"` (hero и первые фото, частично оправдано). AVIF/WebP уже отдаются сервером по Accept.
6. **Внутренние ссылки:** в телах статей ссылки записаны как `tour.html?slug=` и переписываются при рендере (`cleanHref`), на выходе чисто, но данные лучше привести к каноническим. Из туров на статьи ссылок нет (кроме JS-блока). `blurb` и `summary` у всех 79 туров разные, дублей текста между турами нет.
7. **Email** `azatbeyshenaliev1@gmail.com` захардкожен в 4 местах (`nav.js`, `index.html`, `contact.html`, `lib/text-pages.js`) и в JSON-LD главной. Фаза 2.
8. **Отзывы:** блок «What guests say» в HTML пустой, скрывается JS при отсутствии отзывов. Фаза 2.
9. **Cars:** `/cars/` появится в sitemap и меню с первой опубликованной машиной (код уже есть). В задании раздел не упомянут.

## 7. Риски

- Push в `main` = немедленный прод. Все коммиты только в `seo-fixes`, мерж и push только по вашей команде.
- `content/*.json` живёт на сервере, правки контента через бота. Любая правка данных (места, ссылки, цены) должна идти миграцией в `scripts/migrate.js`, иначе первая правка в боте её затрёт.
- Два `.html`-шаблона (`tour.html`, `post.html`) одновременно обслуживают и мобильную, и настольную раскладку: убирая дубли, нужно сохранить обе (CSS `.about-mobile`/`.about-desktop`).

## 8. Вопросы

1. Неизвестный `tour.html?slug=`: оставить честный 404 (моя рекомендация) или сделать 301 на `/tours/`, как в задании?
2. Подтвердить единственный medium-редирект: `elena-tabers-tour-7-days` → `kyzyl-oi-song-kul-chong-kemin-8-days`.
3. Два 11-дневных тура с canonical на 12-дневные: оставить как есть (страницы живут, в sitemap нет) или вернуть в индекс как отдельные? Это пересекается с фазой 3 (каннибализация).
4. Какие профили кроме Instagram добавить в `sameAs` (TripAdvisor, Google Business, GetYourGuide, Facebook, YouTube)? Нужны URL.
5. Локальный `content/` я довёл до прода (41 тур). Файлы `public/tours-data.js` и `builder-data.js` при этом пересобрались, в коммит фазы 0 не вошли. Коммитить их в фазе 1 вместе с кодом?

## Как проверить самому

```bash
node seo-audit/crawl.js https://azattours.com seo-audit/baseline/prod-check
node seo-audit/compare.js seo-audit/baseline/prod seo-audit/baseline/prod-check
```
