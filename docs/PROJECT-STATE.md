# Azat Tours — состояние проекта (передача дел)

Этот файл — чтобы в **новом чате** мгновенно продолжить работу. Покажи ассистенту папку
`C:\Users\user\kyrgyzstan-tours` и этот файл — он подхватит контекст.

## СТАТУС: проект РАЗВЁРНУТ на VPS (сайт + бот работают онлайн)
- Источник правды для **кода/дизайна** — локальная папка `C:\Users\user\kyrgyzstan-tours`. Правим здесь, потом обновляем сервер.
- Источник правды для **контента** (туры, блог, отзывы, гиды, фото, заявки, чаты) — **сервер**:
  владелец редактирует его через Telegram-бота вживую. Эти файлы (`content/*.json`, `images/`)
  на сервере новее локальных — поэтому при обновлении сервера их НЕ трогаем.

## Как продолжить в НОВОМ чате
1. Открой новый чат Claude Code на этом же компьютере (доступ к той же папке).
2. Первое сообщение: «Продолжаем проект Azat Tours, прочитай `PROJECT-STATE.md` в `C:\Users\user\kyrgyzstan-tours`».
3. Скажи, что нужно: правка кода/дизайна (→ переразвернуть) или контент (→ через бота, без деплоя).

## Как выкатить изменения кода на сервер (после правок локально)
1. Пересобрать архив, ИСКЛЮЧАЯ серверные данные:
   `tar --exclude=kyrgyzstan-tours/node_modules --exclude=kyrgyzstan-tours/config.json --exclude=kyrgyzstan-tours/content --exclude=kyrgyzstan-tours/images -czf alatoo-update.tar.gz kyrgyzstan-tours`
2. Передать другу/на сервер, распаковать поверх (content/ и images/ на сервере сохранятся).
3. На сервере: `npm install` (если менялись зависимости) → `pm2 restart alatoo`.
- Бот работает только на сервере. Локально его НЕ запускать с тем же токеном (конфликт polling).
- Для локального предпросмотра дизайна достаточно `node server.js` (сайт без бота).

> ⚠️ **Разделы НИЖЕ (карта-POC, ребрендинг и т.д.) частично ИСТОРИЧЕСКИЕ.** Актуальное состояние —
> в разделе **«Сессия 2026-06-25»** сразу под этим блоком. Читать его первым.

---

## Сессия 2026-06-25 (продолжение) — мобилка + ВСЕ туры обогащены

- **Все 39 туров доведены до богатого формата** (раньше — только `best-of-kyrgyzstan-10-days`).
  Каждый день: `desc[]` (абзацы, голос бренда, пересказ с kyrgyzriders — НЕ копипаст), `transfer`,
  `activity`, `meals`, `overnight`, `wc`, `internet`. 265 дней суммарно. Делалось так:
  субагенты фетчили KR + переписывали → по файлу `scripts/_itin/<slug>.json` на тур →
  `node scripts/merge-itineraries.js` сливает их в `content/tours.json` и пересобирает `tours-data.js`.
  - **`scripts/merge-itineraries.js`** — идемпотентный, читает `scripts/_itin/*.json` (массив дней или
    `{itinerary,gallery}`), заменяет ТОЛЬКО `itinerary` тура по слагу, остальные поля не трогает. `--dry` для прогона.
  - **`scripts/_itin/*.json`** — единственный воспроизводимый источник этого обогащения в git
    (т.к. `content/tours.json` в .gitignore). НЕ удалять: на сервере туры обновляются заливкой
    `content/tours.json` ИЛИ повторным прогоном merge (бот итинерарий не редактирует).
  - Конвенция написания (важно для единообразия): БЕЗ умлаутов — `Song-Kol`, `Ysyk-Kol`, `Ala-Kol`,
    `Kel-Suu`. Форматы: `transfer "220 km · 5–6 h"` (разбивка asphalt/dirt УБРАНА — см. тур-редизайн ниже), `activity "Horse riding · 21 km · 4–5 h"`
    (рендер `tour-detail.js` делит по ` · ` — значение activity без `·` даст дубль метки, избегать).
