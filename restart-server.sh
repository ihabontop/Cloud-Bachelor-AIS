#!/bin/bash

# Script de redémarrage pour Cloud Bachelor AIS
# Usage: ./restart-server.sh

echo "🔄 Redémarrage du serveur Cloud Bachelor AIS..."

# Arrêter tous les processus Node.js existants (attention sur un serveur partagé!)
echo "🛑 Arrêt des processus existants..."
pkill -f "node.*server"

# Attendre un peu
sleep 2

# Démarrer le nouveau serveur avec server-hybrid.js
echo "🚀 Démarrage du serveur hybride (Socket.IO + Auth)..."
NODE_ENV=production nohup npm start > server.log 2>&1 &

# Attendre que le serveur démarre
sleep 3

# Vérifier que le serveur tourne
if pgrep -f "node.*server-hybrid" > /dev/null; then
    echo "✅ Serveur démarré avec succès!"
    echo "📋 Vérifiez les logs avec: tail -f server.log"
    echo "🌐 URL: http://45.158.77.193/"
else
    echo "❌ Erreur: Le serveur n'a pas démarré"
    echo "📋 Vérifiez les logs: cat server.log"
fi