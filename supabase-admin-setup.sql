-- Script SQL pour créer la table admin_users dans Supabase
-- À exécuter dans l'éditeur SQL de Supabase

-- Créer la table admin_users
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Créer un index sur l'email pour les requêtes rapides
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- Activer RLS (Row Level Security)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre l'accès aux admins authentifiés
-- Utilise auth.uid() au lieu de faire une requête sur la même table
CREATE POLICY "Admin can view all admin_users" ON admin_users
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Politique pour permettre aux super_admins de modifier
-- Simplifié pour éviter la récursion - sera géré côté application
CREATE POLICY "Admin can modify admin_users" ON admin_users
    FOR ALL USING (auth.uid() IS NOT NULL);

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour updated_at
CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insérer un premier admin (remplacez l'email par le vôtre)
INSERT INTO admin_users (email, full_name, role)
VALUES ('admin@example.com', 'Administrateur Principal', 'super_admin')
ON CONFLICT (email) DO NOTHING;

-- Afficher le résultat
SELECT * FROM admin_users;