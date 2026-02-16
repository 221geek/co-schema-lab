# CoSchemaLab

Application web collaborative pour concevoir des schémas de base de données en temps réel. Créez des tables, définissez des relations (1:1, 1:N, M:N) et exportez votre schéma en SQL ou JSON avec des données de test générées.

![Angular](https://img.shields.io/badge/Angular-20-DD0031?logo=angular)
![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%7C%20Auth-FFCA28?logo=firebase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwindcss)

---

> **Concevez vos schémas de BDD à plusieurs, en direct.**  
> Plus de specs figées dans des docs : dessinez ensemble, partagez le lien, et exportez en un clic. Du schéma au SQL ou JSON avec données de test — sans quitter le navigateur.

---

## Fonctionnalités

### Designer de schéma
- **Tables** : Créez des tables avec colonnes (UUID, String, Money, Enum, Relation)
- **Relations** : Connectez les tables avec des points de connexion sur chaque côté
- **Cardinalités** : One-to-One (1:1), One-to-Many (1:N), Many-to-Many (M:N)
- **Direction** : Visualisation de la direction des relations (flèches + badges)
- **Édition inline** : Modifiez type et direction directement depuis le badge sur la ligne

### Collaboration en temps réel
- Synchronisation instantanée via Firestore
- Présence des collaborateurs connectés
- Curseurs à distance sur le canvas

### Export
- **SQL** : Script `CREATE TABLE` + optionnellement des `INSERT` avec données
- **JSON** : Schéma (tables, relations) + optionnellement des données
- **Données factices** : Génération via [Faker.js](https://fakerjs.dev/) (emails, noms, prix, etc.)
- Nombre de lignes configurable par table

### Autres
- Zoom et pan sur le canvas
- Annulation (Ctrl/Cmd + Z)
- Partage de lien pour inviter des collaborateurs
- Authentification Firebase (login, signup)

## Prérequis

- Node.js 18+
- Compte Firebase

## Installation

```bash
# Cloner le dépôt
git clone <url-du-repo>
cd CoSchemaLab_front

# Installer les dépendances
npm install --include=dev

# Configurer Firebase (voir section ci-dessous)
```

## Configuration Firebase

1. Créez un projet sur [Firebase Console](https://console.firebase.google.com/)
2. Activez **Authentication** (Email/Password)
3. Créez une base **Firestore**
4. Copiez la configuration dans `src/environments/environment.ts` :

```ts
export const environment = {
  production: false,
  firebase: {
    apiKey: '...',
    authDomain: '...',
    projectId: '...',
    storageBucket: '...',
    messagingSenderId: '...',
    appId: '...',
    measurementId: '...'
  }
};
```

5. Déployez les règles Firestore : `firebase deploy --only firestore`

## Développement

```bash
npm start
```

Ouvre [http://localhost:4200](http://localhost:4200).

## Build

```bash
npm run build
```

Les fichiers sont générés dans `dist/CoSchemaLab_front/`.

## Structure du projet

```
src/
├── app/
│   ├── models/          # Modèles (Table, Field, Relationship)
│   ├── pages/
│   │   ├── login/       # Connexion
│   │   ├── signup/      # Inscription
│   │   ├── boards/      # Liste des boards
│   │   └── designer/    # Éditeur de schéma
│   └── services/
│       ├── auth.service.ts
│       └── board.service.ts  # Firestore, présence
├── environments/        # Config Firebase
└── styles.scss
```

## Raccourcis

| Raccourci | Action |
|-----------|--------|
| Ctrl/Cmd + Z | Annuler |
| Échap | Annuler la création de relation |
| Molette + Ctrl/Cmd | Zoom |

## Technologies

- **Angular 20** – Framework
- **Firebase** – Auth, Firestore, présence
- **Tailwind CSS** – Styles
- **@faker-js/faker** – Génération de données
- **Angular CDK** – Drag & drop

## Licence

Private
