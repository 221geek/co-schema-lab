# Configuration Firestore

Pour que la création de boards fonctionne, vous devez déployer les règles de sécurité Firestore.

## 1. Installer Firebase CLI (si nécessaire)

```bash
npm install -g firebase-tools
```

## 2. Se connecter et lier le projet

```bash
firebase login
firebase use YOUR_PROJECT_ID
```

## 3. Déployer les règles Firestore

```bash
firebase deploy --only firestore
```

## 4. Vérifier dans la console Firebase

- Allez sur https://console.firebase.google.com/
- Projet **YOUR_PROJECT_ID**
- **Firestore Database** → **Règles**
- Les règles doivent autoriser la lecture/écriture des documents `boards` pour les utilisateurs authentifiés (propriétaire uniquement)