- **Мобилка — фикс перекрытия футера:** фикс-бар внизу (`.mobile-cta` на обычных стр., `.tour-buybar`
  на тур-стр.) накрывал нижнюю строку футера. Добавлен scoped-отступ `body:has(.mobile-cta),
  body:has(.tour-buybar){padding-bottom:84px}` в `styles.css` (блок `@media max-width:680px`, ~стр.1007).
  builder.html и десктоп не затронуты. Остальная мобильная вёрстка проверена (9 страниц) — чисто.
  - ⚠️ Превью-рендерер (preview) НЕ отрисовывает кадры: скриншоты таймаутят, CSS-transition «застывает»
    на старте (меню/шторка кажутся не открытыми) — это артефакт, проверять computed-стиль с `transition:none`.

### Тур-страница — мобильный редизайн (нативнее, меньше скролла)
- **Hero:** убран абзац `summary` из героя (на ВСЕХ ширинах) — он перекрывал фото. Остались заголовок +
  бейджи + factbar. `summary` переехал во вкладку Description (открыта по умолчанию).
- **Вкладки «About this tour»** (заменили «Why you'll love» + «Good to know»): Description / Additional info /
  What to pack / Before you go. На мобиле tabbar — горизонтальный свайп-ряд. Контент:
  - Description = `summary` + реальные `highlights` (фолбэк «день=заголовок» УБРАН — была дубляция с итинерарием).
  - Additional info = существующие поля (pace/season/start/total_drive/accommodations/activities) + фикс-инклюзии.
  - What to pack / Before you go = свой текст (пересказ с KR), константы `PACK_BASE`/`PACK_BY_TAG`/`BEFORE`
    вверху `tour-detail.js`. Packing варьируется по `tags` (trekking/horseback/road-trip/winter).
  - ⚠️ Вкладки НЕ используют класс `.chip` — у него висит обработчик фильтра каталога из `script.js`
    (ловит `.chip`, падает на `.split`). Свой класс `.tour-tabs .tab`.
- **Sights carousel** («Sights visited on this tour», после итинерария): из `t.places` (или `t.route` для
  10-days). Данные — `SIGHTS` (карта в `tour-detail.js`, источник `scripts/_sights.json`): фото + блёрб на
  ~22 места. Нормализация имени `normSight()` → ключ. Нет фото → фолбэк на фото тура. Дедуп по ключу.
  ⚠️ **Фото — с kyrgyzriders (временные плейсхолдеры), заменить на свои/лицензированные перед продом.**
- **Убрана разбивка `(asphalt X / dirt Y)`** из всех `transfer` — `scripts/strip-transfer-detail.js`
  (чистит `_itin/*.json` + `content/tours.json`, регенерит `tours-data.js`). Идемпотентно.
- Источники данных вкладок/мест: `scripts/_sights.json`, `scripts/_tabs.json` (НЕ удалять — это источник;
  при правке нужно пере-вставить в константы `tour-detail.js`). Порядок секций: hero → вкладки →
  итинерарий → sights → галерея → форма → related.

### Тур-страница — раунд 2 (правки по фидбэку владельца)
- **Highlights ≤4 и куратор:** `tour-detail.js` режет `.slice(0,4)`; контент `highlights` в `content/tours.json`
  прорежен до ≤4 самых отличительных на тур (выкинут общий boilerplate). Источник: `scripts/_highlights.json`
  (от субагента) → влит в tours.json → регенерил `tours-data.js`. Распределение: 22 тура по 3, 16 по 4, 1 пустой.
- **Бронь-секция упрощена:** убрана боковая панель `.book-side` (цена/преимущества/Telegram). Форма на всю
  ширину (`max-width:640px`). Под кнопкой **Send enquiry** (без стрелки) — ссылка `.form-wa` «Message us on
  WhatsApp» (per-tour текст). Telegram со страницы тура убран.
- **Убран липкий нижний бар** `.tour-buybar` из `tour.html` И `tour-ala-kul.html` (по просьбе). Поэтому
  `body:has(.tour-buybar)` на тур-страницах больше не срабатывает — отступ не нужен, футер виден полностью.
- **Пустота над футером:** `.tour-main > section:last-child` обнулён по bottom; на мобиле `.tour-page .pad{padding-bottom:32px}`.
  ⚠️ Была попутно баг: лишний `</div>` в бронь-секции выкидывал related-секцию из `.tour-main` — починено.
- **Стрелки `→` убраны** только в двух местах: кнопка Send enquiry и hero «Build your trip» (`index.html`).
  (По сайту ещё ~10 кнопок со стрелками — не трогал, ждут отдельной просьбы.)
- **Sights теперь редактируются из бота** (фото + описание): данные переехали из хардкода в
  `content/sights.json` → `sights-data.js` (`window.SIGHTS`), грузится в `tour.html` ПЕРЕД `tour-detail.js`;
  `tour-detail.js` читает `window.SIGHTS||{}`. `lib/content.js`: `loadSights/saveSights/regenerateSights`
  (+ `images/sights/`). Сид: `scripts/seed-sights.js` (из `scripts/_sights.json`, идемпотентно). Бот: команда
  **`/sights`** → список мест → «Replace photo» (session `sightphoto`) / «Edit description» (session `sightblurb`);
  `downloadPhoto(...,'sights',key,1)` → `images/sights/`. ⚠️ Деплой как у туров: `content/sights.json` в .gitignore —
  на сервере прогнать `node scripts/seed-sights.js` (или залить файл) ОДИН раз, иначе правки бота стартуют с пустого.
  Фото в сиде — плейсхолдеры kyrgyzriders (заменить своими через `/sights`).

### Тур-страница — раунд 3 (финишная полировка)
- **Hero компактнее:** на мобиле `.tour-hero` `min-height:50vh`, `padding 92/26`, заголовок `1.85rem/1.12`,
  factbar плотнее (`1.05rem`), **breadcrumb скрыт** (`.tour-hero .crumb{display:none}`). Высота 710→~450px
  (длинный заголовок) / ~406px (короткий). Тот же эффект на `tour-ala-kul.html` (у неё `.sub` оставлен).
- **WhatsApp-ссылка** под формой: текст теперь просто «WhatsApp».
- **«Other tours you might like»** — отступ заголовка до карточек 18→28px (`.related-tours h2`).
- **Чат-кнопка** (`.chat-fab`) на тур-страницах опущена в `bottom:24px` (нижнего бара больше нет;
  на других страницах остаётся 84px над `.mobile-cta`).
- **Удалён мёртвый CSS** после правок: `.tour-buybar*`, `.book-grid/.book-side/.book-price/.book-contact`,
  `.tour-page .float-wa`, селектор `body:has(.tour-buybar)`; в `tour-detail.js` убран пустой `reviewsHTML`.
  ОСТАВЛЕНО (используется): `.book-perks` (вкладки), `.tour-hero .sub` и `.bk-h` (нужны `tour-ala-kul.html`).
- Проверены все 10 страниц на мобиле (375px): горизонтального оверфлоу нет, ошибок в консоли нет.

### ⚠️ ПРИНЦИП: мобилка и ПК — раздельно (раунд 4)
Владелец: **правки мобилки НЕ должны менять ПК-версию.** Если правка должна отличаться по ширине —
разводить через `@media(max-width:680px)`, НЕ трогая базовые (десктопные) правила и разметку, которую
видит десктоп. Базовые CSS-правила = десктоп; мобильные оверрайды = только внутри `@media`.

**Тур-страница теперь РАЗВЕДЕНА по вьюпортам (≤680 = мобилка, >680 = десктоп):**
- **Десктоп вернул прежний вид:** hero С описанием (`.tour-hero .sub`); вместо вкладок — две развёрнутые
  секции «Why you'll love» + «Good to know» (`.about-desktop`); бронь 2-колоночная с боковой панелью
  `.book-side` (цена On request + преимущества + WhatsApp/Telegram).
- **Мобилка без изменений:** компактный hero без описания (описание во вкладке Description), вкладки
  (`.tour-tabs.about-mobile`), форма на всю ширину + ссылка `.form-wa`, sidebar скрыт.
- Механика: в `tour-detail.js` рендерятся ОБА варианта (вкладки И секции; одна `#leadForm` — НЕ дублировать
  форму), переключение в `styles.css`: база `.about-mobile{display:none}` / `.form-wa{display:none}`;
  `@media(max-width:680px)` показывает мобильные и прячет `.about-desktop/.book-side/.tour-hero .sub`.
  `.book-grid` стекается в 1 колонку при `≤820px`.
- **Контентные правки оставлены везде** (это не вёрстка): без стрелок `→`, highlights ≤4, sights через бота,
  без asphalt/dirt. Sights-карусель оставлена и на десктопе (это новая фича с бот-управлением).
- ⚠️ Известный ПРЕЖНИЙ баг (не из этих правок): на ~700px шапка `.nav-links`+CTA чуть вылезает (десктоп-меню
  широкое для узкого окна). Тур-контент на 700px без оверфлоу. Чинить отдельно, если надо.

### Раунд 5 — чистка текста (по просьбе владельца)
- **Telegram убран** со всего публичного сайта (моб+ПК): contact.html (карточка + meta), index.html (кнопка),
  nav.js (футер «WhatsApp / Telegram» → «WhatsApp»), tour-detail.js (бронь-сайдбар). Остался только WhatsApp.
  (`bot.js`/`server.js`/`chat.js`-комменты — это бэкенд/админка, НЕ публичный сайт, не трогал.)
- **Стрелки `→` убраны** со всех кнопок/CTA (25 шт.) + SVG `.cta-arrow` («View details») в `tour-detail.js`
  и `tours-render.js` (константы → ''). Маршрутная стрелка в дне tour-ala-kul → «to».
- **Длинные тире убраны из текста** (em `—` → запятая, en `–` → дефис; + html-сущности) — 1014 замен в 56 файлах:
  `content/*.json` (+ регенерированы ВСЕ `*-data.js`), `scripts/_itin/*.json` и `_sights/_tabs/_highlights.json`
  (источники, чтобы re-merge не вернул тире), все HTML + UI-JS. Названия туров: «BEST OF KYRGYZSTAN - 12 DAYS»
  (en→дефис), transfer «4-5 h», title «… , Kyrgyzstan Tour». ⚠️ НЕ трогал dev-скрипты `build-tours.js`,
  `scripts/deemoji.js` (не грузятся сайтом; в `build-tours.js` тире в регэкспах парсера — не ломать) и `bot.js`.
  Если будешь обновлять контент сидами/парсером — там тире могут вернуться (прогнать замену ещё раз).
- Проверено в превью (tour/contact/home): тире=0, Telegram=нет, стрелок=нет, ошибок в консоли нет.

### Раунд 6 — десктоп-каталог tours.html: БОКОВАЯ панель фильтров (финальный вариант)
ТОЛЬКО десктоп + ТОЛЬКО каталог (`@media(min-width:681px)` + `body[data-page="tours"]`). Мобильный каталог
(свайп-ряд `#filterBar`, кнопка `.mfilter-btn`, шторка `.filter-sheet`) НЕ тронут. Владелец выбрал слева-сайдбар
(а не верхнюю липкую полосу — тот промежуточный вариант был ОТКАЧЕН).
- **Компактнее hero:** `.page-hero` 170/70 → 104/40 (высота 460→364px); `.pad{padding-top:34px}`.
- **Левый липкий сайдбар фильтров** (`tours.html`: `.catalog` = `aside.filter-rail#filterRail` + `.catalog-main`):
  - `tours-render.js` строит `#filterRail` — группы **Type** (категории, single, `.frow.cat` `data-f`) +
    **Activity/Duration/Season** (теги, multi, `.frow.tag` `data-t`, чекбоксы) + «Clear all» (`[data-clear]`).
  - Переиспользован весь существующий движок: `activeCat/activeTags`, `applyFilters/syncUI`, делегированный
    обработчик (селектор теперь `#filterRail, #filterBar, #filterSheet`; `[data-clear]` обрабатывается там же),
    deep-link `?cat=`. `syncUI` доп. пишет живой счётчик в `#tourCount`. `setCat` скроллит к сетке ТОЛЬКО на
    мобиле (`innerWidth<=680`).
  - CSS (desktop): `.catalog{grid-template-columns:248px 1fr}`, `.filter-rail{position:sticky;top:88px;…}`,
    `.frow`/`.frail-*`, сетка `.catalog-main .tours-grid{repeat(auto-fill,minmax(240px,1fr))}` (2–3 кол),
    `#filterBar{display:none}` на десктопе. База: `.catalog{display:block}`, `.filter-rail{display:none}` (мобилка).
  - ОТКАЧЕНО из промежуточного варианта: `.filter-zone` (обёртка), верхняя липкая зона, `#tagBar`, правило 4-кол.
- Проверено в превью: десктоп — сайдбар sticky, Type(одиночный)+теги(чекбоксы) фильтруют, живой счётчик
  «N tours», Clear all, тёмная тема ок; мобилка (375) — каталог без изменений (свайп+шторка работают), 0 оверфлоу;
  главная/тур не задеты; ошибок в консоли нет. (Скрин не делал — превью-рендерер не рисует, проверял через DOM.)

### Деплой-нюанс данных (ВАЖНО, легко упустить)
Сайт читает сгенерированные `*-data.js` (они в git и попадают в tar → новый контент виден сразу).
НО `content/*.json` — в .gitignore и исключены из tar. На сервере свои `content/*.json`. Поэтому,
чтобы новые **теги туров, 6 статей блога, site.json, очищенные отзывы** ПЕРЕЖИЛИ правки через бота
(бот пересобирает `*-data.js` из серверного `content/*.json`), нужно при деплое **также залить на
сервер** обновлённые `content/tours.json`, `content/posts.json`, `content/site.json`,
`content/reviews.json` (или прогнать там сид-скрипты). Иначе первая же правка в боте откатит их.

### Архитектура — что добавилось
- **`nav.js`** — общий партиал: шапка + мобильное меню + футер + плавающие кнопки инжектятся на КАЖДОЙ
  странице по `<body data-page="home|tours|tour|tour-alakul|about|blog|post|contact|reviews|plan">`.
  Дублированный chrome из всех HTML удалён. Правки nav/футера/CTA — теперь в ОДНОМ месте (`nav.js`).
  `builder.html` — со своим топ-баром, `nav.js` не подключает.
- **`window.SITE`** (`content/site.json`→`site-data.js`, функции в `lib/content.js`) — медиа главной,
  управляемые ботом: Instagram (url+фото), фото Experience-карточек, hero, builder-тизер. `home-media.js`
  подменяет хардкод из SITE (graceful fallback). Сидер `scripts/seed-site.js`.
- **Теги туров** — `tags[]` у всех 39 туров: активность (`trekking/horseback/road-trip/off-road`),
  длительность (`short/week/long`), сезон (`summer/winter/all-year`). Генератор `scripts/build-tags.js`
  (идемпотентный). В каталоге фильтр = категории + теги; на МОБИЛЕ — свайп-ряд категорий + **bottom-sheet**
  с тегами (`tours-render.js`). Бот правит теги: `/tours` → Edit → Tags.
- **6 новых статей блога** (`real-local-guides, tailor-made-trips, safety-in-the-mountains,
  community-tourism, easy-from-abroad, fair-honest-pricing`) — `scripts/add-why-posts.js`. 6 «about/why»-
  карточек на главной ведут на эти статьи.

### Карта на тур-странице — УДАЛЕНА
Stops-карту (Leaflet/CARTO) собрали, потом по просьбе владельца **убрали**. В `tour.html` карты НЕТ,
Leaflet-CDN убран, CSS карты убран. Поле `places[]` (и старые `route`/`route_segments`) остались в
данных туров как **мёртвый груз** (не используются). Разделы про карту НИЖЕ — историчны.

### Главная — редизайн (по логике конкурента kyrgyzriders, в нашем бренде; mobile-first)
Новый порядок: Hero → Featured → Experiences → **About+фаундер** → **Top places** → How it works →
**Reviews (скрыты пока пусто)** → Instagram → FAQ → Lead.
- **Hero:** кнопки **Build your trip** (→`builder.html`) + **Browse tours**; eyebrow убран; на мобиле
  видна только Build-your-trip, scroll-подсказка скрыта («Tours» — в нижнем баре).
- **Убрана** отдельная Builder-промо секция (CTA уехал в герой). ⚠️ Поэтому `SITE.builder` и пункт бота
  «Builder photos» теперь **осиротели** (редактируют неиспользуемые данные — можно убрать позже).
- Бывший «Why us» → блок **About + фаундер** (Azat=free, с 2019) + карточки-ценности (ведут на 6 статей)
  + ссылка «About us».
- Новая секция **Top places (Sights)**: Song-Köl, Kel-Suu, Issyk-Köl, Tash Rabat (десктоп 4 кол / моб.
  карусель); ссылки → `tours.html` (заглушка).
- Новая секция **Reviews** (`#revTrack`, рендер `reviews-render.js` + карусель в `script.js`, placement
  `home`) — **скрывается если отзывов нет**. **13 фейковых seeded-отзывов очищены** (честность) →
  `reviews-data.js` = `[]`. Владелец добавит реальные через бота `/addreview` — секция появится сама.
- Featured-туры, Experiences, Top places — на мобиле свайп-карусели.

### Мобилка — нативный слой (в конце `styles.css`, `@media max-width:680px`)
Карточки туров/блога → компактная строка-список; фильтр-шторка каталога; карусели; фиксы брейкпоинтов
(blog-featured / about-team / builder-опции → 1 колонка); кнопки героя в столбик; паддинги форм и т.д.
**Память:** мобилку проектировать нативно, не копировать десктоп (см. memory `mobile-native-design`).

### Бэкенд (`server.js`)
- API защищён: per-IP rate-limit (lead 5/10мин, chat 30/10мин → 429), whitelist+капы длины,
  валидация email (400 `bad_email`), лимит тела 20КБ (413), **wildcard-CORS убран**.
- Статика: Cache-Control (картинки 7д; html/js/css/data `no-cache`), ETag/304, gzip.
- ⚠️ `*-data.js` НЕ добавлены в .gitignore — они единственная копия данных в git (т.к. `content/` игнорится).

### Бот (`bot.js`)
- **`/home`** — медиа главной (Instagram фото+ссылка, Experience 5 слотов, Hero, Builder 4 слота —
  Builder-слот теперь осиротел).
- **`setMyCommands`** (тапаемое «/»-меню), inline-кнопки на `/start` + `/menu`, колбэки `m:leads`/`m:chats`,
  **`drop_pending_updates:true`** (чинит медленный `/start`).

### Что владелец может менять САМ через бота (без разработчика)
Туры (тексты, поля, **теги**, фото), статьи блога (текст, обложка, галерея), гиды, отзывы (+ где
показывать), **медиа главной** (фото Instagram/hero/experience + ссылка IG), заявки/чаты.
**Захардкожено (нужен разработчик):** все заголовки/копи секций, текст hero, текст About/фаундера, FAQ,
Top places, пункты меню, вопросы билдера, футер.

### Осталось / следующее
- **ДЕПЛОЙ** (у владельца есть домен и свой сервер; заливать будет друг). Нужно: реальный домен (заменить
  заглушку `azattours.travel` в ~12 файлах: `*.html`/`sitemap.xml`/`robots.txt`/email/IG), IP+SSH (у друга),
  nginx+SSL, `npm install`, `pm2 restart`. **Новый код бота надо задеплоить** — иначе нет `/home` и
  быстрого `/start`. + залить серверу `content/*.json` (см. «Деплой-нюанс данных» выше).
- Заменить плейсхолдер-фото (Unsplash) на **реальные фото Кыргызстана** (главная — через бота; туры/посты — бот).
- Реальные отзывы через бота (секция появится). About/фаундер + Top places — реальный текст/ссылки.
- **SEO-аудит не сделан** (откладывали). Вероятный главный пробел: `tour.html`/`post.html` имеют общий
  статический `<title>`/description на все туры/посты (per-item meta задаётся ли JS — проверить).
- Возможно ужать главную ещё (убрать Instagram/FAQ).
- Хелпер-скрипты: `scripts/seed-site.js`, `build-tags.js`, `build-places.js` (places не используются),
  `add-why-posts.js`.

### Git
В ЭТОЙ сессии НЕ коммитил — много несохранённых локальных правок. (Старый baseline `f520aa7`; бэкап-папка
`...-BACKUP-2026-06-19`.) Перед деплоем стоит закоммитить.

---

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

## Смысл бренда + фаундер (сделано позже, локально)
- **Azat = «свобода» по-кыргызски** И имя основателя — двойной смысл = ядро бренда. Слоган: **Feel free. Feel at home.**
- **About переписан под фаундер-историю** (от первого лица): hero `Azat means "free."`, блок «Meet the founder» (Azat водит туры **с 2019**, любит страну, хочет чтобы все чувствовали себя свободно и как дома), «Meet the team». **2019 — реальный год** (в отличие от старого фейкового 2009).
- **Миссия — blend**: свобода/чувство дома + забота о горах/людях (эко осталось в Values).
- Смысл «Azat = free» вынесен также на **главную** (hero eyebrow) и в **футер всех страниц** (blurb, + «since 2019»).
- Бренд-доки `BRAND.md` (секции 1–3) и `.agents/product-marketing-context.md` обновлены под свободу+фаундер.
- **Фото фаундера — плейсхолдер** (TODO в `about.html`), нужно реальное фото Azat.
- **Долг по доке:** `BRAND.md` секции 6–8 (примеры boilerplate/копи) ещё дофаундерные и содержат старые фейк-чипы (4.9/5, 40+ countries) — освежить под новый голос, когда дойдут руки. На живой сайт не влияет.

## Тур-страница: новый формат (POC) — 2026-06-20 (локально, НЕ задеплоено)
> ✅ **ОБНОВЛЕНО 2026-06-25:** богатый формат раскатан на ВСЕ 39 туров (см. раздел «Сессия 2026-06-25
> (продолжение)» выше). Текст ниже описывает исходный POC-образец `best-of-kyrgyzstan-10-days`.
> Карты в этом формате уже НЕТ (удалена) — `route`/`route_segments` не заполнялись для 38 новых туров.

**Образец POC:** `best-of-kyrgyzstan-10-days`. (Изначально остальные 38 были «тонкие» — день = только Meals; теперь обогащены.)

- **Макет** (`tour-detail.js`): **полная ширина, одна колонка**, правого сайдбара НЕТ. Постоянный CTA — кнопка «Request this tour» в **шапке** (`nav-cta`). *(Липкий под-бар пробовали — убрали как дубль шапки.)* Форма Request — на всю ширину, 2 колонки `.book-grid` (форма + `.book-side`: цена «On request», «Why book direct», WhatsApp/Telegram).
- **Итинерарий — поля дня:** `{day, title, desc:[абзацы], transfer, activity, meals, overnight, wc, internet}`. Рендер 2-колоночный (`.tl-body` → `.tl-desc` слева | `.tl-info` справа); пустые поля скрываются; рендер обратно-совместим (старый `desc` строкой тоже ок). Тексты взяты со страницы KR `kyrgyzriders.com/tours/<slug>/`.
- **Галерея + лайтбокс:** `.gallery` крупнее; **generic-лайтбокс в `script.js`** (клик по любой `.gallery a` → оверлей: стрелки `‹ ›`, клавиши ←/→/Esc, счётчик, lock-scroll). Работает на любой странице с `.gallery`.
- **Карта:** Leaflet (CDN добавлен в `tour.html`), тайлы **OpenTopoMap** (рельеф). Линия из **`t.route_segments`** = `[{road:bool, pts:[[lat,lng]…]}]` → белая обводка + сплошная бирюза для `road`, **пунктир** для off-road. Подписи из **`t.route`** = `[{lat,lng,name,dir}]` (именованные точки → постоянный tooltip `.map-label`; `dir`∈top/bottom/left/right разводит подписи). Старое плоское `route_path` удалено.
- **Related tours:** секция внизу, 3 карточки (зеркало карточки `.tour` из `tours-render.js`; приоритет — та же категория, текущий тур исключён).
- **Поля, добавленные в объект тура:** обогащённый `itinerary[]`, `route[]`, `route_segments[]`.

## Как наполнять туры (метод — ВАЖНО для продолжения)
Чтобы довести остальные 38 туров до этого формата:
1. **Тексты по дням** — со страницы конкурента `kyrgyzriders.com/tours/<slug>/` (через WebFetch: title, desc, Transfer, Horse riding/Trekking, Meals, Overnight+высота, WC, Internet).
2. **Геометрия по дорогам** — **OSRM**, по сегментам:
   `https://router.project-osrm.org/route/v1/driving/{lng,lat;lng,lat}?overview=full&geometries=geojson`.
   Для каждой пары соседних точек: если `dist_km < straight·2.2 + 15` → берём геометрию OSRM (`road:true`), иначе прямой отрезок (`road:false`) — так бездорожные отроги (Kel-Suu) не уводят крюком через Ош. Складываем в `route_segments`.
3. Делалось **разовыми node-скриптами** `scripts/_*-poc.js` (уже удалены): правили `content/tours.json`, затем `require('./lib/content').regenerateDataFile()` пересобирал `tours-data.js`.
4. **СЛЕДУЮЩИЙ ШАГ:** масштабировать на 38 туров — лучше **апгрейднуть парсер `build-tours.js`**, чтобы он сразу выдавал богатый `itinerary` + `route_segments`; либо повторять per-tour скрипт. **Бот итинерарий НЕ редактирует.**

## Data-flow / деплой данных туров (подводный камень)
- `content/tours.json` — **в .gitignore** (источник правды — сервер, и он исключён из tar-деплоя). В git закоммичен **сгенерированный `tours-data.js`** — именно его читает сайт; данные POC лежат там.
- Чтобы обогащённые туры попали **на сервер**: бот не поможет (нет редактирования итинерария) → либо разово залить `tours.json` на сервер, либо прогнать там парсер `build-tours.js`.

## UI / честность — пофикшено в этой сессии
- **Experiences-сетка на главной → 3+2** (5 карточек, без «сироты» на 3-м ряду).
- **Контраст:** заголовки итинерария, кнопка nav-CTA, бейджи языков/туров, карточки билдера — поправлены; добавлено глобальное `button{color:inherit}` (кнопки не наследовали цвет → текст пропадал в светлой теме).
- **`body{overflow-x:hidden}` → `overflow-x:clip`** — старое значение молча ломало `position:sticky` по всему сайту.
- **Анти-ИИ вычитка** About + главной (скилл `anti-ai-copywriting`).

## Известные заметки
- **Скриншоты в превью в этой сессии таймаутят** (рендерер) — проверять вид в реальном браузере, не через preview_screenshot.
- **OpenTopoMap** — волонтёрский сервер тайлов: для демо ок, для прода сменить на платный рельеф (Thunderforest Outdoors / Stadia) — это одна строка URL в `tour-detail.js`.
- Фото фаундера — плейсхолдер; отзывы скрыты до реальных; `BRAND.md` §6–8 устарели.
- **Картинка-карта KR `Map-10-days.png` — 404** (битая даже у них), не использовать.

## Git / откат (хендофф)
- Последний коммит: **`e9a0e98`**. Baseline до всех правок: **`f520aa7`**. Вся история сессии — в `git log` (≈18 коммитов).
- Бэкап-папка: `C:\Users\user\kyrgyzstan-tours-BACKUP-2026-06-19`.
- **Ничего не задеплоено** — всё локально в git. Откат: `git reset --hard f520aa7` или из папки-бэкапа.
