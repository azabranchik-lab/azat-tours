# Каннибализация туров: группы по интенту и предложения (фаза 3, только предложения)

79 опубликованных туров сгруппированы по поисковому запросу, на который они по сути отвечают. Для каждой группы:
какой тур становится **главной страницей** запроса, какие остаются **вариантами длительности** (отдельные страницы,
связанные блоком «Also available as» через поле `series`), какие **объединить с 301**, какие **оставить отдельно**
из-за реально другого маршрута. Slug'и не меняются, кроме явных 301.

Уверенность: **high** = видно по маршрутам в данных; **medium** = маршруты почти совпадают, но продукты могут
отличаться (частный тур из Бишкека с ценой против сборного от Kyzart без цены), решать вам.

Важная оговорка про пачку 2026: её туры «private, from Bishkek, from $X», а старые 38 «starts in Kyzart/Bishkek,
on request». Если это разные продукты (частный против сборного), объединять нельзя; тогда вместо 301 ставим
`canonical` на главную страницу запроса и различаем названия («Private, from Bishkek»). В таблицах это помечено.

## Сводка

| Группа | Запрос | Главная страница | Варианты | Объединить (301) | Оставить отдельно |
|---|---|---|---|---|---|
| A | kyrgyzstan road trip | kok-kiya-kel-suu-road-trip-8-days | 7, 9, 10, 12 дней | 11 → 12 (уже canonical) | talas backroads (группа J) |
| B | kyrgyzstan tour 10 days / best of kyrgyzstan | kyrgyzstan-grand-tour-10-days | 8, 9, 12 дней | 11 → 12 (уже canonical) | |
| C | song kul horse trek (2–4 дня) | song-kul-horse-trek-3-days | 2, 4 дня | 3 пары (medium) | |
| D | kyrgyzstan horse riding tour (Song-Kul + Issyk-Kul) | two-lakes-horse-trek-5-days | 6, 7 дней | circle-5 ↔ two-lakes-5 (medium) | 10-day to Ala-Kul |
| E | remote horse trek kyrgyzstan | kol-ukok-to-song-kul-horse-trek-7-days | | | Ichke-Tor 6, Mai-Tor 5 |
| F | horse riding and trekking tour kyrgyzstan | song-kul-horse-trek-ala-kul-hike-7-days | 5, 6, 8, 10 дней | | |
| G | kel-suu lake tour | kel-suu-lake-express-4-days | 5 дней | | song-kul-kel-suu-in-a-week-7 |
| H | issyk kul tour (2–5 дней) | issyk-kul-altyn-arashan-4-days | 2, 3, 5 дней | 3 пары (medium) | family-4, easy-week-7 |
| I | chong-kemin tour | burana-chong-kemin-cholpon-ata-2-days | 3 дня, day trip | konorchek-hike-chong-kemin-ride-2 (medium) | |
| J | kyrgyzstan off the beaten path | talas-to-issyk-kul-backroads-8-days | 7 дней | | |
| K | ala kul trek | karakol-peak-base-ala-kul-trek-4-days | | | ak-suu 5, full traverse 9 |
| L | kyrgyzstan winter tour | (страница-хаб «Kyrgyzstan in winter») | | | все 7 зимних |
| M | day trips from bishkek | (посадочная «Day trips from Bishkek») | | | 19 однодневок, 3 подгруппы с canonical |

Итого к объединению с 301: **8 пар**, все medium (ваше решение). После них 71 страница вместо 79, без потери ни одного
реального маршрута.

## Группы подробно

### A. «Kyrgyzstan road trip» (series `kyrgyzstan-ultimate-road-trip`, 6 туров)
Все шесть идут одной петлёй Song-Kul → Kel-Suu → Issyk-Kul → Altyn-Arashan, различаются днями.
- Главная: **kok-kiya-kel-suu-road-trip-8-days** (8 дней это самая типичная длина запроса «road trip», неделя плюс день).
- Варианты: 7 (overland), 9, 10 (с Chong-Kemin), 12 (grand). Каждый держит свой запрос с числом дней.
- 11 дней уже `canonical` → 12 (решение 2026-10-14), так и оставить, страница живёт.
- Все пять должны иметь одинаковый `series` (есть) и ссылку на главную в тексте («the 8-day version is our
  recommended length»).

