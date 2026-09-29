# AZAT TOURS — бот партнёров (@azattours_partners_bot)

Самостоятельная программа: партнёры добавляют авто для аренды, владелец модерирует в группе
«Azat partners», потом сам переносит одобренные авто на сайт. С сайтом и админ-ботом **ничего общего**:
своя папка, свой `package.json`, свой `config.json`, свои данные `data/`, свой процесс pm2.

Что и как бот делает — в [SPEC.md](SPEC.md).

## Настройки

`config.json` (в git не попадает; образец — `config.example.json`):
- `token` — токен бота от @BotFather;
- `ownerId` — ваш Telegram ID (913187557);
- `adminChatId` — группа модерации; проще всего написать в группе `/chatid`, бот впишет сам.

На сервере файл должен читать только владелец: `chmod 600 config.json`.

## Запуск на компьютере (для проверки)

Нужен Node.js 22.13 или новее.

```bash
cd partners
npm install
npm test        # 69 автотестов
npm start
```

## Запуск на сервере (первый раз)

```bash
node -v                                  # нужно 22.13 или новее
cd /путь/к/kyrgyzstan-tours/partners
npm ci --omit=dev
cp config.example.json config.json       # вписать token и ownerId
chmod 600 config.json
pm2 start ecosystem.config.js
pm2 save
```

Сайт при этом не трогается и не перезапускается.

## Обновление на сервере

```bash
cd /путь/к/kyrgyzstan-tours/partners
npm ci --omit=dev                        # если менялся package.json
pm2 restart azat-partners
```

Папки `data/` (база и фото) и файл `config.json` при обновлении **не перезаписывать**.

## Полезное

- Логи: `pm2 logs azat-partners` (или `logs/out.log`, `logs/error.log`).
- Аватар бота — логотип `assets/logo.png`: `npm run avatar` ставит его через Telegram (после смены токена
  аватар сохраняется, повторять не нужно).
- Бэкап базы: `npm run backup` → `data/backups/`. Скачивайте его к себе, на сервере хранится только последний.
- Фото авто: `data/car-photos/<id авто>/`. В группе кнопка «Файлы для сайта» присылает их файлами.
- Если бот пишет в группу «запущен в двух местах» — где-то работает вторая копия с тем же токеном
  (например, на компьютере и на сервере одновременно). Оставьте одну.
