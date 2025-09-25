# Configuration de l'Administration

Ce guide explique comment configurer l'accès administrateur pour Cloud Bachelor AIS.

## 1. Configuration de la base de données Supabase

### Étape 1: Créer la table admin_users

1. Connectez-vous à votre dashboard Supabase
2. Allez dans **SQL Editor**
3. Copiez et exécutez le contenu du fichier `supabase-admin-setup.sql`

### Étape 2: Ajouter votre premier admin

Modifiez cette ligne dans le script SQL avant l'exécution :
```sql
INSERT INTO admin_users (email, full_name, role)
VALUES ('VOTRE_EMAIL@example.com', 'Votre Nom', 'super_admin')
ON CONFLICT (email) DO NOTHING;
```

Remplacez `VOTRE_EMAIL@example.com` par votre vraie adresse email.

## 2. Création du compte utilisateur Supabase

### Étape 1: Créer un compte utilisateur

1. Allez dans **Authentication > Users** dans votre dashboard Supabase
2. Cliquez sur **Add user**
3. Utilisez la **même adresse email** que celle ajoutée dans `admin_users`
4. Définissez un mot de passe sécurisé
5. Confirmez la création

### Étape 2: Vérifier la configuration

1. Vérifiez que l'utilisateur apparaît dans **Authentication > Users**
2. Vérifiez que l'email apparaît dans la table `admin_users`

## 3. Accès à l'interface admin

### URL d'accès
```
http://localhost:3000/admin/login
```

### Processus de connexion
1. Utilisez l'email et le mot de passe configurés dans Supabase Auth
2. Le système vérifie automatiquement que l'email est autorisé dans `admin_users`
3. Une fois connecté, vous êtes redirigé vers `/admin`

## 4. Sécurité

### Protection des routes
- Toutes les routes `/admin/*` (sauf `/admin/login`) sont protégées
- L'authentification utilise les tokens Supabase JWT
- Les permissions sont vérifiées via la table `admin_users`

### Rôles disponibles
- `admin` : Accès administrateur standard
- `super_admin` : Accès administrateur avec privilèges étendus

### Déconnexion automatique
- Token expiré : redirection automatique vers login
- Utilisateur désactivé : accès refusé
- Email retiré de `admin_users` : accès refusé

## 5. Gestion des admins

### Ajouter un nouvel admin
```sql
INSERT INTO admin_users (email, full_name, role)
VALUES ('nouvel.admin@example.com', 'Nom Admin', 'admin');
```

N'oubliez pas de créer le compte utilisateur correspondant dans Supabase Auth.

### Désactiver un admin
```sql
UPDATE admin_users
SET is_active = false
WHERE email = 'admin@example.com';
```

### Supprimer un admin
```sql
DELETE FROM admin_users
WHERE email = 'admin@example.com';
```

## 6. Dépannage

### Erreur "Email non autorisé"
- Vérifiez que l'email existe dans la table `admin_users`
- Vérifiez que `is_active = true`

### Erreur "Token invalide"
- Vérifiez que l'utilisateur existe dans Supabase Auth
- Vérifiez que le mot de passe est correct
- Essayez de vous déconnecter et reconnecter

### Erreur 404 sur /admin
- Vérifiez que le serveur est démarré
- Vérifiez que vous êtes bien connecté (sinon redirection vers /admin/login)

## 7. Variables d'environnement requises

Assurez-vous que votre fichier `.env.local` contient :
```
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

Ces variables sont nécessaires pour que le client puisse se connecter à Supabase.