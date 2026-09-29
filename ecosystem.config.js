// PM2 process config for Azat Tours (site + API + Telegram bot in one Node process).
// Use: pm2 start ecosystem.config.js   (first time)
//      pm2 reload ecosystem.config.js  (deploys)
module.exports = {
  apps: [{
    name: 'azat-tours',
    script: 'start.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',           // bot uses polling — do NOT run multiple instances
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
      // BOT_TOKEN / OWNER_ID / PORT can come from config.json (fallback) or env here
    },
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    time: true                    // prefix log lines with timestamps
  }]
};
