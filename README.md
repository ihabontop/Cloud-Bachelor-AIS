# 🌟 Mon Cloud Personnel

Une solution de stockage cloud simple et sécurisée pour stocker et partager vos fichiers via des liens.

## ✨ Fonctionnalités

- 📤 **Upload de fichiers** : Glisser-déposer ou sélection manuelle
- 🔗 **Liens de partage sécurisés** : Génération automatique de liens uniques
- 📊 **Suivi des téléchargements** : Compteur de téléchargements pour chaque fichier
- 🎨 **Interface moderne** : Interface web responsive et intuitive
- 📁 **Gestion des fichiers** : Visualisation de tous vos fichiers uploadés
- 🔒 **Sécurisé** : Liens cryptés et stockage local sécurisé

## 🚀 Installation et démarrage

### Prérequis
- Node.js (version 14 ou supérieure)
- npm

### Installation
```bash
# Cloner le projet
git clone <votre-repo>
cd upload_server_cloud

# Installer les dépendances
npm install

# Démarrer le serveur
npm start
```

### Démarrage rapide
```bash
npm run dev
```

Le serveur sera accessible sur `http://localhost:3000`

## 📚 API Documentation

### Endpoints disponibles

#### `POST /upload`
Upload un fichier et génère un lien de partage.

**Body:** FormData avec le champ `file`

**Response:**
```json
{
  "success": true,
  "fileId": "uuid",
  "shareLink": "http://localhost:3000/share/secure-hash",
  "filename": "document.pdf",
  "size": 1024000
}
```

#### `GET /share/:shareLink`
Télécharge un fichier via son lien de partage.

**Response:** Fichier en téléchargement direct

#### `GET /info/:shareLink`
Obtient les informations d'un fichier.

**Response:**
```json
{
  "originalName": "document.pdf",
  "size": 1024000,
  "mimetype": "application/pdf",
  "uploadDate": "2023-12-01T10:00:00.000Z",
  "downloads": 5
}
```

#### `GET /admin/files`
Liste tous les fichiers uploadés (pour administration).

**Response:** Array de fichiers avec leurs métadonnées

## 📁 Structure du projet

```
upload_server_cloud/
├── server.js           # Serveur Express principal
├── package.json        # Configuration npm
├── public/
│   └── index.html     # Interface web
├── uploads/           # Dossier des fichiers uploadés
└── data/
    └── files.json     # Base de données des métadonnées
```

## ⚙️ Configuration

### Variables d'environnement
- `PORT` : Port du serveur (défaut: 3000)

### Limites par défaut
- Taille max des fichiers : 100MB
- Stockage : Local (dossier `uploads/`)
- Base de données : JSON local (`data/files.json`)

## 🛡️ Sécurité

- Génération de liens sécurisés avec crypto-js
- Validation des types de fichiers
- Limitation de la taille des fichiers
- Stockage local sécurisé

## 🔧 Personnalisation

### Modifier la limite de taille
Dans `server.js`, ligne 43 :
```javascript
limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
}
```

### Changer le dossier de stockage
Dans `server.js`, ligne 18 :
```javascript
const uploadsDir = path.join(__dirname, 'uploads');
```

## 📝 TODO / Améliorations possibles

- [ ] Authentification utilisateur
- [ ] Interface d'administration avancée
- [ ] Base de données externe (PostgreSQL, MongoDB)
- [ ] Système d'expiration des liens
- [ ] Chiffrement des fichiers
- [ ] API REST complète
- [ ] Upload en chunks pour gros fichiers
- [ ] Prévisualisation des fichiers
- [ ] Compression automatique des images

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir des issues ou des pull requests.

## 📄 Licence

ISC License

---

**Développé avec ❤️ pour un stockage cloud simple et efficace**