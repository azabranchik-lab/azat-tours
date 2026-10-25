# Фаза 2. Доверие и конверсия (пакет D), 2026-10-25

Ветка `seo-fixes`. Инфраструктура готова, контент за вами: отзывы, ссылки на профили, цены. Везде, где данных нет,
на сайте ничего не показывается (ни пустых блоков, ни заглушек).

## 1. Отзывы

**Где живут данные.** В проекте источник контента это `content/*.json` на сервере, которые правит бот, поэтому
отзывы лежат в `content/reviews.json` (а не в `data/`, как в брифе), чтобы бот и сайт читали одно и то же.
Поля отзыва: `name`, `country`, `date` (2026-07 или 2026-07-14), `tourSlug`, `text`, `source`
(tripadvisor | google | getyourguide | direct), `sourceUrl`, `rating`, `placement` (home | reviews | tour:<slug>), `avatar`.

**Как добавить отзывы** (любой из двух способов):
1. Бот: ⭐ Reviews → ➕ New review (имя → страна → текст → оценка → фото или skip), затем Edit → Date / Tour (slug) /
   Source / Source link; «📍 Where shown» выбирает главную, страницу отзывов или тур.
2. Файлом: заполнить `seo-audit/reviews-template.csv` (одна строка = один отзыв, текст дословно как написал гость)
   и выполнить на сервере `node scripts/import-reviews.js reviews.csv` (`--dry` показывает, что добавится;
   повторный запуск ничего не дублирует).

**Что рендерится в HTML** (сервер, без JS, `lib/reviews.js`):
- Главная, блок «What guests say»: отзывы с `placement: home`; под каруселью бейджи профилей. Нет отзывов → всей
  секции нет в HTML (раньше пустой блок прятал JS).
- Страница тура: новая секция «What guests say about this tour» перед вопросами, для отзывов с `tourSlug`
  этого тура или `placement: tour:<slug>`; без отзывов секции нет.
- `/reviews.html`: все отзывы, бейджи, кнопки «Review us on …». Пока отзывов нет, страница остаётся `noindex`
  и вне sitemap; с первым отзывом становится индексируемой и попадает в sitemap (добавлены canonical и `<main>`).
- Карточка: звёзды из `rating`, текст, имя, «Germany · July 2026 · on Tripadvisor» (ссылка на оригинал, если есть
  `sourceUrl`). Фото гостя только если оно загружено на сайт; стоковых аватаров больше нет (бот подставлял
  картинку с Unsplash, убрано).

**Бейджи платформ.** Ссылки хранятся в `content/site.json` → `profiles.tripadvisor / google / getyourguide`.
Задаются в боте: 🏠 Homepage photos → ⭐ Review profiles (links). Бейдж появляется только для заданной ссылки,
без оценок и количества отзывов (этих данных у нас нет). `TODO(owner)`: прислать три ссылки.

**Найдено и исправлено по пути.** На `/reviews.html` стояли выдуманные цифры: «4.9 · 128 reviews», «96 reviews»,
«2,400+ travellers since 2009», «98% recommend», текст «We've hosted over 2,400 travellers from 40+ countries».
Страница была `noindex`, но отдавалась по прямому адресу. Всё убрано, остался честный текст.

**Разметка Review/AggregateRating** не добавлялась (бриф 1.5). Когда появятся настоящие отзывы, можно обсудить
`review` внутри `TouristTrip`; для `TravelAgency` Google такие самоопубликованные отзывы в rich results не берёт.

## 2. Цены «from»

- Поле `priceFrom` уже было (32 тура с ценой); добавлено `priceNote` («per person, group of 4, high season»).
  Показывается в блоке цены на странице тура, в ответе FAQ «How much does it cost?», в `.md`/`llms.txt` и в
  `priceSpecification.description` JSON-LD. Без заметки текст прежний: «per person. The exact price depends on
  group size and season».
- Бот: в редактировании тура появилось поле «Price note».
- **Для вас:** `seo-audit/prices-todo.csv`, 47 туров без цены (slug, название, категория, дни; заполнить
  `priceFrom` целым числом USD и при желании `priceNote`). Применить: `node scripts/import-prices.js prices.csv --dry`,
  затем без `--dry` на сервере (или я заверну файл в миграцию, когда пришлёте).
- Цен я не придумывал: все 47 остаются «On request».

## 3. Email

- Единое место: `lib/contact.js` (`email`, `phone`, `whatsapp`, `instagram`, `city`). Шаблоны и футер содержат
  `{{CONTACT_EMAIL}}`, сервер подставляет адрес при рендере; `llms.txt` и JSON-LD главной читают оттуда же.
- Сейчас по-прежнему `azatbeyshenaliev1@gmail.com`. Смена на `hello@azattours.com` = одна строка в `lib/contact.js`
  и деплой, после того как ящик создан и проверен.
- Телефон/WhatsApp по-прежнему захардкожены в 13 файлах (бриф просил только email); вынести так же, если
  понадобится менять номер.

## Проверено
- `npm test`: 28/28 (новые `tests/reviews.test.js`: секции только при наличии отзывов, бейджи только по заданным
  ссылкам, экранирование, noindex до первого отзыва, даты).
- Локально с двумя тестовыми отзывами (помечены TEST, удалены после проверки) и тестовыми ссылками профилей:
  главная, страница тура и `/reviews.html` показывают карточки и бейджи, `check-site` «All good» (93 URL, включая
  `/reviews.html`), консоль чистая, 375 и 1280. Без отзывов: секций нет, `/reviews.html` noindex, sitemap 92 URL.
- `node scripts/import-prices.js --dry` на тестовом CSV: меняет цену и заметку, неизвестный slug отклоняет.
- Бот: синтаксис проверен (`node --check`), живьём не запускался (один токен на прод).

## Деплой-нюансы
- Новые поля отзывов и `priceNote` сохраняются ботом как есть (он не затирает незнакомые поля).
- `public/reviews-render.js` удалён, `reviews-data.js` больше не подключается страницами (генерируется по-прежнему).

## Вопросы и что нужно от вас
1. Ссылки на профили TripAdvisor, Google Business, GetYourGuide (и любые другие для `sameAs`).
2. Отзывы: через бота или CSV? Если CSV, шаблон в `seo-audit/reviews-template.csv`.
3. Цены: заполненный `seo-audit/prices-todo.csv` (можно частично).
4. Email: подтвердите, когда ящик `hello@azattours.com` создан, тогда поменяю.
