// Configuration PM2 pour l'hébergement
module.exports = {
  apps: [{
    name: 'cloud-server',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 8080
    },
    // Paramètres pour les gros fichiers
    node_args: '--max-old-space-size=2048',
    // Redémarrage automatique
    watch: false,
    ignore_watch: ['node_modules', 'uploads', 'temp', 'data'],
    // Logs
    log_file: 'logs/combined.log',
    out_file: 'logs/out.log',
    error_file: 'logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    // Gestion des erreurs
    restart_delay: 1000,
    max_restarts: 5,
    min_uptime: '10s'
  }]
};