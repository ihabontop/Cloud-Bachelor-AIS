const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto-js');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Créer les dossiers nécessaires
const uploadsDir = path.join(__dirname, 'uploads');
const dataDir = path.join(__dirname, 'data');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Base de données simple en JSON
const dbPath = path.join(dataDir, 'files.json');
const loadDatabase = () => {
    try {
        if (fs.existsSync(dbPath)) {
            return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        }
    } catch (error) {
        console.log('Erreur lors du chargement de la base de données:', error);
    }
    return {};
};

const saveDatabase = (data) => {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.log('Erreur lors de la sauvegarde:', error);
    }
};

// Configuration Multer pour l'upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueId = uuidv4();
        const extension = path.extname(file.originalname);
        cb(null, uniqueId + extension);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 700 * 1024 * 1024 // 700MB limite pour concurrencer Discord Nitro
    }
});

// Fonction pour générer un lien sécurisé
const generateSecureLink = () => {
    return crypto.SHA256(uuidv4() + Date.now().toString()).toString();
};

// Route d'accueil
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route pour uploader un fichier
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier reçu' });
    }

    const database = loadDatabase();
    const shareLink = generateSecureLink();
    const fileId = uuidv4();

    const fileData = {
        id: fileId,
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        shareLink: shareLink,
        uploadDate: new Date().toISOString(),
        downloads: 0
    };

    database[shareLink] = fileData;
    saveDatabase(database);

    res.json({
        success: true,
        fileId: fileId,
        shareLink: `${req.protocol}://${req.get('host')}/share/${shareLink}`,
        filename: req.file.originalname,
        size: req.file.size
    });
});

// Route pour accéder à un fichier partagé
app.get('/share/:shareLink', (req, res) => {
    const { shareLink } = req.params;
    const database = loadDatabase();
    const fileData = database[shareLink];

    if (!fileData) {
        return res.status(404).json({ error: 'Fichier non trouvé ou lien expiré' });
    }

    const filePath = path.join(uploadsDir, fileData.filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Fichier physique non trouvé' });
    }

    // Incrémenter le compteur de téléchargements
    fileData.downloads += 1;
    database[shareLink] = fileData;
    saveDatabase(database);

    // Définir les headers appropriés
    res.setHeader('Content-Disposition', `attachment; filename="${fileData.originalName}"`);
    res.setHeader('Content-Type', fileData.mimetype);

    // Envoyer le fichier
    res.sendFile(filePath);
});

// Route pour obtenir les informations d'un fichier
app.get('/info/:shareLink', (req, res) => {
    const { shareLink } = req.params;
    const database = loadDatabase();
    const fileData = database[shareLink];

    if (!fileData) {
        return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    res.json({
        originalName: fileData.originalName,
        size: fileData.size,
        mimetype: fileData.mimetype,
        uploadDate: fileData.uploadDate,
        downloads: fileData.downloads
    });
});

// Route pour lister tous les fichiers (pour administration)
app.get('/admin/files', (req, res) => {
    const database = loadDatabase();
    const files = Object.values(database).map(file => ({
        id: file.id,
        originalName: file.originalName,
        size: file.size,
        mimetype: file.mimetype,
        uploadDate: file.uploadDate,
        downloads: file.downloads,
        shareLink: file.shareLink
    }));

    res.json(files);
});

// Route pour uploader avec catégorie (pour classroom.html)
app.post('/upload-with-category', (req, res) => {
    if (!req.files || !req.files.file) {
        return res.status(400).json({ error: 'Aucun fichier reçu' });
    }

    const file = req.files.file;
    const category = req.body.category || 'general';
    const uploader = req.body.uploader || 'anonymous';

    const database = loadDatabase();
    const shareLink = generateSecureLink();
    const fileId = uuidv4();
    const extension = path.extname(file.name);
    const filename = fileId + extension;
    const finalPath = path.join(uploadsDir, filename);

    file.mv(finalPath, (err) => {
        if (err) {
            console.error('Erreur lors du déplacement du fichier:', err);
            return res.status(500).json({ error: 'Erreur lors de la sauvegarde du fichier' });
        }

        const fileData = {
            id: fileId,
            originalName: file.name,
            filename: filename,
            size: file.size,
            mimetype: file.mimetype,
            shareLink: shareLink,
            uploadDate: new Date().toISOString(),
            downloads: 0,
            category: category,
            uploader: uploader,
            isEducational: true
        };

        database[shareLink] = fileData;
        saveDatabase(database);

        res.json({
            success: true,
            fileId: fileId,
            shareLink: `${req.protocol}://${req.get('host')}/share/${shareLink}`,
            filename: file.name,
            size: file.size,
            category: category
        });
    });
});

// Route pour lister les fichiers par catégorie
app.get('/files/category/:category', (req, res) => {
    const { category } = req.params;
    const database = loadDatabase();

    const files = Object.values(database)
        .filter(file => file.category === category)
        .map(file => ({
            id: file.id,
            originalName: file.originalName,
            size: file.size,
            mimetype: file.mimetype,
            uploadDate: file.uploadDate,
            downloads: file.downloads,
            uploader: file.uploader,
            shareLink: file.shareLink,
            category: file.category
        }));

    res.json(files);
});

// Route pour les statistiques de classe
app.get('/classroom/stats', (req, res) => {
    const database = loadDatabase();
    const files = Object.values(database);

    const stats = {
        totalFiles: files.length,
        totalSize: files.reduce((sum, file) => sum + (file.size || 0), 0),
        totalDownloads: files.reduce((sum, file) => sum + (file.downloads || 0), 0),
        categories: {},
        topUploaders: {},
        recentUploads: files
            .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))
            .slice(0, 10)
    };

    // Statistiques par catégorie
    files.forEach(file => {
        const cat = file.category || 'general';
        if (!stats.categories[cat]) {
            stats.categories[cat] = { count: 0, size: 0 };
        }
        stats.categories[cat].count++;
        stats.categories[cat].size += (file.size || 0);
    });

    // Top uploaders
    files.forEach(file => {
        const uploader = file.uploader || 'anonymous';
        stats.topUploaders[uploader] = (stats.topUploaders[uploader] || 0) + 1;
    });

    res.json(stats);
});

// Route de santé pour les services d'hébergement
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Optimisations pour gros fichiers
process.on('uncaughtException', (err) => {
    console.error('Erreur non gérée:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Promesse rejetée non gérée:', promise, 'raison:', reason);
});

// Augmenter les limites de mémoire pour les gros fichiers
if (process.env.NODE_ENV === 'production') {
    process.setMaxListeners(20);
}

// Démarrer le serveur
app.listen(PORT, HOST, () => {
    console.log(`🌟 Serveur cloud démarré sur ${HOST}:${PORT}`);
    console.log(`⚠️  ATTENTION: Vous utilisez server.js (version obsolète)`);
    console.log(`⚠️  Socket.IO non disponible - Utilisez server-hybrid.js`);
    console.log(`📂 Interface web: http://${HOST}:${PORT}`);
    console.log(`📁 Dossier uploads: ${uploadsDir}`);
    console.log(`💾 Limite fichiers: 700MB (Discord Nitro competitor!)`);
    console.log(`🌐 Prêt pour l'hébergement web!`);

    if (process.env.NODE_ENV === 'production') {
        console.log(`🚀 Mode production activé`);
    }
});