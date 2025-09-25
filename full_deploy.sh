#!/bin/bash

echo "🌟 Installation complète du Cloud Personnel sur VPS Debian 13"
echo "IP: 45.158.77.193"

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
log() {
    echo -e "${GREEN}✅ $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# 1. Mise à jour du système
log "Mise à jour du système..."
apt update && apt upgrade -y

# 2. Installation des dépendances
log "Installation de Node.js, Nginx, Git..."
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt install -y nodejs nginx git ufw htop

# 3. Installation PM2
log "Installation de PM2..."
npm install -g pm2

# 4. Création du répertoire de l'application
log "Préparation des dossiers..."
mkdir -p /var/www/cloud
cd /var/www/cloud

# 5. Si le code n'est pas encore là, le créer
if [ ! -f "server.js" ]; then
    warn "Veuillez transférer votre code dans /var/www/cloud"
    exit 1
fi

# 6. Installation des dépendances npm
log "Installation des dépendances npm..."
npm ci --only=production

# 7. Création des dossiers nécessaires
mkdir -p uploads temp data logs
chmod 755 uploads temp data logs

# 8. Configuration Nginx
log "Configuration de Nginx..."
cp nginx.conf /etc/nginx/sites-available/cloud
ln -sf /etc/nginx/sites-available/cloud /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 9. Test de la configuration Nginx
if nginx -t; then
    log "Configuration Nginx OK"
else
    error "Erreur dans la configuration Nginx"
    exit 1
fi

# 10. Démarrage des services
log "Démarrage de l'application..."
export NODE_ENV=production
export PORT=3000

pm2 start ecosystem.config.js --env production
pm2 save

# Configuration du démarrage automatique
pm2 startup systemd -u root --hp /root

# 11. Redémarrage Nginx
systemctl restart nginx
systemctl enable nginx

# 12. Configuration du firewall
log "Configuration du firewall..."
ufw --force enable
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS

# 13. Vérifications finales
log "Vérifications finales..."
sleep 3

if curl -s localhost:3000/health > /dev/null; then
    log "✅ Application démarrée avec succès!"
else
    error "❌ Problème de démarrage de l'application"
fi

if systemctl is-active --quiet nginx; then
    log "✅ Nginx fonctionne correctement"
else
    error "❌ Problème avec Nginx"
fi

echo ""
echo "🎉 DÉPLOIEMENT TERMINÉ!"
echo ""
echo "📍 Votre cloud est accessible sur:"
echo "   http://45.158.77.193"
echo ""
echo "🛠️  Commandes utiles:"
echo "   pm2 status          - Voir l'état de l'app"
echo "   pm2 logs            - Voir les logs"
echo "   pm2 monit           - Monitoring en temps réel"
echo "   pm2 restart cloud-server - Redémarrer l'app"
echo ""
echo "📊 Monitoring:"
echo "   htop                - Monitoring système"
echo "   df -h               - Espace disque"
echo "   free -h             - Mémoire RAM"
echo ""
echo "🔥 Votre alternative à Discord Nitro est prête!"
echo "   ✅ 700MB par fichier (vs 500MB Discord)"
echo "   ✅ Liens directs de partage"
echo "   ✅ Contrôle total"