### B. «Kyrgyzstan tour 10 days» / «best of Kyrgyzstan» (series `best-of-kyrgyzstan`, 5 туров)
Комбинированные: конный Song-Kul + 4x4 Kel-Suu + трек Ala-Kul/Altyn-Arashan.
- Главная: **kyrgyzstan-grand-tour-10-days** («our first and most-loved grand loop», уже featured на главной).
- Варианты: 8 (song-kul-kel-suu-altyn-arashan), 9 (kok-kiya), 12 (complete).
- 11 (tash-rabat-kel-suu-ala-kul) уже `canonical` → 12.

### C. «Song-Kul horse trek» 2–4 дня (9 туров: series `song-kol-lake-on-horseback` + 5 туров пачки 2026)
Самая каннибализированная группа: один и тот же маршрут Kyzart → Kilemche → Jalgyz-Karagai → Song-Kul → обратно
через перевал существует в двух редакциях.

| Пара | Старый тур (on request, старт Kyzart) | Тур 2026 (private, from Bishkek, цена) | Разница по данным | Предложение |
|---|---|---|---|---|
| C1 | song-kul-overnight-horse-trek-2-days | kara-kiya-pass-ride-to-song-kul-2-days ($520) | обратный перевал Tuz-Ashuu vs Kara-Kiya; трансфер из Бишкека включён | **Объединить** в `song-kul-overnight-horse-trek-2-days` (старый адрес, в индексе), перенести в него цену и трансфер; 301 с kara-kiya. medium |
| C2 | song-kul-horse-trek-3-days | song-kul-two-pass-loop-on-horseback-3-days ($650) | то же: Tuz-Ashuu vs Kara-Kiya | **Объединить** в `song-kul-horse-trek-3-days` (главная страница группы, ссылка с главной сайта); 301. medium |
| C3 | song-kul-shoreline-horse-trek-4-days | two-nights-at-song-kul-on-horseback-4-days (on request) | обе: две ночи у озера, береговой день | **Объединить** в `song-kul-shoreline-horse-trek-4-days`; 301. medium |

- Главная страница запроса «song kul horse trek»: **song-kul-horse-trek-3-days**. Варианты: 2 и 4 дня (series уже есть).
- Отдельно (другой маршрут): song-kul-on-horseback-issyk-kul-4-days и song-kul-ride-issyk-kul-circle-5-days
  (добавляют Иссык-Куль) → группа D; song-kul-yurt-night-by-car-horse-2-days (на машине, короткая прогулка верхом,
  запрос «Song-Kul 2 day tour from Bishkek») → группа H; winter-horse-trek-to-song-kul-3-days → группа L.
- Если продукты разные (сборный от Kyzart и частный из Бишкека), вместо 301: `canonical` 2026-го тура на старый и
  в названии 2026-го явно «Private, from Bishkek».

### D. «Kyrgyzstan horse riding tour» Song-Kul + Issyk-Kul, 4–10 дней (series `kyrgyzstan-horseback-riding-tour` + 2)
- Главная: **two-lakes-horse-trek-5-days** («horse riding tour Kyrgyzstan 5 days»). Варианты: 6 (west shore), 7 (Kok-Bulak).
- song-kul-on-horseback-issyk-kul-4-days (2026): добавить в `series` как вариант 4 дня (не дубликат: короче).
- song-kul-ride-issyk-kul-circle-5-days (2026) против two-lakes-horse-trek-5-days: оба 5 дней, Song-Kul верхом +
  Иссык-Куль; circle едет до Каракола. **Объединить (medium)** или оставить с canonical на two-lakes-5.
- song-kul-to-ala-kul-on-horseback-10-days: отдельный запрос «horse trek to Ala-Kul», оставить, но связать с группой F.

