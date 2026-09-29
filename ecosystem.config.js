// PM2 process config for Azat Tours: two separate processes.
//   azat-tours    — site + API + admin bot (start.js)
//   azat-partners — car-partners bot (partners/index.js); its own memory, its own
//                   restarts, so a problem there never touches the site.
// Use: pm2 start ecosystem.config.js   (first time)
//      pm2 reload ecosystem.config.js  (deploys)
const common = {
  cwd: __dirname,
  instances: 1,
  exec_mode: 'fork',             // bots use polling — do NOT run multiple instances
  autorestart: true,
  watch: false,
  env: { NODE_ENV: 'production' },
  time: true                     // prefix log lines with timestamps
};

module.exports = {
  apps: [{
    ...common,
    name: 'azat-tours',
    script: 'start.js',
    max_memory_restart: '500M',
    // BOT_TOKEN / OWNER_ID / PORT can come from config.json (fallback) or env here
    error_file: 'logs/error.log',
    out_file: 'logs/out.log'
  }, {
    ...common,
    name: 'azat-partners',
    script: 'partners/index.js',
    node_args: '--no-warnings',  // hides node:sqlite's "experimental" notice in the logs
    max_memory_restart: '300M',
    kill_timeout: 3000,          // time for the graceful stop (finish updates, close DB)
    restart_delay: 5000,
    error_file: 'logs/partners-error.log',
    out_file: 'logs/partners-out.log'
  }]
};
