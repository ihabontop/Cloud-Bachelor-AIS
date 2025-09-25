// Serveur Cloud Bachelor AIS avec Supabase et temps réel
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

// Configuration Supabase
const { supabase } = require('./supabase-config');

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
app.use(express.static('public'));

// Dossiers nécessaires
const uploadsDir = path.join(__dirname, 'uploads');
const tempDir = path.join(__dirname, 'temp');

[uploadsDir, tempDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Middleware d'authentification
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token d\'accès requis' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { data: student } = await supabase
            .from('students')
            .select('*')
            .eq('id', decoded.studentId)
            .eq('is_active', true)
            .single();

        if (!student) {
            return res.status(403).json({ error: 'Étudiant non trouvé ou inactif' });
        }

        req.student = student;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Token invalide' });
    }
};

// Routes d'authentification

// Login étudiant
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

        // Vérifier le code d'accès (haché)
        const isValidCode = await bcrypt.compare(accessCode, student.access_code);
        if (!isValidCode) {
            return res.status(401).json({ error: 'Code d\'accès invalide' });
        }

        // Créer le token JWT
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

// Routes des fichiers

// Upload avec authentification et temps réel
app.post('/upload', authenticateToken, async (req, res) => {
    if (!req.files || !req.files.file) {
        return res.status(400).json({ error: 'Aucun fichier reçu' });
    }

    const file = req.files.file;
    const category = req.body.category || 'general';

    try {
        const shareLink = crypto.SHA256(uuidv4() + Date.now().toString()).toString();
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

        // Insérer en base Supabase
        const { data: fileData, error } = await supabase
            .from('files')
            .insert({
                original_name: file.name,
                filename: filename,
                size: file.size,
                mimetype: file.mimetype,
                share_link: shareLink,
                category: category,
                uploader_id: req.student.id,
                uploader_name: req.student.name
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        // Émettre en temps réel
        io.emit('file_added', {
            ...fileData,
            action: 'added'
        });

        res.json({
            success: true,
            fileId: fileData.id,
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
        // Vérifier que l'étudiant peut supprimer ce fichier
        const { data: file, error: selectError } = await supabase
            .from('files')
            .select('*')
            .eq('id', fileId)
            .eq('uploader_id', req.student.id)
            .eq('is_deleted', false)
            .single();

        if (selectError || !file) {
            return res.status(404).json({ error: 'Fichier non trouvé ou non autorisé' });
        }

        // Marquer comme supprimé
        const { error: updateError } = await supabase
            .from('files')
            .update({ is_deleted: true })
            .eq('id', fileId);

        if (updateError) {
            throw updateError;
        }

        // Supprimer le fichier physique
        const filePath = path.join(uploadsDir, file.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

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
        const { data: files, error } = await supabase
            .from('files')
            .select(`
                id, original_name, size, mimetype, category,
                uploader_name, downloads, created_at, share_link
            `)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

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
        const { data: files, error } = await supabase
            .from('files')
            .select(`
                id, original_name, size, mimetype, category,
                uploader_name, downloads, created_at, share_link
            `)
            .eq('category', category)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        res.json(files);
    } catch (error) {
        console.error('Erreur catégorie:', error);
        res.status(500).json({ error: 'Erreur lors du chargement' });
    }
});

// Statistiques
app.get('/stats', authenticateToken, async (req, res) => {
    try {
        const { data: files, error } = await supabase
            .from('files')
            .select('size, downloads, category, uploader_name')
            .eq('is_deleted', false);

        if (error) {
            throw error;
        }

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
            const uploader = file.uploader_name || 'anonymous';
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
        const { data: file, error } = await supabase
            .from('files')
            .select('*')
            .eq('share_link', shareLink)
            .eq('is_deleted', false)
            .single();

        if (error || !file) {
            return res.status(404).json({ error: 'Fichier non trouvé' });
        }

        const filePath = path.join(uploadsDir, file.filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Fichier physique non trouvé' });
        }

        // Incrémenter downloads
        await supabase
            .from('files')
            .update({ downloads: file.downloads + 1 })
            .eq('id', file.id);

        res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
        res.setHeader('Content-Type', file.mimetype);
        res.sendFile(filePath);
    } catch (error) {
        console.error('Erreur téléchargement:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Routes admin - Ajouter un étudiant
app.post('/admin/students', async (req, res) => {
    const { name, studentCode, groupName } = req.body;

    if (!name || !studentCode) {
        return res.status(400).json({ error: 'Nom et code étudiant requis' });
    }

    try {
        // Générer un code d'accès aléatoire
        const accessCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const hashedCode = await bcrypt.hash(accessCode, 10);

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
            if (error.code === '23505') { // Unique violation
                return res.status(400).json({ error: 'Ce code étudiant existe déjà' });
            }
            throw error;
        }

        res.json({
            success: true,
            student: {
                id: student.id,
                name: student.name,
                studentCode: student.student_code
            },
            accessCode: accessCode // Renvoyer le code en clair pour l'admin
        });
    } catch (error) {
        console.error('Erreur ajout étudiant:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Création en lot d'étudiants
app.post('/admin/students/batch', async (req, res) => {
    const { count, prefix } = req.body;

    if (!count || count < 1 || count > 50) {
        return res.status(400).json({ error: 'Nombre doit être entre 1 et 50' });
    }

    try {
        const students = [];
        const codes = [];

        for (let i = 1; i <= count; i++) {
            const studentCode = `${prefix}${i.toString().padStart(3, '0')}`;
            const accessCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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

        if (error) {
            throw error;
        }

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

// Lister tous les étudiants (admin)
app.get('/admin/students', async (req, res) => {
    try {
        const { data: students, error } = await supabase
            .from('students')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

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

        if (error) {
            throw error;
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur toggle étudiant:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Supprimer un étudiant
app.delete('/admin/students/:studentId', async (req, res) => {
    const { studentId } = req.params;

    try {
        // Supprimer d'abord les fichiers de l'étudiant
        const { error: filesError } = await supabase
            .from('files')
            .update({ is_deleted: true })
            .eq('uploader_id', studentId);

        if (filesError) {
            throw filesError;
        }

        // Supprimer l'étudiant
        const { error: studentError } = await supabase
            .from('students')
            .delete()
            .eq('id', studentId);

        if (studentError) {
            throw studentError;
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur suppression étudiant:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Stats admin
app.get('/admin/stats', async (req, res) => {
    try {
        const { data: files, error } = await supabase
            .from('files')
            .select('size, downloads')
            .eq('is_deleted', false);

        if (error) {
            throw error;
        }

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

// Route de santé
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes statiques
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/classroom', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'classroom-realtime.html'));
});

// Gestion des connexions WebSocket
io.on('connection', (socket) => {
    console.log('Nouvel utilisateur connecté:', socket.id);

    socket.on('disconnect', () => {
        console.log('Utilisateur déconnecté:', socket.id);
    });
});

// Écouter les changements Supabase en temps réel
const subscribeToFileChanges = () => {
    supabase
        .channel('files-changes')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'files'
        }, (payload) => {
            io.emit('file_added', {
                ...payload.new,
                action: 'added'
            });
        })
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'files'
        }, (payload) => {
            if (payload.new.is_deleted) {
                io.emit('file_deleted', {
                    id: payload.new.id,
                    action: 'deleted'
                });
            }
        })
        .subscribe();
};

// Démarrer le serveur
server.listen(PORT, HOST, () => {
    console.log(`🛡️ Cloud Bachelor AIS démarré sur ${HOST}:${PORT}`);
    console.log(`📚 Interface: http://${HOST}:${PORT}`);
    console.log(`🔐 Authentification Supabase activée`);
    console.log(`⚡ WebSocket temps réel activé`);

    // S'abonner aux changements temps réel
    subscribeToFileChanges();
});

module.exports = { app, server, io };