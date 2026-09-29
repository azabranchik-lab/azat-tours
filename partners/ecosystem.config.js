// PM2 config for the car-partners bot. Standalone: its own folder, config, data,
// dependencies and process; it shares nothing with the website.
//   cd partners && npm ci --omit=dev && pm2 start ecosystem.config.js && pm2 save
module.exports = {
  apps: [{
    name: 'azat-partners',
    script: 'index.js',
    cwd: __dirname,
    node_args: '--no-warnings',  // hides node:sqlite's "experimental" notice
    instances: 1,
    exec_mode: 'fork',           // long polling: never more than one instance
    autorestart: true,
    restart_delay: 5000,
    max_memory_restart: '300M',
    kill_timeout: 3000,          // graceful stop: finish updates, close the DB
    watch: false,
    env: { NODE_ENV: 'production' },
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    time: true
  }]
};
