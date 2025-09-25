// Serveur Cloud Bachelor AIS - Version Hybride
// Auth Supabase + Stockage Local

// Charger la config selon l'environnement
if (process.env.NODE_ENV !== 'production') {
    // En développement, charger .env.local
    try {
        require('dotenv').config({ path: '.env.local' });
        console.log('📋 Configuration développement chargée (.env.local)');
    } catch (error) {
        console.log('⚠️  Fichier .env.local non trouvé, utilisation des valeurs par défaut');
    }
} else {
    // En production, charger .env standard
    try {
        require('dotenv').config();
        console.log('📋 Configuration production chargée (.env)');
    } catch (error) {
        console.log('⚠️  Fichier .env non trouvé');
    }
}

const express = require('express');
const fileUpload = require('express-fileupload');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto-js');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const http = require('http');

// Configuration Supabase (uniquement pour auth)
const { supabase, supabaseAdmin } = require('./supabase-config');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
const JWT_SECRET = process.env.JWT_SECRET || 'bachelor-ais-secret-key-2024';

// Middleware
app.use(cors());
app.use(express.json({ limit: '750mb' }));
app.use(express.urlencoded({ limit: '750mb', extended: true }));
app.use(fileUpload({
    limits: { fileSize: 700 * 1024 * 1024 },
    useTempFiles: true,
    tempFileDir: path.join(__dirname, 'temp'),
    uploadTimeout: 10 * 60 * 1000,
    abortOnLimit: false
}));

// Middleware pour bloquer l'accès direct aux fichiers sensibles
app.use((req, res, next) => {
    const sensitivePaths = [
        '/classroom-realtime.html',
        '/admin.html'
    ];

    if (sensitivePaths.includes(req.path)) {
        return res.redirect('/');
    }
    next();
});

app.use(express.static('public'));

// Dossiers nécessaires
const uploadsDir = path.join(__dirname, 'uploads');
const tempDir = path.join(__dirname, 'temp');
const dataDir = path.join(__dirname, 'data');

[uploadsDir, tempDir, dataDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Middleware d'authentification JWT pour les API
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token manquant' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { data: student, error } = await supabase
            .from('students')
            .select('*')
            .eq('id', decoded.studentId)
            .eq('is_active', true)
            .single();

        if (error || !student) {
            return res.status(403).json({ error: 'Token invalide ou étudiant inactif' });
        }

        req.student = student;
        next();
    } catch (error) {
        console.error('Erreur token:', error);
        return res.status(403).json({ error: 'Token invalide' });
    }
};

// Middleware d'authentification JWT pour les admins
const authenticateAdmin = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token admin manquant' });
    }

    try {
        // Vérifier le token Supabase directement
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
            console.log('Erreur user auth:', userError);
            return res.status(403).json({ error: 'Token admin invalide' });
        }

        console.log('User vérifié:', user.email);

        // Vérifier si l'utilisateur est dans admin_users
        // Désactiver temporairement RLS pour cette vérification
        try {
            const { data: admin, error: adminError } = await supabaseAdmin
                .from('admin_users')
                .select('*')
                .eq('email', user.email)
                .eq('is_active', true)
                .maybeSingle();

            if (adminError) {
                console.error('Erreur vérification admin (DB):', adminError);
                // Si erreur DB, on continue avec les infos de base pour test
                req.admin = {
                    id: user.id,
                    email: user.email,
                    full_name: user.email.split('@')[0],
                    role: 'admin',
                    is_active: true
                };
                req.user = user;
                console.log('Utilisation du fallback admin pour:', user.email);
                return next();
            }

            if (!admin) {
                return res.status(403).json({ error: 'Accès admin non autorisé' });
            }

            req.admin = admin;
            req.user = user;
            console.log('Admin vérifié:', admin.email);
            next();
        } catch (dbError) {
            console.error('Erreur DB complète:', dbError);
            // Fallback temporaire pour les tests
            if (user.email === 'admin@example.com') {
                req.admin = {
                    id: user.id,
                    email: user.email,
                    full_name: 'Administrateur',
                    role: 'admin',
                    is_active: true
                };
                req.user = user;
                console.log('Fallback admin autorisé pour test');
                return next();
            }
            return res.status(403).json({ error: 'Erreur de vérification admin' });
        }
    } catch (error) {
        console.error('Erreur token admin générale:', error);
        return res.status(403).json({ error: 'Token admin invalide' });
    }
};

// Base de données locale JSON pour les métadonnées fichiers
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

// Fonction pour générer un lien sécurisé
const generateSecureLink = () => {
    return crypto.SHA256(uuidv4() + Date.now().toString()).toString();
};

