// Configuration Supabase pour Cloud Bachelor AIS
const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase (à remplacer par vos vraies clés)
const supabaseUrl = process.env.SUPABASE_URL || 'https://ysshkeobtkicyjgsbjdb.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzc2hrZW9idGtpY3lqZ3NiamRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTMxMDcsImV4cCI6MjA3NDM4OTEwN30.CGs80sv6dw10nYAoc3pyDjaXnS8cEddPLH-PzqRkyy4';

// Client principal pour les opérations générales
const supabase = createClient(supabaseUrl, supabaseKey);

// Client service pour les opérations serveur (si service key disponible)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAdmin = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    : supabase; // Fallback au client normal

// Schéma SQL pour créer les tables Supabase
const SQL_SCHEMA = `
-- Table des étudiants avec codes d'accès
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    student_code VARCHAR(20) UNIQUE NOT NULL,
    access_code VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    group_name VARCHAR(50)
);

-- Table des fichiers avec métadonnées étendues
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_name VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    size BIGINT NOT NULL,
    mimetype VARCHAR(100) NOT NULL,
    share_link VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    uploader_id UUID REFERENCES students(id),
    uploader_name VARCHAR(100) NOT NULL,
    downloads INTEGER DEFAULT 0,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des sessions actives
CREATE TABLE IF NOT EXISTS active_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id),
    session_token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_files_category ON files(category);
CREATE INDEX IF NOT EXISTS idx_files_uploader ON files(uploader_id);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);
CREATE INDEX IF NOT EXISTS idx_students_code ON students(student_code);

-- Enable Row Level Security (RLS)
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour la sécurité
CREATE POLICY "Étudiants peuvent voir tous les fichiers" ON files
    FOR SELECT USING (is_deleted = false);

CREATE POLICY "Étudiants peuvent uploader des fichiers" ON files
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Étudiants peuvent supprimer leurs propres fichiers" ON files
    FOR UPDATE USING (uploader_id = auth.uid());

-- Triggers pour updated_at automatique
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

module.exports = {
    supabase,
    supabaseAdmin,
    SQL_SCHEMA
};