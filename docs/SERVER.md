# Сервер: что настроить вручную (нужен доступ по SSH)

Код выкатывается сам, но nginx и система настраиваются руками один раз. Ниже по убыванию эффекта.

## 1. Включить HTTP/2 в nginx (5 минут, самый большой выигрыш в скорости)

Проверено 2026-10-25: TLS 1.3 работает, но на предложение браузера `h2` сервер отвечает `http/1.1`. Каждое новое
соединение до сервера в Сингапуре стоит около секунды (0,3 с соединение и 0,6 с TLS), а по HTTP/1.1 браузер открывает
до шести соединений. С HTTP/2 всё идёт по одному.

Найти файл сайта:
```bash
grep -rln "azattours.com" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/
```
В найденном файле в блоке `server` с `listen 443 ssl` поменять строку (nginx 1.24 понимает только такую форму):
```nginx
listen 443 ssl http2;
listen [::]:443 ssl http2;
```
Там же, если ещё нет, добавить сжатие текстовых ответов и повторное использование TLS-сессий:
```nginx
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
keepalive_timeout 65;
```
Проверить конфиг и применить без остановки сайта:
```bash
nginx -t
```
```bash
systemctl reload nginx
```
Проверка с любого компьютера (должно быть `ALPN protocol: h2`):
```bash
echo | openssl s_client -connect azattours.com:443 -servername azattours.com -alpn h2 2>/dev/null | grep ALPN
```

## 2. Cloudflare перед сервером (по желанию, бесплатно)
Сеть узлов по всему миру: TLS и кэш картинок ближе к посетителю, HTTP/3, защита от ботов. Нужно: аккаунт Cloudflare,
перенести DNS домена (у регистратора сменить NS), режим SSL «Full (strict)». Код менять не нужно. Оговорки:
- в Cloudflare включить «Respect existing headers» для кэша (сайт сам выставляет `Cache-Control`);
- заголовок `Vary: Accept` у картинок: включить правило кэша «Cache by Accept» или отключить Polish, иначе браузер без
  AVIF может получить AVIF из кэша;
- IP посетителей приходят в `CF-Connecting-IP`: в `server.js` лимит заявок считается по `X-Forwarded-For`, проверить,
  что nginx передаёт реальный IP (модуль `real_ip`).

## 3. Мониторинг доступности (10 минут, бесплатно)
UptimeRobot или BetterStack: проверка `https://azattours.com/` раз в 5 минут, уведомление в Telegram. Сейчас о падении
сайта узнаём от клиентов.

## 4. Место на диске
Кэш уменьшенных картинок `.cache/img/` дорастёт до ~150 МБ, бэкапы `content/before-*` по нескольку МБ. Раз в квартал:
```bash
df -h /root
```
```bash
du -sh /root/azat-tours/.cache /root/azat-tours/content
```