### E. «Remote / off the beaten path horse trek» (3 тура, три разных маршрута)
kol-ukok-to-song-kul-7, ichke-tor-lake-6, mai-tor-pastures-5. Маршруты разные, оставить все; главная для запроса
«remote horse trek Kyrgyzstan»: **kol-ukok-to-song-kul-horse-trek-7-days**; перекрёстные ссылки между тремя
(общий `series: remote-horse-treks`, чтобы «Also available as» показывал 5 · 6 · 7).

### F. «Horse riding + trekking» комбинации 5–10 дней (5 туров)
song-kul-ride-altyn-arashan-trek-5, kilemche-song-kul-altyn-arashan-6, song-kul-horse-trek-ala-kul-hike-7,
kyzyl-oi-song-kul-chong-kemin-8, slow-ride-trek-to-ala-kul-10. Сейчас три разных `series`.
- Главная: **song-kul-horse-trek-ala-kul-hike-7-days** («two signature trips back to back»).
- Варианты: 5, 6, 8, 10 → один общий `series: ride-and-trek`, чтобы блок вариантов показывал всю линейку.
- 5 и 6 отличаются одним днём (Kilemche): оставить обе, 6 как вариант.

### G. «Kel-Suu lake tour» (3 тура)
- Главная: **kel-suu-lake-express-4-days**. Вариант: kel-suu-issyk-kul-express-5-days (series есть).
- song-kul-kel-suu-in-a-week-7-days: конный Song-Kul + Kel-Suu, отдельный запрос «Kyrgyzstan in a week», оставить.
- Хаб `kel-suu` соберёт все 14 туров через озеро, это снимет давление с этой группы.

### H. «Issyk-Kul tour» 2–5 дней (14 туров, половина из пачки 2026)
Запрос широкий, дубликаты сильные.

| Пара | Старый | 2026 | Разница | Предложение |
|---|---|---|---|---|
| H1 | issyk-kul-karakol-canyons-3-days (всесезонный) | issyk-kul-shore-ride-eagles-boat-3-days ($1000) | обе: южный берег, каньоны, Каракол, юрта; 2026 добавляет лодку и орлов | **Объединить** в старый адрес, перенести цену и программу; 301. medium |
| H2 | issyk-kul-altyn-arashan-4-days | issyk-kul-full-circle-boat-ride-4-days ($1400) | обе: каньоны, Jeti-Oguz, Altyn-Arashan, северный берег | **Объединить** в старый адрес; 301. medium |
| H3 | issyk-kul-song-kul-weekend-3-days | song-kul-33-parrots-pass-express-3-days ($800) | обе: южный берег, орлы, Song-Kul; разные перевалы | **Объединить** в старый адрес; 301. medium |

- Главная для «Issyk-Kul tour»: **issyk-kul-altyn-arashan-4-days** («runs April to November», самая универсальная).
- Варианты по длине: issyk-kul-canyons-eagles-yurt-2 (2 дня), результат H1 (3 дня), issyk-kul-loop-via-chong-kemin-5
  или song-kul-issyk-kul-road-trip-5 (5 дней; это разные маршруты, оба остаются) → общий `series: issyk-kul-road-trips`.
- Отдельно: family-tour-lakes-eagles-yurts-4 (аудитория «family»), easy-week-7 («easy»), karakol-cholpon-ata-chong-kemin-4
  (другой порядок, Chong-Kemin), song-kul-yurts-eagles-karakol-4 (Song-Kul + Каракол), song-kul-yurt-night-by-car-horse-2
  («Song-Kul 2 days from Bishkek by car»).

### I. «Chong-Kemin tour» (4 тура)
- burana-chong-kemin-cholpon-ata-2 и konorchek-hike-chong-kemin-ride-2: обе ночь в Chong-Kemin с конной прогулкой,
  различие во втором дне (Cholpon-Ata vs Konorchek). **Объединить (medium)** в одну страницу «Chong-Kemin 2 days»
  с двумя вариантами второго дня в тексте, или оставить обе с общим `series: chong-kemin`.
- chong-kemin-eagle-show-lake-yurt-3: вариант 3 дня. chong-kemin-national-park-ride-day-trip: однодневный вариант.
- Главная: **burana-chong-kemin-cholpon-ata-2-days**.

