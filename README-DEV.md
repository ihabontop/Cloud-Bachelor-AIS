# 🧪 Guide de Développement - Cloud Bachelor AIS

## 🏗️ Architecture Hybride

### **Supabase (Cloud)**
- ✅ Authentification étudiants
- ✅ Table `students` uniquement
- ✅ Gestion des codes d'accès

### **Stockage Local**
- ✅ Fichiers physiques dans `/uploads`
- ✅ Métadonnées dans `/data/files.json`
- ✅ Synchronisation temps réel

## 🚀 Workflow de Développement

### **1. Tests en Local**
```bash
# Installation des dépendances
npm install

# Démarrage en mode développement
npm run dev

# Ou avec rechargement automatique
npm run dev:watch
```

### **2. Accès Local**
- **Interface** : http://localhost:3000
- **Admin** : http://localhost:3000/admin.html
- **Classroom** : http://localhost:3000/classroom

### **3. Configuration**
- **Dev** : `.env.local` (votre PC)
- **Prod** : `.env` (VPS)

## 🔧 Commandes Disponibles

```bash
# Développement local
npm run dev              # Test sur votre PC
npm run dev:watch        # Avec auto-reload

# Production
npm run prod             # Démarrage production local
npm start                # Serveur original (legacy)
```

## 📁 Structure des Fichiers

### **Développement (votre PC)**
```
uploads/          # Fichiers uploadés en local
data/files.json   # Métadonnées des fichiers
temp/            # Fichiers temporaires
.env.local       # Config de développement
```

### **Production (VPS)**
```
uploads/          # Fichiers uploadés sur VPS
data/files.json   # Métadonnées des fichiers VPS
.env             # Config de production
```

## 🧪 Tests Recommandés

### **1. Test Authentification**
1. Aller sur `/admin.html`
2. Créer un étudiant test
3. Noter le code d'accès
4. Tester la connexion sur `/`

### **2. Test Upload/Download**
1. Se connecter comme étudiant
2. Upload un fichier test
3. Vérifier dans `/uploads`
4. Tester le lien de partage

### **3. Test Temps Réel**
1. Ouvrir 2 onglets `/classroom`
2. Upload dans l'un
3. Voir la notification dans l'autre

### **4. Test Suppression**
1. Upload un fichier
2. Le supprimer depuis l'interface
3. Vérifier qu'il disparaît des 2 côtés

## 🔄 Synchronisation Dev → Prod

### **Workflow recommandé :**
1. `npm run dev` → Tests locaux
2. Validation complète des fonctionnalités
3. Transfert vers VPS
4. `pm2 start server-hybrid.js --name cloud-ais`

### **Fichiers à transférer :**
- `server-hybrid.js`
- `public/` (interfaces)
- `.env` (config prod)
- `package.json`

## ⚠️ Points d'Attention

### **Base de données**
- **Supabase** = partagée dev/prod (même table `students`)
- **Fichiers JSON** = séparés (local dev ≠ VPS prod)

### **Ports**
- **Dev** : localhost:3000
- **Prod** : VPS:3000 (via Nginx)

### **Environnements**
- Même auth Supabase
- Stockage fichiers séparé
- WebSocket fonctionne dans les 2

## 🎯 Avantages du Système

✅ **Test complet** avant déploiement
✅ **Pas de risque** sur la prod
✅ **Auth centralisée** via Supabase
✅ **Stockage local** performant
✅ **Temps réel** fonctionnel

---

**🧪 Développement → 🚀 Production en toute sérénité !**