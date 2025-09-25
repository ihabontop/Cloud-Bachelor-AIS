-- Script final pour corriger les politiques RLS admin
-- À exécuter dans l'éditeur SQL de Supabase

-- Supprimer toutes les anciennes politiques
DROP POLICY IF EXISTS "Admin can view all admin_users" ON admin_users;
DROP POLICY IF EXISTS "Super admin can modify admin_users" ON admin_users;
DROP POLICY IF EXISTS "Admin can modify admin_users" ON admin_users;

-- Désactiver RLS temporairement pour permettre la vérification d'email lors du login
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- Alternative: Si vous voulez garder RLS, créer une politique qui permet la lecture pour vérification d'email
-- ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "Allow email verification for login" ON admin_users
--     FOR SELECT USING (true);
--
-- CREATE POLICY "Allow authenticated admin operations" ON admin_users
--     FOR ALL USING (auth.uid() IS NOT NULL);

-- Vérifier que l'admin par défaut existe
INSERT INTO admin_users (email, full_name, role)
VALUES ('admin@example.com', 'Administrateur Principal', 'super_admin')
ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = true;

-- Vérifier le résultat
SELECT * FROM admin_users WHERE email = 'admin@example.com';