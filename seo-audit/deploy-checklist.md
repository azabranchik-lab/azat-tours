# Выкатка ветки seo-fixes (пакеты A, C, D и решения фазы 3)

Деплой = push в `main`: GitHub Actions заходит на сервер, делает `git reset --hard`, `npm ci`, миграции, регенерацию
и `pm2 reload`. Push делает только владелец.

## Отрепетировано 2026-10-25
Ветка развёрнута в чистую папку (`git archive`, без `config.json` и `node_modules`), контент взят в состоянии сервера
(79 туров, миграции по `2026-10-16-new-tours`), выполнены шаги из `deploy.yml`:
- `node scripts/migrate.js`: 3 миграции (sights-fix: 2 места, post-links: 38 ссылок, seo-titles: 79 title), снимок
  `content/before-2026-10-25-sights-fix/`; повторный запуск: «nothing pending».
- `node scripts/regenerate-all.js`: 79 туров, 9 статей.
- сервер на отдельном порту: `check-site` «All good» (92 URL, 745 ссылок), обход совпал с локальной сборкой без
  единого отличия, AVIF по `?w=` и шрифты отдаются.
- `npm test` на этом контенте: все тесты проходят; бот загружается (с фальшивым токеном падает только на авторизации
  в Telegram, как и должно).
- бэкап: архив реального контента 257 КБ, восстановление после «потери» вернуло 80 туров.

## Перед push (5 минут, на сервере)
```bash
node -v
```
Нужен Node ≥ 20.9 (sharp).
```bash
df -h /root
```
Нужно ≥ 500 МБ свободно: кэш уменьшенных картинок дорастёт до ~150 МБ.

## Push
```bash
git checkout main
git merge --ff-only seo-fixes
git push origin main
```
Перед push убедиться, что в истории нет следов старого сайта (правило проекта): команда с нужными словами лежит
в `docs/PRIVATE-NOTES.md` (не в git), её вывод должен быть пустым.

## Сразу после (10 минут)
1. Вкладка Actions → Deploy: зелёный.
2. Проверка сайта целиком с любого компьютера:
```bash
node scripts/check-site.js https://azattours.com
```
3. Сравнение с baseline (должны быть только ожидаемые отличия: 77 title, WebSite на главной, canonical на /reviews.html):
```bash
node seo-audit/crawl.js https://azattours.com seo-audit/after-deploy/prod
```
```bash
node seo-audit/compare.js seo-audit/baseline/prod seo-audit/after-deploy/prod
```
4. В боте: `/backup` должен прислать архив; в меню появилась команда backup.
5. Глазами на телефоне: главная, каталог (фильтры, «All filters»), тур (вкладки, форма), статья.
6. Отправить тестовую заявку с формы тура с пометкой TEST: уведомление пришло в бот.
7. Прогреть картинки ночью (необязательно):
```bash
nohup node scripts/warm-images.js > logs/warm-images.log 2>&1 &
```

## Search Console (в тот же день)
1. Sitemaps → отправить `https://azattours.com/sitemap.xml`.
2. URL Inspection → «Request indexing» для: `/`, `/tours/`, `/tours/song-kul-horse-trek-3-days/`,
   `/tours/kyrgyzstan-grand-tour-10-days/`, `/tours/kok-kiya-kel-suu-road-trip-8-days/`,
   `/tours/issyk-kul-altyn-arashan-4-days/`, `/tours/kel-suu-lake-express-4-days/`,
   `/tours/ala-archa-gorge-hike-at-your-pace-day-trip/`, `/blog/ala-kol-trek-guide/`, `/blog/best-time-to-visit-kyrgyzstan/`.
3. Через 2–3 недели: Performance → Queries. Это первые настоящие данные о запросах; по ним решаем H1 и слияния.

## Откат
```bash
git revert --no-edit <первый коммит>..<последний коммит>
```
Затем push. Миграции контента не откатываются сами: снимок до них лежит в `content/before-2026-10-25-sights-fix/`
на сервере (скопировать файлы обратно и `node scripts/regenerate-all.js`).
