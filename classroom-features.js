// Fonctionnalités spéciales pour usage en classe

// Ajouter ces routes au serveur principal

// Route pour catégoriser les fichiers par matière
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
            shareLink: file.shareLink
        }));

    res.json(files);
});

// Route pour les statistiques de classe
app.get('/classroom/stats', (req, res) => {
    const database = loadDatabase();
    const files = Object.values(database);

    const stats = {
        totalFiles: files.length,
        totalSize: files.reduce((sum, file) => sum + file.size, 0),
        totalDownloads: files.reduce((sum, file) => sum + file.downloads, 0),
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
        stats.categories[cat].size += file.size;
    });

    // Top uploaders
    files.forEach(file => {
        const uploader = file.uploader || 'anonymous';
        stats.topUploaders[uploader] = (stats.topUploaders[uploader] || 0) + 1;
    });

    res.json(stats);
});

module.exports = {
    // Ces fonctions peuvent être importées dans server.js
};