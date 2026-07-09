# Деплой Alatoo на VPS — инструкция (для того, кто разворачивает)

Это небольшое **Node.js**-приложение: один процесс (`start.js`) поднимает сайт + API
(заявки/чат) и **Telegram-бота** (управление контентом). Бот пишет файлы на диск
(`content/*.json`, `images/`), поэтому нужен **постоянный диск** — обычный VPS подходит.

## Что потребуется
- Ubuntu/Debian VPS, Node.js **18+**, домен (по желанию).
- От владельца: **BOT_TOKEN** (от @BotFather), **OWNER_ID** (числовой Telegram ID), домен.

## 1. Установить Node + pm2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

## 2. Залить проект и поставить зависимости
```bash
# распакуй архив, например в /var/www/alatoo
cd /var/www/alatoo
npm install            # node_modules в архив не входят — ставятся здесь
```

## 3. Указать токен бота и владельца
Создай файл `config.json` в корне проекта:
```json
{ "token": "ТОКЕН_ОТ_BOTFATHER", "ownerId": 913187557 }
```
(или задать переменными окружения `BOT_TOKEN`, `OWNER_ID` — код читает их в первую очередь).

## 4. Запустить (сайт + бот в одном процессе)
```bash
pm2 start start.js --name alatoo
pm2 save
pm2 startup            # автозапуск после перезагрузки сервера (выполни выданную команду)
```
Сайт слушает порт **5173** (или $PORT). Бот работает через long-polling — входящие порты ему не нужны.

## 5. Nginx как reverse-proxy + HTTPS
```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```
`/etc/nginx/sites-available/alatoo`:
```nginx
server {
  server_name ВАШ_ДОМЕН;
  client_max_body_size 15M;   # чтобы бот мог принимать фото
  location / {
    proxy_pass http://127.0.0.1:5173;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/alatoo /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d ВАШ_ДОМЕН        # бесплатный SSL
```
DNS домена направить A-записью на IP сервера.

## 6. Проверка
- Открыть домен → сайт грузится.
- Владелец пишет боту `/start` → отвечает; `/tours`, `/addtour`, `/reviews` работают.
- Отправить тестовую заявку на сайте → приходит в Telegram владельцу.
- Чат на сайте → приходит владельцу; ответ Reply’ем → виден на сайте.

## Важно
- **Не удалять** папки `content/` и `images/` — там весь контент и загруженные фото.
- Обновление кода в будущем: заменить файлы (кроме `content/`, `images/`, `config.json`, `node_modules`), затем `pm2 restart alatoo`.
- Бэкап: достаточно копировать `content/` и `images/`.

## Полезные команды
```bash
pm2 logs alatoo      # логи
pm2 restart alatoo   # перезапуск
pm2 status           # статус
```
