# Dockerfile pour hébergement cloud
FROM node:18-alpine

# Définir le répertoire de travail
WORKDIR /app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances
RUN npm ci --only=production

# Créer les dossiers nécessaires
RUN mkdir -p uploads temp data logs

# Copier le code source
COPY . .

# Exposer le port
EXPOSE 8080

# Variables d'environnement pour production
ENV NODE_ENV=production
ENV PORT=8080

# Optimisations pour gros fichiers
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Changer les permissions des dossiers
RUN chown -R nextjs:nodejs /app/uploads /app/temp /app/data /app/logs

USER nextjs

# Commande de démarrage
CMD ["node", "server.js"]