### J. «Kyrgyzstan off the beaten path» Talas (2 тура, series `authentic-kyrgyzstan-road-trip`)
Главная: **talas-to-issyk-kul-backroads-8-days**, вариант 7 дней (без Иссык-Куля). Оба остаются.

### K. «Ala-Kul trek» (3 тура + статья-гид)
Три разных маршрута к одному озеру: karakol-peak-base-4 (классика через Karakol gorge), ak-suu-three-pass-5,
full-ak-suu-traverse-9. Все остаются. Главная для «ala kul trek tour»: **karakol-peak-base-ala-kul-trek-4-days**;
общий `series: ala-kul-treks` (4 · 5 · 9). Статья ala-kol-trek-guide ссылается на все три (сейчас на 7-day combo и
grand tour; после переименований добавить ссылки на K).

### L. Зима (7 туров: 3 однодневки + 2, 3, 4 дня)
Не объединять: разные форматы. Нужна одна посадочная «Kyrgyzstan in winter» (хаб-сезон или статья с автосписком
зимних туров по тегу `winter`), главная зимнего запроса: **winter-issyk-kul-karakol-skiing-4-days** («Karakol
skiing»), а «winter horse trek» остаётся у winter-horse-trek-to-song-kul-3.

### M. Однодневки из Бишкека (19 туров)
Запрос «day trips from Bishkek» сейчас ведёт только на `/tours/?cat=Day trips` (не индексируется как отдельная
страница). Предложение: посадочная **«Day trips from Bishkek»** (`/day-trips-from-bishkek/` или хаб-страница
`/destinations/bishkek/`), с подгруппами:
- Ala-Archa (6: hike at your pace, Bishkek+Ala-Archa, Ala-Archa+Chunkurchak, first horse ride, winter snow walk,
  winter Ala-Archa+Chunkurchak): маршруты разные по формату (пешком, верхом, с городом, два ущелья), оставить все;
  главная для «Ala-Archa day trip»: ala-archa-gorge-hike-at-your-pace-day-trip.
- Burana (3: Silk Road + city, Konorchek + Burana, Kol-Tor + Burana): оставить; главная «Burana tower tour»:
  silk-road-burana-tower-bishkek-day-trip.
- Chunkurchak (3: sky bridge + archery, snow + hot springs, winter с Ala-Archa): оставить.
- Issyk-Kul за день (3: shore + hot springs, Burana + Konorchek + Issyk-Kul, Ak-Say + Barskoon): оставить; главная
  «Issyk-Kul day trip from Bishkek»: issyk-kul-shore-hot-springs-day-trip.
- Бишкек город (3: Soviet heritage, food tour, home dinner): оставить, разные форматы.
- Единичные: Chong-Kemin ride (→ группа I), Arashan gorge ride.
Дублей нет, но без посадочной 19 страниц конкурируют друг с другом за «day trips from Bishkek».

## Что нужно решить (нумерованный список)
1. Пачка 2026 и старые туры: это **один продукт** (тогда 8 объединений с 301) или **разные** (частный из Бишкека и
   сборный от Kyzart)? Во втором случае вместо 301 ставим canonical и различаем названия.
2. При объединении какую страницу оставить: я предлагаю старые адреса (они в индексе и в ссылках), с переносом цены
   и программы из версии 2026. Если удобнее наоборот, редиректы разворачиваются.
3. Согласие на общие `series` для групп D, E, F, H, I, K (это только блок «Also available as», адреса не меняются).
4. Посадочные «Day trips from Bishkek» и «Kyrgyzstan in winter»: делаем в фазе 4 вместе с хабами?

## Как применить (после вашего «да»)
- 301: добавить пары в `scripts/_tour-renames.json` как `{ "hide": true, "redirect": "<главный slug>" }`, тур получает
  `status: hidden` (данные не удаляются). Сервер уже умеет и `/tours/<old>/`, и `tour.html?slug=<old>`.
- Цена/программа: перенос полей `priceFrom`, `priceNote`, при необходимости itinerary, миграцией.
- `series`: миграция, проставляющая поле; блок вариантов берёт число дней из поля `days` (см. замечание в
  `tour-titles.csv`).