// ==================== ROUTES AUTHENTIFICATION ====================

// Login étudiant (Supabase)
app.post('/auth/login', async (req, res) => {
    const { studentCode, accessCode } = req.body;

    if (!studentCode || !accessCode) {
        return res.status(400).json({ error: 'Code étudiant et code d\'accès requis' });
    }

    try {
        const { data: student, error } = await supabase
            .from('students')
            .select('*')
            .eq('student_code', studentCode)
            .eq('is_active', true)
            .single();

        if (error || !student) {
            return res.status(401).json({ error: 'Code étudiant invalide' });
        }

        const isValidCode = await bcrypt.compare(accessCode, student.access_code);
        if (!isValidCode) {
            return res.status(401).json({ error: 'Code d\'accès invalide' });
        }

        const token = jwt.sign(
            { studentId: student.id, studentCode: student.student_code },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Mettre à jour last_login
        await supabase
            .from('students')
            .update({ last_login: new Date().toISOString() })
            .eq('id', student.id);

        res.json({
            success: true,
            token,
            student: {
                id: student.id,
                name: student.name,
                studentCode: student.student_code,
                group: student.group_name
            }
        });
    } catch (error) {
        console.error('Erreur login:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Vérifier le token
app.get('/auth/verify', authenticateToken, (req, res) => {
    res.json({
        valid: true,
        student: {
            id: req.student.id,
            name: req.student.name,
            studentCode: req.student.student_code,
            group: req.student.group_name
        }
    });
});

// Route pour la configuration Supabase (pour les clients)
app.get('/api/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    });
});

// ==================== ROUTES ADMIN ====================

// Page de login admin
app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// Interface admin (sans protection serveur - gérée côté client)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Route pour obtenir les infos admin
app.get('/admin/me', authenticateAdmin, (req, res) => {
    res.json({
        success: true,
        admin: {
            id: req.admin.id,
            email: req.admin.email,
            fullName: req.admin.full_name,
            role: req.admin.role,
            lastLogin: req.admin.last_login
        }
    });
});

// ==================== ROUTES FICHIERS (LOCAL JSON) ====================

// Upload avec authentification et temps réel (route principale)
app.post('/upload', authenticateToken, async (req, res) => {
    if (!req.files || !req.files.file) {
        return res.status(400).json({ error: 'Aucun fichier reçu' });
    }

    const file = req.files.file;
    const category = req.body.category || 'general';

    try {
        const shareLink = generateSecureLink();
        const fileId = uuidv4();
        const extension = path.extname(file.name);
        const filename = fileId + extension;
        const finalPath = path.join(uploadsDir, filename);

        // Déplacer le fichier
        await new Promise((resolve, reject) => {
            file.mv(finalPath, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Sauvegarder les métadonnées en JSON local
        const database = loadDatabase();
        const fileData = {
            id: fileId,
            originalName: file.name,
            filename: filename,
            size: file.size,
            mimetype: file.mimetype,
            shareLink: shareLink,
            category: category,
            uploaderId: req.student.id,
            uploaderName: req.student.name,
            uploadDate: new Date().toISOString(),
            downloads: 0
        };

        database[shareLink] = fileData;
        saveDatabase(database);

        // Émettre en temps réel
        io.emit('file_added', {
            ...fileData,
            action: 'added'
        });

        res.json({
            success: true,
            fileId: fileId,
            shareLink: `${req.protocol}://${req.get('host')}/share/${shareLink}`,
            filename: file.name,
            size: file.size,
            category: category
        });
    } catch (error) {
        console.error('Erreur upload:', error);
        res.status(500).json({ error: 'Erreur lors de l\'upload' });
    }
});

// Route d'upload avec catégorie
app.post('/upload-with-category', authenticateToken, async (req, res) => {
    // Rediriger vers la route principale /upload
    if (!req.files || !req.files.file) {
        return res.status(400).json({ error: 'Aucun fichier reçu' });
    }

    const file = req.files.file;
    const category = req.body.category || 'general';

    try {
        const shareLink = generateSecureLink();
        const fileId = uuidv4();
        const extension = path.extname(file.name);
        const filename = fileId + extension;
        const finalPath = path.join(uploadsDir, filename);

        // Déplacer le fichier
        await new Promise((resolve, reject) => {
            file.mv(finalPath, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Sauvegarder les métadonnées en JSON local
        const database = loadDatabase();
        const fileData = {
            id: fileId,
            originalName: file.name,
            filename: filename,
            size: file.size,
            mimetype: file.mimetype,
            shareLink: shareLink,
            category: category,
            uploaderId: req.student.id,
            uploaderName: req.student.name,
            uploadDate: new Date().toISOString(),
            downloads: 0
        };

        database[shareLink] = fileData;
        saveDatabase(database);

        // Émettre en temps réel
        io.emit('file_added', {
            ...fileData,
            action: 'added'
        });

        res.json({
            success: true,
            fileId: fileId,
            shareLink: `${req.protocol}://${req.get('host')}/share/${shareLink}`,
            filename: file.name,
            size: file.size,
            category: category
        });
    } catch (error) {
        console.error('Erreur upload:', error);
        res.status(500).json({ error: 'Erreur lors de l\'upload' });
    }
});

// Supprimer un fichier
app.delete('/files/:fileId', authenticateToken, async (req, res) => {
    const { fileId } = req.params;

    try {
        const database = loadDatabase();

        // Trouver le fichier par ID
        const fileEntry = Object.entries(database).find(([key, file]) =>
            file.id === fileId && file.uploaderId === req.student.id
        );

        if (!fileEntry) {
            return res.status(404).json({ error: 'Fichier non trouvé ou non autorisé' });
        }

        const [shareLink, fileData] = fileEntry;

        // Supprimer le fichier physique
        const filePath = path.join(uploadsDir, fileData.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Supprimer des métadonnées
        delete database[shareLink];
        saveDatabase(database);

        // Émettre en temps réel
        io.emit('file_deleted', {
            id: fileId,
            action: 'deleted'
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur suppression:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
});

// Lister tous les fichiers
app.get('/files', authenticateToken, async (req, res) => {
    try {
        const database = loadDatabase();
        const files = Object.values(database).map(file => ({
            id: file.id,
            original_name: file.originalName,
            size: file.size,
            mimetype: file.mimetype,
            category: file.category,
            uploader_name: file.uploaderName,
            downloads: file.downloads,
            created_at: file.uploadDate,
            share_link: file.shareLink
        })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json(files);
    } catch (error) {
        console.error('Erreur liste fichiers:', error);
        res.status(500).json({ error: 'Erreur lors du chargement' });
    }
});

// Lister par catégorie
app.get('/files/category/:category', authenticateToken, async (req, res) => {
    const { category } = req.params;

    try {
        const database = loadDatabase();
        const files = Object.values(database)
            .filter(file => file.category === category)
            .map(file => ({
                id: file.id,
                original_name: file.originalName,
                size: file.size,
                mimetype: file.mimetype,
                category: file.category,
                uploader_name: file.uploaderName,
                downloads: file.downloads,
                created_at: file.uploadDate,
                share_link: file.shareLink
            }))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json(files);
    } catch (error) {
        console.error('Erreur catégorie:', error);
        res.status(500).json({ error: 'Erreur lors du chargement' });
    }
});

// Statistiques
app.get('/stats', authenticateToken, async (req, res) => {
    try {
        const database = loadDatabase();
        const files = Object.values(database);

        const stats = {
            totalFiles: files.length,
            totalSize: files.reduce((sum, file) => sum + (file.size || 0), 0),
            totalDownloads: files.reduce((sum, file) => sum + (file.downloads || 0), 0),
            categories: {},
            topUploaders: {}
        };

        files.forEach(file => {
            // Stats par catégorie
            const cat = file.category || 'general';
            if (!stats.categories[cat]) {
                stats.categories[cat] = { count: 0, size: 0 };
            }
            stats.categories[cat].count++;
            stats.categories[cat].size += (file.size || 0);

            // Top uploaders
            const uploader = file.uploaderName || 'anonymous';
            stats.topUploaders[uploader] = (stats.topUploaders[uploader] || 0) + 1;
        });

        res.json(stats);
    } catch (error) {
        console.error('Erreur stats:', error);
        res.status(500).json({ error: 'Erreur lors du chargement des stats' });
    }
});

// Téléchargement de fichier partagé (sans auth)
app.get('/share/:shareLink', async (req, res) => {
    const { shareLink } = req.params;

    try {
        const database = loadDatabase();
        const fileData = database[shareLink];

        if (!fileData) {
            return res.status(404).json({ error: 'Fichier non trouvé' });
        }

        const filePath = path.join(uploadsDir, fileData.filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Fichier physique non trouvé' });
        }

        // Incrémenter downloads
        fileData.downloads = (fileData.downloads || 0) + 1;
        database[shareLink] = fileData;
        saveDatabase(database);

        res.setHeader('Content-Disposition', `attachment; filename="${fileData.originalName}"`);
        res.setHeader('Content-Type', fileData.mimetype);
        res.sendFile(filePath);
    } catch (error) {
        console.error('Erreur téléchargement:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route pour les fichiers admin (avec authentification)
app.get('/admin/files', authenticateAdmin, async (req, res) => {
    try {
        const database = loadDatabase();
        const files = Object.values(database).map(file => ({
            id: file.id,
            original_name: file.originalName,
            size: file.size,
            mimetype: file.mimetype,
            category: file.category,
            uploader_name: file.uploaderName,
            downloads: file.downloads,
            created_at: file.uploadDate,
            share_link: file.shareLink
        })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json(files);
    } catch (error) {
        console.error('Erreur admin/files:', error);
        res.status(500).json({ error: 'Erreur lors du chargement' });
    }
});

// Route pour les statistiques classroom
app.get('/classroom/stats', authenticateToken, async (req, res) => {
    try {
        const database = loadDatabase();
        const files = Object.values(database);

        const stats = {
            totalFiles: files.length,
            totalSize: files.reduce((sum, file) => sum + (file.size || 0), 0),
            totalDownloads: files.reduce((sum, file) => sum + (file.downloads || 0), 0),
            categories: {},
            topUploaders: {}
        };

        files.forEach(file => {
            // Stats par catégorie
            const cat = file.category || 'general';
            if (!stats.categories[cat]) {
                stats.categories[cat] = { count: 0, size: 0 };
            }
            stats.categories[cat].count++;
            stats.categories[cat].size += (file.size || 0);

            // Top uploaders
            const uploader = file.uploaderName || 'anonymous';
            stats.topUploaders[uploader] = (stats.topUploaders[uploader] || 0) + 1;
        });

        res.json(stats);
    } catch (error) {
        console.error('Erreur classroom stats:', error);
        res.status(500).json({ error: 'Erreur lors du chargement des stats' });
    }
});

// ==================== ROUTES ADMIN (SUPABASE) ====================

// Ajouter un étudiant
app.post('/admin/students', authenticateAdmin, async (req, res) => {
    console.log('📝 Tentative ajout étudiant:', req.body);

    const { name, studentCode, groupName } = req.body;

    if (!name || !studentCode) {
        return res.status(400).json({ error: 'Nom et code étudiant requis' });
    }

    try {
        console.log('🔐 Génération du code d\'accès...');
        // Code de 12 caractères - plus sécurisé
        const accessCode = Math.random().toString(36).substring(2, 14);
        console.log('📝 Code généré:', accessCode, '(longueur:', accessCode.length, ')');

        const hashedCode = await bcrypt.hash(accessCode, 10);
        console.log('🔒 Hash généré, longueur:', hashedCode.length);

        console.log('📤 Insertion dans Supabase...');
        const { data: student, error } = await supabase
            .from('students')
            .insert({
                name: name,
                student_code: studentCode,
                access_code: hashedCode,
                group_name: groupName || null
            })
            .select()
            .single();

        if (error) {
            console.error('❌ Erreur Supabase:', error);
            if (error.code === '23505') {
                return res.status(400).json({ error: 'Ce code étudiant existe déjà' });
            }
            throw error;
        }

        console.log('✅ Étudiant créé:', student.id);
        res.json({
            success: true,
            student: {
                id: student.id,
                name: student.name,
                studentCode: student.student_code
            },
            accessCode: accessCode
        });
    } catch (error) {
        console.error('💥 Erreur ajout étudiant:', error);
        res.status(500).json({ error: 'Erreur serveur: ' + error.message });
    }
});

// Création en lot d'étudiants
app.post('/admin/students/batch', authenticateAdmin, async (req, res) => {
    const { count, prefix } = req.body;

    if (!count || count < 1 || count > 50) {
        return res.status(400).json({ error: 'Nombre doit être entre 1 et 50' });
    }

    try {
        const students = [];
        const codes = [];

        for (let i = 1; i <= count; i++) {
            const studentCode = `${prefix}${i.toString().padStart(3, '0')}`;
            const accessCode = Math.random().toString(36).substring(2, 14);
            const hashedCode = await bcrypt.hash(accessCode, 10);

            students.push({
                name: `Étudiant ${studentCode}`,
                student_code: studentCode,
                access_code: hashedCode,
                group_name: null
            });

            codes.push({ studentCode, accessCode });
        }

        const { data, error } = await supabase
            .from('students')
            .insert(students)
            .select();

        if (error) throw error;

        res.json({
            success: true,
            created: data.length,
            codes: codes
        });
    } catch (error) {
        console.error('Erreur création lot:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Lister tous les étudiants
app.get('/admin/students', authenticateAdmin, async (req, res) => {
    try {
        const { data: students, error } = await supabase
            .from('students')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(students);
    } catch (error) {
        console.error('Erreur liste étudiants:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Activer/désactiver un étudiant
app.patch('/admin/students/:studentId/toggle', async (req, res) => {
    const { studentId } = req.params;
    const { isActive } = req.body;

    try {
        const { error } = await supabase
            .from('students')
            .update({ is_active: isActive })
            .eq('id', studentId);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur toggle étudiant:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Supprimer un étudiant
app.delete('/admin/students/:studentId', authenticateAdmin, async (req, res) => {
    const { studentId } = req.params;

    try {
        // Supprimer les fichiers de l'étudiant du JSON local
        const database = loadDatabase();
        const filesToDelete = Object.entries(database)
            .filter(([key, file]) => file.uploaderId === studentId);

        filesToDelete.forEach(([shareLink, fileData]) => {
            // Supprimer fichier physique
            const filePath = path.join(uploadsDir, fileData.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            // Supprimer du JSON
            delete database[shareLink];
        });

        saveDatabase(database);

        // Supprimer l'étudiant de Supabase
        const { error } = await supabase
            .from('students')
            .delete()
            .eq('id', studentId);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur suppression étudiant:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Stats admin (JSON local)
app.get('/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        const database = loadDatabase();
        const files = Object.values(database);

        const stats = {
            totalFiles: files.length,
            totalDownloads: files.reduce((sum, file) => sum + (file.downloads || 0), 0)
        };

        res.json(stats);
    } catch (error) {
        console.error('Erreur stats admin:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route pour récupérer les codes d'accès d'un étudiant
app.get('/admin/students/:studentId/access', authenticateAdmin, async (req, res) => {
    const { studentId } = req.params;
    try {
        const { data: student, error } = await supabase
            .from('students')
            .select('access_code')
            .eq('id', studentId)
            .single();

        if (error || !student) {
            return res.status(404).json({ success: false, error: 'Étudiant introuvable' });
        }

        res.json({ success: true, accessCode: student.access_code });
    } catch (error) {
        console.error('Erreur récupération codes:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// Route pour régénérer le code d'accès d'un étudiant
app.post('/admin/students/:studentId/regenerate', authenticateAdmin, async (req, res) => {
    const { studentId } = req.params;
    try {
        // Générer un nouveau code d'accès
        const newAccessCode = Math.random().toString(36).substring(2, 14);
        const hashedCode = await bcrypt.hash(newAccessCode, 10);

        const { data: student, error } = await supabase
            .from('students')
            .update({ access_code: hashedCode })
            .eq('id', studentId)
            .select()
            .single();

        if (error || !student) {
            return res.status(404).json({ success: false, error: 'Étudiant introuvable' });
        }

        console.log(`🔄 Code régénéré pour ${student.name}: ${newAccessCode}`);
        res.json({ success: true, accessCode: newAccessCode });
    } catch (error) {
        console.error('Erreur régénération code:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ==================== ROUTES STATIQUES ====================

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Routes publiques (la vérification d'auth se fait côté client)
app.get('/classroom', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'classroom-realtime.html'));
});

app.get('/classroom.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'classroom-realtime.html'));
});

// ==================== WEBSOCKET ====================

io.on('connection', (socket) => {
    console.log('Nouvel utilisateur connecté:', socket.id);

    socket.on('disconnect', () => {
        console.log('Utilisateur déconnecté:', socket.id);
    });
});

// ==================== DÉMARRAGE SERVEUR ====================

// Test de connexion Supabase au démarrage
async function testSupabaseConnection() {
    try {
        console.log('🔍 Test connexion Supabase...');
        const { data, error } = await supabase
            .from('students')
            .select('count', { count: 'exact' })
            .limit(1);

        if (error) {
            console.error('❌ Erreur connexion Supabase:', error.message);
            return false;
        }

        console.log('✅ Supabase connecté avec succès');
        return true;
    } catch (error) {
        console.error('💥 Erreur test Supabase:', error.message);
        return false;
    }
}

server.listen(PORT, HOST, async () => {
    console.log(`🛡️ Cloud Bachelor AIS démarré sur ${HOST}:${PORT}`);
    console.log(`📚 Interface: http://${HOST}:${PORT}`);
    console.log(`🔐 Auth: Supabase | 💾 Stockage: Local`);
    console.log(`⚡ WebSocket temps réel activé`);

    // Tester Supabase
    await testSupabaseConnection();

    if (process.env.NODE_ENV === 'production') {
        console.log(`🚀 Mode production activé`);
    } else {
        console.log(`🧪 Mode développement - npm run dev`);
    }
});

module.exports = { app, server, io };