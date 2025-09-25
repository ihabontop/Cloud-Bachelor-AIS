# 🚀 Guide de Déploiement - Cloud Personnel (700MB)

## 🌟 Options d'hébergement recommandées

### 1. **Heroku** (Gratuit avec limitations)
```bash
# Installer Heroku CLI
npm install -g heroku

# Login et créer l'app
heroku login
heroku create mon-cloud-perso

# Configurer les variables
heroku config:set NODE_ENV=production
heroku config:set NODE_OPTIONS="--max-old-space-size=2048"

# Déployer
git add .
git commit -m "Deploy cloud server"
git push heroku main
```

### 2. **Railway** (Recommandé - Gratuit 5$ crédits/mois)
1. Connectez votre repo GitHub à Railway
2. Variables d'environnement:
   - `NODE_ENV=production`
   - `NODE_OPTIONS=--max-old-space-size=2048`
3. Déploiement automatique!

### 3. **Render** (Gratuit avec limitations)
```bash
# Créer compte sur render.com
# Connecter GitHub
# Variables d'environnement:
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=2048
```

### 4. **VPS Personnel** (Recommandé pour usage intensif)
```bash
# Sur votre VPS Ubuntu/Debian
sudo apt update
sudo apt install nginx nodejs npm

# Cloner votre projet
git clone <votre-repo>
cd upload_server_cloud

# Installer PM2 pour production
npm install -g pm2
npm install

# Démarrer avec PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# Configurer Nginx (optionnel)
sudo nano /etc/nginx/sites-available/cloud
```

### 5. **Docker Deployment**
```bash
# Local
docker build -t mon-cloud .
docker run -p 8080:8080 -v ./uploads:/app/uploads mon-cloud

# Docker Compose (recommandé)
docker-compose up -d
```

## ⚙️ Configuration Nginx (VPS)
```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    client_max_body_size 750M;
    proxy_read_timeout 600s;
    proxy_connect_timeout 600s;
    proxy_send_timeout 600s;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🌐 Services Cloud Gratuits

### **1. Railway** ⭐ (Recommandé)
- ✅ 5$/mois en crédits gratuits
- ✅ Déploiement GitHub automatique
- ✅ Domaine gratuit inclus
- ✅ Scaling automatique

### **2. Render**
- ✅ 750h/mois gratuits
- ✅ SSL automatique
- ❌ Mise en veille après inactivité

### **3. Heroku**
- ✅ Simple à utiliser
- ❌ Plus de plan gratuit (depuis 2022)
- ❌ Limites de mémoire

### **4. Vercel**
- ❌ Pas adapté pour upload de fichiers lourds
- ❌ Limite serverless functions

## 🔧 Variables d'environnement importantes
```env
NODE_ENV=production
PORT=8080
NODE_OPTIONS=--max-old-space-size=2048
```

## 📊 Monitoring & Logs
```bash
# PM2 logs
pm2 logs cloud-server

# Docker logs
docker-compose logs -f

# Monitoring PM2
pm2 monit
```

## 🛡️ Sécurité en Production

### 1. Rate Limiting
```bash
npm install express-rate-limit
```

### 2. Helmet pour sécurité
```bash
npm install helmet
```

### 3. HTTPS obligatoire
- Utiliser Let's Encrypt ou certificat cloud
- Redirection HTTP → HTTPS

## 🚀 Performance Tips

1. **Nginx comme proxy reverse**
2. **Compression gzip activée**
3. **CDN pour fichiers statiques**
4. **Monitoring avec PM2**
5. **Logs structurés**

## 💡 Alternative Discord Nitro

Votre cloud peut maintenant :
- ✅ **700MB par fichier** (vs 500MB Nitro)
- ✅ **Liens directs partagés**
- ✅ **Pas de limitation Discord**
- ✅ **Contrôle total**
- ✅ **Gratuit** (selon hébergement)

## 🆘 Dépannage

### Erreur de mémoire
```bash
# Augmenter limite Node.js
export NODE_OPTIONS="--max-old-space-size=4096"
```

### Upload timeout
```javascript
// Dans server.js, augmenter timeout
uploadTimeout: 20 * 60 * 1000 // 20 minutes
```

### Port déjà utilisé
```bash
# Trouver processus sur port
lsof -i :3000
kill -9 <PID>
```

---

**🎉 Votre cloud personnel est prêt à concurrencer Discord Nitro !**