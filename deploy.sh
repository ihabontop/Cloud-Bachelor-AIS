#!/bin/bash

# Script de déploiement automatique pour VPS Debian

echo "🚀 Déploiement du Cloud Personnel sur VPS..."

# Installer PM2 globalement
npm install -g pm2

# Créer les dossiers nécessaires
mkdir -p uploads temp data logs
chmod 755 uploads temp data logs

# Installer les dépendances
npm ci --only=production

# Configurer les variables d'environnement
export NODE_ENV=production
export PORT=3000

# Démarrer l'application avec PM2
pm2 start ecosystem.config.js --env production

# Sauvegarder la configuration PM2
pm2 save

# Configurer PM2 pour démarrage automatique
pm2 startup

echo "✅ Application démarrée avec PM2!"
echo "📊 Monitoring: pm2 monit"
echo "📋 Status: pm2 status"
echo "📜 Logs: pm2 logs cloud-server"